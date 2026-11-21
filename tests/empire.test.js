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

test('eight ticks make a month, the date moves, and what happens is written in the journal', () => {
  const g = E.createGame({ capo: 'dutch' });
  assert.equal(E.hud(g).date, 'January 1926');
  for (let i = 0; i < E.TICKS_PER_MONTH - 1; i++) assert.deepEqual(E.tick(g), []);
  const events = E.tick(g);
  assert.ok(events.some((e) => e.type === 'opened'));
  assert.equal(E.hud(g).date, 'February 1926');
  assert.deepEqual([g.journal[0].type, g.journal[0].date], ['opened', 'January 1926']);
  assert.ok(g.journal[0].label);
  E.command(g, { type: 'speed', speed: 4 });
  E.tick(g); // at speed 4 a month is two beats
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

test('every city has its own three lieutenants: no man answers for places in two cities', () => {
  const g = E.createGame({ capo: 'dutch' }), v = E.view(g), seen = {};
  for (const c of v.cities) {
    assert.equal(c.lieutenants.length, 3, c.id);
    for (const l of c.lieutenants) {
      assert.equal(seen[l.id], undefined, l.name + ' is in ' + seen[l.id] + ' and ' + c.id);
      seen[l.id] = c.id;
      const p = T.PEOPLE[l.id];
      assert.deepEqual([p.lieutenant, p.home], [c.rival, c.id]);
      assert.ok(T.tradeOf(l.id) && l.places >= 3, l.name + ' holds a real zone');
    }
    assert.ok(c.places.filter((p) => p.owner === c.rival && p.kind !== 'key').every((p) => seen[p.man] === c.id));
  }
  assert.equal(new Set(Object.keys(seen).map((id) => T.PEOPLE[id].name)).size, 18, 'eighteen names, all different');
});

// A boss who says yes to everything and sends every newcomer down the road when he can, through orders alone.
const spreader = (start, years = 20) => {
  const g = E.createGame({ capo: start }), f = g.family;
  const order = (o) => { try { E.command(g, o); return true; } catch (e) { if (!/no seat|cannot pay|not at the door|clean money/.test(e.message)) throw e; return false; } };
  for (let m = 1; m <= years * 12; m++) {
    months(g, 1);
    for (const c of E.view(g).cities) {
      for (const a of c.asks) order({ type: 'answer', city: c.id, id: a.id, yes: T.funds(f) >= a.cost });
      for (const q of c.feuds) order({ type: 'rule', city: c.id, id: q.id, winner: q.a });
      for (const d of c.doors) {
        const now = E.view(g).cities, road = d.roads.find((r) => !now.find((q) => q.id === r.city).held) || d.roads[0];
        const to = g.cities.find((q) => q.id === (road ? road.city : c.id));
        const quiet = T.landing(to), spot = T.spots(to).find((q) => q.x === quiet.x && q.y === quiet.y) || T.spots(to)[0]; // where the rivals press least
        if (spot && !(road && order({ type: 'welcome', city: to.id, from: c.id, capo: d.capo, x: spot.x, y: spot.y }))) {
          const here = T.spots(g.cities.find((q) => q.id === c.id))[0];
          if (here) order({ type: 'welcome', city: c.id, capo: d.capo, x: here.x, y: here.y });
        }
      }
    }
    const t = E.view(g).tree.filter((q) => q.next).sort((x, y) => x.tier - y.tier)[0];
    if (!f.study && t && f.clean >= t.next.cost) order({ type: 'research', building: t.kind });
  }
  return g;
};

test('twenty years of sending men down the road: several cities, never the whole map, and money that still counts', () => {
  for (const start of ['sal', 'dutch', 'tommy']) {
    const g = spreader(start), h = E.hud(g), v = E.view(g);
    assert.ok(h.cities.held >= 3, start + ' is in ' + h.cities.held + ' cities');
    assert.ok(h.share >= 10 && h.share <= 90, start + ' holds ' + h.share + ' % of the map');
    assert.ok(v.cities.filter((c) => c.share.family >= 20).length >= 2, start + ' really holds two cities');
    assert.ok(h.clean < 1000000, start + ' sits on $' + h.clean);
    assert.ok(h.men >= 8, start + ' has ' + h.men + ' men');
  }
});

test('the boss starts with enough dirty money to take in the first man who knocks, within two years', () => {
  for (const start of E.NAMES) {
    const g = E.createGame({ capo: start });
    assert.equal(E.hud(g).dirty, E.START_CASH);
    let taken = null;
    for (let m = 1; m <= 24 && !taken; m++) {
      months(g, 1);
      const d = E.view(g).cities[0].doors[0], spot = T.spots(g.cities[0])[0];
      if (d) { E.command(g, { type: 'welcome', city: 'ashport', capo: d.capo, x: spot.x, y: spot.y }); taken = m; }
    }
    assert.ok(taken, start + ': nobody could be taken in during the first two years');
    assert.equal(E.hud(g).men, 2);
  }
});

test('the hud says how much the two kinds of money moved last month', () => {
  const g = E.createGame({ capo: 'dutch' });
  assert.deepEqual(E.hud(g).change, { dirty: 0, clean: 0 });
  months(g, 3);
  const before = E.hud(g);
  months(g, 1);
  const h = E.hud(g);
  assert.deepEqual(h.change, { dirty: h.dirty - before.dirty, clean: h.clean - before.clean });
  assert.ok(h.change.dirty > 0, 'the first capo already sends something up');
  assert.deepEqual(E.hud(E.load(E.save(g))).change, h.change);
});

// --- the clock never stops for a word the boss cannot give ---
const firstKnock = (prepare) => {
  const g = E.createGame({ capo: 'dutch' });
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) { prepare(g); knock = E.tick(g).find((e) => e.type === 'knocks'); }
  return { g, knock };
};

test('a man the boss cannot afford knocks without stopping the clock, and the door says nothing can be done yet', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 0; g.family.clean = 0; });
  assert.ok(knock, 'he knocks all the same');
  assert.equal(g.paused, false, 'no word can be given: time goes on');
  const door = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo);
  assert.equal(door.open, false);
  assert.equal(E.hud(g).pending, 0, 'and nothing is counted as waiting for the boss');
});

test('the day the boss can afford him, the man knocks again and the clock stops', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 0; g.family.clean = 0; });
  g.family.dirty = 50000;
  let again = null;
  for (let i = 0; i < 2 * E.TICKS_PER_MONTH && !again; i++) again = E.tick(g).find((e) => e.type === 'knocks');
  assert.ok(again, 'he is announced again');
  assert.deepEqual([again.capo, again.ready], [knock.capo, true]);
  assert.match(again.label, /can now be taken in/);
  assert.equal(g.paused, true);
  const door = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo);
  assert.equal(door.open, true);
  assert.ok(E.hud(g).pending >= 1);
  E.command(g, { type: 'resume' });
  let third = null;
  for (let i = 0; i < 3 * E.TICKS_PER_MONTH && !third; i++) { g.family.dirty = 50000; third = E.tick(g).find((e) => e.type === 'knocks' && e.capo === knock.capo) || null; if (g.paused) E.command(g, { type: 'resume' }); }
  assert.equal(third, null, 'once announced as ready, he does not knock every month');
});

test('a man who can only be sent down the road counts as one the boss can answer', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 0; g.family.clean = 0; });
  const c = g.cities[0];
  // no seat left in Ashport
  for (const id of ['sal', 'mae', 'tommy', 'vince', 'danny'].filter((k) => k !== knock.capo)) { const s = T.spots(c)[0]; if (T.seats(c).taken < T.seats(c).total) { T.settle(c, id, s.x, s.y); T.join(g.family, id); } }
  assert.equal(T.seats(c).taken, T.seats(c).total);
  const road = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo).roads[0];
  assert.ok(road, 'a city next door has a seat');
  g.family.dirty = road.cost - 1;
  assert.equal(E.view(g).cities[0].doors.find((d) => d.capo === knock.capo).open, false, 'one dollar short of the road');
  g.family.dirty = road.cost;
  assert.equal(E.view(g).cities[0].doors.find((d) => d.capo === knock.capo).open, true);
});

// --- the boss's table, from the game ---
test('the boss gives a man at the door a chair at the table, and takes it back', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 20000; });
  const door = E.view(g).cities.find((c) => c.id === knock.city).doors.find((d) => d.capo === knock.capo);
  assert.deepEqual(door.chairs, ['bookkeeper', 'routes', 'fixer'], 'the door says which chairs are free');
  assert.deepEqual(E.view(g).table.map((s) => s.capo), [null, null, null]);
  E.command(g, { type: 'seat', city: knock.city, capo: knock.capo, post: 'fixer' });
  assert.equal(E.view(g).table[2].capo, knock.capo);
  const said = g.journal[g.journal.length - 1];
  assert.deepEqual([said.type, said.capo, said.post], ['seated', knock.capo, 'fixer']);
  assert.equal(said.label, T.person(knock.capo).name + ' takes the Fixer\'s chair at the table');
  assert.ok(!E.view(g).cities.some((c) => c.doors.some((d) => d.capo === knock.capo)));
  E.command(g, { type: 'unseat', post: 'fixer' });
  assert.equal(E.view(g).table[2].capo, null);
  assert.equal(g.journal[g.journal.length - 1].label, T.person(knock.capo).name + ' leaves the table, and the family');
});

test('the door lists only the chairs still free', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 20000; });
  const door = () => E.view(g).cities.find((q) => q.id === knock.city).doors.find((d) => d.capo === knock.capo);
  const others = ['gus', 'jim', 'walt'].filter((id) => id !== knock.capo);
  g.family.table = { bookkeeper: others[0], routes: others[1] };
  assert.deepEqual(door().chairs, ['fixer']);
  assert.throws(() => E.command(g, { type: 'seat', city: knock.city, capo: knock.capo, post: 'routes' }), /the Routes's chair is taken/);
});

// --- the underboss, from the game ---
test('the boss names an underboss; from then on the men at that city\'s door no longer wait for his word', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 20000; });
  const c = g.cities.find((q) => q.id === knock.city), spot = T.spots(c)[0];
  assert.throws(() => E.command(g, { type: 'underboss', city: c.id, capo: 'dutch' }), /needs no underboss yet/);
  E.command(g, { type: 'welcome', city: c.id, capo: knock.capo, x: spot.x, y: spot.y });
  E.command(g, { type: 'underboss', city: c.id, capo: 'dutch' });
  const said = g.journal[g.journal.length - 1];
  assert.deepEqual([said.type, said.capo, said.city], ['underboss', 'dutch', c.id]);
  assert.equal(said.label, T.person('dutch').name + ' is now the family\'s underboss in ' + E.view(g).cities.find((q) => q.id === c.id).name);
  assert.equal(E.view(g).cities.find((q) => q.id === c.id).under, 'dutch');
  // twenty years: nobody knocks in that city any more, and the family still grows there
  let knocks = 0, joined = 0;
  for (let i = 0; i < 4 * 240; i++) {
    g.paused = false;
    for (const e of E.tick(g)) { if (e.type === 'knocks' && e.city === c.id && e.door !== 'poach') knocks++; if (e.type === 'welcomed' && e.by === 'dutch') joined++; }
    const v = E.view(g).cities.find((q) => q.id === c.id);
    for (const d of v.doors) if (d.door !== 'poach') assert.equal(d.handled, 'dutch');
  }
  assert.equal(knocks, 0);
  assert.ok(joined >= 1, 'he took ' + joined + ' men in');
});

test('a man the underboss could not take in for want of money is not announced to the boss the day the money comes', () => {
  const { g, knock } = firstKnock((g) => { g.family.dirty = 20000; });
  const c = g.cities.find((q) => q.id === knock.city), spot = T.spots(c)[0];
  E.command(g, { type: 'welcome', city: c.id, capo: knock.capo, x: spot.x, y: spot.y });
  E.command(g, { type: 'underboss', city: c.id, capo: 'dutch' });
  const waiting = () => E.view(g).cities.find((q) => q.id === c.id).doors.filter((d) => d.door !== 'poach');
  for (let i = 0; i < 4000 && !waiting().length; i++) { g.paused = false; g.family.dirty = 0; g.family.clean = 0; E.tick(g); }
  assert.ok(waiting().length, 'a man waits at the door of a broke family');
  for (let i = 0; i < 8; i++) { g.paused = false; g.family.dirty = 0; g.family.clean = 0; E.tick(g); }
  assert.equal(E.hud(g).pending, E.view(g).cities.reduce((n, q) => n + q.asks.length + q.feuds.length + q.doors.filter((d) => d.open && !d.handled).length, 0), 'he does not count among what waits for the boss');
  g.family.dirty = 20000;
  const seen = [];
  for (let i = 0; i < 8; i++) { g.paused = false; seen.push(...E.tick(g)); }
  assert.ok(!seen.some((e) => e.type === 'knocks' && e.city === c.id && e.door !== 'poach'), 'no knock');
  assert.ok(seen.some((e) => e.type === 'welcomed' && e.by === 'dutch'), 'the underboss took him in');
});

test('the last twenty-four months also say, city by city: the rival\'s strength, each capo\'s places and income, each street name\'s share', () => {
  const g = E.createGame({ capo: 'dutch' });
  for (let i = 0; i < 6 * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
  const v = E.view(g), a = v.cities[0], last = v.history[v.history.length - 1].cities.ashport, k = a.capos[0];
  assert.equal(last.rival, a.chief.strength);
  assert.deepEqual([last.capos.dutch.places, last.capos.dutch.income, last.capos.dutch.rank], [k.places, k.income, k.rank]); // (his books are there too: tests/turf-ledger.test.js)
  assert.deepEqual(Object.keys(last.capos), ['dutch']);
  assert.equal(last.zones.length, a.zones.length);
  a.zones.forEach((z, n) => {
    const real = a.blocks.filter((b) => b.zone === n && !b.void), ours = real.filter((b) => b.grip === 'family');
    assert.equal(last.zones[n], Math.round(100 * ours.length / real.length), z.name);
  });
  assert.ok(last.zones.some((s) => s > 0), 'the family holds some of one street name');
  assert.deepEqual(v.history[0].cities.calder.capos, {});
  // a game saved before keeps its shorter lines
  const old = E.load(E.save(g)); old.history.forEach((m) => { for (const id in m.cities) { delete m.cities[id].rival; delete m.cities[id].capos; delete m.cities[id].zones; } });
  assert.equal(E.view(old).history[0].cities.ashport.capos, undefined);
});

test('a capo shows how far he is from his next rank', () => {
  const g = E.createGame({ capo: 'dutch' }), k = () => E.view(g).cities[0].capos[0];
  assert.deepEqual(k().next, { rank: 1, name: T.RANKS[1], xp: 0, of: T.RULES.xp[1] });
  for (let i = 0; i < 6 * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
  assert.equal(k().next.xp, g.family.men.dutch.xp);
  assert.ok(k().next.xp > 0 && k().next.xp < k().next.of);
  g.family.men.dutch.rank = T.RANKS.length - 1;
  assert.equal(k().next, null, 'a legend has nowhere left to rise');
});

// --- loyalty, from the game ---
test('the boss makes a capo a gift; the game shows each man\'s mood and what a gift costs', () => {
  const g = E.createGame({ capo: 'vince' });
  const k = () => E.view(g).cities[0].capos[0];
  assert.equal(k().mood, 'restless');
  assert.deepEqual(k().gift, { cost: T.RULES.loyal.gift, wait: 0 });
  assert.throws(() => E.command(g, { type: 'gift', city: 'ashport', capo: 'vince' }), /clean money to make Vince a gift/);
  g.family.clean = 5000;
  E.command(g, { type: 'gift', city: 'ashport', capo: 'vince' });
  assert.equal(g.family.clean, 5000 - T.RULES.loyal.gift);
  assert.equal(k().mood, 'steady');
  const said = g.journal[g.journal.length - 1];
  assert.deepEqual([said.type, said.capo, said.city, said.cost], ['gift', 'vince', 'ashport', T.RULES.loyal.gift]);
  assert.equal(said.label, 'You make ' + T.person('vince').name + ' a gift');
  assert.ok(said.x !== undefined && said.y !== undefined, 'it happens at his club');
});

test('a betrayal is in the journal, and does not stop the clock for an answer nobody can give', () => {
  const g = E.createGame({ capo: 'dutch' });
  const c = g.cities[0], spot = T.spots(c)[0];
  T.settle(c, 'vince', spot.x, spot.y); T.join(g.family, 'vince').loyal = 0;
  let seen = [];
  for (let i = 0; i < (T.RULES.loyal.turns + 1) * E.TICKS_PER_MONTH && !seen.some((e) => e.type === 'betrayal'); i++) { g.paused = false; seen = seen.concat(E.tick(g)); }
  assert.ok(seen.some((e) => e.type === 'whispers'));
  const e = seen.find((x) => x.type === 'betrayal');
  assert.equal(e.capo, 'vince');
  assert.ok(g.journal.some((j) => j.type === 'betrayal' && j.capo === 'vince'));
  assert.ok(!E.view(g).cities[0].capos.some((q) => q.id === 'vince'));
});

// --- the last two years, month by month, for the curves of the screen ---

test('the game keeps the last twenty-four months: the two kinds of money, and each city\'s streets and what it sent up', () => {
  const g = E.createGame({ capo: 'dutch' });
  assert.deepEqual(E.view(g).history, []);
  const beat = (months) => { for (let i = 0; i < months * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); } };
  beat(3);
  const h = E.view(g).history;
  assert.deepEqual(h.map((m) => m.month), [1, 2, 3]);
  const last = h[2], v = E.view(g), hud = E.hud(g);
  assert.deepEqual([last.dirty, last.clean], [hud.dirty, hud.clean]);
  assert.deepEqual(Object.keys(last.cities), v.cities.map((c) => c.id));
  assert.equal(last.cities.ashport.share, Math.round(v.cities[0].share.family * 10) / 10);
  assert.equal(last.cities.ashport.income, Math.round(g.cities[0].flow.up));
  assert.equal(last.cities.calder.share, 0);
  beat(30);
  const later = E.view(g).history;
  assert.equal(later.length, 24);
  assert.deepEqual([later[0].month, later[23].month], [10, 33]);
  assert.ok(later.some((m) => m.cities.ashport.income > 0), 'Ashport sent money up');
});

test('the months kept are saved with the game, and a game saved before starts with none', () => {
  const g = E.createGame({ capo: 'sal' });
  for (let i = 0; i < 5 * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
  const back = E.load(E.save(g));
  assert.deepEqual(E.view(back).history, E.view(g).history);
  assert.equal(E.view(back).history.length, 5);
  delete back.history;
  assert.deepEqual(E.view(back).history, []);
  back.paused = false; for (let i = 0; i < E.TICKS_PER_MONTH; i++) E.tick(back);
  assert.equal(E.view(back).history.length, 1);
});

test('a month lasts eight beats at speed 1, four at speed 2 and two at speed 4', () => {
  assert.equal(E.TICKS_PER_MONTH, 8);
  for (const [speed, beats] of [[1, 8], [2, 4], [4, 2]]) {
    const g = E.createGame({ capo: 'dutch' });
    E.command(g, { type: 'speed', speed });
    for (let i = 0; i < beats - 1; i++) { E.tick(g); assert.equal(g.month, 0); }
    E.tick(g);
    assert.equal(g.month, 1, 'speed ' + speed);
  }
});

// --- a game begun before the cities had an outline ---

test('a game begun on the old square cities gets the outline and the street shapes when it is loaded, and loses no place', () => {
  const g = E.createGame({ capo: 'dutch' }), fresh = E.createGame({ capo: 'dutch' });
  for (let i = 0; i < 6 * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
  // as it was saved then: no gap on the sides, every street name a plain rectangle
  const gone = Object.keys(fresh.cities[0].voids)[0].split(',').map(Number);
  for (const c of g.cities) { c.voids = {}; delete c.streets; c.zones.forEach((z, i) => { z.x0 = 0; z.y0 = 0; z.x1 = c.w - 1; z.y1 = c.h - 1; }); }
  T.open(g.cities[0], gone[0], gone[1], { owner: 'family', kind: 'speakeasy', capo: 'dutch' }); // a place where the outline now passes
  const places = g.cities.map((c) => Object.keys(c.blocks).length);
  const back = E.load(E.save(g));
  back.cities.forEach((c, i) => {
    const f = fresh.cities[i];
    assert.deepEqual(c.streets, f.streets, c.id + ': the street shapes');
    assert.deepEqual(c.zones, f.zones, c.id + ': the street names');
    assert.equal(Object.keys(c.blocks).length, places[i], c.id + ': every place still stands');
    for (const k of Object.keys(c.blocks)) assert.ok(!c.voids[k], c.id + ': the block at ' + k + ' carries a place and stays');
    for (const k of Object.keys(f.voids)) assert.ok(c.blocks[k] || c.voids[k] === f.voids[k], c.id + ': ' + k + ' is outside the city');
    for (const k of Object.keys(c.voids)) assert.ok(f.voids[k]);
  });
  assert.ok(Object.keys(back.cities[0].voids).length > 20);
  assert.ok(!back.cities[0].voids[gone.join(',')]);
  for (let i = 0; i < 12 * E.TICKS_PER_MONTH; i++) { back.paused = false; E.tick(back); } // and it plays on
  assert.doesNotThrow(() => E.view(back));
});

test('a game of today is loaded as it was saved', () => {
  const g = E.createGame({ capo: 'sal' });
  for (let i = 0; i < 3 * E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
  assert.deepEqual(E.load(E.save(g)), JSON.parse(E.save(g)));
});
