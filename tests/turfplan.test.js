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
  const g = E.createGame({ capo }); g.reign.left = 1e9; // the director keeps out of this story (see reign.test.js)
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

test('the old district names are only names written on the ground, each over the blocks the rules give it, whatever its shape', () => {
  const c = cityOf(play(1)), p = M.planTurf(c);
  assert.deepEqual(p.districts.map((d) => d.name), c.zones.map((z) => z.name));
  const z = c.zones[1], d = p.districts[1];
  assert.deepEqual([d.c0, d.c1, d.r0, d.r1], [z.x0, z.x1 + 1, z.y0, z.y1 + 1]);
  c.blocks.forEach((b, n) => { assert.equal(p.blocks[n].zone, b.zone); lotsOf(p, b.x, b.y).forEach((l) => assert.equal(l.district, b.zone)); });
  // the name is written over a block of its own, in the town, near the middle of its streets
  p.districts.forEach((d, n) => { const b = c.blocks[Math.floor(d.cy) * c.w + Math.floor(d.cx)];
    assert.equal(b.zone, n, d.name + ' is written on its own streets'); assert.ok(!b.void, d.name + ' is not written on the water'); });
  assert.ok(c.zones.some((z, n) => c.blocks.filter((b) => b.zone === n).length < (z.x1 - z.x0 + 1) * (z.y1 - z.y0 + 1)), 'a name is not always a rectangle');
});

test('a city of an old save, with no street name on its blocks, still reads its names from the rectangles', () => {
  const c = cityOf(play(1)), cols = Math.ceil(c.zones.length / 2), w = c.w / cols, h = c.h / 2;
  const old = { ...c, blocks: c.blocks.map(({ zone, ...b }) => b), zones: c.zones.map((z, i) => ({ ...z, x0: (i % cols) * w, x1: (i % cols + 1) * w - 1, y0: Math.floor(i / cols) * h, y1: (Math.floor(i / cols) + 1) * h - 1 })) };
  const p = M.planTurf(old);
  p.lots.forEach((l) => { const d = p.districts[l.district]; assert.ok(l.bx >= d.c0 && l.bx < d.c1 && l.by >= d.r0 && l.by < d.r1); });
});

test('every place stands on its own block, one place a block, with a sign', () => {
  const c = cityOf(play(30)), p = M.planTurf(c);
  c.places.forEach((pl) => {
    const sites = lotsOf(p, pl.x, pl.y).filter((l) => l.site);
    assert.equal(sites.length, 1, 'one place on block ' + pl.x + ',' + pl.y);
    assert.equal(sites[0].site.name, pl.name); assert.equal(sites[0].site.level, pl.kind === 'hq' ? pl.stage : pl.level); assert.ok(sites[0].site.sign);
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
  lotsOf(p, held.x, held.y).forEach((l) => { if (!l.site) { assert.equal(l.ours, true); assert.ok(l.lit >= 1); } });
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

// ---- the cars of the new game
const carsOf = (g) => { const v = E.view(g), p = M.planEmpire(v, global.AshportWorld.CITIES); return { v, p, cars: M.tripsTurf(p, v).filter((t) => !t.parked) }; };      // (the vehicles waiting by the club are told further down)

test('every trip of the rules is driven between the very buildings it names: a leg of the round of its vehicle, or a car of its own', () => {
  const { v, p, cars } = carsOf(play(30)), c = v.cities[0], pc = p.cities[0];
  c.trips = c.trips.filter((t) => t.kind !== 'capo');      // a capo's own car is not a car that comes and goes (see movesTurf)
  assert.ok(c.trips.length > 0);
  assert.equal(cars.filter((t) => t.kind !== 'patrol').length, new Set(c.trips.map((t, n) => t.vehicle || n)).size, 'one car for each vehicle, however many trips it makes (the police on patrol are told further down)');
  const siteAt = (x, y) => pc.lots.find((l) => l.site && l.bx === x && l.by === y);
  c.trips.forEach((t) => {
    const a = siteAt(t.from.x, t.from.y), b = siteAt(t.to.x, t.to.y), car = cars.find((x) => x.id === 'ashport:' + t.vehicle);
    if (!t.vehicle) { const own = cars.find((x) => !x.round && x.kind === t.kind && x.path[0].join() === [a.i, a.j].join()); assert.ok(own, 'a trip without a vehicle is a car that comes and goes'); assert.deepEqual(own.path[own.path.length - 1], [b.i, b.j]); return; }
    assert.ok(car, 'the vehicle of the trip is on the map: ' + t.vehicle);
    const stand = car.stops.map((s) => car.path[s.k].join() + (s.load ? '+' : '-'));
    assert.ok(stand.indexOf([a.i, a.j].join() + '+') >= 0, 'it loads at the place the trip leaves from');
    assert.ok(stand.slice(stand.indexOf([a.i, a.j].join() + '+')).indexOf([b.i, b.j].join() + '-') > 0, 'and unloads after, where the trip ends');
    car.path.forEach((q) => assert.ok(q[0] % 4 === 0 || q[1] % 3 === 0 || pc.lots.some((l) => l.site && l.i === q[0] && l.j === q[1]), 'a car keeps to the streets'));
    assert.equal(car.city, 'ashport'); assert.equal(car.capo, t.capo);
  });
});

test('a vehicle looks the part: a truck for liquor, a car for money', () => {
  let g = null, liquor = null, cash = null;
  for (let m = 6; m <= 60 && !(liquor && cash); m += 3) { g = play(m); const { cars } = carsOf(g); liquor = liquor || cars.find((c) => c.kind === 'liquor'); cash = cash || cars.find((c) => c.kind === 'takings'); }
  assert.ok(liquor && cash, 'liquor and cash are both driven at some point');
  assert.equal(liquor.vehicle, 'truck'); assert.ok(liquor.round); assert.ok(liquor.stops[0].load && liquor.stops[0].amount > 0);
  assert.equal(cash.vehicle, 'car');
  assert.notEqual(liquor.color, cash.color);
});

test('the same month gives the same cars, so a car already on the road is kept', () => {
  const g = play(30);
  assert.deepEqual(carsOf(g).cars.map((c) => c.id), carsOf(g).cars.map((c) => c.id));
  assert.equal(new Set(carsOf(g).cars.map((c) => c.id)).size, carsOf(g).cars.length);
});

test('what happens in a city lands on the block it names: fire where a place burns, gunfire where one is taken', () => {
  const p = M.planEmpire(E.view(play(30)), global.AshportWorld.CITIES);
  const fx = M.effectsTurf([{ type: 'burnt', city: 'ashport', x: 4, y: 10 }, { type: 'repelled', city: 'ashport', x: 3, y: 10 }, { type: 'taken', city: 'ashport', x: 5, y: 9, way: 'force' },
    { type: 'taken', city: 'ashport', x: 5, y: 9, way: 'bribe' }, { type: 'opened', city: 'ashport', x: 5, y: 10 }, { type: 'bust', city: 'ashport' }, { type: 'rank', city: 'ashport', capo: 'sal' }], p);
  assert.deepEqual(fx.map((f) => f.kind), ['fire', 'gunfire', 'gunfire', 'promotion', 'build', 'police', 'promotion']);
  assert.deepEqual([fx[0].bx, fx[0].by], [4, 10]); assert.equal(fx[0].city, 'ashport');
  fx.forEach((f) => assert.ok(typeof f.i === 'number' && typeof f.j === 'number', 'each effect has a lot to stand on'));
});

test('a route runs along the streets, from one lot to another, with no diagonal', () => {
  const p = M.planTurf(cityOf(play(1))), a = p.lots[0], b = p.lots[p.lots.length - 1];
  const onStreet = (q) => q[0] % 4 === 0 || q[1] % 3 === 0;
  const path = M.route([a.i, a.j], [b.i, b.j]);
  assert.deepEqual(path[0], [a.i, a.j]);
  assert.deepEqual(path[path.length - 1], [b.i, b.j]);
  path.slice(1, -1).forEach((q) => assert.ok(onStreet(q), q + ' is on a street'));
  for (let k = 1; k < path.length; k++) assert.ok(path[k][0] === path[k - 1][0] || path[k][1] === path[k - 1][1], 'no diagonal');
});

// a game played until a full load of cash has left a place
const withLoads = () => { const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < 200 && !E.view(g).cities[0].trips.some((t) => t.kind === 'takings'); i++) { E.tick(g); if (g.paused) E.command(g, { type: 'resume' }); } return g; };

test('a car that carries cash knows how much, and whose it is', () => {
  const g = withLoads();
  const { v, cars } = carsOf(g), cash = cars.filter((c) => c.kind === 'takings');
  assert.ok(cash.length > 0);
  const t = v.cities[0].trips.filter((x) => x.kind === 'takings')[0];
  assert.equal(cash[0].amount, t.amount);
  assert.ok(cash[0].amount > 0);
  assert.equal(cash[0].capo, 'sal');
});

test('two loads on the same way are two cars, the second one leaving after the first', () => {
  const g = withLoads();
  const { v, p } = carsOf(g), c = v.cities[0], t = c.trips.filter((x) => x.kind === 'takings')[0];
  const bare = () => Object.assign({}, t, { vehicle: null, home: null });      // loads the rules give no vehicle to (the laundry runs)
  c.trips = [bare(), bare(), bare()];
  const cars = M.tripsTurf(p, v).filter((x) => !x.parked);
  assert.equal(cars.length, 3);
  assert.equal(new Set(cars.map((x) => x.id)).size, 3, 'each has its own name');
  assert.deepEqual(cars.map((x) => x.delay > 0), [false, true, true]);
  assert.ok(cars[2].delay > cars[1].delay);
});

// a game played until a capo is away from his club
const away = () => { const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < 400; i++) { E.tick(g); if (g.paused) E.command(g, { type: 'resume' }); const k = E.view(g).cities[0].capos[0]; if (k.at && k.at.why !== 'home') break; } return g; };

test('a capo is seen where he is this month, and drives there in his own car when he moves', () => {
  const g = away(), v = E.view(g), k = v.cities[0].capos[0];
  assert.notEqual(k.at.why, 'home', 'he is out');
  const p = M.planEmpire(v, global.AshportWorld.CITIES), pk = p.cities[0].capos[0];
  const lot = p.cities[0].lots.find((l) => l && l.i === pk.at.i && l.j === pk.at.j);
  assert.ok(lot && lot.bx === k.at.x && lot.by === k.at.y, 'the plan puts him on the block the rules name');
  assert.equal(pk.at.why, k.at.why);
  assert.equal(M.tripsTurf(p, v).filter((c) => c.kind === 'capo').length, 0, 'his car is not one more car that comes and goes');
  // the month before he was at his club: one drive, from the club to where he is now, with him in it
  const home = JSON.parse(JSON.stringify(p)); home.cities[0].capos[0].at = { i: pk.i, j: pk.j, why: 'home' };
  const moves = M.movesTurf(home, p);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].kind, 'capo'); assert.equal(moves[0].capo, 'sal'); assert.equal(moves[0].loop, false);
  assert.deepEqual(moves[0].path[0], [pk.i, pk.j]);
  assert.deepEqual(moves[0].path[moves[0].path.length - 1], [pk.at.i, pk.at.j]);
  assert.equal(M.movesTurf(p, p).length, 0, 'a capo who stays where he is does not drive');
  assert.equal(M.movesTurf(null, p).length, 0);
});

// ---- rounds: a vehicle lives at its capo's club, goes out, loads, delivers, comes home, and is the same car next month
const withRounds = () => {
  const g = play(30), v = E.view(g), c = v.cities[0], k = c.capos[0], home = { x: k.x, y: k.y };
  const ps = c.places.filter((q) => q.owner === 'family' && q.kind !== 'club').slice(0, 2);
  k.cars = 2; k.trucks = 1;
  c.trips = ps.map((q, n) => ({ kind: 'takings', cargo: 'cash', capo: k.id, from: { x: q.x, y: q.y }, to: home, amount: 150 + n, vehicle: k.id + ':car:1', leg: n, home }))
    .concat([{ kind: 'wash', cargo: 'cash', capo: k.id, from: home, to: { x: ps[0].x, y: ps[0].y }, amount: 90 }]);
  const p = M.planEmpire(v, global.AshportWorld.CITIES);
  return { v, c, k, ps, p, cars: M.tripsTurf(p, v) };
};

test('the trips of one vehicle are one round: out of the club, load, deliver, and home again', () => {
  const { k, ps, p, cars } = withRounds(), pc = p.cities[0];
  const car = cars.find((t) => t.id === 'ashport:' + k.id + ':car:1');
  assert.ok(car && car.round, 'one car for the two trips of dutch:car:1');
  assert.deepEqual(car.path[0], car.path[car.path.length - 1], 'it ends where it started');
  assert.deepEqual(car.path[0], car.home);
  car.path.forEach((q) => assert.ok(q[0] % 4 === 0 || q[1] % 3 === 0 || pc.lots.some((l) => l.i === q[0] && l.j === q[1] && l.site), 'it keeps to the streets'));
  assert.deepEqual(car.stops.map((s) => s.load), [true, false, true, false], 'it loads and unloads twice');
  assert.deepEqual(car.stops.filter((s) => s.load).map((s) => s.amount), [150, 151]);
  for (let n = 1; n < car.stops.length; n++) assert.ok(car.stops[n].k > car.stops[n - 1].k, 'the stops follow one another along the way');
  const at = (s) => pc.lots.find((l) => l.i === car.path[s.k][0] && l.j === car.path[s.k][1]);
  assert.equal(at(car.stops[0]).bx, ps[0].x); assert.equal(at(car.stops[2]).bx, ps[1].x);
  assert.equal(car.vehicle, 'car'); assert.equal(car.amount, 150);
});

test('a vehicle with nothing to do stays parked at the club, and each has a place of its own', () => {
  const { k, cars } = withRounds();
  const idle = cars.filter((t) => t.parked);
  assert.deepEqual(idle.map((t) => t.id).sort(), ['ashport:' + k.id + ':car:2', 'ashport:' + k.id + ':truck:1']);
  idle.forEach((t) => { assert.equal(t.path.length, 1); assert.ok(t.round); });
  const busy = cars.find((t) => t.id === 'ashport:' + k.id + ':car:1');
  const spots = idle.map((t) => t.path[0].join()).concat([busy.home.join()]);
  assert.equal(new Set(spots).size, 3, 'no two parked on the same spot');
  assert.equal(idle.find((t) => /truck/.test(t.id)).vehicle, 'truck');
});

test('a trip without a vehicle of its own still comes and goes as before', () => {
  const { cars } = withRounds();
  const wash = cars.filter((t) => t.kind === 'wash');
  assert.equal(wash.length, 1); assert.ok(wash[0].loop && !wash[0].round);
});

test('a load lost on the road: the vehicle is stopped half way, loses it there, and the place of the hold-up lights up', () => {
  const { v, c, k, p } = withRounds();
  c.trips[0].lost = 'hijack';
  const car = M.tripsTurf(p, v).find((t) => t.id === 'ashport:' + k.id + ':car:1');
  assert.deepEqual(car.stops.map((s) => (s.load ? 'load' : s.lost || 'unload')), ['load', 'hijack', 'load', 'unload']);
  assert.ok(car.stops[1].k > car.stops[0].k && car.stops[1].k < car.stops[2].k);
  const there = car.path[car.stops[1].k]; assert.ok(there[0] % 4 === 0 || there[1] % 3 === 0, 'it is stopped in the street');
  const fx = M.effectsTurf([{ type: 'hijack', city: 'ashport', x: c.trips[0].from.x, y: c.trips[0].from.y, label: 'held up' }, { type: 'seizure', city: 'ashport', x: c.trips[0].from.x, y: c.trips[0].from.y, label: 'seized' }], p);
  assert.deepEqual(fx.map((f) => f.kind + ':' + f.say), ['gunfire:held up', 'police:seized']);
});

test('what goes from one city to the next is a truck on the road between them, once', () => {
  const v = E.view(play(30)), p = M.planEmpire(v, global.AshportWorld.CITIES), r = v.routes[0];
  const list = [{ from: r.from, to: r.to, cargo: 'liquor', amount: 20, capo: 'sal', x: 1, y: 1, tx: 2, ty: 2 }, { from: r.from, to: r.to, cargo: 'cars', amount: 4, capo: 'sal', x: 1, y: 1, tx: 2, ty: 2 }, { from: 'nowhere', to: r.to, cargo: 'goods', amount: 20 }];
  const out = M.convoysTurf(p, list);
  assert.equal(out.length, 2, 'a convoy to or from a city that is not on the map is left out');
  out.forEach((t) => { assert.equal(t.kind, 'convoy'); assert.equal(t.loop, false); assert.equal(t.vehicle, 'truck'); assert.equal(t.a, p.cities.findIndex((c) => c.id === r.from)); assert.equal(t.b, p.cities.findIndex((c) => c.id === r.to)); });
  assert.deepEqual(out.map((t) => t.cargo), ['liquor', 'cars']); assert.equal(out[0].amount, 20);
  assert.ok(out[1].delay > out[0].delay, 'two on the same road do not ride on top of each other');
  assert.match(out[0].way, new RegExp(p.cities[out[0].a].name + '.*' + p.cities[out[0].b].name));
  assert.deepEqual(M.convoysTurf(p, undefined), []);
});

test('every event that has a place is marked on the map where it happens, and says its type', () => {
  const v = E.view(play(30)), p = M.planEmpire(v, global.AshportWorld.CITIES), k = v.cities[0].capos[0];
  const fx = M.effectsTurf([{ type: 'asks', city: 'ashport', x: 4, y: 10, label: 'Sal asks' }, { type: 'welcomed', city: 'ashport', x: 5, y: 10, label: 'in' }, { type: 'car', city: 'ashport', capo: k.id, x: k.x, y: k.y, label: 'a car' },
    { type: 'knocks', city: 'ashport', capo: 'nobody yet', label: 'a man' }, { type: 'studying', city: 'ashport', label: 'learning' }, { type: 'opened', city: 'ashport', x: 5, y: 10, label: 'opened' }], p);
  assert.deepEqual(fx.map((f) => f.kind + ':' + f.type), ['news:asks', 'news:welcomed', 'news:car', 'build:opened'], 'what has no place of its own is not put on the map');
  assert.deepEqual([fx[0].bx, fx[0].by], [4, 10]); assert.equal(fx[0].say, 'Sal asks');
});

// ---- a town is not a chessboard: heights come in neighbourhoods, some ground is left open, the edges thin out
test('tall buildings stand together in neighbourhoods instead of being sprinkled evenly', () => {
  const c = cityOf(play(1)), p = M.planTurf(c), at = {}; p.lots.forEach((l) => { at[l.i + ',' + l.j] = l; });
  const built = p.lots.filter((l) => !l.open), share = built.filter((l) => l.tall).length / built.length;
  let near = 0, n = 0;
  built.filter((l) => l.tall).forEach((l) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => { const o = at[(l.i + di) + ',' + (l.j + dj)]; if (o && !o.open) { n++; if (o.tall) near++; } }));
  assert.ok(share > 0.08 && share < 0.6, 'some of the town is tall (' + share.toFixed(2) + ')');
  assert.ok(near / n > share * 1.5, 'next to a tall building, another is much more likely (' + (near / n).toFixed(2) + ' against ' + share.toFixed(2) + ')');
});

test('some ground is left open, the same every time, and never where a place stands', () => {
  const g = play(18), c = cityOf(g), p = M.planTurf(c), again = M.planTurf(cityOf(g));
  // (the blocks missing from the city's outline, water, rail or waste, are not ground left open in the town: they are counted apart)
  const gap = (l) => ['water', 'rail', 'waste'].includes(l.open), town = p.lots.filter((l) => !gap(l));
  const open = town.filter((l) => l.open), parks = open.filter((l) => l.open === 'park');
  assert.ok(open.length > town.length * 0.04 && open.length < town.length * 0.25, 'a few lots in a hundred (' + open.length + ' of ' + town.length + ')');
  assert.ok(parks.length >= 6, 'and at least one whole park');
  assert.deepEqual(again.lots.map((l) => l.open || ''), p.lots.map((l) => l.open || ''));
  p.lots.forEach((l) => { if (l.site || l.hideout) assert.ok(!l.open, 'a place is never open ground'); });
  assert.equal(p.lots.length, c.w * c.h * 6, 'the plan keeps its six lots a block, built or not');
});

test('the edge of town thins out and stays low, the middle is full', () => {
  const c = cityOf(play(1)), p = M.planTurf(c);
  const edge = (l) => Math.min(l.bx, l.by, c.w - 1 - l.bx, c.h - 1 - l.by) === 0;
  const rim = p.lots.filter(edge), core = p.lots.filter((l) => !edge(l));
  const openShare = (ls) => ls.filter((l) => l.open).length / ls.length, tallShare = (ls) => ls.filter((l) => !l.open && l.tall).length / ls.length;
  assert.ok(openShare(rim) > openShare(core) * 2, 'more open ground on the rim');
  assert.ok(tallShare(rim) < tallShare(core), 'and lower buildings');
});

test('a block the rules leave out of the town (water, rails, waste ground) is drawn as such, with nothing built on it', () => {
  const c = JSON.parse(JSON.stringify(cityOf(play(1))));
  const free = c.blocks.filter((b) => !c.places.some((p) => p.x === b.x && p.y === b.y)).slice(0, 3);
  ['water', 'rail', 'waste'].forEach((v, n) => Object.assign(free[n], { void: v, grip: null, family: 0, rival: 0 }));
  const p = M.planTurf(c);
  free.forEach((b) => {
    lotsOf(p, b.x, b.y).forEach((l) => assert.equal(l.open, b.void));
    assert.equal(p.blocks.find((q) => q.x === b.x && q.y === b.y).void, b.void);
  });
  assert.equal(p.lots.length, c.w * c.h * 6);
  assert.doesNotThrow(() => M.planTurf(cityOf(play(1))), 'a town without any gap is drawn as before');
});

test('a betrayal is marked on the map with a light of its own, where the man had his club', () => {
  const g = play(2), p = M.planEmpire(E.view(g), AshportWorld.CITIES), k = E.view(g).cities[0].capos[0];
  const fx = M.effectsTurf([{ type: 'betrayal', city: 'ashport', capo: k.id, x: k.x, y: k.y, label: 'Sal goes over to the Callahans' }, { type: 'whispers', city: 'ashport', capo: k.id, x: k.x, y: k.y, label: 'Word gets around' }], p);
  assert.deepEqual(fx.map((f) => f.kind + ':' + f.type), ['betrayal:betrayal', 'news:whispers']);
  assert.equal(fx[0].say, 'Sal goes over to the Callahans');
});

test('money never leaves from thin air: a building site shows no figure, what it cost leaves the purse at the club of the capo', () => {
  const v = E.view(play(30)), p = M.planEmpire(v, global.AshportWorld.CITIES), k = p.cities[0].capos[0];
  const fx = M.effectsTurf([{ type: 'opened', city: 'ashport', capo: k.id, x: 5, y: 10, cost: 400 }, { type: 'asks', city: 'ashport', capo: k.id, x: 4, y: 10, cost: 900 }, { type: 'gift', city: 'ashport', capo: k.id, x: 5, y: 10, cost: 1500 },
    { type: 'burnt', city: 'ashport', x: 4, y: 10 }, { type: 'truck', city: 'ashport', capo: k.id, cost: 300 }, { type: 'opened', city: 'ashport', x: 5, y: 10, cost: 200 }], p);
  const marks = fx.filter((f) => f.kind !== 'pay'), pays = fx.filter((f) => f.kind === 'pay');
  assert.deepEqual(marks.map((f) => f.spent || 0), [0, 0, 0, 0, 0], 'no figure over the place itself (a car bought has no place of its own)');
  assert.deepEqual(pays.map((f) => f.spent), [400, 300], 'what a capo paid is seen at his club; what the boss paid, or a cost nobody carries, shows nothing');
  pays.forEach((f) => assert.deepEqual([f.i, f.j, f.capo], [k.i, k.j, k.id]));
});

test('the streets of a capo in trouble show it: their buildings are marked low, and the plan says the town changed', () => {
  const c = cityOf(play(30)), k = c.capos[0];
  const well = M.planTurf(c), ill = M.planTurf({ ...c, capos: c.capos.map((m) => (m.id === k.id ? { ...m, trouble: true } : m)) });
  assert.equal(well.lots.filter((l) => l.low).length, 0);
  const low = ill.lots.filter((l) => l.low);
  assert.ok(low.length > 0, 'his streets are marked'); low.forEach((l) => assert.ok(l.ours && !l.site, 'only the streets, not the places'));
  assert.notEqual(ill.key, well.key, 'the renderer draws the town again');
});

test('a place burnt out stays a black shell for a while, and works under way are marked where they are built', () => {
  const c = cityOf(play(30)), b = c.blocks.find((q) => q.grip === 'family' && !c.places.some((p) => p.x === q.x && p.y === q.y));
  const plain = M.planTurf(c), scarred = M.planTurf({ ...c, scars: [{ x: b.x, y: b.y }] });
  assert.equal(plain.lots.filter((l) => l.burnt).length, 0);
  const shell = scarred.lots.filter((l) => l.burnt);
  assert.equal(shell.length, 1); assert.deepEqual([shell[0].bx, shell[0].by], [b.x, b.y]); assert.equal(shell[0].shop, false, 'nothing is sold in a shell');
  assert.notEqual(scarred.key, plain.key, 'the renderer draws the town again');
  const k = c.capos[0], busy = { ...c, capos: c.capos.map((m) => (m.id === k.id ? { ...m, plan: { move: 'open', kind: 'still', x: b.x, y: b.y, progress: 0.4, waiting: 'time' } } : m)) };
  const site = M.planTurf(busy).lots.filter((l) => l.works);
  assert.equal(site.length, 1); assert.deepEqual([site[0].bx, site[0].by], [b.x, b.y]);
  const saving = { ...c, capos: c.capos.map((m) => (m.id === k.id ? { ...m, plan: { move: 'open', kind: 'still', x: b.x, y: b.y, progress: 0.4, waiting: 'money' } } : m)) };
  assert.equal(M.planTurf(saving).lots.filter((l) => l.works).length, 0, 'a man still saving has built nothing yet');
  assert.notEqual(M.planTurf(busy).key, plain.key);
});

test('the hotter a city, the more police cars patrol its streets', () => {
  const v = E.view(play(30)), at = (heat) => { const w = { ...v, cities: v.cities.map((c, n) => ({ ...c, heat: n ? 0 : heat })) }, p = M.planEmpire(w, global.AshportWorld.CITIES); return M.tripsTurf(p, w).filter((t) => t.kind === 'patrol'); };
  assert.equal(at(5).length, 0); assert.equal(at(30).length, 1); assert.equal(at(60).length, 2); assert.equal(at(100).length, 3, 'never a parade');
  at(100).forEach((t) => { assert.equal(t.vehicle, 'police'); assert.equal(t.loop, true); assert.ok(t.path.length > 3); assert.equal(t.city, 'ashport');
    t.path.forEach((q) => assert.ok(q[0] % 4 === 0 || q[1] % 3 === 0 || q === t.path[0] || q === t.path[t.path.length - 1], 'it keeps to the streets')); });
  assert.notEqual(at(100)[0].path.join(';'), at(100)[1].path.join(';'), 'each has its own beat');
});

test('each street of the family says how hard the rival presses on it', () => {
  const c = cityOf(play(30)), p = M.planTurf(c);
  c.blocks.forEach((b, n) => { const q = p.blocks[n];
    if (b.grip === 'family') assert.equal(q.press, Math.min(1, b.rival / Math.max(1, b.family))); else assert.equal(q.press, 0); });
});

test('men stand where the family is: a doorman at each place, two at the club, a crew where a capo faces the rivals', () => {
  const c0 = cityOf(play(30)), c = { ...c0, capos: c0.capos.map((m) => ({ ...m, at: { x: m.x, y: m.y, why: 'home' } })) }, k = c.capos[0], mine = c.places.filter((p) => p.owner === 'family'), other = mine.find((p) => p.kind !== 'club' && p.kind !== 'hq');
  const p = M.planTurf(c), at = (x, y) => p.lots.find((l) => l.bx === x && l.by === y && l.site);
  assert.equal(at(k.x, k.y).men, 2, 'the club'); if (other) assert.equal(at(other.x, other.y).men, 1, 'a doorman');
  p.lots.forEach((l) => { if (!l.site || l.site.owner !== 'family') assert.ok(!l.men, 'nobody of the family stands at a rival\'s door'); });
  const raided = M.planTurf({ ...c, capos: c.capos.map((m) => (m.id === k.id ? { ...m, at: { x: k.x, y: k.y, why: 'raid', label: 'Facing the rivals' } } : m)) });
  assert.equal(raided.lots.find((l) => l.bx === k.x && l.by === k.y && l.site).men, 5, 'his crew stands with him');
  assert.notEqual(raided.key, p.key);
});

// ---- a town is not a grid: here and there two blocks stand as one, and the cars drive round
const shutOf = (p) => { const s = {}; p.shut.forEach((q) => { s[q.x + ',' + q.y] = 1; }); return s; };
const gapAt = (p, x, y) => x < 0 || y < 0 || x >= p.bx || y >= p.by || !!p.blocks[y * p.bx + x].void;
// can a car stand on this tile of a street? (a crossing is never closed)
const closed = (p, i, j) => {
  const s = shutOf(p);
  if (i % 4 === 0 && j % 3 !== 0) { const x = i / 4, y = Math.floor(j / 3); return !!s[x + ',' + y] || (gapAt(p, x - 1, y) && gapAt(p, x, y)); }
  if (j % 3 === 0 && i % 4 !== 0) { const x = Math.floor(i / 4), y = j / 3; return gapAt(p, x, y - 1) && gapAt(p, x, y); }
  return false;
};
const tilesOf = (path) => { const out = [];
  for (let k = 1; k < path.length; k++) { const a = path[k - 1], b = path[k], n = Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let t = 0; t <= n; t++) out.push([Math.round(a[0] + (b[0] - a[0]) * t / (n || 1)), Math.round(a[1] + (b[1] - a[1]) * t / (n || 1))]); }
  return out; };

test('here and there the street between two blocks is built over, the same every time', () => {
  const g = play(2), c = cityOf(g), p = M.planTurf(c), s = shutOf(p);
  let inner = 0; for (let y = 0; y < c.h; y++) for (let x = 1; x < c.w; x++) if (!gapAt(p, x - 1, y) && !gapAt(p, x, y)) inner++;
  assert.ok(p.shut.length > inner * 0.05 && p.shut.length < inner * 0.25, 'some of them (' + p.shut.length + ' of ' + inner + ')');
  assert.deepEqual(M.planTurf(cityOf(g)).shut, p.shut);
  p.shut.forEach((q) => {
    assert.ok(!gapAt(p, q.x - 1, q.y) && !gapAt(p, q.x, q.y), 'only between two blocks of the town');
    assert.ok(!s[q.x + ',' + (q.y - 1)] && !s[q.x + ',' + (q.y + 1)] && !s[(q.x - 1) + ',' + q.y] && !s[(q.x + 1) + ',' + q.y], 'never two in a row: every crossing keeps its ways out');
  });
  // two buildings stand where the street was; the six lots of each block are untouched
  assert.equal(p.lots.length, c.w * c.h * 6); assert.equal(p.infill.length, p.shut.length * 2);
  p.infill.forEach((l) => { assert.ok(l.i % 4 === 0 && l.j % 3 !== 0); assert.ok(s[(l.i / 4) + ',' + Math.floor(l.j / 3)]); assert.ok(!l.open && !l.site && l.model); });
  const left = p.infill[0], b = c.blocks[left.by * c.w + left.bx];
  assert.equal(left.bx, left.i / 4 - 1, 'they follow the block on their left'); assert.equal(left.ours, b.grip === 'family');
});

test('a car never drives over the water, nor through a street that is built over', () => {
  const g = play(30), v = E.view(g), plan = M.planEmpire(v, global.AshportWorld.CITIES), p = plan.cities[0];
  const town = p.lots.filter((l) => !['water', 'rail', 'waste'].includes(l.open));
  let turns = 0;
  for (let n = 0; n < 300; n++) {
    const a = town[(n * 37) % town.length], b = town[(n * 101 + 13) % town.length]; if (a === b) continue;
    const path = M.route([a.i, a.j], [b.i, b.j], p);
    assert.deepEqual(path[0], [a.i, a.j]); assert.deepEqual(path[path.length - 1], [b.i, b.j]);
    for (let k = 1; k < path.length; k++) assert.ok(path[k][0] === path[k - 1][0] || path[k][1] === path[k - 1][1], 'no diagonal');
    tilesOf(path.slice(1, -1)).forEach((q) => { assert.ok(q[0] % 4 === 0 || q[1] % 3 === 0, q + ' is on a street'); assert.ok(!closed(p, q[0], q[1]), q + ' is open (' + a.i + ',' + a.j + ' to ' + b.i + ',' + b.j + ')'); });
    if (path.length > 6) turns++;
  }
  assert.ok(turns > 0, 'some of them have to go round');
  M.tripsTurf(plan, v).filter((t) => t.city === p.id && t.path.length > 1).forEach((t) => {
    const mid = t.round ? t.path.slice(1, -1) : t.path;
    tilesOf(mid).forEach((q) => assert.ok(!closed(p, q[0], q[1]), t.id + ' drives through ' + q)); });
});

test('a street name that grew over the year thrives, one that shrank goes quiet, and the plan is redrawn when that changes', () => {
  const c = cityOf(play(30)), p0 = M.planTurf(c), n = c.blocks.find((b) => b.grip === 'family').zone;
  const real = c.blocks.filter((b) => b.zone === n && !b.void), share = Math.round(100 * real.filter((b) => b.grip === 'family').length / real.length);
  const was = (v) => c.zones.map((z, k) => (k === n ? v : 0));
  const ours = (p) => p.lots.filter((l) => l.district === n && l.ours && !l.site);
  assert.equal(p0.districts[n].trend, null); ours(p0).forEach((l) => assert.ok(!l.boom));
  const up = M.planTurf(c, 0, was(share - 10)); assert.equal(up.districts[n].trend, 'up'); assert.ok(ours(up).length > 0); ours(up).forEach((l) => assert.equal(l.boom, true));
  const down = M.planTurf(c, 0, was(share + 10)); assert.equal(down.districts[n].trend, 'down'); ours(down).forEach((l) => { assert.equal(l.low, true); assert.ok(!l.boom); });
  assert.equal(M.planTurf(c, 0, was(share + 2)).districts[n].trend, null, 'a street more or less is not a trend');
  assert.notEqual(up.key, p0.key); assert.notEqual(down.key, up.key);
  // the whole map reads the year in the history of the rules
  const v = E.view(play(30)), h = v.history, row = h[Math.max(0, h.length - 13)];
  const older = { ...v, history: h.map((r) => (r === row ? { ...r, cities: { ...r.cities, [v.cities[0].id]: { ...r.cities[v.cities[0].id], zones: v.cities[0].zones.map(() => 100) } } } : r)) };
  assert.ok(M.planEmpire(older, global.AshportWorld.CITIES).cities[0].districts.some((d) => d.trend === 'down'));
});

test('a capo who opens a place drives to it and back to his club, once', () => {
  const g = E.createGame({ capo: 'sal' });
  const mine = (p) => p.cities[0].lots.filter((l) => l && l.site && l.site.owner === 'family' && l.site.capo === 'sal' && l.site.type !== 'club' && l.site.type !== 'key');
  let p = M.planEmpire(E.view(g), global.AshportWorld.CITIES);
  for (let i = 0; i < 400 && !mine(p).length; i++) { E.tick(g); if (g.paused) E.command(g, { type: 'resume' }); p = M.planEmpire(E.view(g), global.AshportWorld.CITIES); }
  const lot = mine(p)[0], k = p.cities[0].capos[0];
  assert.ok(lot, 'he runs a place');
  k.at = { i: k.i, j: k.j, why: 'home' };
  const before = JSON.parse(JSON.stringify(p));
  before.cities[0].lots.forEach((l) => { if (l && l.i === lot.i && l.j === lot.j) l.site = null; });
  const moves = M.movesTurf(before, p);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].capo, 'sal'); assert.equal(moves[0].cargo, 'open'); assert.equal(moves[0].loop, false);
  assert.deepEqual(moves[0].path[0], [k.i, k.j]);
  assert.deepEqual(moves[0].path[moves[0].path.length - 1], [k.i, k.j], 'he comes home');
  assert.ok(moves[0].path.some((q) => q[0] === lot.i && q[1] === lot.j), 'by way of the new place');
  assert.equal(M.movesTurf(p, p).length, 0);
});

test('what the family builds, wins or learns from a decision has a sight of its own on the map', () => {
  const v = E.view(play(30)), p = M.planEmpire(v, global.AshportWorld.CITIES), k = v.cities[0].capos[0];
  const fx = M.effectsTurf([{ type: 'opened', city: 'ashport', x: 5, y: 10 }, { type: 'enlarged', city: 'ashport', x: 5, y: 10 }, { type: 'converted', city: 'ashport', x: 5, y: 10 },
    { type: 'taken', city: 'ashport', x: 5, y: 9, kind: 'key', key: 'hotel', way: 'bribe' }, { type: 'taken', city: 'ashport', x: 5, y: 9, kind: 'key', key: 'hotel', way: 'force' },
    { type: 'outcome', city: 'ashport', good: true, label: 'It paid' }, { type: 'outcome', city: 'ashport', good: false, label: 'It cost you' }, { type: 'outcome', city: 'ashport', label: 'Too early to say' }], p);
  assert.deepEqual(fx.map((f) => f.kind), ['build', 'build', 'build', 'key', 'key', 'good', 'bad'], 'a key place taken is a sight whatever the way; a result with nothing to say is not shown');
  assert.deepEqual([fx[5].i, fx[5].j], [p.cities[0].capos[0].i, p.cities[0].capos[0].j], 'a result with no place of its own is seen at the club');
  // a take under way is seen on the place being taken, month after month, until it is settled
  const taking = JSON.parse(JSON.stringify(p)), lot = taking.cities[0].lots.find((l) => l && l.site && l.site.owner !== 'family');
  taking.cities[0].capos[0].at = { i: lot.i, j: lot.j, why: 'take' };
  const siege = M.effectsTurf([], taking);
  assert.deepEqual(siege.map((f) => [f.kind, f.i, f.j, f.city]), [['siege', lot.i, lot.j, 'ashport']]);
  assert.equal(M.effectsTurf([], p).length, 0);
});

test('a man taken in is seen arriving: one car from the edge of the town to his new club', () => {
  const v = E.view(play(30)), p = M.planEmpire(v, global.AshportWorld.CITIES), c = p.cities[0], k = c.capos[0];
  const cars = M.arrivalsTurf([{ type: 'welcomed', city: 'ashport', capo: k.id, x: k.bx, y: k.by }, { type: 'opened', city: 'ashport', x: k.bx, y: k.by }, { type: 'welcomed', city: 'nowhere', capo: 'x', x: 1, y: 1 }], p);
  assert.equal(cars.length, 1);
  assert.equal(cars[0].kind, 'capo'); assert.equal(cars[0].capo, k.id); assert.equal(cars[0].loop, false); assert.equal(cars[0].cargo, 'arrives');
  const first = cars[0].path[0], last = cars[0].path[cars[0].path.length - 1];
  assert.deepEqual(last, [k.i, k.j], 'it ends at his club');
  assert.ok(first[0] === 0 || first[1] === 0 || first[0] === c.bx * 4 || first[1] === c.by * 3, 'it starts on the rim of the town');
  assert.ok(cars[0].path.length > 1);
});

// ---- the streets about to be won: every capo's own, the furthest along first
const planned = (capos) => ({ cities: [{ id: 'ashport', capos }, { id: 'dunmore', capos: [{ id: 'mae', name: 'Mae "Ledger" Lin', plan: { move: 'take', kind: 'warehouse', name: 'Warehouse', x: 2, y: 3, advance: 0.9, due: 1, waiting: null, gains: [{ x: 2, y: 3 }, { x: 3, y: 3 }] } }] }] });
test('each capo who prepares to win streets has his own claim, the furthest along first and the stalled ones last', () => {
  const list = M.claimsTurf(planned([
    { id: 'sal', name: 'Sal "the Hammer" Moretti', plan: { move: 'open', kind: 'speakeasy', name: 'Speakeasy', x: 8, y: 9, advance: 0.95, due: null, waiting: 'money', gains: [{ x: 7, y: 8 }, { x: 9, y: 9 }] } },
    { id: 'dutch', name: 'Dutch Brandt', plan: { move: 'open', kind: 'still', name: 'Cellar still', x: 4, y: 4, advance: 0.3, due: 5, waiting: 'money', gains: [{ x: 4, y: 5 }] } },
    { id: 'vince', name: 'Vince Aiello', plan: { move: 'enlarge', kind: 'speakeasy', name: 'Speakeasy', x: 1, y: 1, advance: 0.5, due: 2, waiting: 'money', gains: [] } },
    { id: 'danny', name: 'Danny Boyle', plan: null }]));
  assert.deepEqual(list.map((c) => c.capo), ['mae', 'dutch', 'sal'], 'nothing for a plan that wins no street, nor for a man without a plan');
  assert.deepEqual(list[0], { id: 'dunmore:mae', city: 'dunmore', capo: 'mae', who: 'Mae', does: 'takes a warehouse', x: 2, y: 3, streets: 2, advance: 0.9, due: 1, state: 'men', stuck: false, gains: [{ x: 2, y: 3 }, { x: 3, y: 3 }] });
  assert.equal(list[1].does, 'opens a cellar still');
  assert.equal(list[1].state, 'money');
  assert.equal(list[2].stuck, true, 'he puts nothing aside: his bar will not move');
  assert.equal(list[2].state, 'stuck');
  assert.deepEqual(M.claimsTurf({ cities: [] }), []);
});
test('a plan that is paid for and only waits for its day is said ready', () => {
  const [c] = M.claimsTurf({ cities: [planned([{ id: 'sal', name: 'Sal Moretti', plan: { move: 'open', kind: 'still', name: 'Cellar still', x: 7, y: 9, advance: 1, due: 0, waiting: null, gains: [{ x: 8, y: 8 }] } }]).cities[0]] });
  assert.equal(c.state, 'ready'); assert.equal(c.stuck, false);
});
test('a man whose pace is not known yet is not said stalled', () => {
  const plan = { move: 'open', kind: 'still', name: 'Cellar still', x: 7, y: 9, advance: 0.2, due: null, waiting: 'money', gains: [{ x: 8, y: 8 }] };
  assert.equal(M.claimsTurf({ cities: [{ id: 'ashport', capos: [{ id: 'sal', name: 'Sal', counts: 1, plan }] }] })[0].stuck, false);
  assert.equal(M.claimsTurf({ cities: [{ id: 'ashport', capos: [{ id: 'sal', name: 'Sal', counts: 2, plan }] }] })[0].stuck, true);
});
test('the game itself gives claims the map can light', () => {
  const g = E.createGame({ capo: 'sal' }); let list = [];
  for (let i = 0; i < E.TICKS_PER_MONTH * 12 && !list.length; i++) { E.tick(g); if (g.paused) E.command(g, { type: 'resume' }); list = M.claimsTurf(E.view(g)); }
  assert.ok(list.length, 'within a year a capo prepares to win streets');
  assert.ok(list[0].gains.length === list[0].streets && list[0].advance >= 0 && list[0].advance <= 1);
});

// ---- a pay packet is seen leaving the club, where the takings were brought
test('what a capo pays, wages and upkeep, leaves from his club as one figure: nothing for cents, and neither a pay packet nor a car is a mark on the map', () => {
  const g = E.createGame({ capo: 'sal' }); let pays = [];
  for (let i = 0; i < E.TICKS_PER_MONTH * 6 && !pays.length; i++) { pays = E.tick(g).filter((e) => e.type === 'pay'); if (g.paused) E.command(g, { type: 'resume' }); }
  assert.ok(pays.length, 'the rules tell every pay packet');
  const p = M.planEmpire(E.view(g), global.AshportWorld.CITIES), e = pays[0], k = p.cities.find((c) => c.id === e.city).capos.find((m) => m.id === e.capo);
  const out = M.paysTurf([e, { ...e, x: e.x + 1, what: 'wages', amount: 30 }, { ...e, what: 'upkeep', amount: 20.4 }, { type: 'run', city: e.city, capo: e.capo, x: e.x, y: e.y, amount: 150 }, { ...e, capo: 'nobody' }], p);
  assert.equal(out.length, 1, 'one figure for the man, whatever places he pays');
  assert.equal(out[0].spent, Math.round(e.amount + 50.4)); assert.equal(out[0].city, e.city); assert.equal(out[0].kind, 'pay');
  assert.deepEqual([out[0].i, out[0].j], [k.i, k.j], 'it leaves from his club: that is where the money is');
  assert.deepEqual(M.paysTurf([{ ...e, amount: 0.3 }], p), []);
  assert.deepEqual(M.paysTurf([], p), []); assert.deepEqual(M.paysTurf([e], null), []);
  assert.deepEqual(M.effectsTurf([e, { type: 'run', city: e.city, capo: e.capo, x: e.x, y: e.y, amount: 150 }], p).filter((f) => f.kind !== 'siege'), [], 'no clock left on the map for them');
});

test('a place stands in the front row of its block, the one that faces the player, and not always in the same spot', () => {
  const seen = {};
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const n = M.spotOf(0, x, y); assert.ok(n >= 3 && n <= 5, 'front row: ' + n); seen[n] = 1; }
  assert.equal(Object.keys(seen).length, 3, 'the three lots of the front row are all used');
  assert.equal(M.spotOf(0, 4, 7), M.spotOf(0, 4, 7), 'and a block keeps its spot');
});

test('the block of a headquarters changes with it: alone at first, then a yard for the cars, then the whole front row, then the whole block', () => {
  const lots = [1, 2, 3, 4].map((s) => M.hqBlock(s));
  lots.forEach((b, i) => { assert.equal(b.length, 6); assert.equal(b[4].model, ['hq_backroom', 'hq_club', 'hq_hotel', 'hq_seat'][i], 'the headquarters stands in the middle of the front row'); });
  const changed = (b) => b.filter(Boolean).length;
  assert.equal(changed(lots[0]), 1, 'a back room hides among its neighbours');
  assert.ok(changed(lots[1]) > 1 && lots[1].some((l) => l && l.open === 'yard'), 'a club has a yard for the cars');
  assert.ok(lots[2][3].open === 'court' && lots[2][5].open === 'court', 'a hotel is one wide building: the lots beside it are its own ground');
  assert.equal(changed(lots[3]), 6, 'the family seat takes the whole block'); assert.ok(lots[3].slice(0, 3).every((l) => l.open === 'park'), 'with its garden behind');
  assert.ok(changed(lots[0]) < changed(lots[1]) && changed(lots[1]) < changed(lots[2]) && changed(lots[2]) < changed(lots[3]));
  assert.deepEqual(M.hqBlock(9), M.hqBlock(4)); assert.deepEqual(M.hqBlock(0), M.hqBlock(1));
});

// ---- the headquarters in the game
test('a headquarters of the rules stands in the middle of the front row of its block, with the model of its stage, and the block is its own', () => {
  const g = play(1), c = cityOf(g), p = M.planTurf(c), hq = c.hq.family, rv = c.hq.rival;
  const mine = lotsOf(p, hq.x, hq.y), theirs = lotsOf(p, rv.x, rv.y);
  assert.equal(mine[4].site.type, 'hq'); assert.equal(mine[4].site.role, 'hq'); assert.equal(mine[4].model, 'hq_backroom');
  assert.equal(mine.filter((l) => l.site).length, 1, 'one place on the block, wherever the other places of the town would stand');
  assert.equal(mine[4].site.owner, 'family'); assert.equal(mine[4].site.level, 1, 'its mark counts the acts, not the levels of a business');
  assert.ok(mine[4].site.sign && mine[4].site.sign !== 'OPEN');
  assert.equal(theirs[4].model, 'hq_seat', 'the rivals are at home here from the first day');
  assert.equal(theirs[4].site.owner, c.rival); assert.equal(theirs[4].site.color, M.COLORS[p.rival]);
  assert.deepEqual(theirs.map((l) => l.open), ['park', 'park', 'park', 'court', null, 'court'], 'the whole block is theirs: court and garden');
  assert.notEqual(theirs[4].site.sign, mine[4].site.sign);
});

test('a headquarters that grows changes its building and its block, and the map is drawn again', () => {
  const g = play(1), c = cityOf(g), was = M.planTurf(c).key;
  const grown = JSON.parse(JSON.stringify(c)); grown.hq.family.stage = 3; grown.places.forEach((q) => { if (q.kind === 'hq' && q.owner === 'family') q.stage = 3; });
  const p = M.planTurf(grown), lots = lotsOf(p, c.hq.family.x, c.hq.family.y);
  assert.equal(lots[4].model, 'hq_hotel'); assert.deepEqual([lots[3].open, lots[5].open], ['court', 'court']);
  assert.notEqual(p.key, was);
});

test('the share of the boss drives from the club to the headquarters in the capo\'s own car, and is counted where it arrives', () => {
  const g = play(1); let ev = null, trip = null;
  for (let i = 0; i < 480 && !trip; i++) { g.paused = false; ev = E.tick(g).find((e) => e.type === 'tribute'); if (ev) trip = E.view(g).cities[0].trips.find((t) => t.kind === 'tribute'); }
  const v = E.view(g), p = M.planEmpire(v, global.AshportWorld.CITIES), c = v.cities[0], hq = lotsOf(p.cities[0], c.hq.family.x, c.hq.family.y)[4];
  const car = M.tripsTurf(p, v).find((t) => t.round && t.stops.some((s) => s.kind === 'tribute'));
  assert.ok(car, 'a round of a vehicle'); assert.equal(car.vehicle, 'car'); assert.equal(car.color, M.FLOW.money);
  const drop = car.stops.filter((s) => s.kind === 'tribute' && !s.load)[0];
  assert.deepEqual(car.path[drop.k], [hq.i, hq.j], 'it stops at the headquarters');
  const fx = M.effectsTurf([ev], p);
  assert.equal(fx.length, 1); assert.deepEqual([fx[0].kind, fx[0].i, fx[0].j, fx[0].gain, fx[0].spent], ['pay', hq.i, hq.j, ev.amount, 0], 'the figure rises over the headquarters, as money that comes in');
});

test('washed money is counted over the headquarters when its car arrives; dirty money on its way to a laundry is only a car', () => {
  const g = play(1), v = E.view(g), p = M.planEmpire(v, global.AshportWorld.CITIES), c = v.cities[0], hq = c.hq.family, k = c.capos[0];
  const fx = M.effectsTurf([{ type: 'wash', city: c.id, capo: k.id, x: k.x, y: k.y, from: { x: hq.x, y: hq.y }, amount: 150 }, { type: 'clean', city: c.id, capo: k.id, x: hq.x, y: hq.y, from: { x: k.x, y: k.y }, amount: 120.4 }], p);
  assert.deepEqual(fx.map((f) => [f.kind, f.type, f.gain, f.bx, f.by]), [['pay', 'clean', 120, hq.x, hq.y]]);
  assert.equal(M.tripsTurf(p, { cities: [{ ...c, trips: [{ kind: 'clean', cargo: 'clean', capo: k.id, from: { x: k.x + 1, y: k.y }, to: { x: hq.x, y: hq.y }, amount: 150, vehicle: k.id + ':own', leg: 0, home: { x: k.x, y: k.y } }] }] }).filter((t) => t.round)[0].color, M.FLOW.sales);
});

test('the take of a hit comes home by car: from the place taken to the club, where it is counted; the police take what they seize at the headquarters', () => {
  const g = play(1), v = E.view(g), p = M.planEmpire(v, global.AshportWorld.CITIES), c = v.cities[0], pc = p.cities[0], hq = c.hq.family, k = c.capos[0];
  const far = c.places.find((q) => q.owner !== 'family' && q.kind !== 'hq' && Math.abs(q.x - k.x) + Math.abs(q.y - k.y) > 2);
  const loot = { type: 'loot', city: c.id, capo: k.id, x: k.x, y: k.y, from: { x: far.x, y: far.y }, amount: 240 };
  const cars = M.arrivalsTurf([loot], p), a = lotsOf(pc, far.x, far.y).find((l) => l.site), club = lotsOf(pc, k.x, k.y).find((l) => l.site);
  assert.equal(cars.length, 1); assert.deepEqual([cars[0].kind, cars[0].loop, cars[0].vehicle, cars[0].color, cars[0].cargo, cars[0].amount], ['loot', false, 'car', M.FLOW.money, 'cash', 240]);
  assert.deepEqual(cars[0].path[0], [a.i, a.j]); assert.deepEqual(cars[0].path[cars[0].path.length - 1], [club.i, club.j]);
  const fx = M.effectsTurf([loot, { type: 'bust', city: c.id, x: hq.x, y: hq.y, seized: 500, label: 'The police raid' }], p);
  assert.deepEqual(fx.map((f) => [f.kind, f.bx, f.by, f.gain || 0, f.spent]), [['pay', k.x, k.y, 240, 0], ['police', hq.x, hq.y, 0, 500]]);
});
