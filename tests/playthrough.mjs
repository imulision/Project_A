// Integration test (web/index.html): the real page in a real browser.
// The boss picks his first capo, time runs, he answers what his capos ask, seats a second capo by
// touching a street on the 3D map, reads the sheets, and the game comes back after a reload.
// Pass a folder as first argument to keep screenshots of each step.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const shots = process.argv[2];
const page_url = 'file://' + path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/index.html') + '?fixed&manual';   // fixed resolution, and time beaten by hand
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_INTERNET|ERR_NAME|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const shot = async (name) => { if (shots) { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(shots, name + '.png') }); } };
const still = () => page.waitForFunction(() => !window.__ashport.map().stats().moving, null, { timeout: 60000 });
const hud = () => page.evaluate(() => ['date', 'dirty', 'clean', 'share', 'men'].map((k) => document.getElementById(k).textContent).join(' | '));
// Time, month by month. The boss answers as a player would, through the buttons of the sheets: yes when he can pay, no when he cannot;
// a man at the door gets a street chosen on the map when the family can pay for his club, and waits otherwise.
const months = (n, stopAt) => page.evaluate(({ n, stopAt }) => {
  const A = window.__ashport, q = (s) => document.querySelector('#veil.on ' + s), seen = window.__seen = window.__seen || { answer: 0, rule: 0, seat: 0, waited: 0 };
  for (let i = 0; i < n * 4; i++) {
    A.beat();
    const again = document.querySelector('#alerts [data-requests]');      // he comes back twice a year to those he left waiting
    if (again && i % 24 === 0) again.click();
    for (let guard = 0; guard < 12 && document.querySelector('#veil.on'); guard++) {
      const yes = q('[data-act=answer][data-yes="1"]:not([disabled])'), no = q('[data-act=answer][data-yes="0"]'), rule = q('[data-act=rule]'), seat = q('[data-act=seat]:not([disabled])');
      if (yes || no) { seen.answer++; (yes || no).click(); }
      else if (rule) { seen.rule++; rule.click(); }
      else if (seat) {
        seat.click();
        seen.lit = A.map().stats().spots;      // the streets on offer are lit while he chooses
        const p = A.picking(), raw = A.game().cities.find((c) => c.id === p.city), club = A.view().cities.find((c) => c.id === p.city).capos[0];
        const spot = AshportTurf.spots(raw).sort((a, b) => Math.abs(a.x - club.x) + Math.abs(a.y - club.y) - Math.abs(b.x - club.x) - Math.abs(b.y - club.y))[2];
        A.tap({ city: p.city, bx: spot.x, by: spot.y, near: true });
        if (!A.picking()) seen.seat++; seen.out = A.map().stats().spots;
      }
      else { seen.waited++; q('[data-act=close]').click(); if (A.game().paused) document.getElementById('pause').click(); }
    }
    if (stopAt && seen[stopAt]) return;
  }
}, { n, stopAt });

await page.goto(page_url);
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
const steps = await page.evaluate(() => window.AshportLoad.steps);
assert.ok(steps.length >= 10 && steps[steps.length - 1].part === 1, 'the loading bar ends full (' + steps.length + ' steps)');
assert.equal(await page.locator('#load').count(), 0);
assert.equal(await page.textContent('#sheet h2'), 'Who runs your first streets?');
assert.equal(await page.locator('.facebtn').count(), 6);
await shot('c1-start');

// the boss looks at another man, then starts with him
await page.click('[data-face=dutch]');
assert.match(await page.textContent('#who h3'), /Dutch/);
await page.click('#who [data-act=start]');
await page.waitForSelector('#veil:not(.on)', { state: 'attached' });
assert.match(await hud(), /January 1926 .* \| 1 \/ \d+$/);
await still();
const first = await page.evaluate(() => ({ stats: window.__ashport.map().stats(), labels: document.querySelectorAll('.lab').length, capos: document.querySelectorAll('.lab.capo').length }));
assert.ok(first.capos === 1, 'the capo is seen over his club (' + first.capos + ')');
await shot('c2-first-club');

// a finger that lands on his face and slides moves the map: no label holds the finger, and no sheet opens
const face = await page.locator('.lab.capo').boundingBox(), fx = face.x + face.width / 2, fy = face.y + face.height / 2;
await page.mouse.move(fx, fy); await page.mouse.down(); await page.mouse.move(fx + 40, fy + 30, { steps: 4 }); await page.mouse.move(fx + 90, fy + 60, { steps: 4 }); await page.mouse.up();
await page.waitForTimeout(300);
assert.equal(await page.locator('#veil.on').count(), 0, 'a drag is not a touch');
const moved = await page.locator('.lab.capo').boundingBox();
assert.ok(Math.hypot(moved.x - face.x, moved.y - face.y) > 40, 'the map followed the finger (' + Math.round(moved.x - face.x) + ', ' + Math.round(moved.y - face.y) + ')');

// a short touch on his face opens his sheet
await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2);
await page.waitForSelector('#veil.on');
assert.match(await page.textContent('#sheet h2'), /Dutch/);
assert.match(await page.textContent('#sheet'), /only capo/);
await page.click('#sheet [data-act=close]');
// the same with a real finger: the sheet stays open (the click a phone sends after a touch must not close it)
// (a building's sheet is short: the finger is over the dark veil when it lifts, not over the sheet)
await page.touchscreen.tap(moved.x + moved.width / 2, moved.y + moved.height + 12);
await page.waitForTimeout(600);
assert.equal(await page.locator('#veil.on').count(), 1, 'a sheet opened by a finger stays open');
assert.doesNotMatch(await page.textContent('#sheet h2'), /Dutch/);
await page.touchscreen.tap(195, 30);      // and a touch beside the sheet closes it
await page.waitForTimeout(400);
assert.equal(await page.locator('#veil.on').count(), 0, 'a touch beside the sheet closes it');

// time runs at full speed until a second capo has his club, placed by a touch on the map
await page.click('#speed'); await page.click('#speed');
assert.equal(await page.textContent('#speed'), '4x');
await months(240, 'seat');
const seen = await page.evaluate(() => window.__seen);
assert.ok(seen.seat >= 1, 'a man at the door was given a street (' + JSON.stringify(seen) + ')');
assert.match(await hud(), / \| 2 \/ \d+$/, 'the family has two capos');
assert.ok(seen.lit > 0 && seen.out === 0, 'the streets where a club can open are lit during the choice, and put out after (' + seen.lit + ', ' + seen.out + ')');
await months(6);
await still();
await shot('c3-two-capos');

// a touch on a street up close names it and says what stands there
const place = await page.evaluate(() => { const c = window.__ashport.view().cities[0], p = c.places.find((p) => p.owner === 'family' && p.kind !== 'club'); window.__ashport.tap({ city: c.id, bx: p.x, by: p.y, near: true }); return p; });
assert.match(await page.textContent('#sheet'), new RegExp(place.name));
assert.match(await page.textContent('#sheet'), /runs it/);
await page.click('#sheet [data-act=city]');
assert.equal(await page.textContent('#sheet h2'), 'Ashport');
await shot('c4-city-sheet');
await page.click('#sheet [data-act=close]');

// the family sheet: the trades, and the detail of the one touched
await page.click('#family');
assert.equal(await page.textContent('#sheet h2'), 'The family');
await page.click('.know.shut');
assert.match(await page.textContent('#know'), /not known yet/);
await shot('c5-family');
await page.click('#sheet [data-act=close]');
await page.click('#journal');
assert.ok(await page.locator('#sheet li.ev').count() > 3, 'the journal has lines');
await page.click('#sheet [data-act=close]');

// the map stays light up close: the budget of the charter
await page.evaluate(() => window.__ashport.home()); await still(); await page.waitForTimeout(300);
assert.ok(await page.locator('.lab.capo').count() >= 1, 'back on the streets, the capos are seen');
await shot('c5b-streets');
const near = await page.evaluate(() => ({ stats: window.__ashport.map().stats(), labels: document.querySelectorAll('.lab').length }));
assert.ok(near.stats.calls <= 240, 'draw calls up close: ' + near.stats.calls);
assert.ok(near.labels <= 90, 'labels up close: ' + near.labels);
await page.click('#map'); await still();
const far = await page.evaluate(() => window.__ashport.map().stats());
assert.ok(far.calls <= 240, 'draw calls from afar: ' + far.calls);
await shot('c6-six-cities');

// the game is saved: a reload picks it up where it was
const before = await hud();
await page.reload();
await page.waitForFunction(() => window.__ashport && window.__ashport.map());
assert.equal(await hud(), before, 'the saved game comes back after a reload');

// a save today's screen cannot read must not stop the game from opening: it is set aside, the player is told, a new game starts
await page.evaluate(() => localStorage.setItem('ashport-city-3', JSON.stringify({ version: 3, started: true, cities: [{ id: 'ashport' }], journal: [] })));
await page.reload();
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
assert.equal(await page.textContent('#sheet h2'), 'Who runs your first streets?', 'an unreadable save gives a new game, not a dead screen');
assert.match(await page.textContent('#toast'), /older version/);
assert.ok(await page.evaluate(() => !!localStorage.getItem('ashport-city-3-unreadable')), 'the old save is kept aside');

// a game saved by the first version of the game (by districts, another key) is not read any more: it is set aside once, and the player is told
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ashport-save-1', '{"version":1}'); });
await page.reload();
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
assert.match(await page.textContent('#toast'), /older version/, 'the player is told his old game is not continued');
assert.ok(await page.evaluate(() => !localStorage.getItem('ashport-save-1') && !!localStorage.getItem('ashport-save-1-unreadable')), 'the old save is kept aside, under another name');
await page.reload();
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
assert.equal(await page.textContent('#toast'), '', 'and he is told only once');

await browser.close();
assert.deepEqual(errors, [], 'no script errors');
console.log('ok: new screen played to', before, '·', JSON.stringify(seen), '· near', near.stats.calls, 'draws', near.labels, 'labels · far', far.calls, 'draws');
