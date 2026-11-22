// The headquarters: a building of its own for each act, that no other place uses and that is known from afar by its lit signs.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = async () => { const THREE = await import('three'), { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'), { makeEraBuildings } = await import('../render/era.js'); return makeEraBuildings(THREE, mergeGeometries); };
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const signs = (g) => { const w = g.attributes.aWin; let n = 0; for (let k = 0; k < w.count; k++) if (w.getX(k) >= 3) n++; return n; };
const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };

const width = (g) => { const b = box(g); return b.max.x - b.min.x; };
// how many vertices carry a colour no ordinary building has: the green of a copper roof
const copper = (g) => { const c = g.attributes.color; let n = 0; for (let k = 0; k < c.count; k++) if (c.getY(k) > 1.05 && c.getX(k) < 0.8) n++; return n; };
// how many ways its faces look sideways: a box and its panels have two (straight on or not at all), a round column has many
const round = (g) => { const n = g.attributes.normal, seen = {}; for (let k = 0; k < n.count; k++) seen[Math.round(Math.abs(n.getX(k)) * 20)] = 1; return Object.keys(seen).length; };

test('four headquarters, one an act, each grander than the last and never drawn by chance among the houses', async () => {
  const E = await load();
  assert.deepEqual(E.hq, ['hq_backroom', 'hq_club', 'hq_hotel', 'hq_seat']);
  let last = 0;
  E.hq.forEach((n) => {
    const m = E.models[n]; assert.ok(m && m.geo, n);
    assert.ok(m.h > last, n + ' stands taller than the one before (' + m.h.toFixed(2) + ')'); last = m.h;
    assert.ok(!E.low.includes(n) && !E.mid.includes(n) && !E.high.includes(n), n + ' is nobody else\'s building');
    const b = box(m.geo);
    assert.ok(b.min.z > -1.05 && b.max.z < 1.6, n + ' keeps to its row');
    assert.ok(tris(m.geo) < 3 * tris(E.models.era_deco11.geo), n + ' weighs ' + tris(m.geo) + ' triangles');
  });
});

test('from the club on, a headquarters is not a box with windows: columns, a copper roof, and a front wider than any house', async () => {
  const E = await load(), houses = E.low.concat(E.mid, E.high);
  houses.forEach((n) => assert.equal(copper(E.models[n].geo), 0, n + ' has no copper roof'));
  ['hq_club', 'hq_hotel', 'hq_seat'].forEach((n) => { const g = E.models[n].geo;
    assert.ok(copper(g) > 0, n + ' has a copper roof');
    assert.ok(round(g) > Math.max(4, ...houses.map((h) => round(E.models[h].geo))), n + ' has round columns'); });
  const widest = Math.max(...houses.map((n) => width(E.models[n].geo)));
  assert.ok(width(E.models.hq_club.geo) < 2, 'the club stands on one lot');
  assert.ok(width(E.models.hq_hotel.geo) > 2.5 * widest && width(E.models.hq_hotel.geo) < 5.9, 'the hotel takes the three lots of the front row');
  assert.ok(width(E.models.hq_seat.geo) > 2.5 * widest && width(E.models.hq_seat.geo) < 5.9, 'and so does the family seat');
  assert.ok(E.models.hq_seat.h > E.models.hq_hotel.h, 'whose dome stands above everything of the family');
});

test('a headquarters is known by signs that are always lit; no ordinary building has one', async () => {
  const E = await load();
  E.hq.forEach((n) => assert.ok(signs(E.models[n].geo) >= 8, n + ' carries lit signs (' + signs(E.models[n].geo) + ' vertices)'));
  E.low.concat(E.mid, E.high).forEach((n) => assert.equal(signs(E.models[n].geo), 0, n));
});
