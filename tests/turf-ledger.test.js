// The books of a capo: what his places made, what his men cost, what he sent up, what he spent and on what, and what he has left.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const dutch = (cash) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  f.men.dutch.cash = cash;
  return { c, f };
};
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('every month a capo\'s books add up: what he made, less his men, less what went up, less what he spent, is what his purse moved by', () => {
  const { c, f } = dutch(3000);
  for (let i = 0; i < 24; i++) {
    const was = f.men.dutch.cash;
    T.stepMonth(c, f);
    const b = f.men.dutch.book;
    assert.equal(b.made, f.men.dutch.income);
    assert.ok(Math.abs(b.sent - c.flow.sent.dutch) < 1e-6);
    assert.ok(Math.abs(b.saved - f.men.dutch.cash) < 1e-6);
    assert.ok(Math.abs(was + b.made - b.wages - b.sent - sum(b.spent) - b.saved) < 1e-6, 'month ' + c.month + ': ' + JSON.stringify(b));
    assert.ok(Math.abs(b.put - (b.saved - was)) < 1e-6);
  }
});

test('what he spent is told by what it was for', () => {
  const { c, f } = dutch(5000);
  const seen = {};
  for (let i = 0; i < 36; i++) {
    const events = T.stepMonth(c, f), b = f.men.dutch.book;
    for (const e of events) {
      const on = { opened: 'open', enlarged: 'enlarge', converted: 'convert', moving: 'take', car: 'car', truck: 'truck' }[e.type];
      if (!on || e.capo !== 'dutch') continue;
      seen[on] = true;
      assert.ok(b.spent[on] >= e.cost, on + ': ' + JSON.stringify(b.spent) + ' against ' + e.cost);
    }
    if (!events.length) assert.deepEqual(Object.keys(b.spent).filter((k) => k !== 'himself'), [], 'a month with nothing bought'); // (what a big man spends on himself is another line)
  }
  assert.ok(seen.open, 'he opened something');
});

test('the capo\'s sheet shows his books in whole dollars, and how many months his plan is from being paid', () => {
  const { c, f } = dutch(0);
  for (let i = 0; i < 6; i++) T.stepMonth(c, f);
  const k = T.view(c, f).capos[0], b = k.book;
  assert.deepEqual(Object.keys(b).sort(), ['made', 'put', 'saved', 'sent', 'spent', 'wages']);
  for (const n of [b.made, b.wages, b.sent, b.saved, b.put]) assert.equal(n, Math.round(n));
  assert.equal(k.plan.waiting, 'money');
  assert.ok(k.pace > 0, 'what he puts aside a month, over the last six');
  assert.equal(k.plan.monthsLeft, Math.ceil((k.plan.cost - k.plan.saved) / k.pace));
  f.men.dutch.cash = 50000;
  assert.equal(T.view(c, f).capos[0].plan.monthsLeft, 0, 'he has the money');
});

test('a capo who puts nothing aside has no date to give', () => {
  const { c, f } = dutch(0);
  T.stepMonth(c, f);
  f.men.dutch.puts = [0, -20, 0];
  const k = T.view(c, f).capos[0];
  assert.equal(k.pace, 0);
  assert.equal(k.plan.monthsLeft, null);
});

test('a man who has just arrived has empty books', () => {
  const { c, f } = dutch(600);
  assert.deepEqual(T.view(c, f).capos[0].book, { made: 0, wages: 0, sent: 0, spent: {}, saved: 600, put: 0 });
});

test('the city says what each trade put in the tills this month', () => {
  const { c, f } = dutch(0);
  T.stepMonth(c, f);
  const made = T.view(c, f).trades;
  assert.ok(made.speakeasy > 0);
  assert.equal(made.club, T.RULES.club, 'the club makes its own');
  assert.equal(made.loans, undefined, 'a trade the family does not run is not listed');
  for (const k of Object.keys(made)) assert.equal(made[k], Math.round(made[k]));
});

test('the game keeps the family\'s money lines and every capo\'s books month after month', () => {
  const g = E.createGame({ capo: 'dutch' });
  for (let i = 0; i < 12 * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
  const v = E.view(g), last = v.history[v.history.length - 1], a = v.cities[0];
  assert.deepEqual(Object.keys(last.money).sort(), ['cut', 'hijacked', 'pay', 'seized', 'up', 'washed']);
  assert.equal(last.money.up, Math.round(g.cities.reduce((n, c) => n + ((c.flow && c.flow.up) || 0), 0)));
  assert.deepEqual(last.trades, a.trades, '(one city held: the family\'s trades are that city\'s)');
  const k = last.cities.ashport.capos.dutch, b = a.capos[0].book;
  assert.deepEqual([k.made, k.wages, k.sent, k.spent, k.saved], [b.made, b.wages, b.sent, Object.values(b.spent).reduce((x, y) => x + y, 0), b.saved]);
  assert.deepEqual(k.spentOn, b.spent);
  assert.equal(k.income, a.capos[0].income, 'what was there stays');
});

test('the savings a capo puts into a place the boss helps him pay for are in his books the month after', () => {
  const c = town(), f = family({ dirty: 0, clean: 0 });
  T.settle(c, 'sal', 0, 0); T.join(f, 'sal'); f.men.sal.rank = 3; c.rival = 'Callahan'; c.quiet = 999;
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) T.open(c, x, y, { owner: 'family', kind: 'loans', capo: 'sal', level: 3 });
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
  for (let i = 0; i <= T.RULES.patience.months; i++) { f.men.sal.cash = Math.min(f.men.sal.cash, 300); T.stepMonth(c, f); }
  const a = T.asks(c)[0], had = f.men.sal.cash;
  f.dirty = 20000;
  T.answer(c, f, a.id, true);
  const put = had - f.men.sal.cash;
  assert.ok(put > 0);
  T.stepMonth(c, f);
  assert.ok(Math.abs(f.men.sal.book.spent.take - put) < 1e-6);
});
