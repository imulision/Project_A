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
  assert.equal(cars.length, new Set(c.trips.map((t, n) => t.vehicle || n)).size, 'one car for each vehicle, however many trips it makes');
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
  assert.deepEqual(fx.map((f) => f.kind), ['fire', 'gunfire', 'gunfire', 'promotion', 'promotion', 'police', 'promotion']);
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
  assert.deepEqual(fx.map((f) => f.kind + ':' + f.type), ['news:asks', 'news:welcomed', 'news:car', 'promotion:opened'], 'what has no place of its own is not put on the map');
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
