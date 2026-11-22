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
  const { g, arrived, paid } = play('sal', 6);
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
