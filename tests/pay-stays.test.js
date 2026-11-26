// Pay is physical too: a capo's own pay never comes down from the boss's purse. He keeps it out of the boss's share
// while that share still sleeps at his club, before any of it leaves for the headquarters.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/turf.js');
const E = require('../web/empire.js');

const play = (capo, cycles) => {
  const g = E.createGame({ capo }); g.reign.left = 1e9;
  g.family.dirty = 0; g.family.clean = 0;
  g.family.men[capo].rank = 1; // a Capo is paid; a Soldier is not
  let arrived = 0, paid = 0;
  for (let m = 0; m < cycles; m++) {
    for (let i = 0; i < E.TICKS_PER_MONTH; i++) {
      g.paused = false;
      for (const e of E.tick(g)) if (e.type === 'arrived' && e.kind === 'tribute') arrived += e.amount;
    }
    paid += E.view(g).cities[0].money.pay;
  }
  return { g, arrived, paid };
};

test('the boss\'s purse holds exactly what the cars brought him: the pay of his capo was kept at the club', () => {
  const { g, arrived, paid } = play('sal', 8); // the first loads are slow: the takings are days on their way home (and before his first laundry: money out for a wash is not in the purse)
  assert.ok(arrived > 0, 'loads of his share arrived');
  assert.ok(paid > 0, 'and the capo was paid');
  assert.strictEqual(Math.round(g.family.dirty + (g.family.clean || 0)), arrived);
});

test('what a capo is owed and his club cannot cover yet is kept out of the next money that comes in', () => {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9;
  const m = g.family.men.sal;
  m.unpaid = 40; m.share = 0;
  for (let i = 0; i < 3 * E.TICKS_PER_MONTH && m.unpaid > 0; i++) { g.paused = false; E.tick(g); }
  assert.strictEqual(m.unpaid || 0, 0, 'he took it as the money came');
});

// --- the men of a place are paid where they work ---
const H = require('./turf-helpers.js');

test('the pay of a place stays in the place: its till only holds what is left for the car to fetch', () => {
  const { c, f } = H.sixBars();
  const gross = T.income(c, 'dutch') - T.RULES.club, bars = T.view(c, f).places.filter((p) => p.kind === 'gambling' && p.capo === 'dutch').length;
  assert.strictEqual(bars, 6);
  T.stepMonth(c, f);
  const tills = T.view(c, f).places.reduce((n, p) => n + (p.till || 0), 0), fetched = T.trips(c, f).filter((t) => t.kind === 'takings').reduce((n, t) => n + t.amount, 0);
  assert.ok(Math.abs(tills + fetched - (gross - bars * T.RULES.wage)) < 1e-6, 'takings less the men\'s pay: ' + (tills + fetched) + ' of ' + gross);
});

test('the capo no longer pays at his club the men who were paid where they work', () => {
  const { c, f } = H.sixBars();
  const bars = 6, all = 6; // six gambling dens, and nothing else to pay
  T.stepMonth(c, f);
  const book = f.men.dutch.book;
  assert.strictEqual(book.left, T.RULES.wage * bars, 'his book says what his men were paid where they work');
  assert.strictEqual(book.wages, T.RULES.wage * (all - bars), 'and he pays nothing more for them at his club');
});

test('day by day the pay is told at the place where it is left', () => {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9;
  let told = [];
  for (let i = 0; i < 8 * E.TICKS_PER_MONTH; i++) { g.paused = false; told = told.concat(E.tick(g).filter((e) => e.type === 'pay' && e.what === 'wages' && e.left)); }
  assert.ok(told.length > 0);
  const his = E.view(g).cities[0].places.filter((p) => p.capo === 'sal' && p.kind !== 'club');
  assert.ok(told.every((e) => e.amount > 0 && his.some((p) => p.x === e.x && p.y === e.y)), 'at his places, never at the club');
});
