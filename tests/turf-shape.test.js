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
  assert.throws(() => T.open(c, 3, 5, { owner: 'Callahan', kind: 'speakeasy' }), /3,5 is outside Town/);
  assert.throws(() => T.settle(c, 'dutch', 11, 0), /outside Town/);
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

// --- street names of any shape ---

// The same town, but Lantern Row runs under The Works along the south and The Works takes a bite out of it in the north.
const bent = () => {
  const streets = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) streets.push(y >= 4 ? (x < 9 ? 0 : 1) : y === 0 ? (x < 4 ? 0 : 1) : (x < 6 ? 0 : 1));
  return T.createCity({ id: 'town', w: 12, h: 6, streets, zones: shaped().zones.map((z) => ({ name: z.name, traits: z.traits })) });
};

test('a street name can be any shape: every block knows which one it is on', () => {
  const c = bent();
  assert.equal(T.zoneOf(c, 8, 5).name, 'Lantern Row');
  assert.equal(T.zoneOf(c, 4, 0).name, 'The Works');
  assert.equal(T.zoneOf(c, 5, 1).name, 'Lantern Row');
  assert.equal(T.zoneOf(c, 9, 5).name, 'The Works');
});

test('the screen is told the street name of every block, and the box each name fits in', () => {
  const v = T.view(bent(), family());
  const b = (x, y) => v.blocks.find((q) => q.x === x && q.y === y);
  assert.deepEqual([b(8, 5).zone, b(4, 0).zone, b(5, 1).zone, b(9, 5).zone], [0, 1, 0, 1]);
  assert.deepEqual(v.zones, [{ name: 'Lantern Row', x0: 0, y0: 0, x1: 8, y1: 5 }, { name: 'The Works', x0: 4, y0: 0, x1: 11, y1: 5 }]);
});

test('a place is worth what its own street name makes it, wherever the name bends', () => {
  const c = bent(), plain = shaped();
  assert.ok(T.worth(c, 8, 5, 'speakeasy') > T.worth(plain, 8, 5, 'speakeasy'), 'the south-east corner is Lantern Row now: a better street for a speakeasy');
});

test('a city saved when street names were rectangles keeps them, and the screen is still told block by block', () => {
  const c = shaped(), v = T.view(c, family());
  assert.ok(!c.streets);
  assert.ok(v.blocks.every((b) => b.zone === (b.x < 6 ? 0 : 1)));
});

test('a city whose blocks do not all have a street name is refused', () => {
  assert.throws(() => T.createCity({ id: 'town', w: 12, h: 6, streets: [0, 1, 0], zones: shaped().zones }), /town: 72 blocks, 3 street names/);
  const bad = []; for (let i = 0; i < 72; i++) bad.push(i ? 0 : 2);
  assert.throws(() => T.createCity({ id: 'town', w: 12, h: 6, streets: bad, zones: shaped().zones }), /town: no street name 2/);
});

// --- the six cities of the map ---

test('the street names of a city are of unequal sizes and none is a plain rectangle, yet each is in one piece', () => {
  const g = E.createGame({ capo: 'dutch' });
  for (const c of E.view(g).cities) {
    const sizes = c.zones.map((z, n) => c.blocks.filter((b) => b.zone === n).length);
    assert.equal(sizes.reduce((a, b) => a + b, 0), c.w * c.h, c.id + ': every block has a street name');
    assert.ok(Math.min(...sizes) >= 14, c.id + ': a street name of ' + Math.min(...sizes) + ' blocks');
    assert.ok(Math.max(...sizes) >= 1.6 * Math.min(...sizes), c.id + ': street names all about the same size, ' + sizes.join(' '));
    c.zones.forEach((z, n) => {
      const mine = c.blocks.filter((b) => b.zone === n), k = (x, y) => x + ',' + y, set = new Set(mine.map((b) => k(b.x, b.y)));
      assert.ok(mine.every((b) => b.x >= z.x0 && b.x <= z.x1 && b.y >= z.y0 && b.y <= z.y1), c.id + ' ' + z.name + ' spills out of its box');
      assert.ok(mine.length < (z.x1 - z.x0 + 1) * (z.y1 - z.y0 + 1), c.id + ' ' + z.name + ' is a plain rectangle');
      const seen = new Set([k(mine[0].x, mine[0].y)]), todo = [mine[0]];
      while (todo.length) {
        const b = todo.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = k(b.x + dx, b.y + dy); if (set.has(q) && !seen.has(q)) { seen.add(q); todo.push({ x: b.x + dx, y: b.y + dy }); } }
      }
      assert.equal(seen.size, mine.length, c.id + ' ' + z.name + ' is in ' + 'more than one piece');
    });
  }
});

test('a picture of a city that is the wrong size, or uses a letter no street name has, is refused', () => {
  const spec = JSON.parse(JSON.stringify(W.CITIES[0]));
  spec.streets = spec.streets.slice(0, 11);
  assert.throws(() => E.layout(spec), /ashport: 11 rows of street names, 12 expected/);
  spec.streets = W.CITIES[0].streets.slice(); spec.streets[3] = spec.streets[3].slice(0, 5) + 'z' + spec.streets[3].slice(6);
  assert.throws(() => E.layout(spec), /ashport: no street name for 'z' at 5,3/);
  spec.streets = W.CITIES[0].streets.slice(); spec.streets[3] = spec.streets[3] + 'a';
  assert.throws(() => E.layout(spec), /ashport: row 3 is 21 blocks long, 20 expected/);
});

test('every city of the map has its own outline: some blocks missing, mostly on its edges, never the same drawing twice', () => {
  const g = E.createGame({ capo: 'dutch' }), seen = new Set();
  for (const c of E.view(g).cities) {
    const gone = c.blocks.filter((b) => b.void), part = gone.length / c.blocks.length;
    assert.ok(part >= 0.18 && part <= 0.3, c.id + ': ' + Math.round(part * 100) + ' % of its blocks are missing');
    // every side of the rectangle is bitten, none of them all the way along, and never to the same depth all along
    const sides = { north: (i, d) => [i, d], south: (i, d) => [i, c.h - 1 - d], west: (i, d) => [d, i], east: (i, d) => [c.w - 1 - d, i] };
    for (const side of Object.keys(sides)) {
      const long = side === 'north' || side === 'south' ? c.w : c.h, depths = [];
      for (let i = 0; i < long; i++) { let d = 0; while (d < 4 && gone.some((b) => b.x === sides[side](i, d)[0] && b.y === sides[side](i, d)[1])) d++; depths.push(d); }
      assert.ok(depths.some((d) => d > 0), c.id + ': its ' + side + ' side is a straight line');
      assert.ok(depths.some((d) => d === 0), c.id + ': its ' + side + ' side is gone altogether');
      let turns = 0; for (let i = 1; i < long; i++) if (depths[i] !== depths[i - 1]) turns++;
      assert.ok(turns >= 3, c.id + ': its ' + side + ' side only turns ' + turns + ' times');
    }
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
    c.zones.forEach((z, n) => {
      const all = c.blocks.filter((b) => b.zone === n), real = all.filter((b) => !b.void);
      assert.ok(real.length / all.length >= 0.5, c.id + ' ' + z.name + ' keeps ' + real.length + ' of ' + all.length);
    });
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
  const shapedMap = E.view(E.createGame({ capo: 'dutch' })).cities.map((c) => c.places.filter((p) => p.kind !== 'hq').map((p) => p.x + ',' + p.y + p.kind).sort().join(' '));
  const keep = W.CITIES.map((c) => c.gaps);
  W.CITIES.forEach((c) => { c.gaps = []; });
  let full;
  try { full = E.view(E.createGame({ capo: 'dutch' })).cities.map((c) => c.places.filter((p) => p.kind !== 'hq').map((p) => p.x + ',' + p.y + p.kind).sort().join(' ')); } finally { W.CITIES.forEach((c, i) => { c.gaps = keep[i]; }); }
  assert.deepEqual(shapedMap, full);
});
