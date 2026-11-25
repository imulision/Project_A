// The words the game shows: no technical name, the right pronoun for a woman, the right article, amounts a player
// can read, and no news that says nothing. Each of these was seen on screen by a play tester.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');
const C = require('../web/cards.js');
const { town, family, siege } = require('./turf-helpers.js');

const days = (g, n) => { const out = []; for (let i = 0; i < n; i++) { g.paused = false; out.push(...E.tick(g)); } return out; };
const text = (html) => String(html).replace(/<[^>]*>/g, ' ');

test('a woman is never called he', () => {
  assert.equal(T.voice('mae', 'He keeps his money for himself: ask him'), 'She keeps her money for herself: ask her');
  assert.equal(T.voice('sal', 'He keeps his money for himself'), 'He keeps his money for himself');
  assert.equal(T.voice('ida', 'the men of his places, when he can'), 'the men of her places, when she can');
});

test('the news about a woman says she and her', () => {
  const g = E.createGame({ capo: 'mae' });
  const told = days(g, 24 * 60).concat(g.journal).filter((e) => e.capo === 'mae' && e.label);
  assert.ok(told.length > 3, 'Mae made the news');
  told.forEach((e) => assert.doesNotMatch(e.label, /\b(he|his|him|himself)\b/i, e.label));
});

test('the sheet of a woman says she and her, the sheet of a man he and his', () => {
  const g = E.createGame({ capo: 'mae' }); days(g, 48);
  const v = E.view(g), h = E.hud(g);
  [C.capo(v, 'ashport', 'mae', h), C.booksCard(v, 'ashport', 'mae', 6)].forEach((html) => {
    assert.doesNotMatch(text(html), /\b(he|his|him|himself)\b/i);
    assert.match(text(html), /\b(she|her)\b/i);
  });
  const g2 = E.createGame({ capo: 'sal' }); days(g2, 48);
  assert.match(text(C.capo(E.view(g2), 'ashport', 'sal', E.hud(g2))), /\bhis\b/i);
});

test('the first sheet does not say the boss picks a man', () => {
  assert.doesNotMatch(text(C.start(E.candidates())), /pick the man/i);
});

test('the Port is not called the the Port', () => {
  assert.equal(T.KEYS.port.name, 'Port');
  const { c, f } = siege();
  T.open(c, 11, 5, { owner: 'Callahan', kind: 'key', key: 'port' });
  T.keys(c).forEach((k) => assert.doesNotMatch('the ' + k.name, /the the/i));
});

test('a place whose name starts with a vowel takes an', () => {
  assert.equal(T.a('owned front'), 'an owned front');
  assert.equal(T.a('speakeasy'), 'a speakeasy');
  assert.equal(T.a('Union local'), 'a Union local');
});

test('an amount of money is written with its thousands apart', () => {
  assert.equal(T.dollars(3927), '$3,927');
  assert.equal(T.dollars(13.4), '$13');
  assert.equal(T.dollars(1250000), '$1,250,000');
});

test('nothing the rules refuse names a city or an ask by its technical name', () => {
  const g = E.createGame({ capo: 'sal' }), c = g.cities[1];
  assert.equal(c.name, 'Calder Falls');
  assert.throws(() => E.command(g, { type: 'answer', city: 'ashport', id: 'ashport:fund:otto', yes: true }), (e) => !/ashport:|:fund:/.test(e.message));
  assert.throws(() => T.underboss(g.cities[0], g.family, 'sal'), (e) => /Ashport/.test(e.message) && !/ashport/.test(e.message));
  // no seat left: the city by its name
  const g2 = E.createGame({ capo: 'dutch' }), home = g2.cities[0];
  g2.family.dirty = 1e6; home.burnt = 99;
  ['mae', 'tommy'].forEach((id) => { const s = T.spots(home)[0]; T.settle(home, id, s.x, s.y); T.join(g2.family, id); });
  assert.throws(() => T.welcome(home, g2.family, 'sal'), /no seat left in Ashport/);
});

test('an old saved game has the names of its cities', () => {
  const g = E.createGame({ capo: 'sal' }); g.cities.forEach((c) => { delete c.name; });
  assert.equal(E.load(E.save(g)).cities[0].name, 'Ashport');
});

test('a capo who drives somewhere is not news, and a piece of news without words is not shown', () => {
  assert.equal(C.newsworthy({ type: 'capo', step: 'drives', label: 'Standing over his speakeasy in Canal Street' }), false);
  assert.equal(C.newsworthy({ type: 'capo', step: 'arrives' }), false);
  assert.equal(C.newsworthy({ type: 'whatever' }), false);
  assert.equal(C.newsworthy({ type: 'burnt', label: 'The Callahans burn Sal\'s still' }), true);
});

test('a rank won says which rank it was, and never "your family is now a Family"', () => {
  const zones = {}, at = (n, name) => ({ rank: { n, name, at: 0 }, zones });
  const up = C.moments(at(1, 'Crew'), at(2, 'Family'), {})[0];
  assert.equal(up.title, 'YOUR CREW IS NOW A FAMILY');
  assert.equal(C.moments(at(0, 'Street gang'), at(1, 'Crew'), {})[0].title, 'YOUR STREET GANG IS NOW A CREW');
  assert.equal(C.moments(at(2, 'Family'), at(1, 'Crew'), {})[0].title, 'YOUR FAMILY FALLS BACK TO A CREW');
});

test('the rank the screen shows is the one the rules hold: it does not flicker around a threshold', () => {
  const g = E.createGame({ capo: 'sal' }); days(g, 24);
  const share = (x) => { g.history[g.history.length - 1].cities = { ashport: { share: x } }; E.settle(g); return C.rank(E.view(g)); };
  assert.equal(share(3.2).name, 'Crew');
  assert.equal(share(2.8).name, 'Crew', 'a hair under the threshold is still a Crew');
  assert.equal(share(3.1).name, 'Crew');
  assert.equal(share(1.5).name, 'Street gang');
});

test('a street name won, lost by a hair and won again is told once', () => {
  const step = (share) => ({ rank: { n: 0, name: 'Street gang' }, zones: { 'ashport-1': { name: 'Hillside', share } } }), mem = {};
  const titles = (a, b) => C.moments(step(a), step(b), mem).map((m) => m.title);
  assert.deepEqual(titles(90, 100), ['HILLSIDE IS YOURS']);
  assert.deepEqual(titles(100, 96), []);
  assert.deepEqual(titles(96, 100), []);
  assert.deepEqual(titles(100, 70), ['HILLSIDE IS NO LONGER ALL YOURS']);
  assert.deepEqual(titles(70, 100), ['HILLSIDE IS YOURS']);
});

test('a capo at the top rank is not said to wait for his next rank', () => {
  const html = C.capo({ cities: [{ id: 'a', name: 'A', capos: [{ id: 'sal', name: 'Sal Moretti', specialty: 'Enforcer', rankName: 'Legend', places: 20, reach: 20, income: 10, cash: 0, x: 1, y: 1,
    plan: { move: 'hold', waiting: 'rank', top: true, cost: 0, saved: 0, progress: 1, why: 'he runs all a Legend can' } }], places: [], asks: [] }] }, 'a', 'sal', {});
  assert.doesNotMatch(text(html), /next rank/);
  assert.match(text(html), /all a Legend can/);
});

test('the rules say when a capo who runs all he can is at the top rank', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal'); f.men.sal.rank = 3;
  for (let i = 0; i < 20; i++) { const s = T.spots(c).filter((q) => q.x <= 5)[0]; T.open(c, s.x, s.y, { owner: 'family', kind: 'speakeasy', capo: 'sal', level: 3 }); }
  const p = T.plan(c, f, 'sal');
  assert.equal(p.waiting, 'rank'); assert.equal(p.top, true);
  assert.match(p.why, /Legend/);
});

test('a year on, a man who runs no place is not said to "run 0 places and make"', () => {
  const g = E.createGame({ capo: 'dutch' }), c = g.cities[0];
  g.family.dirty = 50000; c.burnt = 99;
  const d = T.doors(c, g.family)[0];
  E.command(g, { type: 'welcome', city: 'ashport', capo: d.capo });
  for (let i = 0; i < 400 && E.view(g).paying.length; i++) days(g, 1);
  // he is kept from opening anything for a year
  let told = null;
  for (let i = 0; i < 24 * 13 && !told; i++) { g.family.men[d.capo].cash = -1e6; Object.keys(c.blocks).forEach((k) => { if (c.blocks[k].capo === d.capo && c.blocks[k].kind !== 'club') delete c.blocks[k]; }); T.touch(c); told = days(g, 1).filter((e) => e.type === 'outcome' && e.capo === d.capo)[0]; }
  assert.ok(told, 'the outcome is told');
  assert.doesNotMatch(told.label, /runs 0 places/);
  assert.match(told.label, /runs no place/);
});

test('clean money that sleeps says what can be learned or bought, in the right words', () => {
  const g = E.createGame({ capo: 'sal' }); g.family.clean = 1200; days(g, 24 * 14);
  const idle = E.view(g).stalls.filter((s) => s.id === 'idle')[0];
  assert.ok(idle, 'said after a year');
  assert.doesNotMatch(idle.lever, /A better/);
  assert.match(idle.lever, /^Learning .* costs \$1,000|costs \$1,000/);
  // the family buys something: the clock of the sleeping money starts again
  E.command(g, { type: 'research', building: E.view(g).tree.filter((t) => t.next && t.next.cost <= 1200)[0].kind });
  for (let i = 0; i < 400 && E.view(g).paying.length; i++) days(g, 1);
  g.family.clean = 1200; days(g, 24 * 3);
  assert.equal(E.view(g).stalls.filter((s) => s.id === 'idle').length, 0, 'nothing is said three cycles after a purchase');
});

test('a chair at the table says what it costs, and its button is shut when the boss cannot pay', () => {
  const door = { capo: 'ida', name: 'Ida Brandt', specialty: 'Bookkeeper', door: 'rise', cost: 1100, chairs: ['bookkeeper'] };
  const view = { cities: [{ id: 'a', name: 'A', doors: [door] }], table: [{ post: 'bookkeeper', name: 'Bookkeeper', capo: null, pay: 300 }] };
  const poor = C.chairs(view, 'a', 'ida', { dirty: 100, clean: 0 }), rich = C.chairs(view, 'a', 'ida', { dirty: 5000, clean: 0 });
  assert.match(text(poor), /\$1,100/);
  assert.match(poor, /data-act="sit"[^>]*disabled/);
  assert.doesNotMatch(rich, /data-act="sit"[^>]*disabled/);
});
