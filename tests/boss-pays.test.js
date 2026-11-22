// What the boss pays is physical: the money is set aside at his headquarters when he gives the order, the armoured
// van of the headquarters drives it to where it is owed, one load a trip, and the order takes effect when the last
// load arrives. The van is the only limit: while it is on the road nothing else of the boss's leaves.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');

const GIFT = T.RULES.loyal.gift, VAN = T.RULES.van.loads;
const start = (reached) => {
  const g = E.createGame({ capo: 'vince' }); g.reign.left = 1e9; g.reign.reached = reached || 0;
  g.family.clean = 5000; g.family.dirty = 0;
  const c = g.cities[0];
  return { g, c, f: g.family, hq: T.hqOf(c, 'family'), club: T.clubOf(c, 'vince') };
};
const day = (g) => { g.paused = false; return E.tick(g); };
const pays = (es) => es.filter((e) => e.type === 'payment');
const mood = (g) => E.view(g).cities[0].capos[0].mood;
const gift = (g) => E.command(g, { type: 'gift', city: 'ashport', capo: 'vince' });

test('a gift is set aside at once, leaves in the van, and warms the man only when it has all arrived', () => {
  const { g, f, hq, club } = start(3); // a mansion: the van takes it in one load
  const far = T.tripDays(hq, club);
  gift(g);
  assert.strictEqual(f.clean, 5000 - GIFT, 'set aside the day of the order');
  assert.strictEqual(mood(g), 'restless', 'he has seen nothing yet');
  assert.ok(!g.journal.some((l) => l.type === 'gift'));
  const p = E.view(g).paying;
  assert.deepStrictEqual(p.map((q) => [q.order, q.city, q.capo, q.x, q.y, q.amount, q.sent, q.arrived]), [['gift', 'ashport', 'vince', club.x, club.y, GIFT, 0, 0]]);
  const left = pays(day(g));
  assert.deepStrictEqual(left.map((e) => [e.step, e.order, e.city, e.from, e.x, e.y, e.amount, e.days, e.van]),
    [['leaves', 'gift', 'ashport', { x: hq.x, y: hq.y }, club.x, club.y, GIFT, far, 'ashport']]);
  for (let i = 1; i < far; i++) assert.deepStrictEqual(pays(day(g)), []);
  const there = pays(day(g));
  assert.deepStrictEqual(there.map((e) => [e.step, e.amount]), [['arrives', GIFT]]);
  assert.strictEqual(mood(g), 'steady');
  assert.ok(g.journal.some((l) => l.type === 'gift'), 'it is told when it is done');
  assert.ok(f.clean <= 5000 - GIFT + 1, 'and it was paid once');
  assert.deepStrictEqual(E.view(g).paying, []);
});

test('a small headquarters makes several trips: the order waits for the last load, and each vehicle for its way back', () => {
  const { g, hq, club } = start(0); // a back room
  const far = T.tripDays(hq, club), loads = Math.ceil(GIFT / VAN[0]), cars = T.RULES.van.count[0];
  assert.deepStrictEqual(T.RULES.van.count, [2, 3, 4, 6], 'the vehicles of the boss\'s headquarters, by its size');
  assert.ok(loads > cars);
  gift(g);
  const seen = [];
  for (let d = 0; d <= 2 * far * Math.floor((loads - 1) / cars) + far; d++) pays(day(g)).forEach((e) => seen.push([d, e.step, e.amount]));
  const want = [];
  for (let n = 0; n < loads; n++) {
    const amount = Math.min(VAN[0], GIFT - n * VAN[0]), leaves = 2 * far * Math.floor(n / cars);
    want.push([leaves, 'leaves', amount], [leaves + far, 'arrives', amount]);
  }
  const order = (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || b[2] - a[2];
  assert.deepStrictEqual(seen.sort(order), want.sort(order));
  assert.strictEqual(mood(g), 'steady');
});

test('each load on the road has its own vehicle', () => {
  const { g } = start(0);
  gift(g);
  const left = pays(day(g)).filter((e) => e.step === 'leaves');
  assert.deepStrictEqual(left.map((e) => e.vehicle), ['ashport:van:0', 'ashport:van:1']);
});

test('the same order is not taken twice while its money is on the road', () => {
  const { g } = start(3);
  gift(g);
  assert.strictEqual(E.view(g).cities[0].capos[0].gift.paying, true, 'his card says a gift is on its way');
  assert.throws(() => gift(g), /already on its way/);
});

test('an order the boss cannot pay is refused as before, and nothing leaves', () => {
  const { g, f } = start(3);
  f.clean = 0;
  assert.throws(() => gift(g), /clean money to make Vince a gift/);
  assert.deepStrictEqual(E.view(g).paying, []);
});

test('what is on the road is kept through a save, and the journal does not hear of the van', () => {
  const { g } = start(0);
  gift(g); day(g);
  const back = E.load(E.save(g));
  assert.deepStrictEqual(E.view(back).paying, E.view(g).paying);
  assert.strictEqual(E.view(g).paying[0].sent, VAN[0] * T.RULES.van.count[0]);
  assert.ok(!g.journal.some((l) => l.type === 'payment'));
  for (let i = 0; i < 60; i++) { day(g); day(back); }
  assert.strictEqual(mood(back), 'steady');
  assert.deepStrictEqual(E.view(back).paying, []);
});
