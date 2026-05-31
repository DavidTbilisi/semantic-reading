# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step — open `index.html` directly in a browser, or `npm run serve` for an HTTP-served copy on port 3700. No framework dependencies; the only runtime asset is Google Fonts.

```bash
npm install     # only needed if you want to run the test suite or regenerate demo media
npm run serve   # http://localhost:3700
npm test        # Playwright e2e (45) + in-browser unit suite (89 tests via test.html)
npm run demo    # regenerate docs/img/*.png and docs/video/walkthrough.webm
```

## Architecture

The app is split into eight small JS modules loaded by `index.html` in dependency order. Each file uses plain `var` top-level declarations so its exports land on `window` and the next file in the load order can see them — there is no module system at runtime.

```
constants.js → utils.js → state.js → storage.js → segments.js
                                          ↓
                                  export.js → render.js → app.js
```

| File | Role | Pure? |
|------|------|-------|
| `js/constants.js` | `TAGS`, `MODES`, `FAMILIES`, `FRAMEWORKS`, `CARD_GROUPS`, `DEMO`, `tagOrder()` | yes |
| `js/utils.js` | `$`, `$$`, `cssTag`, `escapeHtml`, `truncate`, `safeName`, `tagForKey`, `toast`, `copy`, `download` | yes (touches DOM only via helpers) |
| `js/state.js` | the single `state` object + `applySessionToState`, `resetState`, `syncFromInputIfNeeded` | reads `#input-text` |
| `js/storage.js` | localStorage I/O: `loadSessionsList`, `writeSession`, `loadSession`, `deleteSessionData`, `buildSessionData` | yes |
| `js/segments.js` | segment-array operations: `buildSegments`, `applyTagRange`, `removeTagAt`, `mergeAdjacent` | yes |
| `js/export.js` | data builders: `countTags`, `buildMarkdown`, `buildJson`, `flatExtracts`, `routeToFrameworks`, `csvField`, `buildAnkiCsvs` | yes |
| `js/render.js` | DOM rebuilders: `renderReader`, `renderLegend`, `renderStructure[Body]`, `renderCards`, `renderSheet`, `renderMap`, `renderGaps`, `renderExport`, `renderSessions`, `renderAnkiCsvs` | DOM-only |
| `js/app.js` | event wiring, selection pipeline, theme, tabs, note popup, keyboard, `init()` | side-effects |

`style.css` is a separate file (no inline styles) and holds the entire visual layer — light/dark theme variables, tagbar layout, tspan tinting, SVG map styling.

### State model

All mutable application data lives in one plain object:

```js
state = { id, title, mode, paragraphs, rawText }
```

`paragraphs` is the core data structure: an array of paragraphs, each paragraph an array of **segments**:

```js
[{ text: string, tag?: string, note?: string }, ...]
```

Untagged segments have no `tag` field; tagged segments carry a sigil string like `"Def"` or `"R"`. A segment may also carry a `note` (free-text annotation entered via the popup). Adjacent segments with the same `tag` *and* `note` are always merged (invariant enforced by `mergeAdjacent`).

### Tag & Mode system

- **`TAGS`** — 19 annotation sigils grouped into 4 families:
  - `Anchor`: `N`, `D`, `P`
  - `Meaning`: `Def` + children `Mn`/`Ex`/`An`, and `Q`
  - `Structure`: `R` + child `Ev`, plus `C`, `B`, `L`, `T`, `X` + child `Opp`, and `Assump`
  - `Execution`: `A`, `M`
- Each tag declares a `route` (`NEDF`, `CAST`, `SPEAR`, `HEART`, `ORACLE`, or `*` for cross-cutting) used by the Anki CSV bucketer.
- Parent/child relationships (e.g., `Mn`/`Ex`/`An` under `Def`) are honoured by `tagOrder`, the legend, the tagbar, and the Cards grouping.
- **`MODES`** (1–5, Easy → Regenerative) — each mode exposes a subset of tags. The active mode controls which sigils appear in the floating tagbar and which keyboard shortcuts are live.

### Selection → mark pipeline

1. `handleSelection` (in `app.js`) fires on `mouseup`/`keyup` inside the reader, detects a non-collapsed selection inside a `.para` element, and calls `showTagbar`.
2. User picks a sigil (click or keyboard initial) → `applyTagToSelection(tag)`.
3. `applyTagToSelection` converts the browser `Range` to character offsets within the paragraph's plain text via `textLengthInRange` (which clones the range, strips `.tlabel` `<sup>` nodes, then measures `textContent.length`). **Critical invariant**: `.tlabel` elements must be excluded or the offset drifts by the length of each preceding tag label. Two paragraph-number prefix characters (`¶<n>`) are also stripped via `paraNumberPrefixLength`. This invariant is guarded by the multi-word marking tests in `tests/app.spec.js`.
4. `applyTagRange(pi, startChar, endChar, tag)` walks the segment array, splits segments at the range boundaries, overwrites the middle segment's tag, then calls `mergeAdjacent`.
5. `renderReader` rebuilds the reader DOM from `state.paragraphs`. Each tagged segment renders as `<span class="tspan ...">text<sup class="tlabel">sigil</sup></span>`.

### Structure tab sub-views

- **Cards** (`renderCards`) — one card per paragraph with tagged spans grouped by semantic family (per `CARD_GROUPS`).
- **Apparatus / Sheet** (`renderSheet`) — flat list of all tagged spans, grouped by tag family.
- **Atlas / Map** (`renderMap`) — SVG concept graph. Nodes are unique `Def`-tagged spans (normalized/deduped). Edges connect two `Def` nodes that co-occur in the same paragraph; edge weight = co-occurrence count. Layout is a simple deterministic circle. Side bins list non-Def structural tags.
- **Gaps** (`renderGaps`) — open `Q` questions and any reader notes attached via the note popup.

`renderStructureBody` short-circuits to a "Mark some text first" placeholder in all four sub-view containers when no tagged spans exist anywhere.

### Persistence

Sessions are stored in `localStorage`:
- `sr_marker_sessions` — JSON array of `{id, title, savedAt}` (index, max 50 entries).
- `sr_marker_session_<id>` — full session data including `paragraphs` segment array.

Theme preference is stored under `sr_marker_theme` and applied before first paint (inline script in `<head>`).

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1`–`4` | Jump to tab by number |
| `←` / `→` | Step tabs |
| `Ctrl`/`Cmd`+`S` | Save session |
| `Esc` | Clear selection / hide tagbar / close note popup |
| Letter key with selection active | Apply tag (d=Def, r=R, b=B, c=C, l=L, t=T, x=X, a=A, m=M, q=Q, n=N, p=P, w=D-date, s=Assump, e=Ev, g=Ex, i=Mn, y=An, o=Opp). A letter is a no-op if the mapped tag is not in the current mode. |

## Tests

Two suites — both fire from a single `npm test`:

- **`test.html`** — a self-contained in-browser test runner with 89 assertions across `utils`, `segments`, `state`, `storage`, `export`, and `constants.tagOrder`. Open it directly in a browser for a colour-coded view; Playwright drives it via `tests/unit.spec.js` and surfaces failures with first-error excerpts.
- **`tests/app.spec.js`** — 45 Playwright e2e tests covering the selection → tag pipeline (including label-length offset drift across re-tag and reorder), all four Structure sub-views, note popups, the Atlas SVG, the session list (load/delete via confirm), keyboard shortcuts, mode-scoped no-op letters, Anki CSV export, and theme persistence across reload.

`playwright.config.js` is set to `fullyParallel: false` and `reuseExistingServer: true` so a developer can keep `npm run serve` running on port 3700 while iterating on tests.

## Demo media

Generated artifacts live under `docs/img/` (PNG screenshots) and `docs/video/walkthrough.webm`. `npm run demo` regenerates everything; `scripts/with-server.js` spins up the dev server and `scripts/generate-demo.js` drives Chromium through each capture. README embeds them as relative paths.

## Companion Obsidian plugin

`obsidian-plugin/` holds the BRAT-distributed Obsidian plugin that mirrors this studio's tag model (`{{Tag|text}}` inline syntax, hub pages, Vault Atlas, FSRS review queue, AI Suggest, MCP server). It is a separate npm project with its own `package.json` and TypeScript build; that subtree is currently untracked from this repo's git index.
