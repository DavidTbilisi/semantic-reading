'use strict';

// CDP-attaches to the Obsidian instance launched by with-obsidian.js, then
// drives the workspace through the plugin's main views and writes PNG
// screenshots into <release-repo>/docs/img/.
//
// Inherits CDP_PORT and VAULT_PATH from the parent launcher.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const PORT  = Number(process.env.CDP_PORT || 9333);
const OUT   = path.resolve(__dirname, '..', '..', '..', 'obsidian-semantic-reading', 'docs', 'img');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function pickAppPage(browser) {
  // Find the renderer that's hosting the vault (not DevTools, not the starter).
  const contexts = browser.contexts();
  let candidate = null;
  for (const ctx of contexts) {
    for (const page of ctx.pages()) {
      const url = page.url();
      if (url.startsWith('app://obsidian.md') && !url.endsWith('/starter.html')) {
        return page;
      }
      if (!candidate && url.startsWith('app://')) candidate = page;
    }
  }
  if (!candidate) throw new Error('no app:// page found among CDP targets');
  return candidate;
}

async function runCommand(page, commandId) {
  // Drives Obsidian's command palette: open it via Cmd+P, type the prefix,
  // pick the first item. For internal IDs (e.g. 'semantic-reading:open-cards-view')
  // we instead call into Obsidian's command registry directly via evaluate().
  await page.evaluate((id) => {
    // window.app is the Obsidian App singleton.
    // app.commands.executeCommandById returns true if the command exists.
    return window.app.commands.executeCommandById(id);
  }, commandId);
  await sleep(450);
}

// CardsView and AtlasView call `getActiveViewOfType(MarkdownView)` on refresh,
// so they only populate when the active leaf is markdown. If we open them as
// a tab they steal focus and end up empty.
//
// The right tactic: split the main area vertically, put the source note in
// the left half + the view in the right half, then refocus the markdown
// leaf so the view picks it up — and finally trigger the view's refresh
// manually since active-leaf-change fired *before* the view was created.
async function openViewSplitWithSource(page, viewType, sourceFile) {
  await page.evaluate(async ({ viewType, sourceFile }) => {
    const ws = window.app.workspace;
    // Detach any existing instances first.
    for (const leaf of ws.getLeavesOfType(viewType)) leaf.detach();

    const tf = window.app.vault.getAbstractFileByPath(sourceFile);
    const mdLeaf = ws.getLeaf(false);
    await mdLeaf.openFile(tf);

    const splitLeaf = ws.getLeaf('split', 'vertical');
    await splitLeaf.setViewState({ type: viewType, active: true });

    // Refocus the markdown leaf so any view that reads the active leaf sees it.
    ws.setActiveLeaf(mdLeaf, { focus: false });

    // Force the side view to refresh against the now-active markdown leaf.
    const view = splitLeaf.view;
    if (view && typeof view.refresh === 'function')        await view.refresh();
    else if (view && typeof view.onOpen === 'function')    await view.onOpen();
    else if (view && typeof view.scheduleRefresh === 'function') view.scheduleRefresh(0);

    ws.revealLeaf(splitLeaf);
  }, { viewType, sourceFile });
  await sleep(900);
}

// For plugin views that don't need a source note (VaultAtlas, Review).
// Approach: detach sidebar-only plugin leaves, then reduce the main root to
// a single leaf and switch its view to the requested type. We never detach
// the last root leaf — Obsidian throws "No tab group found" if the main root
// is empty when we try to allocate a new leaf.
async function openStandaloneView(page, viewType) {
  await page.evaluate(async (viewType) => {
    const ws = window.app.workspace;
    const PLUGIN_TYPES = [
      'semantic-reading-cards',
      'semantic-reading-atlas',
      'semantic-reading-vault-atlas',
      'semantic-reading-review',
    ];

    // Collect every leaf currently in the main root; keep one, detach the rest.
    const rootLeaves = [];
    ws.iterateRootLeaves((leaf) => rootLeaves.push(leaf));
    const keeper = rootLeaves.shift();
    for (const leaf of rootLeaves) leaf.detach();

    // Detach plugin leaves anywhere (sidebars, popouts) except the keeper.
    for (const t of PLUGIN_TYPES) {
      for (const leaf of ws.getLeavesOfType(t)) {
        if (leaf !== keeper) leaf.detach();
      }
    }

    if (keeper) {
      await keeper.setViewState({ type: viewType, active: true });
      ws.setActiveLeaf(keeper, { focus: false });
      ws.revealLeaf(keeper);
    }
  }, viewType);
  await sleep(900);
}

async function openFile(page, vaultRelativePath) {
  await page.evaluate(async (p) => {
    const tfile = window.app.vault.getAbstractFileByPath(p);
    if (!tfile) throw new Error('file not in vault: ' + p);
    await window.app.workspace.getLeaf(false).openFile(tfile);
  }, vaultRelativePath);
  await sleep(500);
}

async function setMode(page, mode) {
  // 'preview' (Reading) | 'source' (Source) | (Live Preview = source + !source-mode flag, controlled differently)
  await page.evaluate((m) => {
    const leaf = window.app.workspace.activeLeaf;
    if (leaf && leaf.view && leaf.view.setState) {
      leaf.view.setState({ ...leaf.view.getState(), mode: m }, { history: false });
    }
  }, mode);
  await sleep(400);
}

async function setSidebarsCollapsed(page, left, right) {
  await page.evaluate(({ left, right }) => {
    if (left)  window.app.workspace.leftSplit.collapse();
    else       window.app.workspace.leftSplit.expand();
    if (right) window.app.workspace.rightSplit.collapse();
    else       window.app.workspace.rightSplit.expand();
  }, { left, right });
  await sleep(250);
}

async function shoot(page, name, { keepSettings = false } = {}) {
  if (!keepSettings) {
    // Defensive: Obsidian occasionally re-opens the Settings modal after
    // certain workspace operations. Close it before every shot unless the
    // caller explicitly wants it open (the settings capture itself).
    await page.evaluate(() => {
      if (window.app.setting && window.app.setting.containerEl && !window.app.setting.containerEl.matches('.is-hidden')) {
        window.app.setting.close();
      }
    });
    await sleep(150);
  }
  const out = path.join(OUT, name + '.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('  ✓', path.relative(process.cwd(), out));
}

async function dismissTrustDialog(page) {
  // Obsidian opens a "Do you trust the author of this vault?" modal the very
  // first time it sees a vault with community plugins enabled. The dialog
  // class is `.modal`; the primary button text is "Trust author and enable plugins".
  // If the dialog isn't present (e.g., second run), this is a fast no-op.
  try {
    const btn = await page.waitForSelector(
      'button:has-text("Trust author and enable plugins")',
      { timeout: 3000 }
    );
    if (btn) {
      await btn.click();
      console.log('  · trusted vault (dismissed first-run dialog)');
    }
  } catch (_) { /* dialog absent, fine */ }
}

async function waitForPluginLoaded(page, pluginId = 'semantic-reading', maxMs = 15_000) {
  await page.waitForFunction(
    (id) => !!(window.app && window.app.plugins && window.app.plugins.plugins[id]),
    pluginId,
    { timeout: maxMs }
  );
}

(async () => {
  ensureDir(OUT);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  try {
    const page = await pickAppPage(browser);
    await page.setViewportSize({ width: 1440, height: 900 });
    await sleep(800);

    // First-run trust dialog must be dismissed before any plugin loads.
    await dismissTrustDialog(page);
    await waitForPluginLoaded(page);
    console.log('  · plugin loaded');

    // Obsidian auto-opens the Community Plugins settings panel as confirmation
    // after the trust dialog is dismissed — close it.
    await page.evaluate(() => {
      if (window.app.setting && window.app.setting.close) window.app.setting.close();
    });
    await sleep(300);

    // Force a re-render of the active leaf so any markdown that opened before
    // the plugin attached gets processed by its postprocessor.
    await page.evaluate(() => {
      const leaf = window.app.workspace.activeLeaf;
      if (leaf && leaf.rebuildView) leaf.rebuildView();
    });
    await sleep(800);

    // Let the indexer scan all seeded notes.
    await sleep(2000);

    // ── 01 hero — Reading mode of Industrialization ────────────────────────
    await openFile(page, 'Notes/Industrialization.md');
    await setMode(page, 'preview');
    await setSidebarsCollapsed(page, false, true);
    await sleep(700);
    await shoot(page, '01-hero-reading');

    // ── 02 same note, Live Preview (source toggled to LP via state) ────────
    await page.evaluate(() => {
      const leaf = window.app.workspace.activeLeaf;
      const st   = leaf.view.getState();
      leaf.view.setState({ ...st, mode: 'source', source: false }, { history: false });
    });
    await sleep(600);
    await shoot(page, '02-live-preview');

    // ── 03 Cards / Sheet / Gaps view side-by-side with source note ─────────
    await setSidebarsCollapsed(page, true, true);
    await openViewSplitWithSource(page, 'semantic-reading-cards', 'Notes/Industrialization.md');
    await shoot(page, '03-cards-view');

    // ── 04 Per-note concept atlas side-by-side with source note ────────────
    await openViewSplitWithSource(page, 'semantic-reading-atlas', 'Notes/Industrialization.md');
    await shoot(page, '04-atlas-view');

    // ── 05 Vault-wide concept atlas (standalone, no source needed) ─────────
    await openStandaloneView(page, 'semantic-reading-vault-atlas');
    await sleep(600);
    await shoot(page, '05-vault-atlas');

    // ── 06 Review queue ────────────────────────────────────────────────────
    await openStandaloneView(page, 'semantic-reading-review');
    await shoot(page, '06-review');

    // ── 07 Command palette (Cmd+P) showing the sr_ commands ────────────────
    // Close any open side leaves first for a clean shot.
    await setSidebarsCollapsed(page, true, true);
    await sleep(300);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+P' : 'Control+P');
    await sleep(400);
    await page.keyboard.type('semantic reading');
    await sleep(500);
    await shoot(page, '07-commands');
    await page.keyboard.press('Escape');
    await sleep(200);

    // ── 08 Settings tab ────────────────────────────────────────────────────
    await page.evaluate(() => {
      window.app.setting.open();
      window.app.setting.openTabById('semantic-reading');
    });
    await sleep(900);
    await shoot(page, '08-settings', { keepSettings: true });
    await page.evaluate(() => window.app.setting.close());
    await sleep(200);

    await setSidebarsCollapsed(page, false, false);
  } finally {
    await browser.close();
  }
})();
