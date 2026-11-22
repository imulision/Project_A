// What holds the family back, said plainly: what is happening, since when, why, and what the boss can do about it.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family, year = H.year;

// Dutch alone in the small town, with a club and nothing else.
const lone = () => { const c = town(), f = family({ dirty: 5000 }); T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch'); return { c, f }; };
const ids = (list) => list.map((s) => s.id);

test('a family that has just set foot in a city is held back by nothing', () => {
  const { c, f } = lone();
  assert.deepEqual(T.stalls(c, f), []);
  assert.deepEqual(T.view(c, f).stalls, []);
});

test('nobody new in two years: the city says who would bring a man in, and how far he is from it', () => {
  const { c, f } = lone();
  c.month = 23;
  assert.ok(!ids(T.stalls(c, f)).includes('nobody'), 'not yet');
  c.month = 40;
  const s = T.stalls(c, f).find((q) => q.id === 'nobody');
  assert.equal(s.since, 40);
  assert.equal(s.what, 'No new man in ' + T.days(36));
  assert.equal(s.why, 'A capo brings a man in when he runs six places: Dutch runs 0');
  assert.equal(s.lever, 'Set the line to Grow: your capos run more places');
  T.line(c, 'grow');
  assert.equal(T.stalls(c, f).find((q) => q.id === 'nobody').lever, null, 'the line is already to grow: nothing more to do');
});

test('the count starts again the day a man is taken in, and stops while a man waits at the door', () => {
  const { c, f } = lone();
  c.month = 40; c.joined = 30;
  assert.ok(!ids(T.stalls(c, f)).includes('nobody'));
  c.joined = 2; c.burnt = 99; // (a city this burnt brings a man of need to the door)
  if (T.doors(c, f).length) assert.ok(!ids(T.stalls(c, f)).includes('nobody'), 'a man waits: the boss has a word to give');
});

test('welcoming a man is remembered by the city', () => {
  const { c, f } = lone();
  f.dirty = 50000; c.month = 7; c.burnt = 99;
  const d = T.doors(c, f)[0], spot = T.spots(c)[0];
  assert.ok(d, 'somebody is at the door');
  T.welcome(c, f, d.capo, spot.x, spot.y);
  assert.equal(c.joined, 7);
});

test('a capo who sulks: how long it will last, and that a gift may help', () => {
  const { c, f } = lone();
  c.month = 10; c.sulk = { dutch: 16 };
  const s = T.stalls(c, f).find((q) => q.id === 'sulk:dutch');
  assert.deepEqual([s.capo, s.what, s.why], ['dutch', 'Dutch sends nothing up', 'He sulks for ' + T.days(6) + ' more']);
  assert.equal(s.lever, 'A gift of $' + T.RULES.loyal.gift + ' may bring him round');
  c.sulk.dutch = 10;
  assert.ok(!ids(T.stalls(c, f)).includes('sulk:dutch'));
});

test('a man of the table left unpaid: what was due, and what was in hand', () => {
  const { c, f } = lone();
  f.table = { bookkeeper: 'dutch' }; f.owed = { bookkeeper: true }; f.dirty = 40; f.clean = 0;
  const s = T.stalls(c, f).find((q) => q.id === 'unpaid:dutch');
  assert.equal(s.what, 'Dutch was not paid');
  assert.equal(s.why, 'The table costs $' + T.RULES.table.pay + ' a man ' + T.EVERY + ': the family had $40 in hand');
  assert.equal(s.lever, 'Free his chair, or wait for money to come up');
});

test('ground lost over a year: how many places, and how many of them the rivals burnt', () => {
  const { c, f } = lone();
  c.rival = 'Callahan'; c.month = 30; c.burnt = 7;
  c.tally = [{ month: 18, places: 6, burnt: 3 }, { month: 29, places: 2, burnt: 7 }];
  const s = T.stalls(c, f).find((q) => q.id === 'losing');
  assert.equal(s.what, 'The family lost 5 places here in ' + T.days(12));
  assert.equal(s.why, 'The Callahans burnt 4 of them');
  assert.equal(s.lever, null);
  T.line(c, 'grow');
  // (Dutch follows the line to grow or not: the lever is only named when the line is to grow)
  assert.equal(T.stalls(c, f).find((q) => q.id === 'losing').lever, 'Under Grow your capos guard their places less well: change the line');
});

test('the city keeps a year of its own count, month after month', () => {
  const { c, f } = lone();
  year(c, f, 20);
  assert.equal(c.tally.length, 13);
  assert.deepEqual(Object.keys(c.tally[12]).sort(), ['burnt', 'month', 'places']);
  assert.equal(c.tally[12].month, 20);
});

test('each trouble remembers the month it began, and forgets once it is over', () => {
  const { c, f } = lone();
  year(c, f, 3);
  c.sulk = { dutch: c.month + 4 };
  year(c, f, 2);
  assert.equal(T.stalls(c, f).find((q) => q.id === 'sulk:dutch').since, 2);
  year(c, f, 4);
  assert.ok(!ids(T.stalls(c, f)).includes('sulk:dutch'));
  assert.ok(!('sulk:dutch' in c.stalled));
});

test('at most three troubles a city, the gravest first: unpaid men, ground lost, a capo boxed in, a sulk, nobody new', () => {
  const { c, f } = lone();
  c.rival = 'Callahan'; c.month = 40; c.sulk = { dutch: 50 };
  c.tally = [{ month: 28, places: 6, burnt: 0 }];
  f.table = { bookkeeper: 'dutch' }; f.owed = { bookkeeper: true };
  assert.deepEqual(ids(T.stalls(c, f)), ['unpaid:dutch', 'losing', 'sulk:dutch']);
});

// --- the whole game ---

// A boss who takes in his first two men, then says yes to everything and does nothing else.
const idle = (capo, months, each) => {
  const g = E.createGame({ capo }); g.reign.left = 1e9; // the director keeps out of this story (see reign.test.js)
  for (let m = 1; m <= months; m++) {
    if (each) each(g);
    for (let i = 0; i < E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
    for (const c of E.view(g).cities) {
      for (const a of c.asks) { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: true }); } catch (e) { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } }
      if (m < 30) for (const d of c.doors) { const s = T.spots(g.cities.find((q) => q.id === c.id))[0]; try { E.command(g, { type: 'welcome', city: c.id, capo: d.capo, x: s.x, y: s.y }); } catch (e) { /* cannot pay yet */ } }
    }
  }
  return g;
};

test('nineteen years of standing still are explained: a man left at the door, a capo saving alone for a place, money asleep', () => {
  // (a capo is boxed in some months and not others: the test reads the first month it is said)
  let boxed = null, k = null, top = null;
  const g = idle('tommy', 228, (q) => { if (boxed) return; const c = E.view(q).cities[0]; boxed = c.stalls.find((s) => s.id.startsWith('boxed:')) || null; k = boxed && c.capos.find((m) => m.id === boxed.capo); top = E.view(q).stalls; }), v = E.view(g), a = v.cities[0];
  // nobody new: a man has been waiting at the door for years (his capo runs six places), and that is the boss's to answer
  assert.equal(E.hud(g).men, 3);
  assert.ok(a.doors.some((d) => d.door === 'rise'), 'a man waits at the door');
  assert.ok(!a.stalls.some((s) => s.id === 'nobody'), 'so the city does not say nobody comes');
  assert.ok(boxed, 'a capo is boxed in');
  assert.equal(boxed.what, k.name.split(' ')[0] + ' is saving alone to take a place: $' + Math.round(k.plan.saved).toLocaleString('en-US') + ' of $' + Math.round(k.plan.cost).toLocaleString('en-US'));
  assert.equal(boxed.why[0].toUpperCase() + boxed.why.slice(1), boxed.why, 'a sentence');
  assert.equal(boxed.lever, null, 'nothing the boss can do today');
  assert.deepEqual([boxed.x, boxed.y], [k.plan.x, k.plan.y]);
  // the family as a whole
  const idleMoney = v.stalls.find((s) => s.id === 'idle');
  assert.ok(idleMoney, 'the clean money sleeps');
  assert.match(idleMoney.what, /^\$[\d,]+ of clean money sleeps$/);
  assert.match(idleMoney.lever, /costs \$[\d,]+$/);
  assert.ok(idleMoney.since >= 12);
  assert.ok(v.stalls.length <= 3);
  assert.ok(top.some((s) => s.city === 'ashport' && s.id === boxed.id), 'the gravest troubles of the cities come up too');
});

test('a young family has no sleeping money, and a saved game keeps what it remembers', () => {
  const g = idle('dutch', 6);
  assert.ok(!E.view(g).stalls.some((s) => s.id === 'idle'));
  const old = idle('dutch', 80), back = E.load(E.save(old));
  assert.deepEqual(E.view(back).stalls, E.view(old).stalls);
  assert.deepEqual(E.view(back).cities[0].stalls, E.view(old).cities[0].stalls);
});
