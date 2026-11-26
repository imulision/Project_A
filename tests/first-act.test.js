// The first act is short and full: a man who arrives opens his first places in the first minute, the capos come to
// the boss more often while the family is a street gang, a hard man asks to go for the gang next door (a live hit in
// the first minutes), and the boss can let the days run until something happens.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');
const A = require('../web/audience.js');

const day = (g) => { g.paused = false; return E.tick(g); };
// A boss who answers: the first choice he can pay, yes to every ask, every man at the door taken in.
function answer(g) {
  const v = E.view(g), tryIt = (o) => { try { E.command(g, o); } catch (e) { /* cannot today */ } };
  v.matters.forEach((m) => { const h = E.hud(g), c = m.choices.filter((q) => !q.cost || q.cost <= (q.money === 'clean' ? h.clean : h.dirty))[0] || m.choices[m.choices.length - 1]; tryIt({ type: 'decide', id: m.id, choice: c.id }); });
  v.cities.forEach((c) => {
    c.asks.forEach((a) => tryIt({ type: 'answer', city: c.id, id: a.id, yes: true }));
    c.feuds.forEach((f) => tryIt({ type: 'rule', city: c.id, id: f.id, winner: f.a }));
    c.doors.forEach((q) => tryIt({ type: 'welcome', from: c.id, city: c.id, capo: q.capo }));
    (c.hits || []).forEach((h) => tryIt({ type: 'call', city: c.id, id: h.id, call: 'press' }));
  });
}

test('a man who arrives opens two places in his first minute, whoever he is', () => {
  E.NAMES.forEach((id) => {
    const g = E.createGame({ capo: id, quiet: true });
    let opened = 0;
    for (let d = 0; d < 60; d++) opened += day(g).filter((e) => e.type === 'opened').length;
    assert.ok(opened >= 2, id + ' opened ' + opened);
  });
});

test('while the family is a street gang, a capo comes to the boss at least every minute', () => {
  assert.ok(A.RULES.early <= 60 && A.RULES.early < A.RULES.every);
  const g = E.createGame({ capo: 'dutch' });
  let last = 0, worst = 0, stops = 0;
  for (let d = 1; d <= 400 && E.view(g).reign.rank.n === 0; d++) {
    day(g);
    if (!g.paused) continue;
    stops++; worst = Math.max(worst, d - last); last = d;
    answer(g);
  }
  assert.ok(stops >= 6, stops + ' stops in the first 400 days');
  assert.ok(worst <= 60, 'longest wait: ' + worst + ' days');
});

test('a boss who answers leaves the street behind within fourteen minutes, with any first man', () => {
  E.NAMES.forEach((id) => {
    const g = E.createGame({ capo: id });
    let at = null;
    for (let d = 1; d <= 840 && at === null; d++) { day(g); if (g.paused) answer(g); if (E.view(g).reign.rank.n >= 1) at = d; }
    assert.ok(at !== null, id + ' is still a street gang after 840 days, at ' + E.view(g).reign.share + '%');
  });
});

test('a hard man asks to go for the gang next door in the first three minutes: a yes is a live hit within the month', () => {
  const g = E.createGame({ capo: 'sal' });
  let m = null;
  for (let d = 1; d <= 180 && !m; d++) { day(g); if (!g.paused) continue; m = E.view(g).matters.filter((q) => q.kind === 'nextdoor')[0] || null; if (!m) answer(g); }
  assert.ok(m, 'Sal asks for the place next door');
  assert.equal(m.capo, 'sal');
  assert.deepEqual(m.choices.map((c) => c.id), ['go', 'no']);
  assert.match(m.says, /\d+ men/); // his men against theirs are written
  assert.ok(m.choices[0].cost > 0 && m.choices[0].money === 'dirty');
  const before = E.hud(g).dirty;
  E.command(g, { type: 'decide', id: m.id, choice: 'go' });
  assert.equal(E.hud(g).dirty, before - m.choices[0].cost);
  let hit = null;
  for (let d = 0; d < 2 * T.RULES.days + 12 && !hit; d++) hit = day(g).filter((e) => e.type === 'hit' && e.step === 'start')[0] || null;
  assert.ok(hit, 'his men hit the place');
  assert.equal(hit.capo, 'sal'); assert.equal(hit.x, m.x); assert.equal(hit.y, m.y);
});

test('a man who refuses to seize never asks for the place next door', () => {
  const g = E.createGame({ capo: 'mae', quiet: true });
  for (let d = 0; d < 100; d++) day(g);
  assert.equal(T.prey(g.cities[0], g.family, 'mae'), null);
  assert.ok(T.prey(E.createGame({ capo: 'sal', quiet: true }).cities[0], { men: { sal: { rank: 0 } }, tech: {} }, 'sal') !== undefined);
});

test('told no, a proud man loses face, and does not ask again for a year', () => {
  const g = E.createGame({ capo: 'sal' });
  let m = null;
  for (let d = 1; d <= 180 && !m; d++) { day(g); if (!g.paused) continue; m = E.view(g).matters.filter((q) => q.kind === 'nextdoor')[0] || null; if (!m) answer(g); }
  const was = T.loyalty(g.family, 'sal');
  assert.match(m.choices[1].costs, /Loyalty/);
  E.command(g, { type: 'decide', id: m.id, choice: 'no' });
  assert.ok(T.loyalty(g.family, 'sal') < was);
  let again = 0;
  for (let d = 0; d < 250; d++) { day(g); if (g.paused) { again += E.view(g).matters.filter((q) => q.kind === 'nextdoor').length; answer(g); } }
  assert.equal(again, 0);
});

test('the boss lets the days run until something happens: the clock stops skipping on the first news', () => {
  const g = E.createGame({ capo: 'sal', quiet: true });
  for (let d = 0; d < 30; d++) day(g);
  const t0 = g.month * E.TICKS_PER_MONTH + g.ticks;
  E.command(g, { type: 'skip' });
  assert.equal(E.hud(g).skipping, true);
  let beats = 0, news = [];
  while (E.hud(g).skipping && beats < 100) { const ev = E.tick(g); beats++; news = ev.filter(E.isNews); }
  const gone = g.month * E.TICKS_PER_MONTH + g.ticks - t0;
  assert.equal(E.hud(g).skipping, false);
  assert.ok(news.length >= 1, 'it stopped on a piece of news');
  assert.ok(gone > beats, gone + ' days in ' + beats + ' beats: faster than one day a beat');
  assert.ok(gone / beats <= E.SKIP, 'never more than ' + E.SKIP + ' days a beat');
  // and one beat later the clock runs at its own speed again
  const t1 = g.month * E.TICKS_PER_MONTH + g.ticks;
  E.tick(g);
  assert.equal(g.month * E.TICKS_PER_MONTH + g.ticks - t1, g.paused ? 0 : g.speed);
});

test('skipping stops when the boss is needed, and a pause ends it', () => {
  const g = E.createGame({ capo: 'sal' });
  E.command(g, { type: 'skip' });
  for (let i = 0; i < 50 && !g.paused; i++) E.tick(g);
  assert.equal(g.paused, true);
  assert.equal(E.hud(g).skipping, false);
  E.command(g, { type: 'resume' }); E.command(g, { type: 'skip' }); E.command(g, { type: 'pause' });
  assert.equal(E.hud(g).skipping, false);
});

test('a capo who opens a place next to the headquarters holds no grudge against it', () => {
  const g = E.createGame({ capo: 'danny', quiet: true });
  for (let d = 0; d < 600; d++) day(g);
  Object.keys(g.cities[0].grudge || {}).forEach((k) => k.split('|').forEach((id) => assert.ok(T.person(id), 'a grudge with nobody: ' + k)));
});

test('whatever the deal, the first man has streets to open on, and no rival place on his doorstep', () => {
  [0, 1, 2, 3, 4, 5, 6, 7].forEach((seed) => {
    const g = E.createGame(seed ? { seed, capo: 'mae', quiet: true } : { capo: 'mae', quiet: true }), c = g.cities[0], club = T.clubOf(c, 'mae');
    assert.ok(T.frontier(c, 'mae').length >= 6, 'deal ' + seed + ': ' + T.frontier(c, 'mae').length + ' streets to open on');
    T.places(c).forEach((p) => { if (p.owner !== 'family' && p.kind !== 'key' && p.kind !== 'hq') assert.ok(Math.max(Math.abs(p.x - club.x), Math.abs(p.y - club.y)) > T.RULES.room.clear, 'deal ' + seed + ': a rival place at ' + p.x + ',' + p.y); });
  });
});

test('a man his mentor vouched for waits for the boss\'s money, even if the mentor loses a place meanwhile', () => {
  const g = E.createGame({ capo: 'dutch', quiet: true }), c = g.cities[0];
  let knock = null;
  for (let i = 0; i < 2000 && !knock; i++) { g.paused = false; knock = E.tick(g).find((e) => e.type === 'knocks' && e.door === 'rise') || null; }
  assert.ok(knock, 'a man rises');
  g.family.dirty = 50000;
  E.command(g, { type: 'welcome', city: 'ashport', from: 'ashport', capo: knock.capo });
  // the rivals burn one of his mentor's places while the money is on its way
  const lost = T.places(c, 'dutch').filter((p) => p.kind !== 'club')[0];
  delete c.blocks[lost.x + ',' + lost.y]; T.touch(c);
  assert.ok(T.doors(c, g.family).some((d) => d.capo === knock.capo), 'he is still at the door');
  for (let i = 0; i < 200 && E.view(g).paying.length; i++) { g.paused = false; E.tick(g); }
  assert.ok(g.family.men[knock.capo], 'and he is taken in when the money arrives');
});
