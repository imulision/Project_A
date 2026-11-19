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
  const d = D.createDistrict({ capo: 'sal', dirty: 1400, profit: 30, men: 16, sites: { still: 3 } });
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
  const d = D.createDistrict({ capo: 'dutch', dirty: 1400, heat: 50, profit: 30, men: 16, sites: { still: 3 } });
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
  const d = D.createDistrict({ capo: 'vince', profit: 60, share: 50, dirty: 900, men: 22, sites: { still: 5, speakeasy: 3 } });
  assert.notEqual(D.chooseProject(d).kind, 'push');
  d.crews = 3; d.collectors = 3; d.men = 36;
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
  const d = D.createDistrict({ capo: 'danny', profit: 60, share: 50, dirty: 900, men: 40, sites: { still: 4, speakeasy: 3 } });
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
  const { d, kinds } = fiveYears('dutch', DOCKS);
  assert.ok(kinds.has('fence'), 'the police may shut them, but he opens fences');
  assert.equal(d.name, 'The Docks');
});

test('a capo sorts out the liquor before he branches out', () => {
  const d = D.createDistrict({ capo: 'danny', dirty: 3000, share: 80, sites: { still: 1, speakeasy: 2 }, ...DOCKS });
  assert.ok(!D.RACKETS.includes(D.chooseProject(d).kind));
  d.sites.still = 7; d.sites.speakeasy = 5; // now the liquor flows
  d.sites.gambling = 5; d.sites.loft = 2; d.levels.gambling = 3; d.levels.loft = 3; // his rooms are as big as they get
   d.sites.warehouse = 2; d.sites.front = 6; d.dirty = 6000; d.crews = 4; d.collectors = 3; d.men = 80;
  d.trucks = 8; d.cars = 12; // and it is carried
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

test('a capo who has just been attacked posts guards before anything else', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 3000, attacked: 4 });
  assert.equal(D.chooseProject(d).kind, 'guard');
  for (let i = 0; i < 4; i++) D.stepMonth(d);
  assert.equal(d.attacked, 0);
});

test('a street crew takes streets even under a capo with no muscle of his own', () => {
  const without = D.createDistrict({ capo: 'mae' });
  const withCrew = D.createDistrict({ capo: 'mae' });
  withCrew.crews = 1;
  assert.ok(D.streetsChange(withCrew) - D.streetsChange(without) >= 0.79);
});

test('the rivals do not bother with a family that holds only a few streets', () => {
  const few = D.createDistrict({ capo: 'mae', share: 5 });
  const many = D.createDistrict({ capo: 'mae', share: 30 });
  assert.ok(D.streetsChange(few) > D.streetsChange(many) + 0.7);
});

// --- integration: a whole year, the boss touching nothing but the name ---

test('a year under Sal: streets taken by force, then the police and a hated name', () => {
  const { d, events } = year('sal');
  const raids = events.filter((e) => e.type === 'raid');
  assert.equal(raids.length, 1);
  assert.equal(raids[0].site, 'speakeasy');
  assert.equal(raids[0].arrested, 3);
  assert.equal(d.men, 20);
  near(d.share, 52);
  near(d.heat, 53);
  near(d.goodwill, 26);
  near(d.boss.dirty, 1328);
  near(d.boss.clean, 112);
  assert.deepEqual(places(d), { still: 2, speakeasy: 1, rented: 1, warehouse: 2 });
  const kinds = events.filter((e) => e.type === 'decision').map((e) => e.kind);
  assert.deepEqual(kinds.slice(0, 8), ['protection', 'seize', 'push', 'seize', 'protection', 'push', 'protection', 'push']);
  assert.ok(kinds.slice(8).includes('lielow'));
});

test('a year under Mae: clean money and quiet, and not one street gained', () => {
  const { d, events } = year('mae');
  assert.equal(d.men, 26);
  near(d.share, 29);
  near(d.heat, 37);
  near(d.goodwill, 54);
  assert.equal(d.raids, 0);
  assert.equal(events.filter((e) => e.type === 'raid').length, 0);
  near(d.boss.clean, 1859);
  near(d.boss.dirty, 1862);
  assert.deepEqual(places(d), { still: 3, speakeasy: 2, gambling: 2, rented: 3, front: 1, loans: 2 });
  assert.equal(d.cars, 3, 'she bought a car when the money outgrew two');
});

test('naming the capo is enough to get two different districts', () => {
  const sal = year('sal').d, mae = year('mae').d;
  assert.ok(sal.share > mae.share + 10);
  assert.ok(sal.heat > mae.heat + 10);
  assert.ok(mae.goodwill > sal.goodwill + 20);
  assert.ok(mae.boss.clean > 1500 && sal.boss.clean < 200);
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

test('a small outfit with thirsty streets grows its stills and its speakeasies in turn', () => {
  for (const capo of ['mae', 'dutch']) { // the two who think of trade first
    const d = D.createDistrict({ capo, share: 30, men: 11, dirty: 1400, sites: { still: 1, speakeasy: 1 } });
    for (let i = 0; i < 12; i++) D.stepMonth(d);
    assert.ok(d.sites.still >= 2 && d.sites.speakeasy >= 2, `${capo}: ${d.sites.still} still, ${d.sites.speakeasy} speakeasy after a year`);
  }
});

test('a capo who cannot pay a whole new crew hires just the men the job needs', () => {
  const d = D.createDistrict({ capo: 'tommy', men: 7, guards: 2, share: 35, dirty: 1400, profit: 150, sites: { still: 1, speakeasy: 1 } });
  const idle = d.men - D.busyMen(d);
  assert.equal(idle, 0);
  const pick = D.chooseProject(d);
  assert.notEqual(pick.kind, 'hold', pick.why);
  assert.equal(pick.hire, pick.men - idle);
});

test('a capo who holds few streets but is gaining ground does not hide behind guards', () => {
  const d = D.createDistrict({ capo: 'mae', share: 15, crews: 1, men: 12, dirty: 300, sites: { still: 1, speakeasy: 1 } });
  assert.ok(D.streetsChange(d) > 0);
  assert.notEqual(D.chooseProject(d).kind, 'guard');
  d.crews = 0; d.goodwill = 20; d.share = 24;
  assert.ok(D.streetsChange(d) < 0);
  assert.equal(D.chooseProject(d).kind, 'guard');
});

test('a capo whose district barely pays does not keep a roomful of idle men', () => {
  const d = D.createDistrict({ capo: 'danny', men: 21, guards: 4, share: 20, dirty: 700, profit: 20, pulledBack: 3, collectors: 1, sites: { still: 2, speakeasy: 1, rented: 1, warehouse: 1 } });
  assert.equal(D.chooseProject(d).kind, 'trim');
});

// --- what moves on the streets: the trips of the month, for the map to show ---
const ids = (d) => D.buildings(d).map((b) => b.id);
const tripsOf = (d, kind) => D.trips(d).filter((t) => t.kind === kind);

test('before the first month, nothing moves', () => {
  assert.deepEqual(D.trips(D.createDistrict({ capo: 'sal' })), []);
});

test('a car brings the takings of every place that earns back to the hideout', () => {
  const d = D.createDistrict({ capo: 'dutch', sites: { gambling: 1 } });
  D.stepMonth(d);
  const from = tripsOf(d, 'takings').map((t) => t.from);
  assert.ok(from.some((id) => /-speakeasy-1$/.test(id)) && from.some((id) => /-gambling-1$/.test(id)));
  assert.ok(tripsOf(d, 'takings').every((t) => t.to === 'hideout' && t.vehicle === 'car'));
});

test('dirty money is driven to the laundry, and the boss\'s cut leaves the district', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 3000, sites: { rented: 1 } });
  D.stepMonth(d);
  const wash = tripsOf(d, 'laundering');
  assert.equal(wash.length, 1);
  assert.match(wash[0].to, /-rented-1$/);
  near(wash[0].amount, d.last.washed);
  const cut = tripsOf(d, 'tribute');
  assert.equal(cut.length, 1);
  assert.equal(cut[0].to, 'boss');
  near(cut[0].amount, d.last.owed - d.last.skim);
});

test('street crews and collectors go out, and those trips are marked as violent', () => {
  const d = D.createDistrict({ capo: 'mae', crews: 2, collectors: 1, men: 30, heat: 0 });
  D.stepMonth(d);
  const crews = tripsOf(d, 'streets'), rounds = tripsOf(d, 'collection');
  assert.equal(crews.length, d.crews);
  assert.equal(rounds.length, d.collectors);
  assert.ok(crews.concat(rounds).every((t) => t.violent && t.from === 'hideout' && t.men > 0));
  assert.ok(crews.every((t) => t.to === 'streets') && rounds.every((t) => t.to === 'shops'));
});

test('opening a place sends a works truck to the new building, and a seizure sends armed men', () => {
  const d = D.createDistrict({ capo: 'dutch', dirty: 1400, sites: { still: 1 } }); // dry speakeasies: he builds a still
  assert.equal(D.stepMonth(d)[0].kind, 'still');
  const works = tripsOf(d, 'works');
  assert.equal(works.length, 1);
  assert.match(works[0].to, /-still-2$/);
  assert.equal(works[0].vehicle, 'truck');

  const s = D.createDistrict({ capo: 'sal', dirty: 1400, collectors: 1, men: 20 });
  s.dirty = 1400;
  const first = D.stepMonth(s)[0];
  assert.equal(first.kind, 'seize');
  const taken = tripsOf(s, 'seizure');
  assert.equal(taken.length, 1);
  assert.ok(taken[0].violent);
  assert.match(taken[0].to, /-warehouse-1$/);
});

test('a police raid shows as police cars driving to the place they shut', () => {
  const d = D.createDistrict({ capo: 'sal', heat: 75 });
  const raid = D.stepMonth(d).find((e) => e.type === 'raid');
  assert.ok(raid);
  const t = tripsOf(d, 'raid');
  assert.equal(t.length, 1);
  assert.equal(t[0].from, 'police');
  assert.equal(t[0].vehicle, 'police');
  assert.match(t[0].to, new RegExp('-' + raid.site + '-\\d+$'));
});

test('every trip says which flow it belongs to, so the map can colour it', () => {
  const d = D.createDistrict({ capo: 'sal', heat: 75, crews: 2, collectors: 2, men: 30, dirty: 3000, sites: { rented: 1, gambling: 1 } });
  D.stepMonth(d);
  const flowOf = {};
  for (const t of D.trips(d)) flowOf[t.kind] = t.flow;
  assert.deepEqual([flowOf.liquor, flowOf.takings, flowOf.laundering, flowOf.tribute, flowOf.streets, flowOf.collection, flowOf.raid],
    ['logistics', 'sales', 'money', 'money', 'violence', 'violence', 'violence']);
  assert.ok(D.trips(d).every((t) => D.FLOWS.includes(t.flow)));
});

test('the takings carried from a place are what it earned that month', () => {
  const d = D.createDistrict({ capo: 'dutch', sites: { gambling: 1 } });
  D.stepMonth(d);
  const total = tripsOf(d, 'takings').reduce((n, t) => n + t.amount, 0);
  near(total, d.last.income, 1);
});

test('the flows of a district read as one chain: made, in the cellar, sold, earned, washed, sent up', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 3000, sites: { rented: 1 } });
  D.stepMonth(d);
  const f = D.flows(d);
  assert.ok(f.made > 0 && f.sold > 0 && f.sold <= f.made + 0.01);
  near(f.stock, d.stock);
  near(f.sold, d.last.sold);
  assert.equal(f.seats, d.sites.speakeasy * D.SITES.speakeasy.seats);
  near(f.income, d.last.income); near(f.costs, d.last.costs); near(f.profit, d.last.profit);
  near(f.washed, d.last.washed);
  near(f.tribute, d.last.owed - d.last.skim);
  assert.ok(['stills', 'seats', 'drinkers'].includes(f.limit));
  assert.equal(D.flows(D.createDistrict({ capo: 'mae' })).sold, 0);
});

test('a capo with a grudge keeps more of the boss\'s cut for himself', () => {
  const fair = D.createDistrict({ capo: 'sal' }), sore = D.createDistrict({ capo: 'sal', grudge: 2 });
  D.stepMonth(fair); D.stepMonth(sore);
  assert.ok(sore.last.skim > fair.last.skim * 1.3);
  assert.ok(sore.boss.dirty + sore.boss.clean < fair.boss.dirty + fair.boss.clean);
});

// --- what a capo practises, and what his abilities change ---
test('the wheel has six sectors of three abilities, each with a name and words for the screen', () => {
  assert.deepEqual(D.SECTORS, ['liquor', 'vice', 'money', 'law', 'muscle', 'routes']);
  for (const s of D.SECTORS) {
    assert.equal(D.WHEEL[s].length, 3);
    for (const a of D.WHEEL[s]) assert.ok(a.id && a.name && a.text && Object.keys(a.effect).length > 0, s);
  }
  const all = D.SECTORS.flatMap((s) => D.WHEEL[s].map((a) => a.id));
  assert.equal(new Set(all).size, 18);
});

test('a capo practises what his district actually does', () => {
  const street = D.createDistrict({ capo: 'sal', crews: 2, collectors: 1, men: 30 });
  const books = D.createDistrict({ capo: 'mae', dirty: 3000, sites: { rented: 2 } });
  assert.deepEqual(D.practice(street), { liquor: 0, vice: 0, money: 0, law: 0, muscle: 0, routes: 0 }, 'nothing before the first month');
  D.stepMonth(street); D.stepMonth(books);
  const a = D.practice(street), b = D.practice(books);
  assert.ok(a.muscle > a.money && a.muscle >= 2);
  assert.ok(b.money > b.muscle && b.money > 1);
  assert.ok(a.liquor > 0 && b.liquor > 0, 'both sell liquor');
});

test('an ability changes what the district does: a distillery makes more, double books wash more', () => {
  const plain = D.createDistrict({ capo: 'dutch' }), skilled = D.createDistrict({ capo: 'dutch', skills: ['distillery'] });
  D.stepMonth(plain); D.stepMonth(skilled);
  assert.ok(D.flows(skilled).made > D.flows(plain).made * 1.2);

  const a = D.createDistrict({ capo: 'mae', dirty: 3000, sites: { rented: 1 } });
  const b = D.createDistrict({ capo: 'mae', dirty: 3000, sites: { rented: 1 }, skills: ['double-books'] });
  D.stepMonth(a); D.stepMonth(b);
  assert.ok(b.last.washed > a.last.washed * 1.2);
});

test('armed crews take more streets, and paid beat cops cool the district faster', () => {
  const a = D.createDistrict({ capo: 'sal', crews: 2 }), b = D.createDistrict({ capo: 'sal', crews: 2, skills: ['armed-crews'] });
  assert.ok(D.streetsChange(b) > D.streetsChange(a) + 0.5);
  const c = D.createDistrict({ capo: 'tommy', heat: 40 }), e = D.createDistrict({ capo: 'tommy', heat: 40, skills: ['beat-cops'] });
  D.stepMonth(c); D.stepMonth(e);
  assert.ok(e.heat < c.heat - 0.9);
});

test('a district rejects an ability that is not on the wheel', () => {
  assert.throws(() => D.createDistrict({ capo: 'sal', skills: ['laser'] }), /unknown ability/);
});

test('a capo of rank keeps a little more of the cut: veterans cost more', () => {
  const young = D.createDistrict({ capo: 'sal' }), old = D.createDistrict({ capo: 'sal', rank: 3 });
  D.stepMonth(young); D.stepMonth(old);
  assert.ok(old.last.skim > young.last.skim);
});

test('a capo who loses money sends home the guards he does not need', () => {
  const d = D.createDistrict({ capo: 'danny', men: 11, guards: 6, share: 30, profit: -80, dirty: 600, sites: { still: 1, speakeasy: 1 } });
  assert.equal(d.men - D.busyMen(d), 0);
  const pick = D.chooseProject(d);
  assert.equal(pick.kind, 'standdown');
  D.stepMonth(d);
  assert.equal(d.guards, 4);
  const hit = D.createDistrict({ capo: 'danny', men: 11, guards: 6, share: 30, profit: -80, dirty: 600, attacked: 3, sites: { still: 1, speakeasy: 1 } });
  assert.notEqual(D.chooseProject(hit).kind, 'standdown', 'not while the rivals are on him');
});

test('when the street has turned against him, a capo takes a collector off the shops', () => {
  const d = D.createDistrict({ capo: 'danny', collectors: 3, men: 20, goodwill: 9, share: 40, pulledBack: 3 });
  assert.equal(D.chooseProject(d).kind, 'ease');
  D.stepMonth(d);
  assert.equal(d.collectors, 2);
});

test('a capo does not send collectors round a district where he holds too few streets to make them pay', () => {
  const few = D.createDistrict({ capo: 'sal', share: 18, crews: 1, men: 20 }), enough = D.createDistrict({ capo: 'sal', share: 35, crews: 1, men: 20 });
  assert.notEqual(D.chooseProject(few).kind, 'protection');
  assert.equal(D.chooseProject(enough).kind, 'protection');
});

test('a capo who has been hit posts guards until he can stand up to what hit him, however weak he is himself', () => {
  const d = D.createDistrict({ capo: 'mae', guards: 6, men: 40, attacked: 6, threat: 6, dirty: 1400 });
  assert.ok(D.defence(d) < 6);
  assert.equal(D.chooseProject(d).kind, 'guard');
  const safe = D.createDistrict({ capo: 'sal', guards: 6, men: 40, attacked: 6, threat: 6, dirty: 1400 });
  assert.ok(D.defence(safe) >= 6);
  assert.notEqual(D.chooseProject(safe).kind, 'guard');
});

test('hired guns make every guard count for more when the rivals come', () => {
  const a = D.createDistrict({ capo: 'mae', guards: 4 }), b = D.createDistrict({ capo: 'mae', guards: 4, skills: ['hired-guns'] });
  assert.ok(D.defence(b) > D.defence(a) * 1.4);
});

// --- vehicles are a real resource: trucks haul crates, cars carry money ---
test('a district starts with two trucks and two cars, and they cost upkeep', () => {
  const d = D.createDistrict({ capo: 'dutch' }), none = D.createDistrict({ capo: 'dutch', trucks: 0, cars: 0 });
  assert.deepEqual([d.trucks, d.cars], [2, 2]);
  D.stepMonth(d); D.stepMonth(none);
  assert.ok(d.last.costs > none.last.costs);
});

test('liquor that no truck can carry stays in the cellar', () => {
  const d = D.createDistrict({ capo: 'dutch', trucks: 1, share: 60, dirty: 0, sites: { still: 4, speakeasy: 4 } });
  D.stepMonth(d);
  near(d.last.sold, D.RULES.truckLoad);
  assert.equal(D.flows(d).limit, 'trucks');
  assert.equal(D.flows(d).hauling, D.RULES.truckLoad);
  assert.ok(d.stock > 0);
});

test('money that no car comes for is left in the tills and lost', () => {
  const few = D.createDistrict({ capo: 'dutch', cars: 1, share: 60, sites: { still: 4, speakeasy: 4, gambling: 3 }, trucks: 6 });
  const enough = D.createDistrict({ capo: 'dutch', cars: 6, share: 60, sites: { still: 4, speakeasy: 4, gambling: 3 }, trucks: 6 });
  D.stepMonth(few); D.stepMonth(enough);
  near(few.last.income, D.RULES.carLoad);
  assert.ok(enough.last.income > few.last.income + 500);
  assert.ok(few.last.uncollected > 500);
  assert.equal(enough.last.uncollected, 0);
});

test('a capo buys a truck when hauling is what holds his sales back, and a car when money is left behind', () => {
  const dry = D.createDistrict({ capo: 'dutch', trucks: 1, share: 60, dirty: 2000, sites: { still: 4, speakeasy: 4 } });
  const pick = D.chooseProject(dry);
  assert.equal(pick.kind, 'truck');
  D.stepMonth(dry);
  assert.equal(dry.trucks, 2);

  const rich = D.createDistrict({ capo: 'mae', cars: 1, trucks: 6, men: 40, share: 60, dirty: 2000, sites: { still: 4, speakeasy: 4, gambling: 3 } });
  assert.equal(D.chooseProject(rich).kind, 'car');
});

test('one liquor run per truck on the road, none carrying more than a truck holds', () => {
  const d = D.createDistrict({ capo: 'dutch', trucks: 3, share: 60, sites: { still: 4, speakeasy: 4 } });
  D.stepMonth(d);
  const runs = tripsOf(d, 'liquor');
  assert.equal(runs.length, Math.ceil(d.last.sold / D.RULES.truckLoad));
  assert.ok(runs.length <= d.trucks);
  assert.ok(runs.every((t) => t.crates <= D.RULES.truckLoad + 0.01 && /-still-\d+$/.test(t.from) && /-speakeasy-\d+$/.test(t.to)));
  near(runs.reduce((n, t) => n + t.crates, 0), d.last.sold);
});

test('a capo who needs the money keeps his collectors on the shops, hated or not', () => {
  const d = D.createDistrict({ capo: 'danny', collectors: 3, men: 20, goodwill: 9, share: 40, pulledBack: 3, profit: 40 });
  assert.notEqual(D.chooseProject(d).kind, 'ease');
});

test('a capo who loses money lets every idle man go at once', () => {
  const d = D.createDistrict({ capo: 'vince', men: 30, profit: -200, dirty: 900 });
  const idle = d.men - D.busyMen(d);
  assert.ok(idle > 10);
  assert.equal(D.chooseProject(d).kind, 'trim');
  D.stepMonth(d);
  assert.equal(d.men - D.busyMen(d), 0);
});

test('a capo whose district barely pays puts the payroll money into the still or the speakeasy that would save it', () => {
  const d = D.createDistrict({ capo: 'sal', men: 10, share: 60, dirty: 700, profit: -100, sites: { still: 1, speakeasy: 2 } });
  assert.equal(D.chooseProject(d).kind, 'still');
  const fine = D.createDistrict({ capo: 'mae', men: 13, share: 60, dirty: 700, profit: 600, sites: { still: 1, speakeasy: 2 } });
  assert.notEqual(D.chooseProject(fine).kind, 'still', 'not while the district pays: the payroll comes first');
});

test('a capo left with no still and no money starts again with his own men and his own money', () => {
  const d = D.createDistrict({ capo: 'sal', men: 4, guards: 2, share: 40, dirty: 0, profit: -300, sites: { still: 0, speakeasy: 0, warehouse: 2 } });
  assert.equal(D.chooseProject(d).kind, 'restart');
  D.stepMonth(d);
  D.stepMonth(d);
  assert.deepEqual([d.sites.still, d.sites.speakeasy], [1, 1]);
  assert.ok(d.men >= D.busyMen(d));
  D.stepMonth(d);
  assert.ok(d.last.sold > 0);
});

// --- buildings grow: a capo enlarges his places instead of always opening another ---
test('every place starts at level 1, and the map is told the level of each building', () => {
  const d = D.createDistrict({ capo: 'dutch', levels: { still: 2 } });
  assert.deepEqual([d.levels.still, d.levels.speakeasy], [2, 1]);
  const b = D.buildings(d);
  assert.ok(b.filter((x) => x.type === 'still').every((x) => x.level === 2));
  assert.ok(b.filter((x) => x.type === 'speakeasy').every((x) => x.level === 1));
});

test('bigger stills make more and bigger speakeasies seat more', () => {
  const small = D.createDistrict({ capo: 'dutch' }), big = D.createDistrict({ capo: 'dutch', levels: { still: 2, speakeasy: 3 } });
  D.stepMonth(small); D.stepMonth(big);
  near(D.flows(big).made, D.flows(small).made * 1.5);
  near(D.flows(big).seats, D.flows(small).seats * 2);
});

test('a capo with three stills enlarges them rather than squeeze in a fourth', () => {
  const d = D.createDistrict({ capo: 'dutch', share: 90, men: 30, dirty: 4000, trucks: 8, cars: 8, sites: { still: 3, speakeasy: 5 } });
  const pick = D.chooseProject(d);
  assert.deepEqual([pick.kind, pick.men], ['enlarge-still', 0]);
  const before = d.dirty;
  const e = D.stepMonth(d)[0];
  assert.equal(e.kind, 'enlarge-still');
  assert.deepEqual([d.levels.still, d.sites.still], [2, 3]);
  assert.ok(before - d.dirty > 0 || d.last.profit > 0);
});

test('with only two stills he still opens a third, and nothing grows past level 3', () => {
  const few = D.createDistrict({ capo: 'dutch', share: 90, men: 30, dirty: 4000, trucks: 8, cars: 8, sites: { still: 2, speakeasy: 5 } });
  assert.equal(D.chooseProject(few).kind, 'still');
  const top = D.createDistrict({ capo: 'dutch', share: 100, men: 60, dirty: 4000, trucks: 20, cars: 20, sites: { still: 3, speakeasy: 9 }, levels: { still: 3, speakeasy: 3 } });
  assert.equal(D.chooseProject(top).kind, 'still');
});

test('when the last place of a kind is lost, what is rebuilt starts small again', () => {
  const d = D.createDistrict({ capo: 'sal', heat: 90, sites: { still: 1, speakeasy: 1 }, levels: { still: 3 } });
  const raid = D.stepMonth(d).find((e) => e.type === 'raid');
  assert.equal(raid.site, 'still');
  assert.equal(d.sites.still, 0);
  assert.equal(d.levels.still, 1);
});

// --- what the capo is after ---
test('a capo says what he is saving for and how far along he is', () => {
  const d = D.createDistrict({ capo: 'mae', dirty: 0, share: 15, men: 11 }); // a poor start: she has to save
  let seen = 0;
  for (let i = 0; i < 36; i++) {
    D.stepMonth(d);
    const p = D.plan(d);
    assert.ok(p.kind && p.label, 'always something to say');
    assert.ok(p.progress >= 0 && p.progress <= 1);
    if (p.cost > 0 && p.progress < 1) { seen++; assert.ok(p.saved < p.cost); }
  }
  assert.ok(seen > 0, 'at some point he was saving for something he could not yet pay');
});

test('the plan of a capo changes nothing in his district', () => {
  const d = D.createDistrict({ capo: 'sal' });
  const before = JSON.stringify(d);
  D.plan(d);
  assert.equal(JSON.stringify(d), before);
});

test('the map is told which places launder and what every vehicle carries', () => {
  const d = D.createDistrict({ capo: 'dutch' });
  for (let i = 0; i < 24; i++) D.stepMonth(d);
  const roles = Object.fromEntries(D.buildings(d).map((b) => [b.type, b.role]));
  assert.equal(roles.rented, 'laundering');
  assert.equal(roles.still, 'production');
  assert.equal(roles.speakeasy, 'sales');
  const cargo = Object.fromEntries(D.trips(d).map((t) => [t.kind, t.cargo]));
  assert.equal(cargo.liquor, 'liquor');
  assert.equal(cargo.takings, 'dirty-cash');
  assert.equal(cargo.laundering, 'dirty-cash');
  assert.equal(cargo.tribute, 'cash');
  assert.ok(D.trips(d).every((t) => t.cargo));
});

test('the map is told where the money of a district sits, place by place', () => {
  const d = D.createDistrict({ capo: 'dutch' });
  for (let i = 0; i < 24; i++) D.stepMonth(d);
  const cash = D.cash(d);
  const ids = D.buildings(d).map((b) => b.id);
  const at = (kind) => cash.filter((c) => c.kind === kind);
  assert.deepEqual(at('dirty').map((c) => [c.at, c.amount]), [['hideout', d.dirty]]);
  assert.deepEqual(at('clean').map((c) => [c.at, c.amount]), [['hideout', d.clean]]);
  assert.ok(at('takings').length >= 1 && at('takings').every((c) => ids.includes(c.at) && c.amount > 0));
  assert.ok(at('washing').length >= 1 && at('washing').every((c) => ids.includes(c.at)));
  const washed = at('washing').reduce((n, c) => n + c.amount, 0);
  assert.ok(Math.abs(washed - d.last.washed) < 0.01, 'the laundries share what was washed last month');
  assert.deepEqual(D.cash(D.createDistrict({ capo: 'sal' })).filter((c) => c.kind === 'takings'), []);
});

// --- the building tree: what the family knows how to run, and how big ---
const OPEN = { still: 1, speakeasy: 1, rented: 1, warehouse: 1 };
const knowing = (more) => { const t = {}; for (const k of Object.keys(D.SITES)) t[k] = 0; return Object.assign(t, OPEN, more); };
const live = (d, months) => { for (let i = 0; i < months; i++) D.stepMonth(d); return d; };

test('a district on its own knows every trade, at the highest tier', () => {
  const d = D.createDistrict({ capo: 'danny' });
  for (const k of Object.keys(D.SITES)) assert.equal(d.tech[k], D.RULES.maxLevel, k);
});

test('a capo never opens a place the family has not learned to run', () => {
  const d = live(D.createDistrict({ capo: 'danny', tech: knowing({}) }), 60);
  for (const k of Object.keys(D.SITES)) if (!OPEN[k]) assert.equal(d.sites[k], 0, k);
  assert.ok(d.sites.still > 0 && d.sites.speakeasy > 0);
  const free = live(D.createDistrict({ capo: 'danny' }), 60);
  assert.ok(free.sites.gambling > 0, 'the same man opens gambling rooms once the family knows how');
});

test('a capo says which closed trade he would open, and whether it is to his taste', () => {
  const d = D.createDistrict({ capo: 'danny', tech: knowing({}), dirty: 3000 });
  const wish = D.wish(d);
  assert.equal(wish.site, 'gambling');
  assert.equal(wish.liked, true);
  assert.match(wish.label, /gambling/i);
  assert.equal(D.wish(D.createDistrict({ capo: 'danny' })), null, 'nothing is closed to him');
  const mae = D.createDistrict({ capo: 'mae', tech: knowing({}), dirty: 3000 });
  assert.notEqual((D.wish(mae) || {}).site, 'loft', 'she refuses it: she does not ask for it');
});

test('a capo with nothing else to do says he waits for the family to learn his trade', () => {
  const d = D.createDistrict({ capo: 'danny', tech: knowing({}), share: 90, collectors: 3, heat: 10, sites: { still: 5, speakeasy: 5, rented: 4 }, trucks: 6, cars: 6, men: 60, pulledBack: 6 });
  assert.equal(D.chooseProject(d).kind, 'hold');
  const plan = D.plan(d);
  assert.equal(plan.waiting, 'research');
  assert.equal(plan.site, 'gambling');
});

test('places grow no bigger than the tier the family has reached', () => {
  const small = live(D.createDistrict({ capo: 'dutch', share: 90, tech: knowing({}) }), 96);
  assert.equal(small.levels.still, 1);
  assert.equal(small.levels.speakeasy, 1);
  const two = live(D.createDistrict({ capo: 'dutch', share: 90, tech: knowing({ still: 2, speakeasy: 2 }) }), 96);
  assert.ok(two.levels.still <= 2 && two.levels.speakeasy <= 2);
  assert.ok(Math.max(two.levels.still, two.levels.speakeasy) === 2, 'he enlarges up to tier II');
});

test('a bigger gambling room, loft or racket pays more, and a bigger front washes more', () => {
  const base = { capo: 'danny', sites: { gambling: 2, front: 1 } };
  const one = D.createDistrict(base), two = D.createDistrict({ ...base, levels: { gambling: 2, front: 2 } });
  assert.ok(D.sideIncome(two) > D.sideIncome(one));
  const before = one.clean, after = two.clean;
  one.dirty = two.dirty = 5000;
  D.stepMonth(one); D.stepMonth(two);
  assert.ok(two.clean - after > one.clean - before, 'the bigger front washed more');
});

test('once his rooms are all open, a capo enlarges them if the family knows how', () => {
  const d = live(D.createDistrict({ capo: 'dutch', share: 70 }), 120);
  assert.ok(d.levels.gambling > 1, 'gambling rooms at level ' + d.levels.gambling);
  const capped = live(D.createDistrict({ capo: 'dutch', share: 70, tech: knowing({ gambling: 1, loft: 1 }) }), 120);
  assert.equal(capped.levels.gambling, 1);
  assert.ok(d.levels.front > 1 && d.sites.front <= 4, 'three fronts, then bigger ones: ' + d.sites.front + ' at level ' + d.levels.front);
  assert.equal(D.buildings(d).find((b) => b.type === 'gambling').level, d.levels.gambling);
});
