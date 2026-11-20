// The man across the street: every city's old family has a chief with a name, the boss can read how strong he is and what he did last,
// and a chief who is struck swears a vendetta.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const W = require('../web/world.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const V = T.RULES.vendetta;
const chief = (c, f) => T.view(c, f).chief;
// Sal with a few places in the east of a town of Ashport's, a Callahan bar next door he can take, and others further off.
const neighbours = () => {
  const c = T.createCity({ id: 'ashport', w: 12, h: 6, zones: town().zones }), f = family({ dirty: 50000, clean: 0 });
  c.rival = 'Callahan';
  T.settle(c, 'sal', 8, 3); T.join(f, 'sal');
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.open(c, 8, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.open(c, 10, 2, { owner: 'Callahan', kind: 'speakeasy' });
  for (const [x, y] of [[1, 1], [2, 4], [4, 2]]) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  return { c, f };
};
// The family takes the Callahan bar next door, gun in hand or with an envelope.
const strike = (c, way) => c.ops.push({ capo: 'sal', x: 10, y: 2, way: way || 'force', kind: 'speakeasy', cost: 0, month: c.month, months: 1 });

test('each of the six cities has a chief of its own, with a name and a face the screen can keep', () => {
  const g = E.createGame({ capo: 'dutch' }), seen = new Set();
  for (const c of E.view(g).cities) {
    const k = c.chief, spec = W.CITIES.find((q) => q.id === c.id);
    assert.ok(k && k.id && k.name, c.id + ' has a chief');
    assert.equal(k.family, spec.rival);
    assert.equal(T.person(k.id).name, k.name, 'he is a person like the others');
    assert.ok(!seen.has(k.id), k.id + ' runs one city only'); seen.add(k.id);
  }
  assert.equal(seen.size, 6);
});

test('his strength is the part of the city his family holds; a city with no old family has no chief', () => {
  const { c, f } = neighbours();
  assert.equal(chief(c, f).strength, Math.round(T.share(c).rival));
  assert.ok(chief(c, f).strength > 0);
  const empty = town();
  assert.equal(chief(empty, family()), null);
});

test('the boss can read the last thing the chief did: a place opened, a raid that burnt, a raid thrown back', () => {
  const { c, f } = neighbours();
  assert.equal(chief(c, f).last, null);
  let seen = {};
  for (let m = 0; m < 60; m++) {
    const ev = T.stepMonth(c, f), last = chief(c, f).last;
    if (last) { seen[last.type] = last; assert.ok(last.label && last.month <= c.month && Number.isInteger(last.x) && Number.isInteger(last.y)); }
    const raid = ev.find((e) => e.type === 'burnt' || e.type === 'repelled');
    if (raid) assert.deepEqual([last.type, last.x, last.y, last.month], [raid.type, raid.x, raid.y, c.month]);
  }
  assert.ok(seen.opened, 'he opened a place');
  assert.ok(seen.burnt || seen.repelled, 'he came for one of ours');
});

test('a place taken from him gun in hand starts a vendetta: the boss is told, and it lasts', () => {
  const { c, f } = neighbours();
  assert.equal(chief(c, f).vendetta, 0);
  strike(c, 'force');
  const ev = [...T.stepMonth(c, f), ...T.stepMonth(c, f)];
  const e = ev.find((x) => x.type === 'vendetta');
  assert.ok(ev.some((x) => x.type === 'taken'), 'the place was taken');
  assert.ok(e, 'and he swore it');
  assert.deepEqual([e.city, e.chief, e.months, e.x, e.y], ['ashport', chief(c, f).id, V.months, 10, 2]);
  assert.ok(e.label.includes(chief(c, f).name));
  assert.ok(chief(c, f).vendetta > V.months - 3 && chief(c, f).vendetta <= V.months);
  for (let m = 0; m < V.months + 1; m++) T.stepMonth(c, f);
  assert.equal(chief(c, f).vendetta, 0, 'it burns out');
});

test('a place bought or bribed away is business: no vendetta', () => {
  for (const way of ['buy', 'bribe']) {
    const { c, f } = neighbours();
    strike(c, way);
    const ev = [...T.stepMonth(c, f), ...T.stepMonth(c, f)];
    assert.ok(ev.some((x) => x.type === 'taken'));
    assert.ok(!ev.some((x) => x.type === 'vendetta'), way);
    assert.equal(chief(c, f).vendetta, 0);
  }
});

test('struck again during a vendetta, he does not swear twice: the vendetta starts over', () => {
  const { c, f } = neighbours();
  strike(c, 'force'); T.stepMonth(c, f); T.stepMonth(c, f);
  for (let m = 0; m < 4; m++) T.stepMonth(c, f);
  const before = chief(c, f).vendetta;
  T.open(c, 10, 4, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'sal', x: 10, y: 4, way: 'force', kind: 'speakeasy', cost: 0, month: c.month, months: 1 });
  const ev = [...T.stepMonth(c, f), ...T.stepMonth(c, f)];
  assert.ok(!ev.some((x) => x.type === 'vendetta'));
  assert.ok(chief(c, f).vendetta > before);
});

test('during a vendetta his men come harder: a raid the family would have thrown back burns the place', () => {
  const raid = (feud) => {
    const { c, f } = H.siege();
    c.rival = 'Callahan';
    if (feud) c.vendetta = c.month + 99;
    const out = [];
    for (let m = 0; m < T.RULES.rivalEvery * 2; m++) out.push(...T.stepMonth(c, f).filter((e) => e.type === 'burnt' || e.type === 'repelled').map((e) => e.type));
    return out[0];
  };
  assert.equal(raid(false), 'repelled');
  assert.equal(raid(true), 'burnt');
});

test('a key place taken from him by force starts a vendetta too', () => {
  const { c, f } = neighbours();
  T.open(c, 10, 4, { owner: 'Callahan', kind: 'key', key: 'hotel' });
  c.ops.push({ capo: 'sal', x: 10, y: 4, way: 'force', key: 'hotel', kind: 'key', cost: 0, month: c.month, months: 1 });
  const ev = [...T.stepMonth(c, f), ...T.stepMonth(c, f)];
  assert.ok(ev.some((x) => x.type === 'vendetta'));
});
