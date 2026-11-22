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

test('when a coffer holds a load a car takes it down the road; it is the boss\'s the day after, when it arrives', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  T.purse(calder, f).dirty = 2 * LOAD + 30;
  const had = f.dirty;
  const left = day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash');
  assert.deepStrictEqual(left.map((e) => [e.step, e.from, e.to, e.amount]), [['leaves', 'calder', 'ashport', LOAD]], 'one car a day, one load');
  assert.strictEqual(calder.coffer.dirty, LOAD + 30);
  assert.ok(f.dirty < had + LOAD, 'not his yet');
  const before = f.dirty, next = day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash');
  const in1 = next.find((e) => e.step === 'arrives');
  assert.deepStrictEqual([in1.from, in1.to, in1.amount], ['calder', 'ashport', LOAD]);
  assert.ok(f.dirty >= before + LOAD - 600, 'it is in the purse (less the day\'s own spending)');
  assert.ok(next.some((e) => e.step === 'leaves'), 'and the next car leaves');
  assert.ok(!g.journal.some((l) => l.type === 'convoy'), 'for the screen, not for the journal');
});

test('less than a load waits in the coffer', () => {
  const g = start(), calder = city(g, 'calder');
  T.purse(calder, g.family).dirty = LOAD - 1;
  assert.deepStrictEqual(day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash'), []);
  assert.strictEqual(calder.coffer.dirty, LOAD - 1);
});

test('clean money travels the same way and arrives clean', () => {
  const g = start(), f = g.family, calder = city(g, 'calder');
  f.clean = 0;
  T.purse(calder, f).clean = LOAD;
  const left = day(g).find((e) => e.type === 'convoy' && e.cargo === 'cash');
  assert.strictEqual(left.clean, LOAD);
  day(g);
  assert.strictEqual(f.clean, LOAD);
});

test('from a city two roads away the car takes two days, one road a day', () => {
  const g = start(), f = g.family, where = far();
  f.clean = 0;
  T.purse(city(g, where.far), f).clean = LOAD;
  const d1 = day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash');
  assert.deepStrictEqual(d1.map((e) => [e.step, e.from, e.to]), [['leaves', where.far, where.mid]]);
  const d2 = day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash');
  assert.deepStrictEqual(d2.map((e) => [e.step, e.from, e.to]), [['leaves', where.mid, 'ashport']]);
  assert.strictEqual(f.clean, 0);
  const d3 = day(g).filter((e) => e.type === 'convoy' && e.cargo === 'cash');
  assert.deepStrictEqual(d3.map((e) => [e.step, e.to]), [['arrives', 'ashport']]);
  assert.strictEqual(f.clean, LOAD);
});

test('the money on the road is told to the screen, and kept through a save', () => {
  const g = start(), calder = city(g, 'calder');
  T.purse(calder, g.family).dirty = LOAD;
  day(g);
  assert.deepStrictEqual(E.view(g).onRoad.map((r) => [r.from, r.to, r.amount]), [['calder', 'ashport', LOAD]]);
  const back = E.load(E.save(g));
  assert.deepStrictEqual(E.view(back).onRoad.map((r) => [r.from, r.to, r.amount]), [['calder', 'ashport', LOAD]]);
});
