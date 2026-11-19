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

// ---- the life of the empire: who drives where
const grown = () => { const g = G.createGame({ capo: 'dutch' }); for (let i = 0; i < 30; i++) month(g); return g; };
const lotAt = (c, p) => c.lots.find((l) => l.i === p[0] && l.j === p[1]);
const onStreet = (p) => p[0] % 4 === 0 || p[1] % 3 === 0;

test('a route runs along the streets, from one lot to another', () => {
  const c = city(M.plan(G.view(fresh())), 'ashport'), a = c.lots[0], b = c.lots[c.lots.length - 1];
  const path = M.route([a.i, a.j], [b.i, b.j]);
  assert.deepEqual(path[0], [a.i, a.j]);
  assert.deepEqual(path[path.length - 1], [b.i, b.j]);
  path.slice(1, -1).forEach((p) => assert.ok(onStreet(p), p + ' is on a street'));
  for (let k = 1; k < path.length; k++) assert.ok(path[k][0] === path[k - 1][0] || path[k][1] === path[k - 1][1], 'no diagonal');
});

test('liquor goes from the stills to the rooms that sell it, and the money to where it is washed', () => {
  const p = M.plan(G.view(grown())), ash = city(p, 'ashport'), trips = M.trips(p, []);
  const kindAt = (pt) => lotAt(ash, pt).site.type;
  const liquor = trips.filter((t) => t.kind === 'liquor'), cash = trips.filter((t) => t.kind === 'cash');
  assert.ok(liquor.length > 0, 'there is liquor on the road');
  liquor.forEach((t) => { assert.ok(['still', 'warehouse'].includes(kindAt(t.path[0]))); assert.ok(['speakeasy', 'gambling', 'brothel'].includes(kindAt(t.path[t.path.length - 1]))); assert.equal(t.loop, true); });
  assert.ok(cash.length > 0, 'there is money on the road');
  const washes = ash.lots.some((l) => l.site && ['rented', 'front'].includes(l.site.type));
  if (washes) cash.forEach((t) => assert.ok(['rented', 'front'].includes(kindAt(t.path[t.path.length - 1]))));
});

test('only the family has its cars out, and never too many in one district', () => {
  const p = M.plan(G.view(grown())), trips = M.trips(p, []), per = {};
  trips.forEach((t) => {
    const c = city(p, t.city), d = c.districts[lotAt(c, t.path[0]).district];
    assert.equal(d.owner, 'family');
    per[d.id] = (per[d.id] || 0) + 1;
    assert.match(t.color, /^#[0-9a-f]{6}$/);
  });
  Object.keys(per).forEach((id) => assert.ok(per[id] <= 8, id + ' has ' + per[id] + ' cars'));
  assert.deepEqual(M.trips(p, []).map((t) => t.id), trips.map((t) => t.id), 'the same state gives the same cars');
});

test('what a capo decides is seen on the road', () => {
  const p = M.plan(G.view(grown())), ash = city(p, 'ashport'), at = { district: 'ashport-hillside', city: 'ashport' };
  const one = (e) => M.trips(p, [Object.assign({ label: 'x' }, at, e)]).filter((t) => !t.loop);
  const end = (t) => lotAt(ash, t.path[t.path.length - 1]);
  const built = one({ type: 'decision', kind: 'speakeasy' });
  assert.equal(built.length, 1); assert.equal(built[0].kind, 'build'); assert.equal(end(built[0]).site.type, 'speakeasy');
  const seized = one({ type: 'decision', kind: 'seize' });
  assert.equal(seized[0].kind, 'seize'); assert.equal(end(seized[0]).site.type, 'warehouse');
  const push = one({ type: 'decision', kind: 'push' });
  assert.equal(push[0].kind, 'push'); assert.equal(ash.districts[end(push[0]).district].id, 'ashport-hillside');
  assert.deepEqual(one({ type: 'decision', kind: 'hold' }), [], 'holding steady moves nobody');
});

test('rivals and the police come from outside the district', () => {
  const p = M.plan(G.view(grown())), ash = city(p, 'ashport'), at = { district: 'ashport-hillside', city: 'ashport', label: 'x' };
  const hill = ash.districts.findIndex((d) => d.id === 'ashport-hillside');
  const attack = M.trips(p, [Object.assign({ type: 'attack', by: 'Callahan', outcome: 'hit', site: 'still' }, at)]).filter((t) => !t.loop);
  assert.ok(attack.length >= 2, 'they come in several cars');
  attack.forEach((t) => { assert.equal(t.kind, 'attack'); assert.equal(t.color, M.COLORS.callahan);
    assert.notEqual(lotAt(ash, t.path[0]).district, hill); assert.equal(lotAt(ash, t.path[t.path.length - 1]).site.type, 'still'); });
  const raid = M.trips(p, [Object.assign({ type: 'raid', site: 'speakeasy' }, at)]).filter((t) => !t.loop);
  assert.ok(raid.length >= 2);
  raid.forEach((t) => { assert.equal(t.kind, 'police'); assert.notEqual(lotAt(ash, t.path[0]).district, hill); assert.equal(lotAt(ash, t.path[t.path.length - 1]).district, hill); });
});

test('fire and police lights land on the place that was hit, whatever name the rules give it', () => {
  const p = M.plan(G.view(grown())), ash = city(p, 'ashport');
  const fx = M.effects([{ type: 'attack', outcome: 'hit', site: 'still', district: 'ashport-hillside', city: 'ashport', label: 'x' }], p);
  assert.equal(fx[0].kind, 'fire'); assert.equal(ash.lots.find((l) => l.site && l.site.id === fx[0].site).site.type, 'still');
});
