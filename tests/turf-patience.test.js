// A capo does not save for years for a place he cannot afford: after a year he asks the boss for the rest, or turns to something else.
// And a man is brought in as soon as his capo runs six places.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
// what the boss pays travels: play on until his van has delivered it and the order is carried out
const settle = (g) => { for (let i = 0; i < 400 && E.view(g).paying.length; i++) { g.paused = false; E.tick(g); } };
const town = H.town, family = H.family, year = H.year;
const ALL = () => { const t = {}; for (const k of Object.keys(D.SITES)) t[k] = 3; return t; };

// Sal with every block around him his own, and nothing left to go for but the Callahans' bars. He has no money to speak of.
const hemmed = () => {
  const c = town(), f = family({ dirty: 0, clean: 0 });
  T.settle(c, 'sal', 0, 0); T.join(f, 'sal');
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) T.open(c, x, y, { owner: 'family', kind: 'loans', capo: 'sal', level: 3 });
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
  f.men.sal.rank = 3; c.rival = 'Callahan'; c.quiet = 999; // (the rivals leave him alone: this is about his purse)
  return { c, f };
};
// The months go by with Sal kept poor: he never has the price of the place.
const poor = (c, f, n) => { const out = []; for (let i = 0; i < n; i++) { f.men.sal.cash = Math.min(f.men.sal.cash, 300); out.push(...T.stepMonth(c, f)); } return out; };

test('a year saving for the same place without getting there: the capo asks the boss for the rest', () => {
  const { c, f } = hemmed(), aim = T.plan(c, f, 'sal');
  assert.deepEqual([aim.move, aim.waiting], ['take', 'money']);
  const before = poor(c, f, T.RULES.patience.months - 1);
  assert.ok(!before.some((e) => e.type === 'asks'), 'not before a year');
  assert.deepEqual(T.asks(c), []);
  const told = poor(c, f, 2).filter((e) => e.type === 'asks');
  assert.equal(told.length, 1);
  const a = T.asks(c)[0], p = T.plan(c, f, 'sal');
  assert.deepEqual([a.capo, a.kind, a.x, a.y, a.way], ['sal', 'fund', p.x, p.y, 'force']);
  assert.equal(a.cost, Math.round(p.cost - p.saved), 'he asks for what he is short of');
  assert.equal(a.name, 'Callahans\' speakeasy');
  assert.equal(a.key, p.kind, '(the trade he would run there, for the picture)');
  assert.equal(a.gives, 'One more place for Sal, on streets the Callahans hold');
  assert.equal(a.why, 'he has saved ' + T.dollars(p.saved) + ' of the ' + T.dollars(p.cost) + ' it takes, and ' + T.days(12) + ' have gone by');
  assert.deepEqual([told[0].capo, told[0].fund, told[0].x, told[0].y, told[0].cost], ['sal', true, a.x, a.y, a.cost]);
  assert.equal(told[0].label, 'Sal asks you for $' + a.cost + ' to take the Callahans\' speakeasy in Lantern Row');
  assert.equal(poor(c, f, 6).filter((e) => e.type === 'asks').length, 0, 'asked once');
});

test('the boss pays the rest: the capo puts in what he had saved and his men set out', () => {
  const { c, f } = hemmed();
  poor(c, f, T.RULES.patience.months + 1);
  const a = T.asks(c)[0], had = f.men.sal.cash;
  f.dirty = 20000;
  T.answer(c, f, a.id, true);
  assert.equal(f.dirty, 20000 - a.cost);
  assert.ok(f.men.sal.cash < had || had === 0, 'his own savings go into it');
  assert.deepEqual(T.asks(c), []);
  assert.equal(T.takes(c).length, 1);
  assert.deepEqual([T.takes(c)[0].capo, T.takes(c)[0].x, T.takes(c)[0].y], ['sal', a.x, a.y]);
  year(c, f, T.RULES.take.force.months + 1);
  assert.equal(T.at(c, a.x, a.y).owner, 'family', 'the place is taken');
});

test('the boss says no: the capo lets that place go for years, and holds it against him a little', () => {
  const { c, f } = hemmed();
  poor(c, f, T.RULES.patience.months + 1);
  const a = T.asks(c)[0], was = T.loyalty(f, 'sal');
  T.answer(c, f, a.id, false);
  assert.ok(T.loyalty(f, 'sal') < was);
  assert.deepEqual(T.asks(c), []);
  const p = T.plan(c, f, 'sal');
  assert.ok(p.x !== a.x || p.y !== a.y, 'he looks elsewhere');
  const later = poor(c, f, T.RULES.patience.sore - 2);
  assert.ok(!later.some((e) => e.type === 'asks' && e.x === a.x && e.y === a.y), 'he does not ask for that one again for years');
});

test('a boss who cannot pay is asked all the same: the news says what it would take', () => {
  const { c, f } = hemmed();
  poor(c, f, T.RULES.patience.months + 1);
  const a = T.asks(c)[0];
  f.dirty = 0; f.clean = 0;
  assert.throws(() => T.answer(c, f, a.id, true), /the boss cannot pay the \$\d+ Sal is short of/);
  assert.equal(T.asks(c).length, 1);
});

test('a year saving to make a place bigger without getting there: he gives it up and turns to the next thing', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'sal', 0, 0); T.join(f, 'sal'); c.quiet = 999;
  // he runs all a soldier can, and nothing around him is the rivals'
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1]]) T.open(c, x, y, { owner: 'family', kind: 'loans', capo: 'sal', level: 1 });
  const aim = T.plan(c, f, 'sal');
  assert.equal(aim.move, 'enlarge');
  const events = poor(c, f, T.RULES.patience.months + 1), gave = events.filter((e) => e.type === 'gaveup');
  assert.equal(gave.length, 1);
  assert.deepEqual([gave[0].capo, gave[0].move, gave[0].x, gave[0].y], ['sal', 'enlarge', aim.x, aim.y]);
  assert.equal(gave[0].label, 'Sal gives up making his loan office bigger in Lantern Row: too dear for him');
  const next = T.plan(c, f, 'sal');
  assert.ok(next.x !== aim.x || next.y !== aim.y, 'another place');
  assert.deepEqual(T.asks(c), [], 'the boss is not asked for that');
});

test('a capo who gets what he was saving for starts counting again', () => {
  const { c, f } = hemmed();
  poor(c, f, 6);
  f.men.sal.cash = 50000;
  const moved = T.stepMonth(c, f);
  assert.ok(moved.some((e) => e.type === 'moving'));
  assert.ok(!poor(c, f, 8).some((e) => e.type === 'asks'), 'the count started again');
});

// --- new men ---

test('a capo brings his man in once he runs six places, whatever his rank', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 0, 0); T.join(f, 'dutch'); f.men.dutch.rank = 3;
  assert.equal(T.RULES.vouch, 6);
  for (const [x, y] of [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]]) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.ok(!T.doors(c, f).some((d) => d.door === 'rise'), 'five places: not yet');
  T.open(c, 2, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  const d = T.doors(c, f).find((q) => q.door === 'rise');
  assert.deepEqual([d.capo, d.by], ['otto', 'dutch']);
  assert.equal(d.why, 'Dutch runs six places and vouches for him');
});

test('the trouble "nobody new" counts against six places too', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch'); f.men.dutch.rank = 3; c.month = 40;
  assert.equal(T.stalls(c, f).find((s) => s.id === 'nobody').why, 'A capo brings a man in when he runs six places: Dutch runs 0');
});

// --- the whole game ---

test('twenty years of a boss who says yes and has the family learn what his capos ask for: it is no longer stuck at three men', () => {
  let funded = 0;
  for (const start of ['dutch', 'sal']) {
    const g = E.createGame({ capo: start }), seen = { asks: 0, fund: 0 };
    for (let m = 1; m <= 240; m++) {
      for (let i = 0; i < E.TICKS_PER_MONTH; i++) { g.paused = false; for (const e of E.tick(g)) if (e.type === 'asks') { seen.asks++; if (e.fund) seen.fund++; } }
      for (const c of E.view(g).cities) {
        for (const a of c.asks) { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: true }); } catch (e) { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } }
        for (const w of c.wishes) { try { E.command(g, { type: 'research', building: w.kind }); } catch (e) { /* not the money yet, or already learning */ } }
        for (const d of c.doors) {
          const here = g.cities.find((q) => q.id === c.id), s = T.spots(here)[0];
          try { E.command(g, { type: 'welcome', city: c.id, capo: d.capo, x: s.x, y: s.y }); }
          catch (e) { const r = d.roads[0], to = r && g.cities.find((q) => q.id === r.city), q = to && T.spots(to)[0]; if (q) { try { E.command(g, { type: 'welcome', city: to.id, from: c.id, capo: d.capo, x: q.x, y: q.y }); } catch (e2) { /* cannot pay yet */ } } }
        }
      }
    }
    const h = E.hud(g);
    assert.ok(h.men >= 4, start + ' has ' + h.men + ' men');
    funded += seen.fund;
    assert.ok(seen.asks <= 40, start + ': the boss was asked ' + seen.asks + ' times in twenty years, not every month');
    assert.ok(h.share <= 85, start + ' holds ' + h.share + ' % of the map');
  }
  assert.ok(funded >= 1, 'a capo asked for money ' + funded + ' times');
});

test('money asked for a place is a decision like the others: a year on, the game says whether the place is ours', () => {
  const g = E.createGame({ capo: 'dutch' });
  let ask = null;
  for (let m = 1; m <= 240 && !ask; m++) {
    for (let i = 0; i < E.TICKS_PER_MONTH; i++) { g.paused = false; E.tick(g); }
    for (const c of E.view(g).cities) { const a = c.asks.find((q) => q.kind === 'fund'); if (a) ask = { city: c.id, a }; else for (const q of c.asks) E.command(g, { type: 'answer', city: c.id, id: q.id, yes: false }); }
  }
  assert.ok(ask, 'a capo asked for money');
  g.family.dirty += 50000;
  E.command(g, { type: 'answer', city: ask.city, id: ask.a.id, yes: true });
  settle(g);
  const d = E.view(g).decisions[0], name = T.person(ask.a.capo).name;
  assert.deepEqual([d.type, d.capo, d.x, d.y], ['funded', ask.a.capo, ask.a.x, ask.a.y]);
  // (the place may cost less the day the van gets there than the day the boss said yes: he is given the price of the day)
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(d.label, new RegExp('^You gave ' + esc(name) + ' \\$[\\d,]+ for the ' + esc(ask.a.name) + '$'));
  assert.ok(g.journal.some((l) => l.type === 'granted' && l.fund && new RegExp('^You give ' + esc(name) + ' \\$[\\d,]+ for the ' + esc(ask.a.name) + '$').test(l.label)));
  let told = null;
  for (let m = 0; m < 12 && !told; m++) {
    for (let i = 0; i < E.TICKS_PER_MONTH; i++) { g.paused = false; told = told || E.tick(g).find((e) => e.type === 'outcome' && e.decision === d.id); }
    for (const c of E.view(g).cities) for (const q of c.asks) E.command(g, { type: 'answer', city: c.id, id: q.id, yes: false });
  }
  const now = T.at(g.cities.find((q) => q.id === ask.city), ask.a.x, ask.a.y);
  assert.equal(told.good, !!now && now.owner === 'family');
  assert.match(told.label, now && now.owner === 'family' ? /^\d+ days on: the place is yours, and \w+ runs it$/ : /^\d+ days on: the place is not yours/);
});
