// The rival chiefs have a face: a temper that decides how they fight, grudges against the capos who hurt them,
// words for the boss (an ultimatum, a price on a man's head) and a fall, after which a lieutenant takes their place
// or their family is gone from the city.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const A = require('../web/audience.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const K = T.RULES.chief;
const chief = (c, f) => T.view(c, f || family()).chief;
// The city of Ashport's chief: Sal with places in the east, a Callahan bar next door, bigger Callahan places in the west.
const neighbours = () => {
  const c = T.createCity({ id: 'ashport', w: 12, h: 6, zones: town().zones }), f = family({ dirty: 50000, clean: 0 });
  c.rival = 'Callahan';
  T.settle(c, 'sal', 8, 3); T.join(f, 'sal');
  T.open(c, 9, 3, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.open(c, 8, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.open(c, 10, 2, { owner: 'Callahan', kind: 'speakeasy' });
  for (const [x, y] of [[1, 1], [2, 4], [4, 2]]) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  return { c, f };
};
// A city led by a chief of the given temper (Seamus Callahan's face, another man's nature).
const led = (c, temper) => { c.rival = c.rival || 'Callahan'; c.chief = { id: 'seamus', temper }; return c; };
const months = (c, f, n) => { const out = []; for (let i = 0; i < n; i++) out.push(...T.stepMonth(c, f)); return out; };
const raids = (ev) => ev.filter((e) => e.type === 'burnt' || e.type === 'repelled');
const withRule = (path, value, fn) => { const o = path[0], k = path[1], was = o[k]; o[k] = value; try { return fn(); } finally { o[k] = was; } };

// --- the temper ---
test('every chief of the six cities has one of four tempers, and they are not all alike', () => {
  const g = E.createGame({ capo: 'dutch' }), seen = new Set();
  for (const c of E.view(g).cities) {
    const t = c.chief.temper;
    assert.ok(K.tempers[t.id], c.id + ': ' + t.id);
    assert.ok(t.name && t.does && t.answer, 'his temper says what he does and what to do against him');
    seen.add(t.id);
  }
  assert.equal(seen.size, 4, 'all four tempers are met on the map');
});

test('a hothead raids more often than a schemer, and a raid thrown back makes him rest', () => {
  const count = (temper) => { const { c, f } = H.siege(); led(c, temper); return raids(months(c, f, 36)); };
  const hot = count('hothead'), sly = count('schemer'), t = K.tempers.hothead;
  assert.ok(hot.length > sly.length, hot.length + ' raids against ' + sly.length);
  const after = hot.slice(1).filter((e, i) => hot[i].type === 'repelled').map((e, i, all) => e.month - hot[hot.indexOf(e) - 1].month);
  assert.ok(after.length > 0, 'Sal throws some back');
  assert.ok(after.every((d) => d > t.every), 'after a raid thrown back he waits more than ' + t.every + ' months');
});

test('a businessman opens places faster than the old guard', () => {
  const grown = (temper) => { const { c, f } = neighbours(); led(c, temper); const n = H.rivals(c).length; months(c, f, 30); return H.rivals(c).length - n; };
  assert.ok(grown('businessman') > grown('oldguard'));
});

test('the old guard\'s places cost more to take', () => {
  const { c, f } = neighbours();
  // Sal is hemmed in: no free block near him, so he goes for the Callahan bar next door
  for (let y = 0; y < 6; y++) for (let x = 6; x < 12; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'family', kind: 'loans', capo: 'mae' });
  const hemmed = (temper) => { led(c, temper); const p = T.plan(c, f, 'sal'); return p && p.move === 'take' ? p.cost : null; };
  const plain = hemmed('businessman'), walls = hemmed('oldguard');
  assert.ok(plain > 0, 'he would take a place');
  assert.ok(Math.abs(walls - plain * K.tempers.oldguard.walls) <= 1, walls + ' against ' + plain);
});

test('a schemer feeds the police against the family and turns its least loyal capo', () => {
  const run = (temper) => {
    const { c, f } = neighbours(); led(c, temper);
    T.settle(c, 'mae', 7, 5); T.join(f, 'mae'); T.sway(f, 'mae', 40 - T.loyalty(f, 'mae')); // a restless woman
    const was = T.loyalty(f, 'mae');
    months(c, f, 12);
    return { heat: c.heat || 0, mae: T.loyalty(f, 'mae') - was };
  };
  const sly = run('schemer'), plain = run('businessman');
  assert.ok(sly.heat > plain.heat, 'heat ' + sly.heat + ' against ' + plain.heat);
  assert.ok(sly.mae < plain.mae, 'Mae ' + sly.mae + ' against ' + plain.mae);
});

test('the boss reads his temper, his grudges and his next raid on the city', () => {
  const { c, f } = neighbours(); led(c, 'hothead');
  const k = chief(c, f);
  assert.equal(k.temper.id, 'hothead');
  assert.equal(k.temper.name, K.tempers.hothead.name);
  assert.deepEqual(k.hates, []);
  assert.equal(k.contract, null); assert.equal(k.word, null);
  assert.ok(Number.isInteger(k.next) && k.next > 0 && k.next <= K.tempers.hothead.every, 'months to his next raid');
});

// --- grudges ---
test('he hates the capo who takes his places: a shot more than an envelope, and it fades with time', () => {
  for (const [way, n] of [['force', K.spite.force], ['bribe', K.spite.bribe]]) {
    const { c, f } = neighbours();
    c.ops.push({ capo: 'sal', x: 10, y: 2, way, kind: 'speakeasy', cost: 0, month: c.month, months: 1 });
    months(c, f, 2);
    const h = chief(c, f).hates.find((x) => x.capo === 'sal');
    assert.ok(h, way + ': he hates Sal');
    assert.equal(h.level, n);
    assert.equal(h.warn, K.warn); assert.equal(h.contract, K.contract);
  }
  const { c, f } = neighbours();
  c.quiet = 999; // (no raid meanwhile: a raid thrown back is held against Sal too)
  T.spite(c, 'sal', 2);
  months(c, f, K.forgets * 2 + 1);
  assert.deepEqual(chief(c, f).hates, [], 'forgotten');
});

test('his men go for the places of the capo he hates most', () => {
  const first = (hated) => { const s = neighboursWithMae(); if (hated) T.spite(s.c, hated, 3); return raids(months(s.c, s.f, 12))[0]; };
  assert.equal(first('sal').capo, 'sal');
  assert.equal(first('mae').capo, 'mae');
});
function neighboursWithMae() {
  const s = neighbours();
  T.settle(s.c, 'mae', 3, 0); T.join(s.f, 'mae');
  T.open(s.c, 2, 0, { owner: 'family', kind: 'front', capo: 'mae' });
  return s;
}

// --- his words ---
test('hated enough, he sends an ultimatum: give back what that capo took, or answer for it', () => {
  const { c, f } = neighbours();
  T.spite(c, 'sal', K.warn, { x: 9, y: 3 });
  const ev = months(c, f, 1), e = ev.find((x) => x.type === 'ultimatum');
  assert.ok(e, 'he says it');
  assert.equal(e.capo, 'sal'); assert.equal(e.chief, 'seamus');
  assert.deepEqual([e.x, e.y], [9, 3]);
  assert.match(e.label, /Seamus Callahan/);
  const w = chief(c, f).word;
  assert.equal(w.kind, 'ultimatum'); assert.equal(w.capo, 'sal'); assert.ok(w.months > 0);
  const r = T.reply(c, f, true);
  assert.equal(T.at(c, 9, 3).owner, 'Callahan', 'the place is his again');
  assert.equal(chief(c, f).word, null);
  assert.deepEqual(chief(c, f).hates, [], 'and he lets Sal be');
  assert.match(r.label, /Sal/);
});

test('an ultimatum refused, or left unanswered, puts a price on the capo\'s head', () => {
  for (const answer of [false, null]) {
    const { c, f } = neighbours();
    T.spite(c, 'sal', K.warn, { x: 9, y: 3 });
    months(c, f, 1);
    let ev = [];
    if (answer === false) { T.reply(c, f, false); ev = months(c, f, 1); } else ev = months(c, f, K.wait + 1);
    const e = ev.find((x) => x.type === 'contract');
    assert.ok(e, String(answer) + ': a contract');
    assert.equal(e.capo, 'sal');
    const k = chief(c, f).contract;
    assert.equal(k.capo, 'sal'); assert.ok(k.months > 0 && k.months <= K.months);
    assert.ok(k.odds > 0 && k.odds < 100, 'the odds Sal lives are written');
    assert.equal(chief(c, f).word.kind, 'price', 'and he names what it would take to call it off');
    assert.equal(chief(c, f).word.price, k.price);
  }
});

test('the boss can buy the contract off', () => {
  const { c, f } = neighbours();
  T.spite(c, 'sal', K.contract);
  months(c, f, 1);
  const price = chief(c, f).contract.price, was = f.dirty;
  T.reply(c, f, true);
  assert.equal(f.dirty, was - price);
  assert.equal(chief(c, f).contract, null);
  assert.ok(!months(c, f, K.months + 1).some((e) => e.type === 'murdered' || e.type === 'survived'));
});

test('when the contract falls due, the capo lives or dies on the odds; a man who lives is left alone a while', () => {
  const shoot = (base) => withRule([K.survive, 'base'], base, () => {
    const { c, f } = neighbours();
    T.settle(c, 'mae', 7, 5); T.join(f, 'mae');
    T.spite(c, 'sal', K.contract);
    const ev = months(c, f, K.months + 2);
    return { c, f, ev };
  });
  const lucky = shoot(1000);
  assert.ok(lucky.ev.some((e) => e.type === 'survived' && e.capo === 'sal'));
  assert.ok(lucky.f.men.sal);
  assert.equal(chief(lucky.c, lucky.f).contract, null);
  const dead = shoot(-1000), e = dead.ev.find((x) => x.type === 'murdered');
  assert.ok(e, 'Sal is shot dead');
  assert.equal(e.capo, 'sal'); assert.match(e.label, /Sal/);
  assert.ok(!dead.f.men.sal, 'he is gone from the family');
  assert.equal(T.clubOf(dead.c, 'sal'), null);
  assert.ok(T.places(dead.c, 'mae').some((p) => p.kind === 'loans'), 'Mae takes over some of what he ran');
});

test('the last capo of the family in a city is wounded, never killed', () => {
  withRule([K.survive, 'base'], -1000, () => {
    const { c, f } = neighbours();
    T.spite(c, 'sal', K.contract);
    const ev = months(c, f, K.months + 2);
    assert.ok(ev.some((e) => e.type === 'wounded' && e.capo === 'sal'));
    assert.ok(f.men.sal && T.clubOf(c, 'sal'));
  });
});

test('his words reach the boss at once, as a matter he answers', () => {
  const g = E.createGame({ capo: 'sal' }), c = g.cities[0];
  g.audience = { last: 0, seen: { 'line:ashport': 0 }, open: null };
  const spot = T.places(c, 'sal')[0];
  T.open(c, spot.x + 1, spot.y, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.spite(c, 'sal', K.warn, { x: spot.x + 1, y: spot.y });
  c.chief.word = null;
  T.stepMonth(c, g.family);
  const told = A.raise(g, 5, false);
  assert.ok(told, 'brought at once');
  const m = A.matters(g)[0];
  assert.equal(m.kind, 'ultimatum'); assert.equal(m.chief, T.view(c, g.family).chief.id); assert.equal(m.capo, 'sal');
  assert.deepEqual(m.choices.map((q) => q.id), ['yes', 'no']);
  m.choices.forEach((q) => assert.ok(q.gives || q.costs, q.id + ' says what it does'));
  A.decide(g, m.id, 'yes', 5, () => {});
  assert.equal(T.view(c, g.family).chief.word, null);
});

test('a hothead never sells peace; a businessman sells it cheaper and for longer', () => {
  const offer = (temper) => {
    const g = E.createGame({ capo: 'sal', seed: 3 }), c = g.cities[0];
    T.chief(c, g.family); c.chief.temper = temper; g.family.dirty = 1e6; c.month = 30; c.quiet = 0;
    return A.offer(g, 'truce');
  };
  assert.equal(offer('hothead'), null);
  const plain = offer('oldguard'), cheap = offer('businessman');
  assert.ok(plain && cheap);
  assert.ok(cheap.choices[0].cost < plain.choices[0].cost);
  assert.match(cheap.title, /offers peace/);
  assert.match(cheap.title, /Seamus Callahan/);
  assert.ok(cheap.choices[0].gives.includes(String(Math.round(A.RULES.truce.cycles * K.tempers.businessman.peace.long * T.RULES.days))), 'for longer');
});

// --- the fall ---
test('beaten and down to a few streets, he falls and one of his lieutenants takes his place, with another temper', () => {
  const { c, f } = neighbours();
  const was = chief(c, f);
  c.chief.lost = K.beaten;
  for (const [x, y] of [[1, 1], [2, 4], [4, 2]]) delete c.blocks[x + ',' + y];
  T.touch(c);
  const ev = months(c, f, 1), e = ev.find((x) => x.type === 'fallen');
  assert.ok(e, 'he falls');
  assert.equal(e.chief, was.id); assert.match(e.label, /Seamus Callahan/);
  const now = chief(c, f);
  assert.ok(now && now.id !== was.id, 'a new chief');
  assert.equal(T.person(now.id).lieutenant, 'Callahan');
  assert.notEqual(now.temper.id, was.temper.id);
  assert.ok(ev.some((x) => x.type === 'succeeds' && x.chief === now.id));
  assert.ok(!months(c, f, 1).some((x) => x.type === 'fallen'), 'his heir is not beaten yet');
});

test('with no lieutenant left to take over, the old family is gone from the city', () => {
  const { c, f } = neighbours();
  for (const id of ['finn', 'nora', 'sean']) T.join(f, id);
  chief(c, f); c.chief.lost = K.beaten;
  for (const [x, y] of [[1, 1], [2, 4], [4, 2]]) delete c.blocks[x + ',' + y];
  T.touch(c);
  const ev = months(c, f, 1);
  assert.ok(ev.some((x) => x.type === 'dissolved'));
  assert.equal(chief(c, f), null);
  assert.equal(H.rivals(c).filter((p) => p.kind !== 'key').length, 0, 'their places close');
  assert.equal(raids(months(c, f, 36)).length, 0, 'nobody raids any more');
  assert.equal(H.rivals(c).filter((p) => p.kind !== 'key').length, 0, 'nor opens anything');
});

test('a chief whose lieutenants have all crossed to the family falls', () => {
  const { c, f } = neighbours();
  for (const id of ['finn', 'nora', 'sean']) T.join(f, id);
  const ev = months(c, f, 1);
  assert.ok(ev.some((x) => x.type === 'fallen'));
});

test('a game saved after an old family is gone loads without raising its headquarters again', () => {
  const g = E.createGame({ capo: 'sal', quiet: true }), c = g.cities[1], f = g.family;
  T.chief(c, f);
  c.chief = { id: c.chief.id, gone: true };
  T.razeHq(c, c.rival);
  const back = E.load(E.save(g)).cities[1];
  assert.equal(T.hqOf(back, 'rival'), null);
  assert.equal(T.chief(back, f), null);
});

test('a woman at the head of the family is told as one', () => {
  const { c, f } = neighbours();
  c.chief = { id: 'nora', temper: 'schemer' };
  for (const id of ['finn', 'sean']) T.join(f, id);
  const e = months(c, f, 1).find((x) => x.type === 'fallen');
  assert.ok(e);
  assert.match(e.label, /Nora Callahan is finished: her lieutenants/);
});

test('his words about a woman say she and her', () => {
  const g = E.createGame({ capo: 'mae' }), c = g.cities[0];
  g.audience = { last: 0, seen: { 'line:ashport': 0 }, open: null };
  const spot = T.places(c, 'mae')[0];
  T.open(c, spot.x + 1, spot.y, { owner: 'family', kind: 'front', capo: 'mae' });
  T.spite(c, 'mae', K.warn, { x: spot.x + 1, y: spot.y });
  T.stepMonth(c, g.family); A.raise(g, 5, false);
  const say = (m) => [m.title, m.says].concat(...m.choices.map((q) => [q.gives || '', q.costs || ''])).join(' ');
  assert.doesNotMatch(say(A.matters(g)[0]), /\b(he|his|him)\b/i, say(A.matters(g)[0]));
  A.decide(g, A.matters(g)[0].id, 'no', 5, () => {});
  T.stepMonth(c, g.family); A.raise(g, 40, false);
  assert.equal(A.matters(g)[0].kind, 'price');
  assert.doesNotMatch(say(A.matters(g)[0]), /\b(he|his|him)\b/i, say(A.matters(g)[0]));
});
