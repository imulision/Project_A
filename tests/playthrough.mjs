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
  const A = window.__ashport, q = (s) => document.querySelector('#veil.on ' + s), seen = window.__seen = window.__seen || { answer: 0, rule: 0, seat: 0, waited: 0, away: 0, rides: 0 };
  for (let i = 0; i < n * AshportEmpire.TICKS_PER_MONTH; i++) {
    const ev = (A.beat() || []).filter((e) => e.type !== 'run' && e.type !== 'haul' && e.type !== 'pay' && !(e.type === 'arrived' && (e.kind === 'takings' || e.kind === 'haul'))), day = A.game().ticks;      // (a car leaving with the takings changes nothing the page must redraw)
    if (ev.length && day) { seen.midmonth = (seen.midmonth || 0) + 1; if (A.view().day !== day) seen.stale = (seen.stale || 0) + 1; }      // what happens inside a month is on the screen the same day
    if (document.getElementById('date').textContent !== 'Day ' + (A.game().month * AshportEmpire.TICKS_PER_MONTH + day + 1)) seen.date = (seen.date || 0) + 1;      // the date is a count of days
    if (A.map().labels().some((l) => l.pop < 0)) seen.paid = (seen.paid || 0) + 1;      // a pay packet is seen leaving its place
    if (document.querySelector('#next .nx')) seen.next = (seen.next || 0) + 1; if (/month/i.test(document.getElementById('next').textContent)) seen.nextMonths = 1; if (A.map().labels().some((l) => l.claim)) seen.claims = (seen.claims || 0) + 1;      // the streets about to be won are told at the top and marked on the map
    A.map().labels().forEach((l) => { if (l.capo && !l.site && l.where && l.where !== 'home') seen.away++; if (l.capo && l.riding) seen.rides++; });      // a capo is seen away from his club, and in his car on the way
    seen.news = (seen.news || 0) + document.querySelectorAll('#feed .news').length; seen.marks = (seen.marks || 0) + A.map().labels().filter((l) => l.fx).length;      // what happens is told on the edge of the screen, and marked on the map
    if (document.body.classList.contains('live')) { const b = document.querySelector('#call .end [data-act=unlive]') || document.querySelector('#call [data-call=press]') || document.querySelector('#call [data-act=unlive]'); seen.hits = (seen.hits || 0) + 1; if (b) b.click(); }      // a hit that begins on its own is watched: he presses on, reads the end, and goes back to the town
    const crew = A.view().cities.reduce((n, c) => n + c.capos.length, 0); if (seen.sent && seen.crew !== undefined && crew > seen.crew) seen.seat++; seen.crew = crew;      // the man the boss paid for has settled
    const got = document.querySelector('#hint [data-hint]'); if (got) { seen.hints = (seen.hints || 0) + 1; got.click(); }      // he reads each hint once and puts it away
    const again = document.querySelector('#alerts [data-requests]');      // he comes back twice a year to those he left waiting
    if (again && i % (6 * AshportEmpire.TICKS_PER_MONTH) === 0) again.click();
    for (let guard = 0; guard < 12 && document.querySelector('#veil.on'); guard++) {
      const yes = q('[data-act=answer][data-yes="1"]:not([disabled])'), no = q('[data-act=answer][data-yes="0"]'), rule = q('[data-act=rule]'), seat = q('[data-act=seat]:not([disabled])');
      const matter = q('[data-act=decide]:not([disabled])');      // a matter a capo brings: he takes the first choice he can pay
      if (matter) { seen.decide = (seen.decide || 0) + 1; matter.click(); }
      else if (yes || no) { seen.answer++; (yes || no).click(); }
      else if (rule) { seen.rule++; rule.click(); }
      else if (seat) {
        const men = () => A.view().cities.reduce((n, c) => n + c.capos.length, 0), had = men();
        seat.click();      // the man opens his club where he sees fit: the boss is never asked for a street
        // (his club is paid for by loads driven from the headquarters: he is one of the family when the last one is there)
        if (((A.view().paying || []).some((p) => p.order === 'welcome') || men() === had + 1) && !document.querySelector('#alerts .pick')) seen.sent = (seen.sent || 0) + 1;
        A.home();      // the camera went to see where he settled; the boss comes back to his first streets
        seen.out = A.map().stats().spots;
      }
      else { seen.waited++; (q('[data-act=later]') || q('[data-act=close]')).click(); }
    }
    if (stopAt && seen[stopAt]) return;
  }
}, { n, stopAt });

await page.goto(page_url);
await page.waitForSelector('#veil.on h2', { timeout: 120000 });
await page.waitForFunction(() => { const s = window.AshportLoad.steps; return s.length && s[s.length - 1].part === 1; }, null, { timeout: 30000 }).catch(() => {});      // the last step is the first picture drawn
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
assert.match(await hud(), /^Day 1 .* \| 1 \/ \d+$/);
await still();
const first = await page.evaluate(() => ({ stats: window.__ashport.map().stats(), labels: document.querySelectorAll('.lab').length, capos: document.querySelectorAll('.lab.capo').length }));
assert.ok(first.capos === 1, 'the capo is seen over his club (' + first.capos + ')');
assert.equal(await page.locator('.lab.capo .hp i').count(), 3, 'three lights under his face say how his streets fare: money, men, threat');
// the first minutes: a strip says what to look at, and a touch puts it away for good
assert.match(await page.textContent('#hint .hint'), /Dutch runs these streets for you/);
await page.click('#hint [data-hint=capo]');
// then the goal of the game, once
await page.waitForSelector('#hint [data-hint=goal]');
assert.match(await page.textContent('#hint .hint'), /Your goal: half the streets of the six cities/);
await page.click('#hint [data-hint=goal]');
assert.equal(await page.locator('#hint .hint').count(), 0, 'read once, never said again');
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ashport-hints')).capo), 1);
await shot('c2-first-club');
// a phone that could not draw for days (slow frames, the app in the background) still shows the capo where the rules have him: Dutch
// drove to his first place and works there, his car at its door, whatever the frames missed
const works = await page.evaluate(() => { const A = window.__ashport; for (let i = 0; i < 40; i++) { const k = A.view().cities.flatMap((c) => c.capos).find((m) => m.errand && m.errand.step === 'works'); if (k) return k.id; A.beat(); const q = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]'); if (q) q.click(); } return null; });
assert.ok(works, 'a capo goes to work on a place of his');
await page.waitForTimeout(1200);      // (the last day it is behind, it makes up within the second, without a jump)
const atWork = await page.evaluate((id) => window.__ashport.map().cars().filter((c) => c.kind === 'capo' && c.capo === id), works);
assert.ok(atWork.length === 1 && atWork[0].there, 'his one car stands at the place he works on ' + JSON.stringify(atWork));
await page.evaluate(() => { const A = window.__ashport; for (let i = 0; i < 40 && A.view().cities.some((c) => c.capos.some((m) => m.errand)); i++) { A.beat(); const q = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]'); if (q) q.click(); } });      // then he drives home

const parked = () => page.waitForFunction(() => !window.__ashport.map().labels().some((l) => l.capo && l.riding), null, { timeout: 30000 });      // his face rides his car while he drives
await parked(); await page.waitForTimeout(200);
// (a piece of news slides over the map for a few seconds: the finger waits until none lies on his face)
await page.waitForFunction(() => { const r = document.querySelector('.lab.capo').getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !(e && e.closest('.news')); }, null, { timeout: 30000 });
const face = await page.locator('.lab.capo').boundingBox(), fx = face.x + face.width / 2, fy = face.y + face.height / 2;
await page.mouse.move(fx, fy); await page.mouse.down(); await page.mouse.move(fx + 40, fy + 30, { steps: 4 }); await page.mouse.move(fx + 90, fy + 60, { steps: 4 }); await page.mouse.up();
await page.waitForTimeout(900);      // (a slow machine draws a few frames a second: the labels follow at the next one)
assert.equal(await page.locator('#veil.on').count(), 0, 'a drag is not a touch');
const moved = await page.locator('.lab.capo').boundingBox();
assert.ok(Math.hypot(moved.x - face.x, moved.y - face.y) > 40, 'the map followed the finger (' + Math.round(moved.x - face.x) + ', ' + Math.round(moved.y - face.y) + ')');

// a short touch on his face opens his sheet
await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2);
await page.waitForSelector('#veil.on');
assert.match(await page.textContent('#sheet h2'), /Dutch/);
assert.match(await page.textContent('#sheet'), /only capo/);
// his books: what he makes, pays, sends up and wants, in one unit of time, and back to his sheet
await page.evaluate(() => document.querySelector('#sheet [data-act=books]').click());
assert.match(await page.textContent('#sheet h2'), /Dutch's books/);
assert.match(await page.textContent('#sheet'), /His places made[\s\S]*Sent up to you[\s\S]*What he wants/);
await page.evaluate(() => document.querySelector('#sheet [data-act=books][data-span="1"]').click());
assert.match(await page.textContent('#sheet .unit'), /24 days/); assert.doesNotMatch(await page.textContent('#sheet'), /month/i);
await page.evaluate(() => document.querySelector('#sheet [data-act=capo]').click());
assert.match(await page.textContent('#sheet'), /only capo/);
// his sheet says how he stands with the boss, and a gift waits for clean money: once made, not again this year
assert.ok(await page.locator('#sheet .move.mood').count() === 1, 'his mood is on his sheet');
assert.match(await page.textContent('#sheet .move.health'), /MONEY.*MEN.*THREAT/, 'and the health of his streets, named');
assert.ok(await page.locator('#sheet [data-act=gift]').isDisabled(), 'no gift without clean money');
// what a touched figure means is written under it on the page, never in a bubble over the rest (Nicolas, 2026-11-25)
await page.click('#sheet .tile >> nth=0');
assert.equal(await page.locator('#sheet .why').count(), 1, 'the words open under the figure');
assert.equal(await page.locator('#tip.on').count(), 0, 'and no bubble covers the page');
await page.click('#sheet .tile >> nth=0');
assert.equal(await page.locator('#sheet .why').count(), 0, 'a second touch puts them away');
await page.click('#sheet [data-act=close]');
const kept = await page.evaluate(() => { const g = window.__ashport.game(), was = g.family.clean || 0; g.family.clean = 2000; return was; });
await page.mouse.click(moved.x + moved.width / 2, moved.y + moved.height / 2);
await page.waitForSelector('#veil.on');
await page.click('#sheet [data-act=gift]');
assert.ok(await page.locator('#sheet [data-act=gift]').isDisabled(), 'one gift a year');
assert.match(await page.textContent('#sheet'), /The money is on its way/, 'it leaves the headquarters by loads');
assert.equal(await page.evaluate((kept) => { const g = window.__ashport.game(), left = g.family.clean; g.family.clean = kept; return left; }, kept), 500, 'the gift is paid in clean money');
await page.click('#sheet [data-act=close]');
// a real finger on a building: a small bubble beside it, the map stays in full view and time goes on
await page.touchscreen.tap(moved.x + moved.width / 2, moved.y + moved.height + 12);
await page.waitForTimeout(600);
assert.equal(await page.locator('#tip.on.more').count(), 1, 'the bubble stays after the click a phone sends');
assert.equal(await page.locator('#veil.on').count(), 0, 'no sheet over the map for a detail');
// a touch on the bubble opens the whole page, and it stays open
const bub = await page.locator('#tip').boundingBox();
await page.touchscreen.tap(bub.x + bub.width / 2, bub.y + bub.height / 2);
await page.waitForTimeout(600);
assert.equal(await page.locator('#veil.on').count(), 1, 'the bubble leads to the page');
assert.equal(await page.locator('#tip.on').count(), 0);
assert.doesNotMatch(await page.textContent('#sheet h2'), /Dutch/);
await page.touchscreen.tap(195, 30);      // and a touch beside the sheet closes it
await page.waitForTimeout(400);
assert.equal(await page.locator('#veil.on').count(), 0, 'a touch beside the sheet closes it');

// a badge that lights up over the map (gunfire, fire, police) answers the finger and says what happened
await page.evaluate(() => { const a = window.__ashport, lab = a.map().labels().find((l) => l.site && l.owner === 'family'); a.map().effects([{ kind: 'gunfire', city: lab.city, site: lab.id.slice(1 + lab.city.length), say: 'Shots in the street' }]); });
await page.waitForSelector('.lab.fx.gunfire');
const badge = await page.locator('.lab.fx.gunfire').first().boundingBox();
await page.touchscreen.tap(badge.x + badge.width / 2, badge.y + badge.height / 2);
await page.waitForTimeout(500);
assert.equal(await page.locator('#tip.on').count(), 1, 'a touched badge says what it is');
assert.match(await page.textContent('#tip'), /Gunfire.*Shots in the street/s);
assert.equal(await page.locator('#veil.on').count(), 0, 'and no sheet opens behind it');

// money can be followed: every car of cash says how much it carries, and each total says what last month did to it
// (time runs until a car of the club has a round to make: when that comes depends on what the capo opened first)
await page.evaluate(() => { const A = window.__ashport, out = () => A.map().stats().fleet.some((x) => /:car:1$/.test(x.id) && !x.parked);
  for (let i = 0; i < 8 || (i < 96 && !out()); i++) { A.beat(); const q = document.querySelector('#veil.on [data-act=later]'); if (q) q.click(); } });
// the cars live by the club: parked there, then out on their round, loaded only between the place and the club, and home again
const fleet = () => page.evaluate(() => window.__ashport.map().stats().fleet);
const lives = await page.evaluate(() => { const m = window.__ashport.map(), seen = { parked: 0, empty: 0, loaded: 0, ids: {} }; let wasOut = false, back = false;
  for (let n = 0; n < 400 && !back; n++) { m.run(0.5); const f = m.stats().fleet.filter((x) => /:car:1$/.test(x.id))[0]; if (!f) break; seen.ids[f.id] = 1;
    if (f.parked) { seen.parked++; if (wasOut) back = true; } else { wasOut = true; if (f.loaded) seen.loaded++; else seen.empty++; } }
  return { seen, back }; });
assert.ok(lives.seen.parked > 0 && lives.seen.empty > 0 && lives.seen.loaded > 0, 'a car is seen parked, on its way empty, and loaded ' + JSON.stringify(lives.seen));
assert.ok(lives.back, 'and it comes home to the club');
const fleetWas = (await fleet()).map((f) => f.id).sort();
await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__ashport.beat(); });
const fleetNow = (await fleet()).map((f) => f.id);
fleetWas.forEach((id) => assert.ok(fleetNow.includes(id), 'the same vehicle is there the month after: ' + id));
// (a month without takings to fetch has no loaded car: time runs until one is on the road)
await page.evaluate(() => { const A = window.__ashport, m = A.map(), loaded = () => m.stats().fleet.some((f) => f.loaded && /:car:/.test(f.id));
  for (let month = 0; month < 24 && !loaded(); month++) { for (let n = 0; n < 200 && !loaded(); n++) m.run(0.5);
    if (!loaded()) for (let i = 0; i < 4; i++) { A.beat(); const q = document.querySelector('#veil.on [data-act=later]'); if (q) q.click(); } } });
await page.waitForFunction(() => [...document.querySelectorAll('.lab.tag.amt b')].some((b) => /^\$\d/.test(b.textContent)), null, { timeout: 30000 });
assert.equal(await page.locator('.res .net').count(), 0, 'the totals at the top stand alone: no gain or loss beside them');

// a live hit: a capo goes for a guarded place, the screen goes to the street, the boss calls each step, and the end says what it cost
const hit = await page.evaluate(() => {
  const A = window.__ashport, g = A.game(), v = A.view().cities.find((c) => c.held), c = g.cities.find((x) => x.id === v.id), o = {};
  const p = v.places.find((q) => q.owner !== 'family' && q.kind !== 'key' && q.kind !== 'club' && q.kind !== 'hq'); if (!p) return { none: true };
  c.turn = Object.assign(c.turn || {}, { daily: true });
  AshportTurfHit.open(c, g.family, { capo: v.capos[0].id, x: p.x, y: p.y, way: 'force', kind: p.kind, cost: 0, month: c.month, months: 0 }, []);
  A.beat();
  const q = (s) => document.querySelector(s), shown = (s) => !!q(s) && getComputedStyle(q(s)).display !== 'none' && getComputedStyle(q(s)).visibility !== 'hidden';
  o.live = document.body.classList.contains('live'); o.band = q('#live').textContent; o.calls = document.querySelectorAll('#call [data-act=call]').length;
  o.alone = (q('#call .own') || {}).textContent || ''; o.hud = shown('.top'); o.bar = shown('.bot'); o.lit = A.map().stats().spots; o.speed = g.speed;
  for (let i = 0; i < 3 && !q('#call .end'); i++) { const b = q('#call [data-call=press]'); if (b) b.click(); A.beat(); }
  o.end = (q('#call .end') || {}).textContent || ''; o.tally = document.querySelectorAll('#call .tally div').length;
  const back = q('#call [data-act=unlive]'); if (back) back.click();
  o.after = document.body.classList.contains('live'); o.hudBack = shown('.top'); o.out = A.map().stats().spots;
  return o;
});
assert.ok(!hit.none, 'a rival place to hit');
assert.ok(hit.live && /hits the/.test(hit.band) && /ours/.test(hit.band), 'a hit that begins is watched: its band says who hits what (' + hit.band + ')');
assert.equal(hit.calls, 3, 'three calls for the boss'); assert.match(hit.alone, /Left alone, \w+ (presses on|holds|pulls out)/);
assert.ok(!hit.hud && !hit.bar, 'the usual figures step aside during a hit'); assert.ok(hit.lit > 0, 'the place hit is lit');
assert.ok(hit.end.length > 0 && hit.tally > 0, 'the end says what was won and what it cost (' + hit.end + ')');
assert.ok(!hit.after && hit.hudBack && hit.out === 0, 'back to the town: the figures are back, nothing stays lit');

// a dilemma: two of his people against each other, read on one card with both faces, and every way out says what it brings and costs
await page.evaluate(() => { const A = window.__ashport, E = window.AshportEmpire, g = A.game(), shut = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]'); if (shut) shut.click(); E.view(g).matters.forEach((m) => E.command(g, { type: 'decide', id: m.id, choice: m.choices[m.choices.length - 1].id })); g.family.dirty += 2000; const day = g.month * E.TICKS_PER_MONTH + g.ticks; window.__dil = (window.AshportAudience.bring(g, 'blood', day) || window.AshportAudience.bring(g, 'debt', day)).kind; });
await page.evaluate(() => { const shut = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]'); if (shut) shut.click(); window.__ashport.draw(); (document.querySelector('#alerts [data-requests]') || document.getElementById('clock')).click(); });      // (the page draws what the day brought: he opens what waits for him)
await page.waitForSelector('#veil.on .card.dilemma');
const dil = await page.evaluate(() => { const c = document.querySelector('#veil.on .card.dilemma'); return { kind: window.__dil, faces: c.querySelectorAll('.versus img, .versus svg, .versus .face').length, versus: !!c.querySelector('.versus'), ways: [...c.querySelectorAll('[data-choice]')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()) }; });
if (dil.kind === 'blood') assert.ok(dil.versus, 'the two sides face each other on the card');
assert.equal(dil.ways.length, 3, 'three ways out: ' + dil.ways.join(' / '));
await shot('c9-dilemma');
await page.click('#veil.on .card.dilemma [data-choice]:not([disabled])');
assert.equal(await page.evaluate(() => window.AshportEmpire.view(window.__ashport.game()).matters.length), 0, 'the boss has chosen');
assert.match(await page.evaluate(() => { const j = window.__ashport.game().journal; return j[j.length - 1].label; }), /\w/);
// "Next": the days run until something happens, several a beat, and the button says so while they do
await page.evaluate(() => { const q = document.querySelector('#veil.on [data-act=close]'); if (q) q.click(); const g = window.__ashport.game(); if (g.paused) window.AshportEmpire.command(g, { type: 'resume' }); });
const dayOf = () => page.evaluate(() => { const g = window.__ashport.game(); return g.month * window.AshportEmpire.TICKS_PER_MONTH + g.ticks; });
const skipFrom = await dayOf();
await page.click('#skip');
assert.equal(await page.evaluate(() => document.getElementById('skip').classList.contains('on')), true, 'the button is lit while the days run');
const ran = await page.evaluate(() => { const A = window.__ashport, E = window.AshportEmpire; let n = 0; while (E.hud(A.game()).skipping && n < 60) { A.beat(); n++; } return n; });
assert.ok(ran > 0 && ran < 60, 'the days stop running at the first news (' + ran + ' beats)');
assert.ok(await dayOf() - skipFrom >= ran, 'at least a day a beat');
assert.equal(await page.evaluate(() => document.getElementById('skip').classList.contains('on')), false, 'and the button goes out');
await page.evaluate(() => { for (let i = 0; i < 4; i++) { const q = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]'); if (q) q.click(); } const b = document.querySelector('#call .end [data-act=unlive]') || document.querySelector('#call [data-act=unlive]'); if (b) b.click(); });

// time that stands still is said in large, and a touch on the banner starts it again; the laundries say what they wash
// (a load of cash is on the road to the next city, so that something drives: cars go by the time that really passes and the town may be quiet)
await page.evaluate(() => { const A = window.__ashport, v = A.view(), M = window.AshportMapView, r = v.routes[0]; A.map().send(M.convoysTurf(M.planEmpire(v, window.AshportWorld.CITIES), [{ from: r.from, to: r.to, cargo: 'cash', amount: 500, days: 40 }])); });
await page.waitForFunction(() => window.__ashport.map().labels().some((l) => l.car), null, { timeout: 10000 });
// (whatever waits for the boss's word is answered first: the banner of a time that stands still for nothing is the one read here)
await page.evaluate(() => { const A = window.__ashport, E = window.AshportEmpire, g = A.game(); E.view(g).matters.forEach((m) => E.command(g, { type: 'decide', id: m.id, choice: m.choices[m.choices.length - 1].id })); g.paused = false; A.beat(); });
await page.click('#pause');
assert.equal(await page.evaluate(() => document.body.classList.contains('stopped')), true);
await page.waitForFunction(() => !window.__ashport.map().stats().moving, null, { timeout: 30000 });      // the camera has come back from the hit
assert.match(await page.textContent('#clock'), /TIME STOPPED.*Tap Play/);
// and nothing drives while it stands still: the cars wait where they are
const carsAt = () => page.evaluate(() => { const m = window.__ashport.map(); return { held: m.stats().held, at: m.labels().filter((l) => l.car).map((l) => l.id + ':' + Math.round(l.x) + ',' + Math.round(l.y)).join(' ') }; });
const stood = await carsAt(); await page.waitForTimeout(900); const later = await carsAt();
assert.equal(stood.held, true); assert.ok(stood.at.length > 0, 'cars are on the street');
assert.equal(later.at, stood.at, 'no car moved while time stood still');
// and the map is not drawn again while nothing changes: time stopped, camera still
const drawnNow = () => page.evaluate(() => window.__ashport.map().stats().drawn);
let d0 = await drawnNow(), quiet = false;      // a fire or a promotion still glowing keeps the map drawing until it is over
for (let n = 0; n < 40 && !quiet; n++) { await page.waitForTimeout(2500); const d = await drawnNow(); quiet = d === d0; d0 = d; }
assert.ok(quiet, 'no image is drawn while nothing changes');
await page.mouse.move(200, 600); await page.mouse.down(); await page.mouse.move(230, 620, { steps: 3 }); await page.mouse.up();
await page.waitForFunction((n) => window.__ashport.map().stats().drawn > n, d0, { timeout: 20000 });      // a finger on the map draws it again
await page.click('#clock');
assert.equal(await page.evaluate(() => document.body.classList.contains('stopped') || window.__ashport.game().paused), false, 'the banner starts time again');
await page.waitForFunction((was) => { const m = window.__ashport.map(); return !m.stats().held && m.labels().filter((l) => l.car).map((l) => l.id + ':' + Math.round(l.x) + ',' + Math.round(l.y)).join(' ') !== was; }, stood.at, { timeout: 20000 });      // the cars leave again with the clock
// the loaded car comes home: what it brings is seen coming in over the club the day the rules count it, and the dirty total answers
const came = await page.evaluate(async () => { const A = window.__ashport, m = A.map(), fresh = () => m.labels().some((l) => l.pop > 0 && l.part < 0.4);
  for (let n = 0; n < 400 && !fresh(); n++) { A.beat(); const q = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]'); if (q) q.click(); m.run(0.25); if (n % 40 === 39) await new Promise((r) => setTimeout(r, 300)); }      // (old figures fade away meanwhile)
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const e = document.querySelector('.lab.pop.in'); return { text: e && e.textContent, bump: document.getElementById('dirty').classList.contains('bump') }; });
assert.match(came.text || '', /^\+\$\d/, 'the takings are written over the club');
assert.ok(came.bump, 'the total at the top answers');
await shot('c2b-money-in');
// is he getting anywhere? Both moneys say what came in and what went out, the family has a rank, each capo a word and a power
assert.doesNotMatch(await page.textContent('.res'), /month|\/ mo|OUT/i, 'no rate at the top of the screen');
assert.match(await page.textContent('#rank'), /Street gang|Crew/i);
assert.match(await page.textContent('#rank'), /GOAL \d+% of the streets/, 'and its goal: the share that gives the next rank');
// a touch on the goal opens the whole road, from the first street to the Commission
await page.evaluate(() => document.querySelector('#rank [data-goal]').click());
assert.match(await page.textContent('#veil.on'), /Your reign[\s\S]*half the streets of the six cities[\s\S]*Crew[\s\S]*Family[\s\S]*Syndicate[\s\S]*Commission/);
assert.equal(await page.locator('#veil.on .road .step.now').count(), 1, 'the step the family stands on is marked');
await shot('c2b-goal');
await page.evaluate(() => document.querySelector('#veil.on [data-act=close]').click());
assert.match(await page.textContent('.lab.capo .say'), /^[A-Z][A-Z %+0-9]{3,}.*\d/, 'what his capo is doing, and his power');
assert.ok((await page.evaluate(() => window.__ashport.map().labels().filter((l) => l.ground).map((l) => l.id))).length > 0);
assert.match(await page.evaluate(() => [...document.querySelectorAll('.lab.sm')].map((e) => e.textContent).join(' | ')), /\d+%/, 'a street name says what the family holds of it');
await page.evaluate(() => document.querySelector('[data-account]').click());
assert.match(await page.textContent('#veil.on'), /Where the money goes[\s\S]*DIRTY CASH[\s\S]*CLEAN MONEY/);
await page.evaluate(() => document.querySelector('#veil.on [data-which=clean]').click());
assert.match(await page.getAttribute('#veil.on .tab.on', 'data-which'), /clean/, 'the other money is one touch away');
await shot('c2c-account');
await page.evaluate(() => document.querySelector('#veil.on [data-act=close]').click());
// what became of his decisions: from the journal, each one with its result or the months left before it
await page.evaluate(() => document.getElementById('journal').click());
await page.evaluate(() => document.querySelector('#veil.on [data-act=decisions]').click());
assert.match(await page.textContent('#veil.on'), /Your decisions/);
await page.evaluate(() => document.querySelector('#veil.on [data-act=close]').click());

// a finger that lands on his face and slides moves the map: no label holds the finger, and no sheet opens

// time runs at full speed until a second capo has his club, placed by a touch on the map
await page.click('#speed'); await page.click('#speed');
assert.equal(await page.textContent('#speed'), '4x');
await page.evaluate(() => window.__ashport.home());      // the boss looks at his first streets while the years go by
await page.waitForFunction(() => !window.__ashport.map().stats().moving, null, { timeout: 30000 });
await months(240, 'seat');
const seated = await page.evaluate(() => window.__seen);
assert.ok(seated.seat >= 1, 'a man at the door was given a street (' + JSON.stringify(seated) + ')');
assert.match(await hud(), / \| 2 \/ \d+$/, 'the family has two capos');
// (he may not have left his club yet when the second man came; the faces show up close, on a city that has been drawn since it last changed)
if (!seated.rides) { await page.evaluate(() => window.__ashport.home()); await still();
  for (let n = 0; n < 40 && !(await page.evaluate(() => window.__seen.rides)); n++) { await months(1, 'rides'); const d = await page.evaluate(() => window.__ashport.map().stats().drawn); await page.waitForFunction((d) => window.__ashport.map().stats().drawn > d + 1, d, { timeout: 30000 }).catch(() => {}); } }
const seen = await page.evaluate(() => window.__seen);
assert.ok(seen.midmonth > 0 && !seen.stale, 'what a man does inside a month is on the screen the day he does it (' + seen.midmonth + ' days with news, ' + (seen.stale || 0) + ' behind)');
// a touch on the line of the next streets takes the camera there
if (await page.locator('#next .nx').count()) {
  const was = await page.evaluate(() => window.__ashport.map().stats().drawn);
  await page.evaluate(() => { window.__ashport.map().focus(null); }); await still();
  await page.evaluate(() => document.querySelector('#next .nx').click()); await still();
  assert.ok(await page.evaluate(() => window.__ashport.map().labels().some((l) => l.claim)), 'the camera is over the streets about to be won');
  assert.ok(await page.evaluate((was) => window.__ashport.map().stats().drawn > was, was));
  await shot('c7-next-streets');
  await page.evaluate(() => window.__ashport.home()); await still();
}
assert.ok(seen.next > 0 && seen.claims > 0 && !seen.nextMonths, 'the next streets are told at the top with a bar and marked on the map, without a count of months (' + seen.next + ', ' + seen.claims + ')');
assert.ok(seen.paid > 0, 'what a place pays rises over it the day it is paid');
assert.ok(!seen.date, 'the date at the top is a count of days, and follows every day');
assert.ok(seen.away > 0 && seen.rides > 0, 'a capo is seen where he works, and in his own car on the way there (' + seen.away + ', ' + seen.rides + ')');
assert.ok(seen.news > 0 && seen.marks > 0, 'events are told by tiles on the edge and marked where they happen (' + seen.news + ', ' + seen.marks + ')');
assert.ok(seen.out === 0, 'no street is lit to be chosen: a man taken in settles by himself (' + seen.out + ')');
await months(6);
await still();
await shot('c3-two-capos');

// a touch on a street up close names it and says what stands there
const place = await page.evaluate(() => { const c = window.__ashport.view().cities[0], p = c.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq'); window.__ashport.tap({ city: c.id, bx: p.x, by: p.y, near: true }); return p; });
assert.match(await page.textContent('#tip'), new RegExp(place.name));
assert.match(await page.textContent('#tip'), /runs it/);
await shot('c3-bubble');
/* the bubble of a place follows it: it stays open while the days pass, and a figure that moves says by how much */
const follows = await page.evaluate((p) => { const A = window.__ashport, t = document.querySelector('#tip'); let moved = 0, shut = 0;
  for (let n = 0; n < 200 && !moved; n++) { if (document.querySelector('#veil.on') || A.game().paused) break; A.beat(); if (!t.classList.contains('on')) { shut++; break; } moved += t.querySelectorAll('.g em').length; }
  return { moved, shut, gauges: t.querySelectorAll('.g .nxb').length, pins: document.querySelectorAll('.lab.pin .fill').length }; }, place);
assert.ok(!follows.shut, 'the bubble of a place does not close by itself');
assert.ok(follows.pins > 0, 'the places of the family carry a gauge on the map');
seen.live = follows.moved;
await page.evaluate((p) => window.__ashport.tap({ city: 'ashport', bx: p.x, by: p.y, near: true }), place);      // (the bubble goes away by itself after a few seconds)
await page.click('#tip');
assert.match(await page.textContent('#sheet'), new RegExp(place.name));
await page.click('#sheet [data-act=city]');
assert.equal(await page.textContent('#sheet h2'), 'Ashport');
assert.match(await page.textContent('#sheet .chief'), /Seamus Callahan.*Head of the Callahan family.*% of the streets/, 'the rival of the city has a face');
// the line he gives the city: three on its sheet; he asks his men to earn, sees who follows, then lifts it
assert.equal(await page.locator('#sheet [data-act=line]').count(), 3);
await page.click('#sheet [data-act=line][data-line=earn]');
assert.equal(await page.evaluate(() => window.__ashport.view().cities.find((c) => c.id === 'ashport').line), 'earn');
assert.match(await page.textContent('#sheet'), /of \d capos? follow/);
await page.click('#sheet [data-act=line].on');
assert.equal(await page.evaluate(() => window.__ashport.view().cities.find((c) => c.id === 'ashport').line), null, 'a touch on the line in force lifts it');
// the share he takes of the city: three sizes on its sheet, the one in force marked; he takes a light one, then goes back
assert.equal(await page.locator('#sheet [data-act=cut]').count(), 3);
// (a capo may have asked him for his share already: whichever is in force, he starts again from the usual one)
const inForce = await page.evaluate(() => window.__ashport.view().cities.find((c) => c.id === 'ashport').cut);
assert.ok(await page.locator('#sheet [data-act=cut][data-cut=' + inForce + ']').isDisabled(), 'the share in force is marked');
if (inForce !== 'normal') await page.click('#sheet [data-act=cut][data-cut=normal]');
await page.click('#sheet [data-act=cut][data-cut=light]');
assert.ok(await page.locator('#sheet [data-act=cut][data-cut=light].on').count() === 1, 'the light share is in force');
assert.equal(await page.evaluate(() => window.__ashport.view().cities.find((c) => c.id === 'ashport').cut), 'light');
await page.click('#sheet [data-act=cut][data-cut=normal]');
await shot('c4-city-sheet');
await page.click('#sheet [data-act=close]');

// the top line is never cut short on a phone
assert.ok(await page.evaluate(() => { const e = document.getElementById('sub'); return e.scrollWidth <= e.clientWidth; }), 'the verdict fits: ' + await page.textContent('#sub'));
// the family sheet: the trades, and the detail of the one touched
await page.click('#family');
assert.equal(await page.textContent('#sheet h2'), 'The family');
// the wheel at its fullest, on a phone: every branch asked for by a capo and paying a big figure, one being learned. Each icon
// stands in the middle of its circle, and no name, figure or face lies over another, over a mark, or over a dot of the rings.
const crowd = await page.evaluate(() => {
  const v = window.__ashport.view(), capo = v.cities.flatMap((c) => c.capos)[0].id, w = document.querySelector('#sheet .wheel');
  const tree = v.tree.map((t, i) => Object.assign({}, t, { wanted: [capo], made: i % 2 ? 12345 : 0, tier: i % 3 ? 1 : 0, studying: i === 1 ? 3 : 0, next: t.next || { months: 6 } }));
  w.outerHTML = AshportCards.wheel(Object.assign({}, v, { tree, advice: { kind: tree[2].kind } }), tree[3].kind);
  const box = (e) => e.getBoundingClientRect(), mid = (b) => [b.x + b.width / 2, b.y + b.height / 2], bad = [];
  const wheel = document.querySelector('#sheet .wheel'), sheet = box(document.getElementById('sheet'));
  wheel.querySelectorAll('.know, .hub').forEach((k) => { const ic = k.querySelector(':scope>.ic, :scope>.gauge'), a = mid(box(k)), b = mid(box(ic));
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1) bad.push((k.dataset.know || 'hub') + ' icon off by ' + Math.round(b[0] - a[0]) + ',' + Math.round(b[1] - a[1])); });
  const parts = [...wheel.querySelectorAll('.know, .hub, .nm, .made, i.dot')], over = (p, q) => { const a = box(p), b = box(q); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1; };
  const name = (e) => (e.closest('.know') ? e.closest('.know').dataset.know + ' ' : '') + e.getAttribute('class');
  parts.forEach((p, i) => { const b = box(p); if (b.left < sheet.left || b.right > sheet.right) bad.push(name(p) + ' leaves the sheet');
    parts.slice(i + 1).forEach((q) => { if (p.contains(q) && q.classList.contains('made')) return;      /* (a figure is pinned on the rim of its own mark) */ if ((p.classList.contains('dot') && q.classList.contains('dot')) || !over(p, q)) return; bad.push(name(p) + ' over ' + name(q)); }); });
  return bad;
});
assert.deepEqual(crowd, [], 'the wheel reads cleanly');
await page.click('#sheet [data-act=close]'); await page.click('#family');
await page.click('.know.shut');
assert.match(await page.textContent('#know'), /not known yet/);
// what clean money buys for good: too dear for now, then bought once the money is there
const dear = page.locator('#sheet [data-act=buy]').first(), what = await dear.getAttribute('data-holding');
const price = await page.evaluate((id) => window.__ashport.view().holdings.find((h) => h.id === id).next.cost, what);
const had = await page.evaluate((price) => { const g = window.__ashport.game(), was = g.family.clean || 0; g.family.clean = 0; return was; }, price);
await page.click('#sheet [data-act=close]'); await page.click('#family');
assert.ok(await page.locator('#sheet [data-act=buy][data-holding=' + what + ']').isDisabled(), 'nothing is sold on credit');
await page.evaluate((price) => { window.__ashport.game().family.clean = price; }, price);
await page.click('#sheet [data-act=close]'); await page.click('#family');
await page.click('#sheet [data-act=buy][data-holding=' + what + ']');
// its money leaves the headquarters by van for City Hall: the holding is the family's once the last load is there
assert.ok(await page.evaluate((id) => window.__ashport.view().holdings.find((h) => h.id === id).paying, what), 'the money is on its way');
assert.match(await page.textContent('#sheet [data-act=buy][data-holding=' + what + ']'), /on its way/);
assert.ok(await page.locator('#sheet [data-act=buy][data-holding=' + what + ']').isDisabled(), 'nothing is paid for twice');
await page.click('#sheet [data-act=close]');
for (let n = 0; n < 12 && (await page.evaluate((id) => window.__ashport.view().holdings.find((h) => h.id === id).level, what)) < 1; n++) await months(1);
assert.equal(await page.evaluate((id) => window.__ashport.view().holdings.find((h) => h.id === id).level, what), 1, 'it is the family\'s for good');
await page.click('#family');
assert.match(await page.textContent('#sheet li.hold'), /1 \/ 3/);
await page.evaluate((had) => { window.__ashport.game().family.clean = had; }, had);
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
// a building that changes, seen up close, builds its own square of the town again, not the whole town (render/scene.js nearChunk)
assert.ok(near.stats.rebuilt === 0 || near.stats.chunks > 0, 'squares built again: ' + near.stats.chunks + ' for ' + near.stats.rebuilt + ' changes');
await page.click('#map'); await still();
const far = await page.evaluate(() => window.__ashport.map().stats());
assert.ok(far.waves > 0, 'a street that changes hands lights up in a wave (' + far.waves + ')');
assert.ok(far.calls <= 240, 'draw calls from afar: ' + far.calls);
await shot('c6-six-cities');

// what one city sends to the next is a truck on the road between them, seen from afar, and gone once it has arrived
const road = await page.evaluate(() => { const A = window.__ashport, v = A.view(), r = v.routes[0], m = A.map(), n = m.stats().cars;
  m.traffic(window.AshportMapView.tripsTurf(window.AshportMapView.planEmpire(v, window.AshportWorld.CITIES), v).concat(window.AshportMapView.convoysTurf(window.AshportMapView.planEmpire(v, window.AshportWorld.CITIES), [{ from: r.from, to: r.to, cargo: 'liquor', amount: 20, capo: 'dutch' }])));
  const on = () => m.labels().filter((l) => l.car && l.car.kind === 'convoy'); m.run(1); const tags = on(); m.run(30); return { n: tags.length, tag: tags[0], left: on().length }; });
assert.equal(road.n, 1, 'one truck on the road'); assert.ok(/ to /.test(road.tag.car.way), 'with its tag'); assert.equal(road.left, 0, 'it is gone once arrived');

// a car the rules gave days to drive keeps to them at the speed of the game: six days are three seconds at 2x, wherever it goes
const timed = await page.evaluate(() => { const A = window.__ashport, v = A.view(), r = v.routes[0], m = A.map(), M = window.AshportMapView, p = M.planEmpire(v, window.AshportWorld.CITIES);
  const on = () => m.labels().filter((l) => l.car && l.car.kind === 'convoy').length;
  m.traffic(M.tripsTurf(p, v).concat(M.convoysTurf(p, [{ from: r.from, to: r.to, cargo: 'cash', amount: 600, days: 6 }]))); m.pace(2); m.run(2.5); const before = on(); m.run(1); const after = on(); m.pace(1); return { before, after }; });
assert.deepEqual(timed, { before: 1, after: 0 }, 'on the road for its six days, and not a day more');

// the game is saved: a reload picks it up where it was
// (he leaves while a car is out with money: it must still be on its way when he comes back)
const riding = () => page.evaluate(() => window.__ashport.view().cities.reduce((n, c) => n + (c.rides || []).filter((r) => r.gone > 0 && r.days - r.gone >= 4).length, 0));      /* (the map drives on for the few seconds the test takes to look: a car a day from home would be in by then) */
for (let n = 0; n < 120 && !(await riding()); n++) await page.evaluate(() => { const g = window.__ashport.game(); if (!g.paused && !document.querySelector('#veil.on')) window.__ashport.beat(); else { const b = document.querySelector('#veil.on [data-act=later]') || document.querySelector('#veil.on [data-act=close]') || document.querySelector('#veil.on button'); if (b) b.click(); else g.paused = false; } });
assert.ok(await riding() > 0, 'a car is on its way with money');
/* one vehicle is one car on the map, whatever it carries: the cars are counted, not their loads */
const out = await page.evaluate(() => { const seen = new Set(); window.__ashport.view().cities.forEach((c) => (c.rides || []).forEach((r) => { if (r.gone > 0 && r.days - r.gone >= 4) seen.add(r.vehicle || r.capo + ':' + r.kind); })); return seen.size; });
// (the test gave and took clean money behind the page's back, further up: the figures are written again before they are read)
await page.evaluate(() => { document.getElementById('pause').click(); document.getElementById('pause').click(); });
const before = await hud();
const decided = await page.evaluate(() => (window.__seen && window.__seen.decide) || 0);      // (counted before the page is loaded again)
await page.reload();
await page.waitForFunction(() => window.__ashport && window.__ashport.map());
assert.equal(await hud(), before, 'the saved game comes back after a reload');
await page.evaluate(() => window.__ashport.home()); await still();
const again = await page.evaluate(() => window.__ashport.map().stats().timed);
assert.ok(again >= out, 'the car that was on its way is on the map again (' + again + ' of ' + out + ')');

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
assert.ok(decided > 0, 'a capo came to the boss with a matter, and the boss answered on the card (' + decided + ')');
console.log('ok: new screen played to', before, '·', JSON.stringify(seen), '· near', near.stats.calls, 'draws', near.labels, 'labels · far', far.calls, 'draws');
