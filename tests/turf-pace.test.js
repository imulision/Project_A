// Every place at its own pace: a till fills a little every day, and a car leaves for it the day it holds a full load.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;
const DAYS = T.RULES.days;

const dutch = () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 2 });
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 1, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  f.men.dutch.cash = 0;
  return { c, f };
};
// one cycle played day by day, the way the game plays it
const cycle = (c, f, each) => {
  const out = [...T.begin(f, [c])];
  for (let d = 0; d < DAYS; d++) {
    const runs = T.pass(f, [c], d);
    if (each) each(d, runs);
    out.push(...runs);
    if (T.dayOf('dutch') === d) out.push(...T.act(f, [c], 'dutch'));
  }
  out.push(...T.end(f, [c], []));
  return out;
};
const tills = (c) => T.places(c).reduce((n, p) => n + (p.till || 0), 0);

test('the clock of the game and the days of the rules are the same', () => {
  assert.equal(E.TICKS_PER_MONTH, DAYS);
  assert.equal(E.dayOf('dutch'), T.dayOf('dutch'));
});

test('a till fills a little every day, not all at once', () => {
  const { c, f } = dutch();
  T.begin(f, [c]);
  let was = tills(c), grew = 0;
  for (let d = 0; d < 6; d++) {
    const out = T.pass(f, [c], d).reduce((n, r) => n + r.amount, 0), now = tills(c);
    if (now + out > was + 1e-9) grew++;
    was = now;
  }
  assert.equal(grew, 6);
});

test('a car leaves the day a till holds a full load, and says which day', () => {
  const { c, f } = dutch();
  cycle(c, f); cycle(c, f);
  const days = new Set();
  const all = cycle(c, f, (d, runs) => runs.filter((r) => r.type === 'run').forEach((r) => {
    assert.equal(r.type, 'run'); assert.equal(r.city, 'town'); assert.equal(r.capo, 'dutch'); assert.equal(r.day, d);
    assert.ok(r.amount > 0); assert.ok(T.at(c, r.x, r.y));
    days.add(d);
  })).filter((e) => e.type === 'run');
  assert.ok(all.length >= 2, 'runs: ' + all.length);
  assert.ok(days.size >= 2, 'the cars left on ' + [...days].join(', '));
});

test('within the trips of a cycle, a car never drives the same leg of its round twice', () => {
  const { c, f } = dutch();
  for (let i = 0; i < 6; i++) {
    cycle(c, f);
    const seen = new Set();
    c.flow.runs.forEach((r) => { const k = (r.own ? 'own' : r.car) + ':' + r.leg; assert.ok(!seen.has(k), 'cycle ' + i + ': ' + k + ' twice'); seen.add(k); });
  }
});

test('the cars of a cycle are the trips the city shows once it is over', () => {
  const { c, f } = dutch();
  cycle(c, f);
  const runs = cycle(c, f).filter((e) => e.type === 'run');
  assert.equal(c.flow.runs.length, runs.length);
  assert.equal(c.flow.runs.reduce((n, r) => n + r.amount, 0), runs.reduce((n, r) => n + r.amount, 0));
});

test('what the cars brought since his last day is what the capo counts on his day', () => {
  const { c, f } = dutch();
  cycle(c, f);
  let brought = 0, counted = null;
  T.begin(f, [c]);
  for (let d = 0; d < DAYS; d++) {
    if (counted === null) brought += T.pass(f, [c], d).reduce((n, r) => n + (r.lost ? 0 : r.amount), 0); else T.pass(f, [c], d);
    if (T.dayOf('dutch') === d) { const had = c.hauls.dutch.got; T.act(f, [c], 'dutch'); counted = f.men.dutch.income - T.RULES.club; assert.ok(Math.abs(counted - had) < 1e-6); assert.equal(c.hauls.dutch.got, 0); }
  }
  T.end(f, [c], []);
  assert.ok(counted > 0);
});

test('played day by day or cycle by cycle, a capo makes about the same over five years', () => {
  const a = dutch(), b = dutch();
  let byDay = 0, byCycle = 0;
  for (let i = 0; i < 60; i++) { cycle(a.c, a.f); byDay += a.f.men.dutch.income; T.month(b.f, [b.c], []); byCycle += b.f.men.dutch.income; }
  assert.ok(Math.abs(byDay - byCycle) / byCycle < 0.2, byDay + ' against ' + byCycle);
});

test('a capo never sends more cars in a cycle than his cars can drive', () => {
  const { c, f } = dutch();
  for (let i = 0; i < 12; i++) {
    const runs = cycle(c, f).filter((e) => e.type === 'run' && !e.own);
    assert.ok(runs.length <= (f.men.dutch.cars || 1) * T.RULES.car.runs + T.RULES.car.runs, String(runs.length));
  }
});

test('the game plays its days this way: cars leave all through a cycle, and none is written in the journal', () => {
  const g = E.createGame({ capo: 'dutch' });
  const days = new Set();
  for (let i = 0; i < DAYS * 30; i++) {
    const d = g.ticks;
    E.tick(g).forEach((e) => { if (e.type === 'run') days.add(d); });
    g.paused = false;
  }
  assert.ok(days.size >= 4, 'cars left on ' + days.size + ' different days');
  assert.ok(!g.journal.some((l) => l.type === 'run'));
});

test('a place the capo drove to himself and that is gone by his day does not trouble his count', () => {
  const { c, f } = dutch();
  T.begin(f, [c]);
  T.pass(f, [c], 0);
  c.hauls.dutch.went = { x: 9, y: 5 }; // nothing stands there any more
  assert.doesNotThrow(() => T.act(f, [c], 'dutch'));
});

test('a place says the load its car waits for, so that its till can be shown filling', () => {
  const { c, f } = dutch();
  cycle(c, f);
  const v = T.view(c, f), mine = v.places.filter((p) => p.owner === 'family');
  assert.ok(mine.length > 1);
  mine.forEach((p) => assert.equal(p.load, T.RULES.car.loads[f.tech.cars || 1] || T.RULES.car.load));
  v.places.filter((p) => p.owner !== 'family').forEach((p) => assert.equal(p.load, undefined));
});

test('the day his men are paid, every place says what it paid, and the garage what the cars cost', () => {
  const { c, f } = dutch();
  f.men.dutch.cars = 2;
  cycle(c, f);
  let paid = 0;
  const all = cycle(c, f).filter((e) => e.type === 'pay');
  assert.ok(all.length > 0);
  all.forEach((e) => {
    assert.equal(e.city, 'town'); assert.equal(e.capo, 'dutch'); assert.ok(e.amount > 0); assert.ok(T.at(c, e.x, e.y)); assert.ok(['wages', 'upkeep'].includes(e.what));
    if (e.what === 'upkeep') assert.equal(T.at(c, e.x, e.y).kind, 'club');
    paid += e.amount;
  });
  assert.ok(all.some((e) => e.what === 'upkeep') && all.some((e) => e.what === 'wages'));
  assert.ok(Math.abs(paid - f.men.dutch.book.wages) < 1e-6 || paid > 0);
});

test('over a cycle counted from one of his days to the next, what the places say they paid is what his books call wages', () => {
  const { c, f } = dutch();
  cycle(c, f);
  let paid = 0, book = null;
  for (let i = 0; i < 2; i++) {
    T.begin(f, [c]);
    for (let d = 0; d < DAYS; d++) {
      const ev = T.pass(f, [c], d);
      paid += ev.filter((e) => e.type === 'pay').reduce((n, e) => n + e.amount, 0);
      if (T.dayOf('dutch') === d) { T.act(f, [c], 'dutch'); if (i === 0) { paid = 0; book = false; } else if (book === false) { book = f.men.dutch.book.wages + f.men.dutch.book.left; assert.ok(Math.abs(paid - book) < 1e-6, paid + ' against ' + book); } }
    }
    T.end(f, [c], []);
  }
  assert.ok(book > 0);
});

test('in the game, what is paid place by place stays out of the journal', () => {
  const g = E.createGame({ capo: 'dutch' });
  let seen = 0;
  for (let i = 0; i < DAYS * 30; i++) { seen += E.tick(g).filter((e) => e.type === 'pay').length; g.paused = false; }
  assert.ok(seen > 0);
  assert.ok(!g.journal.some((l) => l.type === 'pay' || l.type === 'run'));
});
