// How a building reads from above: the boss must tell his own from the rest at a glance.
const test = require('node:test');
const assert = require('node:assert/strict');

test('the family\'s buildings carry its colour on the roof, its places brightest, and the rest of the town stays dark', async () => {
  const { lotLook } = await import('../render/look.mjs');
  const street = (lit) => lotLook({ ours: true, lit, site: null }), place = lotLook({ ours: true, lit: 3, site: { owner: 'family', color: '#ffe9b0' } });
  const rivalPlace = lotLook({ ours: false, lit: 1, site: { owner: 'callahan', color: '#4fbf7a' } }), other = lotLook({ ours: false, lit: 0, site: null });
  assert.equal(place.roof, 'family'); assert.equal(street(1).roof, 'family');
  assert.ok(place.gain > street(3).gain && street(3).gain > street(2).gain && street(2).gain > street(1).gain, 'the firmer the hold, the brighter the roof');
  assert.ok(street(1).gain >= 0.5, 'even a street barely held reads as the family\'s');
  assert.equal(other.roof, null); assert.ok(other.shade <= 0.7, 'what is not held is dark');
  assert.ok(street(1).shade >= 1 && place.shade > street(1).shade);
  assert.equal(rivalPlace.roof, '#4fbf7a', 'a rival\'s place shows whose it is'); assert.ok(rivalPlace.shade < 1);
});

test('seen from afar, the streets the family holds are lit, more as the hold firms up, and the rest of the town is not', async () => {
  const { lotLook } = await import('../render/look.mjs');
  const n = (lit, r) => lotLook({ ours: true, lit, site: null }, r).lamps;
  const mean = (lit) => { let s = 0; for (let k = 0; k < 100; k++) s += n(lit, k / 100); return s / 100; };
  assert.ok(mean(1) > 0.2 && mean(2) > mean(1) * 1.5 && mean(3) > mean(2) * 1.3, [mean(1), mean(2), mean(3)].join(' '));
  assert.ok(lotLook({ ours: true, lit: 3, site: { owner: 'family' } }, 0.9).lamps >= 2, 'a place of the family is always lit');
  assert.equal(lotLook({ ours: false, lit: 0, site: null }, 0.01).lamps, 0);
  assert.equal(lotLook({ ours: false, lit: 1, site: { owner: 'callahan', color: '#4fbf7a' } }, 0.01).lamps, 1, 'a rival\'s place keeps one lamp');
});
