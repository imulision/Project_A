// The shape of a city: a rectangle of blocks with some missing (water, rail yards, waste ground), where nothing is ever built.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const W = require('../web/world.js');
const H = require('./turf-helpers.js');
const family = H.family, year = H.year;

// A town whose whole south row is water and whose north-east corner is waste ground.
const gaps = () => { const v = []; for (let x = 0; x < 12; x++) v.push({ x, y: 5, kind: 'water' }); v.push({ x: 11, y: 0, kind: 'waste' }, { x: 10, y: 0, kind: 'waste' }); return v; };
const shaped = () => T.createCity({ id: 'town', w: 12, h: 6, voids: gaps(), zones: [
  { name: 'Lantern Row', x0: 0, y0: 0, x1: 5, y1: 5, traits: { nightlife: 1.5, industry: 0.3, port: 0, wealth: 1 } },
  { name: 'The Works', x0: 6, y0: 0, x1: 11, y1: 5, traits: { nightlife: 0.3, industry: 1.5, port: 1.2, wealth: 0.4 } },
] });
const isVoid = (x, y) => y === 5 || (y === 0 && x >= 10);

test('nothing is ever opened on a missing block: it is outside the city', () => {
  const c = shaped();
  assert.throws(() => T.open(c, 3, 5, { owner: 'Callahan', kind: 'speakeasy' }), /3,5 is outside town/);
  assert.throws(() => T.settle(c, 'dutch', 11, 0), /outside town/);
  T.open(c, 3, 4, { owner: 'Callahan', kind: 'speakeasy' });
});

test('the rivals, the key places and the family\'s men all keep to the real blocks, year after year', () => {
  const c = shaped(), f = family();
  T.seed(c, 'Callahan', 14); // (a town this small has no room for the six key places)
  const l = T.landing(c);
  assert.ok(!isVoid(l.x, l.y));
  assert.ok(T.spots(c).length > 0 && T.spots(c).every((s) => !isVoid(s.x, s.y)));
  T.settle(c, 'dutch', l.x, l.y); T.join(f, 'dutch');
  for (let i = 0; i < 10; i++) {
    year(c, f, 12);
    assert.ok(T.frontier(c, 'dutch').every((s) => !isVoid(s.x, s.y)));
    for (const p of T.places(c)) assert.ok(!isVoid(p.x, p.y), p.owner + ' built on a missing block at ' + p.x + ',' + p.y);
  }
  assert.ok(T.places(c).length > 20, 'the city did fill up');
});

test('a missing block belongs to nobody, and the shares of the city are counted over the real blocks', () => {
  const c = shaped();
  T.open(c, 3, 4, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  assert.deepEqual(T.hold(c, 3, 5), { family: 0, rival: 0 });
  assert.equal(T.grip(c, 3, 5), null);
  const s = T.share(c), full = T.createCity({ id: 'town', w: 12, h: 6, zones: c.zones });
  T.open(full, 3, 4, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  assert.ok(Math.abs(s.family + s.rival + s.contested + s.free - 100) < 1e-9);
  assert.ok(s.rival > T.share(full).rival, 'the same streets are a bigger part of a smaller city');
});

test('the screen is told which blocks are missing, and what lies there', () => {
  const c = shaped(), v = T.view(c, family());
  assert.equal(v.blocks.length, 72, 'the rectangle is still whole');
  const b = (x, y) => v.blocks.find((q) => q.x === x && q.y === y);
  assert.equal(b(3, 5).void, 'water');
  assert.equal(b(11, 0).void, 'waste');
  assert.deepEqual([b(3, 5).grip, b(3, 5).family, b(3, 5).rival], [null, 0, 0]);
  assert.ok(!('void' in b(3, 4)));
  assert.equal(v.blocks.filter((q) => q.void).length, 14);
});

test('a city saved before cities had a shape plays on as a full rectangle', () => {
  const c = shaped(), f = family();
  delete c.voids;
  T.open(c, 3, 5, { owner: 'Callahan', kind: 'speakeasy' });
  assert.ok(!T.view(c, f).blocks.some((q) => q.void));
});

// --- the six cities of the map ---

test('every city of the map has its own outline: some blocks missing, mostly on its edges, never the same drawing twice', () => {
  const g = E.createGame({ capo: 'dutch' }), seen = new Set();
  for (const c of E.view(g).cities) {
    const gone = c.blocks.filter((b) => b.void), part = gone.length / c.blocks.length;
    assert.ok(part >= 0.05 && part <= 0.2, c.id + ': ' + Math.round(part * 100) + ' % of its blocks are missing');
    assert.ok(gone.every((b) => ['water', 'rail', 'waste'].includes(b.void)));
    assert.ok(new Set(gone.map((b) => b.void)).size >= 2, c.id + ' has more than one kind of gap');
    // a gap always touches the edge of the rectangle or another gap: no hole in the middle of a street
    const k = (x, y) => x + ',' + y, set = new Set(gone.map((b) => k(b.x, b.y)));
    for (const b of gone) {
      const edge = b.x === 0 || b.y === 0 || b.x === c.w - 1 || b.y === c.h - 1;
      assert.ok(edge || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(k(b.x + dx, b.y + dy))), c.id + ': a lone hole at ' + k(b.x, b.y));
    }
    const drawing = gone.map((b) => k(b.x, b.y) + b.void).sort().join(' ');
    assert.ok(!seen.has(drawing), c.id + ' looks like another city'); seen.add(drawing);
    for (const p of c.places) assert.ok(!set.has(k(p.x, p.y)), c.id + ': a place stands on a gap');
    // every street name keeps most of its blocks
    for (const z of c.zones) {
      let all = 0, real = 0;
      for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) { all++; if (!set.has(k(x, y))) real++; }
      assert.ok(real / all >= 0.5, c.id + ' ' + z.name + ' keeps ' + real + ' of ' + all);
    }
  }
  assert.equal(seen.size, W.CITIES.length);
});

test('twenty years on the shaped map: the family still grows, and nothing is ever built on a gap', () => {
  const g = E.createGame({ capo: 'sal' });
  for (let i = 0; i < 240 * E.TICKS_PER_MONTH; i++) {
    g.paused = false; E.tick(g);
    if (i % 48) continue;
    for (const c of E.view(g).cities) {
      for (const a of c.asks) { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: true }); } catch (e) { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } }
      for (const q of c.feuds) E.command(g, { type: 'rule', city: c.id, id: q.id, winner: q.a });
      for (const d of c.doors) { const s = T.spots(g.cities.find((q) => q.id === c.id))[0]; try { E.command(g, { type: 'welcome', city: c.id, from: c.id, capo: d.capo, x: s.x, y: s.y }); } catch (e) { /* cannot pay yet */ } }
    }
  }
  for (const c of E.view(g).cities) {
    const set = new Set(c.blocks.filter((b) => b.void).map((b) => b.x + ',' + b.y));
    for (const p of c.places) assert.ok(!set.has(p.x + ',' + p.y));
  }
  assert.ok(E.view(g).cities[0].capos.length >= 2);
  const mine = E.view(g).cities[0].share.family;
  assert.ok(mine > 10, 'the family holds ' + Math.round(mine) + ' % of Ashport');
});

test('the first man sets foot in a corner the old family neglects: the rivals press on it no harder than a single place next door would', () => {
  const g = E.createGame({ capo: 'dutch' }), home = g.cities[0], club = T.places(home).find((p) => p.kind === 'club');
  assert.ok(T.hold(home, club.x, club.y).rival <= 14, 'the rivals press ' + T.hold(home, club.x, club.y).rival.toFixed(1) + ' on the first club');
});

test('the outlines take nothing from the old families: every city opens with the same places as on a full rectangle', () => {
  const shapedMap = E.view(E.createGame({ capo: 'dutch' })).cities.map((c) => c.places.map((p) => p.x + ',' + p.y + p.kind).sort().join(' '));
  const keep = W.CITIES.map((c) => c.gaps);
  W.CITIES.forEach((c) => { c.gaps = []; });
  let full;
  try { full = E.view(E.createGame({ capo: 'dutch' })).cities.map((c) => c.places.map((p) => p.x + ',' + p.y + p.kind).sort().join(' ')); } finally { W.CITIES.forEach((c, i) => { c.gaps = keep[i]; }); }
  assert.deepEqual(shapedMap, full);
});
