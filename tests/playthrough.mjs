// Integration test: plays the real page in a real browser. The boss names his
// first capo, time runs for two years, he moves into a second district by
// touching it on the 3D map, and nothing breaks on the way.
// Pass a folder as first argument to keep screenshots of each step.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const shots = process.argv[2];
const page_url = 'file://' + path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/index.html') + '?fixed&manual';   // fixed resolution, and time beaten by hand
// The map is WebGL: without a graphics card the browser draws it in software.
// Set CHROMIUM to the path of a browser already on the machine to skip Playwright's own download.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_INTERNET|ERR_NAME|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const shot = async (name) => { if (shots) { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(shots, name + '.png') }); } };
// Time stops when a capo asks for the boss's word: the test approves and goes on.
const months = (n) => page.evaluate((n) => {
  for (let i = 0; i < n * 4; i++) {
    const before = window.__ashport.game().ticks + ':' + window.__ashport.game().world.month;
    window.__ashport.beat();
    const ask = document.querySelector('#veil.on [data-act=approve]');
    if (ask) { window.__asked = (window.__asked || 0) + 1; ask.click(); }
    if (window.__ashport.game().ticks + ':' + window.__ashport.game().world.month === before) window.__ashport.beat();
  }
}, n);
const hud = () => page.evaluate(() => ({ date: document.getElementById('date').textContent, held: document.getElementById('held').textContent, named: document.getElementById('named').textContent }));

await page.goto(page_url);
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
assert.equal(await page.textContent('#sheet h2'), 'Hillside needs a capo', 'the game opens on the first nomination');
assert.equal(await page.locator('#sheet .card').count(), 6, 'six men to choose from');
await shot('1-start');

await page.click('#sheet [data-act=start][data-capo=sal]');
await page.waitForSelector('#veil:not(.on)', { state: 'attached' });
assert.equal((await hud()).held, '1 / 41', 'the family starts with one district out of 41');
await page.waitForSelector('.lab.sm', { timeout: 60000 });
await shot('2-ashport');

await months(24);
const later = await hud();
assert.equal(later.date, 'January 1928', 'two years have passed');
const state = await page.evaluate(() => { const g = window.__ashport.game(); return { journal: g.journal.length, stats: window.__ashport.map().stats() }; });
assert.ok(state.journal > 10, 'the journal tells what the capo did');
assert.ok(await page.evaluate(() => window.__asked) >= 1, 'a capo asked for the boss\'s word, and got it');
assert.ok(await page.evaluate(() => window.__ashport.game().journal.some((e) => e.type === 'job')), 'the approved job was done');
assert.ok(state.stats.cars > 0, 'the family has cars on the road');
assert.ok(state.stats.buildings > 1200, 'the six cities are drawn (' + state.stats.buildings + ' buildings)');
await shot('3-two-years');

// touch Market Street on the map, move in, name Mae
await page.locator('.lab.sm', { hasText: 'Market Street' }).click();
await page.waitForSelector('#veil.on');
assert.equal(await page.textContent('#sheet h2'), 'Market Street');
await page.click('#sheet [data-order=claim]');
await page.click('#sheet [data-capo=mae]');
await page.waitForSelector('#veil:not(.on)', { state: 'attached' });
assert.equal((await hud()).held, '2 / 41', 'the family holds a second district');
assert.equal((await hud()).named, '2 / 9');
await months(6);
await shot('4-market-street');

// the wheel of the family: six trades, three rings, and what a part brings when touched
await page.click('#family');
assert.equal(await page.locator('#sheet .wheel path').count(), 18, 'the wheel has 18 parts');
await page.locator('#sheet .wheel path').first().click();
assert.match(await page.textContent('#skill'), /Liquor/, 'touching a part says what it brings');
assert.ok(await page.locator('#sheet .card').count() >= 2, 'the men of the family are listed with their rank');
await shot('6-family');
await page.click('#sheet [data-act=close]');
await page.click('#journal');
assert.ok(await page.locator('#sheet .list li').count() > 10, 'the journal opens');
await page.click('#sheet [data-act=close]');
await page.click('#map');
await shot('5-map');

// the game is saved: a reload picks it up where it was
const before = await hud();
await page.reload();
await page.waitForFunction(() => window.__ashport && window.__ashport.map());
assert.deepEqual(await hud(), before, 'the saved game comes back after a reload');

await browser.close();
assert.deepEqual(errors, [], 'no script errors');
console.log('ok: started, played to', before.date, 'holding', before.held, 'districts,', state.stats.buildings, 'buildings drawn');
