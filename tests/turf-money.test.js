// Money: dirty and clean, wages, what can be followed, and what goes up to the boss.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, ALL = H.ALL, family = H.family, ashport = H.ashport, siege = H.siege, rich = H.rich, laundry = H.laundry, sixBars = H.sixBars;

// --- two kinds of money: dirty money must be washed, and it draws the police while it sleeps ---

test('a front washes the boss\'s dirty money into clean money, for a cut', () => {
  const { c, f } = laundry(1);
  f.dirty = 200;
  T.stepMonth(c, f);
  const tribute = f.dirty + f.clean / (1 - D.SITES.front.loss) - 200; // what Mae sent up this month, all still dirty or washed
  assert.ok(f.clean > 0, 'some money came out clean');
  assert.ok(f.dirty < 200 + tribute, 'and left the dirty pile');
  assert.ok(Math.abs(T.washing(c).washed * (1 - D.SITES.front.loss) - f.clean) < 0.01, 'the cut stays with the front');
});

test('a front only washes so much a month, and a bigger front washes more', () => {
  const small = laundry(1), big = laundry(3);
  small.f.dirty = big.f.dirty = 50000;
  T.stepMonth(small.c, small.f); T.stepMonth(big.c, big.f);
  assert.equal(T.washing(small.c).washed, T.washing(small.c).most);
  assert.ok(T.washing(big.c).most > T.washing(small.c).most * 2);
  assert.ok(big.f.clean > small.f.clean);
});

test('without a front nothing is washed', () => {
  const { c, f } = laundry(0);
  f.dirty = 5000;
  T.stepMonth(c, f);
  assert.equal(f.clean, 0);
  assert.deepEqual(T.washing(c), { washed: 0, most: 0 });
});

test('a man is paid by his rank: dirty money first, clean money if it must, and he says so when there is neither', () => {
  const { c, f } = laundry(0);
  f.men.mae.rank = 2;
  const pay = T.RULES.pay[2];
  f.dirty = pay; f.clean = pay;
  let events = T.stepMonth(c, f);
  assert.ok(f.dirty < pay && f.clean === pay, 'paid in dirty money');
  assert.ok(!events.some((e) => e.type === 'unpaid'));
  f.dirty = 0; f.clean = pay;
  events = T.stepMonth(c, f);
  assert.ok(f.clean < pay, 'then in clean');
  f.dirty = 0; f.clean = 0; f.men.mae.cash = -1e6; // her club's tribute cannot cover it
  events = T.stepMonth(c, f);
  assert.ok(events.some((e) => e.type === 'unpaid' && e.capo === 'mae'));
  assert.equal(T.RULES.pay[0], 0, 'a Soldier lives off his streets');
});

test('dirty money that sleeps in the boss\'s safe heats the city; an empty safe lets it cool', () => {
  const { c, f } = laundry(0);
  f.dirty = T.RULES.stash * 3;
  T.stepMonth(c, f); T.stepMonth(c, f);
  const hot = c.heat;
  assert.ok(hot > 0);
  f.dirty = 0;
  T.stepMonth(c, f);
  assert.ok(c.heat < hot);
  for (let i = 0; i < 100; i++) { f.dirty = 0; T.stepMonth(c, f); }
  assert.equal(c.heat, 0);
});

test('when the heat boils over the police seize half the dirty money', () => {
  const { c, f } = laundry(0);
  let bust = null, before = 0;
  for (let i = 0; i < 200 && !bust; i++) {
    f.dirty = T.RULES.stash * 10; before = f.dirty;
    bust = T.stepMonth(c, f).find((e) => e.type === 'bust');
  }
  assert.ok(bust, 'it comes');
  assert.ok(Math.abs(bust.seized - f.dirty) < before * 0.1, 'about half is gone');
  assert.ok(f.dirty < before * 0.6);
  assert.ok(c.heat < 100 && c.heat > 0, 'and the city cools, for a while');
});

test('with the precinct in its pocket the family cools the city twice as fast', () => {
  const cool = (bought) => {
    const { c, f } = laundry(0);
    if (bought) T.open(c, 11, 5, { owner: 'family', kind: 'key', key: 'precinct', capo: 'mae' });
    c.heat = 50; f.dirty = 0;
    T.stepMonth(c, f);
    return 50 - c.heat;
  };
  assert.equal(cool(true), cool(false) * 2);
});

test('blood in the streets heats the city too', () => {
  const quiet = laundry(1), loud = laundry(1);
  T.open(loud.c, 4, 2, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  for (let i = 0; i < T.RULES.rivalEvery; i++) { quiet.f.dirty = loud.f.dirty = 0; T.stepMonth(quiet.c, quiet.f); T.stepMonth(loud.c, loud.f); }
  assert.equal(quiet.c.heat, 0);
  assert.ok(loud.c.heat > 0);
});

// --- a bigger family pays more ---

test('every man the family already counts makes the next one dearer, wherever he is', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  const price = () => T.doors(c, f).find((d) => d.capo === 'danny').cost;
  assert.equal(price(), T.RULES.doors.name, 'the second man costs the plain price');
  T.join(f, 'mae');
  assert.equal(price(), Math.round(T.RULES.doors.name * (1 + T.RULES.crowd) / 50) * 50);
  T.join(f, 'sal'); T.join(f, 'tommy');
  assert.equal(price(), Math.round(T.RULES.doors.name * Math.pow(1 + T.RULES.crowd, 3) / 50) * 50);
  f.dirty = price() - 1;
  assert.throws(() => T.welcome(c, f, 'danny', 7, 4), /cannot pay/);
});

test('every key place the family holds, in any city, makes the next one dearer', () => {
  const { c, f } = siege(), other = town();
  other.id = 'other';
  T.settle(other, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(other, 4, 4, { owner: 'family', kind: 'key', key: 'depot', capo: 'dutch' });
  T.open(other, 8, 4, { owner: 'family', kind: 'key', key: 'port', capo: 'dutch' });
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  const asked = T.month(f, [other, c]).find((e) => e.type === 'asks');
  assert.equal(f.crowns, 2);
  const plain = T.RULES.keyCost * T.RULES.take[asked.way].cost;
  assert.equal(asked.cost, Math.round(plain * Math.pow(1 + T.RULES.greed, 2) / 50) * 50);
  assert.equal(T.asks(c)[0].cost, asked.cost);
});

test('the bigger the man, the more he keeps: what a Soldier cannot use all goes up, a Legend sends a tenth', () => {
  const tribute = T.RULES.club * T.RULES.tribute, spare = 1000;
  const up = (rank) => {
    const c = town(), f = family({ dirty: 1000 });
    T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
    f.men.dutch.rank = rank; f.men.dutch.xp = T.RULES.xp[rank];
    for (const k of Object.keys(f.tech)) f.tech[k] = 0; // nothing he may open: all he has is spare
    f.men.dutch.cash = T.RULES.pocket + spare + tribute - T.RULES.club;
    T.stepMonth(c, f);
    return { sent: f.dirty - 1000 + T.RULES.pay[rank] - tribute, kept: f.men.dutch.cash };
  };
  assert.deepEqual(T.RULES.keeps, [0, 0.5, 0.75, 0.9]);
  assert.deepEqual([0, 1, 2, 3].map((r) => Math.round(up(r).sent)), [0, 1, 2, 3].map((r) => Math.round(spare * (1 - T.RULES.keeps[r]))));
  assert.equal(up(3).kept, up(0).kept, 'what he keeps he spends on himself: it does not pile up in his club');
});

test('nobody knows the first man in a new city: the rivals leave the family alone there for two years', () => {
  const quiet = (sent) => {
    const a = town(), b = ashport(), f = rich();
    b.id = 'next';
    T.crown(b, 'Kessler'); T.seed(b, 'Kessler', 30);
    T.settle(a, 'dutch', 2, 2); T.join(f, 'dutch');
    T.open(a, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
    const l = T.landing(b);
    if (sent) T.send(a, b, f, 'danny', l.x, l.y); else { T.settle(b, 'danny', l.x, l.y); T.join(f, 'danny'); }
    const raids = [];
    for (let m = 1; m <= 48; m++) for (const e of T.stepMonth(b, f)) if (e.type === 'burnt' || e.type === 'repelled') raids.push(m);
    return raids;
  };
  const known = quiet(false), fresh = quiet(true);
  assert.ok(known.length && known[0] <= T.RULES.respite, 'a man the city knows is raided within two years: month ' + known[0]);
  assert.ok(fresh.length, 'the peace does not last');
  assert.ok(fresh[0] > T.RULES.respite, 'first raid in month ' + fresh[0]);
  assert.equal(T.RULES.respite, 24);
});

// --- money that can be followed ---

test('every trip says how many dollars it carries, and they add up to what the city reports', () => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 3 });
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'dutch' });
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const trips = T.trips(c, f), sum = (kind) => trips.filter((t) => t.kind === kind).reduce((n, t) => n + t.amount, 0);
  const takings = trips.filter((t) => t.kind === 'takings');
  assert.ok(takings.length >= 2, 'one trip for every load fetched, even from the same place');
  assert.ok(takings.every((t) => t.amount === T.RULES.car.load && t.cargo === 'cash' && t.from.x === 3 && t.from.y === 2 && t.to.x === 2 && t.to.y === 2));
  assert.equal(sum('takings') + T.RULES.club, f.men.dutch.income, 'the takings are what reached his club');
  assert.equal(sum('wash'), Math.round(c.washed), 'the wash trips carry what was washed');
  assert.ok(sum('wash') > 0);
});

test('the city says what came up to the boss last month, man by man, and what went out', () => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'dutch' });
  f.men.dutch.rank = 1;
  const before = { dirty: f.dirty, clean: f.clean || 0 };
  T.stepMonth(c, f);
  const m = T.view(c, f).money, man = T.view(c, f).capos[0];
  assert.ok(m.up > 0);
  assert.equal(man.sent, m.up, 'one capo: all of it is his');
  assert.equal(m.pay, T.RULES.pay[1]);
  assert.equal(m.seized, 0);
  assert.ok(m.cut > 0 && m.washed > m.cut);
  assert.ok(Math.abs(f.dirty - (before.dirty + m.up - m.pay - m.washed)) < 1e-6, 'dirty: what came up, less the pay, less what went to the wash');
  assert.ok(Math.abs(f.clean - (before.clean + m.washed - m.cut)) < 1e-6, 'clean: what was washed, less the cut');
});

// --- what goes up to the boss: a share of everything the cars bring in, before the capo pays his men ---
test('a capo kicks up a share of his takings, even the month his men cost him all the rest', () => {
  const { c, f } = sixBars();
  f.men.dutch.cash = 500;
  T.stepMonth(c, f);
  const m = f.men.dutch, sent = c.flow.sent.dutch;
  assert.ok(m.income > 0);
  assert.ok(Math.abs(sent - T.RULES.tribute * m.income) < 1e-6, 'sent ' + sent + ' of ' + m.income);
});

test('a capo with an empty club sends up what he has and no more: he never owes the boss', () => {
  const { c, f } = sixBars();
  f.men.dutch.cash = -2000; // deep in the red
  T.stepMonth(c, f);
  assert.equal(c.flow.sent.dutch, 0);
});

test('no capo opens one more still when the family already makes more liquor than its bars pour', () => {
  const only = () => { const t = ALL(); for (const k of Object.keys(t)) t[k] = k === 'still' || k === 'rented' ? 3 : 0; return t; };
  const next = (stills) => {
    const c = town(); T.settle(c, 'sal', 8, 2);
    [[7, 1], [8, 1], [9, 1]].slice(0, stills).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'still', capo: 'sal' }));
    return T.wants(c, 'sal', { rank: 3, tech: only() }).kind;
  };
  assert.equal(next(0), 'still');
  assert.equal(next(2), 'rented', 'two stills and not one bar: he puts his money elsewhere');
});
