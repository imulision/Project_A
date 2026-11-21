// Blocks and streets: opening, pressing, the month of a capo, the rivals, the key places, and how fast a month runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, ALL = H.ALL, year = H.year, family = H.family, ashport = H.ashport, rivals = H.rivals, siege = H.siege, kinds = H.kinds, kept = H.kept;

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
    T.at(c, w.x, w.y).turned = c.month; // (a place just opened is not turned into something else)
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
  // What is measured is the work of the rules, not the wait for a processor: the test files run side by side, so the
  // clock on the wall says more about the neighbours than about this code. Processor time of this process, best of three.
  let best = Infinity;
  for (let run = 0; run < 3; run++) {
    const c = ashport(), f = family();
    T.crown(c, 'Callahan'); T.seed(c, 'Callahan', 30);
    for (const k of ['sal', 'mae', 'tommy', 'dutch']) { const l = T.landing(c); T.settle(c, k, l.x, l.y); T.join(f, k); }
    const start = process.cpuUsage();
    year(c, f, 240);
    const used = process.cpuUsage(start);
    best = Math.min(best, (used.user + used.system) / 1000);
    assert.ok(T.places(c).length > 60, 'a full city');
  }
  assert.ok(best < 600, '240 months took ' + Math.round(best) + ' ms of processor time');
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

// --- a capo is never wiped out: his doorstep is his, and he does not borrow to pay his men ---

test('the rivals who have burnt a capo\'s place leave him alone for a while: nobody is ground down raid after raid', () => {
  const c = town(), f = family({ tech: {} });
  T.settle(c, 'mae', 2, 3); T.join(f, 'mae');
  kept(c, 'mae');
  // five laundries out east, each with the Callahans pressing hard on it
  for (const y of [0, 1, 2, 3, 4]) {
    T.open(c, 9, y, { owner: 'family', kind: 'rented', capo: 'mae' });
    T.open(c, 10, y, { owner: 'Callahan', kind: 'speakeasy', level: 3 }); T.open(c, 8, y, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  }
  const months = [];
  for (let m = 1; m <= 60; m++) if (T.stepMonth(c, f).some((e) => e.type === 'burnt')) months.push(m);
  assert.ok(months.length >= 2, 'they do come back: ' + months);
  const fury = 1 + 6 / T.RULES.anger, rest = Math.round(T.RULES.sated / fury);
  for (let i = 1; i < months.length; i++) assert.ok(months[i] - months[i - 1] >= rest - T.RULES.rivalEvery, 'months ' + months);
  assert.ok(months.length <= 3, 'and not every six months: ' + months);
});

test('a capo pays his men out of what his places bring in: a bad month never puts him in debt, and the club\'s own money stays his', () => {
  const c = town(), f = family({ tech: {} });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch').cash = 0;
  kept(c, 'dutch');
  // three bars and nothing to pour: they bring in less than their men cost
  for (const [x, y] of [[1, 1], [2, 1], [3, 1]]) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  let low = Infinity;
  for (let i = 0; i < 24; i++) { T.stepMonth(c, f); low = Math.min(low, f.men.dutch.cash); }
  assert.ok(low >= 0, 'never below nothing: ' + Math.round(low));
  assert.ok(f.men.dutch.cash >= 12 * T.RULES.club * (1 - T.RULES.tribute), 'he puts the club\'s money aside: ' + Math.round(f.men.dutch.cash));
});
