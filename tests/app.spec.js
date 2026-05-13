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

test('clicking a tagged span removes the tag (retract)', async ({ page }) => {
  await pasteTextAndGoMark(page, SAMPLE_TEXT);
  await selectFirstParaAndShowTagbar(page);
  await page.locator('.tagbar-btn', { hasText: 'R' }).first().click();
  await expect(page.locator('.tspan').first()).toBeVisible();

  // Click the tagged span to retract the mark (no text selected)
  await page.locator('.tspan').first().click();
  await expect(page.locator('.tspan')).toHaveCount(0);
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
