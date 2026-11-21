// Around a key place the rivals hold, the streets are theirs: no capo opens or takes a place there on his own.
// A city falls whole only by the boss's own word, key place after key place.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family, ashport = H.ashport;
const ALL = () => { const t = {}; for (const k of Object.keys(D.SITES)) t[k] = 3; return t; };
const near = (p, k) => Math.max(Math.abs(p.x - k.x), Math.abs(p.y - k.y)) <= T.RULES.bastion;

// Dutch two blocks from the Callahans' brewery, every other block around him taken by his own places.
const besides = (owner) => {
  const c = town();
  T.settle(c, 'dutch', 2, 2);
  T.open(c, 4, 2, { owner, kind: 'key', key: 'brewery', capo: owner === 'family' ? 'dutch' : undefined });
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
    if (T.at(c, x, y) || near({ x, y }, { x: 4, y: 2 })) continue;
    T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'otto' }); // (another man's: Dutch has room left)
  }
  return c;
};

test('a capo does not open a place on the streets around a key place the rivals hold', () => {
  assert.equal(T.RULES.bastion, 1);
  const c = besides('Callahan');
  assert.ok(T.frontier(c, 'dutch').some((b) => near(b, { x: 4, y: 2 })), 'there are free blocks there, within his reach');
  const w = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
  assert.ok(!w || w.move !== 'open', 'and he leaves them alone: ' + JSON.stringify(w));
});

test('nor does he take a rival\'s place there', () => {
  const c = besides('Callahan');
  T.open(c, 3, 2, { owner: 'Callahan', kind: 'speakeasy' });
  const w = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
  assert.ok(!w || w.move !== 'take', JSON.stringify(w));
});

test('once the key place is the family\'s, those streets are open to him', () => {
  const c = besides('family');
  const w = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
  assert.equal(w.move, 'open');
  assert.ok(near(w, { x: 4, y: 2 }));
  const d = besides('family');
  for (const b of T.frontier(d, 'dutch')) T.open(d, b.x, b.y, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(T.wants(d, 'dutch', { rank: 0, tech: ALL() }).move, 'take');
});

test('twenty years of a boss who takes every man in but never gives his word for a key place: the city is never all his', () => {
  for (const start of ['sal', 'dutch', 'vince']) {
    const c = ashport(), f = T.createFamily();
    T.crown(c, 'Callahan'); T.seed(c, 'Callahan', 30);
    const l = T.landing(c); T.settle(c, start, l.x, l.y); T.join(f, start);
    for (let m = 1; m <= 240; m++) {
      T.month(f, [c]);
      for (const a of T.asks(c)) { if (a.kind !== 'fund') T.answer(c, f, a.id, false); else if (T.funds(f) >= a.cost) T.answer(c, f, a.id, true); }
      for (const q of T.feuds(c)) T.rule(c, f, q.id, q.a);
      for (const d of T.doors(c, f)) {
        const s = T.seats(c), spot = T.spots(c).find((q) => T.grip(c, q.x, q.y) === null) || T.spots(c)[0];
        if (T.funds(f) >= d.cost && s.taken < s.total && spot) T.welcome(c, f, d.capo, spot.x, spot.y);
      }
      const w = !f.study && T.wishes(c, f)[0], t = w && T.tree(f).find((q) => q.kind === w.kind);
      if (t && t.next && f.clean >= t.next.cost) T.research(f, t.kind);
    }
    const share = T.share(c);
    assert.ok(share.family >= 15 && share.family <= 80, start + ' holds ' + Math.round(share.family) + ' % of the city');
    assert.ok(T.keys(c).every((k) => k.owner !== 'family'));
    assert.ok(T.places(c).some((p) => p.owner === 'Callahan' && p.kind !== 'key'), 'the Callahans are still in business');
  }
});
