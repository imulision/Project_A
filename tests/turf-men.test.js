// The men: the doors they come through, quarrels, turning a rival, partings, the next city, the table and the underboss.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, ALL = H.ALL, year = H.year, family = H.family, ashport = H.ashport, rivals = H.rivals, rich = H.rich, coming = H.coming,
  kinds = H.kinds, kept = H.kept, sixBars = H.sixBars, twoTowns = H.twoTowns, ROAD = H.ROAD;

// --- where capos come from: nobody is picked from a list, each arrives by a door ---

test('beyond the six big names there are seconds and the men of the key places, each a full capo', () => {
  const seconds = Object.keys(T.PEOPLE).filter((id) => T.PEOPLE[id].mentor), figures = Object.keys(T.PEOPLE).filter((id) => T.PEOPLE[id].key);
  assert.deepEqual(seconds.map((id) => T.PEOPLE[id].mentor).sort(), Object.keys(D.CAPOS).sort(), 'one second per big name');
  assert.deepEqual(figures.map((id) => T.PEOPLE[id].key).sort(), Object.keys(T.KEYS).sort(), 'one man per key place');
  for (const id of Object.keys(T.PEOPLE)) {
    const p = T.person(id);
    assert.ok(p.name && p.muscle >= 1 && p.cunning >= 1 && p.charisma >= 1, id);
    assert.ok(T.tradeOf(id), id + ' has a trade');
    const c = town();
    T.settle(c, id, 2, 2);
    assert.ok(T.wants(c, id, { rank: 0, tech: ALL() }), id + ' knows what to do with a club');
  }
  assert.equal(T.person('sal').name, D.CAPOS.sal.name);
  assert.throws(() => T.person('nobody'), /unknown/);
});

test('nobody knocks on the door of a family that has nothing to show', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  assert.deepEqual(T.doors(c, f), []);
});

test('a big name comes when the family has what draws him', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  assert.deepEqual(coming(c, f), ['danny']);
  const d = T.doors(c, f)[0];
  assert.equal(d.door, 'name');
  assert.equal(d.name, D.CAPOS.danny.name);
  assert.ok(d.cost > 0 && d.why);
  T.open(c, 8, 2, { owner: 'family', kind: 'key', key: 'cityhall', capo: 'dutch' });
  assert.ok(coming(c, f).includes('tommy'));
});

test('Sal comes to a family that has thrown a raid back', () => {
  const c = town(), f = rich();
  T.settle(c, 'vince', 2, 2); T.join(f, 'vince');
  T.open(c, 3, 2, { owner: 'family', kind: 'chopshop', capo: 'vince' });
  T.open(c, 5, 2, { owner: 'Callahan', kind: 'speakeasy' });
  f.tech = {};
  assert.ok(!coming(c, f).includes('sal'));
  const events = year(c, f, T.RULES.rivalEvery);
  assert.ok(events.some((e) => e.type === 'repelled'));
  assert.ok(coming(c, f).includes('sal'));
  assert.ok(events.some((e) => e.type === 'knocks' && e.capo === 'sal'), 'and the boss is told once');
  assert.ok(!year(c, f, 3).some((e) => e.type === 'knocks' && e.capo === 'sal'));
});

test('a capo who runs all his rank allows brings his second forward', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  const second = Object.keys(T.PEOPLE).find((id) => T.PEOPLE[id].mentor === 'dutch');
  for (let i = 0; i < T.RULES.reach[0] - 1; i++) T.open(c, i, 4, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.ok(!coming(c, f).includes(second));
  T.open(c, 5, 4, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  const d = T.doors(c, f).find((q) => q.capo === second);
  assert.equal(d.door, 'rise');
  assert.equal(d.by, 'dutch');
  assert.equal(T.tradeOf(second), T.tradeOf('dutch'), 'he learned his mentor\'s trade');
});

test('the man of a key place comes with it', () => {
  const c = town(), f = rich();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  const docker = Object.keys(T.PEOPLE).find((id) => T.PEOPLE[id].key === 'port');
  T.open(c, 9, 3, { owner: 'Callahan', kind: 'key', key: 'port' });
  assert.ok(!coming(c, f).includes(docker));
  T.at(c, 9, 3).owner = 'family'; T.at(c, 9, 3).capo = 'sal';
  const again = JSON.parse(JSON.stringify(c));
  const d = T.doors(again, f).find((q) => q.capo === docker);
  assert.equal(d.door, 'figure');
  assert.equal(d.by, 'port');
});

test('the boss says yes and picks the street: the man plants his club there and goes to work', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  const d = T.doors(c, f)[0];
  assert.throws(() => T.welcome(c, f, 'mae', 8, 3), /is not at the door/);
  assert.throws(() => T.welcome(c, f, 'danny', 3, 2), /already a place/);
  T.open(c, 10, 1, { owner: 'Callahan', kind: 'speakeasy' });
  assert.throws(() => T.welcome(c, f, 'danny', 10, 2), /Callahan/);
  f.dirty = d.cost - 1;
  assert.throws(() => T.welcome(c, f, 'danny', 7, 4), /cannot pay/);
  f.dirty = d.cost;
  T.welcome(c, f, 'danny', 7, 4);
  assert.equal(f.dirty, 0);
  assert.deepEqual(T.clubOf(c, 'danny'), { x: 7, y: 4 });
  assert.equal(f.men.danny.rank, 0);
  assert.ok(!coming(c, f).includes('danny'));
  f.dirty = 0;
  assert.ok(year(c, f, 12).some((e) => e.type === 'opened' && e.capo === 'danny'));
});

test('the city says where a newcomer may plant his club: any free block the rivals do not hold', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 2);
  T.open(c, 10, 1, { owner: 'Callahan', kind: 'speakeasy' });
  const spots = T.spots(c), has = (x, y) => spots.some((s) => s.x === x && s.y === y);
  assert.ok(has(7, 4) && has(3, 2));
  assert.ok(!has(2, 2) && !has(10, 1) && !has(10, 2));
  assert.equal(spots.length, 12 * 6 - 2 - 15, 'all but the two places and the fifteen blocks around the Callahans');
});

test('a city carries three capos, and one more for every key place the family holds there', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  assert.deepEqual(T.seats(c), { taken: 1, total: 3 });
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  T.open(c, 3, 3, { owner: 'family', kind: 'loft', capo: 'dutch' });
  T.open(c, 3, 4, { owner: 'family', kind: 'front', capo: 'dutch' });
  assert.deepEqual(coming(c, f), ['danny', 'mae', 'vince']);
  T.welcome(c, f, 'danny', 7, 4);
  T.welcome(c, f, 'mae', 7, 2);
  assert.deepEqual(T.seats(c), { taken: 3, total: 3 });
  assert.throws(() => T.welcome(c, f, 'vince', 9, 4), /no seat/);
  assert.ok(coming(c, f).includes('vince'), 'he still waits at the door');
  T.open(c, 10, 0, { owner: 'family', kind: 'key', key: 'depot', capo: 'dutch' });
  assert.deepEqual(T.seats(c), { taken: 3, total: 4 });
  T.welcome(c, f, 'vince', 9, 4);
  assert.equal(T.seats(c).taken, 4);
});

// A boss who says yes to everyone and learns what his capos ask for, for twenty years.
const yesMan = (start, months = 240) => {
  const c = ashport(), f = T.createFamily(), seen = { men: [], keys: [], learned: [], share: {} };
  T.crown(c, 'Callahan'); T.seed(c, 'Callahan', 30);
  const l = T.landing(c); T.settle(c, start, l.x, l.y); T.join(f, start);
  for (let m = 1; m <= months; m++) {
    for (const e of T.month(f, [c])) {
      if (e.type === 'taken' && e.key) seen.keys.push(m);
      if (e.type === 'learned') seen.learned.push(m);
    }
    for (const a of T.asks(c)) if (T.funds(f) >= a.cost) T.answer(c, f, a.id, true);
    for (const q of T.feuds(c)) T.rule(c, f, q.id, f.men[q.a].rank >= f.men[q.b].rank ? q.a : q.b);
    for (const d of T.doors(c, f)) {
      const s = T.seats(c), spot = T.spots(c).find((q) => T.grip(c, q.x, q.y) === null) || T.spots(c)[0];
      if (T.funds(f) >= d.cost && s.taken < s.total && spot) { T.welcome(c, f, d.capo, spot.x, spot.y); seen.men.push(m); }
    }
    if (!f.study) {
      const w = T.wishes(c, f)[0], t = w ? T.tree(f).find((q) => q.kind === w.kind) : T.tree(f).filter((q) => q.next && q.tier > 0).sort((x, y) => x.tier - y.tier)[0];
      if (t && t.next && f.clean - 1000 >= t.next.cost) T.research(f, t.kind);
    }
    if (m % 60 === 0) seen.share[m / 12] = T.share(c).family;
  }
  return seen;
};

test('twenty years of saying yes, whoever the first capo is: slow at first, never dead', () => {
  for (const start of Object.keys(D.CAPOS)) {
    const g = yesMan(start);
    assert.ok(g.share[5] <= 30, start + ': ' + Math.round(g.share[5]) + '% after five years is too fast');
    assert.ok(g.share[20] >= 12, start + ': ' + Math.round(g.share[20]) + '% after twenty years, the family is dying');
    // (he gives his word for every key place: the city can fall whole. Without that word it never does: tests/turf-bastion.test.js)
    assert.ok(g.share[20] >= g.share[5], start + ': it grows');
    assert.ok(g.men.length >= 2, start + ': ' + g.men.length + ' men joined');
    assert.ok(g.men[0] >= 12, start + ': nobody joins in the first year');
    assert.ok(g.learned.length >= 1, start + ': ' + g.learned.length + ' trades learned');
    assert.ok(!g.keys.length || g.keys[0] >= 60, start + ': no key place falls in the first five years');
  }
});

test('the first capo is a real choice: ten years later the families are apart', () => {
  const games = Object.keys(D.CAPOS).map((start) => yesMan(start)), mid = games.map((g) => g.share[10]), ends = games.map((g) => g.share[20]);
  assert.ok(Math.max(...mid) - Math.min(...mid) >= 8, 'ten years in: ' + mid.map(Math.round).join(', '));
  assert.ok(ends.filter((e) => e >= 30).length >= 3, 'and more than one start does well');
});

// --- capos who share a city step on each other's toes ---

// Dutch and Danny with their clubs side by side or far apart, and money to open places.
const neighbours = (gap, cash = 3000) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch').cash = cash;
  T.settle(c, 'danny', 2 + gap, 2); T.join(f, 'danny').cash = cash;
  return { c, f };
};

const grudge = (c, f) => (T.grudges(c, f)[0] || { level: 0 }).level;

test('two capos far apart never rub', () => {
  const { c, f } = neighbours(9);
  year(c, f, 6);
  assert.deepEqual(T.grudges(c, f), []);
  assert.deepEqual(T.feuds(c), []);
});

test('a capo who opens a place on a neighbour\'s doorstep leaves a grudge between them', () => {
  const { c, f } = neighbours(2);
  const events = year(c, f, 3);
  assert.ok(events.some((e) => e.type === 'opened'));
  const g = T.grudges(c, f)[0];
  assert.deepEqual([g.a, g.b].sort(), ['danny', 'dutch']);
  assert.ok(g.level >= 1 && g.level < T.RULES.feud);
  assert.equal(g.feud, T.RULES.feud);
});

test('a grudge cools when they leave each other alone', () => {
  const { c, f } = neighbours(9);
  c.grudge = { 'danny|dutch': 3 };
  f.tech = {};
  year(c, f, T.RULES.cool);
  assert.equal(grudge(c, f), 2);
  year(c, f, T.RULES.cool * 3);
  assert.deepEqual(T.grudges(c, f), []);
});

test('enough of it and a feud breaks out: both men send the boss half of what they owe until he rules', () => {
  const calm = neighbours(9, 0), sour = neighbours(9, 0);
  calm.f.tech = {}; sour.f.tech = {};
  sour.c.grudge = { 'danny|dutch': T.RULES.feud };
  const events = T.stepMonth(sour.c, sour.f); T.stepMonth(calm.c, calm.f);
  const e = events.find((q) => q.type === 'feud');
  assert.deepEqual([e.a, e.b].sort(), ['danny', 'dutch']);
  assert.ok(e.label);
  const feud = T.feuds(sour.c)[0];
  assert.deepEqual([feud.a, feud.b].sort(), ['danny', 'dutch']);
  const s0 = sour.f.dirty, c0 = calm.f.dirty;
  const next = T.stepMonth(sour.c, sour.f); T.stepMonth(calm.c, calm.f);
  assert.ok(calm.f.dirty - c0 > 0);
  assert.ok(Math.abs((sour.f.dirty - s0) - (calm.f.dirty - c0) / 2) < 0.01, 'half the tribute');
  assert.ok(!next.some((q) => q.type === 'feud'), 'told once');
});

test('the boss rules for one man: the feud ends, and the other keeps his money to himself for a year', () => {
  const { c, f } = neighbours(9, 0);
  f.tech = {};
  c.grudge = { 'danny|dutch': T.RULES.feud };
  T.stepMonth(c, f);
  const feud = T.feuds(c)[0];
  assert.throws(() => T.rule(c, f, feud.id, 'sal'), /not part of/);
  assert.throws(() => T.rule(c, f, 'nothing', 'dutch'), /no such feud/);
  T.rule(c, f, feud.id, 'dutch');
  assert.deepEqual(T.feuds(c), []);
  assert.deepEqual(T.grudges(c, f), []);
  const before = f.dirty, cash = f.men.danny.cash;
  T.stepMonth(c, f);
  const fromDutch = f.dirty - before;
  assert.ok(fromDutch > 0, 'Dutch pays in full');
  assert.ok(Math.abs((f.men.danny.cash - cash) - T.RULES.club) < 0.01, 'Danny keeps all his club makes');
  assert.equal(T.view(c, f).capos.find((k) => k.id === 'danny').sulks, T.RULES.sulks - 1);
  year(c, f, T.RULES.sulks);
  const d = f.dirty; T.stepMonth(c, f);
  assert.ok(f.dirty - d >= 2 * T.RULES.club * T.RULES.tribute - 0.01, 'then both pay again');
});

// --- the fourth door: turning a rival's lieutenant ---

const lieutenants = () => Object.keys(T.PEOPLE).filter((id) => T.PEOPLE[id].lieutenant && T.PEOPLE[id].home === 'ashport');

// Ashport with the Callahans in place and Dutch landed, the family rich.
const rivalTown = () => {
  const c = ashport(), f = rich();
  T.crown(c, 'Callahan'); T.seed(c, 'Callahan', 30);
  const l = T.landing(c); T.settle(c, 'dutch', l.x, l.y); T.join(f, 'dutch');
  return { c, f };
};

test('the family in place has three lieutenants, and every one of its places but the key places answers to one of them', () => {
  const { c } = rivalTown();
  assert.equal(lieutenants().length, 3);
  assert.ok(lieutenants().every((id) => T.PEOPLE[id].lieutenant === 'Callahan' && T.tradeOf(id)));
  const theirs = rivals(c).filter((p) => p.kind !== 'key');
  assert.ok(theirs.every((p) => lieutenants().includes(p.man)));
  for (const id of lieutenants()) assert.ok(theirs.filter((p) => p.man === id).length >= 3, id + ' holds a real zone');
  assert.ok(rivals(c).filter((p) => p.kind === 'key').every((p) => !p.man));
  assert.deepEqual(T.view(c, T.createFamily()).lieutenants.map((l) => l.id).sort(), lieutenants().sort());
});

test('a lieutenant listens only once the family holds a real share of the city, and he costs a fortune', () => {
  const { c, f } = rivalTown();
  assert.ok(!T.doors(c, f).some((d) => d.door === 'poach'));
  for (let x = 0; x < 20; x += 2) for (let y = 0; y < 12; y += 3) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  assert.ok(T.share(c).family >= T.RULES.turn);
  const d = T.doors(c, f).filter((q) => q.door === 'poach');
  assert.ok(d.length >= 1);
  assert.equal(d[0].by, 'Callahan');
  assert.equal(d[0].cost, T.RULES.doors.poach);
  assert.ok(d[0].cost > T.RULES.doors.name * 2);
  assert.ok(d[0].places >= 1, 'the card says what he brings');
});

test('turned, he crosses with every place he ran: his best one becomes his club', () => {
  const { c, f } = rivalTown();
  for (let x = 0; x < 20; x += 2) for (let y = 0; y < 12; y += 3) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  const d = T.doors(c, f).find((q) => q.door === 'poach');
  const his = rivals(c).filter((p) => p.man === d.capo), before = T.hold(c, his[0].x, his[0].y);
  T.welcome(c, f, d.capo);
  assert.equal(f.dirty, 20000 - d.cost);
  const now = T.places(c, d.capo);
  assert.equal(now.length, his.length);
  assert.ok(now.every((p) => p.owner === 'family'));
  assert.equal(now.filter((p) => p.kind === 'club').length, 1);
  const after = T.hold(c, his[0].x, his[0].y);
  assert.ok(after.family > before.family && after.rival < before.rival, 'his streets change hands');
  assert.ok(f.men[d.capo]);
  assert.ok(!T.doors(c, f).some((q) => q.capo === d.capo));
  assert.ok(!rivals(c).some((p) => p.man === d.capo));
  assert.doesNotThrow(() => year(c, f, 12));
});

test('a place the Callahans open later answers to the lieutenant next door', () => {
  const { c, f } = rivalTown();
  const before = rivals(c).length;
  year(c, f, T.RULES.rivalGrows * 2);
  assert.ok(rivals(c).length > before || T.share(c).rival > 0);
  assert.ok(rivals(c).filter((p) => p.kind !== 'key').every((p) => lieutenants().includes(p.man)));
});

// --- parting with a capo ---
// Dutch and Mae side by side in the west, Sal across town.
const three = () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 1, 1); T.join(f, 'dutch');
  T.settle(c, 'mae', 3, 1); T.join(f, 'mae');
  T.settle(c, 'sal', 9, 3); T.join(f, 'sal');
  T.open(c, 1, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  T.open(c, 1, 3, { owner: 'family', kind: 'still', capo: 'dutch', level: 2 });
  T.open(c, 2, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 2, 4, { owner: 'family', kind: 'still', capo: 'dutch' });
  return { c, f };
};

test('the boss parts with a capo three ways, and the city tells him what each costs', () => {
  const { c, f } = three();
  f.men.dutch.rank = 1;
  const ways = T.partings(c, f, 'dutch');
  assert.deepEqual(ways.map((w) => w.way), ['retire', 'kill', 'jail']);
  assert.deepEqual(ways.map((w) => w.cost), [T.RULES.out.retire[1], 0, 0]);
  assert.ok(ways.every((w) => w.name && w.gives));
  assert.throws(() => T.part(c, f, 'vince', 'kill'), /is not one of yours/);
  assert.throws(() => T.part(c, f, 'dutch', 'exile'), /no such way/);
});

test('the boss never parts with the last capo he has in a city', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 1, 1); T.join(f, 'dutch');
  assert.deepEqual(T.partings(c, f, 'dutch'), []);
  assert.throws(() => T.part(c, f, 'dutch', 'kill'), /last/);
});

test('paid off in clean money, he leaves in peace and the capo next door takes over all he ran', () => {
  const { c, f } = three();
  f.clean = T.RULES.out.retire[0] - 1;
  assert.throws(() => T.part(c, f, 'dutch', 'retire'), /clean/);
  f.clean = T.RULES.out.retire[0];
  const heat = c.heat, out = T.part(c, f, 'dutch', 'retire');
  assert.equal(f.clean, 0);
  assert.equal(T.clubOf(c, 'dutch'), null);
  assert.equal(f.men.dutch, undefined);
  assert.deepEqual(kinds(c, 'mae'), ['speakeasy1', 'speakeasy3', 'still1', 'still2'], 'Mae is the nearest: she takes them all');
  assert.deepEqual([out.kept, out.closed], [4, 0]);
  assert.equal(c.heat, heat);
  assert.equal(T.view(c, f).capos.filter((m) => m.sulks).length, 0);
});

test('nobody takes over more than his rank lets him run: what is left closes', () => {
  const { c, f } = three();
  f.clean = 5000;
  for (let x = 4; x <= 6; x++) for (let y = 0; y <= 1; y++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'family', kind: 'rented', capo: 'mae' });
  assert.equal(kinds(c, 'mae').length, 6, 'Mae runs all a Soldier can');
  T.part(c, f, 'dutch', 'retire');
  assert.equal(kinds(c, 'mae').length, 6);
  assert.deepEqual(kinds(c, 'sal'), ['speakeasy1', 'speakeasy3', 'still1', 'still2'], 'so they go to Sal across town');
});

test('killed, he costs nothing: half of what he ran goes with him, the city heats, and the less loyal keep their money', () => {
  const { c, f } = three();
  const out = T.part(c, f, 'dutch', 'kill');
  assert.equal(f.dirty, 20000);
  assert.deepEqual([out.kept, out.closed], [2, 2]);
  assert.deepEqual(kinds(c, 'mae'), ['speakeasy3', 'still2'], 'the two biggest stay');
  assert.equal(c.heat, T.RULES.out.blood);
  const sulks = Object.fromEntries(T.view(c, f).capos.map((m) => [m.id, m.sulks]));
  assert.deepEqual(sulks, { mae: 0, sal: T.RULES.out.shaken }, 'Mae is loyal; Sal is not so sure any more');
});

test('given to the police, his places are padlocked and the heat falls', () => {
  const { c, f } = three();
  c.heat = 60;
  const out = T.part(c, f, 'dutch', 'jail');
  assert.deepEqual([out.kept, out.closed], [0, 4]);
  assert.deepEqual(kinds(c, 'mae'), []);
  assert.equal(c.heat, 60 - T.RULES.out.tip);
  assert.equal(T.view(c, f).capos.filter((m) => m.sulks).length, 0);
});

test('two years later he is out, and burns the family\'s places nearest to where his club stood', () => {
  const { c, f } = three();
  f.men.dutch.rank = 1;
  T.part(c, f, 'dutch', 'jail');
  T.open(c, 2, 1, { owner: 'family', kind: 'rented', capo: 'mae', level: 3 });
  T.open(c, 4, 1, { owner: 'family', kind: 'rented', capo: 'mae', level: 3 });
  T.open(c, 4, 2, { owner: 'family', kind: 'rented', capo: 'mae', level: 3 });
  T.open(c, 8, 3, { owner: 'family', kind: 'loans', capo: 'sal', level: 3 });
  f.men.mae.cash = 0; f.men.sal.cash = 0;
  const before = year(c, f, T.RULES.out.term - 1);
  assert.ok(!before.some((e) => e.type === 'burnt'));
  const fire = T.stepMonth(c, f).filter((e) => e.type === 'burnt');
  assert.equal(fire.length, T.RULES.out.revenge + 1, 'two places, and one more for his rank');
  assert.ok(fire.every((e) => e.by === 'dutch' && /Dutch is out/.test(e.label)));
  assert.equal(T.at(c, 2, 1), null);
  assert.ok(T.at(c, 8, 3), 'Sal\'s office is too far');
  assert.ok(T.clubOf(c, 'mae'), 'a club does not burn');
  assert.ok(!year(c, f, 24).some((e) => e.by === 'dutch'), 'once is enough');
});

test('a man the boss parted with frees his seat, takes his quarrels with him, and never knocks again', () => {
  const { c, f } = three();
  T.open(c, 5, 1, { owner: 'family', kind: 'gambling', capo: 'mae' });
  T.open(c, 5, 2, { owner: 'family', kind: 'gambling', capo: 'mae' });
  c.grudge['dutch|mae'] = 3;
  assert.deepEqual(T.seats(c), { taken: 3, total: 3 });
  f.clean = 5000;
  T.part(c, f, 'dutch', 'retire');
  assert.deepEqual(T.seats(c), { taken: 2, total: 3 });
  assert.deepEqual(T.grudges(c), []);
  assert.ok(coming(c, f).includes('danny'));
  assert.ok(!coming(c, f).includes('dutch'), 'even with two bars to supply');
});

test('the second of a man the boss had killed never comes forward', () => {
  const { c, f } = three();
  const mentor = Object.keys(T.PEOPLE).find((id) => T.PEOPLE[id].mentor === 'mae');
  for (let x = 4; x <= 6; x++) for (let y = 0; y <= 1; y++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'family', kind: 'rented', capo: 'mae' });
  assert.ok(coming(c, f).includes(mentor));
  f.clean = 5000;
  T.part(c, f, 'sal', 'retire');
  assert.ok(coming(c, f).includes(mentor));
  const { c: c2, f: f2 } = three(), second = Object.keys(T.PEOPLE).find((id) => T.PEOPLE[id].mentor === 'dutch');
  T.part(c2, f2, 'dutch', 'kill');
  for (let x = 4; x <= 6; x++) for (let y = 0; y <= 1; y++) if (!T.at(c2, x, y)) T.open(c2, x, y, { owner: 'family', kind: 'rented', capo: 'mae' });
  assert.ok(!coming(c2, f2).includes(second));
});

// --- from one city to the next ---

test('a man at the door of one city can be sent to plant his club in another, for the price of the road', () => {
  const a = town(), b = town(), f = rich();
  b.id = 'next';
  T.settle(a, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(a, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  const d = T.doors(a, f).find((q) => q.capo === 'danny');
  assert.throws(() => T.send(a, b, f, 'mae', 3, 3), /is not at the door/);
  f.dirty = d.cost + T.RULES.doors.road - 1;
  assert.throws(() => T.send(a, b, f, 'danny', 3, 3), /cannot pay/);
  f.dirty = d.cost + T.RULES.doors.road;
  T.send(a, b, f, 'danny', 3, 3);
  assert.equal(f.dirty, 0);
  assert.equal(T.clubOf(a, 'danny'), null);
  assert.deepEqual(T.clubOf(b, 'danny'), { x: 3, y: 3 });
  assert.deepEqual([T.seats(a).taken, T.seats(b).taken], [1, 1]);
  assert.ok(!coming(a, f).includes('danny') && !coming(b, f).includes('danny'));
  assert.ok(year(b, f, 12).some((e) => e.type === 'opened' && e.capo === 'danny' && e.city === 'next'));
  assert.equal(T.view(a, f).capos.length, 1);
});

test('a city across the road has its own seats, and a lieutenant who crosses stays where his places are', () => {
  const { c, f } = rivalTown(), b = town();
  for (let x = 0; x < 20; x += 2) for (let y = 0; y < 12; y += 3) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  const d = T.doors(c, f).find((q) => q.door === 'poach');
  f.dirty = 50000;
  assert.throws(() => T.send(c, b, f, d.capo, 3, 3), /stays/);
  T.settle(b, 'mae', 0, 0); T.settle(b, 'sal', 0, 5); T.settle(b, 'tommy', 11, 5);
  const other = T.doors(c, f).find((q) => q.door !== 'poach');
  assert.ok(other, 'somebody else is at the door');
  assert.throws(() => T.send(c, b, f, other.capo, 3, 3), /no seat/);
});

test('nobody knows the first man in a new city: he plants his club on any free block, even on the rivals\' streets', () => {
  const a = town(), b = town(), f = rich();
  T.settle(a, 'dutch', 2, 2); T.join(f, 'dutch');
  for (const [x, y, kind] of [[3, 2, 'gambling'], [3, 3, 'loft'], [3, 4, 'front']]) T.open(a, x, y, { owner: 'family', kind, capo: 'dutch' });
  T.open(b, 10, 1, { owner: 'Northside', kind: 'speakeasy' });
  T.open(b, 0, 5, { owner: 'Northside', kind: 'speakeasy', level: 3 });
  assert.equal(T.grip(b, 10, 2), 'rival');
  assert.equal(T.spots(b).length, 12 * 6 - 2, 'every free block');
  assert.throws(() => T.send(a, b, f, 'danny', 10, 1), /already a place/);
  T.send(a, b, f, 'danny', 10, 2);
  assert.deepEqual(T.clubOf(b, 'danny'), { x: 10, y: 2 });
  assert.ok(!T.spots(b).some((s) => T.grip(b, s.x, s.y) === 'rival'), 'the next one is known');
  assert.throws(() => T.send(a, b, f, 'mae', 1, 5), /Northside/);
});

// --- the boss's table: three chairs for the whole family, filled by men who run no street ---
const knocking = () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch'); kept(c, 'dutch');
  T.open(c, 1, 1, { owner: 'family', kind: 'front', capo: 'dutch' });
  T.open(c, 3, 1, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  c.repelled = 1;
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

test('the table has four chairs, empty at first; a man at the door can be given one instead of a street', () => {
  const { c, f } = knocking();
  assert.deepEqual(coming(c, f), ['danny', 'mae', 'sal']);
  assert.deepEqual(T.table(f).map((s) => [s.post, s.name, s.capo]), [['bookkeeper', 'Bookkeeper', null], ['routes', 'Routes', null], ['fixer', 'Fixer', null], ['counsel', 'Counsel', null]]);
  const cost = T.doors(c, f).find((d) => d.capo === 'mae').cost, had = T.funds(f);
  T.seat(c, f, 'mae', 'bookkeeper');
  assert.equal(T.funds(f), had - cost, 'he costs what he would have cost on a street');
  const chair = T.table(f)[0];
  assert.deepEqual([chair.capo, chair.who, chair.pay], ['mae', T.person('mae').name, T.RULES.table.pay]);
  assert.ok(/washes/.test(chair.gives));
  assert.deepEqual(coming(c, f), ['danny', 'sal'], 'she is no longer at the door');
  assert.equal(f.men.mae, undefined, 'and runs no street');
  assert.equal(T.clubOf(c, 'mae'), null);
});

test('a chair holds one man, a man holds one chair, and only a man at the door may sit', () => {
  const { c, f } = knocking();
  T.seat(c, f, 'mae', 'bookkeeper');
  assert.throws(() => T.seat(c, f, 'sal', 'bookkeeper'), /^Error: the Bookkeeper's chair is taken$/);
  assert.throws(() => T.seat(c, f, 'sal', 'cook'), /no such chair: cook/);
  assert.throws(() => T.seat(c, f, 'dutch', 'fixer'), /dutch is not at the door/);
  const poor = knocking(); poor.f.dirty = 0;
  assert.throws(() => T.seat(poor.c, poor.f, 'sal', 'routes'), /^Error: the boss cannot pay the \$\d+ Sal asks$/);
});

test('each chair serves the whole family, by what the man is good at', () => {
  const wash = (who) => { const { c, f } = knocking(); if (who) T.seat(c, f, who, 'bookkeeper'); T.stepMonth(c, f); return T.washing(c).most; };
  assert.ok(Math.abs(wash('mae') / wash(null) - (1 + T.RULES.table.wash * T.person('mae').business)) < 1e-6, 'the Bookkeeper: every laundry washes more for each point of his Business');
  const loads = (who) => {
    const { a, b, f } = twoTowns(3);
    f.dirty = 20000; a.repelled = 1;
    T.open(a, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 }); // plenty to send
    if (who) T.seat(a, f, who, 'routes');
    T.month(f, [a, b], ROAD);
    return T.convoys(f).length;
  };
  assert.equal(loads(null), T.RULES.convoy.loads);
  assert.equal(loads('sal'), T.RULES.convoy.loads + Math.floor(T.person('sal').cunning / 2), 'Routes: more loads down every road for his Cunning');
  const cools = (who) => { const { c, f } = knocking(); if (who) T.seat(c, f, who, 'fixer'); c.heat = 50; T.stepMonth(c, f); return 50 - c.heat; };
  assert.equal(cools('danny'), cools(null) + Math.floor(T.person('danny').charisma / 4), 'the Fixer: every city cools faster for his Charisma');
});

test('a man at the table is paid every month, and the day the boss takes his chair away he is gone for good', () => {
  const { c, f } = knocking();
  T.seat(c, f, 'mae', 'bookkeeper');
  f.dirty = T.RULES.table.pay + 500; f.clean = 0;
  const events = T.month(f, [c]);
  assert.ok(!events.some((e) => e.type === 'unpaid'));
  assert.equal(T.table(f)[0].paid, true);
  assert.ok(T.funds(f) < 500 + c.flow.up + 1, 'her pay left the boss\'s money');
  f.dirty = 0; f.clean = 0;
  const broke = T.month(f, [c]).find((e) => e.type === 'unpaid' && e.capo === 'mae');
  assert.equal(broke.label, 'Mae has not been paid');
  assert.equal(T.table(f)[0].paid, false);
  f.dirty = 0; f.clean = 0;
  assert.ok(!T.month(f, [c]).some((e) => e.type === 'unpaid'), 'said once, not every month');
  assert.equal(T.table(f)[0].paid, false);
  f.dirty = T.RULES.table.pay + 500;
  T.month(f, [c]);
  f.dirty = 0; f.clean = 0;
  assert.ok(T.month(f, [c]).some((e) => e.type === 'unpaid' && e.capo === 'mae'), 'and said again the next time it happens');
  T.unseat(f, 'bookkeeper');
  assert.equal(T.table(f)[0].capo, null);
  assert.ok(!coming(c, f).includes('mae'), 'she does not come back');
  assert.throws(() => T.unseat(f, 'bookkeeper'), /nobody sits there/);
});

// --- the underboss: one capo the boss names to hold a city, who takes in the men at the door himself ---
const twoCapos = () => {
  const { c, f } = knocking(); // dutch, with mae, sal and danny at the door
  T.welcome(c, f, 'mae', 8, 4);
  return { c, f };
};

test('the boss names one of his capos underboss of a city where the family has two capos or more', () => {
  const alone = knocking();
  assert.throws(() => T.underboss(alone.c, alone.f, 'dutch'), /^Error: one capo holds town alone: it needs no underboss yet$/);
  const { c, f } = twoCapos();
  assert.equal(T.view(c, f).under, null);
  assert.throws(() => T.underboss(c, f, 'sal'), /sal is not one of yours in town/);
  T.underboss(c, f, 'dutch');
  const v = T.view(c, f);
  assert.equal(v.under, 'dutch');
  assert.deepEqual(v.capos.map((k) => [k.id, !!k.under]), [['dutch', true], ['mae', false]]);
  T.underboss(c, f, 'mae');
  assert.equal(T.view(c, f).under, 'mae', 'the boss may change his mind');
});

test('the underboss takes in the men at the door himself: the boss pays, nobody knocks', () => {
  const { c, f } = twoCapos();
  T.underboss(c, f, 'dutch');
  const cost = T.doors(c, f).find((d) => d.capo === 'sal').cost, had = T.funds(f);
  const events = T.stepMonth(c, f);
  assert.ok(!events.some((e) => e.type === 'knocks'));
  const e = events.find((x) => x.type === 'welcomed');
  assert.deepEqual([e.capo, e.by, e.cost], ['sal', 'dutch', cost]);
  assert.equal(e.label, T.person('sal').name + ' joins the family: Dutch gives him a club in ' + T.zoneOf(c, e.x, e.y).name);
  assert.deepEqual(T.clubOf(c, 'sal') && [T.clubOf(c, 'sal').x, T.clubOf(c, 'sal').y], [e.x, e.y]);
  assert.ok(f.men.sal);
  assert.ok(T.funds(f) <= had - cost + c.flow.up, 'the boss paid for him');
  assert.equal(events.filter((x) => x.type === 'welcomed').length, 1, 'one man a month, and the city has three seats');
});

test('with no seat or no money the underboss lets a man wait, without a word to the boss', () => {
  const { c, f } = twoCapos();
  T.underboss(c, f, 'dutch');
  f.dirty = 0; f.clean = 0;
  const events = T.stepMonth(c, f);
  assert.ok(!events.some((e) => e.type === 'knocks' || e.type === 'welcomed'));
  assert.ok(coming(c, f).includes('sal'), 'he is still at the door');
});

test('without an underboss the men still knock; and the day the underboss leaves, the city has none', () => {
  const plain = twoCapos();
  assert.ok(T.stepMonth(plain.c, plain.f).some((e) => e.type === 'knocks'));
  const { c, f } = twoCapos();
  T.underboss(c, f, 'mae');
  f.clean = 50000;
  T.part(c, f, 'mae', 'retire');
  assert.equal(T.view(c, f).under, null);
});

test('every event about one of the family\'s men says where it happens: at his place, or else at his club', () => {
  const { c, f } = sixBars();
  f.men.dutch.xp = T.RULES.xp[1] - 1; f.men.dutch.cash = 5000;
  const seen = {};
  for (let m = 0; m < 6; m++) for (const e of T.stepMonth(c, f)) seen[e.type] = e;
  for (const type of ['rank', 'car']) {
    assert.ok(seen[type], type + ' happened');
    assert.deepEqual([seen[type].x, seen[type].y], [2, 2], type + ' is shown at his club');
  }
});
