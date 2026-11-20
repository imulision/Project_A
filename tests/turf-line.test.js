// The boss's line for a city: grow, earn, or lie low. The capos of the city lean that way if it is in their nature or if they are loyal enough.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const L = T.RULES.line;
// One capo with a small bar he could make bigger, free streets around him, and a Callahan bar next door.
const one = (capo, line) => {
  const c = town(), f = family({ dirty: 0, clean: 0 });
  T.settle(c, capo, 3, 2); T.join(f, capo);
  T.open(c, 4, 2, { owner: 'family', kind: 'gambling', capo, level: 1 });
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy' });
  f.men[capo].cash = 50000;
  if (line) T.line(c, line);
  return { c, f };
};
const man = (c, f, id) => T.view(c, f).capos.find((k) => k.id === id);

test('a city has no line until the boss gives one of three, and he can take it back', () => {
  const { c, f } = one('sal');
  assert.equal(T.view(c, f).line, null);
  assert.deepEqual(T.view(c, f).lines.map((l) => l.id), ['grow', 'earn', 'low']);
  for (const l of T.view(c, f).lines) assert.ok(l.name && l.gives && l.gives.length < 90);
  T.line(c, 'earn');
  assert.equal(T.view(c, f).line, 'earn');
  T.line(c, null);
  assert.equal(T.view(c, f).line, null);
  assert.throws(() => T.line(c, 'win'), /no such line: win/);
});

test('with no line a capo opens on a free street; told to earn, he makes his place bigger first', () => {
  assert.equal(man(...Object.values(one('sal')), 'sal').plan.move, 'open');
  assert.equal(man(...Object.values(one('sal', 'earn')), 'sal').plan.move, 'enlarge');
});

// A capo who already runs all the places his rank allows, each as big as it can be, with free streets around him.
const full = (capo, line) => {
  const c = town(), f = family({ dirty: 0, clean: 0 });
  T.settle(c, capo, 3, 2); T.join(f, capo);
  const spots = [[4, 2], [2, 2], [3, 1], [3, 3], [4, 1], [2, 1], [4, 3], [2, 3]];
  for (let i = 0; T.places(c, capo).filter((p) => p.kind !== 'club').length < T.RULES.reach[0]; i++) T.open(c, spots[i][0], spots[i][1], { owner: 'family', kind: 'gambling', capo, level: 3 });
  f.men[capo].cash = 50000;
  if (line) T.line(c, line);
  return { c, f };
};

test('told to grow, a capo stretches: he opens more places than a man of his rank should run', () => {
  const plain = full('sal'), grow = full('sal', 'grow');
  assert.equal(man(plain.c, plain.f, 'sal').plan.move, 'hold');
  assert.equal(man(grow.c, grow.f, 'sal').plan.move, 'open');
  const before = T.places(grow.c, 'sal').length;
  for (let m = 0; m < 12; m++) { grow.f.men.sal.cash = 50000; T.stepMonth(grow.c, grow.f); }
  assert.equal(T.places(grow.c, 'sal').length, before + L.stretch, 'and no further than the line allows');
});

test('a man stretched thin guards his places badly: a raid he would have thrown back burns the place', () => {
  const raid = (line, capo) => {
    const { c, f } = H.siege();
    c.rival = 'Callahan';
    if (line) T.line(c, line);
    for (let m = 0; m < T.RULES.rivalEvery * 2; m++) { const e = T.stepMonth(c, f).find((x) => x.type === 'burnt' || x.type === 'repelled'); if (e) return e.type; }
    return null;
  };
  assert.equal(raid(null), 'repelled');
  assert.equal(raid('grow'), 'burnt');   // Sal is ambitious: he follows, and stretches
  assert.equal(raid('earn'), 'repelled');
});

test('told to lie low, a capo with nowhere left to open leaves the rivals alone and makes his places bigger instead', () => {
  const hemmed = (line) => {
    const c = town(), f = family({ dirty: 0, clean: 0 });
    T.settle(c, 'mae', 3, 2); T.join(f, 'mae');
    T.open(c, 4, 2, { owner: 'family', kind: 'gambling', capo: 'mae', level: 1 });
    // every other block is somebody else's
    for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
    f.men.mae.cash = 50000;
    if (line) T.line(c, line);
    return man(c, f, 'mae').plan.move;
  };
  assert.equal(hemmed(null), 'take');
  assert.equal(hemmed('low'), 'enlarge');
});

test('a city that lies low cools down faster, by as much for every capo who follows', () => {
  const heat = (line) => { const { c, f } = one('mae', line); f.men.mae.cash = 0; c.heat = 50; T.stepMonth(c, f); return c.heat; };
  assert.equal(heat(null) - heat('low'), L.cools);
});

test('a man follows a line that is in his nature, whatever he thinks of the boss, unless he has turned bitter', () => {
  // Vince is ambitious and not loyal: growing is his nature, earning is not
  const grow = one('vince', 'grow'), earn = one('vince', 'earn');
  assert.equal(man(grow.c, grow.f, 'vince').follows, true);
  assert.equal(man(earn.c, earn.f, 'vince').follows, false);
  assert.match(man(earn.c, earn.f, 'vince').followsWhy, /not his way/i);
  assert.equal(man(earn.c, earn.f, 'vince').plan.move, 'open', 'he goes on as if nothing had been said');
  grow.f.men.vince.loyal = T.RULES.loyal.bitter - 1;
  assert.equal(man(grow.c, grow.f, 'vince').follows, false);
  assert.match(man(grow.c, grow.f, 'vince').followsWhy, /bitter/i);
});

test('a loyal man follows a line that is not in his nature', () => {
  // Tommy is neither ambitious nor a businessman, and very loyal
  for (const line of ['grow', 'earn']) { const { c, f } = one('tommy', line); assert.equal(man(c, f, 'tommy').follows, true, line); assert.match(man(c, f, 'tommy').followsWhy, /loyal/i); }
  const { c, f } = one('tommy', 'grow');
  f.men.tommy.loyal = L.loyal - 1;
  assert.equal(man(c, f, 'tommy').follows, false);
});

test('with no line nobody follows anything, and the city says how well its line is held', () => {
  const { c, f } = one('sal');
  assert.equal(man(c, f, 'sal').follows, null);
  assert.equal(T.view(c, f).lineHeld, null);
  T.settle(c, 'vince', 9, 3); T.join(f, 'vince');
  T.line(c, 'earn'); // Sal is loyal enough, Vince is not and it is not his way
  const held = T.view(c, f).lineHeld;
  assert.deepEqual([held.share, held.follow, held.of], [0.5, 1, 2]);
  assert.match(held.label, /1 of 2/);
});

test('the boss gives the line through an order, where the family has a man; the journal says so and the game keeps it', () => {
  const g = E.createGame({ capo: 'dutch' });
  E.command(g, { type: 'line', city: 'ashport', line: 'earn' });
  assert.equal(E.view(g).cities[0].line, 'earn');
  const last = g.journal[g.journal.length - 1];
  assert.deepEqual([last.type, last.city, last.line], ['line', 'ashport', 'earn']);
  assert.throws(() => E.command(g, { type: 'line', city: 'calder', line: 'grow' }), /the family has no man in Calder Falls/);
  assert.equal(E.view(E.load(E.save(g))).cities[0].line, 'earn');
  E.command(g, { type: 'line', city: 'ashport', line: null });
  assert.equal(E.view(g).cities[0].line, null);
});
