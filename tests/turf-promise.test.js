// A promise: when a capo asks for a key place he says what it will bring in, and some months after it is his the boss is told whether he was right.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');

const P = T.RULES.promise;
// Dutch and his six gambling rooms around the Grand Hotel (or another key place), which the Callahans hold. He asks for it the first month.
const asking = (key) => {
  const { c, f } = H.sixBars(true);
  T.open(c, 2, 4, { owner: 'Callahan', kind: 'key', key: key || 'hotel' });
  f.dirty = 50000;
  T.stepMonth(c, f);
  return { c, f, ask: T.view(c, f).asks[0] };
};
test('a capo who asks for a key place that lifts earnings says how much more the city will make a month, and when he will be judged', () => {
  const { c, ask } = asking('hotel');
  assert.ok(ask.expects, 'he gives a figure');
  assert.ok(ask.expects.gain > 0);
  assert.equal(ask.expects.months, ask.months + P.after);
  // the figure is what the place is worth as things stand, coloured by the man: Dutch is ambitious and oversells a little
  const honest = T.keyWorth(c, 2, 4), said = Math.round(honest * (1 + (T.person('dutch').ambition - 50) * P.boast / 100));
  assert.equal(ask.expects.gain, said);
});

test('a key place that brings no money in (City Hall, the precinct) comes with no figure', () => {
  assert.equal(asking('cityhall').ask.expects, null);
  assert.equal(asking('precinct').ask.expects, null);
});

test('nothing is promised until the boss says yes; then the promise is listed until the day it is judged', () => {
  const { c, f, ask } = asking('hotel');
  assert.deepEqual(T.view(c, f).promises, []);
  T.answer(c, f, ask.id, true);
  const p = T.view(c, f).promises;
  assert.equal(p.length, 1);
  assert.deepEqual([p[0].capo, p[0].key, p[0].name, p[0].expected, p[0].months], ['dutch', 'hotel', 'Grand Hotel', ask.expects.gain, ask.expects.months]);
  T.stepMonth(c, f);
  assert.equal(T.view(c, f).promises[0].months, ask.expects.months - 1);
});

test('a refusal promises nothing', () => {
  const { c, f, ask } = asking('hotel');
  T.answer(c, f, ask.id, false);
  assert.deepEqual(T.view(c, f).promises, []);
});

const judged = (spoil) => {
  const { c, f, ask } = asking('hotel');
  T.answer(c, f, ask.id, true);
  let e = null;
  for (let m = 0; m < ask.expects.months + 2 && !e; m++) {
    if (spoil && m === ask.months + 1) spoil(c);
    e = T.stepMonth(c, f).find((x) => x.type === 'promise') || null;
  }
  return { c, f, ask, e };
};

test('when the day comes the boss is told what the place really brings in, and whether the capo\'s word held', () => {
  const { c, f, ask, e } = judged();
  assert.ok(e, 'the promise was judged');
  assert.deepEqual([e.city, e.capo, e.kind, e.key, e.x, e.y, e.expected], ['town', 'dutch', 'key', 'hotel', 2, 4, ask.expects.gain]);
  assert.equal(e.actual, Math.round(T.keyWorth(c, 2, 4)));
  assert.equal(e.kept, e.actual >= e.expected * P.near);
  assert.match(e.label, /Grand Hotel/);
  assert.deepEqual(T.view(c, f).promises, [], 'and it is no longer pending');
});

test('a capo who lost half his rooms in the meantime did not keep his word', () => {
  const { e, ask } = judged((c) => { for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 3]]) delete c.blocks[x + ',' + y]; T.touch(c); });
  assert.ok(e.actual < ask.expects.gain * P.near);
  assert.equal(e.kept, false);
  assert.match(e.label, /not/);
});

test('through the game: the request shown to the boss carries the figure', () => {
  const g = E.createGame({ capo: 'dutch' });
  const c = g.cities[0];
  c.asks.push({ id: 'ashport:hotel', capo: 'dutch', key: 'hotel', x: 0, y: 0, way: 'buy', cost: 0, months: 1, why: 'test', expects: { gain: 123, months: 1 + P.after } });
  assert.deepEqual(E.view(g).cities[0].asks[0].expects, { gain: 123, months: 1 + P.after });
});
