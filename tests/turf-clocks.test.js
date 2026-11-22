// Nothing waits for a cycle to turn: men sent for a place get there on their own day, a hold-up is told the day it
// happens, and the rivals and the men at the door come on days that change from one cycle to the next.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const E = require('../web/empire.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family;
const DAYS = T.RULES.days;

// one cycle of a city day by day; each(d, events, from) sees what every part of every day brought
const cycle = (c, f, each) => {
  const see = (d, ev, from) => { if (each) each(d, ev, from); return ev; };
  see(0, T.begin(f, [c]), 'begin');
  for (let d = 0; d < DAYS; d++) {
    see(d, T.pass(f, [c], d), 'pass');
    Object.keys(f.men).forEach((id) => { if (T.dayOf(id) === d) see(d, T.act(f, [c], id), 'act'); });
  }
  see(DAYS - 1, T.end(f, [c], []), 'end');
};

test('men sent for a place get there on the day they left, so many cycles later, not when a cycle turns', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'sal', 2, 3); T.join(f, 'sal'); c.quiet = 999;
  T.open(c, 4, 3, { owner: 'Callahan', kind: 'speakeasy' });
  f.men.sal.cash = 0;
  let left = null, landed = null, n = 0;
  for (let i = 0; i < 12 && !landed; i++) {
    if (i === 1) c.ops.push({ capo: 'sal', x: 4, y: 3, way: 'force', kind: 'speakeasy', cost: 0, month: c.month + 1, months: 2, day: 7 }), left = { cycle: 1, day: 7 };
    cycle(c, f, (d, ev, from) => ev.forEach((e) => { if (e.type === 'taken') landed = { cycle: i, day: d, from }; }));
    n++;
  }
  assert.deepEqual(landed, { cycle: 3, day: 7, from: 'pass' });
  assert.equal(T.at(c, 4, 3).owner, 'family');
});

test('a capo who sets out in the middle of a cycle is expected back on that day', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'sal', 2, 3); T.join(f, 'sal'); c.quiet = 999;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < 6; x++) if (!T.at(c, x, y)) T.open(c, x, y, { owner: 'Callahan', kind: 'speakeasy' });
  f.men.sal.cash = 0;
  T.begin(f, [c]);
  for (let d = 0; d < 5; d++) T.pass(f, [c], d);
  f.men.sal.cash = 50000;
  const ev = T.pass(f, [c], 5);
  assert.ok(ev.some((e) => e.type === 'moving'), ev.map((e) => e.type).join());
  assert.equal(c.ops[0].day, 5);
});

test('the rivals move on days that change from one cycle to the next, and never when the cycle closes', () => {
  const c = town(), f = family({ dirty: 0 });
  T.settle(c, 'mae', 2, 3); T.join(f, 'mae');
  T.open(c, 3, 3, { owner: 'family', kind: 'speakeasy', capo: 'mae' });
  T.open(c, 5, 3, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  T.open(c, 4, 2, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  const days = new Set(), kinds = ['burnt', 'repelled', 'vendetta'];
  let grew = 0, atEnd = 0, was = H.rivals(c).length;
  for (let i = 0; i < 60; i++) {
    cycle(c, f, (d, ev, from) => {
      const n = H.rivals(c).length;
      if (n > was || ev.some((e) => kinds.includes(e.type))) { if (from === 'end') atEnd++; else days.add(d); grew++; }
      was = n;
    });
  }
  assert.ok(grew > 0);
  assert.equal(atEnd, 0);
  assert.ok(days.size >= 3, 'the rivals moved on days ' + [...days].join(', '));
});

test('a man knocks at the door on a day of his own, not with the closing of the cycle', () => {
  const days = new Set();
  let atEnd = 0;
  for (const start of ['sal', 'dutch', 'mae', 'tommy']) {
    const c = H.ashport(), f = family({ dirty: 5000 });
    T.settle(c, start, 2, 3); T.join(f, start); c.quiet = 999;
    f.men[start].cash = 3000;
    for (let i = 0; i < 48; i++) cycle(c, f, (d, ev, from) => ev.forEach((e) => { if (e.type === 'knocks') { if (from === 'end') atEnd++; else days.add(start + d); } }));
  }
  assert.ok(days.size >= 2, 'knocks: ' + [...days].join(', '));
  assert.equal(atEnd, 0);
});

test('what was loud during the cycle still counts when the heat is reckoned at its close', () => {
  const quiet = town(), loud = town(), fq = family({ dirty: 0 }), fl = family({ dirty: 0 });
  for (const [c, f] of [[quiet, fq], [loud, fl]]) { T.settle(c, 'sal', 2, 3); T.join(f, 'sal'); c.quiet = 999; c.heat = 20; T.open(c, 4, 3, { owner: 'Callahan', kind: 'speakeasy' }); T.open(c, 9, 4, { owner: 'Callahan', kind: 'speakeasy' }); }
  loud.ops.push({ capo: 'sal', x: 4, y: 3, way: 'force', kind: 'speakeasy', cost: 0, month: loud.month + 1, months: 0, day: 9 });
  cycle(quiet, fq); cycle(loud, fl);
  assert.equal(T.at(loud, 4, 3).owner, 'family');
  assert.ok(loud.heat > quiet.heat, loud.heat + ' against ' + quiet.heat);
});

test('in the game, the rivals and the door never speak on the last day of a cycle only', () => {
  const g = E.createGame({ capo: 'sal' }), days = new Set();
  for (let i = 0; i < DAYS * 120; i++) {
    const d = g.ticks;
    E.tick(g).forEach((e) => { if (['burnt', 'repelled', 'knocks', 'taken', 'hijack'].includes(e.type)) days.add(d); });
    g.paused = false;
  }
  assert.ok(days.size >= 6, 'days ' + [...days].join(', '));
});

const washer = () => {
  const c = town(), f = family({ dirty: 2000, clean: 0 });
  T.settle(c, 'mae', 2, 3); T.join(f, 'mae'); c.quiet = 999;
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'mae' });
  f.men.mae.cash = 0;
  return { c, f };
};

test('dirty money is washed a little every day, and no more in a cycle than the fronts can wash', () => {
  const { c, f } = washer();
  const most = T.washing(c).most;
  assert.ok(most > 0);
  let days = 0, clean = f.clean, start = f.clean, dirty = f.dirty, washed = 0;
  cycle(c, f, (d, ev, from) => {
    if (from !== 'pass') return;
    if (f.clean > clean + 1e-9) days++;
    clean = f.clean;
  });
  assert.ok(days >= T.RULES.days - 1, 'clean money grew on ' + days + ' days');
  assert.ok(Math.abs(c.washed - most) < 1e-6, c.washed + ' washed, the fronts can wash ' + most);
  assert.ok(f.clean - start > 0 && f.clean - start < most);
  assert.ok(Math.abs(Object.values(c.flow.wash).reduce((a, b) => a + b, 0) - c.washed) < 1e-6);
});

test('cycle after cycle, with money to wash, the fronts wash all they can and no more', () => {
  const { c, f } = washer();
  f.dirty = 500000;
  for (let i = 0; i < 12; i++) {
    const before = T.washing(c).most;
    cycle(c, f);
    assert.ok(c.washed >= before - 1e-6 && c.washed <= T.washing(c).most + 1e-6, 'cycle ' + i + ': ' + c.washed + ' washed, between ' + before + ' and ' + T.washing(c).most);
  }
});

test('when the heat boils over the police come on a day of their own, not as the cycle closes', () => {
  const { c, f } = washer();
  f.dirty = 90000; c.heat = 99;
  let seen = null;
  for (let i = 0; i < 4 && !seen; i++) cycle(c, f, (d, ev, from) => ev.forEach((e) => { if (e.type === 'bust') seen = { from, d, seized: e.seized }; }));
  assert.ok(seen, 'the police came');
  assert.equal(seen.from, 'pass');
  assert.ok(seen.seized > 0 && f.dirty < 90000);
  assert.equal(c.heat <= T.RULES.afterBust + T.RULES.hot, true);
});

test('what the family learns is learned on the day its money arrived, so many cycles later', () => {
  const g = E.createGame({ capo: 'dutch' });
  g.family.clean = 50000;
  for (let i = 0; i < 9; i++) { E.tick(g); g.paused = false; }
  const kind = E.view(g).tree.filter((t) => t.next && t.kind !== 'cars')[0];
  E.command(g, { type: 'research', building: kind.kind });
  // the money is driven to the man who sets it up: the study starts the day the last load is there
  let started = null;
  for (let i = 0; i < DAYS * 4 && !started; i++) { const at = { month: g.month, day: g.ticks }; E.tick(g); g.paused = false; if (g.family.study) started = at; }
  assert.ok(started);
  assert.equal(g.family.study.day, started.day);
  let learned = null;
  for (let i = 0; i < DAYS * 14 && !learned; i++) { const at = { month: g.month, day: g.ticks }; if (E.tick(g).some((e) => e.type === 'learned')) learned = at; g.paused = false; }
  assert.ok(learned);
  assert.equal(learned.day, started.day);
  assert.equal(learned.month - started.month, kind.next.months);
});

test('no text the rules write for the player says month or year: time is told in days', () => {
  assert.equal(T.EVERY, 'every ' + DAYS + ' days');
  assert.equal(T.days(1), DAYS + ' days'); assert.equal(T.days(1 / DAYS), '1 day');
  const said = [];
  const read = (o) => { if (typeof o === 'string') said.push(o); else if (o && typeof o === 'object') Object.keys(o).forEach((k) => { if (['label', 'why', 'what', 'lever', 'gives', 'does', 'say'].includes(k) || typeof o[k] === 'object') read(o[k]); }); };
  for (const start of ['sal', 'dutch', 'mae']) {
    const g = E.createGame({ capo: start });
    for (let i = 0; i < DAYS * 150; i++) {
      read(E.tick(g));
      if (i % DAYS === 0) { const v = E.view(g); read(v.stalls); read(v.decisions); read(v.table); v.cities.forEach((c) => { read(c.stalls); read(c.asks); read(c.doors); read(c.promises); read(c.capos.map((k) => [k.plan, k.abilities, k.partings])); read(c.places.map((p) => p.strains)); }); }
      g.paused = false;
    }
    read(g.journal);
  }
  read(T.SCHOOLS);
  const bad = [...new Set(said.filter((s) => /\b(months?|years?|monthly|yearly)\b/i.test(s)))];
  assert.ok(said.length > 500);
  assert.deepEqual(bad.slice(0, 8), []);
});
