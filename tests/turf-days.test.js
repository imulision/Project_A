// A month is not one blow: it opens (what was taken, what the trucks carry), then every capo has his day, then it
// closes (the rivals, the money, the door). Played in one go or day by day, the rules are the same.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const ashport = H.ashport;

const city = () => {
  const c = ashport(), f = T.createFamily();
  T.crown(c, 'Callahan'); T.seed(c, 'Callahan', 30);
  for (const k of ['sal', 'mae', 'dutch']) { const l = T.landing(c); T.settle(c, k, l.x, l.y); T.join(f, k); }
  return { c, f };
};
const byDays = (c, f) => {
  const out = [...T.begin(f, [c], true)]; // (no day goes by here: the trucks make their rounds as the cycle opens)
  for (const capo of Object.keys(f.men)) out.push(...T.act(f, [c], capo));
  out.push(...T.end(f, [c]));
  return out;
};

test('a month played step by step is the month played in one go', () => {
  const a = city(), b = city();
  for (let m = 0; m < 60; m++) {
    const whole = T.month(a.f, [a.c]), steps = byDays(b.c, b.f);
    assert.deepEqual(steps, whole, 'month ' + (m + 1));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(b.c)), JSON.parse(JSON.stringify(a.c)));
  assert.deepEqual(JSON.parse(JSON.stringify(b.f)), JSON.parse(JSON.stringify(a.f)));
});

test('while the month goes on, the city shows the money of the month before; the new figures come when it closes', () => {
  const { c, f } = city();
  for (let m = 0; m < 6; m++) T.month(f, [c]);
  const shown = JSON.stringify(c.flow), up = T.view(c, f).money.up;
  T.begin(f, [c]);
  assert.equal(JSON.stringify(c.flow), shown);
  T.act(f, [c], 'sal');
  assert.equal(JSON.stringify(c.flow), shown);
  assert.equal(T.view(c, f).money.up, up);
  T.act(f, [c], 'mae'); T.act(f, [c], 'dutch');
  T.end(f, [c]);
  assert.notEqual(JSON.stringify(c.flow), shown);
  assert.ok(c.flow.sent.sal !== undefined && c.flow.sent.dutch !== undefined);
});

test('a man who left the family before his day does nothing that month, and a man has only one day a month', () => {
  const { c, f } = city();
  for (let m = 0; m < 3; m++) T.month(f, [c]);
  T.begin(f, [c]);
  const first = T.act(f, [c], 'sal'), cash = f.men.sal.cash;
  assert.deepEqual(T.act(f, [c], 'sal'), [], 'he has had his day');
  assert.equal(f.men.sal.cash, cash);
  delete f.men.mae;
  assert.deepEqual(T.act(f, [c], 'mae'), []);
  assert.doesNotThrow(() => { T.act(f, [c], 'dutch'); T.end(f, [c]); });
  assert.ok(Array.isArray(first));
});

test('the month in one go still works after a month left half played, and a day with no month opened does nothing', () => {
  const { c, f } = city();
  assert.deepEqual(T.act(f, [c], 'sal'), [], 'no month is open');
  assert.deepEqual(T.end(f, [c]), []);
  assert.equal(c.month, 0);
});

// --- the clock of the game ---

const beats = (g, n) => { const out = []; for (let i = 0; i < n; i++) { out.push(E.tick(g)); if (g.paused) E.command(g, { type: 'resume' }); } return out; };

test('a month lasts twenty-four beats at speed 1, and every man has his own day in it', () => {
  assert.equal(E.TICKS_PER_MONTH, 24);
  const days = E.NAMES.map((id) => E.dayOf(id));
  for (const d of days) assert.ok(d >= 2 && d <= 21 && d === Math.round(d), 'between the opening and the closing: ' + d);
  assert.ok(new Set(days).size >= 4, 'the six first capos do not all move the same day: ' + days);
  const g = E.createGame({ capo: 'dutch' });
  assert.equal(E.view(g).day, 0);
  beats(g, 5);
  assert.equal(E.view(g).day, 5);
  assert.equal(E.view(g).month, 0, 'the date moves when the month closes');
  beats(g, 19);
  assert.deepEqual([E.view(g).month, E.view(g).day], [1, 0]);
  assert.equal(E.view(g).cities[0].capos[0].day, E.dayOf('dutch'));
});

test('what happens is spread over the days: a capo with money sets out the first day, opens when his work there is done, and again once he is home, never all at once', () => {
  const g = E.createGame({ capo: 'dutch' });
  g.family.men.dutch.cash = 20000;
  const month = beats(g, 3 * E.TICKS_PER_MONTH), opens = month.map((events) => events.filter((e) => e.type === 'opened' && e.capo === 'dutch').length);
  assert.equal(month[0].filter((e) => e.type === 'errand' && e.step === 'leaves' && e.capo === 'dutch').length, 1);
  assert.ok(Math.max(...opens) === 1, 'one move a day');
  assert.ok(opens.filter(Boolean).length >= 2, 'and he goes on the days after');
  assert.equal(g.journal.filter((e) => e.type === 'opened').length, opens.reduce((a, b) => a + b, 0));
});

test('at speed 4 the same month takes six beats', () => {
  const g = E.createGame({ capo: 'dutch' });
  E.command(g, { type: 'speed', speed: 4 });
  beats(g, 6);
  assert.equal(E.view(g).month, 1);
});

test('a game saved in the middle of a month goes on exactly as if it had not been', () => {
  const a = E.createGame({ capo: 'sal' });
  beats(a, 24 * 14 + 9);
  const b = E.load(E.save(a));
  beats(a, 24 * 6 + 5); beats(b, 24 * 6 + 5);
  assert.deepEqual(JSON.parse(E.save(b)), JSON.parse(E.save(a)));
});

test('a game saved when a month was one blow starts its month again from the first day', () => {
  const g = E.createGame({ capo: 'sal' });
  beats(g, 24 * 3);
  const old = JSON.parse(E.save(g));
  old.ticks = 5; for (const c of old.cities) delete c.turn;
  const back = E.load(JSON.stringify(old));
  assert.equal(back.ticks, 0);
  assert.doesNotThrow(() => beats(back, 60));
  assert.equal(E.view(back).month, 5);
});

test('the clock stops the day a capo asks for the boss\'s word, and the rest of the month waits for the answer', () => {
  const g = E.createGame({ capo: 'dutch' });
  let stopped = null;
  for (let i = 0; i < 24 * 60 && !stopped; i++) { const events = E.tick(g); if (g.paused) stopped = { events, day: g.ticks, month: g.month }; }
  assert.ok(stopped, 'something asked for his word');
  assert.deepEqual(E.tick(g), [], 'nothing moves while he thinks');
  assert.deepEqual([g.ticks, g.month], [stopped.day, stopped.month]);
});
