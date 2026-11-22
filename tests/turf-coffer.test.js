// Money between cities is physical: what a city earns for the boss sleeps in that city's headquarters, and reaches
// his own purse only by road, one load a car, one car a day, one road a day.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const W = require('../web/world.js');

const start = () => { const g = E.createGame({ capo: 'dutch' }); g.reign.left = 1e9; g.reign.reached = 2; return g; };
const day = (g) => { g.paused = false; return E.tick(g); };
const city = (g, id) => g.cities.find((c) => c.id === id);
const LOAD = T.RULES.convoy.cash;
const linked = (a, b) => W.ROUTES.some((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));
// a city two roads away from Ashport, and the city in between
const far = () => {
  for (const c of W.CITIES) if (c.id !== 'ashport' && !linked(c.id, 'ashport')) {
    const mid = W.CITIES.find((m) => linked(m.id, c.id) && linked(m.id, 'ashport'));
    if (mid) return { far: c.id, mid: mid.id };
  }
  throw new Error('no city two roads away');
};

test('the boss\'s city is home; the purse of any other city is its own coffer', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  assert.strictEqual(T.purse(city(g, 'ashport'), f), f);
  const p = T.purse(calder, f);
  assert.notStrictEqual(p, f);
  p.dirty += 40;
  assert.strictEqual(E.view(g).cities.find((c) => c.id === 'calder').coffer.dirty, 40);
  assert.strictEqual(E.view(g).cities.find((c) => c.id === 'calder').coffer.load, LOAD);
  assert.strictEqual(E.view(g).cities[0].coffer, undefined, 'at home the coffer is the boss\'s own purse');
});

test('the share of a capo in another city goes to that city\'s coffer, not to the boss\'s purse', () => {
  const g = start(), f = g.family;
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) knock = day(g).find((e) => e.type === 'knocks');
  f.dirty = 50000;
  const road = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo).roads[0];
  E.command(g, { type: 'welcome', city: road.city, from: 'ashport', capo: knock.capo });
  let sent = null;
  for (let i = 0; i < 24 * 60 && !sent; i++) sent = day(g).find((e) => e.type === 'arrived' && e.kind === 'tribute' && e.city === road.city);
  assert.ok(sent, 'a load of his share reaches the headquarters of ' + road.city);
  const c = city(g, road.city);
  const washing = Object.values(c.blocks).reduce((n, b) => n + (b.dirty || 0) + (b.coming || 0), 0); // his own car may have taken it straight on to his laundry
  assert.ok(c.coffer.dirty > 0 || washing > 0 || (f.onRoad || []).length > 0, 'it is in the coffer there, at a laundry there, or already on the road');
});

const cash = (g) => day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash');
const ROAD = T.RULES.road.days;
const VAN = T.RULES.van.loads;

test('the armoured van of a headquarters carries more as the headquarters grows', () => {
  assert.deepStrictEqual(VAN, [600, 1500, 4000, 10000]);
  assert.strictEqual(ROAD, 6);
});

test('when a coffer holds a load the van takes it down the road; it is the boss\'s six days later, when it arrives', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  T.purse(calder, f).dirty = 2 * VAN[0] + 30;
  const had = f.dirty;
  const left = cash(g);
  assert.deepStrictEqual(left.map((e) => [e.step, e.from, e.to, e.amount, e.days, e.van]), [['leaves', 'calder', 'ashport', VAN[0], ROAD, 'calder']], 'one van, one load');
  assert.strictEqual(calder.coffer.dirty, VAN[0] + 30);
  for (let i = 1; i < ROAD; i++) assert.deepStrictEqual(cash(g), [], 'the van is on the road: nothing else leaves (day ' + i + ')');
  assert.ok(f.dirty < had + VAN[0], 'not his yet');
  const before = f.dirty, next = cash(g);
  assert.deepStrictEqual(next.map((e) => [e.step, e.from, e.to, e.amount]), [['arrives', 'calder', 'ashport', VAN[0]], ['leaves', 'ashport', 'calder', 0]], 'it unloads and drives back empty');
  assert.ok(next[1].empty && next[1].days === ROAD);
  assert.ok(f.dirty >= before + VAN[0] - 600, 'it is in the purse (less the day\'s own spending)');
  assert.ok(!g.journal.some((l) => l.type === 'convoy'), 'for the screen, not for the journal');
});

test('the van leaves again only once it is back', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  T.purse(calder, f).dirty = 2 * VAN[0] + 30;
  let leaves = [];
  for (let d = 0; d < 2 * ROAD + 1; d++) cash(g).forEach((e) => { if (e.step === 'leaves' && !e.empty) leaves.push(d); });
  assert.deepStrictEqual(leaves, [0, 2 * ROAD]);
  assert.strictEqual(calder.coffer.dirty, 30);
});

test('a bigger headquarters has a bigger van: it takes all that waits, up to its load', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  T.open(calder, 3, 3, { owner: 'family', kind: 'club', capo: 'dutch' });
  T.raiseHq(calder, 'family'); T.sizeHq(calder, 'family', 3);
  T.purse(calder, f).clean = VAN[2] + 500;
  assert.deepStrictEqual(cash(g).filter((e) => e.step === 'leaves').map((e) => e.amount), [VAN[2]]);
  const v = E.view(g).cities.find((c) => c.id === 'calder').coffer;
  assert.strictEqual(v.load, VAN[2]);
  assert.strictEqual(v.van, 'away');
  const h = start(), small = city(h, 'calder');
  T.purse(small, h.family).clean = VAN[0] + 200;
  assert.deepStrictEqual(cash(h).map((e) => e.amount), [VAN[0]], 'a back room has the small one');
  const k = start();
  T.purse(city(k, 'calder'), k.family).clean = VAN[0] * 3;
  T.open(city(k, 'calder'), 3, 3, { owner: 'family', kind: 'club', capo: 'dutch' });
  T.raiseHq(city(k, 'calder'), 'family'); T.sizeHq(city(k, 'calder'), 'family', 4);
  assert.deepStrictEqual(cash(k).map((e) => e.amount), [VAN[0] * 3], 'a big van does not wait to be full');
});

test('less than a car\'s load waits in the coffer', () => {
  const g = start(), calder = city(g, 'calder');
  T.purse(calder, g.family).dirty = LOAD - 1;
  assert.deepStrictEqual(cash(g), []);
  assert.strictEqual(calder.coffer.dirty, LOAD - 1);
  assert.strictEqual(E.view(g).cities.find((c) => c.id === 'calder').coffer.van, 'home');
});

test('clean money travels the same way and arrives clean', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  f.clean = 0;
  T.purse(calder, f).clean = LOAD;
  assert.strictEqual(cash(g)[0].clean, LOAD);
  for (let i = 0; i < ROAD; i++) day(g);
  assert.strictEqual(f.clean, LOAD);
});

test('from a city two roads away the van takes twelve days, six a road', () => {
  const g = start(), f = g.family, where = far();
  f.clean = 0;
  T.purse(city(g, where.far), f).clean = LOAD;
  const seen = [];
  for (let d = 0; d <= 2 * ROAD; d++) cash(g).forEach((e) => seen.push([d, e.step, e.from, e.to, e.amount]));
  assert.deepStrictEqual(seen, [
    [0, 'leaves', where.far, where.mid, LOAD],
    [ROAD, 'leaves', where.mid, 'ashport', LOAD],
    [2 * ROAD, 'arrives', where.far, 'ashport', LOAD],
    [2 * ROAD, 'leaves', 'ashport', where.mid, 0],
  ]);
  assert.strictEqual(f.clean, LOAD);
});

test('the money on the road is told to the screen, and kept through a save', () => {
  const g = start(), calder = city(g, 'calder');
  T.purse(calder, g.family).dirty = LOAD;
  day(g); day(g);
  const want = [['calder', 'ashport', LOAD, ROAD, 1, 'calder']];
  assert.deepStrictEqual(E.view(g).onRoad.map((r) => [r.from, r.to, r.amount, r.days, r.gone, r.van]), want);
  const back = E.load(E.save(g));
  assert.deepStrictEqual(E.view(back).onRoad.map((r) => [r.from, r.to, r.amount, r.days, r.gone, r.van]), want);
});
