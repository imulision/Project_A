// The vehicles and street lamps of the 1920s, built by code: light enough to draw by the hundred.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = async () => { const THREE = await import('three'), { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'), { makePeriod } = await import('../render/period.mjs'); return makePeriod(THREE, mergeGeometries); };
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const size = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, l: b.max.z - b.min.z, b }; };

test('three period vehicles, each a fraction of the weight of the models they replace, the same size on the road', async () => {
  const P = await load();
  ['sedan', 'coupe', 'truck'].forEach((n) => {
    const g = P[n], s = size(g);
    assert.ok(g, n); assert.ok(g.attributes.color, n + ' carries its own colours');
    assert.ok(tris(g) <= 420, n + ' weighs ' + tris(g) + ' triangles (the old ones: about 1,200)');
    assert.ok(s.l > 0.8 && s.l < 1.15 && s.w > 0.34 && s.w < 0.5, n + ' fits a lane: ' + s.l.toFixed(2) + ' x ' + s.w.toFixed(2));
    assert.ok(Math.abs(s.b.min.y + 0.03) < 0.06, n + ' sits on its wheels at the height of the old ones');
  });
  assert.ok(size(P.truck).h > size(P.sedan).h, 'a truck stands taller than a car');
  assert.ok(size(P.coupe).h < size(P.sedan).h, 'and a coupe lower');
});

test('the nose of a car points forward, where its lamps are', async () => {
  const P = await load(), g = P.sedan, pos = g.attributes.position, col = g.attributes.color; let lampZ = -9;
  for (let k = 0; k < pos.count; k++) if (col.getX(k) > 0.95 && col.getY(k) > 0.85 && col.getZ(k) < 0.7) lampZ = Math.max(lampZ, pos.getZ(k));      // the warm glass of the headlamps
  assert.ok(lampZ > 0.3, 'headlamps at the front (+z): ' + lampZ);
});

test('a street lamp is a post and a lantern, hung where the old one hung so that its light falls in the same place', async () => {
  const P = await load(), s = size(P.lamp);
  assert.ok(tris(P.lamp) <= 80, 'it weighs ' + tris(P.lamp) + ' triangles (the old one: about 1,000)');
  assert.ok(s.h > 0.9 && s.h < 1.15); assert.ok(Math.abs(s.b.min.x + 0.26) < 0.08, 'the lantern hangs towards -x: ' + s.b.min.x.toFixed(2));
  assert.ok(Math.abs(s.b.min.y) < 0.01, 'and it stands on the ground');
});
