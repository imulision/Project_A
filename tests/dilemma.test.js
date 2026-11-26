// Dilemmas: matters with no right answer. Each sets two of the boss's people, or two things he wants, against each
// other; every choice says who gains and who loses; and what he chose comes back months later with a name on it,
// according to the man it touched (a loyal man lets it go, a sour one does not).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');
const A = require('../web/audience.js');
const X = require('../web/dilemma.js');
const C = require('../web/cards.js');

const day = (g) => { g.paused = false; return E.tick(g); };
const today = (g) => g.month * E.TICKS_PER_MONTH + g.ticks;
const text = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
// A game with two men in Ashport, and nobody coming to the boss unless the test brings him.
function two(a, b, more) {
  const g = E.createGame({ capo: a, quiet: true }), c = g.cities[0], spot = T.clubSpot(c, b);
  T.settle(c, b, spot.x, spot.y); T.join(g.family, b);
  g.family.dirty = 5000;
  Object.assign(g, more || {});
  for (let d = 0; d < 30; d++) day(g);
  return g;
}
const bring = (g, kind) => { const e = A.bring(g, kind, today(g)); assert.ok(e, kind + ' can come up'); return E.view(g).matters[0]; };
const decide = (g, m, choice) => E.command(g, { type: 'decide', id: m.id, choice });
const loyal = (g, id) => T.loyalty(g.family, id);
const run = (g, n) => { const out = []; for (let d = 0; d < n; d++) out.push(...day(g)); return out; };

test('every dilemma names two sides, and every choice says what it brings and what it costs', () => {
  const g = two('sal', 'mae');
  ['blood', 'skim', 'debt'].forEach((kind) => {
    const m = bring(g, kind);
    assert.equal(m.kind, kind); assert.equal(m.dilemma, true);
    assert.ok(m.choices.length === 3, kind + ' has three ways out');
    m.choices.forEach((ch) => { assert.ok(ch.gives, kind + '/' + ch.id + ' says what it brings'); assert.ok(ch.costs, kind + '/' + ch.id + ' says what it costs'); });
    assert.ok(!m.choices.some((ch) => ch.id === 'no'), 'there is no way to say nothing');
    decide(g, m, m.choices[0].id);
  });
});

test('blood between two capos: whoever the boss stands by, the other remembers', () => {
  const g = two('sal', 'mae'), m = bring(g, 'blood');
  assert.equal(m.capo, 'mae'); assert.equal(m.against, 'sal'); // Mae's man was shot: she comes to the boss, against Sal
  assert.match(m.title, /Sal/); assert.match(m.title, /Mae/);
  assert.deepEqual(m.choices.map((c) => c.id), ['give', 'send', 'stand']);
  const sal = loyal(g, 'sal'), mae = loyal(g, 'mae');
  decide(g, m, 'stand');
  assert.equal(loyal(g, 'sal'), sal + X.RULES.blood.stand.his);
  assert.equal(loyal(g, 'mae'), mae + X.RULES.blood.stand.hers);
  assert.match(g.journal[g.journal.length - 1].label, /stand by Sal/);
});

test('a choice comes back: a loyal woman lets the boy be, a sour one sends her men for him and a feud breaks out', () => {
  const calm = two('sal', 'mae'), sour = two('sal', 'mae');
  T.sway(sour.family, 'mae', -30);
  [calm, sour].forEach((g) => decide(g, bring(g, 'blood'), 'stand'));
  const after = X.RULES.blood.after + 2 * T.RULES.days;
  const a = run(calm, after).filter((e) => e.type === 'echo'), b = run(sour, after).filter((e) => e.type === 'echo');
  assert.equal(a.length, 1); assert.equal(b.length, 1);
  assert.equal(a[0].good, true); assert.match(a[0].label, /Mae/);
  assert.equal(b[0].good, false); assert.match(b[0].label, /Mae/);
  assert.ok(b[0].gives.match(/throat/));
  run(sour, T.RULES.days);
  assert.ok(sour.cities[0].feuds.some((q) => [q.a, q.b].sort().join() === 'mae,sal'), 'the two are at each other\'s throat');
  assert.ok(sour.journal.some((l) => l.type === 'echo'), 'and it is in the journal');
});

test('giving the boy up: a proud man who turned sour keeps his money to himself for a while', () => {
  const g = two('sal', 'mae');
  T.sway(g.family, 'sal', -15);
  decide(g, bring(g, 'blood'), 'give');
  const e = run(g, X.RULES.blood.after + 2).filter((q) => q.type === 'echo')[0];
  assert.ok(e); assert.equal(e.good, false); assert.equal(e.capo, 'sal');
  assert.ok(E.view(g).cities[0].capos.filter((c) => c.id === 'sal')[0].sulks > 0);
});

test('sending the boy away costs money, pleases nobody, and is remembered kindly later', () => {
  const g = two('sal', 'mae'), m = bring(g, 'blood'), send = m.choices[1], before = g.family.dirty, sal = loyal(g, 'sal'), mae = loyal(g, 'mae');
  assert.ok(send.cost > 0);
  decide(g, m, 'send');
  assert.equal(g.family.dirty, before - send.cost);
  assert.ok(loyal(g, 'sal') < sal && loyal(g, 'mae') < mae);
  const e = run(g, X.RULES.blood.after + 2).filter((q) => q.type === 'echo')[0];
  assert.equal(e.good, true);
});

test('a count said to be short: the books of a thief give the money back, the books of an honest man cost his trust', () => {
  // Vince is ambitious and restless: he steals. Sal is ambitious but steady: he does not.
  const thief = two('mae', 'vince'), honest = two('mae', 'sal');
  const m1 = bring(thief, 'skim'), m2 = bring(honest, 'skim');
  assert.equal(m1.capo, 'mae'); assert.equal(m1.against, 'vince');
  assert.match(m1.says, /restless/); assert.match(m2.says, /steady/); // the boss can read the man
  assert.match(m1.says, /ambitio/i);
  const d1 = thief.family.dirty, v = loyal(thief, 'vince'), s = loyal(honest, 'sal'), d2 = honest.family.dirty;
  decide(thief, m1, 'audit'); decide(honest, m2, 'audit');
  assert.equal(thief.family.dirty, d1 + X.RULES.skim.back);
  assert.equal(loyal(thief, 'vince'), v + X.RULES.skim.caught);
  assert.equal(honest.family.dirty, d2);
  assert.equal(loyal(honest, 'sal'), s + X.RULES.skim.insulted);
  assert.ok(X.RULES.skim.insulted < X.RULES.skim.caught, 'an honest man called a thief takes it worse');
  assert.match(thief.journal[thief.journal.length - 1].label, /short/);
  assert.match(honest.journal[honest.journal.length - 1].label, /right to the dollar/);
});

test('taking a thief at his word costs the boss later; taking an honest man at his word is remembered', () => {
  const thief = two('mae', 'vince'), honest = two('mae', 'sal');
  decide(thief, bring(thief, 'skim'), 'trust'); decide(honest, bring(honest, 'skim'), 'trust');
  thief.family.dirty = 3000;
  const e1 = run(thief, X.RULES.skim.after + 2).filter((q) => q.type === 'echo')[0], e2 = run(honest, X.RULES.skim.after + 2).filter((q) => q.type === 'echo')[0];
  assert.equal(e1.good, false); assert.equal(e1.capo, 'vince'); assert.match(e1.gives, /\$/);
  assert.equal(e2.good, true); assert.equal(e2.capo, 'sal');
  assert.match(e2.gives, /Loyalty \+/);
});

test('a man held for a debt: paying is dear and safe, a hard capo fetches him, a soft one loses a man', () => {
  const hard = two('sal', 'mae'), soft = two('mae', 'tommy');
  const m = bring(hard, 'debt');
  assert.deepEqual(m.choices.map((c) => c.id), ['pay', 'fetch', 'leave']);
  assert.match(m.says, /Muscle \d/); // the boss reads whether his man is hard enough
  const who = m.capo, was = loyal(hard, who), heat = hard.cities[0].heat || 0;
  decide(hard, m, 'fetch');
  if (T.person(who).muscle >= X.RULES.debt.hard) { assert.ok(loyal(hard, who) > was); assert.match(hard.journal[hard.journal.length - 1].label, /brings him back/); }
  assert.ok((hard.cities[0].heat || 0) > heat, 'it is loud');
  const m2 = bring(soft, 'debt'), w2 = loyal(soft, m2.capo);
  assert.ok(T.person(m2.capo).muscle < X.RULES.debt.hard);
  decide(soft, m2, 'fetch');
  assert.ok(loyal(soft, m2.capo) < w2);
  assert.match(soft.journal[soft.journal.length - 1].label, /dead/);
});

test('a man left to the rivals talks if his capo\'s house is not tight: a load is lost months later', () => {
  const g = two('sal', 'mae'), m = bring(g, 'debt');
  T.sway(g.family, m.capo, -30);
  decide(g, m, 'leave');
  g.family.dirty = 4000;
  const e = run(g, X.RULES.debt.after + 2).filter((q) => q.type === 'echo')[0];
  assert.equal(e.good, false);
  assert.equal(g.family.dirty < 4000 + 2000, true);
  assert.match(e.label, /talked/);
});

test('a dilemma needs its people: no blood and no count between capos with a single man, and a debt needs a rival family', () => {
  const g = E.createGame({ capo: 'sal', quiet: true });
  for (let d = 0; d < 30; d++) day(g);
  assert.equal(A.bring(g, 'blood', today(g)), null);
  assert.equal(A.bring(g, 'skim', today(g)), null);
  assert.ok(A.bring(g, 'debt', today(g)));
});

test('the card of a dilemma shows both faces and every way out', () => {
  const g = two('sal', 'mae'), m = bring(g, 'blood'), html = C.requests(E.view(g), E.hud(g));
  assert.match(html, /class="card ask matter dilemma"/);
  assert.match(html, /class="versus"/);
  assert.match(text(html), /Sal/); assert.match(text(html), /Mae/);
  m.choices.forEach((ch) => assert.match(html, new RegExp('data-choice="' + ch.id + '"')));
});

test('with two men in a city the street brings a dilemma at least one time in two, and never the same twice running', () => {
  const g = E.createGame({ capo: 'sal' }), c = g.cities[0], spot = T.clubSpot(c, 'mae');
  T.settle(c, 'mae', spot.x, spot.y); T.join(g.family, 'mae');
  const kinds = [];
  for (let d = 1; d <= 1400; d++) {
    day(g);
    if (!g.paused) continue;
    const v = E.view(g);
    v.matters.forEach((m) => { kinds.push(m.kind); const h = E.hud(g), ch = m.choices.filter((q) => !q.cost || q.cost <= (q.money === 'clean' ? h.clean : h.dirty))[0] || m.choices[m.choices.length - 1]; E.command(g, { type: 'decide', id: m.id, choice: ch.id }); });
    v.cities.forEach((q) => { q.asks.forEach((a) => { try { E.command(g, { type: 'answer', city: q.id, id: a.id, yes: false }); } catch (e) { /* not today */ } }); q.feuds.forEach((f) => E.command(g, { type: 'rule', city: q.id, id: f.id, winner: f.a })); });
  }
  const dil = kinds.filter((k) => X.KINDS.indexOf(k) >= 0), street = kinds.filter((k) => ['captain', 'truce', 'bail', 'feast', 'cargo', 'banker', 'favor', 'widow'].indexOf(k) >= 0);
  assert.ok(dil.length >= 4, 'dilemmas: ' + kinds.join(' '));
  assert.ok(dil.length >= street.length, dil.length + ' dilemmas for ' + street.length + ' matters of the street');
  for (let i = 1; i < dil.length; i++) assert.notEqual(dil[i], dil[i - 1], 'twice running: ' + dil[i]);
});

test('an old saved game has no echo waiting, and plays on', () => {
  const g = two('sal', 'mae');
  delete g.audience.echoes;
  const back = E.load(E.save(g));
  for (let d = 0; d < 60; d++) { back.paused = false; E.tick(back); }
  assert.ok(back.month >= 2);
});
