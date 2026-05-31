'use strict';

const { test, expect } = require('@playwright/test');

const SAMPLE_TEXT = `The mitochondria is the powerhouse of the cell.

Energy production occurs through oxidative phosphorylation, a complex process involving multiple enzyme systems.

Cells regulate energy output dynamically based on metabolic demand.`;

// Seed localStorage before the app boots so init() calls newSession(false)
// (leaving the input tab visible) rather than loadDemo() which shows structure.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const savedAt = '2025-01-01T00:00:00Z';
    const session = { id: 's_seed', title: 'seed', mode: 3, paragraphs: [], rawText: '', savedAt };
    localStorage.setItem('sr_marker_sessions', JSON.stringify([{ id: 's_seed', title: 'seed', savedAt }]));
    localStorage.setItem('sr_marker_session_s_seed', JSON.stringify(session));
  });
  await page.goto('/');
});

// ─── helpers ─────────────────────────────────────────────────────────────────

async function pasteTextAndGoMark(page, text) {
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', text);
  await page.click('[data-tab="mark"]');
  await page.waitForSelector('.para');
}

// Programmatically selects all text in the first .para and shows the tagbar.
// Triple-click in headless Chromium doesn't reliably set window.getSelection,
// so we set the Range via evaluate and dispatch mouseup to trigger handleSelection.
async function selectFirstParaAndShowTagbar(page) {
  await page.evaluate(() => {
    const para  = document.querySelector('.para');
    const range = document.createRange();
    range.selectNodeContents(para);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)');
}

// Finds `word` in the reader (skipping .tlabel nodes), selects it, shows the
// tagbar, then clicks the button for `tag`. Throws if the word is not found.
// This is the key helper for multi-word marking tests: it locates the word via
// a TreeWalker so that already-tagged spans don't confuse the offset, and it
// explicitly avoids selecting inside .tlabel text — which is what guards against
// the label-length drift bug (Def=3, Assump=6 chars shifting the next mark).
async function selectWordAndTag(page, word, tag) {
  const found = await page.evaluate((targetWord) => {
    const reader = document.getElementById('reader');
    const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('.tlabel')) continue; // skip label text
      const idx = node.textContent.indexOf(targetWord);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + targetWord.length);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        return true;
      }
    }
    return false;
  }, word);
  if (!found) throw new Error(`Word not found in reader: "${word}"`);
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)');
  await page.locator('.tagbar-btn', { hasText: tag }).first().click();
}

// Returns [{text, tag}, ...] for every .tspan in the reader.
// Strips the .tlabel text so `text` matches the raw marked word.
function tspanSnapshot(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.tspan')].map(span => {
      const label = span.querySelector('.tlabel');
      return {
        text: span.textContent.replace(label ? label.textContent : '', ''),
        tag:  label ? label.textContent : '',
      };
    })
  );
}

// ─── App loads ───────────────────────────────────────────────────────────────

test('page title and top-level chrome are visible', async ({ page }) => {
  await expect(page).toHaveTitle(/Semantic Reading/);
  await expect(page.locator('.brand-main')).toHaveText('Semantic Reading');
  await expect(page.locator('#btn-demo')).toBeVisible();
  await expect(page.locator('#btn-save')).toBeVisible();
  await expect(page.locator('[data-tab="input"]')).toBeVisible();
});

test('all four tabs are rendered', async ({ page }) => {
  for (const tab of ['input', 'mark', 'structure', 'export']) {
    await expect(page.locator(`[data-tab="${tab}"]`)).toBeVisible();
  }
});

test('input pane is active by default', async ({ page }) => {
  await expect(page.locator('#pane-input')).not.toHaveClass(/hidden/);
  await expect(page.locator('#pane-mark')).toHaveClass(/hidden/);
});

// ─── Input → Mark flow ────────────────────────────────────────────────────────

test('pasting text and switching to mark tab renders paragraphs', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  await expect(page.locator('.para')).toHaveCount(3);
});

test('mark tab shows reader-empty hint when input is blank', async ({ page }) => {
  await page.click('[data-tab="mark"]');
  await expect(page.locator('.reader-empty')).toBeVisible();
});

// ─── Tagging ─────────────────────────────────────────────────────────────────

test('selecting text and pressing a tag key creates a tagged span', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  await selectFirstParaAndShowTagbar(page);

  // Click the Def button in the floating tagbar
  await page.locator('.tagbar-btn', { hasText: 'Def' }).click();

  await expect(page.locator('.tspan').first()).toBeVisible();
  await expect(page.locator('.tlabel').first()).toBeVisible();
});

test('clicking a tagged span opens the note popup; Remove button retracts the tag', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  await selectFirstParaAndShowTagbar(page);
  await page.locator('.tagbar-btn', { hasText: 'R' }).first().click();
  await expect(page.locator('.tspan').first()).toBeVisible();

  // Click the tagged span (no text selected) → note popup appears
  await page.locator('.tspan').first().click();
  await expect(page.locator('#note-popup')).not.toHaveClass(/hidden/);

  // The popup's Remove button retracts the tag
  await page.locator('#note-popup-remove').click();
  await expect(page.locator('.tspan')).toHaveCount(0);
  await expect(page.locator('#note-popup')).toHaveClass(/hidden/);
});

// ─── Mode switching ───────────────────────────────────────────────────────────

test('clicking a mode button marks it active', async ({ page }) => {
  await page.click('[data-mode="1"]');
  await expect(page.locator('[data-mode="1"]')).toHaveClass(/active/);
  await expect(page.locator('[data-mode="3"]')).not.toHaveClass(/active/);
});

test('mode description updates when mode changes', async ({ page }) => {
  const desc   = page.locator('#mode-desc');
  const before = await desc.textContent();
  await page.click('[data-mode="1"]');
  const after  = await desc.textContent();
  expect(after).not.toBe(before);
});

// ─── Structure tab ────────────────────────────────────────────────────────────

test('structure tab cards view renders after tagging', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  await selectFirstParaAndShowTagbar(page);
  await page.locator('.tagbar-btn', { hasText: 'Def' }).click();

  await page.click('[data-tab="structure"]');
  await expect(page.locator('#sub-cards')).not.toHaveClass(/hidden/);
  await expect(page.locator('.scard').first()).toBeVisible();
});

test('switching structure sub-tabs shows the correct sub-view', async ({ page }) => {
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', SAMPLE_TEXT);
  await page.click('[data-tab="structure"]');

  await page.click('[data-sub="sheet"]');
  await expect(page.locator('#sub-sheet')).not.toHaveClass(/hidden/);
  await expect(page.locator('#sub-cards')).toHaveClass(/hidden/);

  await page.click('[data-sub="map"]');
  await expect(page.locator('#sub-map')).not.toHaveClass(/hidden/);
});

// ─── Export tab ───────────────────────────────────────────────────────────────

test('export tab renders markdown and JSON', async ({ page }) => {
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', SAMPLE_TEXT);
  // Visit mark first so paragraphs are synced into state
  await page.click('[data-tab="mark"]');
  await page.click('[data-tab="export"]');

  await expect(page.locator('#export-md')).not.toBeEmpty();
  await expect(page.locator('#export-json')).not.toBeEmpty();
});

test('exported JSON is valid and contains expected fields', async ({ page }) => {
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', SAMPLE_TEXT);
  await page.click('[data-tab="mark"]');
  await page.click('[data-tab="export"]');

  const raw    = await page.locator('#export-json').textContent();
  const parsed = JSON.parse(raw);
  expect(parsed).toHaveProperty('title');
  expect(parsed).toHaveProperty('mode');
  expect(parsed).toHaveProperty('paragraphs');
  expect(parsed).toHaveProperty('counts');
});

// ─── Demo button ──────────────────────────────────────────────────────────────

test('demo button loads content and switches to structure tab', async ({ page }) => {
  // Demo has paragraphs — the confirm dialog only fires when state.paragraphs.length > 0.
  // With a fresh newSession the paragraphs are empty, so no confirm needed.
  await page.click('#btn-demo');
  await expect(page.locator('#pane-structure')).not.toHaveClass(/hidden/);
  expect(await page.locator('.para').count()).toBeGreaterThan(0);
});

// ─── Theme toggle ─────────────────────────────────────────────────────────────

test('theme toggle button switches between light and dark', async ({ page }) => {
  const html    = page.locator('html');
  const initial = await html.getAttribute('data-theme');

  await page.click('#btn-theme');
  const after = await html.getAttribute('data-theme');
  expect(after).not.toBe(initial);
  expect(['light', 'dark']).toContain(after);
});

// ─── Session save ─────────────────────────────────────────────────────────────

test('save button stores session visible in folios list', async ({ page }) => {
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', SAMPLE_TEXT);
  await page.fill('#title', 'E2E Session');

  await page.keyboard.press('Control+s');

  await expect(page.locator('#sessions')).toContainText('E2E Session');
});

// ─── Keyboard nav ─────────────────────────────────────────────────────────────

test('arrow keys step through tabs', async ({ page }) => {
  // App starts on input tab; ArrowRight should advance to mark
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#pane-mark')).not.toHaveClass(/hidden/);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#pane-structure')).not.toHaveClass(/hidden/);
});

test('number key 1 switches to input tab', async ({ page }) => {
  await page.click('[data-tab="mark"]');
  await page.keyboard.press('1');
  await expect(page.locator('#pane-input')).not.toHaveClass(/hidden/);
});

// ─── Multi-word marking in one paragraph ─────────────────────────────────────
//
// These tests guard against label-length offset drift: when a span is tagged,
// the DOM gains a <sup class="tlabel">Def</sup> (3 chars), <sup>Assump</sup>
// (6 chars), etc. If textLengthInRange ever stops stripping .tlabel nodes, the
// next mark in the same paragraph will land at the wrong position, shifted by
// the label's character count. Each test below verifies the exact word that
// gets tagged, not just that *a* span exists.

const SINGLE_PARA = 'The mitochondria is the powerhouse of the cell and drives metabolism.';

test('two marks in one paragraph land on the correct words', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);

  await selectWordAndTag(page, 'mitochondria', 'Def');
  await selectWordAndTag(page, 'powerhouse', 'R');

  const spans = await tspanSnapshot(page);
  expect(spans).toHaveLength(2);
  expect(spans[0]).toEqual({ text: 'mitochondria', tag: 'Def' });
  expect(spans[1]).toEqual({ text: 'powerhouse',   tag: 'R'   });
});

test('three marks in one paragraph all land correctly', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);

  await selectWordAndTag(page, 'mitochondria', 'Def');
  await selectWordAndTag(page, 'powerhouse',   'R');
  await selectWordAndTag(page, 'metabolism',   'Q');

  const spans = await tspanSnapshot(page);
  expect(spans).toHaveLength(3);
  expect(spans[0]).toEqual({ text: 'mitochondria', tag: 'Def' });
  expect(spans[1]).toEqual({ text: 'powerhouse',   tag: 'R'   });
  expect(spans[2]).toEqual({ text: 'metabolism',   tag: 'Q'   });
});

test('marking a word earlier in the paragraph after marking a later one', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);

  // Tag in reverse paragraph order to test that offsets aren't relative to
  // each other — each mark recalculates from the paragraph start.
  await selectWordAndTag(page, 'powerhouse',   'R');
  await selectWordAndTag(page, 'mitochondria', 'Def');

  const spans = await tspanSnapshot(page);
  expect(spans).toHaveLength(2);
  // DOM order follows paragraph order regardless of tagging order
  expect(spans[0]).toEqual({ text: 'mitochondria', tag: 'Def' });
  expect(spans[1]).toEqual({ text: 'powerhouse',   tag: 'R'   });
});

test('long label (Assump, 6 chars) does not shift the next mark', async ({ page }) => {
  // Switch to mode 4 which includes Assump
  await page.click('[data-mode="4"]');
  await pasteTextAndGoMark(page, SINGLE_PARA);

  await selectWordAndTag(page, 'mitochondria', 'Assump');
  await selectWordAndTag(page, 'powerhouse',   'R');

  const spans = await tspanSnapshot(page);
  expect(spans).toHaveLength(2);
  expect(spans[0]).toEqual({ text: 'mitochondria', tag: 'Assump' });
  expect(spans[1]).toEqual({ text: 'powerhouse',   tag: 'R'      });
});

test('re-tagging a word changes its label without duplicating the span', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);

  await selectWordAndTag(page, 'mitochondria', 'Def');
  // Select the same word again (now inside a .tspan) and re-tag as R
  await selectWordAndTag(page, 'mitochondria', 'R');

  const spans = await tspanSnapshot(page);
  expect(spans).toHaveLength(1);
  expect(spans[0]).toEqual({ text: 'mitochondria', tag: 'R' });
});

// ─── Note popup ──────────────────────────────────────────────────────────────

test('note popup opens with tag chip + preview text when a tagged span is clicked', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await page.locator('.tspan').first().click();

  await expect(page.locator('#note-popup')).not.toHaveClass(/hidden/);
  await expect(page.locator('#note-popup-tag')).toHaveText('Def');
  await expect(page.locator('#note-popup-preview')).toHaveText('mitochondria');
});

test('typing a note adds .has-note class to the span', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await page.locator('.tspan').first().click();

  await page.locator('#note-popup-ta').fill('powerhouse organelle');
  await page.locator('#note-popup-close').click();

  await expect(page.locator('.tspan.has-note').first()).toBeVisible();
});

test('reopening the popup pre-fills the saved note', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await page.locator('.tspan').first().click();
  await page.locator('#note-popup-ta').fill('first note');
  await page.locator('#note-popup-close').click();

  await page.locator('.tspan').first().click();
  await expect(page.locator('#note-popup-ta')).toHaveValue('first note');
});

test('popup Remove button retracts the tag and closes the popup', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await page.locator('.tspan').first().click();
  await page.locator('#note-popup-remove').click();

  await expect(page.locator('.tspan')).toHaveCount(0);
  await expect(page.locator('#note-popup')).toHaveClass(/hidden/);
});

// ─── Gaps sub-view ───────────────────────────────────────────────────────────

test('Gaps sub-view shows empty state with no Q tags or notes', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="gaps"]');

  await expect(page.locator('#sub-gaps .struct-empty')).toBeVisible();
});

test('Gaps sub-view lists Q-tagged spans under "Open questions"', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'metabolism', 'Q');
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="gaps"]');

  await expect(page.locator('#sub-gaps')).toContainText('Open questions');
  await expect(page.locator('#sub-gaps .gap-text').first()).toHaveText('metabolism');
});

test('Gaps sub-view lists noted spans under "Reader notes"', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await page.locator('.tspan').first().click();
  await page.locator('#note-popup-ta').fill('important context');
  await page.locator('#note-popup-close').click();

  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="gaps"]');

  await expect(page.locator('#sub-gaps')).toContainText('Reader notes');
  await expect(page.locator('#sub-gaps .gap-note').first()).toContainText('important context');
});

// ─── Keyboard tag shortcuts ──────────────────────────────────────────────────

test('selecting text and pressing "d" applies the Def tag', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await page.evaluate(() => {
    const reader = document.getElementById('reader');
    const tw     = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const idx = node.textContent.indexOf('mitochondria');
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + 'mitochondria'.length);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        return;
      }
    }
  });
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)');
  await page.keyboard.press('d');

  const spans = await tspanSnapshot(page);
  expect(spans).toEqual([{ text: 'mitochondria', tag: 'Def' }]);
});

test('selecting text and pressing "s" applies the Assump tag (mode 4)', async ({ page }) => {
  await page.click('[data-mode="4"]');
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await page.evaluate(() => {
    const reader = document.getElementById('reader');
    const tw     = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const idx = node.textContent.indexOf('powerhouse');
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + 'powerhouse'.length);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        return;
      }
    }
  });
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)');
  await page.keyboard.press('s');

  const spans = await tspanSnapshot(page);
  expect(spans).toEqual([{ text: 'powerhouse', tag: 'Assump' }]);
});

test('letter for a tag not in current mode is a no-op', async ({ page }) => {
  // Mode 1 (Easy) does NOT include Assump; pressing 's' should not tag.
  await page.click('[data-mode="1"]');
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await page.evaluate(() => {
    const reader = document.getElementById('reader');
    const tw     = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const idx = node.textContent.indexOf('mitochondria');
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + 'mitochondria'.length);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        return;
      }
    }
  });
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)');
  await page.keyboard.press('s');

  // No spans created — selection remains and no tspan in DOM
  await expect(page.locator('.tspan')).toHaveCount(0);
});

test('Escape clears the selection and hides the tagbar', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectFirstParaAndShowTagbar(page);
  await expect(page.locator('#tagbar')).not.toHaveClass(/hidden/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#tagbar')).toHaveClass(/hidden/);
});

// ─── Atlas / Map sub-view ────────────────────────────────────────────────────

test('Atlas shows empty hint when no Def tags exist', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'metabolism', 'Q'); // not Def
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="map"]');

  await expect(page.locator('#sub-map .struct-empty')).toBeVisible();
});

test('Atlas renders one SVG node per unique Def', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await selectWordAndTag(page, 'powerhouse',   'Def');
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="map"]');

  await expect(page.locator('#sub-map svg .map-node')).toHaveCount(2);
});

test('Atlas renders an edge when two Defs co-occur in the same paragraph', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await selectWordAndTag(page, 'powerhouse',   'Def');
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="map"]');

  await expect(page.locator('#sub-map svg .map-edge')).toHaveCount(1);
});

test('Atlas side bins list non-Def structural tags', async ({ page }) => {
  await pasteTextAndGoMark(page, SINGLE_PARA);
  await selectWordAndTag(page, 'mitochondria', 'Def');
  await selectWordAndTag(page, 'metabolism',   'Q');
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="map"]');

  await expect(page.locator('#sub-map .map-bin.b-Q')).toBeVisible();
  await expect(page.locator('#sub-map .map-bin.b-Q li')).toHaveText(/metabolism/);
});

// ─── Session list interactions ───────────────────────────────────────────────

test('clicking a saved session in the folios list loads it', async ({ page }) => {
  // Save a session first
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', SINGLE_PARA);
  await page.fill('#title', 'Reload me');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#sessions')).toContainText('Reload me');

  // Start fresh, then click the saved session
  page.once('dialog', d => d.accept()); // confirm "Start a new session?"
  await page.click('#btn-new');
  await expect(page.locator('#title')).toHaveValue('');

  await page.locator('#sessions .sess').filter({ hasText: 'Reload me' }).click();
  await expect(page.locator('#title')).toHaveValue('Reload me');
  await expect(page.locator('#pane-mark')).not.toHaveClass(/hidden/);
});

test('the X button on a saved session deletes it after confirm', async ({ page }) => {
  await page.click('[data-tab="input"]');
  await page.fill('#input-text', SAMPLE_TEXT);
  await page.fill('#title', 'Delete me');
  await page.keyboard.press('Control+s');
  await expect(page.locator('#sessions')).toContainText('Delete me');

  page.once('dialog', d => d.accept()); // confirm "Delete "Delete me"?"
  await page.locator('#sessions .sess').filter({ hasText: 'Delete me' }).locator('.sess-x').click();

  await expect(page.locator('#sessions')).not.toContainText('Delete me');
});

test('New button prompts when paragraphs exist and clears state on confirm', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  page.once('dialog', d => d.accept());
  await page.click('#btn-new');
  await expect(page.locator('#input-text')).toHaveValue('');
  await expect(page.locator('#pane-input')).not.toHaveClass(/hidden/);
});

test('Demo button prompts when paragraphs exist and replaces them on confirm', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  page.once('dialog', d => d.accept());
  await page.click('#btn-demo');
  // Demo lands on structure tab
  await expect(page.locator('#pane-structure')).not.toHaveClass(/hidden/);
  await expect(page.locator('#title')).toHaveValue(/Industrialization/);
});

// ─── Anki CSV export ─────────────────────────────────────────────────────────

test('Export tab Anki section renders one block per framework with non-zero cards', async ({ page }) => {
  await page.click('#btn-demo'); // loads tagged demo
  await page.click('[data-tab="export"]');

  // Demo touches NEDF (Def), CAST (R, L, T, X, Assump), SPEAR (B, C, A), ORACLE (M)
  // and Q is cross-cutting (routed everywhere there's content).
  const blocks = page.locator('.anki-block');
  await expect(blocks).not.toHaveCount(0);
  await expect(page.locator('.anki-fw').filter({ hasText: 'NEDF' })).toBeVisible();
  await expect(page.locator('.anki-fw').filter({ hasText: 'CAST' })).toBeVisible();
});

test('Anki block shows a Copy button per framework', async ({ page }) => {
  await page.click('#btn-demo');
  await page.click('[data-tab="export"]');

  const copyBtns = page.locator('.anki-copy');
  const n = await copyBtns.count();
  expect(n).toBeGreaterThan(0);
});

// ─── Theme persistence ──────────────────────────────────────────────────────

test('theme choice persists across reload via localStorage', async ({ page }) => {
  const initial = await page.locator('html').getAttribute('data-theme');
  const target  = initial === 'dark' ? 'light' : 'dark';

  await page.click('#btn-theme');
  await expect(page.locator('html')).toHaveAttribute('data-theme', target);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', target);
});
