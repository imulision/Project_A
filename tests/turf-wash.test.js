// Washing money is physical: dirty money is driven from the headquarters to a laundry, washed there at the
// laundry's pace, and the clean money is driven back. One load a trip, and as many trips as there are full loads.
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
  return { g, c, f: g.family, at: c.blocks[s.x + ',' + s.y], s, hq: T.hqOf(c, 'family') };
};
const day = (g) => { g.paused = false; return E.tick(g); };
const days = (g, n) => { const all = []; for (let i = 0; i < n; i++) all.push(...day(g)); return all; };
const place = (g, s) => E.view(g).cities[0].places.find((p) => p.x === s.x && p.y === s.y);
const LOAD = T.RULES.car.loads[1];

test('dirty money does not turn clean where it sleeps', () => {
  const { g, f } = start(5000);
  day(g);
  assert.strictEqual(f.clean, 0);
});

test('a capo\'s car takes dirty money from the headquarters to his laundry, one load a trip', () => {
  const { g, f, c, hq } = start(5000);
  let driven = 0;
  for (let i = 0; i < 5; i++) {
    const told = day(g).filter((e) => e.type === 'wash');
    told.forEach((e) => {
      assert.ok(e.amount > 0 && e.amount <= LOAD);
      assert.deepStrictEqual([e.capo, e.from], ['sal', { x: hq.x, y: hq.y }]);
      const there = c.blocks[e.x + ',' + e.y];
      assert.deepStrictEqual([there.kind, there.capo], ['rented', 'sal'], 'a laundry of his');
      assert.ok(there.dirty > 0, 'it is at the laundry now');
      driven += e.amount;
    });
  }
  assert.ok(driven > 0);
  assert.ok(f.dirty < 5000);
  assert.ok(!g.journal.some((l) => l.type === 'wash'), 'it is for the screen, not for the journal');
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

test('clean money is driven back to the headquarters one load at a time; only there is it the boss\'s', () => {
  const { g, f, at, s, hq } = start(0);
  at.washed = 1000;
  const told = day(g).filter((e) => e.type === 'clean'), trips = Math.floor(1000 / LOAD);
  assert.strictEqual(told.length, trips, 'no limit of trips: the car goes again as long as a full load waits');
  told.forEach((e) => assert.strictEqual(e.amount, LOAD));
  assert.deepStrictEqual([told[0].capo, told[0].x, told[0].y, told[0].from], ['sal', hq.x, hq.y, { x: s.x, y: s.y }]);
  assert.strictEqual(f.clean, trips * LOAD);
  assert.ok(Math.abs(at.washed - (1000 - trips * LOAD)) < 0.01, 'less than a load waits');
});

test('the car that went up loaded comes back loaded: the dirty money rides the same trip', () => {
  const { g, at } = start(5000);
  at.washed = 1000;
  const told = day(g), up = told.find((e) => e.type === 'clean'), back = told.find((e) => e.type === 'wash');
  assert.ok(up && back);
  assert.strictEqual(back.back, true, 'the return leg of the same trip');
});

test('a car does not leave for less than a full load', () => {
  const { g, at } = start(LOAD - 10);
  at.washed = LOAD - 10;
  const told = days(g, 2).filter((e) => (e.type === 'wash' && !e.back) || e.type === 'clean');
  assert.deepStrictEqual(told, []);
});

test('a laundry is never brought more than it washes in a cycle', () => {
  const { g, at, s } = start(50000);
  const most = place(g, s).wash.most;
  for (let i = 0; i < 60; i++) { day(g); assert.ok((at.dirty || 0) <= most + 0.01, 'day ' + i + ': ' + at.dirty); }
});

test('over a year a boss with a laundry ends with clean money, and none of it came without a car', () => {
  const { g, f } = start(3000);
  const all = days(g, 24 * 12), driven = all.filter((e) => e.type === 'clean').reduce((n, e) => n + e.amount, 0);
  assert.ok(f.clean > 0 || driven > 0);
  assert.ok(driven > 0);
});

test('the laundry says what waits to be washed, what waits to be fetched and what it can wash', () => {
  const { g, at, s } = start(0);
  at.dirty = 120; at.washed = 30;
  const w = place(g, s).wash;
  assert.deepStrictEqual([w.waiting, w.ready], [120, 30]);
  assert.ok(w.most > 0);
});

test('each leg is one of the trips of the city: the capo\'s own car, between the headquarters and the laundry', () => {
  const { g, at, s, hq } = start(5000);
  at.washed = 1000;
  // the city shows the trips of the cycle that has just closed
  let wash, clean;
  for (let i = 0; i < 60 && !(wash && clean); i++) {
    day(g);
    const trips = E.view(g).cities[0].trips;
    wash = trips.find((t) => t.kind === 'wash' && t.to.x === s.x && t.to.y === s.y); clean = trips.find((t) => t.kind === 'clean');
  }
  assert.deepStrictEqual([wash.capo, wash.vehicle, wash.cargo, wash.from, wash.to], ['sal', 'sal:own', 'cash', { x: hq.x, y: hq.y }, { x: s.x, y: s.y }]);
  assert.deepStrictEqual([clean.capo, clean.vehicle, clean.cargo, clean.from, clean.to, clean.amount], ['sal', 'sal:own', 'clean', { x: s.x, y: s.y }, { x: hq.x, y: hq.y }, LOAD]);
});

test('the car takes dirty money down again and again the same day, until the laundry has all it can wash', () => {
  const { g, c } = start(50000, 3); // a big laundry: several loads fit
  const told = day(g).filter((e) => e.type === 'wash');
  assert.ok(told.length > 1, 'more than one trip the first day');
  const v = E.view(g).cities[0].places.filter((p) => p.wash);
  v.forEach((p) => assert.ok(p.wash.most - p.wash.waiting < LOAD + p.wash.most / T.RULES.days + 1, 'no room left for a full load at ' + p.x + ',' + p.y));
  assert.ok(c);
});
