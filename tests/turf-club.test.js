// A man taken in picks the street of his club himself: the boss never chooses where a building goes.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const { town, family } = require('./turf-helpers.js');
// what the boss pays travels: play on until his van has delivered it and the order is carried out
const settle = (g) => { for (let i = 0; i < 400 && E.view(g).paying.length; i++) { g.paused = false; E.tick(g); } };

test('a man picks a street made for his trade', () => {
  const c = town();
  const dutch = T.clubSpot(c, 'dutch'), trade = T.tradeOf('dutch');
  const best = Math.max(...T.spots(c).map((s) => T.worth(c, s.x, s.y, trade)));
  assert.strictEqual(T.worth(c, dutch.x, dutch.y, trade), best);
});

test('among good streets he takes the one the rivals press on least', () => {
  const c = town(), trade = T.tradeOf('sal');
  const first = T.clubSpot(c, 'sal');
  T.open(c, first.x, first.y === 0 ? 1 : first.y - 1, { owner: 'Callahan', kind: 'speakeasy' });
  const then = T.clubSpot(c, 'sal');
  assert.notDeepStrictEqual(then, first);
  assert.strictEqual(T.worth(c, then.x, then.y, trade), T.worth(c, first.x, first.y, trade));
  assert.ok(T.hold(c, then.x, then.y).rival <= T.hold(c, first.x, first.y).rival);
});

test('he never picks a block that is taken, nor a street the rivals hold where the family is known', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  const s = T.clubSpot(c, 'mae');
  assert.ok(T.spots(c).some((q) => q.x === s.x && q.y === s.y));
});

test('with no free block there is nowhere to go', () => {
  const c = town();
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
  assert.strictEqual(T.clubSpot(c, 'sal'), null);
});

const knocked = () => {
  const g = E.createGame({ capo: 'dutch' }); g.reign.left = 1e9;
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) knock = E.tick(g).find((e) => e.type === 'knocks');
  g.family.dirty = 50000;
  g.reign.reached = 2; // the roads are open (see hq-gives.test.js)
  return { g, knock };
};

test('the boss takes a man in without naming a street: the man opens his club where he chose', () => {
  const { g, knock } = knocked(), want = T.clubSpot(g.cities[0], knock.capo);
  E.command(g, { type: 'welcome', city: 'ashport', capo: knock.capo });
  settle(g);
  const club = T.clubOf(g.cities[0], knock.capo);
  assert.deepStrictEqual([club.x, club.y], [want.x, want.y]);
  assert.ok(g.journal.some((l) => l.type === 'welcomed' && l.capo === knock.capo));
});

test('sent down a road without a street named, he chooses there too', () => {
  const { g, knock } = knocked(), road = E.view(g).cities[0].doors.find((d) => d.capo === knock.capo).roads[0];
  const to = g.cities.find((c) => c.id === road.city), want = T.clubSpot(to, knock.capo);
  E.command(g, { type: 'welcome', city: to.id, from: 'ashport', capo: knock.capo });
  settle(g);
  const club = T.clubOf(to, knock.capo);
  assert.deepStrictEqual([club.x, club.y], [want.x, want.y]);
});

test('the door says where he would open his club', () => {
  const { g, knock } = knocked(), d = E.view(g).cities[0].doors.find((q) => q.capo === knock.capo), want = T.clubSpot(g.cities[0], knock.capo);
  assert.deepStrictEqual([d.spot.x, d.spot.y], [want.x, want.y]);
  assert.ok(d.spot.street);
});
