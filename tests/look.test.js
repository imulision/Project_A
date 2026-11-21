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

test('the streets the family holds come alive: shop signs light up and cars park at the kerb, more as the hold firms up', async () => {
  const { lotLook } = await import('../render/look.mjs');
  const count = (lit, what, lot = {}) => { let s = 0; for (let k = 0; k < 200; k++) if (lotLook({ ours: true, lit, site: null, shop: true, ...lot }, k / 200)[what]) s++; return s / 200; };
  assert.ok(count(1, 'sign') > 0.1 && count(2, 'sign') > count(1, 'sign') * 1.5 && count(3, 'sign') > count(2, 'sign') * 1.2, 'signs');
  assert.ok(count(3, 'sign') <= 0.9, 'never every shop: a street, not a fairground');
  assert.equal(count(3, 'sign', { shop: false }), 0, 'only a shop carries a sign');
  assert.ok(count(1, 'parked') > 0.05 && count(3, 'parked') > count(1, 'parked') * 2 && count(3, 'parked') <= 0.6, 'parked cars');
  const names = new Set(); for (let k = 0; k < 200; k++) { const s = lotLook({ ours: true, lit: 3, site: null, shop: true }, k / 200).sign; if (s) { assert.match(s, /^[A-Z &]{3,10}$/); names.add(s); } }
  assert.ok(names.size >= 5, 'several trades, not one sign repeated');
  for (const l of [{ ours: false, lit: 2, site: null, shop: true }, { ours: true, lit: 3, site: { owner: 'family' }, shop: true }, { ours: false, lit: 1, site: { owner: 'callahan' }, shop: true }])
    for (let k = 0; k < 50; k++) { const o = lotLook(l, k / 50); assert.equal(o.sign, null); assert.equal(o.parked, false); }
});

test('a street whose capo is in trouble goes quiet: no sign, no car at the kerb, half the lamps', async () => {
  const { lotLook } = await import('../render/look.mjs');
  for (let k = 0; k < 100; k++) { const well = lotLook({ ours: true, lit: 3, site: null, shop: true }, k / 100), ill = lotLook({ ours: true, lit: 3, site: null, shop: true, low: true }, k / 100);
    assert.equal(ill.sign, null); assert.equal(ill.parked, false); assert.equal(ill.lamps, Math.floor(well.lamps / 2)); assert.equal(ill.roof, 'family', 'it is still his'); assert.ok(ill.gain < well.gain); }
});

test('a street that changes hands is noticed: the blocks won and the blocks lost between two months', async () => {
  const { turned } = await import('../render/look.mjs');
  const was = [{ x: 0, y: 0, grip: 'family' }, { x: 1, y: 0, grip: 'rival' }, { x: 2, y: 0, grip: 'contested' }, { x: 3, y: 0, grip: 'family' }, { x: 4, y: 0, grip: null, void: 'water' }];
  const now = [{ x: 0, y: 0, grip: 'family' }, { x: 1, y: 0, grip: 'family' }, { x: 2, y: 0, grip: 'family' }, { x: 3, y: 0, grip: 'rival' }, { x: 4, y: 0, grip: null, void: 'water' }];
  assert.deepEqual(turned(was, now), [{ x: 1, y: 0, won: true }, { x: 2, y: 0, won: true }, { x: 3, y: 0, won: false }]);
  assert.deepEqual(turned(was, was), []); assert.deepEqual(turned(undefined, now), [], 'a town seen for the first time has no news');
  assert.deepEqual(turned(was.slice(0, 2), now), [], 'nor a town whose plan changed shape');
});

test('a place burnt out is a black shell: dark walls, no roof colour, no lamp, no sign', async () => {
  const { lotLook } = await import('../render/look.mjs');
  for (const l of [{ ours: true, lit: 3, site: null, shop: true, burnt: true }, { ours: false, lit: 0, site: null, burnt: true }]) {
    const k = lotLook(l, 0.1); assert.ok(k.shade <= 0.3); assert.equal(k.roof, null); assert.equal(k.lamps, 0); assert.equal(k.sign, null); assert.equal(k.parked, false); assert.equal(k.burnt, true); }
  assert.ok(!lotLook({ ours: true, lit: 3, site: null }, 0.1).burnt);
});

test('the front line: the edges of the family\'s streets that a rival presses on', async () => {
  const { front } = await import('../render/look.mjs');
  // 3 x 2 blocks: the family holds the middle column; the left one is pressed, the right is calm, water below is nobody's
  const B = (x, y, grip, press, v) => ({ x, y, grip, press: press || 0, void: v || null });
  const blocks = [B(0, 0, 'rival'), B(1, 0, 'family', 0.8), B(2, 0, 'rival'), B(0, 1, null, 0, 'water'), B(1, 1, 'family', 0.2), B(2, 1, 'contested')];
  assert.deepEqual(front(blocks, 3, 2), [{ x: 1, y: 0, dx: 1, dy: 0 }, { x: 1, y: 0, dx: -1, dy: 0 }], 'only the pressed block, only towards the rival, never towards its own or the edge of town');
  assert.deepEqual(front([B(0, 0, 'family', 0.9)], 1, 1), []); assert.deepEqual(front(undefined, 0, 0), []);
});

test('a street name is written where the page says, or in the middle of its rectangle', async () => {
  const { midX, midY } = await import('../render/look.mjs');
  assert.deepEqual([midX({ c0: 2, c1: 6, r0: 0, r1: 3 }), midY({ c0: 2, c1: 6, r0: 0, r1: 3 })], [4, 1.5]);
  assert.deepEqual([midX({ c0: 2, c1: 6, r0: 0, r1: 3, cx: 2.5, cy: 0.5 }), midY({ c0: 2, c1: 6, r0: 0, r1: 3, cx: 2.5, cy: 0.5 })], [2.5, 0.5]);
});

test('a street name that grew over the year thrives: more signs, more cars, a lamp more', async () => {
  const { lotLook } = await import('../render/look.mjs');
  let signs = 0, cars = 0, signs0 = 0, cars0 = 0;
  for (let k = 0; k < 200; k++) { const plain = lotLook({ ours: true, lit: 1, site: null, shop: true }, k / 200), boom = lotLook({ ours: true, lit: 1, site: null, shop: true, boom: true }, k / 200);
    assert.equal(boom.lamps, plain.lamps + 1); assert.ok(boom.gain > plain.gain);
    if (boom.sign) signs++; if (boom.parked) cars++; if (plain.sign) signs0++; if (plain.parked) cars0++; }
  assert.ok(signs > signs0 * 1.5 && cars > cars0 * 1.5, signs + ' signs against ' + signs0 + ', ' + cars + ' cars against ' + cars0);
  assert.equal(lotLook({ ours: false, boom: true }, 0.3).lamps, 0, 'only the family\'s streets');
});

test('a place being built rises, flashes when it is done, then lets go', async () => {
  const { rising } = await import('../render/look.mjs');
  assert.equal(rising(0, 7).up, 0); assert.ok(rising(1, 7).up > 0.2 && rising(1, 7).up < rising(2, 7).up, 'the frame climbs');
  assert.equal(rising(3.5, 7).up, 1); assert.ok(rising(3.6, 7).flash > 0.8, 'a flash when the roof is on');
  assert.ok(rising(5, 7).flash < 0.2); assert.equal(rising(2, 7).flash, 0);
  assert.equal(rising(2, 7).alpha, 1); assert.ok(rising(6.5, 7).alpha < 0.5 && rising(7, 7).alpha === 0, 'and it fades');
});
