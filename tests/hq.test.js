// The headquarters: a building of its own for each act, that no other place uses and that is known from afar by its lit signs.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = async () => { const THREE = await import('three'), { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'), { makeEraBuildings } = await import('../render/era.js'); return makeEraBuildings(THREE, mergeGeometries); };
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const signs = (g) => { const w = g.attributes.aWin; let n = 0; for (let k = 0; k < w.count; k++) if (w.getX(k) >= 3) n++; return n; };
const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };

test('four headquarters, one an act, each taller than the last and never drawn by chance among the houses', async () => {
  const E = await load();
  assert.deepEqual(E.hq, ['hq_backroom', 'hq_club', 'hq_hotel', 'hq_seat']);
  let last = 0;
  E.hq.forEach((n) => {
    const m = E.models[n]; assert.ok(m && m.geo, n);
    assert.ok(m.h > last, n + ' stands taller than the one before (' + m.h.toFixed(2) + ')'); last = m.h;
    assert.ok(!E.low.includes(n) && !E.mid.includes(n) && !E.high.includes(n), n + ' is nobody else\'s building');
    const b = box(m.geo);
    assert.ok(b.min.x > -1.05 && b.max.x < 1.05 && b.min.z > -1.05 && b.max.z < 1.3, n + ' stays on its lot');
    assert.ok(tris(m.geo) < 2 * tris(E.models.era_deco11.geo), n + ' weighs ' + tris(m.geo) + ' triangles');
  });
});

test('a headquarters is known by signs that are always lit; no ordinary building has one', async () => {
  const E = await load();
  E.hq.forEach((n) => assert.ok(signs(E.models[n].geo) >= 8, n + ' carries lit signs (' + signs(E.models[n].geo) + ' vertices)'));
  E.low.concat(E.mid, E.high).forEach((n) => assert.equal(signs(E.models[n].geo), 0, n));
  assert.ok(signs(E.models.hq_seat.geo) > signs(E.models.hq_backroom.geo), 'the family seat is lit more than the back room');
});

test('the wings of a headquarters are lower than it, in its stone and with its lamps', async () => {
  const E = await load(), w = E.models.hq_wing;
  assert.ok(w && w.h < E.models.hq_hotel.h && signs(w.geo) > 0);
  assert.ok(!E.low.includes('hq_wing') && !E.hq.includes('hq_wing'));
});
