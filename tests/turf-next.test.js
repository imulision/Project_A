// What is coming: the streets a capo's next move will bring to the family, and in how many months.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;

const grips = (c) => { const out = {}; for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) out[x + ',' + y] = T.grip(c, x, y); return out; };
const won = (was, now) => Object.keys(now).filter((k) => now[k] === 'family' && was[k] !== 'family').sort();
const keys = (list) => list.map((b) => b.x + ',' + b.y).sort();

test('the streets an opening would bring are those that turn to the family once the place stands', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  const said = keys(T.gains(c, { move: 'open', x: 5, y: 3, kind: 'speakeasy' })), was = grips(c);
  T.open(c, 5, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.ok(said.length > 0);
  assert.deepEqual(said, won(was, grips(c)));
});

test('taking a rival\'s place brings its streets, and counting them leaves the city as it was', () => {
  const c = town();
  T.settle(c, 'sal', 2, 3);
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  const before = JSON.stringify(c.blocks), was = grips(c);
  const said = keys(T.gains(c, { move: 'take', x: 5, y: 3, kind: 'speakeasy' }));
  assert.equal(JSON.stringify(c.blocks), before);
  assert.deepEqual(grips(c), was);
  c.blocks['5,3'] = { owner: 'family', kind: 'speakeasy', level: 1, capo: 'sal' }; T.touch(c);
  assert.ok(said.length > 0);
  assert.deepEqual(said, won(was, grips(c)));
});

test('a place made bigger reaches further; one that changes trade brings no street', () => {
  const c = town();
  T.settle(c, 'dutch', 2, 3);
  T.open(c, 6, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  const said = keys(T.gains(c, { move: 'enlarge', x: 6, y: 3, kind: 'speakeasy' })), was = grips(c);
  assert.deepEqual(T.gains(c, { move: 'convert', x: 6, y: 3, kind: 'still' }), []);
  assert.deepEqual(T.gains(c, { move: 'hold' }), []);
  c.blocks['6,3'].level = 2; T.touch(c);
  assert.ok(said.length > 0);
  assert.deepEqual(said, won(was, grips(c)));
});

test('a capo\'s plan says the streets it brings and in how many months it is done', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  f.men.dutch.cash = 0;
  for (let i = 0; i < 8; i++) T.stepMonth(c, f);
  const k = T.view(c, f).capos[0], p = k.plan;
  assert.ok(Array.isArray(p.gains));
  assert.deepEqual(keys(p.gains), keys(T.gains(c, p)));
  if (p.waiting === 'money') assert.equal(p.due, p.monthsLeft === null ? null : p.monthsLeft + (p.months || 0));
  else if (p.waiting === null) assert.equal(p.due, p.months || 0);
});

test('men on their way to a place: the plan is due when they get there', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'sal', 2, 3); T.join(f, 'sal');
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'sal', x: 5, y: 3, way: 'force', cost: 100, months: 3, month: c.month - 1, kind: 'speakeasy' });
  const p = T.view(c, f).capos[0].plan;
  assert.equal(p.waiting, 'time');
  assert.equal(p.due, 2);
  assert.ok(p.gains.length > 0);
});

test('the city says the next streets to fall: the soonest plan that brings any', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'sal', 2, 3); T.join(f, 'sal');
  assert.equal(T.view(c, f).next === undefined, false);
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'sal', x: 5, y: 3, way: 'force', cost: 100, months: 3, month: c.month - 1, kind: 'speakeasy' });
  const n = T.view(c, f).next;
  assert.equal(n.capo, 'sal');
  assert.ok(Math.abs(n.advance - (T.RULES.paidFor + (1 - T.RULES.paidFor) / 3)) < 1e-9);
  assert.equal(n.stuck, false);
  assert.equal(n.move, 'take');
  assert.equal(n.x, 5); assert.equal(n.y, 3);
  assert.equal(n.streets, T.view(c, f).capos[0].plan.gains.length);
  assert.match(n.label, /^Sal takes a speakeasy: \+\d+ streets?$/);
});

test('the bar of a move goes from nothing put aside to the place in hand, and never says a month', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'dutch', 2, 3); T.join(f, 'dutch'); c.quiet = 999;
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 2, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  f.men.dutch.cash = 0;
  let seen = 0;
  for (let i = 0; i < 36; i++) {
    T.stepMonth(c, f);
    const v = T.view(c, f), p = v.capos[0].plan;
    assert.ok(p.advance >= 0 && p.advance <= 1, String(p.advance));
    if (p.waiting === 'money' && !p.months) assert.ok(Math.abs(p.advance - p.progress) < 1e-9);
    if (v.next) { seen++; assert.doesNotMatch(v.next.label, /month/); assert.equal(v.next.stuck, p.monthsLeft === null && p.waiting === 'money'); }
  }
  assert.ok(seen > 0);
});

test('nothing coming: the city says so with null, and the family names its soonest city', () => {
  assert.equal(E.view(E.createGame()).next, null);
  const g = E.createGame({ capo: 'dutch' });
  for (let i = 0; i < E.TICKS_PER_MONTH * 6; i++) E.tick(g);
  const v = E.view(g), all = v.cities.map((c) => c.next).filter(Boolean);
  if (all.length) { assert.equal(v.next.advance, Math.max(...all.map((n) => n.advance))); assert.ok(v.next.city); }
  else assert.equal(v.next, null);
});
