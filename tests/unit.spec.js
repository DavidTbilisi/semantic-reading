'use strict';

// Wraps the in-browser test runner (test.html) so `npm test` covers both
// unit-level (utils, segments, state, storage, export, constants) and
// browser-level (app.spec.js) behaviour in a single Playwright invocation.

const { test, expect } = require('@playwright/test');

test('test.html — all in-browser unit tests pass', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  await page.goto('/test.html');

  // The runner writes "<n> passed" / "<n> failed" into #summary at the end of
  // its top-level script. Wait until the summary has any text.
  await page.waitForFunction(() => {
    const el = document.getElementById('summary');
    return el && el.textContent && el.textContent.trim().length > 0;
  });

  const summary = (await page.locator('#summary').textContent()).trim();
  const failed  = await page.locator('.badge.fail').count();
  const passed  = await page.locator('.badge.pass').count();

  // Surface the readable summary on failure for fast diagnosis.
  if (failed > 0) {
    const firstErrors = await page.locator('.error').allTextContents();
    throw new Error(
      `Unit suite reported failures.\nSummary: ${summary}\n` +
      `First failures:\n  - ${firstErrors.slice(0, 5).join('\n  - ')}`
    );
  }

  expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  expect(failed).toBe(0);
  expect(passed).toBeGreaterThan(0);
});
