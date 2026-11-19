// What the 3D map has to draw, worked out from the state of the game.
// No drawing and no browser here: only the list of things to show.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../web/game.js');
const M = require('../web/mapview.js');

const month = (g) => { const out = []; for (let i = 0; i < G.TICKS_PER_MONTH; i++) out.push(...G.tick(g)); return out; };
const fresh = () => G.createGame({ capo: 'sal' });
const city = (p, id) => p.cities.find((c) => c.id === id);

test('every city of the game is on the map, with all its districts', () => {
  const view = G.view(fresh()), p = M.plan(view);
  assert.equal(p.cities.length, view.cities.length);
  view.cities.forEach((c) => {
    const pc = city(p, c.id);
    assert.equal(pc.name, c.name);
    assert.deepEqual([pc.u, pc.v], [c.x, c.y]);
    assert.deepEqual(pc.districts.map((d) => d.id), c.districts.map((d) => d.id));
  });
});

test('the districts of a city tile its blocks exactly, with no gap and no overlap', () => {
  M.plan(G.view(fresh())).cities.forEach((c) => {
    const seen = new Map();
    c.districts.forEach((d) => {
      assert.ok(d.c1 > d.c0 && d.r1 > d.r0, d.id + ' has a size');
      for (let i = d.c0; i < d.c1; i++) for (let j = d.r0; j < d.r1; j++) {
        assert.ok(!seen.has(i + ',' + j), c.id + ': block ' + i + ',' + j + ' is in two districts');
        seen.set(i + ',' + j, d.id);
      }
    });
    assert.equal(seen.size, c.bx * c.by, c.id + ' is fully covered');
  });
});

test('every city is big: at least six districts and two hundred buildings', () => {
  M.plan(G.view(fresh())).cities.forEach((c) => {
    assert.ok(c.districts.length >= 6, c.id);
    assert.ok(c.lots.length >= 200, c.id + ' has ' + c.lots.length + ' buildings');
  });
});

test('a lot belongs to the district that contains it and stands off the streets', () => {
  M.plan(G.view(fresh())).cities.forEach((c) => c.lots.forEach((l) => {
    assert.ok(l.i % 4 !== 0 && l.j % 3 !== 0, 'not on a street');
    const d = c.districts[l.district];
    assert.ok(l.i > d.c0 * 4 && l.i < d.c1 * 4 && l.j > d.r0 * 3 && l.j < d.r1 * 3);
    assert.ok(M.MODELS.includes(l.model), l.model);
  }));
});

test('a district shows who holds it', () => {
  const p = M.plan(G.view(fresh())), ash = city(p, 'ashport');
  const hill = ash.districts.find((d) => d.id === 'ashport-hillside'), up = ash.districts.find((d) => d.id === 'ashport-uptown');
  assert.equal(hill.owner, 'family');
  assert.equal(hill.ownerName, 'Your family');
  assert.equal(up.owner, 'callahan');
  assert.equal(up.ownerName, 'Callahan');
  assert.equal(ash.held, 1);
  assert.match(M.COLORS[hill.owner], /^#[0-9a-f]{6}$/);
  assert.notEqual(M.COLORS[hill.owner], M.COLORS[up.owner]);
});

test('each place the family runs stands on its own lot of its district, with a sign', () => {
  const g = fresh(); for (let i = 0; i < 18; i++) month(g);
  const view = G.view(g), p = M.plan(view);
  view.cities.forEach((c) => c.districts.forEach((d) => {
    const pc = city(p, c.id), di = pc.districts.findIndex((x) => x.id === d.id);
    const sites = pc.lots.filter((l) => l.site && l.district === di);
    assert.deepEqual(sites.map((l) => l.site.id).sort(), d.buildings.map((b) => b.id).sort());
    sites.forEach((l) => { assert.ok(l.site.sign.length > 0); assert.match(l.site.color, /^#[0-9a-f]{6}$/); assert.ok(l.shop); });
  }));
  assert.ok(city(p, 'ashport').lots.some((l) => l.site), 'the family has places after a year and a half');
});

test('a place keeps its lot from month to month', () => {
  const g = fresh(); for (let i = 0; i < 6; i++) month(g);
  const where = (p) => { const out = {}; p.cities.forEach((c) => c.lots.forEach((l) => { if (l.site) out[l.site.id] = c.id + ':' + l.i + ',' + l.j; })); return out; };
  const before = where(M.plan(G.view(g)));
  for (let i = 0; i < 6; i++) month(g);
  const after = where(M.plan(G.view(g)));
  Object.keys(before).forEach((id) => { if (after[id]) assert.equal(after[id], before[id], id); });
});

test('a district the family holds well is taller and better lit than one it barely holds', () => {
  const view = G.view(fresh());
  const hill = view.cities[0].districts.find((d) => d.id === 'ashport-hillside');
  const lit = (share) => { hill.share = share; const c = city(M.plan(view), 'ashport'), di = c.districts.findIndex((d) => d.id === hill.id);
    const lots = c.lots.filter((l) => l.district === di); return { wealth: c.districts[di].wealth, light: lots.reduce((n, l) => n + l.lit, 0), tall: lots.filter((l) => l.tall).length }; };
  const weak = lit(8), strong = lit(80);
  assert.ok(strong.wealth > weak.wealth);
  assert.ok(strong.light > weak.light);
  assert.ok(strong.tall > weak.tall);
});

test('the key of a city changes only when what it shows changes', () => {
  const g = fresh(), a = M.plan(G.view(g)), b = M.plan(G.view(g));
  a.cities.forEach((c, i) => assert.equal(c.key, b.cities[i].key));
  assert.deepEqual(G.command(g, { type: 'claim', district: 'ashport-market', capo: 'mae' }), { ok: true });
  const c = M.plan(G.view(g));
  assert.notEqual(city(c, 'ashport').key, city(a, 'ashport').key);
  assert.equal(city(c, 'vesper').key, city(a, 'vesper').key);
});

test('the routes between cities are on the map', () => {
  const view = G.view(fresh()), p = M.plan(view);
  assert.equal(p.routes.length, view.routes.length);
  p.routes.forEach((r) => { assert.ok(p.cities[r.a] && p.cities[r.b] && r.a !== r.b); assert.ok(['rail', 'road', 'river', 'sea'].includes(r.kind)); });
});

test('attacks and raids become fire, gunfire and police lights where they happened', () => {
  const fx = M.effects([
    { type: 'attack', outcome: 'hit', site: 'hillside-still-1', district: 'ashport-hillside', city: 'ashport', label: 'x' },
    { type: 'attack', outcome: 'repelled', site: null, district: 'ashport-market', city: 'ashport', label: 'x' },
    { type: 'raid', site: 'hillside-speakeasy-1', district: 'ashport-hillside', city: 'ashport', label: 'x' },
    { type: 'decision', kind: 'push', district: 'ashport-hillside', city: 'ashport', label: 'x' },
  ]);
  assert.deepEqual(fx, [
    { kind: 'fire', city: 'ashport', district: 'ashport-hillside', site: 'hillside-still-1' },
    { kind: 'gunfire', city: 'ashport', district: 'ashport-hillside', site: 'hillside-still-1' },
    { kind: 'gunfire', city: 'ashport', district: 'ashport-market', site: null },
    { kind: 'police', city: 'ashport', district: 'ashport-hillside', site: 'hillside-speakeasy-1' },
  ]);
});
