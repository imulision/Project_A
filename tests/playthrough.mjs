// Integration test: plays one full in-game year in a real browser and checks
// that the game reaches an ending without any script error.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const page_url = 'file://' + path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/index.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(page_url);
await page.waitForFunction(() => window.__ashport && window.__ashport.state().paused);

const decisions = [];
let ended = false;
for (let n = 0; n < 400 && !ended; n++) {
  const st = await page.evaluate(() => {
    const S = window.__ashport.state();
    const h = document.querySelector('#veil.on h2');
    return { over: S.over, paused: S.paused, month: S.m, heat: S.heat, title: h ? h.textContent : '' };
  });
  if (st.over) { ended = true; break; }
  if (st.paused && st.title) {
    decisions.push(st.title);
    await page.click('#sheet [data-pick], #sheet [data-opt], #sheet [data-skip], #sheet [data-close]');
    continue;
  }
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__ashport.step(); });
}
const final = await page.evaluate(() => {
  const S = window.__ashport.state();
  return { month: S.m, heat: S.heat, buildings: document.querySelectorAll('#bld polygon').length };
});
await browser.close();

assert.deepEqual(errors, [], 'no script errors');
assert.ok(ended, 'the game reaches an ending');
assert.equal(decisions[0], 'Hillside has no lieutenant', 'the first decision is a nomination');
assert.ok(decisions.length >= 5, 'the year brings several decisions');
assert.ok(final.month >= 1 && final.month <= 12, 'the game ends within the year');
assert.ok(final.heat >= 0 && final.heat <= 100, 'heat stays in range');
assert.ok(final.buildings > 300, 'the city is drawn');
console.log('ok: full year played,', decisions.length, 'decisions, ended at month', final.month);
