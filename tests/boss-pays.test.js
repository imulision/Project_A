// What the boss pays is physical: the money is set aside at his headquarters when he gives the order, the armoured
// van of the headquarters drives it to where it is owed, one load a trip, and the order takes effect when the last
// load arrives. The van is the only limit: while it is on the road nothing else of the boss's leaves.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');

T.RULES.van.loads = [600, 1500, 4000, 10000]; // vans small enough for a gift to take several trips
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

// --- what the family learns and what it buys for good is paid the same way ---
const keyAt = (c, key) => T.keys(c).filter((k) => k.key === key)[0];
const learnable = (g) => E.view(g).tree.filter((t) => t.next && t.kind !== 'cars')[0];

test('the money to learn a trade is driven to the club of a man of the family: the study starts when it is all there', () => {
  const { g, f, hq, club } = start(3);
  const t = learnable(g), far = T.tripDays(hq, club);
  E.command(g, { type: 'research', building: t.kind });
  assert.strictEqual(f.clean, 5000 - t.next.cost, 'set aside the day of the order');
  assert.ok(!f.study, 'nothing is learned yet');
  assert.deepStrictEqual(E.view(g).paying.map((q) => [q.order, q.city, q.capo, q.x, q.y, q.amount]), [['research', 'ashport', 'vince', club.x, club.y, t.next.cost]]);
  assert.strictEqual(E.view(g).tree.filter((q) => q.kind === t.kind)[0].paying, true, 'the tree says its money is on its way');
  for (let i = 0; i < far; i++) { assert.ok(!f.study); day(g); }
  day(g);
  assert.strictEqual(f.study.kind, t.kind);
  assert.ok(g.journal.some((l) => l.type === 'studying'));
  assert.ok(!E.view(g).tree.some((q) => q.paying));
});

test('one thing is learned at a time: nothing else can be ordered while the money of a study is on the road', () => {
  const { g, f } = start(3);
  const all = E.view(g).tree.filter((t) => t.next && t.kind !== 'cars');
  E.command(g, { type: 'research', building: all[0].kind });
  const had = f.clean;
  assert.throws(() => E.command(g, { type: 'research', building: all[1].kind }), /already paying to learn/);
  assert.strictEqual(f.clean, had);
});

test('what the family buys for good is paid at City Hall: it is the family\'s when the last load is in', () => {
  const { g, f, c, hq } = start(3);
  f.clean = 20000;
  const hall = keyAt(c, 'cityhall'), far = T.tripDays(hq, hall), cost = T.RULES.holdings.lawyer.cost[0];
  E.command(g, { type: 'buy', holding: 'lawyer' });
  assert.strictEqual(f.clean, 20000 - cost);
  assert.deepStrictEqual(E.view(g).paying.map((q) => [q.order, q.city, q.x, q.y, q.amount]), [['buy', 'ashport', hall.x, hall.y, cost]]);
  const own = () => E.view(g).holdings.filter((h) => h.id === 'lawyer')[0];
  assert.deepStrictEqual([own().level, own().paying], [0, true]);
  assert.throws(() => E.command(g, { type: 'buy', holding: 'lawyer' }), /already on its way/);
  for (let i = 0; i <= far; i++) day(g);
  assert.deepStrictEqual([own().level, own().paying], [1, undefined]);
  assert.ok(g.journal.some((l) => l.type === 'bought'));
});
