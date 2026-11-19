// Rules for one district run by a capo. The boss only names the capo:
// everything else in here is the capo deciding and the month playing out.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../web/district.js');

const near = (actual, expected, slack = 0.51) =>
  assert.ok(Math.abs(actual - expected) <= slack, `expected about ${expected}, got ${actual}`);

// Only the kinds of place the district actually has.
function places(d) {
  return Object.fromEntries(Object.entries(d.sites).filter(([, n]) => n > 0));
}

function year(capo, overrides) {
  const d = D.createDistrict({ capo, ...overrides });
  const events = [];
  for (let i = 0; i < 12; i++) events.push(...D.stepMonth(d));
  return { d, events };
}

test('a new district starts as Hillside in January 1926', () => {
  const d = D.createDistrict({ capo: 'sal' });
  assert.equal(d.name, 'Hillside');
  assert.equal(d.month, 0);
  assert.equal(d.men, 14);
  assert.deepEqual(places(d), { still: 2, speakeasy: 2 });
  assert.equal(d.dirty, 800);
  assert.equal(d.clean, 300);
  assert.equal(d.share, 35);
});

test('an unknown capo is refused', () => {
  assert.throws(() => D.createDistrict({ capo: 'nobody' }), /unknown capo/);
});

test('the state survives a round trip through JSON', () => {
  const d = D.createDistrict({ capo: 'mae' });
  D.stepMonth(d);
  const copy = JSON.parse(JSON.stringify(d));
  D.stepMonth(d);
  D.stepMonth(copy);
  assert.deepEqual(copy, d);
});

test('a capo never picks a project he refuses, however strong the need', () => {
  const sal = D.createDistrict({ capo: 'sal', heat: 58, dirty: 5000 });
  assert.notEqual(D.chooseProject(sal).kind, 'bribe');
});

test('a cunning capo buys the police when they get close', () => {
  const mae = D.createDistrict({ capo: 'mae', heat: 50, dirty: 900 });
  const pick = D.chooseProject(mae);
  assert.equal(pick.kind, 'bribe');
  assert.match(pick.why, /police/);
});

test('with the same full stash, each capo solves it his own way', () => {
  const state = { dirty: 1400, clean: 1500 };
  assert.equal(D.chooseProject(D.createDistrict({ capo: 'sal', ...state })).kind, 'seize');
  assert.equal(D.chooseProject(D.createDistrict({ capo: 'mae', ...state })).kind, 'front');
});

test('a project that needs more hands makes the capo hire, by his charisma', () => {
  const d = D.createDistrict({ capo: 'sal', dirty: 1400 });
  d.guards = 4; // nobody free
  const pick = D.chooseProject(d);
  assert.equal(pick.kind, 'seize');
  assert.equal(pick.hire, 4); // 2 + charisma 6 / 3
  D.stepMonth(d);
  assert.equal(d.men, 18);
  assert.equal(d.sites.warehouse, 1);
});

test('a capo who cannot pay new men holds steady and says why', () => {
  const d = D.createDistrict({ capo: 'sal', dirty: 1400, profit: 50 });
  d.guards = 4;
  const pick = D.chooseProject(d);
  assert.equal(pick.kind, 'hold');
  assert.match(pick.why, /cannot pay/);
});

test('a capo never spends the payroll on a project', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 600 }); // payroll is 560
  const pick = D.chooseProject(d);
  assert.ok(pick.kind === 'hold' || pick.cost === 0 || pick.cur === 'clean', JSON.stringify(pick));
});

test('the month reports the decision in plain words', () => {
  const d = D.createDistrict({ capo: 'sal' });
  const [first] = D.stepMonth(d);
  assert.equal(first.type, 'decision');
  assert.equal(first.kind, 'protection');
  assert.equal(first.label, 'Puts 2 men on protection');
  assert.equal(first.why, 'the shops on his streets pay nothing yet');
  assert.equal(d.month, 1);
});

test('the district only drinks what the streets it holds can drink', () => {
  const d = D.createDistrict({ capo: 'mae', share: 10, stock: 500 });
  D.stepMonth(d);
  near(d.last.sold, D.RULES.demand * 0.10, 0.01);
});

test('the boss is owed 30% of the profit, less what the capo skims', () => {
  const d = D.createDistrict({ capo: 'sal' });
  D.stepMonth(d);
  const owed = d.last.profit * 0.30;
  const skim = owed * (100 - D.CAPOS.sal.loyalty) / 250;
  near(d.boss.dirty + d.boss.clean, owed - skim, 0.01);
  near(d.last.skim, skim, 0.01);
});

test('a district that makes a loss owes nothing', () => {
  const d = D.createDistrict({ capo: 'sal', sites: { still: 0, speakeasy: 0 } });
  D.stepMonth(d);
  assert.ok(d.last.profit < 0);
  assert.equal(d.boss.dirty + d.boss.clean, 0);
});

test('a rented laundry washes little and loses a quarter on the way', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 3000, profit: 300, sites: { rented: 1, warehouse: 2 } });
  D.stepMonth(d);
  const cap = 300 * (0.6 + 0.05 * D.CAPOS.mae.cunning);
  near(d.last.washed, cap, 0.01);
  near(d.last.washLoss, cap * 0.25, 0.01);
});

test('the boss is paid in clean money as far as half the month\'s laundering goes', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 3000, profit: 300, sites: { rented: 1, warehouse: 2 } });
  D.stepMonth(d);
  near(d.boss.clean, d.last.washed * 0.75 * 0.5, 0.01);
  assert.ok(d.boss.dirty > 0);
});

test('a quarter of what overflows the stash disappears every month', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 6000, clean: 0 });
  D.stepMonth(d);
  assert.ok(d.last.overflow > 0);
  near(d.last.spilled, d.last.overflow * 0.25, 0.01);
});

test('at Heat 60 the police raid: a place is shut, cash is seized, Heat falls', () => {
  const d = D.createDistrict({ capo: 'sal', heat: 62 });
  const events = D.stepMonth(d);
  const raid = events.find((e) => e.type === 'raid');
  assert.ok(raid, 'expected a raid');
  assert.equal(raid.site, 'speakeasy');
  assert.equal(raid.seized, 500);
  assert.equal(d.sites.speakeasy, 1);
  assert.equal(d.raids, 1);
  assert.ok(d.heat < 60);
});

test('gauges stay between 0 and 100', () => {
  const { d } = year('sal', { goodwill: 3, heat: 97, share: 99 });
  for (const k of ['heat', 'goodwill', 'share']) assert.ok(d[k] >= 0 && d[k] <= 100, k + ' ' + d[k]);
});

test('every building of the district can be listed for the map', () => {
  const { d } = year('mae');
  const list = D.buildings(d);
  const count = Object.values(d.sites).reduce((a, b) => a + b, 0);
  assert.equal(list.length, count);
  for (const b of list) {
    assert.equal(b.district, 'Hillside');
    assert.equal(b.capo, 'mae');
    assert.ok(D.SITES[b.type], b.type);
    assert.equal(b.staff, D.SITES[b.type].staff);
    assert.ok(typeof b.id === 'string' && b.id.length > 0);
  }
  assert.equal(new Set(list.map((b) => b.id)).size, list.length);
});

test('a capo who cannot man his first choice falls back on one he can do alone', () => {
  const d = D.createDistrict({ capo: 'dutch', dirty: 1400, heat: 50, profit: 50 });
  d.guards = 4; // nobody free and no profit to hire: the warehouse he would seize is out of reach
  assert.equal(D.chooseProject(d).kind, 'bribe');
});

test('a capo stops opening places and sending crews once Heat passes his nerve', () => {
  const calm = D.createDistrict({ capo: 'tommy', heat: 20, dirty: 3000 });
  const hot = D.createDistrict({ capo: 'tommy', heat: D.nerve(D.CAPOS.tommy) + 1, dirty: 3000, bribing: true });
  assert.notEqual(D.chooseProject(calm).kind, 'hold');
  const pick = D.chooseProject(hot);
  const raisesHeat = ['push', 'protection', 'still', 'speakeasy', 'gambling', 'loft', 'seize'];
  assert.ok(!raisesHeat.includes(pick.kind), pick.kind);
});

test('an ambitious capo keeps going past the point where the police raid', () => {
  assert.ok(D.nerve(D.CAPOS.danny) > D.RULES.raidHeat);
  assert.ok(D.nerve(D.CAPOS.mae) < D.RULES.raidHeat);
});

test('a raid also picks up a crew working the street', () => {
  const d = D.createDistrict({ capo: 'mae', heat: 70, men: 30 });
  d.crews = 2; d.collectors = 3;
  const raid = D.stepMonth(d).find((e) => e.type === 'raid');
  assert.equal(raid.arrested, 3);
  assert.equal(d.crews, 1);
  assert.equal(d.men, 30 - 3);
});

test('after a raid the district is watched and the capo lies low for six months', () => {
  const d = D.createDistrict({ capo: 'danny', heat: 62, dirty: 3000 });
  D.stepMonth(d);
  assert.equal(d.raids, 1);
  const noisy = ['push', 'protection', 'still', 'speakeasy', 'gambling', 'loft', 'seize'];
  for (let i = 0; i < 5; i++) {
    const kind = D.stepMonth(d)[0].kind;
    assert.ok(!noisy.includes(kind), `month ${i + 1} after the raid: ${kind}`);
  }
});

test('a capo whose district barely pays stops sending men after new streets', () => {
  const d = D.createDistrict({ capo: 'vince', profit: 60, share: 50, dirty: 900 });
  assert.notEqual(D.chooseProject(d).kind, 'push');
  d.crews = 3; d.collectors = 3; d.men = 29;
  assert.equal(D.chooseProject(d).kind, 'recall');
});

test('a raid on a district with nothing left to shut still takes men and cash', () => {
  const d = D.createDistrict({ capo: 'sal', heat: 80, men: 20, sites: { still: 0, speakeasy: 1 } });
  d.collectors = 2;
  const raid = D.stepMonth(d).find((e) => e.type === 'raid');
  assert.ok(raid);
  assert.equal(raid.site, null);
  assert.equal(raid.arrested, 2);
  assert.equal(d.sites.speakeasy, 1);
});

test('a watched capo pulls men off the street until the Heat drops', () => {
  const d = D.createDistrict({ capo: 'sal', heat: 58, men: 30 });
  d.crews = 2; d.collectors = 3; d.watched = 5;
  const first = D.stepMonth(d)[0];
  assert.equal(first.kind, 'lielow');
  assert.equal(d.collectors, 2);
});

test('the last streets are the hardest: rivals push back harder above 60%', () => {
  const low = D.createDistrict({ capo: 'mae', share: 50 });
  const high = D.createDistrict({ capo: 'mae', share: 90 });
  D.stepMonth(low); D.stepMonth(high);
  assert.ok((90 - high.share) > (50 - low.share) + 4, `${50 - low.share} then ${90 - high.share}`);
});

test('a capo who is losing his last streets posts more guards', () => {
  const d = D.createDistrict({ capo: 'mae', share: 20, dirty: 700 });
  const kinds = [];
  for (let i = 0; i < 4; i++) kinds.push(D.stepMonth(d)[0].kind);
  assert.ok(kinds.includes('guard'), kinds.join(','));
  assert.ok(d.guards > 2);
});

test('no district is raided more than a few times a year, whoever runs it', () => {
  for (const capo of Object.keys(D.CAPOS)) {
    const d = D.createDistrict({ capo });
    for (let i = 0; i < 60; i++) D.stepMonth(d);
    assert.ok(d.raids <= 12, `${capo}: ${d.raids} raids in five years`);
  }
});

test('Goodwill is pulled back toward the middle: the higher it is, the harder it is to raise', () => {
  const mid = D.createDistrict({ capo: 'mae', goodwill: 50 });
  const high = D.createDistrict({ capo: 'mae', goodwill: 90 });
  const low = D.createDistrict({ capo: 'mae', goodwill: 10 });
  assert.ok(D.goodwillChange(high) < D.goodwillChange(mid));
  assert.ok(D.goodwillChange(low) > D.goodwillChange(mid));
});

test('a charismatic capo is better liked than a cold one in the same district', () => {
  const tommy = D.createDistrict({ capo: 'tommy' });
  const vince = D.createDistrict({ capo: 'vince' });
  assert.ok(D.goodwillChange(tommy) > D.goodwillChange(vince) + 0.5);
});

test('the same guards hold more streets under a capo with muscle', () => {
  const sal = D.createDistrict({ capo: 'sal' });
  const mae = D.createDistrict({ capo: 'mae' });
  sal.guards = mae.guards = 6;
  assert.ok(D.streetsChange(sal) > D.streetsChange(mae) + 0.5);
});

test('a capo who has just pulled men back does not send them out again for six months', () => {
  const d = D.createDistrict({ capo: 'danny', profit: 60, share: 50, dirty: 900, men: 29 });
  d.crews = 3; d.collectors = 3;
  assert.equal(D.stepMonth(d)[0].kind, 'recall');
  for (let i = 0; i < 5; i++) {
    d.profit = 2000; d.dirty = 3000; // business is good again
    assert.notEqual(D.stepMonth(d)[0].kind, 'push', `month ${i + 1} after the recall`);
  }
});

test('no capo sends and recalls the same men over and over', () => {
  for (const capo of Object.keys(D.CAPOS)) {
    for (const start of [{}, { heat: 55, goodwill: 30 }]) {
      const d = D.createDistrict({ capo, ...start });
      let recalls = 0;
      for (let i = 0; i < 60; i++) if (D.stepMonth(d)[0].kind === 'recall') recalls++;
      assert.ok(recalls <= 6, `${capo}: ${recalls} recalls in five years`);
    }
  }
});

test('after five years no district is loved or hated without limit, and none is empty', () => {
  for (const capo of Object.keys(D.CAPOS)) {
    const d = D.createDistrict({ capo });
    for (let i = 0; i < 60; i++) D.stepMonth(d);
    assert.ok(d.goodwill > 2 && d.goodwill < 98, `${capo}: goodwill ${d.goodwill}`);
    assert.ok(d.share >= 15, `${capo}: ${d.share}% of the streets`);
  }
});

// --- the other rackets, and what a district is good for ---

const DOCKS = { name: 'The Docks', traits: { nightlife: 0.8, industry: 1.2, port: 1.5, wealth: 0.5 } };

function fiveYears(capo, overrides) {
  const d = D.createDistrict({ capo, ...overrides });
  const kinds = new Set();
  for (let i = 0; i < 60; i++) kinds.add(D.stepMonth(d)[0].kind);
  return { d, kinds };
}

test('Hillside is a hill of houses: no port, little industry', () => {
  const d = D.createDistrict({ capo: 'dutch' });
  assert.equal(d.traits.port, 0);
  assert.ok(d.traits.industry < 0.5);
});

test('nobody fences hijacked goods in a district without a port', () => {
  for (const capo of Object.keys(D.CAPOS)) assert.equal(fiveYears(capo).d.sites.fence, 0, capo);
});

test('on the docks a bootlegger ends up fencing what comes off the ships', () => {
  const { d } = fiveYears('dutch', DOCKS);
  assert.ok(d.sites.fence > 0);
  assert.equal(d.name, 'The Docks');
});

test('a capo sorts out the liquor before he branches out', () => {
  const d = D.createDistrict({ capo: 'danny', dirty: 3000, share: 80, sites: { still: 1, speakeasy: 2 }, ...DOCKS });
  assert.ok(!D.RACKETS.includes(D.chooseProject(d).kind));
  d.sites.still = 7; d.sites.speakeasy = 5; // now the liquor flows
  d.sites.gambling = 5; d.sites.loft = 2; d.sites.warehouse = 2; d.sites.front = 6; d.dirty = 6000; d.crews = 4; d.collectors = 3; d.men = 80;
  assert.ok(D.RACKETS.includes(D.chooseProject(d).kind), D.chooseProject(d).kind);
});

test('a racket pays by what the district is good for', () => {
  const quiet = D.createDistrict({ capo: 'danny', sites: { brothel: 1 }, traits: { nightlife: 0.5 } });
  const lively = D.createDistrict({ capo: 'danny', sites: { brothel: 1 }, traits: { nightlife: 1.5 } });
  near(D.income(lively) - D.income(quiet), D.SITES.brothel.income, 0.01);
});

test('a racket pays by the stat of the capo that it calls for', () => {
  const sal = D.createDistrict({ capo: 'sal', sites: { loans: 1 } });
  const mae = D.createDistrict({ capo: 'mae', sites: { loans: 1 } });
  assert.ok(D.sideIncome(sal) > D.sideIncome(mae) + 50); // loan sharking is collected with Muscle
});

test('a brothel hears things: one secret a month for the family', () => {
  const d = D.createDistrict({ capo: 'danny', sites: { brothel: 2 } });
  D.stepMonth(d);
  assert.equal(d.secrets, 2);
});

test('what a capo refuses, he refuses in any district', () => {
  for (const capo of ['mae', 'tommy']) {
    const { d, kinds } = fiveYears(capo, { traits: { nightlife: 1.5 } });
    assert.ok(!kinds.has('brothel') && d.sites.brothel === 0, capo);
  }
});

test('with the family\'s routes behind him, what a capo ships out pays 30% more', () => {
  const alone = D.createDistrict({ capo: 'vince', sites: { chopshop: 1 }, traits: { industry: 1 } });
  const backed = D.createDistrict({ capo: 'vince', sites: { chopshop: 1 }, traits: { industry: 1 }, support: { routes: true } });
  const gain = D.income(backed) - D.income(alone);
  near(gain, D.SITES.chopshop.income * (0.8 + 0.04 * D.CAPOS.vince.cunning) * 0.3, 0.01);
});

test('with the family\'s bookkeeper behind him, a capo launders more and loses less', () => {
  const alone = D.createDistrict({ capo: 'sal', dirty: 3000, profit: 300, sites: { rented: 1, warehouse: 2 } });
  const backed = D.createDistrict({ capo: 'sal', dirty: 3000, profit: 300, sites: { rented: 1, warehouse: 2 }, support: { bookkeeper: true } });
  D.stepMonth(alone); D.stepMonth(backed);
  assert.ok(backed.last.washed > alone.last.washed + 200);
  assert.ok(backed.last.washLoss / backed.last.washed < alone.last.washLoss / alone.last.washed);
});

test('with the family\'s fixer behind him, a district cools faster', () => {
  const alone = D.createDistrict({ capo: 'sal', heat: 50 });
  const backed = D.createDistrict({ capo: 'sal', heat: 50, support: { fixer: true } });
  D.stepMonth(alone); D.stepMonth(backed);
  near(alone.heat - backed.heat, D.RULES.fixerCooling, 0.01);
});

test('a lively district gives its capo something to do for years', () => {
  const dull = fiveYears('mae');
  const lively = fiveYears('mae', { traits: { nightlife: 1.2, industry: 1.2, port: 1.2, wealth: 1.2 } });
  const rackets = (d) => ['brothel', 'chopshop', 'fence', 'loans', 'union'].reduce((n, k) => n + d.sites[k], 0);
  assert.ok(rackets(lively.d) > rackets(dull.d));
  assert.ok(lively.d.boss.dirty + lively.d.boss.clean > dull.d.boss.dirty + dull.d.boss.clean);
});

// --- integration: a whole year, the boss touching nothing but the name ---

test('a year under Sal: streets taken by force, then the police and a hated name', () => {
  const { d, events } = year('sal');
  const raids = events.filter((e) => e.type === 'raid');
  assert.equal(raids.length, 1);
  assert.equal(raids[0].site, 'speakeasy');
  assert.equal(raids[0].arrested, 3);
  assert.equal(d.men, 23);
  near(d.share, 50);
  near(d.heat, 53);
  near(d.goodwill, 26);
  near(d.boss.dirty, 1455);
  near(d.boss.clean, 130);
  assert.deepEqual(places(d), { still: 2, speakeasy: 1, rented: 1, warehouse: 2 });
  const kinds = events.filter((e) => e.type === 'decision').map((e) => e.kind);
  assert.deepEqual(kinds.slice(0, 8), ['protection', 'seize', 'seize', 'push', 'protection', 'push', 'protection', 'push']);
  assert.ok(kinds.slice(8).includes('lielow'));
});

test('a year under Mae: clean money and quiet, and not one street gained', () => {
  const { d, events } = year('mae');
  assert.equal(d.men, 26);
  near(d.share, 29);
  near(d.heat, 37);
  near(d.goodwill, 55);
  assert.equal(d.raids, 0);
  assert.equal(events.filter((e) => e.type === 'raid').length, 0);
  near(d.boss.clean, 2429);
  near(d.boss.dirty, 1252);
  assert.deepEqual(places(d), { still: 3, speakeasy: 2, gambling: 2, rented: 4, warehouse: 2, loans: 1 });
});

test('naming the capo is enough to get two different districts', () => {
  const sal = year('sal').d, mae = year('mae').d;
  assert.ok(sal.share > mae.share + 10);
  assert.ok(sal.heat > mae.heat + 10);
  assert.ok(mae.goodwill > sal.goodwill + 20);
  assert.ok(mae.boss.clean > 2000 && sal.boss.clean < 200);
  assert.ok(sal.raids > mae.raids);
});

test('every capo of the pool survives five years on any start without breaking the rules', () => {
  const starts = [{}, { share: 15, heat: 20 }, { heat: 55, goodwill: 30 }, { dirty: 100, clean: 0, men: 12 },
    { traits: { nightlife: 1.5, industry: 1.5, port: 1.5, wealth: 1.5 } }];
  for (const capo of Object.keys(D.CAPOS)) {
    for (const start of starts) {
      const d = D.createDistrict({ capo, ...start });
      for (let i = 0; i < 60; i++) {
        for (const e of D.stepMonth(d)) {
          if (e.type === 'decision') assert.ok(!D.CAPOS[capo].refuses.includes(e.kind), `${capo} did ${e.kind}`);
        }
        const busy = D.busyMen(d);
        assert.ok(busy <= d.men, `${capo}: ${busy} busy for ${d.men} men`);
        for (const k of ['dirty', 'clean', 'stock', 'men']) assert.ok(Number.isFinite(d[k]) && d[k] >= 0, `${capo} ${k} ${d[k]}`);
        for (const n of Object.values(d.sites)) assert.ok(n >= 0);
      }
    }
  }
});
