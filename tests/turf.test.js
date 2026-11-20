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
  assert.ok(s.family >= 8 && s.family <= 40, 'the family holds ' + Math.round(s.family) + '% after ten years');
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
  assert.ok(hers.length >= 4, hers.length + ' places of Mae\'s still standing');
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
  const waiting = T.places(c, 'sal').reduce((n, p) => n + (p.till || 0), 0);
  const made = (before - T.RULES.club) * (1 + T.RULES.own.boost); // Sal, with nothing else to do, stands over his one business
  assert.ok(Math.abs(f.men.sal.income + waiting - T.RULES.club - made) < 1e-6, 'and the precinct is not a business: nothing to fetch there');
  assert.equal(T.places(c, 'sal').find((p) => p.kind === 'key').till, undefined);
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

test('twenty years of saying yes, whoever the first capo is: slow at first, never dead, never the whole city', () => {
  for (const start of Object.keys(D.CAPOS)) {
    const g = yesMan(start);
    assert.ok(g.share[5] <= 30, start + ': ' + Math.round(g.share[5]) + '% after five years is too fast');
    assert.ok(g.share[20] >= 12, start + ': ' + Math.round(g.share[20]) + '% after twenty years, the family is dying');
    assert.ok(g.share[20] <= 90, start + ': ' + Math.round(g.share[20]) + '% after twenty years, nothing is left to fight for');
    assert.ok(g.share[20] >= g.share[5], start + ': it grows');
    assert.ok(g.men.length >= 2, start + ': ' + g.men.length + ' men joined');
    assert.ok(g.men[0] >= 12, start + ': nobody joins in the first year');
    assert.ok(g.learned.length >= 1, start + ': ' + g.learned.length + ' trades learned');
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
  const { till, strains, ...drawn } = bar;
  assert.deepEqual(strains, [{ kind: 'dry', label: 'Nothing to pour: the family has no still' }]);
  assert.deepEqual(drawn, { x: 3, y: 2, owner: 'family', kind: 'speakeasy', name: D.SITES.speakeasy.name, level: 2, capo: 'dutch' });
  assert.ok(till > 0 && till < T.RULES.car.load, 'and what waits in its till for the next car');
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
  assert.deepEqual([v.money.dirty, v.money.clean, v.money.washed, v.money.washes], [f.dirty, f.clean, T.washing(c).washed, T.washing(c).most]);
  assert.deepEqual(Object.keys(v.money).sort(), ['clean', 'cut', 'dirty', 'pay', 'seized', 'up', 'washed', 'washes']);
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
  assert.deepEqual(Object.keys(f.tech).filter((k) => f.tech[k] > 0).sort(), ['cars', 'rented', 'speakeasy', 'still', 'warehouse'], 'four trades, and the cars to carry the money');
  assert.deepEqual([f.dirty, f.clean, f.study], [0, 0, null]);
  const tree = T.tree(f);
  assert.equal(tree.length, Object.keys(T.TERRAIN).length + 1, 'every trade, and the cars');
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

// --- what moves in the streets this month, for the map ---

test('the trips of a city: liquor from the stills to the bars, takings to the club, dirty money to the laundry, crews to what they take', () => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'dutch' });
  T.open(c, 10, 4, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'dutch', x: 10, y: 4, way: 'buy', kind: 'speakeasy', cost: 1, month: 0, months: 3 });
  const trips = T.trips(c, f), of = (kind) => trips.filter((t) => t.kind === kind);
  assert.deepEqual(of('liquor'), [], 'no month has gone by: no truck has left the still');
  assert.deepEqual(of('takings'), [], 'no month has gone by: no till is full, no car has left');
  assert.deepEqual(of('wash'), [{ kind: 'wash', cargo: 'cash', capo: 'dutch', from: { x: 2, y: 2 }, to: { x: 3, y: 3 }, amount: 0 }], 'no month has gone by: nothing washed yet');
  assert.deepEqual(of('crew'), [{ kind: 'crew', cargo: 'buy', capo: 'dutch', from: { x: 2, y: 2 }, to: { x: 10, y: 4 } }]);
  f.dirty = 0;
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'wash'), [], 'nothing to wash, nobody drives to the laundry');
  assert.deepEqual(T.view(c, f).trips, T.trips(c, f));
});

test('a truck leaves the fullest cellar for the thirstiest bar, the nearest one first; a bar with no still gets no truck', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 5, 2); T.join(f, 'dutch'); kept(c, 'dutch');
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  T.open(c, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.stepMonth(c, f);
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'liquor'), []);
  T.open(c, 0, 4, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 10, 1, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 9, 4, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'liquor');
  assert.equal(runs.length, 4, 'two loads from each still');
  const from = (x, y) => [...new Set(runs.filter((t) => t.to.x === x && t.to.y === y).map((t) => t.from.x + ',' + t.from.y))];
  assert.deepEqual(from(1, 1), ['0,4']);
  assert.deepEqual(from(9, 4), ['10,1']);
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
const kinds = (c, capo) => T.places(c, capo).filter((p) => p.kind !== 'club').map((p) => p.kind + p.level).sort();

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

// --- a bigger family pays more ---

test('every man the family already counts makes the next one dearer, wherever he is', () => {
  const c = town(), f = rich();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  const price = () => T.doors(c, f).find((d) => d.capo === 'danny').cost;
  assert.equal(price(), T.RULES.doors.name, 'the second man costs the plain price');
  T.join(f, 'mae');
  assert.equal(price(), Math.round(T.RULES.doors.name * (1 + T.RULES.crowd) / 50) * 50);
  T.join(f, 'sal'); T.join(f, 'tommy');
  assert.equal(price(), Math.round(T.RULES.doors.name * Math.pow(1 + T.RULES.crowd, 3) / 50) * 50);
  f.dirty = price() - 1;
  assert.throws(() => T.welcome(c, f, 'danny', 7, 4), /cannot pay/);
});

test('every key place the family holds, in any city, makes the next one dearer', () => {
  const { c, f } = siege(), other = town();
  other.id = 'other';
  T.settle(other, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(other, 4, 4, { owner: 'family', kind: 'key', key: 'depot', capo: 'dutch' });
  T.open(other, 8, 4, { owner: 'family', kind: 'key', key: 'port', capo: 'dutch' });
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  const asked = T.month(f, [other, c]).find((e) => e.type === 'asks');
  assert.equal(f.crowns, 2);
  const plain = T.RULES.keyCost * T.RULES.take[asked.way].cost;
  assert.equal(asked.cost, Math.round(plain * Math.pow(1 + T.RULES.greed, 2) / 50) * 50);
  assert.equal(T.asks(c)[0].cost, asked.cost);
});

test('the bigger the man, the more he keeps: what a Soldier cannot use all goes up, a Legend sends a tenth', () => {
  const tribute = T.RULES.club * T.RULES.tribute, spare = 1000;
  const up = (rank) => {
    const c = town(), f = family({ dirty: 1000 });
    T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
    f.men.dutch.rank = rank; f.men.dutch.xp = T.RULES.xp[rank];
    for (const k of Object.keys(f.tech)) f.tech[k] = 0; // nothing he may open: all he has is spare
    f.men.dutch.cash = T.RULES.pocket + spare + tribute - T.RULES.club;
    T.stepMonth(c, f);
    return { sent: f.dirty - 1000 + T.RULES.pay[rank] - tribute, kept: f.men.dutch.cash };
  };
  assert.deepEqual(T.RULES.keeps, [0, 0.5, 0.75, 0.9]);
  assert.deepEqual([0, 1, 2, 3].map((r) => Math.round(up(r).sent)), [0, 1, 2, 3].map((r) => Math.round(spare * (1 - T.RULES.keeps[r]))));
  assert.equal(up(3).kept, up(0).kept, 'what he keeps he spends on himself: it does not pile up in his club');
});

test('nobody knows the first man in a new city: the rivals leave the family alone there for two years', () => {
  const quiet = (sent) => {
    const a = town(), b = ashport(), f = rich();
    b.id = 'next';
    T.crown(b, 'Kessler'); T.seed(b, 'Kessler', 30);
    T.settle(a, 'dutch', 2, 2); T.join(f, 'dutch');
    T.open(a, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
    const l = T.landing(b);
    if (sent) T.send(a, b, f, 'danny', l.x, l.y); else { T.settle(b, 'danny', l.x, l.y); T.join(f, 'danny'); }
    const raids = [];
    for (let m = 1; m <= 48; m++) for (const e of T.stepMonth(b, f)) if (e.type === 'burnt' || e.type === 'repelled') raids.push(m);
    return raids;
  };
  const known = quiet(false), fresh = quiet(true);
  assert.ok(known.length && known[0] <= T.RULES.respite, 'a man the city knows is raided within two years: month ' + known[0]);
  assert.ok(fresh.length, 'the peace does not last');
  assert.ok(fresh[0] > T.RULES.respite, 'first raid in month ' + fresh[0]);
  assert.equal(T.RULES.respite, 24);
});

// --- money that can be followed ---

test('every trip says how many dollars it carries, and they add up to what the city reports', () => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 3 });
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'dutch' });
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const trips = T.trips(c, f), sum = (kind) => trips.filter((t) => t.kind === kind).reduce((n, t) => n + t.amount, 0);
  const takings = trips.filter((t) => t.kind === 'takings');
  assert.ok(takings.length >= 2, 'one trip for every load fetched, even from the same place');
  assert.ok(takings.every((t) => t.amount === T.RULES.car.load && t.cargo === 'cash' && t.from.x === 3 && t.from.y === 2 && t.to.x === 2 && t.to.y === 2));
  assert.equal(sum('takings') + T.RULES.club, f.men.dutch.income, 'the takings are what reached his club');
  assert.equal(sum('wash'), Math.round(c.washed), 'the wash trips carry what was washed');
  assert.ok(sum('wash') > 0);
});

test('the city says what came up to the boss last month, man by man, and what went out', () => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'dutch' });
  f.men.dutch.rank = 1;
  const before = { dirty: f.dirty, clean: f.clean || 0 };
  T.stepMonth(c, f);
  const m = T.view(c, f).money, man = T.view(c, f).capos[0];
  assert.ok(m.up > 0);
  assert.equal(man.sent, m.up, 'one capo: all of it is his');
  assert.equal(m.pay, T.RULES.pay[1]);
  assert.equal(m.seized, 0);
  assert.ok(m.cut > 0 && m.washed > m.cut);
  assert.ok(Math.abs(f.dirty - (before.dirty + m.up - m.pay - m.washed)) < 1e-6, 'dirty: what came up, less the pay, less what went to the wash');
  assert.ok(Math.abs(f.clean - (before.clean + m.washed - m.cut)) < 1e-6, 'clean: what was washed, less the cut');
});

// --- money is carried, run by run ---
// Dutch with his club and six big bars that together make more than two cars can carry in a month.
const LOAD = T.RULES.car.load, RUNS = T.RULES.car.runs;
// A capo who waits for the boss's word in front of a key place lends no hand to his own places.
const kept = (c, capo) => c.asks.push({ id: 'town:port', capo, key: 'port', x: 11, y: 5, way: 'buy', cost: 1e9, months: 1, why: 'kept busy' });
const sixBars = (free) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  if (!free) kept(c, 'dutch');
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]]) T.open(c, x, y, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 3 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0; // nothing to open or enlarge: only the money moves
  return { c, f };
};
const tills = (c) => T.view(c, T.createFamily()).places.reduce((n, p) => n + (p.till || 0), 0);

test('takings wait in the till of a place until one of the capo\'s cars fetches them: a full load a run, so many runs a month for a car', () => {
  const { c, f } = sixBars();
  const earned = T.income(c, 'dutch') - T.RULES.club;
  assert.ok(earned > 2 * RUNS * LOAD, 'six bars make more than two cars can carry');
  assert.equal(f.men.dutch.cars, 1);
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.length, RUNS);
  assert.ok(runs.every((t) => t.amount === LOAD && t.to.x === 2 && t.to.y === 2));
  assert.equal(new Set(runs.map((t) => t.from.x + ',' + t.from.y)).size, Math.min(6, RUNS), 'the fullest till first: every bar is visited before any is visited twice');
  assert.equal(f.men.dutch.income, T.RULES.club + RUNS * LOAD, 'he only has what reached his club');
  assert.ok(Math.abs(tills(c) - (earned - RUNS * LOAD)) < 1e-6, 'the rest waits where it was made');
  const man = T.view(c, f).capos[0];
  assert.deepEqual([man.cars, man.waiting], [1, Math.round(earned - RUNS * LOAD)]);
});

test('a second car brings home twice as much', () => {
  const { c, f } = sixBars();
  f.men.dutch.cars = 2;
  T.stepMonth(c, f);
  assert.equal(T.trips(c, f).filter((t) => t.kind === 'takings').length, 2 * RUNS);
  assert.equal(f.men.dutch.income, T.RULES.club + 2 * RUNS * LOAD);
});

test('when the tills pile up the capo buys another car, and says why', () => {
  const { c, f } = sixBars();
  f.men.dutch.cash = 5000;
  const bought = T.stepMonth(c, f).find((e) => e.type === 'car');
  assert.ok(bought);
  assert.deepEqual([bought.capo, bought.cars, bought.cost], ['dutch', 2, T.RULES.car.cost]);
  assert.match(bought.label, /Dutch buys a second car/);
  assert.equal(f.men.dutch.cars, 2);
  const { c: c2, f: f2 } = sixBars();
  f2.men.dutch.cash = 0;
  assert.ok(!T.stepMonth(c2, f2).some((e) => e.type === 'car'), 'not with empty pockets');
  const calm = town(), g = family();
  T.settle(calm, 'dutch', 2, 2); T.join(g, 'dutch'); g.men.dutch.cash = 5000;
  T.open(calm, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  for (const k of Object.keys(g.tech)) g.tech[k] = 0;
  assert.ok(!year(calm, g, 6).some((e) => e.type === 'car'), 'one car is plenty for one bar');
});

test('every car after the first costs its upkeep each month', () => {
  const after = (cars) => { const { c, f } = sixBars(); f.men.dutch.cars = cars; f.men.dutch.cash = 0; T.stepMonth(c, f); return { money: f.men.dutch.cash + f.dirty, tills: tills(c) }; };
  const five = after(5), six = after(6);
  assert.equal(five.tills, six.tills, 'five cars already carry every full load there is');
  assert.ok(Math.abs(five.money - six.money - T.RULES.car.upkeep) < 1e-6, 'one car more, with nothing more to carry, costs $' + T.RULES.car.upkeep);
  assert.ok(after(1).money < after(2).money, 'and a car that has loads to carry pays for itself');
  const { c, f } = sixBars(); f.men.dutch.cash = 0; T.stepMonth(c, f);
  assert.equal(f.men.dutch.cash + f.dirty, T.RULES.club + RUNS * LOAD - 6 * T.RULES.wage, 'the car a man came with costs nothing');
});

test('a car only leaves full: a small place waits until its till holds a whole load', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'rented', capo: 'dutch' });
  kept(c, 'dutch');
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  const made = T.income(c, 'dutch') - T.RULES.club;
  assert.ok(made > 0 && made < T.RULES.car.load / 2, 'it makes $' + made + ' a month');
  const months = Math.ceil(T.RULES.car.load / made);
  for (let m = 1; m < months; m++) {
    T.stepMonth(c, f);
    assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'takings'), [], 'month ' + m + ': not a full load yet');
    assert.equal(f.men.dutch.income, T.RULES.club);
  }
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.deepEqual(runs.map((t) => t.amount), [T.RULES.car.load]);
  assert.ok(Math.abs(tills(c) - (made * months - T.RULES.car.load)) < 1e-6, 'what is over stays for the next car');
});

// --- a capo is somewhere: at his club, or where his business takes him ---
const whereIs = (c, f, id) => T.view(c, f).capos.find((k) => k.id === id).at;

test('a capo with nothing on his hands is at his club', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  assert.deepEqual(whereIs(c, f, 'dutch'), { x: 2, y: 2, why: 'home', label: 'At his club' });
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'capo'), [], 'and nobody is on the road');
});

test('a capo who is taking a place stands in front of it until it is settled', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.open(c, 4, 2, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'sal', x: 4, y: 2, way: 'force', kind: 'speakeasy', cost: 1, month: 0, months: 3 });
  const at = whereIs(c, f, 'sal');
  assert.deepEqual([at.x, at.y, at.why], [4, 2, 'take']);
  assert.match(at.label, /Taking the Callahans' speakeasy in Lantern Row/i);
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'capo'), [{ kind: 'capo', cargo: 'take', capo: 'sal', from: { x: 2, y: 2 }, to: { x: 4, y: 2 }, vehicle: 'sal:own', home: { x: 2, y: 2 } }]);
  c.ops.length = 0;
  assert.equal(whereIs(c, f, 'sal').why, 'home', 'then he goes home');
});

test('a capo goes where the rivals struck, and stays there for the month', () => {
  const c = town(), f = family();
  T.settle(c, 'mae', 3, 3); T.join(f, 'mae');
  f.men.mae.cash = -100000;
  T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'mae' });
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  let hit = null;
  for (let m = 0; m < 24 && !hit; m++) hit = T.stepMonth(c, f).find((e) => e.type === 'burnt' || e.type === 'repelled');
  assert.ok(hit);
  const at = whereIs(c, f, 'mae');
  assert.deepEqual([at.x, at.y, at.why], [hit.x, hit.y, 'raid']);
  assert.match(at.label, /Callahans/);
  T.stepMonth(c, f);
  assert.equal(whereIs(c, f, 'mae').why, 'home', 'a month later she is back');
});

test('the man who holds the street is the one who goes to the fight', () => {
  const c = town(), f = family();
  T.settle(c, 'mae', 3, 3); T.join(f, 'mae'); f.men.mae.cash = -100000;
  T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'mae' });
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  T.settle(c, 'sal', 5, 5); T.join(f, 'sal'); f.men.sal.cash = -100000;
  let hit = null;
  for (let m = 0; m < 24 && !hit; m++) hit = T.stepMonth(c, f).find((e) => e.type === 'repelled');
  assert.equal(hit.heldBy, 'sal');
  assert.deepEqual([whereIs(c, f, 'sal').x, whereIs(c, f, 'sal').y, whereIs(c, f, 'sal').why], [hit.x, hit.y, 'raid']);
  assert.notEqual(whereIs(c, f, 'mae').why, 'raid');
});

test('two capos at each other\'s throats: the one who started it stands at the other\'s door', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.settle(c, 'dutch', 8, 3); T.join(f, 'dutch');
  c.feuds = [{ id: 'sal|dutch', a: 'sal', b: 'dutch', month: 0, label: 'x' }];
  const at = whereIs(c, f, 'sal');
  assert.deepEqual([at.x, at.y, at.why], [8, 3, 'feud']);
  assert.match(at.label, /Dutch/);
  assert.equal(whereIs(c, f, 'dutch').why, 'home', 'the other waits for him at home');
});

test('a capo who asks for a key place waits in front of it for the boss\'s word', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.open(c, 4, 3, { owner: 'Callahan', kind: 'key', key: 'precinct' });
  c.asks.push({ id: 'town:precinct', capo: 'sal', key: 'precinct', x: 4, y: 3, way: 'force', cost: 1, months: 1, why: 'x' });
  const at = whereIs(c, f, 'sal');
  assert.deepEqual([at.x, at.y, at.why], [4, 3, 'asks']);
});

// --- a free capo takes his own car to where his business chokes ---
const oneBar = () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 2 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

test('with nothing else on his hands a capo stands over his best place, and it makes more that month', () => {
  const { c, f } = oneBar();
  const plain = T.income(c, 'dutch') - T.RULES.club;
  T.stepMonth(c, f);
  const at = whereIs(c, f, 'dutch');
  assert.deepEqual([at.x, at.y, at.why], [3, 2, 'boost']);
  assert.match(at.label, /Standing over his .* in Lantern Row/);
  const made = f.men.dutch.income - T.RULES.club + tills(c);
  assert.ok(Math.abs(made - plain * (1 + T.RULES.own.boost)) < 1e-6, 'it made $' + made + ' instead of $' + plain);
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'capo'), [{ kind: 'capo', cargo: 'boost', capo: 'dutch', from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, vehicle: 'dutch:own', home: { x: 2, y: 2 } }]);
});

test('a capo who is busy elsewhere boosts nothing', () => {
  const { c, f } = oneBar();
  const plain = T.income(c, 'dutch') - T.RULES.club;
  T.open(c, 9, 3, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'dutch', x: 9, y: 3, way: 'buy', kind: 'speakeasy', cost: 1, month: 0, months: 6 });
  T.stepMonth(c, f);
  assert.equal(whereIs(c, f, 'dutch').why, 'take');
  assert.ok(Math.abs(f.men.dutch.income - T.RULES.club + tills(c) - plain) < 1e-6);
});

test('when the bars run dry he stands over his still, and it pours more', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  for (const [x, y] of [[1, 1], [2, 1], [3, 1]]) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  const dry = T.liquor(c).wet;
  assert.ok(dry < 1);
  T.stepMonth(c, f);
  const at = whereIs(c, f, 'dutch');
  assert.deepEqual([at.x, at.y, at.why], [8, 2, 'boost']);
  assert.ok(Math.abs(T.liquor(c).wet - dry * (1 + T.RULES.own.boost)) < 1e-6, 'the still pours a quarter more');
});

test('when his cars could not empty the tills last month, he drives the takings home himself', () => {
  const { c, f } = sixBars(true);
  T.stepMonth(c, f);
  assert.ok(f.men.dutch.waiting >= LOAD, 'tills were left full');
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.length, RUNS * f.men.dutch.cars + T.RULES.own.runs);
  assert.equal(runs.filter((t) => t.own).length, T.RULES.own.runs, 'his own runs are marked');
  const at = whereIs(c, f, 'dutch'), mine = runs.find((t) => t.own);
  assert.deepEqual([at.x, at.y, at.why], [mine.from.x, mine.from.y, 'carry']);
  assert.match(at.label, /Driving the takings/);
  assert.equal(f.men.dutch.income, T.RULES.club + runs.length * LOAD);
});

// --- bigger cars are learned by the family, like a trade ---
test('the family tree has a line for cars: three sizes, the first one known from the start', () => {
  const f = T.createFamily();
  const cars = T.tree(f).find((t) => t.kind === 'cars');
  assert.deepEqual([cars.name, cars.tier, cars.gives], ['Cars', 1, 'A car carries $' + T.RULES.car.loads[1] + ' a run']);
  assert.deepEqual(cars.next, { tier: 2, cost: T.RULES.learn.cost[1], months: T.RULES.learn.months[1], gives: 'A car carries $' + T.RULES.car.loads[2] + ' a run' });
  assert.equal(T.RULES.car.loads[1], T.RULES.car.load);
  assert.ok(T.RULES.car.loads[1] < T.RULES.car.loads[2] && T.RULES.car.loads[2] < T.RULES.car.loads[3]);
});

test('once the family has learned bigger cars, every run carries the bigger load', () => {
  const { c, f } = sixBars();
  f.clean = 99999; f.study = null;
  T.research(f, 'cars');
  assert.equal(f.clean, 99999 - T.RULES.learn.cost[1]);
  let learned = null;
  for (let m = 0; m < 12 && !learned; m++) learned = T.month(f, [c]).find((e) => e.type === 'learned');
  assert.deepEqual([learned.kind, learned.tier], ['cars', 2]);
  assert.match(learned.label, /cars that carry \$250 a run/);
  T.month(f, [c]);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.ok(runs.length > 0 && runs.every((t) => t.amount === T.RULES.car.loads[2]));
  assert.equal(T.tree(f).find((t) => t.kind === 'cars').tier, 2);
});

test('a capo whose tills are left full asks for bigger cars, and that halves the time it takes', () => {
  const { c, f } = sixBars();
  assert.deepEqual(T.tree(f).find((t) => t.kind === 'cars').wanted, []);
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  assert.ok(f.men.dutch.stuck);
  const cars = T.tree(f).find((t) => t.kind === 'cars');
  assert.deepEqual(cars.wanted, ['dutch']);
  assert.equal(cars.next.months, T.RULES.learn.months[1] * T.RULES.learn.taught);
  const wish = T.wishes(c, f).find((w) => w.kind === 'cars');
  assert.deepEqual([wish.capo, wish.name], ['dutch', 'Cars']);
  assert.match(wish.label, /Dutch wants bigger cars/);
});

test('there is nothing bigger than the biggest car', () => {
  const f = T.createFamily(); f.tech.cars = 3; f.clean = 99999;
  assert.equal(T.tree(f).find((t) => t.kind === 'cars').next, null);
  assert.throws(() => T.research(f, 'cars'), /nothing more to learn about Cars/);
});

// --- a place that chokes says so ---
const strainsAt = (c, f, x, y) => (T.view(c, f).places.find((p) => p.x === x && p.y === y).strains || []).map((s) => s.kind);

test('a place whose till holds two loads or more shows cash piling up', () => {
  const { c, f } = sixBars();
  assert.deepEqual(strainsAt(c, f, 1, 1), [], 'nothing yet');
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const full = T.view(c, f).places.filter((p) => (p.till || 0) >= 2 * LOAD);
  assert.ok(full.length > 0);
  for (const p of full) {
    assert.deepEqual(p.strains.map((s) => s.kind), ['cash']);
    assert.equal(p.strains[0].label, 'Cash piling up: $' + Math.round(p.till) + ' waits for a car');
  }
  const light = T.view(c, f).places.find((p) => p.kind === 'gambling' && (p.till || 0) < 2 * LOAD);
  if (light) assert.equal(light.strains, undefined);
});

test('bars with too few stills show they run dry, and a still nobody drinks from shows its surplus', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  assert.deepEqual(strainsAt(c, f, 8, 2), ['surplus'], 'a still and no bar');
  assert.match(T.view(c, f).places.find((p) => p.kind === 'still').strains[0].label, /More liquor than the bars can pour/);
  T.open(c, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 2, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.deepEqual([strainsAt(c, f, 8, 2), strainsAt(c, f, 1, 1)], [[], []], 'one still pours for two bars: nothing chokes');
  for (const [x, y] of [[3, 1], [1, 3], [2, 3]]) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.deepEqual(strainsAt(c, f, 1, 1), ['dry']);
  assert.equal(T.view(c, f).places.find((p) => p.x === 1 && p.y === 1).strains[0].label, 'Running dry: liquor for ' + Math.round(100 * T.liquor(c).wet) + '% of what it could sell');
  T.open(c, 9, 4, { owner: 'Callahan', kind: 'speakeasy' });
  assert.deepEqual(strainsAt(c, f, 9, 4), [], 'the rivals\' places say nothing');
});

test('a laundry that washed all it could while dirty money still waits shows it is swamped', () => {
  const c = town(), f = family({ dirty: 50000, clean: 0 });
  T.settle(c, 'mae', 2, 2); T.join(f, 'mae');
  T.open(c, 3, 2, { owner: 'family', kind: 'rented', capo: 'mae' });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  assert.deepEqual(strainsAt(c, f, 3, 2), [], 'no month has gone by');
  T.stepMonth(c, f);
  assert.deepEqual(strainsAt(c, f, 3, 2), ['swamped']);
  assert.match(T.view(c, f).places.find((p) => p.kind === 'rented').strains[0].label, /^Washing all it can: \$[\d,]+ of dirty money still waits$/);
  f.dirty = 0;
  T.stepMonth(c, f);
  assert.deepEqual(strainsAt(c, f, 3, 2), []);
});

// --- liquor is carried too: made in the still, kept in its cellar, driven to the bars one truckload at a time ---
const CRATES = T.RULES.truck.load;
const brewer = (bars, more) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  kept(c, 'dutch');
  T.open(c, 8, 2, Object.assign({ owner: 'family', kind: 'still', capo: 'dutch' }, more));
  [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]].slice(0, bars).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};
const placeAt = (c, f, x, y) => T.view(c, f).places.find((p) => p.x === x && p.y === y);
const hauls = (c, f) => T.trips(c, f).filter((t) => t.kind === 'liquor');

test('a still makes its truckloads each month and the capo\'s truck drives them to the bars, one full load a run', () => {
  const { c, f } = brewer(2);
  assert.deepEqual(hauls(c, f), [], 'no month has gone by: no truck has left');
  T.stepMonth(c, f);
  const runs = hauls(c, f);
  assert.equal(runs.length, T.RULES.pours, 'a small still makes two loads a month');
  assert.ok(runs.every((t) => t.amount === CRATES && t.cargo === 'liquor' && t.capo === 'dutch' && t.from.x === 8 && t.from.y === 2));
  assert.deepEqual(runs.map((t) => t.to.x + ',' + t.to.y).sort(), ['1,1', '2,1'], 'one load for each bar');
  assert.equal(placeAt(c, f, 8, 2).stock, undefined, 'the cellar is empty again');
  assert.equal(T.view(c, f).capos[0].trucks, 1);
});

test('a bar earns in full only the month it has a load to pour', () => {
  const { c, f } = brewer(5);
  const one = T.income(c, 'dutch');
  T.stepMonth(c, f);
  const served = hauls(c, f).map((t) => t.to.x + ',' + t.to.y);
  assert.equal(served.length, 2);
  const bars = T.view(c, f).places.filter((p) => p.kind === 'speakeasy');
  for (const b of bars) {
    const wet = served.includes(b.x + ',' + b.y);
    assert.deepEqual((b.strains || []).map((s) => s.kind).filter((k) => k === 'dry'), wet ? [] : ['dry'], b.x + ',' + b.y);
  }
  assert.match(bars.find((b) => !served.includes(b.x + ',' + b.y)).strains.find((s) => s.kind === 'dry').label, /^Nothing to pour: no truck came this month$/);
  assert.ok(one > 0);
});

test('a bar keeps at most two loads on its shelf, and what the trucks cannot place stays in the cellar', () => {
  const { c, f } = brewer(1);
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, 2, 'the first month both loads go to the one bar');
  assert.equal(placeAt(c, f, 1, 1).stock, CRATES, 'it poured one and keeps one');
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, 1, 'the shelf has room for one more only');
  assert.equal(placeAt(c, f, 8, 2).stock, CRATES, 'the other load waits in the cellar');
});

test('a still nobody drinks from fills its cellar, stops there, and says so', () => {
  const { c, f } = brewer(0);
  for (let m = 0; m < 6; m++) T.stepMonth(c, f);
  const still = placeAt(c, f, 8, 2);
  assert.equal(still.stock, T.RULES.truck.cellar * T.RULES.pours * CRATES, 'two months of its own making');
  assert.deepEqual(still.strains.map((s) => s.kind), ['surplus']);
  assert.equal(still.strains[0].label, 'Cellar full: ' + still.stock + ' crates wait for a truck');
});

test('a truck makes so many runs a month: a second truck carries twice as much', () => {
  const big = (trucks) => {
    const { c, f } = brewer(6, { level: 3 });
    T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 }); // two big stills: eight loads a month
    f.men.dutch.trucks = trucks; f.men.dutch.cash = 0;
    T.stepMonth(c, f); T.stepMonth(c, f);
    return hauls(c, f).length;
  };
  assert.equal(big(1), T.RULES.truck.runs);
  assert.ok(big(2) > big(1));
});

test('when loads wait in his cellar while bars go dry, the capo buys another truck', () => {
  const { c, f } = brewer(6, { level: 3 });
  T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 });
  f.men.dutch.cash = 5000;
  let bought = null;
  for (let m = 0; m < 4 && !bought; m++) bought = T.stepMonth(c, f).find((e) => e.type === 'truck');
  assert.ok(bought);
  assert.deepEqual([bought.capo, bought.trucks, bought.cost], ['dutch', 2, T.RULES.truck.cost]);
  assert.match(bought.label, /Dutch buys a second truck/);
  const calm = brewer(2); calm.f.men.dutch.cash = 5000;
  assert.ok(!year(calm.c, calm.f, 6).some((e) => e.type === 'truck'), 'one truck is plenty for two bars');
});

test('the brewery is a still like no other: its capo\'s trucks drive its loads to every bar of the family', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch'); kept(c, 'dutch');
  T.settle(c, 'sal', 9, 4); T.join(f, 'sal'); kept(c, 'sal');
  T.open(c, 8, 3, { owner: 'family', kind: 'key', key: 'brewery', capo: 'dutch' });
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 10, 4, { owner: 'family', kind: 'speakeasy', capo: 'sal' });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  T.stepMonth(c, f);
  const runs = hauls(c, f);
  assert.ok(runs.every((t) => t.capo === 'dutch' && t.from.x === 8 && t.from.y === 3));
  assert.ok(runs.some((t) => t.to.x === 10 && t.to.y === 4), 'Sal\'s bar pours Dutch\'s beer');
});

// --- every vehicle is somebody's: it lives at his club, goes out, loads, and comes back ---
test('each run is made by one of the capo\'s own cars, numbered, out of his club and back', () => {
  const { c, f } = sixBars();
  f.men.dutch.cars = 2; f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.length, 2 * RUNS);
  assert.ok(runs.every((t) => t.home.x === 2 && t.home.y === 2), 'the car lives at his club');
  assert.deepEqual([...new Set(runs.map((t) => t.vehicle))].sort(), ['dutch:car:1', 'dutch:car:2']);
  for (const v of ['dutch:car:1', 'dutch:car:2']) {
    assert.deepEqual(runs.filter((t) => t.vehicle === v).map((t) => t.leg), [...Array(RUNS).keys()], v + ' makes its runs one after the other');
  }
});

test('the runs a capo drives himself are made in his own car, the one that takes him wherever he goes', () => {
  const { c, f } = sixBars(true);
  T.stepMonth(c, f); T.stepMonth(c, f);
  const own = T.trips(c, f).filter((t) => t.kind === 'takings' && t.own);
  assert.ok(own.length > 0 && own.every((t) => t.vehicle === 'dutch:own'));
  assert.deepEqual(own.map((t) => t.leg), [...Array(own.length).keys()]);
  const him = T.trips(c, f).find((t) => t.kind === 'capo');
  assert.deepEqual([him.vehicle, him.home], ['dutch:own', { x: 2, y: 2 }]);
});

test('each truckload is driven by one of the capo\'s trucks, out of his club and back', () => {
  const { c, f } = brewer(2);
  T.stepMonth(c, f);
  const runs = hauls(c, f);
  assert.ok(runs.every((t) => t.vehicle === 'dutch:truck:1' && t.home.x === 2 && t.home.y === 2));
  assert.deepEqual(runs.map((t) => t.leg), [0, 1]);
});

// --- other goods are carried the same way: hijacked goods and stolen cars go by truck to the fences ---
const dealer = (makers, fences) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  kept(c, 'dutch');
  makers.forEach((kind, i) => T.open(c, 8 + i, 2, { owner: 'family', kind, capo: 'dutch' }));
  [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]].slice(0, fences).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'fence', capo: 'dutch' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};
const goods = (c, f) => T.trips(c, f).filter((t) => t.kind === 'goods');

test('a warehouse fills with hijacked goods and the capo\'s truck drives them to his fences, one full load a run', () => {
  const { c, f } = dealer(['warehouse'], 2);
  assert.deepEqual(goods(c, f), [], 'no month has gone by: no truck has left');
  T.stepMonth(c, f);
  const runs = goods(c, f);
  assert.equal(runs.length, T.RULES.goods.makes.warehouse);
  assert.ok(runs.every((t) => t.cargo === 'goods' && t.amount === T.RULES.goods.load.goods && t.capo === 'dutch' && t.from.x === 8 && t.from.y === 2));
  assert.deepEqual(runs.map((t) => t.to.x + ',' + t.to.y).sort(), ['1,1', '2,1'], 'one load for each fence');
  assert.ok(runs.every((t) => t.vehicle === 'dutch:truck:1' && t.home.x === 2 && t.home.y === 2));
  assert.equal(T.view(c, f).capos[0].trucks, 1, 'his first truck comes with the warehouse');
});

test('a chop shop sends its stolen cars to the fences too', () => {
  const { c, f } = dealer(['chopshop'], 2);
  T.stepMonth(c, f);
  const runs = goods(c, f);
  assert.equal(runs.length, T.RULES.goods.makes.chopshop);
  assert.ok(runs.every((t) => t.cargo === 'cars' && t.amount === T.RULES.goods.load.cars));
});

test('a fence with nothing to sell earns a share of what it could, and says why', () => {
  const none = dealer([], 1), fed = dealer(['warehouse'], 1);
  T.stepMonth(none.c, none.f); T.stepMonth(fed.c, fed.f);
  const only = (d) => T.earns(d.c, placeAt(d.c, d.f, 1, 1));
  assert.ok(Math.abs(only(none) - T.RULES.goods.short * only(fed)) < 1e-6);
  assert.equal(placeAt(none.c, none.f, 1, 1).strains.find((s) => s.kind === 'dry').label, 'Nothing to sell: the family has no warehouse and no chop shop');
  assert.ok(!(placeAt(fed.c, fed.f, 1, 1).strains || []).some((s) => s.kind === 'dry'));
  const thin = dealer(['chopshop'], 3);
  T.stepMonth(thin.c, thin.f);
  const starved = T.view(thin.c, thin.f).places.filter((p) => p.kind === 'fence' && p.strains);
  assert.equal(starved.length, 2);
  assert.equal(starved[0].strains[0].label, 'Nothing to sell: no truck came this month');
});

test('goods nobody sells fill the store, stop there, and say so', () => {
  const { c, f } = dealer(['warehouse', 'chopshop'], 0);
  for (let m = 0; m < 6; m++) T.stepMonth(c, f);
  const store = placeAt(c, f, 8, 2), yard = placeAt(c, f, 9, 2);
  assert.equal(store.stock, T.RULES.truck.cellar * T.RULES.goods.makes.warehouse * T.RULES.goods.load.goods);
  assert.equal(store.strains[0].label, 'Store full: ' + store.stock + ' crates wait for a truck');
  assert.equal(yard.stock, T.RULES.truck.cellar * T.RULES.goods.makes.chopshop * T.RULES.goods.load.cars);
  assert.equal(yard.strains[0].label, 'Yard full: ' + yard.stock + ' cars wait for a truck');
  assert.deepEqual([store.holds, yard.holds], ['goods', 'cars']);
});

test('a capo\'s trucks carry his liquor first: goods go with the runs that are left', () => {
  const { c, f } = dealer(['warehouse'], 2);
  T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 }); // four loads a month
  [[4, 1], [5, 1], [4, 3], [5, 3]].forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' }));
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, T.RULES.truck.runs, 'every run of his one truck went to the bars');
  assert.deepEqual(goods(c, f), []);
  f.men.dutch.trucks = 2;
  T.stepMonth(c, f);
  assert.ok(goods(c, f).length > 0, 'a second truck has runs to spare');
  const legs = T.trips(c, f).filter((t) => t.vehicle === 'dutch:truck:1').map((t) => t.leg);
  assert.deepEqual(legs, [...Array(legs.length).keys()], 'one truck, one run after the other, whatever it carries');
});

test('no capo opens one more fence with nothing to sell in it: starved fences call for a chop shop or a warehouse', () => {
  const only = () => { const t = ALL(); for (const k of Object.keys(t)) t[k] = k === 'fence' || k === 'chopshop' || k === 'warehouse' ? 3 : 0; return t; };
  const next = (fences, makers) => {
    const c = town(); T.settle(c, 'dutch', 8, 2);
    [[7, 1], [8, 1], [9, 1]].slice(0, fences).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'fence', capo: 'dutch' }));
    [[7, 3], [8, 3]].slice(0, makers).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'chopshop', capo: 'dutch' }));
    return T.wants(c, 'dutch', { rank: 3, tech: only() }).kind;
  };
  assert.notEqual(next(2, 0), 'fence', 'two fences and nothing to sell');
  assert.equal(next(0, 2), 'fence', 'two chop shops and nobody to sell the cars');
});

// --- weed is a bonus: the loft sells on the spot, and what it grows besides goes by truck to the bars and the brothels ---
const grower = (sellers) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  kept(c, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'loft', capo: 'dutch' });
  sellers.forEach((kind, i) => T.open(c, 1 + i, 1, { owner: 'family', kind, capo: 'dutch' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};
const weed = (c, f) => T.trips(c, f).filter((t) => t.cargo === 'weed');

test('a loft sends a load of weed a month to a bar or a brothel of the family, by truck', () => {
  const { c, f } = grower(['brothel', 'speakeasy']);
  T.stepMonth(c, f);
  const runs = weed(c, f);
  assert.equal(runs.length, T.RULES.weed.makes);
  assert.deepEqual([runs[0].kind, runs[0].amount, runs[0].vehicle, runs[0].from], ['goods', T.RULES.weed.load, 'dutch:truck:1', { x: 8, y: 2 }]);
  assert.ok(['brothel', 'speakeasy'].includes(T.at(c, runs[0].to.x, runs[0].to.y).kind));
});

test('the place that has weed to sell earns more that month; the one that has none loses nothing', () => {
  const { c, f } = grower(['brothel', 'brothel']);
  const before = T.view(c, f).places.filter((p) => p.kind === 'brothel').map((p) => T.earns(c, p));
  T.stepMonth(c, f);
  const places = T.view(c, f).places.filter((p) => p.kind === 'brothel');
  const served = weed(c, f).map((t) => t.to.x + ',' + t.to.y);
  assert.equal(served.length, 1);
  places.forEach((p, i) => {
    const ratio = T.earns(c, p) / before[i];
    assert.ok(Math.abs(ratio - (served.includes(p.x + ',' + p.y) ? 1 + T.RULES.weed.bonus : 1)) < 1e-6, p.x + ',' + p.y + ' ' + ratio);
    assert.ok(!(p.strains || []).some((s) => s.kind === 'dry'), 'weed is a bonus: nobody is short of it');
  });
});

test('a bar keeps its liquor and its weed apart', () => {
  const { c, f } = grower(['speakeasy']);
  T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, 2);
  assert.equal(weed(c, f).length, 1);
  assert.equal(placeAt(c, f, 1, 1).stock, CRATES, 'one load of liquor poured, one on the shelf');
});

test('weed nobody sells stays in the loft and says so only when the family has somewhere to sell it', () => {
  const alone = grower([]);
  for (let m = 0; m < 6; m++) T.stepMonth(alone.c, alone.f);
  assert.equal(placeAt(alone.c, alone.f, 8, 2).strains, undefined);
  const { c, f } = grower(['brothel']);
  T.stepMonth(c, f);
  T.at(c, 8, 2).stock = T.RULES.truck.cellar * T.RULES.weed.makes; // as much as the loft keeps
  const loft = placeAt(c, f, 8, 2);
  assert.equal(loft.stock, T.RULES.truck.cellar * T.RULES.weed.makes * T.RULES.weed.load);
  assert.equal(loft.holds, 'weed');
  assert.equal(loft.strains.find((s) => s.kind === 'surplus').label, 'Stash full: ' + loft.stock + ' bags wait for a truck');
});

// --- what goes up to the boss: a share of everything the cars bring in, before the capo pays his men ---
test('a capo kicks up a share of his takings, even the month his men cost him all the rest', () => {
  const { c, f } = sixBars();
  f.men.dutch.cash = 500;
  T.stepMonth(c, f);
  const m = f.men.dutch, sent = c.flow.sent.dutch;
  assert.ok(m.income > 0);
  assert.ok(Math.abs(sent - T.RULES.tribute * m.income) < 1e-6, 'sent ' + sent + ' of ' + m.income);
});

test('a capo with an empty club sends up what he has and no more: he never owes the boss', () => {
  const { c, f } = sixBars();
  f.men.dutch.cash = -2000; // deep in the red
  T.stepMonth(c, f);
  assert.equal(c.flow.sent.dutch, 0);
});

test('no capo opens one more still when the family already makes more liquor than its bars pour', () => {
  const only = () => { const t = ALL(); for (const k of Object.keys(t)) t[k] = k === 'still' || k === 'rented' ? 3 : 0; return t; };
  const next = (stills) => {
    const c = town(); T.settle(c, 'sal', 8, 2);
    [[7, 1], [8, 1], [9, 1]].slice(0, stills).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'still', capo: 'sal' }));
    return T.wants(c, 'sal', { rank: 3, tech: only() }).kind;
  };
  assert.equal(next(0), 'still');
  assert.equal(next(2), 'rented', 'two stills and not one bar: he puts his money elsewhere');
});

// --- the road is not safe: the rivals hold up what leaves a street they press on, the police stop trucks when the city is hot ---
const exposed = (capo, kind, more) => {
  const c = town(), f = family();
  T.settle(c, capo, 3, 3); T.join(f, capo);
  kept(c, capo);
  T.open(c, 5, 3, Object.assign({ owner: 'family', kind: kind || 'gambling', capo }, more));
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};
const until = (c, f, type, months) => { for (let m = 0; m < months; m++) { const e = T.stepMonth(c, f).find((x) => x.type === type); if (e) return e; } return null; };

test('now and then the rivals hold up a car that leaves a street they press on: the load never reaches the club', () => {
  const { c, f } = exposed('mae');
  const e = until(c, f, 'hijack', T.RULES.road.every);
  assert.ok(e, 'within ' + T.RULES.road.every + ' months');
  assert.deepEqual([e.capo, e.x, e.y, e.cargo, e.amount, e.by], ['mae', 5, 3, 'cash', LOAD, 'Callahan']);
  assert.equal(e.label, 'The Callahans hold up Mae\'s car in Lantern Row: $' + LOAD + ' gone');
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.filter((t) => t.lost === 'hijack').length, 1);
  assert.equal(f.men.mae.income, T.RULES.club + LOAD * (runs.length - 1), 'every load but that one came in');
  assert.equal(c.flow.hijacked, LOAD);
});

test('they leave a hard man\'s cars alone, and the streets the family holds firmly', () => {
  const hard = exposed('sal');
  assert.equal(until(hard.c, hard.f, 'hijack', 3 * T.RULES.road.every), null);
  const deep = sixBars();
  T.open(deep.c, 11, 5, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(until(deep.c, deep.f, 'hijack', 3 * T.RULES.road.every), null);
});

test('a truck is held up like a car: its load is lost and the bar goes without', () => {
  const { c, f } = exposed('mae', 'still');
  T.open(c, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'mae' });
  T.open(c, 2, 1, { owner: 'family', kind: 'speakeasy', capo: 'mae' });
  const e = until(c, f, 'hijack', T.RULES.road.every);
  assert.deepEqual([e.cargo, e.amount, e.x, e.y], ['liquor', CRATES, 5, 3]);
  assert.equal(e.label, 'The Callahans hold up Mae\'s truck in Lantern Row: ' + CRATES + ' crates of liquor gone');
  const runs = hauls(c, f);
  assert.equal(runs.filter((t) => t.lost === 'hijack').length, 1);
  const dry = T.view(c, f).places.filter((p) => p.kind === 'speakeasy' && (p.strains || []).some((s) => s.kind === 'dry'));
  assert.equal(dry.length, 1, 'the bar that waited for it has nothing to pour');
});

test('when the city is hot the police stop a truck every month and seize its load; cars with cash pass', () => {
  const play = (heat, bought) => {
    const { c, f } = brewer(2);
    c.heat = heat;
    if (bought) T.open(c, 11, 5, { owner: 'family', kind: 'key', key: 'precinct', capo: 'dutch' });
    const e = T.stepMonth(c, f).find((x) => x.type === 'seizure');
    return { e, lost: hauls(c, f).filter((t) => t.lost === 'seizure').length, cash: T.trips(c, f).filter((t) => t.kind === 'takings' && t.lost).length };
  };
  const hot = play(T.RULES.road.heat + 10);
  assert.deepEqual([hot.e.capo, hot.e.cargo, hot.e.amount, hot.lost, hot.cash], ['dutch', 'liquor', CRATES, 1, 0]);
  assert.equal(hot.e.label, 'The police stop Dutch\'s truck: ' + CRATES + ' crates of liquor seized');
  assert.equal(play(T.RULES.road.heat - 10).e, undefined, 'a quiet city: nobody looks into a truck');
  assert.equal(play(T.RULES.road.heat + 10, true).e, undefined, 'with the precinct in its pocket the family drives through');
});
