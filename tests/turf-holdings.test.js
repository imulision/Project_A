// What clean money buys for good: a law firm, a judge, a newspaper, a shipping company. Each comes in three sizes and stays with the family.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const K = T.RULES.holdings;
// Dutch alone with his club, and a family that opens nothing new.
const quiet = (more) => {
  const c = town(), f = family(Object.assign({ dirty: 0, clean: 0 }, more));
  f.tech = {};
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  return { c, f };
};
const owning = (id, level, more) => { const q = quiet(more); q.f.holdings = { [id]: level }; return q; };

test('the family can buy four things that last, each in three sizes, dearer every time', () => {
  const { f } = quiet({ clean: 1e6 });
  const list = T.holdings(f);
  assert.deepEqual(list.map((h) => h.id), ['lawyer', 'judge', 'paper', 'company']);
  for (const h of list) {
    assert.equal(h.level, 0); assert.equal(h.most, 3);
    assert.ok(h.name && h.gives);
    assert.deepEqual(h.next, { level: 1, cost: K[h.id].cost[0] });
    assert.ok(K[h.id].cost[0] < K[h.id].cost[1] && K[h.id].cost[1] < K[h.id].cost[2]);
  }
});

test('it is paid in clean money, it stays, and after the third size there is nothing more to buy', () => {
  const { f } = quiet({ clean: K.judge.cost[0] + K.judge.cost[1] + K.judge.cost[2] + 5, dirty: 1e6 });
  T.buy(f, 'judge');
  assert.equal(f.clean, K.judge.cost[1] + K.judge.cost[2] + 5);
  assert.equal(T.holdings(f)[1].level, 1);
  assert.deepEqual(T.holdings(f)[1].next, { level: 2, cost: K.judge.cost[1] });
  T.buy(f, 'judge'); T.buy(f, 'judge');
  assert.equal(f.clean, 5);
  assert.equal(T.holdings(f)[1].next, null);
  assert.throws(() => T.buy(f, 'judge'), /nothing more to buy/);
  assert.throws(() => T.buy(f, 'lawyer'), new RegExp('it takes \\' + T.dollars(K.lawyer.cost[0]) + ' of clean money'));
  assert.equal(f.dirty, 1e6, 'dirty money buys none of it');
  assert.throws(() => T.buy(f, 'senator'), /nothing of that name to buy: senator/);
});

test('a law firm: when the police raid the counting rooms they seize less, size after size', () => {
  const seized = [0, 1, 2, 3].map((level) => {
    const { c, f } = owning('lawyer', level, { dirty: 10000 });
    c.heat = 100;
    return T.stepMonth(c, f).find((e) => e.type === 'bust').seized;
  });
  assert.ok(seized[0] > seized[1] && seized[1] > seized[2] && seized[2] > seized[3] && seized[3] > 0, seized.join(' '));
});

test('a judge: the heat of every city falls faster', () => {
  const after = [0, 1, 3].map((level) => { const { c, f } = owning('judge', level); c.heat = 50; T.stepMonth(c, f); return c.heat; });
  assert.equal(after[0], 50 - T.RULES.cools);
  assert.equal(after[1], 50 - T.RULES.cools - K.judge.cools);
  assert.equal(after[2], 50 - T.RULES.cools - 3 * K.judge.cools);
});

test('a newspaper: blood in the streets draws the police less', () => {
  const rise = [0, 2].map((level) => {
    const s = H.siege(); s.f.holdings = { paper: level }; s.c.heat = 20;
    let most = 0;
    for (let i = 0; i < 24; i++) { const before = s.c.heat; T.stepMonth(s.c, s.f); most = Math.max(most, s.c.heat - before); }
    return most;
  });
  assert.ok(rise[0] > 0, 'there was blood');
  assert.ok(rise[1] < rise[0], rise.join(' '));
});

test('a shipping company: more dirty money can sleep in its books before the police notice', () => {
  const sleepy = T.RULES.stash + 1000;
  const plain = quiet({ dirty: sleepy }), owner = owning('company', 1, { dirty: sleepy });
  plain.c.heat = owner.c.heat = 10;
  T.stepMonth(plain.c, plain.f); T.stepMonth(owner.c, owner.f);
  assert.ok(plain.c.heat > 10, 'money that sleeps draws the police');
  assert.ok(owner.c.heat < 10, 'not when it sleeps in the company\'s books');
  assert.ok(K.company.hides > 1000);
});

test('the boss buys through an order; the screen is told what he owns; it is saved with the game', () => {
  const g = E.createGame({ capo: 'dutch' });
  assert.throws(() => E.command(g, { type: 'buy', holding: 'paper' }), /clean money/);
  g.family.clean = K.paper.cost[0];
  E.command(g, { type: 'buy', holding: 'paper' });
  const mine = (game) => E.view(game).holdings.find((h) => h.id === 'paper');
  assert.deepEqual([mine(g).level, mine(g).paying, g.family.clean], [0, true, 0], 'set aside, and on its way to City Hall');
  for (let i = 0; i < 400 && E.view(g).paying.length; i++) { g.paused = false; E.tick(g); }
  assert.equal(mine(g).level, 1);
  assert.equal(g.family.clean, 0);
  const line = g.journal.filter((l) => l.type === 'bought').pop();
  assert.deepEqual([line.type, line.holding, line.level, line.cost], ['bought', 'paper', 1, K.paper.cost[0]]);
  assert.ok(line.label.includes(K.paper.name));
  assert.equal(mine(E.load(E.save(g))).level, 1);
});
