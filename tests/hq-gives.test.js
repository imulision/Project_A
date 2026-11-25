// What each size of the family's headquarters brings: a part of the game opens with every act.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const R = require('../web/reign.js');
const E = require('../web/empire.js');
// what the boss pays travels: play on until his van has delivered it and the order is carried out
const settle = (g) => { for (let i = 0; i < 400 && E.view(g).paying.length; i++) { g.paused = false; E.tick(g); } };

const knocked = (act) => {
  const g = E.createGame({ capo: 'dutch', quiet: true }); g.reign.left = 1e9;
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) knock = E.tick(g).find((e) => e.type === 'knocks');
  g.family.dirty = 50000;
  if (act) { g.reign.act = act; g.reign.reached = act; }
  return { g, knock };
};
const door = (g, capo) => E.view(g).cities[0].doors.find((d) => d.capo === capo);

test('the acts say what the headquarters becomes and what it brings', () => {
  assert.deepStrictEqual(R.ACTS.map((a) => a.hq), ['Back room', 'Club', 'Hotel floor', 'Mansion']);
  assert.ok(R.ACTS[1].opens.includes('table') && R.ACTS[1].opens.includes('roads') && R.ACTS[1].opens.includes('vault'));
  assert.ok(R.ACTS[2].opens.includes('underboss'));
  assert.ok(R.ACTS[3].opens.includes('counsel'));
});

test('in the first act there is no table: no chair is offered at the door, and the order is refused with the reason', () => {
  const { g, knock } = knocked();
  assert.deepStrictEqual(door(g, knock.capo).chairs, []);
  assert.throws(() => E.command(g, { type: 'seat', city: 'ashport', capo: knock.capo, post: 'bookkeeper' }), /Act II/);
});

test('from the second act the table is open', () => {
  const { g, knock } = knocked(1);
  assert.deepStrictEqual(door(g, knock.capo).chairs, ['bookkeeper', 'routes', 'fixer']);
  E.command(g, { type: 'seat', city: 'ashport', capo: knock.capo, post: 'bookkeeper' });
  assert.strictEqual(g.family.table.bookkeeper, knock.capo);
});

// A city alone is less than a tenth of the map: a family that had to wait for the third act to take a road
// would never reach it. So the roads come with the second.
test('in the first act no man is sent down a road', () => {
  const { g, knock } = knocked();
  assert.deepStrictEqual(door(g, knock.capo).roads, []);
  assert.throws(() => E.command(g, { type: 'welcome', city: 'calder', from: 'ashport', capo: knock.capo }), /Act II:/);
});

test('before the third act no underboss is named', () => {
  const { g } = knocked(1);
  assert.throws(() => E.command(g, { type: 'underboss', city: 'ashport', capo: 'dutch' }), /Act III/);
});

test('every start can leave its first city: the family that says yes to all holds two cities within twenty years', () => {
  for (const capo of ['sal', 'tommy']) {
    const g = E.createGame({ capo, quiet: true });
    for (let m = 0; m < 240; m++) {
      for (let i = 0; i < E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
      for (const c of E.view(g).cities) for (const d of c.doors) {
        try { E.command(g, { type: 'welcome', city: c.id, capo: d.capo }); }
        catch (e) { if (d.roads[0]) try { E.command(g, { type: 'welcome', city: d.roads[0].city, from: c.id, capo: d.capo }); } catch (e2) { /* no money today */ } }
      }
    }
    assert.ok(E.hud(g).cities.held >= 2, capo + ' never left his first city');
  }
});

test('from the second act the roads are open', () => {
  const { g, knock } = knocked(1), road = door(g, knock.capo).roads[0];
  assert.ok(road);
  E.command(g, { type: 'welcome', city: road.city, from: 'ashport', capo: knock.capo });
  settle(g);
  assert.ok(T.clubOf(g.cities.find((c) => c.id === road.city), knock.capo));
});

test('the fourth chair of the table, the Counsel, waits for the fourth act', () => {
  const early = knocked(2), late = knocked(3);
  assert.ok(!door(early.g, early.knock.capo).chairs.includes('counsel'));
  assert.throws(() => E.command(early.g, { type: 'seat', city: 'ashport', capo: early.knock.capo, post: 'counsel' }), /Act IV/);
  assert.ok(door(late.g, late.knock.capo).chairs.includes('counsel'));
  E.command(late.g, { type: 'seat', city: 'ashport', capo: late.knock.capo, post: 'counsel' });
  const chair = E.view(late.g).table.find((s) => s.post === 'counsel');
  assert.strictEqual(chair.capo, late.knock.capo);
  assert.match(chair.gives, /loyal/);
});

test('the table only shows the chairs that are open', () => {
  const g = E.createGame({ capo: 'sal', quiet: true });
  assert.deepStrictEqual(E.view(g).table.map((s) => s.post), []);
  g.reign.reached = 1;
  assert.deepStrictEqual(E.view(g).table.map((s) => s.post), ['bookkeeper', 'routes', 'fixer']);
  g.reign.reached = 3;
  assert.deepStrictEqual(E.view(g).table.map((s) => s.post), ['bookkeeper', 'routes', 'fixer', 'counsel']);
});

test('a Counsel at the table steadies every man: each settles more loyal', () => {
  const play = (counsel) => {
    const g = E.createGame({ capo: 'sal', quiet: true }); g.reign.left = 1e9; g.reign.reached = 3; g.reign.act = 3;
    if (counsel) g.family.table = { counsel: 'ida' };
    g.family.dirty = 90000; g.family.men.sal.loyal = 40;
    for (let i = 0; i < 24 * 40; i++) { g.paused = false; E.tick(g); }
    return T.loyalty(g.family, 'sal');
  };
  assert.ok(play(true) > play(false));
});

test('the bigger the headquarters, the more dirty money sleeps there unnoticed', () => {
  const g = E.createGame({ capo: 'sal', quiet: true }); g.reign.left = 1e9;
  assert.strictEqual(E.view(g).reign.vault, T.RULES.stash);
  g.reign.reached = 1; g.reign.act = 1;
  for (let i = 0; i < 24; i++) { g.paused = false; E.tick(g); }
  assert.strictEqual(E.view(g).reign.vault, T.RULES.stash + T.RULES.hq.vault[1]);
  assert.ok(T.RULES.hq.vault[3] > T.RULES.hq.vault[2] && T.RULES.hq.vault[2] > T.RULES.hq.vault[1]);
});

test('the view says, for what is still closed, the act that opens it', () => {
  const g = E.createGame({ capo: 'sal', quiet: true }), closed = E.view(g).reign.closed;
  assert.match(closed.table, /Act II/);
  assert.match(closed.roads, /Act II:/);
  assert.match(closed.underboss, /Act III/);
  assert.match(closed.counsel, /Act IV/);
  g.reign.reached = 3;
  assert.deepStrictEqual(E.view(g).reign.closed, {});
});

test('what was opened stays open when the family falls back', () => {
  const { g, knock } = knocked(2);
  g.reign.act = 0;
  assert.ok(door(g, knock.capo).roads.length > 0);
});
