// The city as one fabric of blocks: the family's hold spreads place by place.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');

// A small town: the west is where people go out at night, the east is factories and a port.
const town = () => T.createCity({ id: 'town', w: 12, h: 6, zones: [
  { name: 'Lantern Row', x0: 0, y0: 0, x1: 5, y1: 5, traits: { nightlife: 1.5, industry: 0.3, port: 0, wealth: 1 } },
  { name: 'The Works', x0: 6, y0: 0, x1: 11, y1: 5, traits: { nightlife: 0.3, industry: 1.5, port: 1.2, wealth: 0.4 } },
] });
const ALL = () => { const t = {}; for (const k of Object.keys(D.SITES)) t[k] = 3; return t; };

test('a new city is nobody\'s', () => {
  const c = town();
  assert.deepEqual(T.share(c), { family: 0, rival: 0, contested: 0, free: 100 });
  assert.equal(T.zoneOf(c, 2, 2).name, 'Lantern Row');
  assert.equal(T.zoneOf(c, 9, 0).name, 'The Works');
  assert.throws(() => T.open(c, 12, 0, { owner: 'family', kind: 'still', capo: 'dutch' }), /outside/);
});

test('a place holds its own block firmly, the blocks around it less, and nothing far away', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  const at = (x, y) => T.hold(c, x, y).family;
  assert.ok(at(3, 3) > at(4, 3) && at(4, 3) > at(5, 3), 'it fades with distance');
  assert.equal(at(8, 3), 0);
  assert.equal(T.hold(c, 3, 3).rival, 0);
  assert.equal(T.grip(c, 3, 3), 'family');
  assert.equal(T.grip(c, 9, 3), null);
});

test('a bigger place holds more streets', () => {
  const small = town(), big = town();
  T.open(small, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(big, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  assert.ok(T.share(big).family > T.share(small).family);
  assert.equal(T.hold(small, 6, 3).family, 0);
  assert.ok(T.hold(big, 6, 3).family > 0);
});

test('where two families press on the same streets, the streets are contested', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 6, 3, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(T.grip(c, 3, 3), 'family');
  assert.equal(T.grip(c, 6, 3), 'rival');
  assert.equal(T.grip(c, 4, 3), 'family');
  assert.equal(T.grip(c, 5, 3), 'rival');
  const mid = town();
  T.open(mid, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(mid, 7, 3, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(T.grip(mid, 5, 3), 'contested');
  const s = T.share(mid);
  assert.ok(s.family > 0 && s.rival > 0 && s.contested > 0);
  assert.equal(Math.round(s.family + s.rival + s.contested + s.free), 100);
});

test('a block holds one place, and the place has one boss', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.throws(() => T.open(c, 3, 3, { owner: 'family', kind: 'still', capo: 'sal' }), /already/);
  assert.throws(() => T.open(c, 4, 3, { owner: 'family', kind: 'still' }), /capo/);
  assert.throws(() => T.open(c, 4, 3, { owner: 'family', kind: 'nonsense', capo: 'sal' }), /kind/);
  assert.deepEqual(T.places(c, 'dutch').map((p) => [p.x, p.y, p.kind, p.level]), [[3, 3, 'speakeasy', 1]]);
  assert.deepEqual(T.places(c, 'sal'), []);
});

test('a capo can only open next to what he holds, on a free block the rivals do not own', () => {
  const c = town();
  T.settle(c, 'dutch', 3, 3);
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy' });
  const edge = T.frontier(c, 'dutch');
  assert.ok(edge.length > 0);
  assert.ok(edge.every((b) => !T.at(c, b.x, b.y)), 'free blocks only');
  assert.ok(edge.every((b) => T.grip(c, b.x, b.y) === 'family'), 'streets he already holds');
  assert.ok(!edge.some((b) => b.x === 10), 'not across town');
  assert.deepEqual(T.frontier(c, 'sal'), [], 'Sal holds nothing here');
});

test('a capo arrives with a social club: his base, where he is found', () => {
  const c = town();
  T.settle(c, 'dutch', 3, 3);
  const club = T.at(c, 3, 3);
  assert.deepEqual([club.kind, club.capo, club.owner], ['club', 'dutch', 'family']);
  assert.deepEqual(T.clubOf(c, 'dutch'), { x: 3, y: 3 });
  assert.throws(() => T.settle(c, 'dutch', 8, 3), /already has a club/);
});

test('what a capo opens next depends on the street and on his trade', () => {
  const pick = (capo, x, y) => { const c = town(); T.settle(c, capo, x, y); return T.wants(c, capo, { rank: 1, tech: ALL() }); };
  const dutchWest = pick('dutch', 2, 3), dutchEast = pick('dutch', 9, 3), dannyWest = pick('danny', 2, 3);
  assert.equal(dutchWest.kind, 'speakeasy', 'a bootlegger where people go out');
  assert.equal(dutchEast.kind, 'still', 'the same man among the factories');
  assert.equal(dannyWest.kind, 'gambling', 'a gambler where people go out');
  for (const w of [dutchWest, dutchEast, dannyWest]) assert.ok(w.cost > 0 && w.why && Number.isInteger(w.x) && Number.isInteger(w.y));
});

test('a trade is a leaning, not a cage: with enough of one thing he opens another', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  const kinds = new Set();
  for (let i = 0; i < 9; i++) {
    const w = T.wants(c, 'dutch', { rank: 3, tech: ALL() });
    kinds.add(w.kind);
    T.open(c, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'dutch' });
  }
  assert.ok(kinds.size >= 3, [...kinds].join(', '));
  assert.ok(kinds.has('speakeasy'));
  assert.ok(![...kinds].some((k) => D.CAPOS.dutch.refuses.includes(k)));
});

test('he never opens a trade the family has not learned, nor one he refuses', () => {
  const c = town();
  T.settle(c, 'danny', 2, 3);
  const tech = ALL(); tech.gambling = 0; tech.speakeasy = 0;
  for (let i = 0; i < 6; i++) {
    const w = T.wants(c, 'danny', { rank: 3, tech });
    assert.ok(w.kind !== 'gambling' && w.kind !== 'speakeasy', w.kind);
    T.open(c, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'danny' });
  }
  const m = town();
  T.settle(m, 'mae', 2, 3);
  for (let i = 0; i < 8; i++) {
    const w = T.wants(m, 'mae', { rank: 3, tech: ALL() });
    assert.ok(!D.CAPOS.mae.refuses.includes(w.kind), w.kind);
    T.open(m, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'mae' });
  }
});

test('every place a capo runs makes his next one dearer, whatever the others hold', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  T.settle(c, 'sal', 9, 3);
  const first = T.price(c, 'dutch', 'still');
  assert.equal(first, D.SITES.still.cost);
  T.open(c, 3, 3, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 3, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  assert.equal(T.price(c, 'dutch', 'still'), Math.round(first * Math.pow(1 + T.RULES.dearer, 2)));
  assert.equal(T.price(c, 'sal', 'still'), first, 'Sal has opened nothing yet');
});

test('a capo runs only so many places for his rank; beyond that he makes them bigger', () => {
  assert.deepEqual(T.RULES.reach, [6, 10, 15, 20]);
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  for (let i = 0; i < T.RULES.reach[0]; i++) {
    const w = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
    assert.equal(w.move, 'open');
    T.open(c, w.x, w.y, { owner: 'family', kind: w.kind, capo: 'dutch' });
  }
  assert.equal(T.places(c, 'dutch').filter((p) => p.kind !== 'club').length, 6);
  const next = T.wants(c, 'dutch', { rank: 0, tech: ALL() });
  assert.equal(next.move, 'enlarge');
  assert.equal(T.at(c, next.x, next.y).capo, 'dutch');
  assert.equal(T.wants(c, 'dutch', { rank: 1, tech: ALL() }).move, 'open', 'a rank higher, he opens again');
  const flat = ALL(); for (const k of Object.keys(flat)) flat[k] = 1;
  assert.equal(T.wants(c, 'dutch', { rank: 0, tech: flat }), null, 'tier I everywhere: nothing left to do but wait for his rank');
});

// --- the month: places pay, the capo saves, and opens when he can ---
const year = (c, f, n = 12) => { const out = []; for (let i = 0; i < n; i++) out.push(...T.stepMonth(c, f)); return out; };
const family = (more) => Object.assign({ tech: ALL(), men: {}, dirty: 0 }, more);

test('a capo starts with money in his pocket, opens his first places, and they pay', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 3);
  T.join(f, 'dutch');
  assert.equal(f.men.dutch.cash, T.RULES.purse);
  const events = year(c, f);
  const opened = events.filter((e) => e.type === 'opened');
  assert.ok(opened.length >= 2, opened.length + ' places in a year');
  assert.deepEqual(Object.keys(opened[0]).sort(), ['capo', 'city', 'cost', 'kind', 'label', 'type', 'why', 'x', 'y']);
  assert.ok(f.dirty > 0, 'the boss has had his cut');
  assert.ok(f.men.dutch.income > 0);
});

test('a speakeasy pours what the family\'s stills make: without liquor it earns a third', () => {
  const dry = town(), wet = town(), f = family();
  for (const c of [dry, wet]) { T.settle(c, 'dutch', 2, 3); T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' }); }
  T.settle(wet, 'sal', 9, 3);
  T.open(wet, 9, 2, { owner: 'family', kind: 'still', capo: 'sal' });
  const bar = (c) => T.income(c, 'dutch') - T.RULES.club;
  assert.ok(Math.abs(bar(dry) / bar(wet) - T.RULES.dry) < 0.01, 'Dutch\'s bar pours Sal\'s liquor');
});

test('a place earns by the street it is on, by its size, and by how firmly the family holds it', () => {
  const pay = (x, more, rival) => {
    const c = town();
    T.settle(c, 'danny', x, 3);
    T.open(c, x + 1, 3, Object.assign({ owner: 'family', kind: 'gambling', capo: 'danny' }, more));
    if (rival) T.open(c, x + 2, 3, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
    return T.income(c, 'danny');
  };
  assert.ok(pay(2) > pay(8), 'a gambling room among the factories pays less');
  assert.ok(pay(2, { level: 2 }) > pay(2));
  assert.ok(pay(2, {}, true) < pay(2), 'with a rival pressing on the same street');
});

test('a capo who has no money waits, and says what he is saving for', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 3);
  T.join(f, 'dutch');
  f.men.dutch.cash = 0;
  assert.deepEqual(T.stepMonth(c, f).filter((e) => e.type === 'opened'), []);
  const plan = T.plan(c, f, 'dutch');
  assert.equal(plan.waiting, 'money');
  assert.ok(plan.cost > 0 && plan.progress >= 0 && plan.progress < 1);
});

test('time earns a man his rank, and his rank lets him run more', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 3);
  T.join(f, 'dutch');
  const events = year(c, f, 120);
  const ranks = events.filter((e) => e.type === 'rank');
  assert.ok(ranks.length >= 1);
  assert.match(ranks[0].label, /can now run 10 places/);
  assert.ok(T.places(c, 'dutch').length - 1 > T.RULES.reach[0]);
  assert.ok(T.places(c, 'dutch').length - 1 <= T.RULES.reach[f.men.dutch.rank]);
});

test('a capo with nothing but his club and empty pockets still gets started', () => {
  const c = town(), f = family();
  T.settle(c, 'vince', 8, 3);
  T.join(f, 'vince');
  f.men.vince.cash = 0;
  const opened = year(c, f, 24).filter((e) => e.type === 'opened');
  assert.ok(opened.length >= 1, 'his club pays for a first place within two years');
});

// --- the rivals: they were there first, they grow, and they answer ---
const ashport = () => T.createCity({ id: 'ashport', w: 20, h: 12, zones: [
  ['Uptown', 1.2, 0, 0, 1.5], ['Hillside', 1, 0.4, 0, 1.2], ['Market Street', 1.5, 0.5, 0, 1], ['Union Station', 0.8, 1, 0.8, 0.8],
  ['Little Calabria', 1.2, 0.5, 0, 0.5], ['Canal Street', 1, 1, 0.8, 0.5], ['Stockyards', 0.5, 1.5, 0.5, 0.5], ['The Docks', 0.8, 1.2, 1.5, 0.5],
].map((z, i) => ({ name: z[0], x0: (i % 4) * 5, y0: Math.floor(i / 4) * 6, x1: (i % 4) * 5 + 4, y1: Math.floor(i / 4) * 6 + 5,
                   traits: { nightlife: z[1], industry: z[2], port: z[3], wealth: z[4] } })) });
const rivals = (c) => T.places(c).filter((p) => p.owner !== 'family');

test('a rival family is seeded across the city, the same way every time', () => {
  const a = ashport(), b = ashport();
  T.seed(a, 'Callahan', 30); T.seed(b, 'Callahan', 30);
  assert.equal(rivals(a).length, 30);
  assert.deepEqual(rivals(a), rivals(b));
  assert.ok(rivals(a).every((p) => p.owner === 'Callahan' && T.TERRAIN[p.kind]));
  assert.ok(T.share(a).rival > 40, 'they hold much of the city: ' + Math.round(T.share(a).rival));
  assert.equal(a.rival, 'Callahan');
});

test('left alone, the rivals keep opening places on the streets they hold, up to a point', () => {
  const c = ashport(), f = family();
  T.seed(c, 'Callahan', 20);
  year(c, f, 60);
  const five = rivals(c).length;
  assert.ok(five > 20, five + ' places after five years');
  year(c, f, 600);
  assert.ok(rivals(c).length <= T.RULES.rivalMost * 240 / 100 + 1, 'they never fill the whole city');
});

test('the rivals burn out a place opened on their streets, and leave alone one deep in the family\'s', () => {
  const c = ashport(), f = family();
  T.seed(c, 'Callahan', 30);
  const theirs = rivals(c)[0];
  const spot = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => [theirs.x + dx, theirs.y + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < 20 && y < 12 && !T.at(c, x, y));
  T.join(f, 'mae');
  T.open(c, spot[0], spot[1], { owner: 'family', kind: 'rented', capo: 'mae' });
  const events = year(c, f, T.RULES.rivalEvery + 1);
  const burnt = events.find((e) => e.type === 'burnt');
  assert.ok(burnt, 'they come for it');
  assert.deepEqual([burnt.x, burnt.y, burnt.capo, burnt.by], [spot[0], spot[1], 'mae', 'Callahan']);
  assert.equal(T.at(c, spot[0], spot[1]), null);

  const quiet = town(), g = family();
  T.settle(quiet, 'mae', 2, 3); T.join(g, 'mae');
  T.open(quiet, 11, 0, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(year(quiet, g, 36).filter((e) => e.type === 'burnt').length, 0, 'too far to bother');
});

test('a hard man holds a street where a bookkeeper loses it', () => {
  const front = (capo) => {
    const c = town(), f = family();
    T.settle(c, capo, 3, 3); T.join(f, capo);
    f.men[capo].cash = -100000; // he opens nothing: we watch one place
    T.open(c, 5, 3, { owner: 'family', kind: 'still', capo });
    T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
    return year(c, f, 24);
  };
  assert.ok(front('mae').some((e) => e.type === 'burnt'));
  assert.ok(!front('sal').some((e) => e.type === 'burnt'));
  assert.ok(front('sal').some((e) => e.type === 'repelled'), 'Sal\'s men throw them back, and it shows');
});

test('each capo takes a rival\'s place his own way', () => {
  assert.equal(T.wayOf('sal'), 'force');
  assert.equal(T.wayOf('vince'), 'force');
  assert.equal(T.wayOf('tommy'), 'bribe');
  assert.equal(T.wayOf('mae'), 'buy');
  assert.equal(T.wayOf('dutch'), 'buy');
});

test('hemmed in, a capo goes for the rival\'s place next door, and it takes months', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 0, 0); T.join(f, 'sal');
  // every free block around him is taken by his own places: only the rival's bar is left to go for
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) T.open(c, x, y, { owner: 'family', kind: 'loans', capo: 'sal' });
  for (const [x, y] of [[2, 1], [1, 2], [3, 0], [3, 1], [0, 3], [1, 3], [3, 2], [2, 3], [3, 3]]) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
  T.open(c, 2, 2, { owner: 'Callahan', kind: 'speakeasy' });
  f.men.sal.cash = 50000; f.men.sal.rank = 3;
  const w = T.wants(c, 'sal', { rank: 3, tech: ALL() });
  assert.equal(w.move, 'take');
  assert.equal(w.way, 'force');
  assert.equal(T.at(c, w.x, w.y).owner, 'Callahan');
  const first = T.stepMonth(c, f);
  assert.ok(first.some((e) => e.type === 'moving' && e.way === 'force'));
  assert.equal(T.takes(c).length, 1);
  assert.deepEqual(Object.keys(T.takes(c)[0]).sort(), ['capo', 'cost', 'months', 'monthsLeft', 'way', 'x', 'y']);
  const later = year(c, f, T.RULES.take.force.months);
  const taken = later.find((e) => e.type === 'taken');
  assert.ok(taken);
  assert.deepEqual([T.at(c, taken.x, taken.y).owner, T.at(c, taken.x, taken.y).capo], ['family', 'sal']);
});

test('ten years in Ashport against the Callahans: a real foothold, never the whole city', () => {
  const c = ashport(), f = family();
  T.seed(c, 'Callahan', 30);
  const spot = T.landing(c);
  T.settle(c, 'dutch', spot.x, spot.y); T.join(f, 'dutch');
  const first = year(c, f, 12);
  const opened = first.filter((e) => e.type === 'opened').length;
  assert.ok(opened >= 2 && opened <= 5, opened + ' places opened the first year');
  const rest = year(c, f, 108);
  const s = T.share(c);
  assert.ok(s.family >= 8 && s.family <= 35, 'the family holds ' + Math.round(s.family) + '% after ten years');
  assert.ok(s.rival >= 30, 'the Callahans still hold ' + Math.round(s.rival) + '%');
  assert.ok(first.concat(rest).some((e) => e.type === 'burnt' || e.type === 'repelled'), 'and there was a fight');
});

// --- capos lean on one another ---
test('a hard man\'s club close by holds the street for a bookkeeper', () => {
  const front = (withSal) => {
    const c = town(), f = family();
    T.settle(c, 'mae', 3, 3); T.join(f, 'mae');
    f.men.mae.cash = -100000;
    T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'mae' });
    T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
    if (withSal) { T.settle(c, 'sal', 5, 5); T.join(f, 'sal'); f.men.sal.cash = -100000; }
    return year(c, f, 24);
  };
  assert.ok(front(false).some((e) => e.type === 'burnt'));
  const covered = front(true);
  assert.ok(!covered.some((e) => e.type === 'burnt'));
  const stood = covered.find((e) => e.type === 'repelled');
  assert.equal(stood.capo, 'mae');
  assert.equal(stood.heldBy, 'sal');
  assert.match(stood.label, /Sal's men/);
});

test('a club across town covers nothing', () => {
  const c = town(), f = family();
  T.settle(c, 'mae', 3, 3); T.join(f, 'mae'); f.men.mae.cash = -100000;
  T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'mae' });
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  T.settle(c, 'sal', 11, 0); T.join(f, 'sal'); f.men.sal.cash = -100000;
  assert.equal(T.cover(c, 5, 3).capo, 'mae');
  assert.ok(year(c, f, 24).some((e) => e.type === 'burnt' && e.capo === 'mae'));
});

test('with Sal beside her, Mae keeps a real business in Ashport for ten years', () => {
  const c = ashport(), f = family();
  T.seed(c, 'Callahan', 30);
  const spot = T.landing(c);
  T.settle(c, 'mae', spot.x, spot.y); T.join(f, 'mae');
  T.settle(c, 'sal', spot.x + 2, spot.y + 1); T.join(f, 'sal');
  year(c, f, 120);
  const hers = T.places(c, 'mae').filter((p) => p.kind !== 'club');
  assert.ok(hers.length >= 5, hers.length + ' places of Mae\'s still standing');
  assert.ok(hers.some((p) => p.kind === 'front' || p.kind === 'rented'), 'and she launders');
});

// --- key places: the few buildings a whole city turns on ---

// Sal with three places around the Callahans' brewery, and a boss with money.
const siege = () => {
  const c = town(), f = family();
  f.dirty = 20000;
  T.settle(c, 'sal', 8, 3);
  T.join(f, 'sal');
  T.open(c, 10, 3, { owner: 'Callahan', kind: 'key', key: 'brewery' });
  T.open(c, 9, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
  return { c, f };
};

test('a key place is one of a short list, and the city knows who holds each', () => {
  const c = town();
  assert.deepEqual(Object.keys(T.KEYS).sort(), ['brewery', 'cityhall', 'depot', 'hotel', 'port', 'precinct']);
  assert.throws(() => T.open(c, 2, 2, { owner: 'Callahan', kind: 'key', key: 'casino' }), /unknown key place/);
  T.open(c, 2, 2, { owner: 'Callahan', kind: 'key', key: 'hotel' });
  assert.throws(() => T.open(c, 4, 4, { owner: 'Callahan', kind: 'key', key: 'hotel' }), /already has/);
  assert.deepEqual(T.keys(c), [{ key: 'hotel', name: 'Grand Hotel', x: 2, y: 2, owner: 'Callahan', capo: null, gives: T.KEYS.hotel.gives }]);
  assert.ok(T.hold(c, 5, 2).rival > 0, 'it presses on the streets like a big place');
});

test('a capo never goes for a key place on his own: he asks the boss once he has it surrounded', () => {
  const { c, f } = siege();
  const idle = family({ tech: {} });
  T.join(idle, 'sal');
  T.stepMonth(c, idle);
  assert.deepEqual(T.asks(c, f), [], 'his club and one place are not enough');
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  const events = T.stepMonth(c, f);
  const ask = T.asks(c, f)[0];
  assert.equal(ask.capo, 'sal');
  assert.equal(ask.key, 'brewery');
  assert.equal(ask.way, 'force');
  assert.ok(ask.cost > 0 && ask.months > T.RULES.take.force.months);
  assert.ok(events.some((e) => e.type === 'asks' && e.key === 'brewery' && e.capo === 'sal'));
  for (let i = 0; i < 12; i++) T.stepMonth(c, f);
  assert.equal(T.at(c, 10, 3).owner, 'Callahan', 'nothing happens while the boss says nothing');
  assert.equal(T.asks(c, f).length, 1);
});

test('the boss says yes: he pays, and months later the key place is the family\'s', () => {
  const { c, f } = siege();
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.stepMonth(c, f);
  const ask = T.asks(c, f)[0], before = f.dirty;
  T.answer(c, f, ask.id, true);
  assert.equal(f.dirty, before - ask.cost);
  assert.deepEqual(T.asks(c, f), []);
  assert.equal(T.at(c, 10, 3).owner, 'Callahan');
  f.men.sal.cash = 5000;
  let taken = null, opened = 0;
  for (let i = 0; i < ask.months; i++) {
    const events = T.stepMonth(c, f);
    taken = events.find((e) => e.type === 'taken') || taken;
    opened += events.filter((e) => e.type === 'opened').length;
  }
  assert.ok(opened > 0, 'Sal goes on with his own business meanwhile');
  assert.equal(taken.key, 'brewery');
  assert.deepEqual(T.keys(c).map((k) => [k.key, k.owner, k.capo]), [['brewery', 'family', 'sal']]);
  assert.equal(T.at(c, 10, 3).kind, 'key');
});

test('the boss cannot say yes with empty pockets', () => {
  const { c, f } = siege();
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.stepMonth(c, f);
  f.dirty = 10;
  assert.throws(() => T.answer(c, f, T.asks(c, f)[0].id, true), /cannot pay/);
  assert.equal(T.asks(c, f).length, 1);
});

test('the boss says no: the capo lets it rest for two years, then asks again', () => {
  const { c, f } = siege();
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.stepMonth(c, f);
  T.answer(c, f, T.asks(c, f)[0].id, false);
  for (let i = 0; i < T.RULES.sulk - 1; i++) { T.stepMonth(c, f); assert.deepEqual(T.asks(c, f), []); }
  T.stepMonth(c, f); T.stepMonth(c, f);
  assert.equal(T.asks(c, f).length, 1);
});

test('a key place is not one of the places a capo\'s rank limits, and costs him no wages', () => {
  const c = town();
  T.settle(c, 'sal', 8, 3);
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  const before = T.income(c, 'sal');
  T.open(c, 10, 3, { owner: 'family', kind: 'key', key: 'precinct', capo: 'sal' });
  const f = family(); T.join(f, 'sal');
  f.tech = {};
  T.stepMonth(c, f);
  assert.equal(f.men.sal.xp, 1, 'one place run, not two');
  assert.equal(f.men.sal.income, before, 'and the precinct is not a business');
});

test('the brewery pours for every speakeasy of the family', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 2);
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.ok(T.liquor(c).wet < 1);
  const dry = T.income(c, 'dutch');
  T.open(c, 8, 3, { owner: 'family', kind: 'key', key: 'brewery', capo: 'dutch' });
  assert.equal(T.liquor(c).wet, 1);
  assert.ok(T.income(c, 'dutch') > dry);
});

test('the Grand Hotel, the port and the depot each lift the places of their own streets, and only those', () => {
  for (const [key, kind, other] of [['hotel', 'speakeasy', 'loans'], ['port', 'fence', 'speakeasy'], ['depot', 'chopshop', 'speakeasy']]) {
    const c = town();
    T.settle(c, 'danny', 2, 2);
    T.open(c, 3, 2, { owner: 'family', kind: kind, capo: 'danny' });
    const one = T.income(c, 'danny') - T.RULES.club;
    T.open(c, 3, 3, { owner: 'family', kind: other, capo: 'danny' });
    const both = T.income(c, 'danny');
    T.open(c, 8, 4, { owner: 'family', kind: 'key', key: key, capo: 'danny' });
    assert.ok(Math.abs(T.income(c, 'danny') - both - one * T.KEYS[key].lifts.by) < 0.01, key + ' lifts a ' + kind + ' and leaves a ' + other + ' as it was');
    assert.ok(T.KEYS[key].lifts.by > 0);
  }
});

test('with City Hall in its pocket the family opens places cheaper', () => {
  const c = town();
  T.settle(c, 'tommy', 2, 2);
  const full = T.price(c, 'tommy', 'speakeasy');
  T.open(c, 8, 4, { owner: 'family', kind: 'key', key: 'cityhall', capo: 'tommy' });
  assert.equal(T.price(c, 'tommy', 'speakeasy'), Math.round(full * (1 - T.KEYS.cityhall.cheaper)));
});

test('with the precinct in its pocket a bookkeeper\'s place stands where it burnt', () => {
  const play = (bought) => {
    const c = town(), f = family();
    T.settle(c, 'mae', 2, 2); T.join(f, 'mae').cash = 0;
    T.open(c, 4, 2, { owner: 'family', kind: 'front', capo: 'mae' });
    T.open(c, 5, 2, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
    if (bought) T.open(c, 11, 5, { owner: 'family', kind: 'key', key: 'precinct', capo: 'mae' });
    f.tech = {}; // she opens nothing: only the raid is watched
    let seen = null;
    for (let i = 0; i < T.RULES.rivalEvery; i++) seen = T.stepMonth(c, f).find((e) => e.type === 'burnt' || e.type === 'repelled') || seen;
    return seen.type;
  };
  assert.equal(play(false), 'burnt');
  assert.equal(play(true), 'repelled');
});

test('the family that was there first holds all six key places, each on a street that suits it', () => {
  const c = ashport();
  T.crown(c, 'Callahan');
  const keys = T.keys(c);
  assert.equal(keys.length, 6);
  assert.ok(keys.every((k) => k.owner === 'Callahan'));
  const zone = (id) => { const k = keys.find((q) => q.key === id); return T.zoneOf(c, k.x, k.y).name; };
  assert.equal(zone('port'), 'The Docks');
  assert.equal(zone('cityhall'), 'Uptown');
  assert.equal(zone('brewery'), 'Stockyards');
  for (const a of keys) for (const b of keys) if (a !== b) assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 3, 'they stand apart');
  T.seed(c, 'Callahan', 30);
  assert.equal(rivals(c).length, 36);
});

// --- speed: a month of rules must fit well inside one frame on a phone ---

test('twenty years of Ashport with four capos play in well under a second', () => {
  const c = ashport(), f = family();
  T.crown(c, 'Callahan'); T.seed(c, 'Callahan', 30);
  for (const k of ['sal', 'mae', 'tommy', 'dutch']) { const l = T.landing(c); T.settle(c, k, l.x, l.y); T.join(f, k); }
  const start = process.hrtime.bigint();
  year(c, f, 240);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(T.places(c).length > 60, 'a full city');
  assert.ok(ms < 600, '240 months took ' + Math.round(ms) + ' ms');
});

test('the streets follow every change at once: a place enlarged, taken or burnt', () => {
  const c = town();
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.equal(T.hold(c, 6, 3).family, 0);
  T.open(c, 9, 3, { owner: 'Callahan', kind: 'speakeasy' });
  assert.ok(T.hold(c, 8, 3).rival > 0, 'a new place presses at once');
  const again = JSON.parse(JSON.stringify(c));
  assert.deepEqual(T.share(again), T.share(c), 'a city saved and loaded holds the same streets');
  assert.deepEqual(Object.keys(c).sort(), Object.keys(T.createCity({ id: 'x', w: 1, h: 1, zones: [] })).sort(), 'and nothing extra is saved with it');
});

// --- where capos come from: nobody is picked from a list, each arrives by a door ---

const rich = () => family({ dirty: 20000 });
const coming = (c, f) => T.doors(c, f).map((d) => d.capo).sort();

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
    for (const d of T.doors(c, f)) {
      const s = T.seats(c), spot = T.spots(c).find((q) => T.grip(c, q.x, q.y) === null) || T.spots(c)[0];
      if (T.funds(f) >= d.cost && s.taken < s.total && spot) { T.welcome(c, f, d.capo, spot.x, spot.y); seen.men.push(m); }
    }
    if (!f.study) {
      const w = T.wishes(c, f)[0], t = w ? T.tree(f).find((q) => q.kind === w.kind) : T.tree(f).filter((q) => q.next && q.tier > 0).sort((x, y) => x.tier - y.tier)[0];
      if (t && t.next && f.clean - 3000 >= t.next.cost) T.research(f, t.kind);
    }
    if (m % 60 === 0) seen.share[m / 12] = T.share(c).family;
  }
  return seen;
};

test('twenty years of saying yes, whoever the first capo is: slow at first, never dead, never the whole city', () => {
  for (const start of Object.keys(D.CAPOS)) {
    const g = yesMan(start);
    assert.ok(g.share[5] <= 30, start + ': ' + Math.round(g.share[5]) + '% after five years is too fast');
    assert.ok(g.share[20] >= 15, start + ': ' + Math.round(g.share[20]) + '% after twenty years, the family is dying');
    assert.ok(g.share[20] <= 85, start + ': ' + Math.round(g.share[20]) + '% after twenty years, nothing is left to fight for');
    assert.ok(g.share[20] >= g.share[5], start + ': it grows');
    assert.ok(g.men.length >= 2, start + ': ' + g.men.length + ' men joined');
    assert.ok(g.men[0] >= 12, start + ': nobody joins in the first year');
    assert.ok(g.learned.length >= 3, start + ': ' + g.learned.length + ' trades learned');
    assert.ok(!g.keys.length || g.keys[0] >= 60, start + ': no key place falls in the first five years');
  }
});

test('the first capo is a real choice: twenty years later the families are far apart', () => {
  const ends = Object.keys(D.CAPOS).map((start) => yesMan(start).share[20]);
  assert.ok(Math.max(...ends) - Math.min(...ends) >= 20);
  assert.ok(ends.filter((e) => e >= 30).length >= 3, 'and more than one start does well');
});

// --- two kinds of money: dirty money must be washed, and it draws the police while it sleeps ---

// Mae with her club and one front on the best street for it, and a family that opens nothing new.
const laundry = (level) => {
  const c = town(), f = family({ tech: {}, clean: 0 });
  T.settle(c, 'mae', 2, 2); T.join(f, 'mae').cash = 0;
  if (level) T.open(c, 3, 2, { owner: 'family', kind: 'front', capo: 'mae', level });
  return { c, f };
};

test('a front washes the boss\'s dirty money into clean money, for a cut', () => {
  const { c, f } = laundry(1);
  f.dirty = 200;
  T.stepMonth(c, f);
  const tribute = f.dirty + f.clean / (1 - D.SITES.front.loss) - 200; // what Mae sent up this month, all still dirty or washed
  assert.ok(f.clean > 0, 'some money came out clean');
  assert.ok(f.dirty < 200 + tribute, 'and left the dirty pile');
  assert.ok(Math.abs(T.washing(c).washed * (1 - D.SITES.front.loss) - f.clean) < 0.01, 'the cut stays with the front');
});

test('a front only washes so much a month, and a bigger front washes more', () => {
  const small = laundry(1), big = laundry(3);
  small.f.dirty = big.f.dirty = 50000;
  T.stepMonth(small.c, small.f); T.stepMonth(big.c, big.f);
  assert.equal(T.washing(small.c).washed, T.washing(small.c).most);
  assert.ok(T.washing(big.c).most > T.washing(small.c).most * 2);
  assert.ok(big.f.clean > small.f.clean);
});

test('without a front nothing is washed', () => {
  const { c, f } = laundry(0);
  f.dirty = 5000;
  T.stepMonth(c, f);
  assert.equal(f.clean, 0);
  assert.deepEqual(T.washing(c), { washed: 0, most: 0 });
});

test('a man is paid by his rank: dirty money first, clean money if it must, and he says so when there is neither', () => {
  const { c, f } = laundry(0);
  f.men.mae.rank = 2;
  const pay = T.RULES.pay[2];
  f.dirty = pay; f.clean = pay;
  let events = T.stepMonth(c, f);
  assert.ok(f.dirty < pay && f.clean === pay, 'paid in dirty money');
  assert.ok(!events.some((e) => e.type === 'unpaid'));
  f.dirty = 0; f.clean = pay;
  events = T.stepMonth(c, f);
  assert.ok(f.clean < pay, 'then in clean');
  f.dirty = 0; f.clean = 0; f.men.mae.cash = -1e6; // her club's tribute cannot cover it
  events = T.stepMonth(c, f);
  assert.ok(events.some((e) => e.type === 'unpaid' && e.capo === 'mae'));
  assert.equal(T.RULES.pay[0], 0, 'a Soldier lives off his streets');
});

test('dirty money that sleeps in the boss\'s safe heats the city; an empty safe lets it cool', () => {
  const { c, f } = laundry(0);
  f.dirty = T.RULES.stash * 3;
  T.stepMonth(c, f); T.stepMonth(c, f);
  const hot = c.heat;
  assert.ok(hot > 0);
  f.dirty = 0;
  T.stepMonth(c, f);
  assert.ok(c.heat < hot);
  for (let i = 0; i < 100; i++) { f.dirty = 0; T.stepMonth(c, f); }
  assert.equal(c.heat, 0);
});

test('when the heat boils over the police seize half the dirty money', () => {
  const { c, f } = laundry(0);
  let bust = null, before = 0;
  for (let i = 0; i < 200 && !bust; i++) {
    f.dirty = T.RULES.stash * 10; before = f.dirty;
    bust = T.stepMonth(c, f).find((e) => e.type === 'bust');
  }
  assert.ok(bust, 'it comes');
  assert.ok(Math.abs(bust.seized - f.dirty) < before * 0.1, 'about half is gone');
  assert.ok(f.dirty < before * 0.6);
  assert.ok(c.heat < 100 && c.heat > 0, 'and the city cools, for a while');
});

test('with the precinct in its pocket the family cools the city twice as fast', () => {
  const cool = (bought) => {
    const { c, f } = laundry(0);
    if (bought) T.open(c, 11, 5, { owner: 'family', kind: 'key', key: 'precinct', capo: 'mae' });
    c.heat = 50; f.dirty = 0;
    T.stepMonth(c, f);
    return 50 - c.heat;
  };
  assert.equal(cool(true), cool(false) * 2);
});

test('blood in the streets heats the city too', () => {
  const quiet = laundry(1), loud = laundry(1);
  T.open(loud.c, 4, 2, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  for (let i = 0; i < T.RULES.rivalEvery; i++) { quiet.f.dirty = loud.f.dirty = 0; T.stepMonth(quiet.c, quiet.f); T.stepMonth(loud.c, loud.f); }
  assert.equal(quiet.c.heat, 0);
  assert.ok(loud.c.heat > 0);
});

// --- what the screen reads: one plain picture of the city, nothing to work out ---

test('the view of a city gives the map everything it draws', () => {
  const c = town(), f = family({ dirty: 9000, clean: 0 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 2 });
  T.open(c, 9, 3, { owner: 'Callahan', kind: 'key', key: 'port' });
  T.open(c, 9, 1, { owner: 'Callahan', kind: 'still' });
  T.stepMonth(c, f);
  const v = T.view(c, f);
  assert.equal(v.id, 'town'); assert.equal(v.w, 12); assert.equal(v.h, 6); assert.equal(v.month, 1);
  assert.deepEqual(v.zones.map((z) => z.name), ['Lantern Row', 'The Works']);
  assert.equal(v.blocks.length, 12 * 6, 'every block, row by row');
  const b = v.blocks[2 * 12 + 3];
  assert.deepEqual([b.x, b.y, b.grip], [3, 2, 'family']);
  assert.ok(b.family > 0 && b.rival === 0);
  assert.equal(v.blocks[3 * 12 + 9].grip, 'rival');
  const bar = v.places.find((p) => p.x === 3 && p.y === 2);
  assert.deepEqual(bar, { x: 3, y: 2, owner: 'family', kind: 'speakeasy', name: D.SITES.speakeasy.name, level: 2, capo: 'dutch' });
  assert.equal(v.places.find((p) => p.kind === 'club').name, 'Social Club');
  const port = v.places.find((p) => p.kind === 'key');
  assert.equal(port.key, 'port'); assert.equal(port.name, 'The Port'); assert.equal(port.owner, 'Callahan');
  assert.deepEqual(v.keys, T.keys(c));
  assert.deepEqual(v.share, T.share(c));
  const dutch = v.capos[0];
  assert.deepEqual([dutch.id, dutch.name, dutch.rank, dutch.rankName, dutch.x, dutch.y], ['dutch', 'Dutch Keller', 0, 'Soldier', 2, 2]);
  assert.equal(dutch.places, T.places(c, 'dutch').length - 1);
  assert.equal(dutch.reach, T.RULES.reach[0]);
  assert.deepEqual(dutch.plan, T.plan(c, f, 'dutch'));
  assert.ok(dutch.income > 0 && typeof dutch.cash === 'number' && dutch.way === 'buy');
  assert.deepEqual(v.money, { dirty: f.dirty, clean: f.clean, washed: T.washing(c).washed, washes: T.washing(c).most });
  assert.equal(v.heat, c.heat);
  assert.deepEqual(v.seats, T.seats(c));
  assert.deepEqual(v.takes, T.takes(c)); assert.deepEqual(v.asks, T.asks(c)); assert.deepEqual(v.doors, T.doors(c, f));
  assert.equal(v.rival, 'Callahan');
  assert.deepEqual(v.tree, T.tree(f)); assert.deepEqual(v.wishes, T.wishes(c, f));
  assert.doesNotThrow(() => JSON.stringify(v));
  T.view(c, f).places[0].level = 9;
  assert.notEqual(T.view(c, f).places[0].level, 9, 'the view is a copy: the screen cannot change the game through it');
});

// --- the building tree: what the family knows how to run, learned with clean money ---

test('a new family knows the liquor trade and nothing else', () => {
  const f = T.createFamily();
  assert.deepEqual(Object.keys(f.tech).filter((k) => f.tech[k] > 0).sort(), ['rented', 'speakeasy', 'still', 'warehouse']);
  assert.deepEqual([f.dirty, f.clean, f.study], [0, 0, null]);
  const tree = T.tree(f);
  assert.equal(tree.length, Object.keys(T.TERRAIN).length);
  const still = tree.find((t) => t.kind === 'still'), loans = tree.find((t) => t.kind === 'loans');
  assert.deepEqual([still.tier, still.next.tier, still.next.cost, still.next.months], [1, 2, T.RULES.learn.cost[1], T.RULES.learn.months[1]]);
  assert.deepEqual([loans.tier, loans.next.tier, loans.next.cost], [0, 1, T.RULES.learn.cost[0]]);
  assert.equal(loans.name, D.SITES.loans.name);
});

test('the boss pays clean money, waits, and the family knows one tier more', () => {
  const f = T.createFamily(), c = town();
  assert.throws(() => T.research(f, 'loans'), /clean/);
  f.clean = T.RULES.learn.cost[0] + 5;
  assert.throws(() => T.research(f, 'casino'), /unknown/);
  T.research(f, 'loans');
  assert.equal(f.clean, 5);
  assert.throws(() => T.research(f, 'still'), /already/);
  assert.equal(T.tree(f).find((t) => t.kind === 'loans').studying, T.RULES.learn.months[0]);
  let learned = null;
  for (let i = 0; i < T.RULES.learn.months[0]; i++) {
    assert.equal(f.tech.loans, 0);
    learned = T.month(f, [c]).find((e) => e.type === 'learned') || learned;
  }
  assert.equal(f.tech.loans, 1);
  assert.deepEqual([learned.kind, learned.tier], ['loans', 1]);
  assert.equal(f.study, null);
  assert.equal(c.month, T.RULES.learn.months[0], 'and the city lived those months');
});

test('a man of the family who likes the trade teaches it in half the time', () => {
  const f = T.createFamily();
  f.clean = 1e6;
  T.join(f, 'sal');
  T.research(f, 'loans');
  assert.equal(f.study.monthsLeft, T.RULES.learn.months[0] / 2);
});

test('nothing goes beyond the third tier', () => {
  const f = T.createFamily();
  f.tech.still = 3; f.clean = 1e6;
  assert.equal(T.tree(f).find((t) => t.kind === 'still').next, null);
  assert.throws(() => T.research(f, 'still'), /nothing more/);
});

test('each capo says which closed trade he would open first, and never one he refuses', () => {
  const f = T.createFamily(), c = town();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.settle(c, 'dutch', 8, 2); T.join(f, 'dutch');
  T.settle(c, 'mae', 5, 4); T.join(f, 'mae');
  const w = T.wishes(c, f), of = (id) => w.find((q) => q.capo === id);
  assert.equal(of('sal').kind, 'loans');
  assert.equal(of('mae').kind, 'front');
  assert.equal(of('dutch').kind, 'fence', 'his first trades are open: he asks for the next he likes');
  f.tech.loans = 1;
  assert.equal(T.wishes(c, f).find((q) => q.capo === 'sal'), undefined, 'Sal likes nothing else that is closed');
  assert.equal(T.tree(f).find((t) => t.kind === 'front').wanted.join(), 'mae');
});

test('a rented laundry washes too: less than an owned front, and it keeps more', () => {
  const play = (kind) => {
    const { c, f } = laundry(0);
    T.open(c, 3, 2, { owner: 'family', kind, capo: 'mae' });
    f.dirty = 50000;
    T.stepMonth(c, f);
    return { washed: T.washing(c).washed, kept: 1 - f.clean / T.washing(c).washed };
  };
  const rented = play('rented'), front = play('front');
  assert.ok(rented.washed > 0 && rented.washed < front.washed);
  assert.ok(Math.abs(rented.kept - D.SITES.rented.loss) < 1e-9 && Math.abs(front.kept - D.SITES.front.loss) < 1e-9);
});

test('when dirty money piles up in the boss\'s safe, a capo opens a laundry before anything else', () => {
  const next = (dirty) => {
    const c = town(), f = T.createFamily();
    T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
    T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
    T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
    f.dirty = dirty;
    return T.plan(c, f, 'dutch');
  };
  assert.notEqual(next(0).kind, 'rented');
  const p = next(T.RULES.stash * 2);
  assert.equal(p.kind, 'rented');
  assert.match(p.why, /wash/);
});

test('Sal also comes to a family that keeps getting burnt out: it needs him', () => {
  const c = town(), f = rich();
  T.settle(c, 'mae', 2, 2); T.join(f, 'mae');
  assert.ok(!coming(c, f).includes('sal'));
  c.burnt = 2;
  const d = T.doors(c, f).find((q) => q.capo === 'sal');
  assert.match(d.why, /burn/);
  assert.equal(d.cost, T.RULES.doors.need, 'and he comes for less: he is the one who gains');
  assert.ok(T.RULES.doors.need < T.RULES.doors.name);
  assert.equal(T.createCity({ id: 'x', w: 1, h: 1, zones: [] }).burnt, 0);
});

test('clean money pays for anything dirty money pays for, once the dirty runs out', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  const cost = T.doors(c, f)[0].cost;
  f.dirty = 100; f.clean = cost;
  assert.equal(T.funds(f), 100 + cost);
  T.welcome(c, f, 'danny', 7, 4);
  assert.deepEqual([f.dirty, f.clean], [0, 100]);
  const s = siege();
  T.open(s.c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.stepMonth(s.c, s.f);
  const ask = T.asks(s.c)[0];
  s.f.dirty = 0; s.f.clean = ask.cost + 1;
  T.answer(s.c, s.f, ask.id, true);
  assert.equal(s.f.clean, 1);
});
