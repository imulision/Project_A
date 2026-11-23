// The pace and the room of the family's vehicles. Every vehicle drives at the same speed, a block in three days,
// and a road at the same pace. What keeps the money and the goods moving on such long trips is the room of a
// vehicle: a full load calls it, and it takes several loads when they wait.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family, LOAD = H.LOAD;
const CRATES = T.RULES.truck.load;

const days = (c, f, n, each) => { T.begin(f, [c]); for (let d = 0; d < n; d++) each(d, T.pass(f, [c], d)); };
const gambler = (spots, till) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  for (const [x, y] of spots) { T.open(c, x, y, { owner: 'family', kind: 'gambling', capo: 'dutch' }); c.blocks[x + ',' + y].till = till; }
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  f.men.dutch.cash = 0;
  return { c, f };
};
const brewer = (bars) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  for (const [x, y] of bars) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  f.men.dutch.cash = 0; f.men.dutch.trucks = 1;
  return { c, f };
};

test('every vehicle takes three days a block, and never less than a day', () => {
  assert.equal(T.tripDays({ x: 3, y: 3 }, { x: 3, y: 3 }), 1);
  assert.equal(T.tripDays({ x: 3, y: 3 }, { x: 4, y: 3 }), 3);
  assert.equal(T.tripDays({ x: 0, y: 0 }, { x: 4, y: 3 }), 21);
});

test('a road is driven at the pace of a street: three times the days it took', () => {
  const g = E.createGame({ capo: 'sal' }), all = [];
  for (const a of g.cities) for (const b of g.cities) if (a.id < b.id) { const d = E.roadDays(a.id, b.id); if (d) all.push(d); }
  assert.equal(T.RULES.road.per, 7, 'the stretch of road a van drives in a day');
  assert.ok(all.length > 0 && Math.min(...all) >= 14 && Math.max(...all) <= 33, 'two to five weeks: ' + all.join(' '));
});

test('a till that holds a load calls a car, and the car takes up to three loads of it', () => {
  assert.equal(T.RULES.car.holds, 3);
  const amount = (till) => { const { c, f } = gambler([[3, 3]], till); let e = null; days(c, f, 1, (d, ev) => { e = e || ev.find((q) => q.type === 'run'); }); return e ? Math.round(e.amount / LOAD) : null; };
  assert.equal(amount(LOAD / 2), null, 'less than a load: the car stays');
  assert.equal(amount(2 * LOAD), 2, 'two loads wait: it takes both');
  assert.equal(amount(5 * LOAD), 3, 'never more than its room');
});

// the first day of a cycle, with so many loads in the cellar that morning
const firstDay = (c, f, stock, shelf) => { T.begin(f, [c]); c.blocks['2,2'].stock = stock; if (shelf) c.blocks['3,2'].stock = shelf; return T.pass(f, [c], 0).filter((q) => q.type === 'haul'); };

test('a truck takes up to three loads when the cellar has them and the shelf has room', () => {
  assert.equal(T.RULES.truck.holds, 3);
  const big = brewer([[6, 2]]), out = firstDay(big.c, big.f, 5);
  assert.deepEqual(out.map((e) => e.amount), [3 * CRATES]);
  assert.equal(big.c.blocks['2,2'].stock, 2, 'the cellar keeps the rest');
  assert.equal(big.c.rides.find((r) => r.kind === 'haul').loads, 3);
  const small = brewer([[6, 2]]);
  assert.deepEqual(firstDay(small.c, small.f, 1).map((e) => e.amount), [CRATES], 'one load in the cellar: one load');
});

test('three loads on a truck are three loads on the shelf the day it arrives', () => {
  const { c, f } = brewer([[3, 2]]);
  firstDay(c, f, 3);
  let on = null;
  for (let d = 1; d < 8 && on === null; d++) if (T.pass(f, [c], d).find((q) => q.type === 'arrived' && q.kind === 'haul')) on = c.blocks['3,2'].stock;
  assert.ok(on > 2 && on <= 3, 'three loads, less what the bar poured that day: ' + on);
});

test('a truck leaves the other dry bars their part of the cellar', () => {
  const { c, f } = brewer([[3, 2], [2, 1]]);
  f.men.dutch.trucks = 2;
  assert.deepEqual(firstDay(c, f, 2).map((e) => e.amount), [CRATES, CRATES], 'two loads, two dry bars: one each');
});

test('a shelf and a cellar hold four loads', () => {
  assert.equal(T.RULES.truck.shelf, 4);
  assert.equal(T.RULES.truck.cellar, 4);
  const { c, f } = brewer([[3, 2]]);
  assert.deepEqual(firstDay(c, f, 4, 3).map((e) => e.amount), [CRATES], 'room for one more on the shelf: one load');
});

test('the boss\'s share and the laundries are served the same way: a load calls the car, it takes up to three', () => {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9;
  const load = T.RULES.car.loads[0];
  g.family.men.sal.share = 2.5 * load;
  let left = null, n = 0;
  while (!left && n++ < 48) { g.paused = false; left = E.tick(g).find((e) => e.type === 'tribute'); }
  assert.ok(left && left.amount >= 2.5 * load && left.amount <= 3 * load, 'all that waited, in one car: ' + (left && left.amount));
});

test('the armoured van of the headquarters carries three times what it did', () => {
  assert.deepEqual(T.RULES.van.loads, [1800, 4500, 12000, 30000]);
});

// A vehicle is three times longer on its way, so a capo needs three times as many for the same streets:
// each costs a third of what it did, to buy and to keep.
test('a car and a truck cost a third of what they did, to buy and to keep', () => {
  assert.deepEqual([T.RULES.car.cost, T.RULES.car.upkeep], [130, 7]);
  assert.deepEqual([T.RULES.truck.cost, T.RULES.truck.upkeep], [170, 8]);
});
