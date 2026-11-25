// What the boss is told before he decides: what his first man opens, what the four numbers of a man are, what a key
// place brings besides its money, how a seat is won, what a quarrel costs, what a line and a share do.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const C = require('../web/cards.js');
const { town, family, siege } = require('./turf-helpers.js');

const text = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const days = (g, n) => { for (let i = 0; i < n; i++) { g.paused = false; E.tick(g); } };

test('the first sheet says what each man really opens first', () => {
  E.candidates().forEach((c) => {
    const g = E.createGame({ capo: c.id });
    let first = null;
    for (let i = 0; i < 200 && !first; i++) { days(g, 1); first = E.view(g).cities[0].places.filter((p) => p.owner === 'family' && p.capo === c.id && p.kind !== 'club')[0]; }
    assert.ok(first, c.id + ' opens something');
    assert.equal(c.opens, D.SITES[first.kind].name, c.id);
    assert.match(text(C.man(c, 'start', 'Start with')), new RegExp('will start with: ' + T.a(c.opens.toLowerCase())));
  });
});

test('a first capo whose trade the family has not learned says so, and says what he opens meanwhile', () => {
  const of = (id) => E.candidates().filter((q) => q.id === id)[0];
  ['dutch', 'tommy'].forEach((id) => assert.equal(of(id).opens, of(id).trade, id + ' starts with his own trade'));
  ['sal', 'mae', 'vince', 'danny'].forEach((id) => assert.notEqual(of(id).opens, of(id).trade, id));
  assert.match(text(C.man(of('mae'), 'start', 'Start with')), /Her own trade, the owned front, has to be learned first/);
  assert.doesNotMatch(text(C.man(of('dutch'), 'start', 'Start with')), /has to be learned/);
});

test('the four numbers of a man have their names written, and so have his loyalty and his ambition', () => {
  const html = text(C.start(E.candidates()));
  ['Muscle', 'Business', 'Cunning', 'Charisma', 'Loyalty', 'Ambition'].forEach((w) => assert.match(html, new RegExp('\\b' + w + '\\b'), w));
});

test('a key place asked for says the seat it adds, and which money pays', () => {
  const { c, f } = siege();
  T.open(c, 9, 4, { owner: 'family', kind: 'loans', capo: 'sal' }); T.open(c, 10, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
  T.stepMonth(c, f);
  const v = T.view(c, f);
  assert.ok(v.asks.length, 'Sal asks for the brewery');
  const html = text(C.requests({ cities: [Object.assign(v, { name: 'Ashport', feuds: [], doors: [] })] }, { dirty: 20000, clean: 0 }));
  assert.match(html, /\+1 capo seat in Ashport/);
  assert.match(html, /dirty cash first/i);
});

test('the rules say how near the family is to each key place', () => {
  const { c, f } = siege();
  const k = T.view(c, f).keys[0];
  assert.equal(k.around, 2); assert.equal(k.need, T.RULES.siege);
});

test('no seat left: the door says how a seat is won, and how far the nearest key place is', () => {
  const door = { capo: 'ida', name: 'Ida Brandt', specialty: 'Bookkeeper', door: 'rise', cost: 1100, chairs: [] };
  const city = { id: 'a', name: 'Ashport', w: 4, zones: [], feuds: [], asks: [], doors: [door], seats: { taken: 3, total: 3 },
    keys: [{ key: 'port', name: 'Port', owner: 'Callahan', around: 1, need: 3 }, { key: 'hotel', name: 'Grand Hotel', owner: 'Callahan', around: 0, need: 3 }] };
  const html = text(C.requests({ cities: [city] }, { dirty: 9000, clean: 0 }));
  assert.match(html, /No seat left in Ashport/);
  assert.match(html, /Every key place you hold adds a seat/);
  assert.match(html, /the Port is the nearest: 1 of the 3 places a capo needs around it/);
});

test('a man at the door shows his four numbers and what he would open', () => {
  const g = E.createGame({ capo: 'dutch' }), c = g.cities[0];
  g.family.dirty = 50000; c.burnt = 99;
  const d = T.doors(c, g.family)[0], p = T.person(d.capo);
  assert.equal(d.muscle, p.muscle); assert.equal(d.charisma, p.charisma);
  assert.equal(d.trade, D.SITES[T.tradeOf(d.capo)].name);
  const html = text(C.requests(E.view(g), E.hud(g)));
  assert.match(html, new RegExp('Muscle ' + p.muscle));
  assert.match(html, new RegExp('Charisma ' + p.charisma));
  assert.match(html, new RegExp(d.trade, 'i'));
});

test('a quarrel says what each man runs and makes, and what the one ruled against does', () => {
  const capos = [{ id: 'sal', name: 'Sal Moretti', places: 5, income: 420, mood: 'steady' }, { id: 'mae', name: 'Mae Rourke', places: 2, income: 130, mood: 'restless' }];
  const city = { id: 'a', name: 'Ashport', w: 4, zones: [], capos, asks: [], doors: [],
    feuds: [{ id: 'mae|sal', a: 'mae', b: 'sal', label: 'Mae and Sal are at each other\'s throats over the same streets', sulks: 12, half: 0.5 }] };
  const html = text(C.requests({ cities: [city] }, { dirty: 0, clean: 0 }));
  assert.match(html, /5 places/); assert.match(html, /\$420/);
  assert.match(html, /2 places/); assert.match(html, /\$130/);
  assert.match(html, /Restless/);
  assert.match(html, /sends you nothing for 288 days/);
  assert.match(html, /send up half/);
  // the rules give those two figures
  const { c, f } = siege(); c.feuds.push({ id: 'a|b', a: 'a', b: 'b', month: 0, label: 'x' });
  assert.equal(T.feuds(c)[0].sulks, T.RULES.sulks);
});

test('a line for the city says what it brings and what it costs', () => {
  const by = {}; require('../web/turf-boss.js').lines().forEach((l) => { by[l.id] = l; });
  assert.match(by.grow.gives, /2 places more/); assert.match(by.grow.costs, /30% worse/);
  assert.match(by.earn.costs, /fewer new streets/i);
  assert.match(by.low.gives, /1 point/); assert.match(by.low.costs, /no place taken/i);
  const city = { id: 'a', held: true, line: 'grow', lines: Object.values(by) };
  const html = text(C.line(city));
  assert.match(html, /2 places more/); assert.match(html, /30% worse/);
});

test('the share says what it would bring, and what loyalty does when it falls', () => {
  const city = { id: 'a', held: true, cut: 'normal', made: 2000,
    cuts: [{ id: 'light', share: 0.08, loyal: 10 }, { id: 'normal', share: 0.15, loyal: 0 }, { id: 'heavy', share: 0.25, loyal: -15 }] };
  const html = text(C.cut(city));
  assert.match(html, /about \$160/); assert.match(html, /about \$500/);
  assert.match(html, /restless/i); assert.match(html, /bitter/i); assert.match(html, /leaves/i);
  // the rules say what the capos of a city made in the last cycle
  const g = E.createGame({ capo: 'dutch' }); days(g, 24 * 6);
  assert.ok(E.view(g).cities[0].made > 0);
});

test('the heat is written out of 100, with what happens at 100', () => {
  const g = E.createGame({ capo: 'sal' }); days(g, 48);
  const html = C.city(E.view(g), 'ashport');
  assert.match(text(html), /\d+ \/ 100/);
  assert.match(html, /seize half/);
});

test('every trade on the wheel has its name written under its mark', () => {
  const g = E.createGame({ capo: 'sal' }); days(g, 24);
  const v = E.view(g), html = C.wheel(v, null);
  v.tree.forEach((t) => assert.match(html, new RegExp('<em class="nm">' + C.brief(t.name) + '</em>'), t.name));
  assert.ok(v.tree.every((t) => C.brief(t.name).length <= 11), 'short enough to stand side by side');
});
