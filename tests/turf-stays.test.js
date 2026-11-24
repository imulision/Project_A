// A capo stays where his move is made for as long as it takes: he drives there with the money, works there the
// days of the move (RULES.work), and the place stands, is bigger or is turned only the day the work is done. He
// then drives back to his club, and makes no other move until he is home.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const dutch = (cash) => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  f.men.dutch.cash = cash;
  return { c, f, club: T.clubOf(c, 'dutch') };
};
// plays day by day, cycle after cycle, until `stop(events)` says so
const play = (c, f, stop, most) => {
  const all = [];
  for (let n = 0; n < (most || 4); n++) {
    T.begin(f, [c]);
    for (let d = 0; d < T.RULES.days; d++) {
      const day = n * T.RULES.days + d, ev = T.pass(f, [c], d);
      all.push(...ev.map((e) => ({ ...e, d: day })));
      if (stop(ev, day)) return all;
      if (T.dayOf('dutch') === d) all.push(...T.act(f, [c], 'dutch').map((e) => ({ ...e, d: day })));
    }
    T.end(f, [c], []);
  }
  return all;
};
const him = (c, f) => T.view(c, f).capos.filter((k) => k.id === 'dutch')[0];
const step = (all, s) => all.filter((e) => e.type === 'errand' && e.step === s)[0];

test('the days of work a move takes on the spot', () => {
  assert.deepEqual(T.RULES.work, { open: 4, enlarge: 3, convert: 3 });
});

test('he arrives, works there the days of the move, and the place stands the day the work is done', () => {
  const { c, f } = dutch(5000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'opened'));
  const out = step(all, 'leaves'), works = step(all, 'works'), done = all.filter((e) => e.type === 'opened')[0];
  assert.ok(out && works && done);
  assert.deepEqual([works.capo, works.x, works.y, works.move, works.kind, works.days, works.d], ['dutch', out.x, out.y, 'open', out.kind, T.RULES.work.open, out.d + out.days]);
  assert.equal(done.d, works.d + T.RULES.work.open);
  assert.deepEqual([done.x, done.y], [out.x, out.y]);
});

test('while he works nothing stands there yet, and the city says he is there, opening it', () => {
  const { c, f } = dutch(5000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'errand' && e.step === 'works'));
  const works = step(all, 'works');
  assert.ok(!T.at(c, works.x, works.y), 'not yet');
  const k = him(c, f);
  assert.deepEqual([k.at.x, k.at.y, k.at.why], [works.x, works.y, 'open']);
  assert.match(k.at.label, /^Opening a /);
  assert.deepEqual([k.errand.step, k.errand.x, k.errand.y, k.errand.until], ['works', works.x, works.y, works.until]);
});

test('the work done, he drives back to his club, and makes no other move before he is home', () => {
  const { c, f, club } = dutch(50000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'errand' && e.step === 'home'));
  const done = all.filter((e) => e.type === 'opened')[0], back = step(all, 'returns'), home = step(all, 'home');
  assert.ok(back && home, 'he drives back, and is home');
  const far = T.tripDays(done, club);
  assert.deepEqual([back.d, back.from, back.x, back.y, back.days], [done.d, { x: done.x, y: done.y }, club.x, club.y, far]);
  assert.equal(home.d, back.d + far);
  assert.equal(all.filter((e) => e.type === 'errand' && e.step === 'leaves' && e.d < home.d).length, 1, 'rich as he is, one move at a time');
});

test('on his way back the city says he is driving home', () => {
  const { c, f, club } = dutch(5000);
  play(c, f, (ev) => ev.some((e) => e.type === 'errand' && e.step === 'returns'));
  const k = him(c, f);
  assert.deepEqual([k.at.x, k.at.y, k.at.why], [club.x, club.y, 'return']);
  assert.match(k.at.label, /^Driving back to his club/);
  assert.equal(k.errand.step, 'returns');
});

test('a street taken while he drove there: he does not work, and drives home with his money', () => {
  const { c, f, club } = dutch(5000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'errand'));
  const out = step(all, 'leaves');
  T.open(c, out.x, out.y, { owner: c.rival, kind: 'speakeasy' });
  const rest = play(c, f, (ev) => ev.some((e) => e.type === 'errand' && e.step === 'home'));
  const turned = step(rest, 'back'), back = step(rest, 'returns');
  assert.deepEqual([turned.x, turned.y, turned.amount], [out.x, out.y, out.amount]);
  assert.ok(!step(rest, 'works'));
  assert.deepEqual([back.x, back.y], [club.x, club.y]);
  assert.equal(T.at(c, out.x, out.y).owner, c.rival);
});

test('a game opened again can draw his errand: where from, its days and how many are gone, there and back', () => {
  const { c, f, club } = dutch(5000);
  let n = 0, out = null, back = null;
  play(c, f, (ev) => {
    if (f.men.dutch.errand) n++;
    if (n === 2 && !out) out = him(c, f).errand;
    if (ev.some((e) => e.type === 'errand' && e.step === 'returns')) back = him(c, f).errand;
    return back;
  });
  assert.deepEqual([out.step, out.from, out.days, out.gone], ['leaves', { x: club.x, y: club.y }, T.tripDays(club, out), 1]);
  assert.deepEqual([back.step, back.from, back.to, back.days, back.gone], ['returns', { x: out.x, y: out.y }, { x: club.x, y: club.y }, T.tripDays(out, club), 0]);
});
