// A capo does not wait for a day of his own: the money is his when the car comes back, and he moves the day he can pay.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;
const DAYS = T.RULES.days;

const dutch = (cash) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 2 });
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  f.men.dutch.cash = cash;
  return { c, f };
};
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
// one cycle day by day; `each(d, events)` sees what every day brought
const cycle = (c, f, each) => {
  const out = [...T.begin(f, [c])];
  for (let d = 0; d < DAYS; d++) {
    const ev = T.pass(f, [c], d);
    if (T.dayOf('dutch') === d) ev.push(...T.act(f, [c], 'dutch'));
    if (each) each(d, ev);
    out.push(...ev);
  }
  out.push(...T.end(f, [c], []));
  return out;
};

test('a capo who has the money sets out for his place that very day, whatever his day of the cycle', () => {
  const { c, f } = dutch(5000);
  assert.ok(T.dayOf('dutch') > 0);
  T.begin(f, [c]);
  const ev = T.pass(f, [c], 0), opened = ev.filter((e) => (e.type === 'errand' && e.step === 'leaves') || e.type === 'moving');
  assert.equal(opened.length, 1);
  assert.equal(opened[0].capo, 'dutch');
  assert.ok(f.men.dutch.cash < 5000);
});

test('he makes one move at a time: he sets out again the day he is there, if he still can', () => {
  const { c, f } = dutch(50000);
  T.begin(f, [c]);
  const out = (ev) => ev.filter((e) => (e.type === 'errand' && e.step === 'leaves') || e.type === 'moving');
  const first = out(T.pass(f, [c], 0));
  assert.equal(first.length, 1);
  for (let d = 1; d < first[0].days; d++) assert.equal(out(T.pass(f, [c], d)).length, 0, 'he is on the road');
  const there = T.pass(f, [c], first[0].days);
  assert.equal(there.filter((e) => e.type === 'opened').length, 1);
  assert.equal(out(there).length, 1);
});

test('the money of a car is his the day it comes back: the boss has his share and the men their pay at once', () => {
  const { c, f } = dutch(0);
  cycle(c, f);
  let seen = 0;
  cycle(c, f, (d, ev) => {});
  T.begin(f, [c]);
  for (let d = 0; d < DAYS && d < T.dayOf('dutch'); d++) {
    const cash = f.men.dutch.cash, dirty = f.dirty, spent = sum(f.men.dutch.paid || {});
    const got = T.pass(f, [c], d).filter((e) => e.type === 'run' && !e.lost).reduce((n, r) => n + r.amount, 0);
    if (got > 0 && sum(f.men.dutch.paid || {}) === spent) { seen++; assert.ok(f.men.dutch.cash > cash, 'day ' + d); assert.ok(f.dirty > dirty, 'day ' + d); assert.ok(f.men.dutch.cash - cash < got); }
  }
  assert.ok(seen > 0);
});

test('day by day his books still add up at every count, moves made in between included', () => {
  const { c, f } = dutch(3000);
  let was = f.men.dutch.cash, spent = 0;
  for (let i = 0; i < 24; i++) {
    T.begin(f, [c]);
    for (let d = 0; d < DAYS; d++) {
      T.pass(f, [c], d);
      if (T.dayOf('dutch') !== d) continue;
      T.act(f, [c], 'dutch');
      const b = f.men.dutch.book;
      assert.ok(Math.abs(was + b.made - b.wages - b.sent - sum(b.spent) - b.saved) < 1e-6, 'cycle ' + i + ': ' + JSON.stringify(b) + ' was ' + was);
      assert.ok(Math.abs(b.put - (b.saved - was)) < 1e-6);
      spent += sum(b.spent);
      was = f.men.dutch.cash;
    }
    T.end(f, [c], []);
  }
  assert.ok(spent > 0);
});

test('his men are never paid more than his places brought in over a cycle', () => {
  const { c, f } = dutch(0);
  for (let i = 0; i < 12; i++) {
    cycle(c, f);
    const b = f.men.dutch.book;
    assert.ok(b.wages <= Math.max(0, b.made - T.RULES.club) + 1e-6, JSON.stringify(b)); // (his first count comes before a full cycle of his club)
    assert.ok(f.men.dutch.cash >= 0);
  }
});

test('in the game, places open on many different days of the cycle', () => {
  const days = new Set();
  for (const start of ['dutch', 'sal', 'mae']) {
    const g = E.createGame({ capo: start });
    for (let i = 0; i < DAYS * 120; i++) {
      const d = g.ticks;
      E.tick(g).forEach((e) => { if (e.type === 'opened' || e.type === 'enlarged') days.add(d); });
      g.paused = false;
    }
    assert.ok(g.journal.some((l) => l.type === 'opened'));
  }
  assert.ok(days.size >= 5, 'moves on days ' + [...days].join(', '));
});
