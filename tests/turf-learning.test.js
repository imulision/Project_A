// What the family and its men learn: the building tree, bigger cars, the abilities a capo gains with rank.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, ALL = H.ALL, year = H.year, family = H.family, siege = H.siege, rich = H.rich, coming = H.coming, laundry = H.laundry,
  kept = H.kept, sixBars = H.sixBars, brewer = H.brewer, placeAt = H.placeAt, hauls = H.hauls, weed = H.weed, exposed = H.exposed, until = H.until;

// --- the building tree: what the family knows how to run, learned with clean money ---

test('a new family knows the liquor trade and nothing else', () => {
  const f = T.createFamily();
  assert.deepEqual(Object.keys(f.tech).filter((k) => f.tech[k] > 0).sort(), ['cars', 'rented', 'speakeasy', 'still', 'warehouse'], 'four trades, and the cars to carry the money');
  assert.deepEqual([f.dirty, f.clean, f.study], [0, 0, null]);
  const tree = T.tree(f);
  assert.equal(tree.length, Object.keys(T.TERRAIN).length + 1, 'every trade, and the cars');
  const still = tree.find((t) => t.kind === 'still'), loans = tree.find((t) => t.kind === 'loans');
  assert.deepEqual([still.tier, still.next.tier, still.next.cost, still.next.months], [1, 2, T.RULES.learn.cost[1], T.RULES.learn.months[1]]);
  assert.deepEqual([loans.tier, loans.next.tier, loans.next.cost], [0, 1, T.RULES.learn.cost[0]]);
  assert.equal(loans.name, D.SITES.loans.name);
});

test('the boss pays clean money, waits, and the family knows one tier more', () => {
  const f = T.createFamily(), c = town();
  assert.throws(() => T.research(f, 'loans'), /clean/);
  f.clean = T.RULES.learn.cost[0] + 5;
  assert.throws(() => T.research(f, 'casino'), /unknown/);
  T.research(f, 'loans');
  assert.equal(f.clean, 5);
  assert.throws(() => T.research(f, 'still'), /already/);
  assert.equal(T.tree(f).find((t) => t.kind === 'loans').studying, T.RULES.learn.months[0]);
  let learned = null;
  for (let i = 0; i < T.RULES.learn.months[0]; i++) {
    assert.equal(f.tech.loans, 0);
    learned = T.month(f, [c]).find((e) => e.type === 'learned') || learned;
  }
  assert.equal(f.tech.loans, 1);
  assert.deepEqual([learned.kind, learned.tier], ['loans', 1]);
  assert.equal(f.study, null);
  assert.equal(c.month, T.RULES.learn.months[0], 'and the city lived those months');
});

test('a man of the family who likes the trade teaches it in half the time', () => {
  const f = T.createFamily();
  f.clean = 1e6;
  T.join(f, 'sal');
  T.research(f, 'loans');
  assert.equal(f.study.monthsLeft, T.RULES.learn.months[0] / 2);
});

test('nothing goes beyond the third tier', () => {
  const f = T.createFamily();
  f.tech.still = 3; f.clean = 1e6;
  assert.equal(T.tree(f).find((t) => t.kind === 'still').next, null);
  assert.throws(() => T.research(f, 'still'), /nothing more/);
});

test('each capo says which closed trade he would open first, and never one he refuses', () => {
  const f = T.createFamily(), c = town();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.settle(c, 'dutch', 8, 2); T.join(f, 'dutch');
  T.settle(c, 'mae', 5, 4); T.join(f, 'mae');
  const w = T.wishes(c, f), of = (id) => w.find((q) => q.capo === id);
  assert.equal(of('sal').kind, 'loans');
  assert.equal(of('mae').kind, 'front');
  assert.equal(of('dutch').kind, 'fence', 'his first trades are open: he asks for the next he likes');
  f.tech.loans = 1;
  assert.equal(T.wishes(c, f).find((q) => q.capo === 'sal'), undefined, 'Sal likes nothing else that is closed');
  assert.equal(T.tree(f).find((t) => t.kind === 'front').wanted.join(), 'mae');
});

test('a rented laundry washes too: less than an owned front, and it keeps more', () => {
  const play = (kind) => {
    const { c, f } = laundry(0);
    T.open(c, 3, 2, { owner: 'family', kind, capo: 'mae' });
    f.dirty = 50000;
    T.stepMonth(c, f);
    return { washed: T.washing(c).washed, kept: 1 - f.clean / T.washing(c).washed };
  };
  const rented = play('rented'), front = play('front');
  assert.ok(rented.washed > 0 && rented.washed < front.washed);
  assert.ok(Math.abs(rented.kept - D.SITES.rented.loss) < 1e-9 && Math.abs(front.kept - D.SITES.front.loss) < 1e-9);
});

test('when dirty money piles up in the boss\'s safe, a capo opens a laundry before anything else', () => {
  const next = (dirty) => {
    const c = town(), f = T.createFamily();
    T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
    T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
    T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
    f.dirty = dirty;
    return T.plan(c, f, 'dutch');
  };
  assert.notEqual(next(0).kind, 'rented');
  const p = next(T.RULES.stash * 2);
  assert.equal(p.kind, 'rented');
  assert.match(p.why, /wash/);
});

test('Sal also comes to a family that keeps getting burnt out: it needs him', () => {
  const c = town(), f = rich();
  T.settle(c, 'mae', 2, 2); T.join(f, 'mae');
  assert.ok(!coming(c, f).includes('sal'));
  c.burnt = 2;
  const d = T.doors(c, f).find((q) => q.capo === 'sal');
  assert.match(d.why, /burn/);
  assert.equal(d.cost, T.RULES.doors.need, 'and he comes for less: he is the one who gains');
  assert.ok(T.RULES.doors.need < T.RULES.doors.name);
  assert.equal(T.createCity({ id: 'x', w: 1, h: 1, zones: [] }).burnt, 0);
});

test('clean money pays for anything dirty money pays for, once the dirty runs out', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  const cost = T.doors(c, f)[0].cost;
  f.dirty = 100; f.clean = cost;
  assert.equal(T.funds(f), 100 + cost);
  T.welcome(c, f, 'danny', 7, 4);
  assert.deepEqual([f.dirty, f.clean], [0, 100]);
  const s = siege();
  T.open(s.c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.stepMonth(s.c, s.f);
  const ask = T.asks(s.c)[0];
  s.f.dirty = 0; s.f.clean = ask.cost + 1;
  T.answer(s.c, s.f, ask.id, true);
  assert.equal(s.f.clean, 1);
});

// --- bigger cars are learned by the family, like a trade ---
test('the family tree has a line for cars: three sizes, the first one known from the start', () => {
  const f = T.createFamily();
  const cars = T.tree(f).find((t) => t.kind === 'cars');
  assert.deepEqual([cars.name, cars.tier, cars.gives], ['Cars', 1, 'A car carries $' + T.RULES.car.loads[1] + ' a run']);
  assert.deepEqual(cars.next, { tier: 2, cost: T.RULES.learn.cost[1], months: T.RULES.learn.months[1], gives: 'A car carries $' + T.RULES.car.loads[2] + ' a run' });
  assert.equal(T.RULES.car.loads[1], T.RULES.car.load);
  assert.ok(T.RULES.car.loads[1] < T.RULES.car.loads[2] && T.RULES.car.loads[2] < T.RULES.car.loads[3]);
});

test('once the family has learned bigger cars, every run carries the bigger load', () => {
  const { c, f } = sixBars();
  f.clean = 99999; f.study = null;
  T.research(f, 'cars');
  assert.equal(f.clean, 99999 - T.RULES.learn.cost[1]);
  let learned = null;
  for (let m = 0; m < 12 && !learned; m++) learned = T.month(f, [c]).find((e) => e.type === 'learned');
  assert.deepEqual([learned.kind, learned.tier], ['cars', 2]);
  assert.match(learned.label, /cars that carry \$250 a run/);
  T.month(f, [c]);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.ok(runs.length > 0 && runs.every((t) => t.amount === T.RULES.car.loads[2]));
  assert.equal(T.tree(f).find((t) => t.kind === 'cars').tier, 2);
});

test('a capo whose tills are left full asks for bigger cars, and that halves the time it takes', () => {
  const { c, f } = sixBars();
  assert.deepEqual(T.tree(f).find((t) => t.kind === 'cars').wanted, []);
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  assert.ok(f.men.dutch.stuck);
  const cars = T.tree(f).find((t) => t.kind === 'cars');
  assert.deepEqual(cars.wanted, ['dutch']);
  assert.equal(cars.next.months, T.RULES.learn.months[1] * T.RULES.learn.taught);
  const wish = T.wishes(c, f).find((w) => w.kind === 'cars');
  assert.deepEqual([wish.capo, wish.name], ['dutch', 'Cars']);
  assert.match(wish.label, /Dutch wants bigger cars/);
});

test('there is nothing bigger than the biggest car', () => {
  const f = T.createFamily(); f.tech.cars = 3; f.clean = 99999;
  assert.equal(T.tree(f).find((t) => t.kind === 'cars').next, null);
  assert.throws(() => T.research(f, 'cars'), /nothing more to learn about Cars/);
});

// --- a man learns his trade: at each rank a capo gains an ability of his school, and it shows in the streets ---
const ranked = (f, capo, rank) => { f.men[capo].rank = rank; f.men[capo].xp = T.RULES.xp[rank]; };

const able = (f, capo) => T.abilities(f, capo).filter((a) => a.has).map((a) => a.id);

test('every capo belongs to a school, and gains one named ability at each rank after Soldier', () => {
  const f = family();
  for (const [id, school] of [['sal', 'Muscle'], ['dutch', 'Liquor'], ['mae', 'Money'], ['tommy', 'Law'], ['vince', 'Vice'], ['danny', 'Games']]) {
    T.join(f, id);
    const all = T.abilities(f, id);
    assert.equal(all.length, 3, id);
    assert.ok(all.every((a) => a.school === school && a.name && a.gives && !a.has), id + ' is of ' + school);
    assert.deepEqual(all.map((a) => a.rank), [1, 2, 3]);
  }
  ranked(f, 'sal', 2);
  assert.deepEqual(able(f, 'sal'), ['escorts', 'hard']);
  const ids = [].concat(...Object.keys(T.SCHOOLS).map((s) => T.SCHOOLS[s].map((a) => a.id)));
  assert.equal(new Set(ids).size, 18, 'eighteen abilities, no two alike');
});

test('the month he rises, the journal says what he has learned, and his card shows it', () => {
  const { c, f } = sixBars();
  f.men.dutch.xp = T.RULES.xp[1] - 1;
  const e = T.stepMonth(c, f).find((x) => x.type === 'rank');
  assert.equal(e.ability, 'nightruns');
  assert.equal(e.label, 'Dutch rises to Capo: he can now run ' + T.RULES.reach[1] + ' places, and learns Night runs');
  assert.deepEqual(T.view(c, f).capos[0].abilities.filter((a) => a.has).map((a) => a.name), ['Night runs']);
});

test('Muscle: escorted loads are never held up, hard streets stand where they burnt, and nobody raids a feared man', () => {
  const held = (rank) => { const { c, f } = exposed('walt'); ranked(f, 'walt', rank); return until(c, f, 'hijack', 8); };
  assert.ok(held(0), 'a Soldier of little grip is held up');
  assert.equal(held(1), null);
  const raid = (rank) => {
    const c = town(), f = family();
    T.settle(c, 'walt', 3, 3); T.join(f, 'walt'); ranked(f, 'walt', rank);
    f.men.walt.cash = -100000;
    T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'walt' });
    T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
    const seen = year(c, f, 24).filter((e) => e.type === 'burnt' || e.type === 'repelled').map((e) => e.type);
    return { seen, muscle: T.cover(c, 5, 3).muscle };
  };
  assert.equal(raid(2).muscle, raid(1).muscle + 2, 'a Veteran\'s streets are hard: two points of Muscle more against a raid');
  assert.ok(raid(2).seen.includes('repelled'));
  assert.deepEqual(raid(3).seen, [], 'as a Legend nobody comes at all');
});

test('Liquor: night runs give each truck two more runs, deep cellars keep twice as much, the house label sells dearer', () => {
  const runs = (rank) => {
    const { c, f } = brewer(6, { level: 3 });
    T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 });
    ranked(f, 'dutch', rank); f.men.dutch.cash = 0;
    T.stepMonth(c, f); T.stepMonth(c, f);
    return hauls(c, f).length;
  };
  assert.equal(runs(0), T.RULES.truck.runs);
  assert.equal(runs(1), T.RULES.truck.runs + 2);
  const cellar = (rank) => {
    const { c, f } = brewer(0);
    ranked(f, 'dutch', rank);
    for (let m = 0; m < 8; m++) T.stepMonth(c, f);
    return placeAt(c, f, 8, 2).stock;
  };
  assert.equal(cellar(2), 2 * cellar(1));
  const bar = (rank) => {
    const { c, f } = brewer(1);
    ranked(f, 'dutch', rank);
    T.stepMonth(c, f);
    return T.earns(c, placeAt(c, f, 1, 1));
  };
  assert.ok(Math.abs(bar(3) / bar(2) - 1.15) < 1e-6);
});

test('Money: tight books cut what his men cost, double ledgers wash more, a silent partner keeps half as much for himself', () => {
  const books = (rank) => {
    const c = town(), f = family();
    T.settle(c, 'mae', 2, 2); T.join(f, 'mae'); kept(c, 'mae'); ranked(f, 'mae', rank);
    T.open(c, 1, 1, { owner: 'family', kind: 'front', capo: 'mae' });
    T.open(c, 3, 1, { owner: 'family', kind: 'front', capo: 'mae' });
    T.open(c, 2, 1, { owner: 'family', kind: 'gambling', capo: 'mae', level: 3 }); // a room that brings in more than her men cost
    for (const k of Object.keys(f.tech)) f.tech[k] = 0;
    return { c, f };
  };
  const cost = (rank) => { const { c, f } = books(rank); f.men.mae.cash = 0; T.stepMonth(c, f); return f.men.mae.income - c.flow.sent.mae - f.men.mae.cash; };
  assert.ok(Math.abs(cost(1) / cost(0) - 0.85) < 1e-6, 'wages ' + cost(0) + ' then ' + cost(1));
  const wash = (rank) => { const { c, f } = books(rank); T.stepMonth(c, f); return T.washing(c).most; };
  assert.ok(Math.abs(wash(2) / wash(1) - 1.25) < 1e-6);
  const keeps = (rank, xp) => {
    const c = town(), f = family({ dirty: 0 });
    T.settle(c, 'mae', 2, 2); T.join(f, 'mae'); kept(c, 'mae');
    f.men.mae.rank = rank; f.men.mae.xp = xp;
    for (const k of Object.keys(f.tech)) f.tech[k] = 0;
    f.men.mae.cash = T.RULES.pocket + 1000;
    T.stepMonth(c, f);
    return c.flow.sent.mae;
  };
  const spare = (rank) => keeps(rank, T.RULES.xp[rank]); // what goes up the month he has $1,000 he cannot use
  const base = T.RULES.club * T.RULES.tribute;
  assert.ok(Math.abs(spare(2) - base - (1000 - base + T.RULES.club) * (1 - T.RULES.keeps[2])) < 1, 'a Veteran keeps what his rank allows');
  assert.ok(Math.abs(spare(3) - base - (1000 - base + T.RULES.club) * (1 - T.RULES.keeps[3] / 2)) < 1, 'a Legend who is a silent partner keeps half of it');
});

const solo = (capo, rank, places) => {
  const c = town(), f = family();
  T.settle(c, capo, 2, 2); T.join(f, capo); kept(c, capo); ranked(f, capo, rank);
  places.forEach(([kind, x, y, more]) => T.open(c, x, y, Object.assign({ owner: 'family', kind, capo }, more)));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  f.men[capo].cash = 0;
  return { c, f };
};

const paid = (capo, rank, kind, x, y) => { const { c, f } = solo(capo, rank, [[kind, x, y]]); T.stepMonth(c, f); return T.earns(c, placeAt(c, f, x, y)); };

test('Law: friends downtown see his trucks through, envelopes make a take cheaper, the judge cools his city', () => {
  const stopped = (rank) => {
    const { c, f } = solo('tommy', rank, [['still', 8, 2], ['speakeasy', 1, 1]]);
    c.heat = T.RULES.road.heat + 20;
    return !!T.stepMonth(c, f).find((e) => e.type === 'seizure');
  };
  assert.deepEqual([stopped(0), stopped(1)], [true, false]);
  const take = (rank) => {
    const { c, f } = solo('tommy', rank, []);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
    T.stepMonth(c, f);
    const w = T.wants(c, 'tommy', { rank, tech: ALL() });
    assert.equal(w.move, 'take');
    return w.cost;
  };
  assert.ok(Math.abs(take(2) / take(1) - 0.75) < 0.01);
  const cools = (rank) => { const { c, f } = solo('tommy', rank, []); c.heat = 50; T.stepMonth(c, f); return 50 - c.heat; };
  assert.equal(cools(3), cools(2) + 1);
});

test('Vice: regulars pay more, house dealers double what weed brings, a big harvest doubles what a loft grows', () => {
  assert.ok(Math.abs(paid('vince', 1, 'brothel', 1, 1) / paid('vince', 0, 'brothel', 1, 1) - 1.15) < 1e-6);
  assert.ok(Math.abs(paid('vince', 1, 'loft', 8, 2) / paid('vince', 0, 'loft', 8, 2) - 1.15) < 1e-6);
  const grown = (rank) => {
    const { c, f } = solo('vince', rank, [['loft', 8, 2], ['speakeasy', 1, 1]]);
    T.stepMonth(c, f);
    return weed(c, f).length + (placeAt(c, f, 8, 2).stock || 0) / T.RULES.weed.load;
  };
  const bare = (rank) => { const { c, f } = solo('vince', rank, [['speakeasy', 1, 1]]); T.stepMonth(c, f); return T.earns(c, placeAt(c, f, 1, 1)); };
  const lift = (rank) => { const { c, f } = solo('vince', rank, [['loft', 8, 2], ['speakeasy', 1, 1]]); T.stepMonth(c, f); return T.earns(c, placeAt(c, f, 1, 1)) / bare(rank); };
  assert.ok(Math.abs(lift(1) - (1 + T.RULES.weed.bonus)) < 1e-6);
  assert.ok(Math.abs(lift(2) - (1 + 2 * T.RULES.weed.bonus)) < 1e-6);
  assert.equal(grown(3), 2 * grown(2));
});

test('Games: the house edge, markers that pay, and a back room that hides the boss\'s money', () => {
  assert.ok(Math.abs(paid('danny', 1, 'gambling', 1, 1) / paid('danny', 0, 'gambling', 1, 1) - 1.15) < 1e-6);
  assert.ok(Math.abs(paid('danny', 2, 'loans', 1, 1) / paid('danny', 1, 'loans', 1, 1) - 1.25) < 1e-6);
  const heat = (rank, dirty) => { const { c, f } = solo('danny', rank, []); f.dirty = dirty; c.heat = 20; T.stepMonth(c, f); return c.heat > 20; };
  const over = T.RULES.stash + 1500;
  assert.deepEqual([heat(2, over), heat(3, over), heat(3, over + 2000)], [true, false, true], 'his back room hides $2,000 more of the boss\'s dirty money from the police');
});
