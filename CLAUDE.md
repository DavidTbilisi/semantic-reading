# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step — open `index.html` directly in a browser. There are no dependencies to install, no npm, no bundler, and no test suite.

## Architecture

The entire application is a single self-contained file: `index.html` (~2200 lines of HTML + CSS + JS). No frameworks, no external scripts beyond Google Fonts.

### State model

All mutable application data lives in one plain object:

```js
state = { id, title, mode, paragraphs, rawText }
```

`paragraphs` is the core data structure: an array of paragraphs, each paragraph an array of **segments**:

```js
[{ text: string, tag?: string }, ...]
```

Untagged segments have no `tag` field; tagged segments carry a sigil string like `"Def"` or `"R"`. Adjacent segments with the same tag are always merged (invariant enforced by `mergeAdjacent`).

### Tag & Mode system

- **`TAGS`** — 14 annotation sigils grouped into 4 families: `Anchor` (N, D, P), `Meaning` (Def, Q), `Structure` (R, C, B, L, T, X, Assump), `Execution` (A, M).
- **`MODES`** (1–5, Easy → Regenerative) — each mode exposes a subset of tags. The active mode controls which sigils appear in the floating tagbar and which keyboard shortcuts are live.

### Selection → mark pipeline

1. `handleSelection` fires on `mouseup`/`keyup` inside the reader, detects a non-collapsed selection inside a `.para` element, and calls `showTagbar`.
2. User picks a sigil (click or keyboard initial) → `applyTagToSelection(tag)`.
3. `applyTagToSelection` converts the browser `Range` to character offsets within the paragraph's plain text via `textLengthInRange` (which clones the range, strips `.tlabel` `<sup>` nodes, then measures `textContent.length`). **Critical**: `.tlabel` elements must be excluded or the offset drifts by the length of each preceding tag label.
4. `applyTagRange(pi, startChar, endChar, tag)` walks the segment array, splits segments at the range boundaries, overwrites the middle segment's tag, then calls `mergeAdjacent`.
5. `renderReader` rebuilds the reader DOM from `state.paragraphs`. Each tagged segment renders as `<span class="tspan ...">text<sup class="tlabel">sigil</sup></span>`.

### Structure tab sub-views

- **Cards** (`renderCards`) — one card per paragraph with tagged spans grouped by semantic family.
- **Apparatus / Sheet** (`renderSheet`) — flat table of all tagged spans, grouped by tag family.
- **Atlas / Map** (`renderMap`) — SVG concept graph. Nodes are unique `Def`-tagged spans (normalized/deduped). Edges connect two `Def` nodes that co-occur in the same paragraph; edge weight = co-occurrence count. Layout is a simple deterministic circle. Side bins show non-Def structural tags.

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
| `Esc` | Clear selection / hide tagbar |
| Letter key with selection active | Apply tag (d=Def, r=R, b=B, c=C, l=L, t=T, x=X, a=A, m=M, q=Q, n=N, p=P, w=D, s=Assump) |
