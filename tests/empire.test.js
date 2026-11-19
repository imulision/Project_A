// The game without districts, as the screen sees it: time, orders, what to draw, saving.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');
const W = require('../web/world.js');

const months = (g, n) => { const out = []; for (let i = 0; i < n * E.TICKS_PER_MONTH; i++) { out.push(...E.tick(g)); if (g.paused) E.command(g, { type: 'resume' }); } return out; };

test('before the boss picks his first capo there is no city to play, only six faces', () => {
  const g = E.createGame();
  assert.equal(g.started, false);
  assert.deepEqual(E.tick(g), []);
  const faces = E.candidates(g);
  assert.equal(faces.length, 6);
  const sal = faces.find((c) => c.id === 'sal');
  assert.deepEqual([sal.name, sal.specialty, sal.muscle, sal.way, sal.trade], ['Sal "the Hammer" Moretti', 'Enforcer', 8, 'force', 'Loan office']);
  assert.ok(sal.likes.length && Array.isArray(sal.refuses));
  assert.throws(() => E.command(g, { type: 'start', capo: 'nobody' }), /unknown capo/);
});

test('the game starts in Ashport: the Callahans hold the six key places, the first capo has his club', () => {
  const g = E.createGame();
  E.command(g, { type: 'start', capo: 'dutch' });
  assert.equal(g.started, true);
  const v = E.view(g);
  const a = v.cities[0];
  assert.equal(a.id, 'ashport'); assert.equal(a.name, 'Ashport');
  assert.deepEqual(a.zones.map((z) => z.name), W.CITIES[0].districts.map((d) => d.name));
  assert.equal(a.blocks.length, a.w * a.h);
  assert.ok(a.blocks.every((b) => a.zones.some((z) => b.x >= z.x0 && b.x <= z.x1 && b.y >= z.y0 && b.y <= z.y1)), 'every block is on a named street');
  assert.equal(a.keys.length, 6);
  assert.ok(a.keys.every((k) => k.owner === a.rival));
  assert.deepEqual(a.capos.map((c) => c.id), ['dutch']);
  assert.throws(() => E.command(g, { type: 'start', capo: 'sal' }), /already started/);
});

test('four ticks make a month, the date moves, and what happens is written in the journal', () => {
  const g = E.createGame({ capo: 'dutch' });
  assert.equal(E.hud(g).date, 'January 1926');
  for (let i = 0; i < E.TICKS_PER_MONTH - 1; i++) assert.deepEqual(E.tick(g), []);
  const events = E.tick(g);
  assert.ok(events.some((e) => e.type === 'opened'));
  assert.equal(E.hud(g).date, 'February 1926');
  assert.deepEqual([g.journal[0].type, g.journal[0].date], ['opened', 'January 1926']);
  assert.ok(g.journal[0].label);
  E.command(g, { type: 'speed', speed: 4 });
  assert.equal(E.tick(g).length > 0 || E.hud(g).date === 'March 1926', true);
  assert.equal(E.hud(g).date, 'March 1926');
  E.command(g, { type: 'pause' });
  assert.deepEqual(E.tick(g), []);
  assert.equal(E.hud(g).date, 'March 1926');
  assert.throws(() => E.command(g, { type: 'speed', speed: 3 }), /speed/);
  assert.throws(() => E.command(g, { type: 'dance' }), /no such order/);
});

test('the hud is the family at a glance', () => {
  const g = E.createGame({ capo: 'dutch' });
  months(g, 6);
  const h = E.hud(g), a = E.view(g).cities[0];
  assert.deepEqual([h.dirty, h.clean], [Math.round(g.family.dirty), Math.round(g.family.clean)]);
  assert.equal(h.heat, a.heat);
  assert.equal(h.men, 1);
  assert.deepEqual(h.seats, a.seats);
  assert.equal(h.pending, a.asks.length + a.doors.length);
  assert.deepEqual([h.paused, h.speed], [false, 1]);
});

test('time stops when someone needs the boss\'s word, and his orders reach the rules', () => {
  const g = E.createGame({ capo: 'dutch' });
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) knock = E.tick(g).find((e) => e.type === 'knocks');
  assert.ok(knock, 'somebody knocks sooner or later');
  assert.equal(g.paused, true);
  const door = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo);
  g.family.clean = 0; g.family.dirty = door.cost;
  const spot = T.spots(g.cities[0])[0];
  assert.throws(() => E.command(g, { type: 'welcome', city: 'ashport', capo: 'nobody', x: spot.x, y: spot.y }), /not at the door/);
  E.command(g, { type: 'welcome', city: 'ashport', capo: knock.capo, x: spot.x, y: spot.y });
  assert.equal(E.hud(g).men, 2);
  assert.equal(g.journal[g.journal.length - 1].type, 'welcomed');
  g.family.clean = 1000;
  E.command(g, { type: 'research', building: 'loans' });
  assert.equal(E.view(g).tree.find((t) => t.kind === 'loans').studying > 0, true);
  assert.throws(() => E.command(g, { type: 'answer', city: 'ashport', id: 'ashport:port', yes: true }), /nobody is asking/);
  assert.throws(() => E.command(g, { type: 'welcome', city: 'paris', capo: 'sal', x: 0, y: 0 }), /no such city/);
});

test('a saved game comes back the same and plays on the same way', () => {
  const a = E.createGame({ capo: 'vince' });
  months(a, 30);
  const b = E.load(E.save(a));
  assert.deepEqual(E.view(b), E.view(a));
  assert.deepEqual(months(b, 12).map((e) => e.label), months(a, 12).map((e) => e.label));
  assert.deepEqual(E.hud(b), E.hud(a));
});

test('a game saved by the old district rules is refused in plain words, never half loaded', () => {
  assert.throws(() => E.load(JSON.stringify({ version: 1, world: {} })), /older version/);
  assert.throws(() => E.load('not a game'), /cannot be read/);
  assert.equal(JSON.parse(E.save(E.createGame({ capo: 'mae' }))).version, E.VERSION);
});

test('the journal keeps the last two hundred lines', () => {
  const g = E.createGame({ capo: 'danny' });
  months(g, 240);
  assert.ok(g.journal.length <= E.JOURNAL_SIZE);
  assert.ok(g.journal.length > 50);
});

test('a feud stops the clock, and the boss rules through an order', () => {
  const g = E.createGame({ capo: 'dutch' });
  const c = g.cities[0];
  T.settle(c, 'danny', 0, 0); T.join(g.family, 'danny');
  c.grudge = { 'danny|dutch': T.RULES.feud };
  let feud = null;
  for (let i = 0; i < E.TICKS_PER_MONTH && !feud; i++) feud = E.tick(g).find((e) => e.type === 'feud');
  assert.ok(feud);
  assert.equal(g.paused, true);
  assert.equal(E.hud(g).pending, 1 + E.view(g).cities[0].doors.length);
  assert.equal(E.view(g).cities[0].feuds[0].id, feud.id);
  E.command(g, { type: 'rule', city: 'ashport', id: feud.id, winner: 'dutch' });
  assert.deepEqual(E.view(g).cities[0].feuds, []);
  const line = g.journal[g.journal.length - 1];
  assert.deepEqual([line.type, line.winner, line.loser], ['ruled', 'dutch', 'danny']);
  assert.match(line.label, /Dutch/);
});

test('the boss parts with a capo through an order, and the journal says how', () => {
  const g = E.createGame({ capo: 'dutch' });
  const c = g.cities[0];
  T.settle(c, 'danny', 0, 0); T.join(g.family, 'danny');
  const ways = E.view(g).cities[0].capos.find((m) => m.id === 'danny').partings;
  assert.deepEqual(ways.map((w) => w.way), ['retire', 'kill', 'jail']);
  assert.throws(() => E.command(g, { type: 'part', city: 'ashport', capo: 'danny', way: 'retire' }), /clean money/);
  E.command(g, { type: 'part', city: 'ashport', capo: 'danny', way: 'kill' });
  assert.deepEqual(E.view(g).cities[0].capos.map((m) => m.id), ['dutch']);
  const line = g.journal[g.journal.length - 1];
  assert.deepEqual([line.type, line.capo, line.way], ['parted', 'danny', 'kill']);
  assert.match(line.label, /Danny/);
  assert.equal(E.hud(g).heat, T.RULES.out.blood);
});

// --- six cities ---

test('the game holds the six cities of the map, each with the family that was there first; the boss starts in Ashport alone', () => {
  const g = E.createGame({ capo: 'dutch' }), v = E.view(g);
  assert.deepEqual(v.cities.map((c) => c.id), W.CITIES.map((c) => c.id));
  assert.deepEqual(v.cities.map((c) => c.rival), W.CITIES.map((c) => c.rival));
  for (const c of v.cities) {
    const spec = W.CITIES.find((q) => q.id === c.id);
    assert.equal(c.name, spec.name);
    assert.deepEqual(c.zones.map((z) => z.name), spec.districts.map((d) => d.name));
    assert.equal(c.keys.length, 6);
    assert.ok(c.places.filter((p) => p.owner === c.rival).length > 15, c.id + ' is somebody\'s');
    assert.equal(c.held, c.id === 'ashport');
  }
  assert.deepEqual(v.routes, W.ROUTES.map((r) => ({ from: r.from, to: r.to, kind: r.kind })));
  const marrow = v.cities.find((c) => c.id === 'marrow'), vesper = v.cities.find((c) => c.id === 'vesper');
  assert.notDeepEqual(marrow.places.map((p) => p.x + ',' + p.y), vesper.places.map((p) => p.x + ',' + p.y), 'no two cities are laid out alike');
});

test('the hud counts the whole map: the cities the family is in, its seats there, its share of every street', () => {
  const g = E.createGame({ capo: 'dutch' });
  months(g, 6);
  const h = E.hud(g), v = E.view(g);
  assert.deepEqual(h.cities, { held: 1, total: 6 });
  assert.deepEqual(h.seats, v.cities[0].seats, 'seats of a city the family is not in do not count');
  const blocks = v.cities.reduce((n, c) => n + c.w * c.h, 0), ours = v.cities.reduce((n, c) => n + c.share.family * c.w * c.h / 100, 0);
  assert.equal(h.share, Math.round(ours * 100 / blocks));
  assert.ok(h.share < v.cities[0].share.family);
});

const knocking = () => {
  const g = E.createGame({ capo: 'dutch' }), c = g.cities[0], club = T.clubOf(c, 'dutch');
  const near = T.spots(c).find((s) => Math.max(Math.abs(s.x - club.x), Math.abs(s.y - club.y)) === 1);
  T.open(c, near.x, near.y, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  g.family.dirty = 20000;
  return g;
};

test('a man at the door can be sent down the road to a city next door, and the door says which and for how much', () => {
  const g = knocking(), d = E.view(g).cities[0].doors.find((q) => q.capo === 'danny');
  assert.deepEqual(d.roads.map((r) => r.city).sort(), ['calder', 'dunmore', 'marrow']);
  assert.ok(d.roads.every((r) => r.name && r.cost === d.cost + T.RULES.doors.road));
  const calder = g.cities.find((c) => c.id === 'calder'), spot = T.landing(calder);
  assert.ok(T.spots(calder).some((s) => s.x === spot.x && s.y === spot.y));
  assert.throws(() => E.command(g, { type: 'welcome', city: 'vesper', from: 'ashport', capo: 'danny', x: 1, y: 1 }), /no road/);
  E.command(g, { type: 'welcome', city: 'calder', from: 'ashport', capo: 'danny', x: spot.x, y: spot.y });
  assert.equal(g.family.dirty, 20000 - d.cost - T.RULES.doors.road);
  const v = E.view(g), there = v.cities.find((c) => c.id === 'calder');
  assert.deepEqual(there.capos.map((m) => m.id), ['danny']);
  assert.equal(there.held, true);
  assert.deepEqual(v.cities[0].capos.map((m) => m.id), ['dutch']);
  assert.deepEqual(E.hud(g).cities, { held: 2, total: 6 });
  const line = g.journal[g.journal.length - 1];
  assert.deepEqual([line.type, line.capo, line.city, line.from], ['welcomed', 'danny', 'calder', 'ashport']);
  assert.match(line.label, /Calder Falls/);
  assert.ok(months(g, 12).some((e) => e.type === 'opened' && e.capo === 'danny' && e.city === 'calder'), 'and he goes to work there');
});

test('twenty years of the six cities play in well under two seconds', () => {
  const g = knocking(), t = Date.now();
  months(g, 240);
  assert.ok(Date.now() - t < 2000, 'took ' + (Date.now() - t) + ' ms');
});
