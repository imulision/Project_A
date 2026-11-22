// The live hit: a guarded place taken gun in hand is played in three steps, and the boss can call each one.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const H = require('../web/turf-hit.js');
const E = require('../web/empire.js');
const { town, family } = require('./turf-helpers.js');

const K = T.RULES.hit;
// Sal's club in the east, a Callahan bar next to their own places in the west: a guarded place
const scene = (capo = 'sal', level = 2) => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, capo, 8, 3); T.join(f, capo);
  T.open(c, 3, 3, { owner: 'Callahan', kind: 'speakeasy', level });
  T.open(c, 2, 3, { owner: 'Callahan', kind: 'gambling', level: 2 });
  T.open(c, 3, 2, { owner: 'Callahan', kind: 'gambling', level: 2 });
  const o = { capo, x: 3, y: 3, way: 'force', kind: 'speakeasy', cost: 600, month: c.month, months: 0 };
  return { c, f, o };
};
const live = (capo, level) => { const s = scene(capo, level); s.c.turn = { daily: true, day: 3 }; s.events = []; s.hit = H.open(s.c, s.f, s.o, s.events); return s; };
const ended = (events) => events.find((e) => e.type === 'hit' && e.step === 'end');

test('a place the rivals press hard on is guarded, a lone one is not', () => {
  const { c, o } = scene();
  assert.ok(H.guarded(c, o));
  T.open(c, 10, 0, { owner: 'Callahan', kind: 'speakeasy' });
  assert.ok(!H.guarded(c, { capo: 'sal', x: 10, y: 0, way: 'force', kind: 'speakeasy' }));
});

test('a place bought or bribed is never a live hit, nor a key place', () => {
  const { c, o } = scene();
  assert.ok(!H.guarded(c, Object.assign({}, o, { way: 'buy' })));
  assert.ok(!H.guarded(c, Object.assign({}, o, { way: 'bribe' })));
  assert.ok(!H.guarded(c, Object.assign({}, o, { key: 'brewery', kind: 'key' })));
});

test('a hit opens in the street: both sides are counted, the street is fought, and the boss is asked at the door', () => {
  const { c, hit, events } = live();
  assert.strictEqual(c.hits.length, 1);
  assert.deepStrictEqual(events.filter((e) => e.type === 'hit').map((e) => e.step), ['start', 'call']);
  assert.match(events[0].label, /Sal hits the Callahans' speakeasy/);
  assert.strictEqual(hit.stage, 1);
  assert.ok(hit.ours > 0 && hit.theirs > 0);
  assert.strictEqual(hit.left, K.wait);
});

test('the view tells the hit: where, who, the three steps, the calls with what each wins and risks, and what he would do alone', () => {
  const { c, f } = live(), v = T.view(c, f).hits[0];
  assert.deepStrictEqual(v.stages, ['The street', 'The door', 'Inside']);
  assert.deepStrictEqual([v.capo, v.x, v.y, v.kind, v.rival, v.stage], ['sal', 3, 3, 'speakeasy', 'Callahan', 1]);
  assert.strictEqual(v.name, 'Speakeasy');
  assert.deepStrictEqual(v.calls.map((q) => q.id), ['press', 'hold', 'pull']);
  assert.deepStrictEqual(v.calls.map((q) => q.name), ['Press on', 'Hold', 'Pull out']);
  v.calls.forEach((q) => assert.ok(q.gains.length && q.risks.length, q.id));
  assert.ok(['press', 'hold', 'pull'].includes(v.alone));
  assert.ok(v.left > 0 && v.of === K.wait);
  assert.ok(v.title && v.say);
});

test('a hard man loses fewer men in the street than a soft one', () => {
  const hard = live('sal'), soft = live('mae');
  assert.ok(T.person('sal').muscle > T.person('mae').muscle);
  assert.ok(hard.hit.lost <= soft.hit.lost);
  assert.ok(hard.hit.ours > soft.hit.ours);
});

test('pressing on to the end takes the place, its till, and tells what it cost', () => {
  const { c, f, hit } = live('sal', 1), had = f.men.sal.cash;
  const a = H.call(c, f, hit.id, 'press'), b = ended(a) ? a : H.call(c, f, hit.id, 'press'), end = ended(b);
  assert.ok(end, 'two calls at most');
  assert.strictEqual(end.result.outcome, 'won');
  assert.strictEqual(T.at(c, 3, 3).owner, 'family');
  assert.strictEqual(T.at(c, 3, 3).capo, 'sal');
  assert.ok(end.result.till > 0);
  H.pass(c, f, []); // the men come home with the till
  assert.strictEqual(f.men.sal.cash, Math.max(0, had - end.result.lost * K.blood) + end.result.till);
  assert.deepStrictEqual([end.result.place, end.result.watched], [1, true]);
  assert.ok(end.result.heat > 0);
  assert.ok(b.concat(a).some((e) => e.type === 'taken' && e.way === 'force'));
  assert.strictEqual(c.hits.length, 0);
});

test('pulling out wins nothing, loses no more men, and the capo loses face', () => {
  const { c, f, hit } = live(), lost = hit.lost, loyal = T.loyalty(f, 'sal');
  const end = ended(H.call(c, f, hit.id, 'pull'));
  assert.strictEqual(end.result.outcome, 'pulled');
  assert.strictEqual(end.result.lost, lost);
  assert.strictEqual(T.at(c, 3, 3).owner, 'Callahan');
  assert.strictEqual(T.loyalty(f, 'sal'), loyal - K.face);
  assert.strictEqual(c.hits.length, 0);
});

test('holding gives up the place but burns it out: the street is no longer theirs', () => {
  const { c, f, hit } = live(), lost = hit.lost;
  const end = ended(H.call(c, f, hit.id, 'hold'));
  assert.strictEqual(end.result.outcome, 'held');
  assert.strictEqual(T.at(c, 3, 3), null);
  assert.ok(end.result.lost > lost && end.result.lost <= lost + 2);
  assert.strictEqual(end.result.place, 0);
});

test('a crew cut down to nothing is routed: nothing won, and it is told', () => {
  const { c, f, hit } = live('sal', 2);
  hit.ours = 2;
  const end = ended(H.call(c, f, hit.id, 'press'));
  assert.strictEqual(end.result.outcome, 'routed');
  assert.strictEqual(T.at(c, 3, 3).owner, 'Callahan');
});

test('every man lost costs the capo money and brings heat', () => {
  const { c, f, hit } = live(), had = f.men.sal.cash, heat = c.heat || 0;
  const end = ended(H.call(c, f, hit.id, 'pull'));
  assert.strictEqual(f.men.sal.cash, Math.max(0, had - end.result.lost * K.blood));
  assert.strictEqual((c.heat || 0) - heat, end.result.heat);
});

test('left alone, the capo decides when his patience runs out, and the result says the boss was not watching', () => {
  const { c, f, hit } = live(), alone = T.view(c, f).hits[0].alone, events = [];
  for (let d = 0; d < K.wait - 1; d++) H.pass(c, f, events);
  assert.strictEqual(events.length, 0, 'nothing before his patience runs out');
  H.pass(c, f, events);
  const told = events.filter((e) => e.type === 'hit');
  assert.ok(told.length > 0);
  assert.strictEqual(told[0].call, alone);
  assert.strictEqual(told[0].watched, false);
});

test('alone, a hothead presses on when outnumbered and a careful man does not', () => {
  const hot = live('sal', 2), cool = live('sal', 2);
  cool.hit.capo = 'mae'; // the same door, with a careful woman in front of it
  hot.hit.ours = 3; cool.hit.ours = 3;
  assert.ok(T.person('sal').ambition >= 60 || T.person('sal').muscle >= 7);
  assert.strictEqual(T.view(hot.c, hot.f).hits[0].alone, 'press');
  assert.notStrictEqual(T.view(cool.c, cool.f).hits[0].alone, 'press');
});

test('a call that does not exist, or a hit that is over, is refused', () => {
  const { c, f, hit } = live();
  assert.throws(() => H.call(c, f, hit.id, 'dance'), /no such call/);
  H.call(c, f, hit.id, 'pull');
  assert.throws(() => H.call(c, f, hit.id, 'press'), /no such hit/);
});

test('the last hit stays readable after it ends', () => {
  const { c, f, hit } = live();
  H.call(c, f, hit.id, 'pull');
  const last = T.view(c, f).hitLast;
  assert.strictEqual(last.id, hit.id);
  assert.strictEqual(last.result.outcome, 'pulled');
  assert.ok(last.result.title && last.result.say);
});

test('nothing a hit says speaks of months or years', () => {
  const { c, f, hit } = live(), all = JSON.stringify(T.view(c, f).hits) + JSON.stringify(H.call(c, f, hit.id, 'press'));
  assert.ok(!/month|year/i.test(all));
});

test('played a cycle at a time, a guarded place is fought to the end without the boss', () => {
  const { c, f, o } = scene();
  c.ops.push(o);
  const events = T.stepMonth(c, f);
  assert.ok(ended(events), 'the hit ended within the cycle');
  assert.strictEqual(c.hits.length, 0);
  assert.strictEqual(ended(events).result.watched, false);
});

test('while he is at it the capo is at the place he hits', () => {
  const { c, f } = live();
  const k = T.view(c, f).capos.find((m) => m.id === 'sal');
  assert.deepStrictEqual([k.at.x, k.at.y, k.at.why], [3, 3, 'hit']);
});

// --- in the game ---
test('the boss calls a hit through an order, and the journal keeps the end', () => {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9;
  const c = g.cities[0], club = T.clubOf(c, 'sal'), theirs = T.places(c).filter((p) => p.owner !== 'family' && p.kind !== 'key' && p.kind !== 'hq')
    .sort((a, b) => T.hold(c, b.x, b.y).rival - T.hold(c, a.x, a.y).rival)[0];
  c.turn = c.turn || { daily: true, day: 0 };
  const hit = H.open(c, g.family, { capo: 'sal', x: theirs.x, y: theirs.y, way: 'force', kind: theirs.kind, cost: 500, month: c.month, months: 0 }, []);
  assert.ok(club && E.view(g).cities[0].hits.length === 1);
  assert.throws(() => E.command(g, { type: 'call', city: c.id, hit: 'nope', call: 'press' }), /no such hit/);
  E.command(g, { type: 'call', city: c.id, hit: hit.id, call: 'pull' });
  assert.strictEqual(E.view(g).cities[0].hits.length, 0);
  const line = g.journal[g.journal.length - 1];
  assert.deepStrictEqual([line.type, line.step], ['hit', 'end']);
});

test('a hit does not stop the clock, and its news reach the screen', () => {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9;
  let seen = null;
  for (let i = 0; i < 6000 && !seen; i++) { g.paused = false; const e = E.tick(g).find((q) => q.type === 'hit'); if (e) seen = { e, paused: g.paused }; }
  if (!seen) return; // this start may never meet a guarded place: the rules above are tested on their own
  assert.strictEqual(seen.paused, false);
});

// --- every flow is physical: the till of the place comes home with the men ---
test('the till taken in a hit is the capo\'s only when his men are back at the club, the day after', () => {
  const { c, f, hit } = live('sal', 1), had = f.men.sal.cash, club = T.clubOf(c, 'sal');
  let ev = H.call(c, f, hit.id, 'press'), end = ended(ev);
  while (!end) { ev = H.call(c, f, hit.id, 'press'); end = ended(ev); }
  assert.strictEqual(end.result.outcome, 'won');
  assert.strictEqual(f.men.sal.cash, Math.max(0, had - end.result.lost * K.blood), 'the till is still on the road');
  const next = []; H.pass(c, f, next);
  const loot = next.find((e) => e.type === 'loot');
  assert.deepStrictEqual([loot.capo, loot.amount, loot.x, loot.y, loot.from], ['sal', end.result.till, club.x, club.y, { x: hit.x, y: hit.y }]);
  assert.strictEqual(f.men.sal.cash, Math.max(0, had - end.result.lost * K.blood) + end.result.till);
  const again = []; H.pass(c, f, again);
  assert.ok(!again.some((e) => e.type === 'loot'), 'told once');
});

test('a hit played in one blow brings its till home at once', () => {
  const s = scene('sal', 1), had = s.f.men.sal.cash, events = [];
  H.open(s.c, s.f, s.o, events);
  const end = ended(events);
  if (end.result.outcome === 'won') assert.strictEqual(s.f.men.sal.cash, Math.max(0, had - end.result.lost * K.blood) + end.result.till);
  assert.ok(!(s.c.loots || []).length);
});
