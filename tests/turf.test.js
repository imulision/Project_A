// The city as one fabric of blocks: the family's hold spreads place by place.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');

// A small town: the west is where people go out at night, the east is factories and a port.
const town = () => T.createCity({ id: 'town', w: 12, h: 6, zones: [
  { name: 'Lantern Row', x0: 0, y0: 0, x1: 5, y1: 5, traits: { nightlife: 1.5, industry: 0.3, port: 0, wealth: 1 } },
  { name: 'The Works', x0: 6, y0: 0, x1: 11, y1: 5, traits: { nightlife: 0.3, industry: 1.5, port: 1.2, wealth: 0.4 } },
] });
const ALL = () => { const t = {}; for (const k of Object.keys(D.SITES)) t[k] = 3; return t; };

test('a new city is nobody\'s', () => {
  const c = town();
  assert.deepEqual(T.share(c), { family: 0, rival: 0, contested: 0, free: 100 });
  assert.equal(T.zoneOf(c, 2, 2).name, 'Lantern Row');
  assert.equal(T.zoneOf(c, 9, 0).name, 'The Works');
  assert.throws(() => T.open(c, 12, 0, { owner: 'family', kind: 'still', capo: 'dutch' }), /outside/);
});

test('a place holds its own block firmly, the blocks around it less, and nothing far away', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  const at = (x, y) => T.hold(c, x, y).family;
  assert.ok(at(3, 3) > at(4, 3) && at(4, 3) > at(5, 3), 'it fades with distance');
  assert.equal(at(8, 3), 0);
  assert.equal(T.hold(c, 3, 3).rival, 0);
  assert.equal(T.grip(c, 3, 3), 'family');
  assert.equal(T.grip(c, 9, 3), null);
});

test('a bigger place holds more streets', () => {
  const small = town(), big = town();
  T.open(small, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(big, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  assert.ok(T.share(big).family > T.share(small).family);
  assert.equal(T.hold(small, 6, 3).family, 0);
  assert.ok(T.hold(big, 6, 3).family > 0);
});

test('where two families press on the same streets, the streets are contested', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 6, 3, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(T.grip(c, 3, 3), 'family');
  assert.equal(T.grip(c, 6, 3), 'rival');
  assert.equal(T.grip(c, 4, 3), 'family');
  assert.equal(T.grip(c, 5, 3), 'rival');
  const mid = town();
  T.open(mid, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(mid, 7, 3, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(T.grip(mid, 5, 3), 'contested');
  const s = T.share(mid);
  assert.ok(s.family > 0 && s.rival > 0 && s.contested > 0);
  assert.equal(Math.round(s.family + s.rival + s.contested + s.free), 100);
});

test('a block holds one place, and the place has one boss', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.throws(() => T.open(c, 3, 3, { owner: 'family', kind: 'still', capo: 'sal' }), /already/);
  assert.throws(() => T.open(c, 4, 3, { owner: 'family', kind: 'still' }), /capo/);
  assert.throws(() => T.open(c, 4, 3, { owner: 'family', kind: 'nonsense', capo: 'sal' }), /kind/);
  assert.deepEqual(T.places(c, 'dutch').map((p) => [p.x, p.y, p.kind, p.level]), [[3, 3, 'speakeasy', 1]]);
  assert.deepEqual(T.places(c, 'sal'), []);
});

test('a capo can only open next to what he holds, on a free block the rivals do not own', () => {
  const c = town();
  T.settle(c, 'dutch', 3, 3);
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy' });
  const edge = T.frontier(c, 'dutch');
  assert.ok(edge.length > 0);
  assert.ok(edge.every((b) => !T.at(c, b.x, b.y)), 'free blocks only');
  assert.ok(edge.every((b) => T.grip(c, b.x, b.y) === 'family'), 'streets he already holds');
  assert.ok(!edge.some((b) => b.x === 10), 'not across town');
  assert.deepEqual(T.frontier(c, 'sal'), [], 'Sal holds nothing here');
});

test('a capo arrives with a social club: his base, where he is found', () => {
  const c = town();
  T.settle(c, 'dutch', 3, 3);
  const club = T.at(c, 3, 3);
  assert.deepEqual([club.kind, club.capo, club.owner], ['club', 'dutch', 'family']);
  assert.deepEqual(T.clubOf(c, 'dutch'), { x: 3, y: 3 });
  assert.throws(() => T.settle(c, 'dutch', 8, 3), /already has a club/);
});

test('what a capo opens next depends on the street and on his trade', () => {
  const pick = (capo, x, y) => { const c = town(); T.settle(c, capo, x, y); return T.wants(c, capo, { rank: 1, tech: ALL() }); };
  const dutchWest = pick('dutch', 2, 3), dutchEast = pick('dutch', 9, 3), dannyWest = pick('danny', 2, 3);
  assert.equal(dutchWest.kind, 'speakeasy', 'a bootlegger where people go out');
  assert.equal(dutchEast.kind, 'still', 'the same man among the factories');
  assert.equal(dannyWest.kind, 'gambling', 'a gambler where people go out');
  for (const w of [dutchWest, dutchEast, dannyWest]) assert.ok(w.cost > 0 && w.why && Number.isInteger(w.x) && Number.isInteger(w.y));
});

test('a trade is a leaning, not a cage: with enough of one thing he opens another', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  const kinds = new Set();
  for (let i = 0; i < 9; i++) {
    const w = T.wants(c, 'dutch', { rank: 3, tech: ALL() });
    kinds.add(w.kind);
    T.open(c, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'dutch' });
  }
  assert.ok(kinds.size >= 3, [...kinds].join(', '));
  assert.ok(kinds.has('speakeasy'));
  assert.ok(![...kinds].some((k) => D.CAPOS.dutch.refuses.includes(k)));
});

test('he never opens a trade the family has not learned, nor one he refuses', () => {
  const c = town();
  T.settle(c, 'danny', 2, 3);
  const tech = ALL(); tech.gambling = 0; tech.speakeasy = 0;
  for (let i = 0; i < 6; i++) {
    const w = T.wants(c, 'danny', { rank: 3, tech });
    assert.ok(w.kind !== 'gambling' && w.kind !== 'speakeasy', w.kind);
    T.open(c, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'danny' });
  }
  const m = town();
  T.settle(m, 'mae', 2, 3);
  for (let i = 0; i < 8; i++) {
    const w = T.wants(m, 'mae', { rank: 3, tech: ALL() });
    assert.ok(!D.CAPOS.mae.refuses.includes(w.kind), w.kind);
    T.open(m, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'mae' });
  }
});

test('every place a capo runs makes his next one dearer, whatever the others hold', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  T.settle(c, 'sal', 9, 3);
  const first = T.price(c, 'dutch', 'still');
  assert.equal(first, D.SITES.still.cost);
  T.open(c, 3, 3, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 3, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  assert.equal(T.price(c, 'dutch', 'still'), Math.round(first * Math.pow(1 + T.RULES.dearer, 2)));
  assert.equal(T.price(c, 'sal', 'still'), first, 'Sal has opened nothing yet');
});

test('a capo runs only so many places for his rank; beyond that he makes them bigger', () => {
  assert.deepEqual(T.RULES.reach, [6, 10, 15, 20]);
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  for (let i = 0; i < T.RULES.reach[0]; i++) {
    const w = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
    assert.equal(w.move, 'open');
    T.open(c, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'dutch' });
  }
  assert.equal(T.places(c, 'dutch').filter((p) => p.kind !== 'club').length, 6);
  const next = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
  assert.equal(next.move, 'enlarge');
  assert.equal(T.at(c, next.x, next.y).capo, 'dutch');
  assert.equal(T.wants(c, 'dutch', { rank: 1, tech: ALL() }).move, 'open', 'a rank higher, he opens again');
  const flat = ALL(); for (const k of Object.keys(flat)) flat[k] = 1;
  assert.equal(T.wants(c, 'dutch', { rank: 0, tech: flat }), null, 'tier I everywhere: nothing left to do but wait for his rank');
});
