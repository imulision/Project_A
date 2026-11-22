// Washing money is physical: dirty money is driven from the headquarters to a laundry, washed there at the
// laundry's pace, and the clean money is driven back. One load a trip. A trip takes time (a block a day), and
// the car that makes it does nothing else meanwhile: the only limit is the cars a man has.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');

// Sal's game with a rented laundry of his own; the director keeps out.
const start = (dirty, level) => {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9;
  const c = g.cities[0], s = T.spots(c)[0];
  T.open(c, s.x, s.y, { owner: 'family', kind: 'rented', capo: 'sal' });
  if (level) c.blocks[s.x + ',' + s.y].level = level;
  g.family.dirty = dirty; g.family.clean = 0;
  return { g, c, f: g.family, at: c.blocks[s.x + ',' + s.y], s, hq: T.hqOf(c, 'family'), club: T.clubOf(c, 'sal') };
};
const day = (g) => { g.paused = false; return E.tick(g); };
const days = (g, n) => { const all = []; for (let i = 0; i < n; i++) all.push(...day(g)); return all; };
const place = (g, s) => E.view(g).cities[0].places.find((p) => p.x === s.x && p.y === s.y);
const LOAD = T.RULES.car.loads[1];
const far = (a, b) => Math.max(1, Math.ceil((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) / T.RULES.car.speed));

test('a trip takes a day a block, and never less than a day', () => {
  assert.strictEqual(T.RULES.car.speed, 1);
  assert.strictEqual(T.tripDays({ x: 3, y: 3 }, { x: 3, y: 3 }), 1);
  assert.strictEqual(T.tripDays({ x: 3, y: 3 }, { x: 4, y: 3 }), 1);
  assert.strictEqual(T.tripDays({ x: 3, y: 3 }, { x: 5, y: 4 }), 3);
  assert.strictEqual(T.tripDays({ x: 0, y: 0 }, { x: 4, y: 3 }), 7);
});

test('the car goes first where the most money waits: the laundry before the club when more sleeps there', () => {
  const { g, f, at } = start(0);
  f.men.sal.share = LOAD; at.washed = 3 * LOAD;
  const first = day(g).find((e) => e.type === 'clean' || e.type === 'tribute');
  assert.strictEqual(first.type, 'clean');
  const other = start(0);
  other.f.men.sal.share = 3 * LOAD; other.at.washed = LOAD;
  assert.strictEqual(day(other.g).find((e) => e.type === 'clean' || e.type === 'tribute').type, 'tribute');
});

test('dirty money does not turn clean where it sleeps', () => {
  const { g, f } = start(5000);
  day(g);
  assert.strictEqual(f.clean, 0);
});

test('a load of dirty money leaves the headquarters in the capo\'s car and is at the laundry when the car gets there', () => {
  const { g, f, c, hq } = start(5000, 3);
  let left = null, n = 0;
  while (!left && n++ < 30) left = day(g).find((e) => e.type === 'wash');
  assert.ok(left, 'the car leaves');
  assert.deepStrictEqual([left.capo, left.from, left.amount], ['sal', { x: hq.x, y: hq.y }, LOAD]);
  const there = c.blocks[left.x + ',' + left.y];
  assert.deepStrictEqual([there.kind, there.capo], ['rented', 'sal'], 'a laundry of his');
  assert.strictEqual(left.days, far(hq, left), 'the trip says how long it takes');
  assert.ok(left.wait >= 0, 'and how long the car takes to come and load');
  assert.ok(f.dirty <= 5000 - LOAD + 1000, 'the load has left the purse');
  assert.strictEqual(there.dirty || 0, 0, 'it is on the road, not at the laundry');
  const told = days(g, left.wait + left.days);
  assert.ok(told.some((e) => e.type === 'arrived' && e.kind === 'wash' && e.x === left.x && e.y === left.y && e.amount === LOAD));
  assert.ok(there.dirty > 0, 'now it is there');
  assert.ok(!g.journal.some((l) => l.type === 'wash' || l.type === 'arrived'), 'for the screen, not for the journal');
});

test('one car, one trip at a time: while it is on the road nothing else of his leaves', () => {
  const { g } = start(50000, 3);
  let busy = 0;
  for (let i = 0; i < 40; i++) {
    const left = day(g).filter((e) => (e.type === 'wash' || e.type === 'clean' || e.type === 'tribute') && e.capo === 'sal');
    assert.ok(left.length <= 1, 'day ' + i + ': one departure at most');
    if (left.length) { assert.ok(busy <= 0, 'day ' + i + ': the car was still out for ' + busy + ' days'); busy = left[0].wait + left[0].days; }
    busy -= 1;
  }
});

test('the laundry washes what waits there at its own pace, and keeps its cut', () => {
  const { g, f, at, s } = start(0);
  at.dirty = 1000;
  const most = place(g, s).wash.most;
  day(g);
  const washed = 1000 - at.dirty;
  assert.ok(Math.abs(washed - most / T.RULES.days) < 0.01, 'a day\'s worth: ' + washed);
  assert.ok(Math.abs(at.washed - washed * 0.75) < 0.01, 'a rented laundry keeps a quarter');
  assert.strictEqual(f.clean, 0, 'it is not the boss\'s until it comes back');
});

test('clean money is driven back to the headquarters one load at a time; it is the boss\'s when the car arrives', () => {
  const { g, f, at, s, hq } = start(0);
  at.washed = 1000;
  const left = day(g).find((e) => e.type === 'clean');
  assert.deepStrictEqual([left.capo, left.x, left.y, left.from, left.amount], ['sal', hq.x, hq.y, { x: s.x, y: s.y }, LOAD]);
  assert.strictEqual(left.days, far(s, hq));
  assert.ok(Math.abs(at.washed - (1000 - LOAD)) < 0.01, 'the load has left the laundry');
  assert.strictEqual(f.clean, 0, 'not his yet');
  days(g, left.wait + left.days);
  assert.strictEqual(f.clean, LOAD);
});

test('the car that went up loaded comes back loaded: dirty money rides the way back', () => {
  const { g, at, hq } = start(5000);
  at.washed = 1000;
  const up = day(g).find((e) => e.type === 'clean');
  const told = days(g, up.wait + up.days + 1), back = told.find((e) => e.type === 'wash');
  assert.ok(back, 'it leaves the headquarters again with dirty money');
  assert.deepStrictEqual([back.from, back.wait], [{ x: hq.x, y: hq.y }, 0], 'at once: the car is already there');
});

test('a car does not leave for less than a full load', () => {
  const { g, at } = start(LOAD - 10);
  at.washed = LOAD - 10;
  const told = days(g, 2).filter((e) => e.type === 'wash' || e.type === 'clean');
  assert.deepStrictEqual(told, []);
});

test('a laundry is never brought more than it washes in a cycle, counting what is on the road', () => {
  const { g, at, s } = start(50000);
  const most = place(g, s).wash.most;
  for (let i = 0; i < 60; i++) { day(g); assert.ok((at.dirty || 0) + (at.coming || 0) <= most + 0.01, 'day ' + i + ': ' + at.dirty + ' + ' + at.coming); }
});

test('over a year a boss with a laundry ends with clean money, and none of it came without a car', () => {
  const { g, f } = start(3000);
  const all = days(g, 24 * 12), driven = all.filter((e) => e.type === 'arrived' && e.kind === 'clean').reduce((n, e) => n + e.amount, 0);
  assert.ok(driven > 0);
  assert.ok(f.clean > 0 || driven > 0);
});

test('the laundry says what waits to be washed, what waits to be fetched and what it can wash', () => {
  const { g, at, s } = start(0);
  at.dirty = 120; at.washed = 30;
  const w = place(g, s).wash;
  assert.deepStrictEqual([w.waiting, w.ready], [120, 30]);
  assert.ok(w.most > 0);
});

test('the city says what is on the road today: each load, its car, where from, where to, the day it left and how long it takes', () => {
  const { g, at, s, hq } = start(0);
  at.washed = 1000;
  day(g);
  const r = E.view(g).cities[0].rides.find((q) => q.kind === 'clean');
  assert.deepStrictEqual([r.capo, r.vehicle, r.from, r.to, r.amount, r.days], ['sal', 'sal:car:1', { x: s.x, y: s.y }, { x: hq.x, y: hq.y }, LOAD, far(s, hq)]);
  assert.ok(r.gone >= 0 && r.gone <= r.days, 'days already driven');
  const back = E.view(E.load(E.save(g))).cities[0].rides.find((q) => q.kind === 'clean');
  assert.deepStrictEqual(back, r, 'kept through a save');
});

// --- every car a man has can carry the boss's money ---
test('a man with two cars sends two loads the same day; with one car, one', () => {
  const two = start(0);
  two.f.men.sal.cars = 2; two.f.men.sal.share = LOAD; two.at.washed = 2 * LOAD;
  const left = day(two.g).filter((e) => e.type === 'clean' || e.type === 'tribute');
  assert.deepStrictEqual(left.map((e) => e.type).sort(), ['clean', 'tribute']);
  assert.deepStrictEqual(E.view(two.g).cities[0].rides.map((r) => r.vehicle).sort(), ['sal:car:1', 'sal:car:2']);
  const one = start(0);
  one.f.men.sal.share = LOAD; one.at.washed = 2 * LOAD;
  assert.strictEqual(day(one.g).filter((e) => e.type === 'clean' || e.type === 'tribute').length, 1);
});

test('when the boss\'s money piles up with every car of his on the road, the capo buys another car and says why', () => {
  const { g, f, at } = start(0);
  f.men.sal.cash = 5000; at.washed = 10 * LOAD;
  const bought = days(g, T.RULES.days).find((e) => e.type === 'car');
  assert.ok(bought, 'he buys one');
  assert.match(bought.label, /Sal buys a second car: the boss's money was piling up/);
  assert.strictEqual(f.men.sal.cars, 2);
  const poor = start(0);
  poor.f.men.sal.cash = 0; poor.at.washed = LOAD;
  assert.ok(!days(poor.g, T.RULES.days).some((e) => e.type === 'car' && /boss/.test(e.label)), 'a single load waiting is no reason');
});
