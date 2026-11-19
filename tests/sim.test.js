// Unit tests for the game rules. No browser, no drawing: rules only.
const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../web/sim.js');

// Starts a game and clears the opening decision by appointing `who` to Hillside.
function started(who = 'vito') {
  const g = Sim.createGame();
  Sim.resolve(g, { pick: who });
  return g;
}
function runTicks(g, n) {
  const seen = [];
  for (let i = 0; i < n; i++) seen.push(...Sim.tick(g));
  return seen;
}

test('a new game starts in January 1926 with the family holding the Docks', () => {
  const g = Sim.createGame();
  assert.equal(g.month, 0);
  assert.equal(g.cash, 1500);
  assert.equal(g.districts.docks.lieutenant, 'frankie');
  assert.equal(g.districts.market.lieutenant, 'rosa');
  assert.equal(g.districts.hillside.lieutenant, null);
  assert.deepEqual(g.bench, ['sal', 'vito', 'mae']);
});

test('time does not advance while a decision is waiting', () => {
  const g = Sim.createGame();
  assert.ok(g.pending, 'the opening decision is waiting');
  const before = JSON.stringify(g);
  assert.deepEqual(Sim.tick(g), []);
  assert.equal(JSON.stringify(g), before);
});

test('a district with a lieutenant gains influence every tick', () => {
  const g = started('sal');
  const before = g.districts.hillside.share;
  Sim.tick(g);
  assert.equal(g.districts.hillside.share, before + Sim.LIEUTENANTS.sal.expand / Sim.TICKS_PER_MONTH);
});

test('a vacant district loses influence every tick', () => {
  const g = started();
  g.districts.market.lieutenant = null;
  const before = g.districts.market.share;
  Sim.tick(g);
  assert.ok(g.districts.market.share < before);
});

test('influence never goes above 100 or below 0', () => {
  const g = started('sal');
  g.districts.hillside.share = 99.9;
  g.districts.canal.share = 0;
  Sim.tick(g);
  assert.equal(g.districts.hillside.share, 100);
  assert.equal(g.districts.canal.share, 0);
});

test('Callahan presence grows in a contested district nobody runs', () => {
  const g = started();
  const before = g.districts.canal.rival;
  Sim.tick(g);
  assert.ok(g.districts.canal.rival > before);
});

test('your influence and Callahan presence never add up to more than the district', () => {
  const g = started();
  g.districts.union.lieutenant = 'sal';
  g.districts.union.share = 80;
  g.districts.union.rival = 0.5;
  Sim.tick(g);
  assert.ok(g.districts.union.share / 100 + g.districts.union.rival <= 1 + 1e-9);
});

test('a district that crosses a level reports it and earns respect', () => {
  const g = started();
  g.districts.market.level = 1.999;
  const respect = g.respect;
  const seen = Sim.tick(g);
  const up = seen.find((e) => e.type === 'level');
  assert.deepEqual(up, { type: 'level', district: 'market', level: 2 });
  assert.equal(g.respect, respect + 3);
});

test('a district level never goes above 3', () => {
  const g = started();
  g.districts.market.level = 2.9999;
  runTicks(g, 3);
  assert.equal(g.districts.market.level, 3);
});

// ---- The end of the month: the envelope ----

function runMonth(g) { return runTicks(g, Sim.TICKS_PER_MONTH); }

test('a month lasts a fixed number of ticks', () => {
  const g = started();
  runTicks(g, Sim.TICKS_PER_MONTH - 1);
  assert.equal(g.month, 0);
  Sim.tick(g);
  assert.equal(g.month, 1);
  assert.equal(g.tick, 0);
});

test('a district earns more with more influence, a higher level and a better earner', () => {
  const g = started();
  const d = g.districts.docks;
  const base = Sim.districtIncome(g, 'docks');
  d.share += 10;
  const moreShare = Sim.districtIncome(g, 'docks');
  d.level += 0.5;
  const moreLevel = Sim.districtIncome(g, 'docks');
  d.lieutenant = 'vito';
  const worseEarner = Sim.districtIncome(g, 'docks');
  assert.ok(moreShare > base);
  assert.ok(moreLevel > moreShare);
  assert.ok(worseEarner < moreLevel);
});

test('a vacant district earns half of what an ordinary lieutenant would bring', () => {
  const g = started();
  g.districts.docks.lieutenant = 'vito';
  const run = Sim.districtIncome(g, 'docks');
  g.districts.docks.lieutenant = null;
  assert.equal(Sim.districtIncome(g, 'docks'), run / 2);
});

test('the envelope adds income to the safe, less skim, wages and lieutenant costs', () => {
  const g = started();
  const cash = g.cash;
  const env = runMonth(g).find((e) => e.type === 'envelope');
  assert.ok(env, 'the month ends with an envelope');
  assert.equal(env.wages, g.men * Sim.WAGE_PER_MAN);
  assert.equal(env.costs, Sim.LIEUTENANTS.rosa.cost);
  assert.ok(env.skim > 0, 'Frankie keeps part of the Docks money');
  assert.ok(Math.abs(env.net - (env.gross - env.skim - env.wages - env.costs)) < 1e-9);
  assert.ok(Math.abs(g.cash - (cash + env.net)) < 1e-9);
  assert.ok(Math.abs(g.delta.cash - env.net) < 1e-9);
});

test('heat rises with hot lieutenants and cools by two a month on its own', () => {
  const hot = started('sal');
  runMonth(hot);
  const calm = started('vito');
  runMonth(calm);
  // Frankie adds 1 in both games.
  assert.equal(hot.heat, 40 + Sim.LIEUTENANTS.sal.heat + 1 - 2);
  assert.equal(calm.heat, 40 + 1 - 2);
});

test('lieutenants in a post grow more loyal, those left on the bench less', () => {
  const g = started('vito');
  const sal = g.lieutenants.sal.loyalty;
  const rosa = g.lieutenants.rosa.loyalty;
  runMonth(g);
  assert.equal(g.lieutenants.rosa.loyalty, rosa + 1);
  assert.equal(g.lieutenants.sal.loyalty, sal - 1);
});

test('an ambitious lieutenant loses loyalty even while holding a post', () => {
  const g = started();
  g.districts.union.lieutenant = 'dutch';
  const before = g.lieutenants.dutch.loyalty;
  runMonth(g);
  assert.ok(g.lieutenants.dutch.loyalty < before);
});

test('the game is lost to a federal raid when heat reaches 100', () => {
  const g = started('sal');
  g.heat = 97;
  const seen = runMonth(g);
  assert.equal(g.over.result, 'raid');
  assert.ok(seen.some((e) => e.type === 'end'));
  assert.deepEqual(Sim.tick(g), [], 'nothing happens after the end');
});

test('the game is lost when the family is deep in debt', () => {
  const g = started();
  g.cash = -2000;
  runMonth(g);
  assert.equal(g.over.result, 'broke');
});

// ---- Orders that change how a district moves ----

test('extra men speed up the taking of blocks while the boost lasts', () => {
  const plain = started('vito');
  const boosted = started('vito');
  boosted.districts.hillside.boost = 1;
  Sim.tick(plain);
  Sim.tick(boosted);
  assert.ok(boosted.districts.hillside.share > plain.districts.hillside.share);
  runTicks(boosted, Sim.TICKS_PER_MONTH - 1);
  assert.equal(boosted.districts.hillside.boost, 0, 'the boost runs out month by month');
});

test('a forceful lieutenant pushes the Callahans out, a quiet one does not', () => {
  const g = started();
  g.districts.union.lieutenant = 'sal';
  g.districts.canal.lieutenant = 'mae';
  const union = g.districts.union.rival;
  const canal = g.districts.canal.rival;
  Sim.tick(g);
  assert.ok(g.districts.union.rival < union);
  assert.equal(g.districts.canal.rival, canal);
});

// ---- Who holds the city ----

test('control of the city adds up to one and starts with the family ahead of the Callahans', () => {
  const c = Sim.control(Sim.createGame());
  assert.ok(Math.abs(c.you + c.callahan + c.northside + c.free - 1) < 1e-9);
  assert.ok(c.you > c.callahan);
  assert.ok(c.you > 0.25 && c.you < 0.35);
});

test('respect grows in a month where the family gains ground and falls when it loses ground', () => {
  const up = started('sal');
  up.districts.market.level = 1; // no level-up bonus in the way
  const r0 = up.respect;
  runMonth(up);
  assert.equal(up.respect, r0 + 1);
  const down = started('vito');
  down.districts.docks.lieutenant = null;
  down.districts.market.lieutenant = null;
  down.districts.hillside.lieutenant = null;
  runMonth(down);
  assert.equal(down.respect, r0 - 2);
});

// ---- Naming and replacing lieutenants ----

test('the player can ask to change the lieutenant of a district, and may back out', () => {
  const g = started();
  Sim.requestAssign(g, 'docks');
  assert.equal(g.pending.kind, 'assign');
  assert.equal(g.pending.district, 'docks');
  assert.equal(g.pending.canSkip, true);
  Sim.resolve(g, { skip: true });
  assert.equal(g.pending, null);
  assert.equal(g.districts.docks.lieutenant, 'frankie');
});

test('a replaced lieutenant goes back to the bench and resents it, the new one is grateful', () => {
  const g = started('vito');
  const frankie = g.lieutenants.frankie.loyalty;
  const sal = g.lieutenants.sal.loyalty;
  Sim.requestAssign(g, 'docks');
  Sim.resolve(g, { pick: 'sal' });
  assert.equal(g.districts.docks.lieutenant, 'sal');
  assert.deepEqual(g.bench, ['mae', 'frankie']);
  assert.equal(g.lieutenants.frankie.loyalty, frankie - 15);
  assert.equal(g.lieutenants.sal.loyalty, sal + 5);
});

test('only someone on the bench can be appointed', () => {
  const g = started('vito');
  Sim.requestAssign(g, 'docks');
  Sim.resolve(g, { pick: 'rosa' });
  assert.equal(g.districts.docks.lieutenant, 'frankie');
  assert.equal(g.districts.market.lieutenant, 'rosa');
});

// ---- The events of 1926 ----

function runUntilDecision(g, limit = 80) {
  const seen = [];
  for (let i = 0; i < limit && !g.pending && !g.over; i++) seen.push(...Sim.tick(g));
  return seen;
}
function playTo(g, month, answer = (p) => (p.kind === 'assign' ? { skip: true } : { option: 1 })) {
  for (let i = 0; i < 400 && !g.over; i++) {
    if (g.pending) {
      if (g.month >= month) return;
      Sim.resolve(g, answer(g.pending));
    } else {
      if (g.month >= month) return;
      Sim.tick(g);
    }
  }
}

test('in March the Hillside lieutenant asks for five men', () => {
  const g = started('sal');
  runUntilDecision(g);
  assert.equal(g.month, 2);
  assert.equal(g.pending.kind, 'choice');
  assert.equal(g.pending.title, 'Sal asks for five men');
  assert.equal(g.pending.options.length, 2);
});

test('giving the five men costs idle men, boosts Hillside and earns gratitude', () => {
  const g = started('sal');
  runUntilDecision(g);
  const loyalty = g.lieutenants.sal.loyalty;
  Sim.resolve(g, { option: 0 });
  assert.equal(g.idle, 1);
  assert.equal(g.districts.hillside.boost, 3);
  assert.equal(g.lieutenants.sal.loyalty, loyalty + 10);
});

test('refusing the five men costs loyalty and nothing else', () => {
  const g = started('sal');
  runUntilDecision(g);
  const loyalty = g.lieutenants.sal.loyalty;
  Sim.resolve(g, { option: 1 });
  assert.equal(g.idle, 6);
  assert.equal(g.lieutenants.sal.loyalty, loyalty - 15);
});

test('in April Dutch and Nora arrive and Union Station is offered', () => {
  const g = started('sal');
  playTo(g, 3);
  assert.equal(g.month, 3);
  assert.equal(g.pending.kind, 'assign');
  assert.equal(g.pending.district, 'union');
  assert.equal(g.pending.canSkip, true);
  assert.ok(g.bench.includes('dutch') && g.bench.includes('nora'));
});

test('letting Canal Street go in June costs respect', () => {
  const g = started('sal');
  playTo(g, 5);
  assert.equal(g.pending.district, 'canal');
  const respect = g.respect;
  Sim.resolve(g, { skip: true });
  assert.equal(g.respect, respect - 4);
});

test('making an example of Frankie in July stops the skim and costs his loyalty', () => {
  const g = started('sal');
  playTo(g, 6);
  assert.equal(g.pending.title, "Frankie's envelope is thin");
  const loyalty = g.lieutenants.frankie.loyalty;
  const respect = g.respect;
  Sim.resolve(g, { option: 0 });
  assert.equal(g.lieutenants.frankie.skim, 0);
  assert.equal(g.lieutenants.frankie.loyalty, loyalty - 25);
  assert.equal(g.respect, respect + 3);
});

test('the police captain only names his price when heat is high, and paying cools things down', () => {
  const calm = started('vito');
  playTo(calm, 8);
  assert.equal(calm.month, 8);
  assert.equal(calm.pending, null, 'no offer when heat is low');

  const hot = started('sal');
  playTo(hot, 7);
  if (hot.pending) Sim.resolve(hot, { option: 1 });
  hot.heat = 70;
  runUntilDecision(hot);
  assert.equal(hot.pending.title, 'The police captain names his price');
  const cash = hot.cash;
  const heat = hot.heat;
  Sim.resolve(hot, { option: 0 });
  assert.equal(hot.cash, cash - 800);
  assert.equal(hot.heat, heat - 25);
});

test('in November the least loyal lieutenant in a post betrays if loyalty is under 45', () => {
  const g = started('vito');
  playTo(g, 9);
  if (g.pending) Sim.resolve(g, { option: 1 });
  const loyal = structuredClone(g);
  g.lieutenants.frankie.loyalty = 20;
  const seen = runUntilDecision(g);
  runMonth(loyal);
  assert.equal(g.month, 10);
  assert.equal(g.pending.title, 'Frankie has betrayed you');
  assert.equal(g.districts.docks.lieutenant, null);
  assert.ok(g.districts.docks.share <= 12);
  assert.ok(g.districts.docks.rival >= 0.7);
  assert.equal(g.respect, loyal.respect - 6);
  assert.ok(!g.bench.includes('frankie'), 'he is gone for good');
  assert.ok(seen.some((e) => e.type === 'betrayal' && e.district === 'docks'));
});

test('nobody betrays when every lieutenant in a post is loyal enough', () => {
  const g = started('vito');
  playTo(g, 9);
  if (g.pending) Sim.resolve(g, { option: 1 });
  Object.keys(g.lieutenants).forEach((k) => { g.lieutenants[k].loyalty = 80; });
  runMonth(g);
  assert.equal(g.month, 10);
  assert.equal(g.pending, null);
});

test('the year ends in December with a verdict that depends on how much of the city is held', () => {
  const small = started('vito');
  playTo(small, 11);
  if (small.pending) Sim.resolve(small, { option: 1 });
  const big = structuredClone(small);
  Object.keys(small.districts).forEach((id) => { small.districts[id].share = 10; small.districts[id].lieutenant = null; });
  runMonth(small);
  assert.equal(small.over.result, 'year');
  assert.equal(small.over.title, 'Still a small-time outfit');

  Object.keys(big.districts).forEach((id) => { big.districts[id].share = 100; big.districts[id].rival = 0; });
  const seen = runMonth(big);
  assert.equal(big.over.title, 'Ashport answers to you');
  assert.ok(seen.some((e) => e.type === 'end'));
});

test('news is reported as events the page can show', () => {
  const g = Sim.createGame();
  const seen = Sim.resolve(g, { pick: 'vito' });
  assert.deepEqual(seen, [{ type: 'news', text: 'Vito now runs Hillside.' }]);
});
