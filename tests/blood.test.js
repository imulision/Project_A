// The price of blood: a killing is seen by every man of the family, said in the news, written on the sheet before the
// order is given, and each new killing costs more than the last.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const C = require('../web/cards.js');
const H = require('./turf-helpers.js');

const L = T.RULES.loyal, O = T.RULES.out;
const text = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
// Dutch, Vince and Danny in one town, each with a place.
const three = () => {
  const c = H.town(), f = H.rich(); f.tech = {}; f.clean = 0;
  [['dutch', 2, 2], ['vince', 8, 3], ['danny', 5, 0]].forEach(([id, x, y]) => { T.settle(c, id, x, y); T.join(f, id); });
  T.open(c, 9, 2, { owner: 'family', kind: 'loft', capo: 'vince' });
  return { c, f };
};

test('a killing says who is shaken: the men who are not steady keep their money, and all lose loyalty', () => {
  const { c, f } = three();
  const was = { dutch: T.loyalty(f, 'dutch'), danny: T.loyalty(f, 'danny') };
  const r = T.part(c, f, 'vince', 'kill');
  assert.equal(r.blood, 1);
  assert.equal(r.loyal, L.blood);
  assert.equal(T.loyalty(f, 'dutch'), was.dutch - L.blood);
  assert.deepEqual(r.shaken.sort(), ['danny', 'dutch'].filter((id) => was[id] < O.steady).sort());
  assert.equal(r.months, O.shaken);
});

test('blood calls blood: the second killing costs twice the first, until the family has forgotten', () => {
  const { c, f } = three();
  T.part(c, f, 'vince', 'kill');
  const was = T.loyalty(f, 'dutch');
  const r = T.part(c, f, 'danny', 'kill');
  assert.equal(r.blood, 2);
  assert.equal(T.loyalty(f, 'dutch'), was - 2 * L.blood);
  assert.equal(r.months, 2 * O.shaken);
  assert.equal(c.sulk.dutch, c.month + 2 * O.shaken, 'he keeps his money twice as long');
  // forgotten after a while
  const b = three();
  T.part(b.c, b.f, 'vince', 'kill');
  for (let i = 0; i < O.forgets; i++) T.stepMonth(b.c, b.f);
  assert.equal(T.part(b.c, b.f, 'danny', 'kill').blood, 1);
});

test('the men of the other cities hear of it too, half as hard', () => {
  const { c, f } = three();
  const far = H.town(); far.id = 'far'; T.settle(far, 'sal', 2, 2); T.join(f, 'sal');
  const was = T.loyalty(f, 'sal');
  T.part(c, f, 'vince', 'kill');
  assert.equal(T.loyalty(f, 'sal'), was - Math.round(L.blood / 2));
});

test('the sheet says the price of a killing before the order is given', () => {
  const { c, f } = three();
  const p = T.partings(c, f, 'vince').filter((q) => q.way === 'kill')[0];
  assert.deepEqual(p.price, { heat: O.blood, loyal: L.blood, months: O.shaken, shaken: ['danny', 'dutch'].filter((id) => T.loyalty(f, id) < O.steady), blood: 1 });
  const g = E.createGame({ capo: 'dutch', quiet: true }), city = g.cities[0];
  T.settle(city, 'danny', 0, 0); T.join(g.family, 'danny');
  const html = text(C.parting(E.view(g), 'ashport', 'danny', 'kill'));
  assert.match(html, new RegExp('Heat \\+' + O.blood + ' in Ashport'));
  assert.match(html, new RegExp('loses ' + L.blood + ' loyalty'));
  assert.match(html, /next killing costs twice as much/i);
});

test('the news says what the others do after a killing', () => {
  const g = E.createGame({ capo: 'dutch', quiet: true }), c = g.cities[0];
  T.settle(c, 'danny', 0, 0); T.join(g.family, 'danny');
  g.family.men.dutch.loyal = 60;
  E.command(g, { type: 'part', city: 'ashport', capo: 'danny', way: 'kill' });
  const told = g.journal.filter((e) => e.type === 'shaken');
  assert.equal(told.length, 1);
  assert.equal(told[0].capo, 'dutch');
  assert.match(told[0].label, /Dutch saw what became of Danny: he keeps his money for himself for 144 days/);
  assert.equal(C.newsworthy(told[0]), true);
});

test('a boss who kills man after man is left with men who are no longer his', () => {
  const g = E.createGame({ capo: 'dutch', quiet: true }), c = g.cities[0];
  ['danny', 'vince', 'tommy', 'mae'].forEach((id, i) => { T.settle(c, id, i * 2, 0); T.join(g.family, id); });
  ['danny', 'vince', 'tommy'].forEach((id) => E.command(g, { type: 'part', city: 'ashport', capo: id, way: 'kill' }));
  const moods = E.view(g).cities[0].capos.map((k) => k.mood);
  assert.ok(moods.every((m) => m !== 'steady') && moods.some((m) => m === 'bitter'), 'three killings: ' + moods.join(', '));
});
