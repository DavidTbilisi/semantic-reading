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
