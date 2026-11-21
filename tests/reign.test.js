// The reign: the four acts a family goes through as it grows, and the hidden director who keeps things happening.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../web/reign.js');
const E = require('../web/empire.js');
const T = require('../web/turf.js');

// --- the rank of the family ---

test('the rank of a family is what it holds of the map', () => {
  assert.strictEqual(R.rank(0).name, 'Street gang');
  assert.strictEqual(R.rank(3).name, 'Crew');
  assert.strictEqual(R.rank(12).name, 'Family');
  assert.strictEqual(R.rank(25).name, 'Syndicate');
  assert.strictEqual(R.rank(60).name, 'Commission');
});

test('a rank says how far the next one is', () => {
  const r = R.rank(6.5);
  assert.deepStrictEqual([r.n, r.next, r.from, r.to], [1, 'Family', 3, 10]);
  assert.strictEqual(r.part, 0.5);
  assert.strictEqual(R.rank(80).next, null);
  assert.strictEqual(R.rank(80).part, 1);
});

// --- the acts ---

test('there are four acts, each with a name, what it opens, what the boss watches and its threat', () => {
  assert.deepStrictEqual(R.ACTS.map((a) => a.name), ['The Street', 'The City', 'The Roads', 'The Commission']);
  R.ACTS.forEach((a) => {
    assert.ok(a.opens.length > 0, a.name + ' opens something');
    assert.ok(a.watch && a.threat, a.name + ' says what to watch and what threatens');
  });
});

test('a reign opens in the first act', () => {
  const r = R.create();
  assert.strictEqual(r.act, 0);
  assert.strictEqual(R.act(r).name, 'The Street');
  assert.strictEqual(R.act(r).numeral, 'I');
});

test('a family that becomes a Crew enters the second act, and it is told', () => {
  const r = R.create();
  assert.deepStrictEqual(R.place(r, 2.9), []);
  const told = R.place(r, 3.2);
  assert.strictEqual(r.act, 1);
  assert.strictEqual(told.length, 1);
  assert.deepStrictEqual([told[0].type, told[0].act, told[0].up, told[0].first], ['act', 1, true, true]);
  assert.match(told[0].label, /Act II: The City/);
});

test('the news of a new act says what it opens', () => {
  const r = R.create(), told = R.place(r, 4);
  assert.deepStrictEqual(told[0].opens, R.ACTS[1].opens);
  assert.ok(told[0].gives.length > 10);
});

test('the fourth act is the last: a Commission stays in it', () => {
  const r = R.create();
  R.place(r, 30);
  assert.strictEqual(r.act, 3);
  assert.deepStrictEqual(R.place(r, 55), []);
  assert.strictEqual(r.act, 3);
});

test('a family that grows fast is told one act at a time, the last one last', () => {
  const r = R.create(), told = R.place(r, 12);
  assert.deepStrictEqual(told.map((e) => e.act), [1, 2]);
});

test('an act is lost only when the family falls clearly under it', () => {
  const r = R.create();
  R.place(r, 10.5);
  assert.deepStrictEqual(R.place(r, 9.5), [], 'half a point under the line is not a fall');
  assert.strictEqual(r.act, 2);
  const told = R.place(r, 8.5);
  assert.strictEqual(r.act, 1);
  assert.deepStrictEqual([told[0].type, told[0].act, told[0].up], ['act', 1, false]);
  assert.match(told[0].label, /falls back/);
});

test('what an act opened stays open when the act is lost', () => {
  const r = R.create();
  R.place(r, 11);
  R.place(r, 1);
  assert.strictEqual(r.act, 0);
  assert.strictEqual(r.reached, 2);
  assert.ok(R.open(r, 'table'));
  assert.ok(R.open(r, 'roads'));
});

test('an act won back is not told as a first time', () => {
  const r = R.create();
  R.place(r, 4); R.place(r, 1);
  const told = R.place(r, 4);
  assert.strictEqual(told[0].first, false);
});

test('nothing of a later act is open before it', () => {
  const r = R.create();
  assert.ok(R.open(r, 'places'));
  assert.ok(!R.open(r, 'table'));
  assert.ok(!R.open(r, 'roads'));
  R.place(r, 3);
  assert.ok(R.open(r, 'table'));
  assert.ok(!R.open(r, 'roads'));
});

// --- the director ---

const calm = (more) => Object.assign({ day: 0, growing: false, cities: [{ id: 'ashport', name: 'Ashport', held: true, heat: 10, rival: 'Callahan', quiet: false }] }, more);
// days until the director does something, with nothing else happening
const until = (r, sight, most = 400) => { for (let d = 1; d <= most; d++) { const b = R.direct(r, Object.assign({}, sight, { day: d })); if (b) return { day: d, beat: b }; } return null; };

test('the director does nothing on the first days of a reign', () => {
  const r = R.create();
  for (let d = 1; d <= 20; d++) assert.strictEqual(R.direct(r, calm({ day: d })), null);
});

test('when nothing happens for long, the director makes something happen', () => {
  const got = until(R.create(), calm());
  assert.ok(got, 'something came');
  assert.ok(got.day <= R.RULES.director.wait[0][1], 'within the longest wait of the first act');
  assert.strictEqual(got.beat.type, 'beat');
  assert.ok(got.beat.label && got.beat.gives, 'it says what happens and what it brings');
});

test('the director never comes at a fixed time', () => {
  const r = R.create(), gaps = [];
  let last = 0;
  for (let d = 1; d <= 1500; d++) { if (R.direct(r, calm({ day: d }))) { gaps.push(d - last); last = d; } r.tension = 0; }
  assert.ok(gaps.length >= 6, 'it came ' + gaps.length + ' times');
  assert.ok(new Set(gaps).size >= 4, 'the waits differ: ' + gaps.join(' '));
});

test('two reigns do not tell the same story', () => {
  const kinds = (seed) => { const r = R.create(seed), out = []; for (let d = 1; d <= 1500; d++) { const b = R.direct(r, calm({ day: d })); if (b) out.push(d + b.kind); r.tension = 0; } return out.join(' '); };
  assert.notStrictEqual(kinds(1), kinds(2));
});

test('a family that stands still is given an opening', () => {
  const got = until(R.create(), calm({ growing: false }));
  assert.strictEqual(got.beat.tone, 'good');
});

test('a family that grows unopposed is put under pressure', () => {
  const got = until(R.create(), calm({ growing: true }));
  assert.strictEqual(got.beat.tone, 'bad');
});

test('a hard knock raises the tension, and the days bring it down', () => {
  const r = R.create();
  R.hear(r, [{ type: 'burnt' }]);
  const high = r.tension;
  assert.ok(high >= R.RULES.director.calm);
  for (let d = 1; d <= 10; d++) R.direct(r, calm({ day: d, growing: true }));
  assert.ok(r.tension < high);
});

test('after a hard knock the director lets the family breathe: no pressure while the tension is high', () => {
  const r = R.create();
  for (let d = 1; d <= 600; d++) {
    if (d % 20 === 0) R.hear(r, [{ type: 'burnt' }]);
    const b = R.direct(r, calm({ day: d, growing: true }));
    if (b) assert.strictEqual(b.tone, 'good', 'day ' + d + ': ' + b.kind);
  }
});

test('pressure is itself a hard knock: two never come in a row without a breath', () => {
  const r = R.create(), tones = [];
  for (let d = 1; d <= 1500; d++) { const b = R.direct(r, calm({ day: d, growing: true })); if (b) tones.push({ d, tone: b.tone }); }
  for (let i = 1; i < tones.length; i++) if (tones[i].tone === 'bad' && tones[i - 1].tone === 'bad') assert.ok(tones[i].d - tones[i - 1].d >= (R.RULES.director.knocks.beat - R.RULES.director.calm) / R.RULES.director.ease, 'pressure on days ' + tones[i - 1].d + ' and ' + tones[i].d);
  assert.ok(tones.filter((t) => t.tone === 'bad').length >= 2);
});

test('when things happen by themselves the director waits longer', () => {
  const quiet = until(R.create(), calm()).day;
  const r = R.create();
  let busy = null;
  for (let d = 1; d <= 400 && !busy; d++) { if (d % 5 === 0) R.hear(r, [{ type: 'opened' }]); if (R.direct(r, calm({ day: d }))) busy = d; }
  assert.ok(busy > quiet, 'busy ' + busy + ', quiet ' + quiet);
});

test('the later the act, the sooner the director comes back and the harder he hits', () => {
  const first = R.create(), last = R.create();
  R.place(last, 30);
  let a = 0, b = 0;
  for (let d = 1; d <= 3000; d++) { if (R.direct(first, calm({ day: d }))) a++; if (R.direct(last, calm({ day: d }))) b++; first.tension = 0; last.tension = 0; }
  assert.ok(b > a, b + ' beats in the last act, ' + a + ' in the first');
  const p1 = until(R.create(), calm({ growing: true })).beat, r4 = R.create(); R.place(r4, 30);
  let p4 = null;
  for (let d = 1; d <= 3000 && !p4; d++) { const x = R.direct(r4, calm({ day: d, growing: true })); if (x && x.kind === p1.kind) p4 = x; r4.tension = 0; }
  assert.ok(p4 && p4.size > p1.size);
});

test('the police only weigh from the second act on', () => {
  const r = R.create(), kinds = {};
  for (let d = 1; d <= 6000; d++) { const b = R.direct(r, calm({ day: d, growing: true })); if (b) kinds[b.kind] = true; r.tension = 0; }
  assert.ok(!kinds.captain, 'no police captain in the first act');
  const r2 = R.create(), kinds2 = {}; R.place(r2, 4);
  for (let d = 1; d <= 6000; d++) { const b = R.direct(r2, calm({ day: d, growing: true })); if (b) kinds2[b.kind] = true; r2.tension = 0; }
  assert.ok(kinds2.captain);
});

test('a beat happens where the family is, never in a city it does not hold', () => {
  const sight = calm({ cities: [{ id: 'a', name: 'A', held: false, heat: 0, rival: 'X' }, { id: 'b', name: 'B', held: true, heat: 0, rival: 'Y' }] });
  const r = R.create();
  for (let d = 1; d <= 2000; d++) { const b = R.direct(r, Object.assign({}, sight, { day: d, growing: d % 2 === 0 })); if (b && b.city) assert.strictEqual(b.city, 'b'); r.tension = 0; }
});

test('with nowhere to strike the director keeps quiet', () => {
  assert.strictEqual(until(R.create(), calm({ cities: [] })), null);
});

// --- in the game ---

const play = (g, days) => { const all = []; for (let i = 0; i < days; i++) { g.paused = false; all.push(...E.tick(g)); } return all; };

test('the game tells the act and the rank of the family', () => {
  const g = E.createGame({ capo: 'dutch' }), v = E.view(g);
  assert.strictEqual(v.reign.act.name, 'The Street');
  assert.strictEqual(v.reign.act.numeral, 'I');
  assert.strictEqual(v.reign.rank.name, 'Street gang');
  assert.strictEqual(v.reign.acts.length, 4);
  assert.deepStrictEqual(v.reign.acts.map((a) => a.open), [true, false, false, false]);
  assert.strictEqual(E.hud(g).act, 'I');
});

test('the view never shows the director', () => {
  const g = E.createGame({ capo: 'dutch' });
  play(g, 100);
  const text = JSON.stringify(E.view(g).reign);
  assert.ok(!/tension|wait|quiet/.test(text), text);
});

test('in a game the director makes something happen within the first three hundred days, and the journal tells it', () => {
  const g = E.createGame({ capo: 'sal' });
  const beats = play(g, 300).filter((e) => e.type === 'beat');
  assert.ok(beats.length >= 1);
  assert.ok(g.journal.some((l) => l.type === 'beat'));
  assert.ok(!/month|year/i.test(beats.map((b) => b.label + b.gives).join(' ')));
});

test('a beat does what it says', () => {
  const g = E.createGame({ capo: 'sal' }), home = g.cities[0];
  const was = { dirty: g.family.dirty, heat: home.heat || 0 };
  E.strike(g, { type: 'beat', kind: 'cargo', tone: 'good', city: home.id, size: 1 });
  assert.strictEqual(g.family.dirty, was.dirty + R.RULES.director.cargo);
  E.strike(g, { type: 'beat', kind: 'captain', tone: 'bad', city: home.id, size: 1 });
  assert.strictEqual(home.heat, was.heat + R.RULES.director.captain);
  E.strike(g, { type: 'beat', kind: 'truce', tone: 'good', city: home.id, size: 1 });
  assert.ok(home.quiet >= home.month + R.RULES.director.truce);
  E.strike(g, { type: 'beat', kind: 'blood', tone: 'bad', city: home.id, size: 1 });
  assert.ok(home.vendetta >= home.month + R.RULES.director.blood);
  assert.ok(home.quiet <= home.month, 'their truce is over');
});

test('a game saved before the reign existed picks one up', () => {
  const g = E.createGame({ capo: 'mae' });
  delete g.reign;
  const back = E.load(E.save(g));
  play(back, 30);
  assert.strictEqual(E.view(back).reign.act.numeral, 'I');
});

test('a family that holds enough of the map enters the second act in the game', () => {
  const g = E.createGame({ capo: 'dutch' });
  play(g, 24);
  g.history[g.history.length - 1].cities[g.cities[0].id].share = 30; // a fifth of the first city is 5% of the map
  const told = E.settle(g);
  assert.strictEqual(told[0].type, 'act');
  assert.strictEqual(E.view(g).reign.act.numeral, 'II');
  assert.ok(g.journal.some((l) => l.type === 'act'));
});

test('the same thing never happens twice in a row when something else could', () => {
  const r = R.create(), kinds = [];
  for (let d = 1; d <= 4000; d++) { const b = R.direct(r, calm({ day: d })); if (b) kinds.push(b.kind); r.tension = 0; }
  assert.ok(kinds.length >= 8);
  for (let i = 1; i < kinds.length; i++) assert.notStrictEqual(kinds[i], kinds[i - 1], 'beat ' + i + ' of ' + kinds.join(' '));
});

test('a capo who is turning sour may be won back by a stroke of luck, and only he', () => {
  const sight = calm({ cities: [{ id: 'ashport', name: 'Ashport', held: true, heat: 0, rival: null, sour: { id: 'sal', name: 'Sal Marino' } }] });
  const r = R.create(), kinds = {};
  let one = null;
  for (let d = 1; d <= 3000; d++) { const b = R.direct(r, Object.assign({}, sight, { day: d })); if (b) { kinds[b.kind] = true; if (b.kind === 'godson') one = b; } r.tension = 0; }
  assert.ok(one, 'it came: ' + Object.keys(kinds));
  assert.strictEqual(one.capo, 'sal');
  assert.match(one.label, /Sal/);
  const none = R.create();
  for (let d = 1; d <= 3000; d++) { const b = R.direct(none, calm({ day: d })); assert.ok(!b || b.kind !== 'godson'); none.tension = 0; }
});

test('a thief only runs off with money the family has', () => {
  const r = R.create(), kinds = {};
  for (let d = 1; d <= 6000; d++) { const b = R.direct(r, calm({ day: d, growing: true, dirty: 100 })); if (b) kinds[b.kind] = true; r.tension = 0; }
  assert.ok(!kinds.thief);
  const r2 = R.create(), kinds2 = {};
  for (let d = 1; d <= 6000; d++) { const b = R.direct(r2, calm({ day: d, growing: true, dirty: 5000 })); if (b) kinds2[b.kind] = b; r2.tension = 0; }
  assert.ok(kinds2.thief);
  assert.strictEqual(kinds2.thief.amount, R.RULES.director.thief);
});

test('a godson and a thief do what they say', () => {
  const g = E.createGame({ capo: 'sal' }), home = g.cities[0];
  const was = T.loyalty(g.family, 'sal'), had = g.family.dirty;
  E.strike(g, { type: 'beat', kind: 'godson', tone: 'good', city: home.id, capo: 'sal', size: 1 });
  assert.strictEqual(T.loyalty(g.family, 'sal'), Math.min(100, was + R.RULES.director.godson));
  E.strike(g, { type: 'beat', kind: 'thief', tone: 'bad', city: home.id, amount: 400, size: 1 });
  assert.strictEqual(g.family.dirty, had - 400);
});
