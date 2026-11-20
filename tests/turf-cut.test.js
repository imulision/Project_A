// The boss's share: light, normal or heavy, city by city. A heavy hand fills the boss's pocket now and wears his men's loyalty down.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

// Dutch with a speakeasy that earns, and a family that opens nothing new.
const bar = (cut) => {
  const c = town(), f = family({ dirty: 0, clean: 0 });
  f.tech = {};
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 2 });
  f.men.dutch.cash = 0;
  if (cut) T.cut(c, cut);
  return { c, f };
};

test('a city starts on the normal share, and the boss can make it light or heavy', () => {
  const { c, f } = bar();
  assert.equal(T.view(c, f).cut, 'normal');
  assert.deepEqual(T.view(c, f).cuts.map((k) => k.id), ['light', 'normal', 'heavy']);
  assert.equal(T.view(c, f).cuts[1].share, T.RULES.tribute);
  T.cut(c, 'heavy');
  assert.equal(T.view(c, f).cut, 'heavy');
  assert.throws(() => T.cut(c, 'all of it'), /no such share: all of it/);
});

test('the first month, a heavy share sends more up than a normal one, and a light share less', () => {
  const sent = {};
  for (const cut of ['light', 'normal', 'heavy']) { const { c, f } = bar(cut); T.stepMonth(c, f); sent[cut] = c.flow.sent.dutch; }
  assert.ok(sent.normal > 0);
  assert.ok(sent.heavy > sent.normal * 1.3, 'heavy ' + sent.heavy + ' against ' + sent.normal);
  assert.ok(sent.light < sent.normal * 0.7, 'light ' + sent.light + ' against ' + sent.normal);
});

test('what the boss takes, the capo does not have: under a light share he is the richer man', () => {
  const light = bar('light'), heavy = bar('heavy');
  T.stepMonth(light.c, light.f); T.stepMonth(heavy.c, heavy.f);
  assert.ok(light.f.men.dutch.cash > heavy.f.men.dutch.cash);
});

test('a heavy share wears a man\'s loyalty down to a lower level and no further; a light one lifts it; back to normal, time mends it', () => {
  const born = T.person('dutch').loyalty, K = T.RULES.cut;
  const heavy = bar('heavy'), light = bar('light');
  for (let i = 0; i < 40; i++) { T.stepMonth(heavy.c, heavy.f); T.stepMonth(light.c, light.f); }
  assert.equal(T.loyalty(heavy.f, 'dutch'), born + K.heavy.loyal);
  assert.equal(T.loyalty(light.f, 'dutch'), Math.min(100, born + K.light.loyal));
  assert.ok(K.heavy.loyal < 0 && K.light.loyal > 0);
  T.cut(heavy.c, 'normal');
  for (let i = 0; i < 40; i++) T.stepMonth(heavy.c, heavy.f);
  assert.equal(T.loyalty(heavy.f, 'dutch'), born);
});

test('a man who was only just steady turns restless under a heavy share', () => {
  const { c, f } = bar('heavy');
  f.men.dutch.loyal = T.RULES.loyal.restless + 3;
  const mood = () => T.view(c, f).capos[0].mood;
  assert.equal(mood(), 'steady');
  for (let i = 0; i < 40; i++) T.stepMonth(c, f);
  assert.equal(mood(), 'restless');
});

test('the boss sets a city\'s share through an order, only where the family has a man, and the journal says so', () => {
  const g = E.createGame({ capo: 'dutch' });
  E.command(g, { type: 'cut', city: 'ashport', cut: 'heavy' });
  assert.equal(E.view(g).cities[0].cut, 'heavy');
  const line = g.journal[g.journal.length - 1];
  assert.deepEqual([line.type, line.city, line.cut], ['cut', 'ashport', 'heavy']);
  assert.match(line.label, /heavy/i);
  assert.throws(() => E.command(g, { type: 'cut', city: 'calder', cut: 'heavy' }), /the family has no man in Calder Falls/);
  assert.throws(() => E.command(g, { type: 'cut', city: 'ashport', cut: 'more' }), /no such share/);
  assert.equal(E.view(E.load(E.save(g))).cities[0].cut, 'heavy');
});
