// The city of the new game, block by block, as the 3D map has to draw it.
// No drawing and no browser here: only the list of things to show.
const test = require('node:test');
const assert = require('node:assert/strict');
global.AshportDistrict = require('../web/district.js');
global.AshportWorld = require('../web/world.js');
global.AshportTurf = require('../web/turf.js');
const E = require('../web/empire.js');
const M = require('../web/mapview.js');

const play = (months, capo = 'sal') => {
  const g = E.createGame({ capo });
  for (let i = 0; i < months * E.TICKS_PER_MONTH; i++) { E.tick(g); if (E.hud(g).paused) E.command(g, { type: 'resume' }); }
  return g;
};
const cityOf = (g) => E.view(g).cities[0];
const lotsOf = (p, x, y) => p.lots.filter((l) => l.bx === x && l.by === y);

test('the city is drawn block for block: six lots on every block of the rules', () => {
  const c = cityOf(play(1)), p = M.planTurf(c);
  assert.equal(p.id, c.id); assert.equal(p.name, c.name);
  assert.deepEqual([p.bx, p.by], [c.w, c.h]);
  assert.equal(p.lots.length, c.w * c.h * 6);
  c.blocks.forEach((b) => assert.equal(lotsOf(p, b.x, b.y).length, 6));
  p.lots.forEach((l) => assert.ok(l.i % 4 !== 0 && l.j % 3 !== 0, 'no building stands in a street'));
});

test('the old district names are only names written on the ground', () => {
  const c = cityOf(play(1)), p = M.planTurf(c);
  assert.deepEqual(p.districts.map((d) => d.name), c.zones.map((z) => z.name));
  const z = c.zones[1], d = p.districts[1];
  assert.deepEqual([d.c0, d.c1, d.r0, d.r1], [z.x0, z.x1 + 1, z.y0, z.y1 + 1]);
  p.lots.forEach((l) => { const d = p.districts[l.district]; assert.ok(l.bx >= d.c0 && l.bx < d.c1 && l.by >= d.r0 && l.by < d.r1); });
});

test('every place stands on its own block, one place a block, with a sign', () => {
  const c = cityOf(play(30)), p = M.planTurf(c);
  c.places.forEach((pl) => {
    const sites = lotsOf(p, pl.x, pl.y).filter((l) => l.site);
    assert.equal(sites.length, 1, 'one place on block ' + pl.x + ',' + pl.y);
    assert.equal(sites[0].site.name, pl.name); assert.equal(sites[0].site.level, pl.level); assert.ok(sites[0].site.sign);
  });
  assert.equal(p.lots.filter((l) => l.site).length, c.places.length);
});

test('a place keeps its lot from month to month', () => {
  const g = play(12), a = M.planTurf(cityOf(g)), where = {};
  a.lots.forEach((l) => { if (l.site) where[l.site.id] = l.i + ',' + l.j; });
  for (let i = 0; i < 24 * E.TICKS_PER_MONTH; i++) { E.tick(g); if (E.hud(g).paused) E.command(g, { type: 'resume' }); }
  M.planTurf(cityOf(g)).lots.forEach((l) => { if (l.site && where[l.site.id]) assert.equal(l.i + ',' + l.j, where[l.site.id]); });
});

test("the capo's social club is where he is found, and the plan says what he is doing", () => {
  const c = cityOf(play(30)), p = M.planTurf(c), sal = c.capos[0], me = p.capos[0];
  const club = lotsOf(p, sal.x, sal.y).find((l) => l.site);
  assert.equal(club.site.type, 'club'); assert.equal(club.hideout, true); assert.equal(club.site.capo, 'sal');
  assert.equal(me.id, 'sal'); assert.deepEqual([me.i, me.j], [club.i, club.j]);
  assert.equal(me.move, sal.plan.move); assert.equal(me.progress, sal.plan.progress);
});

test('the six key places are marked as such and look like nothing else', () => {
  const p = M.planTurf(cityOf(play(1))), keys = p.lots.filter((l) => l.site && l.site.key);
  assert.equal(keys.length, 6);
  assert.equal(new Set(keys.map((l) => l.site.sign)).size, 6);
  keys.forEach((l) => { assert.equal(l.site.role, 'key'); assert.ok(M.MODELS.includes(l.model)); });
});

test("a rival's place is drawn as theirs, in their colour, and the family's as ours", () => {
  const c = cityOf(play(30)), p = M.planTurf(c);
  const theirs = p.lots.filter((l) => l.site && l.site.owner !== 'family'), ours = p.lots.filter((l) => l.site && l.site.owner === 'family');
  assert.ok(theirs.length > 0 && ours.length > 0);
  theirs.forEach((l) => { assert.equal(l.ours, false); assert.equal(l.site.color, M.COLORS.callahan); });
  ours.forEach((l) => assert.equal(l.ours, true));
});

test('streets the family holds are better lit than the rest, block by block', () => {
  const c = cityOf(play(30)), p = M.planTurf(c);
  const held = c.blocks.find((b) => b.grip === 'family'), lost = c.blocks.find((b) => b.grip === 'rival');
  lotsOf(p, held.x, held.y).forEach((l) => { assert.equal(l.ours, true); assert.ok(l.lit >= 1); });
  lotsOf(p, lost.x, lost.y).forEach((l) => { if (!l.site) { assert.equal(l.ours, false); assert.equal(l.lit, 0); } });
});

test('the ground is told who holds each block, and how firmly', () => {
  const c = cityOf(play(30)), p = M.planTurf(c);
  assert.equal(p.blocks.length, c.w * c.h);
  c.blocks.forEach((b, n) => { assert.equal(p.blocks[n].grip, b.grip); assert.ok(p.blocks[n].hold >= 0 && p.blocks[n].hold <= 1); });
  assert.equal(p.held, Math.round(c.share.family)); assert.equal(p.total, 100);
});

test('the buildings are rebuilt only when a place or the look of a block changes', () => {
  const g = play(30), a = M.planTurf(cityOf(g)), b = M.planTurf(cityOf(g));
  assert.equal(a.key, b.key);
  const c = cityOf(g); c.places = c.places.slice(1);
  assert.notEqual(M.planTurf(c).key, a.key);
});

test('the whole map: six big cities where the world puts them, stretched apart, with their routes', () => {
  const W = global.AshportWorld, v = E.view(play(1)), p = M.planEmpire(v, W.CITIES);
  assert.equal(p.cities.length, 6); assert.ok(p.scale > 1);
  p.cities.forEach((c, n) => { const w = W.CITIES.find((x) => x.id === c.id); assert.deepEqual([c.u, c.v], [w.x * p.scale, w.y * p.scale]); assert.equal(c.home, n === 0); });
  assert.equal(p.cities[0].present, true); assert.equal(p.cities[1].present, false);
  assert.equal(p.routes.length, v.routes.length);
  p.routes.forEach((r) => assert.ok(p.cities[r.a] && p.cities[r.b]));
  // no two cities overlap on the ground: a tile is 2 units, a block 4 tiles by 3
  const box = (c) => { const cx = (c.v + c.u) / 2, cz = (c.v - c.u) / 2, hw = c.bx * 4, hd = c.by * 3; return [cx - hw, cx + hw, cz - hd, cz + hd]; };
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) { const A = box(p.cities[a]), B = box(p.cities[b]); assert.ok(A[1] < B[0] || B[1] < A[0] || A[3] < B[2] || B[3] < A[2], p.cities[a].id + ' and ' + p.cities[b].id + ' overlap'); }
});
