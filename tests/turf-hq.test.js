// Headquarters: the family's own from the first day, one in every city it holds, and one for the rivals of each city.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const { town, family } = require('./turf-helpers.js');

const start = (capo = 'sal') => { const g = E.createGame({ capo }); g.reign.left = 1e9; return g; };
const play = (g, days) => { const all = []; for (let i = 0; i < days; i++) { g.paused = false; all.push(...E.tick(g)); } return all; };

test('a headquarters is raised on a free block, next to the family\'s first club', () => {
  const c = town();
  T.settle(c, 'sal', 8, 3);
  const hq = T.raiseHq(c, 'family');
  assert.strictEqual(hq.kind, 'hq');
  assert.strictEqual(Math.max(Math.abs(hq.x - 8), Math.abs(hq.y - 3)), 1);
  assert.deepStrictEqual(T.hqOf(c, 'family'), hq);
});

test('raised twice, it is the same one', () => {
  const c = town();
  T.settle(c, 'sal', 8, 3);
  assert.deepStrictEqual(T.raiseHq(c, 'family'), T.raiseHq(c, 'family'));
  assert.strictEqual(T.places(c).filter((p) => p.kind === 'hq').length, 1);
});

test('the rivals have theirs where they press hardest', () => {
  const c = town();
  T.open(c, 2, 2, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  T.open(c, 3, 2, { owner: 'Callahan', kind: 'gambling', level: 2 });
  c.rival = 'Callahan';
  const hq = T.raiseHq(c, 'Callahan');
  assert.strictEqual(hq.owner, 'Callahan');
  assert.ok(Math.max(Math.abs(hq.x - 2), Math.abs(hq.y - 2)) <= 1);
  assert.deepStrictEqual(T.hqOf(c, 'rival'), hq);
});

test('nobody opens, takes or burns a headquarters, and no capo runs it', () => {
  const c = town(), f = family({ dirty: 9000 });
  T.settle(c, 'sal', 8, 3); T.join(f, 'sal');
  const hq = T.raiseHq(c, 'family');
  assert.throws(() => T.open(c, hq.x, hq.y, { owner: 'family', kind: 'loans', capo: 'sal' }), /already a place/);
  assert.ok(!T.spots(c).some((s) => s.x === hq.x && s.y === hq.y));
  assert.strictEqual(T.run(c, 'sal').length, 0);
  for (let i = 0; i < 36; i++) T.stepMonth(c, f);
  assert.deepStrictEqual(T.hqOf(c, 'family'), hq, 'still there three years on');
});

test('the game opens with the family\'s headquarters in its first city, and the rivals\' in every city', () => {
  const g = start(), v = E.view(g);
  v.cities.forEach((c, i) => {
    assert.ok(c.hq.rival, c.id + ' has the rivals\' headquarters');
    assert.strictEqual(c.hq.rival.owner, c.rival);
    assert.strictEqual(!!c.hq.family, i === 0, c.id);
  });
  const home = v.cities[0], club = home.capos[0];
  assert.strictEqual(Math.max(Math.abs(home.hq.family.x - club.x), Math.abs(home.hq.family.y - club.y)), 1);
  assert.strictEqual(home.hq.family.stage, 1);
  assert.strictEqual(home.hq.family.name, 'Headquarters');
});

test('the headquarters is one of the places of the view, alone on its block', () => {
  const g = start(), c = E.view(g).cities[0], p = c.places.filter((q) => q.kind === 'hq');
  assert.strictEqual(p.length, 2);
  assert.deepStrictEqual(p.map((q) => q.owner).sort(), [c.rival, 'family'].sort());
  p.forEach((q) => { assert.strictEqual(q.name, 'Headquarters'); assert.ok(q.stage >= 1 && q.stage <= 4); });
});

test('the boss sits in the family\'s headquarters with his table, and the rival chief in his', () => {
  const g = start(), c = E.view(g).cities[0];
  assert.deepStrictEqual(c.hq.family.who, ['boss']);
  assert.deepStrictEqual(c.hq.rival.who, c.chief ? [c.chief.id] : []);
});

test('the family\'s headquarters grows with the acts, and never shrinks', () => {
  const g = start();
  play(g, 24);
  g.reign.act = 2; g.reign.reached = 2;
  play(g, 24);
  assert.strictEqual(E.view(g).cities[0].hq.family.stage, 3);
  g.reign.act = 0;
  play(g, 24);
  assert.strictEqual(E.view(g).cities[0].hq.family.stage, 3);
});

test('a city headquarters appears the day the first man settles in another city', () => {
  const g = start('dutch');
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) knock = E.tick(g).find((e) => e.type === 'knocks');
  g.family.dirty = 50000;
  const road = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo).roads[0];
  E.command(g, { type: 'welcome', city: road.city, from: 'ashport', capo: knock.capo });
  const there = E.view(g).cities.find((c) => c.id === road.city);
  assert.ok(there.hq.family);
  assert.strictEqual(there.hq.family.stage, 1);
  assert.deepStrictEqual(there.hq.family.who, []);
});

test('a city headquarters grows with what the family holds there, and an underboss sits in it', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 8, 3); T.join(f, 'sal');
  T.raiseHq(c, 'family');
  assert.strictEqual(T.hqStage(10), 2);
  assert.strictEqual(T.hqStage(0), 1);
  assert.strictEqual(T.hqStage(30), 3);
  assert.strictEqual(T.hqStage(80), 4);
  c.under = 'sal';
  assert.deepStrictEqual(T.hqs(c, f).family.who, ['sal']);
});

test('a game saved before headquarters existed gets them on loading', () => {
  const g = start();
  g.cities.forEach((c) => { Object.keys(c.blocks).forEach((k) => { if (c.blocks[k].kind === 'hq') delete c.blocks[k]; }); });
  const back = E.load(E.save(g)), v = E.view(back);
  assert.ok(v.cities[0].hq.family && v.cities[0].hq.rival && v.cities[1].hq.rival);
  assert.ok(!v.cities[1].hq.family);
});

test('the boss\'s share travels from the club to the headquarters: the screen is told each time', () => {
  const g = start(), sent = play(g, 480).filter((e) => e.type === 'tribute');
  assert.ok(sent.length > 0);
  const hq = E.view(g).cities[0].hq.family, club = E.view(g).cities[0].capos[0];
  const e = sent[0];
  assert.deepStrictEqual([e.x, e.y], [hq.x, hq.y]);
  assert.deepStrictEqual([e.from.x, e.from.y], [club.x, club.y]);
  assert.ok(e.amount > 0 && e.capo === 'sal');
  assert.strictEqual(e.amount, T.RULES.car.loads[0]);
  assert.ok(!g.journal.some((l) => l.type === 'tribute'), 'it is for the screen, not for the journal');
});

test('the boss\'s share waits at the club and leaves for the headquarters one full load at a time', () => {
  const g = start(), f = g.family, load = T.RULES.car.loads[0];
  let had = f.dirty, trips = 0;
  for (let i = 0; i < 96; i++) {
    g.paused = false;
    const told = E.tick(g).filter((e) => e.type === 'tribute');
    assert.ok(told.length <= 1, 'one trip a day at most');
    told.forEach((e) => assert.strictEqual(e.amount, load));
    const others = g.journal.filter((l) => l.month === g.month && l.cost).length; // nothing else moves his dirty money in this young game
    if (!others) assert.ok(Math.abs(f.dirty - had - (told.length ? load : 0)) < 0.01 || f.dirty < had, 'day ' + i + ': ' + (f.dirty - had));
    trips += told.length; had = f.dirty;
  }
  assert.ok(trips >= 1);
  const k = E.view(g).cities[0].capos[0];
  assert.ok(k.share >= 0 && k.share < load, 'what waits at his club is less than a load');
  assert.strictEqual(k.shareLoad, load);
});

test('in a city with no headquarters the share reaches the boss at once, as before', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 8, 3); T.join(f, 'dutch');
  T.open(c, 9, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  for (let i = 0; i < 3; i++) T.stepMonth(c, f);
  assert.ok(f.dirty > 0);
  assert.ok(!f.men.dutch.share);
});

test('a load of the boss\'s share is one of the trips of the city: the capo\'s own car, from his club to the headquarters', () => {
  const g = start();
  let trip = null;
  for (let i = 0; i < 480 && !trip; i++) { g.paused = false; if (E.tick(g).some((e) => e.type === 'tribute')) trip = E.view(g).cities[0].trips.find((t) => t.kind === 'tribute'); }
  assert.ok(trip, 'the trip is in the view the day it leaves');
  const c = E.view(g).cities[0], club = c.capos[0], hq = c.hq.family;
  assert.deepStrictEqual([trip.from.x, trip.from.y, trip.to.x, trip.to.y], [club.x, club.y, hq.x, hq.y]);
  assert.deepStrictEqual([trip.capo, trip.vehicle, trip.cargo, trip.amount], ['sal', 'sal:own', 'cash', T.RULES.car.loads[0]]);
});
