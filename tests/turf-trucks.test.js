// A truck takes time like a car: it drives to the cellar, loads, and drives to the bar, a block a day. The load
// is on the bar's shelf the day the truck gets there, and the truck does nothing else meanwhile. Played day by
// day there is no count of runs a cycle: the trucks a man has are the only limit.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const H = require('./turf-helpers.js');
require('./turf-helpers.js').plain(); // a block a day, one load a vehicle
const town = H.town, family = H.family;
const DAYS = T.RULES.days, CRATES = T.RULES.truck.load;

// Dutch, his club at (2, 3), a still next door at (2, 2) and bars at the given blocks.
const brewer = (bars, trucks) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  for (const [x, y] of bars) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  f.men.dutch.cash = 0; f.men.dutch.trucks = trucks || 1;
  return { c, f };
};
const days = (c, f, n, each) => { T.begin(f, [c]); for (let d = 0; d < n; d++) each(d, T.pass(f, [c], d)); };
const left = (ev) => ev.filter((e) => e.type === 'haul'), there = (ev) => ev.filter((e) => e.type === 'arrived' && e.kind === 'haul');
const shelf = (c, x, y) => c.blocks[x + ',' + y].stock || 0;

test('a truck leaves for the cellar, loads, and the load is on the shelf of the bar the day it arrives', () => {
  const { c, f } = brewer([[6, 2]]); // four blocks from the still
  const seen = [];
  let before = null;
  days(c, f, 8, (d, ev) => {
    left(ev).forEach((e) => seen.push([d, 'haul', e.cargo, e.from, e.x, e.y, e.amount, e.wait, e.days, e.vehicle]));
    there(ev).forEach((e) => seen.push([d, 'there', e.cargo, e.x, e.y, e.amount]));
    if (d === 4) before = shelf(c, 6, 2);
  });
  // a day from the club to the still, four from the still to the bar
  assert.deepEqual(seen[0], [0, 'haul', 'liquor', { x: 2, y: 2 }, 6, 2, CRATES, 1, 4, 'dutch:truck:1']);
  assert.deepEqual(seen.filter((q) => q[1] === 'there')[0], [5, 'there', 'liquor', 6, 2, CRATES]);
  assert.equal(before, 0, 'nothing on the shelf while the truck is on the road');
  assert.ok(shelf(c, 6, 2) >= 1);
});

test('a truck on the road does nothing else: one truck, one load at a time; a second truck takes the second load', () => {
  const one = brewer([[6, 2], [7, 2]]);
  let out = 0;
  days(one.c, one.f, 5, (d, ev) => { out += left(ev).length; });
  assert.equal(out, 1, 'it is still on its way to the first bar');
  const view = T.view(one.c, one.f).rides.filter((r) => r.kind === 'haul');
  assert.deepEqual(view.map((r) => [r.vehicle, r.cargo, r.to]), [['dutch:truck:1', 'liquor', { x: 6, y: 2 }]]);
  const two = brewer([[6, 2], [7, 2]], 2);
  const first = [];
  days(two.c, two.f, 1, (d, ev) => first.push(...left(ev)));
  assert.deepEqual(first.map((e) => e.vehicle), ['dutch:truck:1', 'dutch:truck:2']);
  assert.deepEqual(first.map((e) => e.x + ',' + e.y).sort(), ['6,2', '7,2'], 'one load for each bar: the second is not sent where the first is going');
});

test('no count of runs a cycle: a truck goes again the day it has delivered, and a near bar is served sooner than a far one', () => {
  const first = (q) => { let day = null, again = null; days(q.c, q.f, DAYS, (d, ev) => { if (day === null && there(ev).length) day = d; if (d > 0 && again === null && left(ev).length) again = d; }); return { day, again }; };
  const near = first(brewer([[3, 2]])), far = first(brewer([[9, 2]]));
  assert.deepEqual([near.day, far.day], [2, 8]);
  assert.equal(near.again, near.day, 'the second load of the cycle leaves as soon as the truck is free');
});

test('a load the rivals hold up never reaches the shelf', () => {
  const { c, f } = brewer([[6, 2]]);
  c.rival = 'Rossi';
  T.begin(f, [c]);
  c.turn.trap = { at: { [2 * c.w + 2]: true }, done: null };
  const ev = [];
  for (let d = 0; d < 7; d++) ev.push(...T.pass(f, [c], d));
  assert.equal(left(ev)[0].lost, 'hijack');
  assert.ok(ev.some((e) => e.type === 'hijack' && e.cargo === 'liquor'));
  assert.equal(there(ev).length, 0);
  assert.equal(shelf(c, 6, 2), 0);
});

test('a haul says where the truck stood, and the city says where each truck of a man stands and when it is free', () => {
  const { c, f } = brewer([[6, 2]]);
  const seen = [];
  days(c, f, 6, (d, ev) => left(ev).forEach((e) => seen.push(e.at)));
  assert.deepEqual(seen, [{ x: 2, y: 3 }, { x: 6, y: 2 }], 'from his club the first time, then from the bar it delivered to');
  const k = T.view(c, f).capos.filter((q) => q.id === 'dutch')[0];
  assert.deepEqual(k.rigs.map((r) => [r.vehicle, r.x, r.y, r.busy]), [['dutch:truck:1', 6, 2, true]]);
});

test('the city says the most each place can hold, in the unit of its stock: a cellar, a bar\'s shelf, the weed a bar keeps', () => {
  const { c, f } = brewer([[6, 2]]);
  T.open(c, 4, 4, { owner: 'family', kind: 'brothel', capo: 'dutch' });
  const at = (x, y) => T.view(c, f).places.filter((p) => p.x === x && p.y === y)[0];
  assert.equal(at(2, 2).room, T.RULES.truck.cellar * T.RULES.pours * CRATES, 'a small still keeps two cycles of what it makes');
  assert.equal(at(6, 2).room, T.RULES.truck.shelf * CRATES);
  assert.equal(at(6, 2).weedRoom, T.RULES.truck.shelf * T.RULES.weed.load);
  assert.equal(at(4, 4).weedRoom, T.RULES.truck.shelf * T.RULES.weed.load);
  assert.equal(at(4, 4).room, undefined, 'a brothel keeps no crates');
  assert.equal(at(2, 3).room, undefined, 'nor does a club');
});
