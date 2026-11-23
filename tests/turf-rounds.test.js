// A car that goes for the takings takes time too: it drives to the place, loads, and drives back to the club, a
// block a day. The money is the capo's the day the car is back, and the car does nothing else meanwhile. In a
// game played day by day there is no count of runs a cycle any more: the cars a man has are the only limit.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const H = require('./turf-helpers.js');
require('./turf-helpers.js').plain(); // a block a day, one load a vehicle
const town = H.town, family = H.family, LOAD = H.LOAD;
const DAYS = T.RULES.days;

// Dutch, his club at (2, 3) and gambling dens at the given blocks, each with money waiting in its till.
const dutch = (spots, till) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  for (const [x, y] of spots) { T.open(c, x, y, { owner: 'family', kind: 'gambling', capo: 'dutch' }); c.blocks[x + ',' + y].till = till; }
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  f.men.dutch.cash = 0;
  return { c, f };
};
// the days of one cycle, without the capo's own day; each(d, events) sees every day
const days = (c, f, n, each) => {
  T.begin(f, [c]);
  for (let d = 0; d < n; d++) each(d, T.pass(f, [c], d));
};
const runs = (ev) => ev.filter((e) => e.type === 'run'), back = (ev) => ev.filter((e) => e.type === 'arrived' && e.kind === 'takings');

test('a run for the takings leaves, takes the days of its way there and back, and is the capo\'s when the car is home', () => {
  const { c, f } = dutch([[6, 3]], LOAD); // four blocks from his club
  const seen = [];
  let cashBefore = null, cashAfter = null;
  days(c, f, 10, (d, ev) => {
    runs(ev).forEach((e) => seen.push([d, 'run', e.x, e.y, e.amount, e.wait, e.days, e.vehicle]));
    back(ev).forEach((e) => { seen.push([d, 'back', e.x, e.y, e.amount]); cashAfter = f.men.dutch.cash; });
    if (d === 7) cashBefore = f.men.dutch.cash;
  });
  assert.deepEqual(seen, [[0, 'run', 6, 3, LOAD, 4, 4, 'dutch:car:1'], [8, 'back', 2, 3, LOAD]]);
  assert.ok(cashAfter - cashBefore > LOAD / 2, 'the load is counted the day it is back, not before: ' + cashBefore + ' then ' + cashAfter);
});

test('the car that is out does nothing else: one car, one run at a time; a second car takes the second till', () => {
  const one = dutch([[6, 3], [2, 5]], 3 * LOAD);
  let first = [];
  days(one.c, one.f, 1, (d, ev) => { first = runs(ev); });
  assert.equal(first.length, 1, 'one car');
  assert.equal(T.view(one.c, one.f).rides.filter((r) => r.kind === 'takings').length, 1);
  const two = dutch([[6, 3], [2, 5]], 3 * LOAD);
  two.f.men.dutch.cars = 2;
  days(two.c, two.f, 1, (d, ev) => { first = runs(ev); });
  assert.deepEqual(first.map((e) => e.vehicle).sort(), ['dutch:car:1', 'dutch:car:2']);
  assert.deepEqual(first.map((e) => e.x + ',' + e.y).sort(), ['2,5', '6,3'], 'each to its own till');
});

test('no count of runs a cycle: a car goes again as soon as it is back, so a place next door is emptied many times', () => {
  const { c, f } = dutch([[3, 3]], 40 * LOAD); // next door: a day there, a day back
  let n = 0;
  days(c, f, DAYS, (d, ev) => { n += runs(ev).length; });
  assert.equal(n, DAYS / 2);
  assert.ok(n > T.RULES.car.runs, 'more than the ' + T.RULES.car.runs + ' runs a car was once allowed');
});

test('a far place is emptied less often than a near one', () => {
  const far = dutch([[10, 3]], 40 * LOAD);
  let n = 0;
  days(far.c, far.f, DAYS, (d, ev) => { n += runs(ev).length; });
  assert.equal(n, Math.ceil(DAYS / 16), 'eight blocks away: sixteen days a run');
});
