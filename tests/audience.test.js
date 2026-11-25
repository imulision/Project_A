// The boss is never left long with nothing to decide: his capos come to him with a matter, each with choices whose
// price and effect are written, and each built on something the rules already know (a line, a trade to learn, a place
// a capo is saving for, the police, the rivals). A refusal is remembered; a matter left waiting goes away by itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');
const A = require('../web/audience.js');
const C = require('../web/cards.js');
const H = require('./turf-helpers.js');

const day = (g) => { g.paused = false; return E.tick(g); };
const until = (g, n, when) => { for (let i = 0; i < n; i++) { day(g); if (when(g)) return i + 1; } return 0; };
const matter = (g) => E.view(g).matters[0] || null;
const text = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const settle = (g) => { for (let i = 0; i < 400 && E.view(g).paying.length; i++) day(g); };

test('in the first minute the first capo asks the boss how he wants the city run, and the clock stops', () => {
  const g = E.createGame({ capo: 'sal' });
  let told = null;
  for (let i = 0; i < A.RULES.first + 2 && !told; i++) told = E.tick(g).filter((e) => e.type === 'matter')[0];
  assert.ok(told, 'he comes within ' + A.RULES.first + ' days');
  assert.ok(A.RULES.first <= 30);
  assert.equal(g.paused, true);
  assert.equal(E.hud(g).pending, 1);
  const m = matter(g);
  assert.equal(m.kind, 'line'); assert.equal(m.capo, 'sal'); assert.equal(m.city, 'ashport');
  assert.deepEqual(m.choices.map((c) => c.id), ['grow', 'earn', 'low', 'none']);
  m.choices.slice(0, 3).forEach((c) => { assert.ok(c.gives, c.id + ' says what it brings'); assert.ok(c.costs, c.id + ' says what it costs'); });
  E.command(g, { type: 'decide', id: m.id, choice: 'earn' });
  assert.equal(g.cities[0].line, 'earn');
  assert.equal(matter(g), null);
  assert.equal(E.hud(g).pending, 0);
  assert.match(g.journal[g.journal.length - 1].label, /Earn/);
});

test('the card of a matter shows every choice with its price, and shuts the one the boss cannot pay', () => {
  const m = { id: 'captain:ashport:40', kind: 'captain', capo: 'sal', city: 'ashport', title: 'A captain of the police has a price', says: 'He looks away for a while.',
    choices: [{ id: 'pay', label: 'Pay him', gives: 'The heat falls by 25', cost: 900, money: 'dirty' }, { id: 'no', label: 'Send him away', gives: 'You keep your money' }] };
  const view = { cities: [], matters: [m] };
  const poor = C.requests(view, { dirty: 100, clean: 5000 }), rich = C.requests(view, { dirty: 2000, clean: 0 });
  assert.match(text(rich), /A captain of the police has a price/);
  assert.match(text(rich), /\$900/); assert.match(text(rich), /The heat falls by 25/);
  assert.match(rich, /class="card ask matter"/);
  assert.match(rich, /data-act="decide" data-id="captain:ashport:40" data-choice="pay"/);
  assert.match(poor, /data-choice="pay"[^>]*disabled/);
  assert.doesNotMatch(rich, /data-choice="pay"[^>]*disabled/);
  assert.doesNotMatch(poor, /data-choice="no"[^>]*disabled/);
});

test('a boss who answers is asked something at least every two minutes, for years', () => {
  ['sal', 'mae'].forEach((id) => {
    const g = E.createGame({ capo: id });
    let last = 0, worst = 0, stops = 0; const kinds = {};
    for (let d = 1; d <= 1500; d++) {
      day(g);
      if (!g.paused) continue;
      stops++; worst = Math.max(worst, d - last); last = d;
      const v = E.view(g), purse = E.hud(g).dirty + E.hud(g).clean;
      v.matters.forEach((m) => { kinds[m.kind] = (kinds[m.kind] || 0) + 1; const c = m.choices.filter((q) => !q.cost || q.cost <= (q.money === 'clean' ? E.hud(g).clean : E.hud(g).dirty))[0]; E.command(g, { type: 'decide', id: m.id, choice: c.id }); });
      v.cities.forEach((c) => {
        c.asks.forEach((a) => { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: a.cost <= purse }); } catch (e) { /* its money is on its way */ } });
        c.feuds.forEach((f) => E.command(g, { type: 'rule', city: c.id, id: f.id, winner: f.a }));
      });
    }
    assert.ok(worst <= 2 * A.RULES.every, id + ': never more than ' + 2 * A.RULES.every + ' days without a word to give (' + worst + ')');
    assert.ok(stops >= 12, id + ': ' + stops + ' stops in 1500 days');
    assert.ok(Object.keys(kinds).length >= 4, id + ': matters of several kinds (' + Object.keys(kinds).join(', ') + ')');
  });
});

test('a matter left waiting goes away by itself, and nothing has changed', () => {
  const g = E.createGame({ capo: 'dutch' });
  until(g, 40, () => matter(g));
  const m = matter(g); assert.ok(m);
  const before = JSON.stringify([g.family.dirty > 0, g.cities[0].line || null]);
  for (let i = 0; i < A.RULES.stale + 2; i++) day(g);
  assert.ok(!matter(g) || matter(g).id !== m.id, 'he no longer waits');
  assert.equal(JSON.stringify([g.family.dirty > 0, g.cities[0].line || null]), before);
  assert.throws(() => E.command(g, { type: 'decide', id: m.id, choice: 'earn' }), /nobody is asking that any more/);
});

test('a capo who wants a trade the family can pay to learn comes to ask for it, and a no is remembered for a year', () => {
  const g = E.createGame({ capo: 'sal' });
  until(g, 40, () => matter(g)); E.command(g, { type: 'decide', id: matter(g).id, choice: 'none' });
  g.family.clean = 1500;
  assert.ok(until(g, A.RULES.soon + 3, () => matter(g)), 'he asks soon after the money is there');
  const m = matter(g);
  assert.equal(m.kind, 'learn'); assert.equal(m.capo, 'sal'); assert.equal(m.trade, 'loans');
  assert.match(m.title, /Sal wants to open a loan office/);
  const learn = m.choices[0];
  assert.deepEqual([learn.id, learn.cost, learn.money], ['learn', 1000, 'clean']);
  // no: not asked again for a year, whatever else comes up
  E.command(g, { type: 'decide', id: m.id, choice: 'no' });
  g.family.clean = 1500;
  for (let i = 0; i < A.RULES.again - 5; i++) { day(g); const q = matter(g); if (q) { assert.notEqual(q.kind, 'learn', 'day ' + i); E.command(g, { type: 'decide', id: q.id, choice: q.choices[q.choices.length - 1].id }); } }
  // yes: the family pays and learns
  g.family.clean = 1500;
  assert.ok(until(g, 2 * A.RULES.every, () => matter(g) && matter(g).kind === 'learn'), 'a year on he asks again');
  E.command(g, { type: 'decide', id: matter(g).id, choice: 'learn' });
  settle(g);
  assert.ok(E.view(g).tree.filter((t) => t.kind === 'loans')[0].studying > 0, 'the family is learning it');
});

test('a capo short of money for his next place asks the boss to put in the rest, out of the dirty cash', () => {
  const g = E.createGame({ capo: 'dutch' }), f = g.family, c = g.cities[0];
  until(g, 40, () => matter(g)); E.command(g, { type: 'decide', id: matter(g).id, choice: 'none' });
  f.dirty = 5000;
  let m = null;
  for (let i = 0; i < 3 * A.RULES.every && !m; i++) { f.men.dutch.cash = Math.min(f.men.dutch.cash, 150); day(g); const q = matter(g); if (q && q.kind === 'advance') m = q; else if (q) E.command(g, { type: 'decide', id: q.id, choice: q.choices[q.choices.length - 1].id }); }
  assert.ok(m, 'he asks');
  const p = T.plan(c, f, 'dutch'), short = Math.round(p.cost - p.saved);
  assert.equal(p.waiting, 'money');
  assert.deepEqual([m.choices[0].id, m.choices[0].cost, m.choices[0].money], ['pay', short, 'dirty']);
  const had = f.dirty;
  E.command(g, { type: 'decide', id: m.id, choice: 'pay' });
  assert.equal(Math.round(had - f.dirty), short, 'the boss pays what he is short of');
  assert.notEqual(T.plan(c, f, 'dutch').waiting, 'money', 'and he has the price of it');
  assert.match(g.journal[g.journal.length - 1].label, /You put \$[\d,]+ into Dutch's/);
});

test('a boss who cannot pay a choice cannot take it', () => {
  const g = E.createGame({ capo: 'sal' });
  g.audience = { last: 0, seen: {}, open: { id: 'x', kind: 'captain', city: 'ashport', capo: 'sal', since: 0, choices: [{ id: 'pay', cost: 99999, money: 'dirty' }, { id: 'no' }] } };
  assert.throws(() => E.command(g, { type: 'decide', id: 'x', choice: 'pay' }), /it takes \$99,999 of dirty cash/);
  E.command(g, { type: 'decide', id: 'x', choice: 'no' });
  assert.equal(matter(g), null);
});

test('a man left waiting at the door does not keep the capos away from the boss', () => {
  const g = E.createGame({ capo: 'dutch' }), c = g.cities[0];
  until(g, 40, () => matter(g)); E.command(g, { type: 'decide', id: matter(g).id, choice: 'none' });
  c.burnt = 99; g.family.dirty = 50000;
  assert.ok(T.doors(c, g.family).length, 'a man is at the door');
  assert.ok(until(g, A.RULES.every + 5, () => matter(g)), 'a matter comes all the same');
});

test('an old saved game has no matter open, and plays on', () => {
  const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < 60; i++) day(g);
  const raw = JSON.parse(E.save(g)); delete raw.audience;
  const old = E.load(JSON.stringify(raw));
  assert.deepEqual(E.view(old).matters, []);
  for (let i = 0; i < 300; i++) day(old);
});

// --- what comes back too often ---
test('a capo short of next to nothing does not go to the boss for it', () => {
  const c = H.town(), f = H.family({ dirty: 0, clean: 0 });
  T.settle(c, 'sal', 0, 0); T.join(f, 'sal');
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) T.open(c, x, y, { owner: 'family', kind: 'loans', capo: 'sal', level: 3 });
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
  f.men.sal.rank = 3; c.rival = 'Callahan'; c.quiet = 999;
  const told = [];
  for (let i = 0; i < T.RULES.patience.months + 2; i++) { const p = T.plan(c, f, 'sal'); f.men.sal.cash = Math.min(f.men.sal.cash, p.cost * (1 - T.RULES.patience.petty / 2)); told.push(...T.stepMonth(c, f)); }
  assert.ok(!told.some((e) => e.type === 'asks'), 'a twentieth of the price: he waits for it');
});

test('a key place refused rests twice as long each time', () => {
  const { c, f } = H.siege();
  T.open(c, 9, 4, { owner: 'family', kind: 'loans', capo: 'sal' }); T.open(c, 10, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
  const asked = () => { for (let i = 0; i < 400; i++) { T.stepMonth(c, f); if (T.asks(c).some((a) => a.key === 'brewery')) return c.month; } return -1; };
  const first = asked(); assert.ok(first >= 0);
  T.answer(c, f, T.asks(c)[0].id, false);
  const second = asked(); assert.ok(second - first >= T.RULES.sulk && second - first < T.RULES.sulk + 3, 'once: ' + (second - first));
  T.answer(c, f, T.asks(c)[0].id, false);
  const third = asked(); assert.ok(third - second >= 2 * T.RULES.sulk, 'twice: ' + (third - second));
});

test('a man of the rivals the boss is paying for stays at the door until the money is there', () => {
  const g = E.createGame({ capo: 'dutch' }), c = g.cities[0], f = g.family;
  const lt = T.view(c, f).lieutenants[0];
  assert.ok(lt, 'the rivals have a lieutenant');
  const at = () => T.doors(c, f).some((d) => d.capo === lt.id && d.door === 'poach');
  assert.equal(at(), false, 'he does not listen to a family that weighs nothing');
  f.promised = { [lt.id]: true };
  assert.equal(at(), true, 'his word is given');
});

test('an ask the boss cannot pay does not stop the clock; the day he can, he is told', () => {
  const g = E.createGame({ capo: 'sal' }), c = g.cities[0];
  until(g, 40, () => matter(g)); E.command(g, { type: 'decide', id: matter(g).id, choice: 'none' });
  for (let i = 0; i < 30; i++) day(g);
  g.family.dirty = 0; g.family.clean = 0;
  const club = T.clubOf(c, 'sal');
  c.asks.push({ id: 'ashport:key:test', capo: 'sal', key: 'port', x: club.x, y: club.y, way: 'force', cost: 50000, months: 8, why: '' });
  g.paused = false; E.tick(g);
  assert.equal(E.hud(g).pending, 0, 'it does not count as waiting for his word');
  assert.equal(E.view(g).cities[0].asks.length, 1, 'it is on the sheet all the same');
  for (let i = 0; i < 25; i++) { day(g); g.family.dirty = Math.min(g.family.dirty, 100); }
  g.family.dirty = 60000;
  let told = null;
  for (let i = 0; i < 30 && !told; i++) { g.paused = false; told = E.tick(g).filter((e) => e.type === 'asks' && e.ready)[0]; }
  assert.ok(told, 'the day he can pay he is told');
  assert.equal(g.paused, true);
  assert.equal(E.hud(g).pending, 1);
});
