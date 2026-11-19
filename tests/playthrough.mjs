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
    const rise = document.querySelector('#veil.on [data-act=promote]');
    if (rise) { window.__promoted = (window.__promoted || 0) + 1; rise.click(); }
    if (window.__ashport.game().ticks + ':' + window.__ashport.game().world.month === before) window.__ashport.beat();
  }
}, n);
const hud = () => page.evaluate(() => ({ date: document.getElementById('date').textContent, held: document.getElementById('held').textContent, named: document.getElementById('named').textContent }));

await page.goto(page_url);
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
// the wait before the game: a bar that only moves forward, names what is being done, and ends full
const steps = await page.evaluate(() => window.AshportLoad.steps);
assert.ok(steps.length >= 10, 'loading says what it is doing, step by step (' + steps.length + ')');
assert.ok(steps.every((s, i) => s.label && s.part > (i ? steps[i - 1].part : 0) && s.part <= 1), 'the bar only moves forward');
assert.equal(steps[steps.length - 1].part, 1, 'and ends full');
assert.match(steps[0].label, /^Files 1 \/ \d+$/, 'first the files, counted');
assert.equal(await page.locator('#load').count(), 0, 'then the loading screen goes away');
assert.equal(await page.textContent('#sheet h2'), 'Hillside needs a capo', 'the game opens on the first nomination');
assert.equal(await page.locator('#sheet [data-face]').count(), 6, 'six faces to choose from');
assert.equal(await page.locator('#who .face').count(), 1, 'the man being looked at has a portrait');
assert.equal(await page.locator('#who .stat').count(), 4, 'and his four stats as gauges, not as a sentence');
await page.click('#sheet [data-face=sal]');
assert.match(await page.textContent('#who h3'), /Sal/, 'touching a face shows that man');
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

// touch Market Street on the map, choose to go in by force, send a man this way suits: six months later it is the family's
await page.locator('.lab.sm', { hasText: 'Market Street' }).click();
await page.waitForSelector('#veil.on');
assert.equal(await page.textContent('#sheet h2'), 'Market Street');
assert.equal(await page.locator('#sheet .way').count(), 3, 'three ways in: force, a bribe, or buying it');
await page.click('#sheet [data-way=force]');
await page.click('#sheet [data-face=mae]');
assert.match(await page.textContent('#who .move'), /Poor odds/, 'the sheet says when a way does not suit a man: Mae is no gunman');
await page.locator('#sheet .facebtn.good').first().click();
assert.match(await page.textContent('#who .move'), /Good odds/, 'and when it does');
await page.click('#who [data-capo]');
await page.waitForSelector('#veil:not(.on)', { state: 'attached' });
assert.equal((await hud()).held, '1 / 41', 'a district is not taken in a day');
await months(1);
await page.waitForSelector('.lab.sm.tk .ring', { timeout: 60000 });      // a round gauge over Market Street while his men work on it
await shot('4-taking');
await months(6);
assert.equal((await hud()).held, '2 / 41', 'the family holds a second district');
assert.equal((await hud()).named, '2 / 9');
await shot('4-market-street');

// the district in pictures: the capo, what he is after, figures with their curve, the places, and laundering marked as such
await page.evaluate(() => window.__ashport.map().focus('ashport', 'ashport-hillside'));
await page.waitForSelector('.lab.capo .face', { timeout: 60000 });
assert.ok(await page.locator('.lab.tag').count() > 0, 'the cars on the road show what they carry');
await page.evaluate(() => document.querySelector('.lab.tag').click());      // by the element itself: another badge may lie over it on the screen
assert.match(await page.textContent('#tip.on'), /crates|\$|men/, 'touching a car says what it carries');
await shot('7-street');
// the budget of the street view: cars and headlights are drawn in lots, so the count of draw calls stays low however busy the streets
await page.waitForFunction(() => !window.__ashport.map().stats().moving, null, { timeout: 60000 });      // counted once the camera has arrived, however slow the machine
await page.waitForTimeout(600);
const near = await page.evaluate(() => window.__ashport.map().stats());
assert.ok(near.calls <= 220, 'the street view is drawn in at most 220 draw calls (' + near.calls + ')');
assert.ok(await page.locator('.lab').count() <= 90, 'and carries at most 90 labels');
// the meter: touching the images-per-second figure opens the full reading, to be read aloud from a phone
await page.click('#fps');
await page.waitForFunction(() => /\d+ fps · \d+ draws · [\d.]+k tris · x[\d.]+ · \d+ cars · \d+ labels · webgpu (yes|no) · start [\d.]+s \(.+ [\d.]+s\)/.test(document.getElementById('fps').textContent), null, { timeout: 60000 });
await shot('13-meter');
await page.click('#fps');
await page.waitForFunction(() => /^\d+ fps$/.test(document.getElementById('fps').textContent), null, { timeout: 60000 });
// the money view: the map goes grey and every place says what it took in, the laundries what they washed
await page.click('#money');
await page.waitForFunction(() => [...document.querySelectorAll('.lab.pin b')].some((b) => /^\$/.test(b.textContent)));
assert.match(await page.textContent('.lab.capo .till'), /\$/, 'and the capo shows what he keeps at his club');
await shot('11-money');
await page.click('#money');
await page.evaluate(() => document.querySelector('.lab.capo').click());
await page.waitForSelector('#veil.on .tiles');
assert.equal(await page.textContent('#sheet h2'), 'Hillside', 'touching the capo opens his district');
assert.ok(await page.locator('#sheet .tile').count() >= 6, 'the figures of the district are tiles with an icon');
assert.ok(await page.locator('#sheet .intent').count() >= 1, 'the sheet says what the capo is after');
assert.ok(await page.locator('#sheet .place').count() >= 2, 'his places are pictured');
assert.ok(await page.locator('.lab.pin').count() >= 2, 'and each of them carries its mark on the map');
assert.ok(await page.locator('#sheet .chain .node').count() >= 8, 'liquor and money are shown as a chain');
if (await page.evaluate(() => !!AshportGame.history)) assert.ok(await page.locator('#sheet .tile .spark polyline').count() >= 4, 'each figure has its curve');
await shot('8-district');
await page.click('#sheet [data-act=close]');

// the wheel of the family: six trades, three rings, and what a part brings when touched
await page.click('#family');
assert.equal(await page.locator('#sheet .wheel path').count(), 18, 'the wheel has 18 parts');
await page.locator('#sheet .wheel path').first().click();
assert.match(await page.textContent('#skill'), /Liquor/, 'touching a part says what it brings');
// a trade one man knows can be taught to the whole family, for clean money and months
const known = await page.evaluate(() => { const w = AshportGame.wheel(window.__ashport.game()); let key = null; w.sectors.forEach((s, i) => s.rings.forEach((r, k) => { if (r.lit && !r.shared && !key) key = i + ':' + k; })); return key; });
if (known) { await page.locator('#sheet .wheel path[data-skill="' + known + '"]').click(); assert.equal(await page.locator('#skill [data-act=research]').count(), 1, 'what one capo knows can be taught to the family'); }
assert.ok(await page.locator('#sheet .card').count() >= 2, 'the men of the family are listed with their rank');
assert.ok(await page.locator('#sheet .pyr .slot').count() >= 3, 'the family is drawn as a pyramid, free places included');
// the places the family can run: some known, some closed until the family pays to learn them
assert.ok(await page.locator('#sheet .know').count() >= 8, 'every kind of place is pictured');
assert.ok(await page.locator('#sheet .know.shut').count() >= 1, 'a new family does not know every trade');
await page.locator('#sheet .know.shut').first().click();
assert.match(await page.textContent('#know'), /Open this trade/, 'touching a closed trade says what opening it takes');
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
