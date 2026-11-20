// Loyalty: what the boss does to a man moves it, his mood says where it stands, and a bitter man goes over to the rivals.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family, rich = H.rich, siege = H.siege, coming = H.coming;

const L = T.RULES.loyal;
const moodOf = (c, f, id) => T.view(c, f).capos.find((k) => k.id === id).mood;

// Dutch in the west, Vince in the east with a loft and a chop shop, the Callahans next to him, and a family that opens nothing new.
const pair = () => {
  const c = town(), f = rich();
  f.tech = {}; f.clean = 0;
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.settle(c, 'vince', 8, 3); T.join(f, 'vince');
  T.open(c, 9, 2, { owner: 'family', kind: 'loft', capo: 'vince' });
  T.open(c, 7, 4, { owner: 'family', kind: 'chopshop', capo: 'vince', level: 2 });
  T.open(c, 11, 5, { owner: 'Callahan', kind: 'speakeasy' });
  return { c, f };
};

test('a man comes with the loyalty he is known for, and his mood says where it stands', () => {
  const { c, f } = pair();
  assert.equal(T.loyalty(f, 'dutch'), T.person('dutch').loyalty);
  assert.equal(T.loyalty(f, 'vince'), 45);
  assert.equal(moodOf(c, f, 'dutch'), 'steady');
  assert.equal(moodOf(c, f, 'vince'), 'restless');
  f.men.vince.loyal = L.bitter - 1;
  assert.equal(moodOf(c, f, 'vince'), 'bitter');
  assert.equal(T.view(c, f).capos[0].loyal, undefined, 'the screen gets a mood, never the number');
});

test('time brings a man back to what he is: one point a month, up or down', () => {
  const { c, f } = pair();
  f.men.dutch.loyal = 40; f.men.vince.loyal = 60;
  T.stepMonth(c, f);
  assert.equal(T.loyalty(f, 'dutch'), 40 + L.heals);
  assert.equal(T.loyalty(f, 'vince'), 60 - L.heals);
  f.men.dutch.loyal = 55;
  T.stepMonth(c, f);
  assert.equal(T.loyalty(f, 'dutch'), 55);
});

test('the boss\'s word on a key place is remembered: yes warms the man who asked, no cools him', () => {
  for (const yes of [true, false]) {
    const { c, f } = siege();
    T.open(c, 9, 4, { owner: 'family', kind: 'loans', capo: 'sal' });
    T.open(c, 11, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
    T.stepMonth(c, f);
    const before = T.loyalty(f, 'sal');
    T.answer(c, f, T.asks(c)[0].id, yes);
    assert.equal(T.loyalty(f, 'sal'), before + (yes ? L.granted : -L.refused));
  }
});

test('the man the boss rules against in a feud loses loyalty, the other does not', () => {
  const { c, f } = pair();
  c.grudge = { 'dutch|vince': T.RULES.feud };
  T.stepMonth(c, f);
  const dutch = T.loyalty(f, 'dutch'), vince = T.loyalty(f, 'vince');
  T.rule(c, f, T.feuds(c)[0].id, 'dutch');
  assert.equal(T.loyalty(f, 'vince'), vince - L.lost);
  assert.equal(T.loyalty(f, 'dutch'), dutch);
});

test('a man who rises in rank is grateful', () => {
  const { c, f } = pair();
  f.men.vince.xp = T.RULES.xp[1] - 1;
  const events = T.stepMonth(c, f);
  assert.ok(events.some((e) => e.type === 'rank' && e.capo === 'vince'));
  assert.equal(T.loyalty(f, 'vince'), 45 + L.rank);
  assert.equal(T.loyalty(f, 'dutch'), 55);
});

test('loyalty never leaves 0 to 100', () => {
  const { c, f } = pair();
  f.men.vince.loyal = 2; f.dirty = 0;
  T.stepMonth(c, f);
  assert.ok(T.loyalty(f, 'vince') >= 0);
  f.men.dutch.loyal = 99; f.men.dutch.xp = T.RULES.xp[1] - 1; f.dirty = 5000;
  T.stepMonth(c, f);
  assert.ok(T.loyalty(f, 'dutch') <= 100);
});

test('a bitter man sends the boss nothing, and the first month word of it gets around', () => {
  const { c, f } = pair();
  T.stepMonth(c, f);
  assert.ok(c.flow.sent.vince > 0);
  f.men.vince.loyal = 5;
  const events = T.stepMonth(c, f);
  assert.equal(c.flow.sent.vince, 0);
  const e = events.find((x) => x.type === 'whispers');
  assert.deepEqual([e.capo, e.city, e.x, e.y], ['vince', 'town', 8, 3]);
  assert.equal(e.label, 'Word is that Vince talks to the Callahans');
  assert.ok(!T.stepMonth(c, f).some((x) => x.type === 'whispers'), 'said once');
});

test('left bitter long enough, he goes over to the rivals with everything he runs', () => {
  const { c, f } = pair();
  f.men.vince.loyal = 0;
  let events = [];
  for (let i = 0; i < L.turns - 1; i++) events = T.stepMonth(c, f);
  assert.ok(f.men.vince, 'still there the month before');
  events = T.stepMonth(c, f);
  const e = events.find((x) => x.type === 'betrayal');
  assert.deepEqual([e.capo, e.city, e.to, e.places, e.x, e.y], ['vince', 'town', 'Callahan', 2, 8, 3]);
  assert.equal(e.label, 'Vince goes over to the Callahans and takes his 2 places with him');
  assert.equal(f.men.vince, undefined);
  assert.equal(f.gone.vince, 'turned');
  assert.ok(!T.at(c, 8, 3), 'his club is closed');
  assert.deepEqual([T.at(c, 9, 2), T.at(c, 7, 4)].map((p) => [p.owner, p.kind, p.level, p.capo]), [['Callahan', 'loft', 1, undefined], ['Callahan', 'chopshop', 2, undefined]]);
  assert.ok(!T.view(c, f).capos.some((k) => k.id === 'vince'));
  assert.ok(!coming(c, f).includes('vince'), 'he does not knock again');
});

test('a bitter man who is won back in time stays, and the count starts again', () => {
  const { c, f } = pair();
  f.men.vince.loyal = 0;
  for (let i = 0; i < L.turns - 1; i++) T.stepMonth(c, f);
  f.men.vince.loyal = L.bitter + 5;
  T.stepMonth(c, f);
  f.men.vince.loyal = 0;
  const events = [];
  for (let i = 0; i < L.turns - 1; i++) events.push(...T.stepMonth(c, f));
  assert.ok(f.men.vince);
  assert.equal(events.filter((e) => e.type === 'whispers').length, 1, 'word gets around again');
});

test('the last capo of a city has nobody to go to war with: he stays, bitter', () => {
  const c = town(), f = rich();
  f.tech = {};
  T.settle(c, 'vince', 8, 3); T.join(f, 'vince').loyal = 0;
  T.open(c, 11, 5, { owner: 'Callahan', kind: 'speakeasy' });
  for (let i = 0; i < L.turns + 3; i++) assert.ok(!T.stepMonth(c, f).some((e) => e.type === 'betrayal'));
  assert.ok(f.men.vince);
});

test('the underboss who turns leaves the city without one', () => {
  const { c, f } = pair();
  T.underboss(c, f, 'vince');
  f.men.vince.loyal = 0;
  for (let i = 0; i < L.turns; i++) T.stepMonth(c, f);
  assert.equal(T.view(c, f).under, null);
});

test('the boss makes a man a gift in clean money: it warms him, once a year', () => {
  const { c, f } = pair();
  assert.throws(() => T.gift(c, f, 'vince'), new RegExp('it takes \\$' + L.gift + ' of clean money to make Vince a gift'));
  assert.throws(() => T.gift(c, f, 'sal'), /sal is not one of yours in town/);
  f.clean = L.gift + 100;
  T.gift(c, f, 'vince');
  assert.equal(f.clean, 100);
  assert.equal(T.loyalty(f, 'vince'), 45 + L.warms);
  f.clean = 50000;
  assert.throws(() => T.gift(c, f, 'vince'), /Vince has had his gift this year/);
  for (let i = 0; i < L.again; i++) T.stepMonth(c, f);
  T.gift(c, f, 'vince');
});

test('the screen reads what a gift costs and how long before the next one', () => {
  const { c, f } = pair();
  f.clean = 50000;
  assert.deepEqual(T.view(c, f).capos[1].gift, { cost: L.gift, wait: 0 });
  T.gift(c, f, 'vince');
  assert.deepEqual(T.view(c, f).capos[1].gift, { cost: L.gift, wait: L.again });
  T.stepMonth(c, f);
  assert.equal(T.view(c, f).capos[1].gift.wait, L.again - 1);
});

test('a killing shakes every man left in the city', () => {
  const { c, f } = pair();
  T.part(c, f, 'vince', 'kill');
  assert.equal(T.loyalty(f, 'dutch'), 55 - L.blood);
});

test('a save from before loyalty plays on: every man reads as what he is known for', () => {
  const { c, f } = pair();
  delete f.men.vince.loyal; delete f.men.dutch.loyal;
  T.stepMonth(c, f);
  assert.equal(T.loyalty(f, 'vince'), 45);
  assert.equal(moodOf(c, f, 'vince'), 'restless');
});
