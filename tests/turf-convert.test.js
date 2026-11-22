// A capo turns a place into another trade when its street suits that trade far better.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family, year = H.year;

const PORT = Object.keys(T.TERRAIN).find((k) => T.TERRAIN[k] === 'port'), NIGHT = Object.keys(T.TERRAIN).find((k) => T.TERRAIN[k] === 'nightlife');
// Dutch in Lantern Row (a street for the night, with no port at all), running all a soldier can: five night places and `odd` at 3,2.
const full = (odd, more) => {
  const c = town(), f = family(Object.assign({ dirty: 0 }, more));
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3]].forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: NIGHT, capo: 'dutch', level: 3 }));
  T.open(c, 3, 2, { owner: 'family', kind: odd, capo: 'dutch', level: 3 });
  return { c, f };
};
const wants = (c, f, o) => T.wants(c, 'dutch', Object.assign({ rank: 0, tech: f.tech, wash: false, line: null }, o));

test('a place on the wrong street: the capo means to turn it into the trade the street is made for', () => {
  const { c, f } = full(PORT), w = wants(c, f);
  assert.equal(w.move, 'convert');
  assert.deepEqual([w.x, w.y, w.from], [3, 2, PORT]);
  assert.notEqual(w.kind, PORT);
  assert.ok(T.worth(c, 3, 2, w.kind) > T.worth(c, 3, 2, PORT));
  assert.equal(w.name, D.SITES[w.kind].name);
  assert.equal(w.cost, Math.round(T.RULES.convert.cost * T.price(c, 'dutch', w.kind)));
  assert.equal(w.why, 'Lantern Row suits a ' + D.SITES[w.kind].name.toLowerCase() + ' far better than his ' + D.SITES[PORT].name.toLowerCase());
});

test('a place that suits its street is left as it is', () => {
  const { c, f } = full('brothel'), w = wants(c, f); // (the best trade of the night, and his only one)
  assert.ok(!w || w.move !== 'convert' || w.x !== 3 || w.y !== 2, 'the brothel stays a brothel');
});

test('he never turns a place into a trade he refuses or one the family has not learned, and never his club', () => {
  const { c, f } = full(PORT), first = wants(c, f).kind;
  f.tech[first] = 0;
  const second = wants(c, f);
  assert.ok(!second || second.move !== 'convert' || second.kind !== first, 'not a closed trade');
  for (const k of Object.keys(f.tech)) f.tech[k] = k === PORT ? 3 : 0;
  assert.notEqual((wants(c, f) || {}).move, 'convert', 'nothing else is known');
  const club = T.clubOf(c, 'dutch');
  assert.equal(T.at(c, club.x, club.y).kind, 'club');
});

test('with the money in hand he does it: the place changes trade, keeps its size as far as the family knows the trade, and the news says so', () => {
  const { c, f } = full(PORT), w = wants(c, f);
  f.tech[w.kind] = 2;
  f.men.dutch.cash = 50000;
  const events = T.stepMonth(c, f), e = events.find((q) => q.type === 'converted');
  assert.ok(e, 'the news says so');
  assert.deepEqual([e.capo, e.city, e.x, e.y, e.from, e.kind, e.cost], ['dutch', 'town', 3, 2, PORT, w.kind, w.cost]);
  assert.equal(e.label, 'Dutch turns his ' + D.SITES[PORT].name.toLowerCase() + ' into a ' + D.SITES[w.kind].name.toLowerCase() + ' in Lantern Row');
  const p = T.at(c, 3, 2);
  assert.deepEqual([p.kind, p.level, p.owner, p.capo], [w.kind, 2, 'family', 'dutch']);
  assert.equal(p.turned, c.month);
});

test('a place just turned is left alone for years, whatever the street says', () => {
  const { c, f } = full(PORT);
  f.men.dutch.cash = 50000;
  T.stepMonth(c, f);
  const now = T.at(c, 3, 2).kind;
  f.men.dutch.cash = 50000;
  const later = year(c, f, T.RULES.convert.rest - 2);
  assert.ok(!later.some((e) => e.type === 'converted' && e.x === 3 && e.y === 2));
  assert.equal(T.at(c, 3, 2).kind, now);
});

test('told to earn, he turns the wrong place before he makes the others bigger; left alone, he opens first when he has room', () => {
  const { c, f } = full(PORT);
  T.at(c, 1, 1).level = 1;
  assert.equal(wants(c, f, { line: 'earn' }).move, 'convert');
  assert.equal(wants(c, f, { rank: 3 }).move, 'open', 'a man with room opens first');
});

test('twenty years: capos do turn places, and not back and forth', () => {
  const E = require('../web/empire.js');
  const g = E.createGame({ capo: 'dutch' }), seen = {};
  let turns = 0;
  for (let m = 1; m <= 240; m++) {
    for (let i = 0; i < E.TICKS_PER_MONTH; i++) {
      g.paused = false;
      for (const e of E.tick(g)) if (e.type === 'converted') { turns++; const k = e.city + ':' + e.x + ',' + e.y; seen[k] = (seen[k] || 0) + 1; }
    }
    for (const c of E.view(g).cities) {
      for (const a of c.asks) { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: true }); } catch (e) { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } }
      for (const d of c.doors) { try { E.command(g, { type: 'welcome', city: c.id, capo: d.capo }); } catch (e) { /* cannot pay yet */ } }
    }
  }
  assert.ok(turns >= 1, 'a place was turned');
  assert.ok(Object.values(seen).every((n) => n <= 20 * 12 / T.RULES.convert.rest + 1), 'no place is turned again and again');
});
