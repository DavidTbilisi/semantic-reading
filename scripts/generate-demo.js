'use strict';

// Drives Chromium via Playwright to:
//   1. produce a set of PNG screenshots for the README under docs/img/
//   2. record a short walkthrough video (WebM) under docs/video/
//
// Usage:
//   node scripts/generate-demo.js          (assumes http://localhost:3700 is up)
//   PORT=4000 node scripts/generate-demo.js
//
// The helper `npm run demo` wraps both `npx serve` and this script.

const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const PORT = Number(process.env.PORT || 3700);
const ROOT = path.resolve(__dirname, '..');
const IMG  = path.join(ROOT, 'docs', 'img');
const VID  = path.join(ROOT, 'docs', 'video');

const VIEWPORT = { width: 1440, height: 900 };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function settle(page, ms = 250) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  await sleep(ms);
}

async function shoot(page, name, locator) {
  const target = locator || page;
  const out = path.join(IMG, name + '.png');
  await target.screenshot({ path: out });
  console.log('  ✓', path.relative(ROOT, out));
}

// Programmatic selection: words inside .para[data-p="<pi>"] by literal text match.
async function selectAndTagWord(page, paraIndex, word, tag) {
  const found = await page.evaluate(({ paraIndex, word }) => {
    const para   = document.querySelector(`.para[data-p="${paraIndex}"]`);
    if (!para) return false;
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('.tlabel')) continue;
      const idx = node.textContent.indexOf(word);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + word.length);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        return true;
      }
    }
    return false;
  }, { paraIndex, word });
  if (!found) throw new Error(`word "${word}" not found in paragraph ${paraIndex}`);
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)', { timeout: 3000 });
  await page.locator('.tagbar-btn', { hasText: new RegExp('^' + tag + '$') }).first().click();
  await settle(page, 150);
}

async function captureScreenshots(browser) {
  console.log('Screenshots →', path.relative(ROOT, IMG));
  const ctx  = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await settle(page, 500);

  // The app auto-loads the demo on first visit (loadSessionsList is empty), so
  // we land on the Structure tab with the demo paragraphs already tagged.

  // ── 01 hero — Mark tab, demo loaded ─────────────────────────────────────
  await page.click('[data-tab="mark"]');
  await settle(page, 300);
  await shoot(page, '01-hero-mark');

  // ── 02 mode bar close-up ───────────────────────────────────────────────
  await shoot(page, '02-modebar', page.locator('.modebar'));

  // ── 03 structure cards ──────────────────────────────────────────────────
  await page.click('[data-tab="structure"]');
  await page.click('[data-sub="cards"]');
  await settle(page, 300);
  await shoot(page, '03-structure-cards');

  // ── 04 structure apparatus (sheet) ──────────────────────────────────────
  await page.click('[data-sub="sheet"]');
  await settle(page, 300);
  await shoot(page, '04-structure-apparatus');

  // ── 05 structure atlas (svg concept graph) ──────────────────────────────
  await page.click('[data-sub="map"]');
  await settle(page, 400);
  await shoot(page, '05-structure-atlas');

  // ── 06 structure gaps ──────────────────────────────────────────────────
  await page.click('[data-sub="gaps"]');
  await settle(page, 300);
  await shoot(page, '06-structure-gaps');

  // ── 07 export tab (markdown + Anki CSVs) ───────────────────────────────
  await page.click('[data-tab="export"]');
  await settle(page, 300);
  await shoot(page, '07-export');

  // ── 08 dark theme — Mark tab ────────────────────────────────────────────
  const theme = await page.locator('html').getAttribute('data-theme');
  if (theme !== 'dark') await page.click('#btn-theme');
  await page.click('[data-tab="mark"]');
  await settle(page, 300);
  await shoot(page, '08-hero-mark-dark');

  // Restore light for any subsequent captures.
  await page.click('#btn-theme');
  await settle(page, 200);

  // ── 09 tagbar in action (light) ─────────────────────────────────────────
  // Seed an empty session so init() lands on the Input tab (not auto-demo),
  // then paste new text and surface the tagbar.
  await page.evaluate(() => {
    localStorage.clear();
    const savedAt = '2025-01-01T00:00:00Z';
    localStorage.setItem('sr_marker_sessions', JSON.stringify([
      { id: 's_blank', title: 'blank', savedAt },
    ]));
    localStorage.setItem('sr_marker_session_s_blank', JSON.stringify({
      id: 's_blank', title: 'blank', mode: 3, paragraphs: [], rawText: '', savedAt,
    }));
  });
  await page.reload();
  await settle(page, 400);

  const TAGBAR_TEXT =
    'The mitochondria is the powerhouse of the cell — it produces ATP through oxidative phosphorylation, ' +
    'a process that depends on a proton gradient across the inner membrane.';

  await page.click('[data-tab="input"]');
  await page.fill('#input-text', TAGBAR_TEXT);
  await page.click('[data-tab="mark"]');
  await page.waitForSelector('.para', { timeout: 3000 });
  await settle(page, 250);

  await page.evaluate(() => {
    const para   = document.querySelector('.para');
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('.pnum, .tlabel')) continue;
      const idx = node.textContent.indexOf('mitochondria');
      if (idx === -1) continue;
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + 'mitochondria'.length);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      return;
    }
    throw new Error('mitochondria not found in reader');
  });
  await page.locator('#reader').dispatchEvent('mouseup');
  await page.waitForSelector('#tagbar:not(.hidden)', { timeout: 3000 });
  await settle(page, 250);
  await shoot(page, '09-tagbar-open');

  await ctx.close();
}

async function recordWalkthrough(browser) {
  console.log('Walkthrough video →', path.relative(ROOT, VID));
  // Wipe any prior recording so we end up with a single named file.
  if (fs.existsSync(VID)) {
    fs.readdirSync(VID).forEach(f => {
      if (f.endsWith('.webm')) fs.unlinkSync(path.join(VID, f));
    });
  }

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1, // smaller files for video
    recordVideo: { dir: VID, size: VIEWPORT },
  });
  const page = await ctx.newPage();

  // Seed an empty saved session so init() skips auto-demo and lands on Input.
  await page.addInitScript(() => {
    const savedAt = '2025-01-01T00:00:00Z';
    localStorage.setItem('sr_marker_sessions', JSON.stringify([
      { id: 's_seed', title: 'seed', savedAt },
    ]));
    localStorage.setItem('sr_marker_session_s_seed', JSON.stringify({
      id: 's_seed', title: 'seed', mode: 3, paragraphs: [], rawText: '', savedAt,
    }));
  });
  await page.goto(`http://localhost:${PORT}/`);
  await settle(page, 700);

  // 1. Paste text
  await page.click('[data-tab="input"]');
  await page.fill('#title', 'Mitochondria — walkthrough');
  const TEXT =
    'The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.\n\n' +
    'Energy output rises with metabolic demand, but the inner-membrane proton gradient is the rate-limiting step.\n\n' +
    'Why does the cell route most of its energy budget through a single bottlenecked pathway?';
  for (const ch of TEXT.slice(0, 280)) {
    await page.locator('#input-text').type(ch, { delay: 4 });
  }
  // Fill the remainder in one shot for speed
  await page.locator('#input-text').fill(TEXT);
  await settle(page, 600);

  // 2. Switch to Mark, tag a few spans
  await page.click('[data-tab="mark"]');
  await settle(page, 600);
  await selectAndTagWord(page, 0, 'mitochondria', 'Def');
  await selectAndTagWord(page, 0, 'powerhouse',   'R');
  await selectAndTagWord(page, 1, 'proton gradient', 'B');
  await selectAndTagWord(page, 2, 'Why does the cell route most of its energy budget through a single bottlenecked pathway?', 'Q');
  await settle(page, 600);

  // 3. Structure → Cards
  await page.click('[data-tab="structure"]');
  await settle(page, 700);

  // 4. Structure → Atlas
  await page.click('[data-sub="map"]');
  await settle(page, 700);

  // 5. Structure → Gaps
  await page.click('[data-sub="gaps"]');
  await settle(page, 700);

  // 6. Export
  await page.click('[data-tab="export"]');
  await settle(page, 900);

  await page.close();
  await ctx.close();

  // Rename the auto-generated *.webm to walkthrough.webm
  const files = fs.readdirSync(VID).filter(f => f.endsWith('.webm'));
  if (files.length) {
    const src = path.join(VID, files[0]);
    const dst = path.join(VID, 'walkthrough.webm');
    if (src !== dst) fs.renameSync(src, dst);
    console.log('  ✓', path.relative(ROOT, dst));
  } else {
    console.error('  ✗ no video was recorded');
  }
}

(async () => {
  if (!fs.existsSync(IMG)) fs.mkdirSync(IMG, { recursive: true });
  if (!fs.existsSync(VID)) fs.mkdirSync(VID, { recursive: true });

  const browser = await chromium.launch();
  try {
    await captureScreenshots(browser);
    await recordWalkthrough(browser);
  } finally {
    await browser.close();
  }
})();
