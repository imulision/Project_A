// A capo is where he is: whatever he does away from his club (a place to take, a place to stand over, a quarrel,
// the rivals at his door, a key place he waits in front of), he drives there first, three days a block, and it is
// done only once he is there. When it is over he drives back to his club.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

// Dutch at his club (2, 3), a rival speakeasy at (8, 3), out of reach of any gun
const dutch = () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  f.men.dutch.cash = 0;
  T.open(c, 8, 3, { owner: c.rival || 'rival', kind: 'speakeasy' });
  return { c, f, club: T.clubOf(c, 'dutch') };
};
// cycles played day by day; stop(events, day) ends it
const play = (c, f, stop, cycles) => {
  const all = [];
  for (let n = 0; n < (cycles || 4); n++) {
    T.begin(f, [c]);
    for (let d = 0; d < T.RULES.days; d++) {
      const day = n * T.RULES.days + d, ev = T.pass(f, [c], d);
      all.push(...ev.map((e) => ({ ...e, d: day })));
      if (stop && stop(ev, day)) return all;
    }
    T.end(f, [c], []);
  }
  return all;
};
const drives = (all) => all.filter((e) => e.type === 'capo');
const him = (c, f) => T.view(c, f).capos.filter((k) => k.id === 'dutch')[0];
const take = (c) => { c.ops.push({ capo: 'dutch', x: 8, y: 3, way: 'buy', kind: 'speakeasy', cost: 100, month: c.month, months: 0, day: 0 }); };

test('sent to take a place, he drives there; the place is not his before he is', () => {
  const { c, f, club } = dutch();
  take(c);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'taken'));
  const go = drives(all)[0], there = drives(all).filter((e) => e.step === 'arrives')[0], taken = all.filter((e) => e.type === 'taken')[0];
  const far = T.tripDays(club, { x: 8, y: 3 });
  assert.deepEqual([go.step, go.capo, go.from, go.x, go.y, go.days, go.why], ['drives', 'dutch', { x: club.x, y: club.y }, 8, 3, far, 'take']);
  assert.deepEqual([there.x, there.y, there.d], [8, 3, go.d + far]);
  assert.ok(taken && taken.d >= there.d, 'taken the day he is there, not before');
});

test('on his way the city says where he drives and when he gets there', () => {
  const { c, f, club } = dutch();
  take(c);
  play(c, f, (ev) => ev.some((e) => e.type === 'capo' && e.step === 'drives'));
  const k = him(c, f);
  assert.deepEqual([k.drive.from, k.drive.x, k.drive.y, k.drive.why], [{ x: club.x, y: club.y }, 8, 3, 'take']);
  assert.ok(k.drive.until > 0);
  assert.match(k.at.label, /^On his way to /);
});

test('the place taken, he drives back to his club', () => {
  const { c, f, club } = dutch();
  take(c);
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'capo' && e.step === 'arrives' && e.why === 'home'), 8);
  const back = drives(all).filter((e) => e.step === 'drives' && e.why === 'home')[0];
  assert.ok(back, 'he drives home');
  assert.deepEqual([back.from, back.x, back.y, back.days], [{ x: 8, y: 3 }, club.x, club.y, T.tripDays({ x: 8, y: 3 }, club)]);
  const home = drives(all).filter((e) => e.step === 'arrives' && e.why === 'home')[0];
  assert.deepEqual([home.x, home.y, home.d], [club.x, club.y, back.d + back.days]);
});

test('a place he stands over makes more only once he is there', () => {
  const { c, f } = dutch();
  T.open(c, 8, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.begin(f, [c]);
  f.men.dutch.help = { x: 8, y: 2, why: 'boost', kind: 'speakeasy' }; c.push = {};
  const k = 2 * c.w + 8;
  let there = null;
  for (let d = 0; d < T.RULES.days && there === null; d++) {
    const ev = T.pass(f, [c], d);
    if (ev.some((e) => e.type === 'capo' && e.step === 'arrives')) there = d;
    else assert.ok(!c.push[k], 'day ' + d + ': not while he drives');
  }
  assert.ok(there !== null, 'he gets there');
  assert.ok(c.push[k], 'and from then on the place makes more');
});

test('away from his club, he sets out on his next move from where he is', () => {
  const { c, f } = dutch();
  f.men.dutch.pos = { city: c.id, x: 8, y: 3 };
  f.men.dutch.cash = 5000;
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'errand' && e.step === 'leaves'));
  const out = all.filter((e) => e.type === 'errand')[0];
  assert.deepEqual(out.from, { x: 8, y: 3 });
  assert.equal(out.days, T.tripDays({ x: 8, y: 3 }, out));
});

test('in the game a capo on the road is told to the screen, not written in the journal', () => {
  const E = require('../web/empire.js');
  const g = E.createGame({ capo: 'dutch' });
  let seen = 0;
  for (let i = 0; i < 6 * E.TICKS_PER_MONTH; i++) { g.paused = false; seen += E.tick(g).filter((e) => e.type === 'capo').length; }
  assert.ok(seen > 0, 'he drove');
  assert.ok(!g.journal.some((l) => l.type === 'capo'));
});

test('a key place the boss paid for is taken by the capo who asked for it, once he is there', () => {
  const { c, f, club } = dutch();
  T.open(c, 8, 4, { owner: c.rival || 'rival', kind: 'key', key: 'port' });
  c.ops.push({ capo: 'dutch', x: 8, y: 4, way: 'buy', key: 'port', kind: 'key', cost: 100, month: c.month, months: 0, day: 0 });
  const all = play(c, f, (ev) => ev.some((e) => e.type === 'taken'));
  const there = drives(all).filter((e) => e.step === 'arrives' && e.x === 8 && e.y === 4)[0], taken = all.filter((e) => e.type === 'taken')[0];
  assert.ok(there, 'he drove there');
  assert.equal(there.d, T.tripDays(club, { x: 8, y: 4 }) + drives(all).filter((e) => e.step === 'drives' && e.x === 8 && e.y === 4)[0].d);
  assert.ok(taken && taken.key === 'port' && taken.d >= there.d, 'taken once he is there');
});

test('a game opened again can draw him where he was: his drive says its days and how many are gone', () => {
  const { c, f, club } = dutch();
  take(c);
  let n = 0;
  play(c, f, (ev) => { if (f.men.dutch.drive) n++; return n === 4; });
  const d = him(c, f).drive;
  assert.deepEqual([d.from, d.days, d.gone], [{ x: club.x, y: club.y }, T.tripDays(club, { x: 8, y: 3 }), 3]);
});
