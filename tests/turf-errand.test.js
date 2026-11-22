// A capo who opens a place goes there himself, with the money: he drives from his club a block a day, and the
// place exists, and the money is spent, only the day he gets there. (A city played cycle by cycle opens at once.)
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
// plays day by day until `stop(events)` says so; returns the days played and all that was told
const play = (c, f, stop, most) => {
  const all = [];
  T.begin(f, [c]);
  for (let d = 0; d < (most || T.RULES.days); d++) { const ev = T.pass(f, [c], d); all.push(...ev.map((e) => ({ ...e, d }))); if (stop(ev)) break; }
  return all;
};
const him = (c, f) => T.view(c, f).capos.filter((k) => k.id === 'dutch')[0];

test('he sets out with the money; the place is there the day he arrives, not before', () => {
  const { c, f, club } = dutch(5000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'opened'));
  const out = all.filter((e) => e.type === 'errand')[0], done = all.filter((e) => e.type === 'opened')[0];
  assert.ok(out && done, 'he leaves, and he opens');
  const far = T.tripDays(club, out);
  assert.deepEqual([out.step, out.capo, out.city, out.from, out.move, out.kind, out.amount, out.days], ['leaves', 'dutch', c.id, { x: club.x, y: club.y }, 'open', done.kind, done.cost, far]);
  assert.deepEqual([done.x, done.y, done.d], [out.x, out.y, out.d + far]);
  assert.ok(T.at(c, done.x, done.y), 'it stands now');
});

test('while he is on his way nothing stands there, the money has left his purse, and the city says where he is going', () => {
  const { c, f } = dutch(5000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'errand'));
  const out = all.filter((e) => e.type === 'errand')[0];
  assert.ok(!T.at(c, out.x, out.y), 'nothing yet');
  assert.equal(f.men.dutch.cash < 5000 - out.amount + 100, true, 'he carries it');
  const at = him(c, f).at;
  assert.deepEqual([at.x, at.y, at.why], [out.x, out.y, 'open']);
  assert.match(at.label, /On his way to open a /);
  assert.equal(all.filter((e) => e.type === 'errand').length, 1, 'one errand at a time');
});

test('a street taken while he drove: he comes home with his money', () => {
  const { c, f } = dutch(5000);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'errand'));
  const out = all.filter((e) => e.type === 'errand')[0], had = f.men.dutch.cash;
  T.open(c, out.x, out.y, { owner: c.rival, kind: 'speakeasy' });
  const back = [];
  for (let d = out.d + 1; d <= out.d + out.days; d++) back.push(...T.pass(f, [c], d));
  const e = back.filter((q) => q.type === 'errand')[0];
  assert.deepEqual([e.step, e.x, e.y, e.amount], ['back', out.x, out.y, out.amount]);
  // (the money is his again: he may well set out with it for another street the same day)
  const again = back.filter((q) => q.type === 'errand' && q.step === 'leaves')[0];
  assert.ok(f.men.dutch.cash + (again ? again.amount : 0) >= had + out.amount - 1);
  assert.equal(T.at(c, out.x, out.y).owner, c.rival);
  assert.ok(!back.some((q) => q.type === 'opened' && q.x === out.x && q.y === out.y));
});
