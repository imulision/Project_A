// What is carried: money by car, liquor, goods, cars and weed by truck, the risks of the road, convoys between cities.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const H = require('./turf-helpers.js');
const town = H.town, ALL = H.ALL, year = H.year, family = H.family, LOAD = H.LOAD, RUNS = H.RUNS, kept = H.kept, sixBars = H.sixBars,
  whereIs = H.whereIs, brewer = H.brewer, placeAt = H.placeAt, hauls = H.hauls, weed = H.weed, exposed = H.exposed, until = H.until,
  twoTowns = H.twoTowns, ROAD = H.ROAD;

// --- money is carried, run by run ---

const tills = (c) => T.view(c, T.createFamily()).places.reduce((n, p) => n + (p.till || 0), 0);

test('takings wait in the till of a place until one of the capo\'s cars fetches them: a full load a run, so many runs a month for a car', () => {
  const { c, f } = sixBars();
  const earned = T.income(c, 'dutch') - T.RULES.club;
  assert.ok(earned > 2 * RUNS * LOAD, 'six bars make more than two cars can carry');
  assert.equal(f.men.dutch.cars, 1);
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.length, RUNS);
  assert.ok(runs.every((t) => t.amount === LOAD && t.to.x === 2 && t.to.y === 2));
  assert.equal(new Set(runs.map((t) => t.from.x + ',' + t.from.y)).size, Math.min(6, RUNS), 'the fullest till first: every bar is visited before any is visited twice');
  assert.equal(f.men.dutch.income, T.RULES.club + RUNS * LOAD, 'he only has what reached his club');
  assert.ok(Math.abs(tills(c) - (earned - RUNS * LOAD)) < 1e-6, 'the rest waits where it was made');
  const man = T.view(c, f).capos[0];
  assert.deepEqual([man.cars, man.waiting], [1, Math.round(earned - RUNS * LOAD)]);
});

test('a second car brings home twice as much', () => {
  const { c, f } = sixBars();
  f.men.dutch.cars = 2;
  T.stepMonth(c, f);
  assert.equal(T.trips(c, f).filter((t) => t.kind === 'takings').length, 2 * RUNS);
  assert.equal(f.men.dutch.income, T.RULES.club + 2 * RUNS * LOAD);
});

test('when the tills pile up the capo buys another car, and says why', () => {
  const { c, f } = sixBars();
  f.men.dutch.cash = 5000;
  const bought = T.stepMonth(c, f).find((e) => e.type === 'car');
  assert.ok(bought);
  assert.deepEqual([bought.capo, bought.cars, bought.cost], ['dutch', 2, T.RULES.car.cost]);
  assert.match(bought.label, /Dutch buys a second car/);
  assert.equal(f.men.dutch.cars, 2);
  const { c: c2, f: f2 } = sixBars();
  f2.men.dutch.cash = 0;
  assert.ok(!T.stepMonth(c2, f2).some((e) => e.type === 'car'), 'not with empty pockets');
  const calm = town(), g = family();
  T.settle(calm, 'dutch', 2, 2); T.join(g, 'dutch'); g.men.dutch.cash = 5000;
  T.open(calm, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch' });
  for (const k of Object.keys(g.tech)) g.tech[k] = 0;
  assert.ok(!year(calm, g, 6).some((e) => e.type === 'car'), 'one car is plenty for one bar');
});

test('every car after the first costs its upkeep each month', () => {
  const after = (cars) => { const { c, f } = sixBars(); f.men.dutch.cars = cars; f.men.dutch.cash = 0; T.stepMonth(c, f); return { money: f.men.dutch.cash + f.dirty, tills: tills(c) }; };
  const five = after(5), six = after(6);
  assert.equal(five.tills, six.tills, 'five cars already carry every full load there is');
  assert.ok(Math.abs(five.money - six.money - T.RULES.car.upkeep) < 1e-6, 'one car more, with nothing more to carry, costs $' + T.RULES.car.upkeep);
  assert.ok(after(1).money < after(2).money, 'and a car that has loads to carry pays for itself');
  const { c, f } = sixBars(); f.men.dutch.cash = 0; T.stepMonth(c, f);
  assert.equal(f.men.dutch.cash + f.dirty, T.RULES.club + RUNS * LOAD - 6 * T.RULES.wage, 'the car a man came with costs nothing');
});

test('a car only leaves full: a small place waits until its till holds a whole load', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'rented', capo: 'dutch' });
  kept(c, 'dutch');
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  const made = T.income(c, 'dutch') - T.RULES.club;
  assert.ok(made > 0 && made < T.RULES.car.load / 2, 'it makes $' + made + ' a month');
  const months = Math.ceil(T.RULES.car.load / made);
  for (let m = 1; m < months; m++) {
    T.stepMonth(c, f);
    assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'takings'), [], 'month ' + m + ': not a full load yet');
    assert.equal(f.men.dutch.income, T.RULES.club);
  }
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.deepEqual(runs.map((t) => t.amount), [T.RULES.car.load]);
  assert.ok(Math.abs(tills(c) - (made * months - T.RULES.car.load)) < 1e-6, 'what is over stays for the next car');
});

// --- a free capo takes his own car to where his business chokes ---
const oneBar = () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 2 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

test('with nothing else on his hands a capo stands over his best place, and it makes more that month', () => {
  const { c, f } = oneBar();
  const plain = T.income(c, 'dutch') - T.RULES.club;
  T.stepMonth(c, f);
  const at = whereIs(c, f, 'dutch');
  assert.deepEqual([at.x, at.y, at.why], [3, 2, 'boost']);
  assert.match(at.label, /Standing over his .* in Lantern Row/);
  const made = f.men.dutch.income - T.RULES.club + tills(c);
  assert.ok(Math.abs(made - plain * (1 + T.RULES.own.boost)) < 1e-6, 'it made $' + made + ' instead of $' + plain);
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'capo'), [{ kind: 'capo', cargo: 'boost', capo: 'dutch', from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, vehicle: 'dutch:own', home: { x: 2, y: 2 } }]);
});

test('a capo who is busy elsewhere boosts nothing', () => {
  const { c, f } = oneBar();
  const plain = T.income(c, 'dutch') - T.RULES.club;
  T.open(c, 9, 3, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'dutch', x: 9, y: 3, way: 'buy', kind: 'speakeasy', cost: 1, month: 0, months: 6 });
  T.stepMonth(c, f);
  assert.equal(whereIs(c, f, 'dutch').why, 'take');
  assert.ok(Math.abs(f.men.dutch.income - T.RULES.club + tills(c) - plain) < 1e-6);
});

test('when the bars run dry he stands over his still, and it pours more', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  for (const [x, y] of [[1, 1], [2, 1], [3, 1]]) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 3 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  const dry = T.liquor(c).wet;
  assert.ok(dry < 1);
  T.stepMonth(c, f);
  const at = whereIs(c, f, 'dutch');
  assert.deepEqual([at.x, at.y, at.why], [8, 2, 'boost']);
  assert.ok(Math.abs(T.liquor(c).wet - dry * (1 + T.RULES.own.boost)) < 1e-6, 'the still pours a quarter more');
});

test('when his cars could not empty the tills last month, he drives the takings home himself', () => {
  const { c, f } = sixBars(true);
  f.men.dutch.cash = 0; // (no money for a second car)
  T.stepMonth(c, f);
  assert.ok(f.men.dutch.waiting >= LOAD, 'tills were left full');
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.length, RUNS * f.men.dutch.cars + T.RULES.own.runs);
  assert.equal(runs.filter((t) => t.own).length, T.RULES.own.runs, 'his own runs are marked');
  const at = whereIs(c, f, 'dutch'), mine = runs.find((t) => t.own);
  assert.deepEqual([at.x, at.y, at.why], [mine.from.x, mine.from.y, 'carry']);
  assert.match(at.label, /Driving the takings/);
  assert.equal(f.men.dutch.income, T.RULES.club + runs.length * LOAD);
});

// --- liquor is carried too: made in the still, kept in its cellar, driven to the bars one truckload at a time ---
const CRATES = T.RULES.truck.load;

test('a still makes its truckloads each month and the capo\'s truck drives them to the bars, one full load a run', () => {
  const { c, f } = brewer(2);
  assert.deepEqual(hauls(c, f), [], 'no month has gone by: no truck has left');
  T.stepMonth(c, f);
  const runs = hauls(c, f);
  assert.equal(runs.length, T.RULES.pours, 'a small still makes two loads a month');
  assert.ok(runs.every((t) => t.amount === CRATES && t.cargo === 'liquor' && t.capo === 'dutch' && t.from.x === 8 && t.from.y === 2));
  assert.deepEqual(runs.map((t) => t.to.x + ',' + t.to.y).sort(), ['1,1', '2,1'], 'one load for each bar');
  assert.equal(placeAt(c, f, 8, 2).stock, undefined, 'the cellar is empty again');
  assert.equal(T.view(c, f).capos[0].trucks, 1);
});

test('a bar earns in full only the month it has a load to pour', () => {
  const { c, f } = brewer(5);
  const one = T.income(c, 'dutch');
  T.stepMonth(c, f);
  const served = hauls(c, f).map((t) => t.to.x + ',' + t.to.y);
  assert.equal(served.length, 2);
  const bars = T.view(c, f).places.filter((p) => p.kind === 'speakeasy');
  for (const b of bars) {
    const wet = served.includes(b.x + ',' + b.y);
    assert.deepEqual((b.strains || []).map((s) => s.kind).filter((k) => k === 'dry'), wet ? [] : ['dry'], b.x + ',' + b.y);
  }
  assert.match(bars.find((b) => !served.includes(b.x + ',' + b.y)).strains.find((s) => s.kind === 'dry').label, /^Nothing to pour: no truck came this month$/);
  assert.ok(one > 0);
});

test('a bar keeps at most two loads on its shelf, and what the trucks cannot place stays in the cellar', () => {
  const { c, f } = brewer(1);
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, 2, 'the first month both loads go to the one bar');
  assert.equal(placeAt(c, f, 1, 1).stock, CRATES, 'it poured one and keeps one');
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, 1, 'the shelf has room for one more only');
  assert.equal(placeAt(c, f, 8, 2).stock, CRATES, 'the other load waits in the cellar');
});

test('a still nobody drinks from fills its cellar, stops there, and says so', () => {
  const { c, f } = brewer(0);
  for (let m = 0; m < 6; m++) T.stepMonth(c, f);
  const still = placeAt(c, f, 8, 2);
  assert.equal(still.stock, T.RULES.truck.cellar * T.RULES.pours * CRATES, 'two months of its own making');
  assert.deepEqual(still.strains.map((s) => s.kind), ['surplus']);
  assert.equal(still.strains[0].label, 'Cellar full: ' + still.stock + ' crates wait for a truck');
});

test('a truck makes so many runs a month: a second truck carries twice as much', () => {
  const big = (trucks) => {
    const { c, f } = brewer(6, { level: 3 });
    T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 }); // two big stills: eight loads a month
    f.men.dutch.trucks = trucks; f.men.dutch.cash = 0;
    T.stepMonth(c, f); T.stepMonth(c, f);
    return hauls(c, f).length;
  };
  assert.equal(big(1), T.RULES.truck.runs);
  assert.ok(big(2) > big(1));
});

test('when loads wait in his cellar while bars go dry, the capo buys another truck', () => {
  const { c, f } = brewer(6, { level: 3 });
  T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 });
  f.men.dutch.cash = 5000;
  let bought = null;
  for (let m = 0; m < 4 && !bought; m++) bought = T.stepMonth(c, f).find((e) => e.type === 'truck');
  assert.ok(bought);
  assert.deepEqual([bought.capo, bought.trucks, bought.cost], ['dutch', 2, T.RULES.truck.cost]);
  assert.match(bought.label, /Dutch buys a second truck/);
  const calm = brewer(2); calm.f.men.dutch.cash = 5000;
  assert.ok(!year(calm.c, calm.f, 6).some((e) => e.type === 'truck'), 'one truck is plenty for two bars');
});

test('the brewery is a still like no other: its capo\'s trucks drive its loads to every bar of the family', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch'); kept(c, 'dutch');
  T.settle(c, 'sal', 9, 4); T.join(f, 'sal'); kept(c, 'sal');
  T.open(c, 8, 3, { owner: 'family', kind: 'key', key: 'brewery', capo: 'dutch' });
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 10, 4, { owner: 'family', kind: 'speakeasy', capo: 'sal' });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  T.stepMonth(c, f);
  const runs = hauls(c, f);
  assert.ok(runs.every((t) => t.capo === 'dutch' && t.from.x === 8 && t.from.y === 3));
  assert.ok(runs.some((t) => t.to.x === 10 && t.to.y === 4), 'Sal\'s bar pours Dutch\'s beer');
});

// --- every vehicle is somebody's: it lives at his club, goes out, loads, and comes back ---
test('each run is made by one of the capo\'s own cars, numbered, out of his club and back', () => {
  const { c, f } = sixBars();
  f.men.dutch.cars = 2; f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.length, 2 * RUNS);
  assert.ok(runs.every((t) => t.home.x === 2 && t.home.y === 2), 'the car lives at his club');
  assert.deepEqual([...new Set(runs.map((t) => t.vehicle))].sort(), ['dutch:car:1', 'dutch:car:2']);
  for (const v of ['dutch:car:1', 'dutch:car:2']) {
    assert.deepEqual(runs.filter((t) => t.vehicle === v).map((t) => t.leg), [...Array(RUNS).keys()], v + ' makes its runs one after the other');
  }
});

test('the runs a capo drives himself are made in his own car, the one that takes him wherever he goes', () => {
  const { c, f } = sixBars(true);
  T.stepMonth(c, f); T.stepMonth(c, f);
  const own = T.trips(c, f).filter((t) => t.kind === 'takings' && t.own);
  assert.ok(own.length > 0 && own.every((t) => t.vehicle === 'dutch:own'));
  assert.deepEqual(own.map((t) => t.leg), [...Array(own.length).keys()]);
  const him = T.trips(c, f).find((t) => t.kind === 'capo');
  assert.deepEqual([him.vehicle, him.home], ['dutch:own', { x: 2, y: 2 }]);
});

test('each truckload is driven by one of the capo\'s trucks, out of his club and back', () => {
  const { c, f } = brewer(2);
  T.stepMonth(c, f);
  const runs = hauls(c, f);
  assert.ok(runs.every((t) => t.vehicle === 'dutch:truck:1' && t.home.x === 2 && t.home.y === 2));
  assert.deepEqual(runs.map((t) => t.leg), [0, 1]);
});

// --- other goods are carried the same way: hijacked goods and stolen cars go by truck to the fences ---
const dealer = (makers, fences) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  kept(c, 'dutch');
  makers.forEach((kind, i) => T.open(c, 8 + i, 2, { owner: 'family', kind, capo: 'dutch' }));
  [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]].slice(0, fences).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'fence', capo: 'dutch' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

const goods = (c, f) => T.trips(c, f).filter((t) => t.kind === 'goods');

test('a warehouse fills with hijacked goods and the capo\'s truck drives them to his fences, one full load a run', () => {
  const { c, f } = dealer(['warehouse'], 2);
  assert.deepEqual(goods(c, f), [], 'no month has gone by: no truck has left');
  T.stepMonth(c, f);
  const runs = goods(c, f);
  assert.equal(runs.length, T.RULES.goods.makes.warehouse);
  assert.ok(runs.every((t) => t.cargo === 'goods' && t.amount === T.RULES.goods.load.goods && t.capo === 'dutch' && t.from.x === 8 && t.from.y === 2));
  assert.deepEqual(runs.map((t) => t.to.x + ',' + t.to.y).sort(), ['1,1', '2,1'], 'one load for each fence');
  assert.ok(runs.every((t) => t.vehicle === 'dutch:truck:1' && t.home.x === 2 && t.home.y === 2));
  assert.equal(T.view(c, f).capos[0].trucks, 1, 'his first truck comes with the warehouse');
});

test('a chop shop sends its stolen cars to the fences too', () => {
  const { c, f } = dealer(['chopshop'], 2);
  T.stepMonth(c, f);
  const runs = goods(c, f);
  assert.equal(runs.length, T.RULES.goods.makes.chopshop);
  assert.ok(runs.every((t) => t.cargo === 'cars' && t.amount === T.RULES.goods.load.cars));
});

test('a fence with nothing to sell earns a share of what it could, and says why', () => {
  const none = dealer([], 1), fed = dealer(['warehouse'], 1);
  T.stepMonth(none.c, none.f); T.stepMonth(fed.c, fed.f);
  const only = (d) => T.earns(d.c, placeAt(d.c, d.f, 1, 1));
  assert.ok(Math.abs(only(none) - T.RULES.goods.short * only(fed)) < 1e-6);
  assert.equal(placeAt(none.c, none.f, 1, 1).strains.find((s) => s.kind === 'dry').label, 'Nothing to sell: the family has no warehouse and no chop shop');
  assert.ok(!(placeAt(fed.c, fed.f, 1, 1).strains || []).some((s) => s.kind === 'dry'));
  const thin = dealer(['chopshop'], 3);
  T.stepMonth(thin.c, thin.f);
  const starved = T.view(thin.c, thin.f).places.filter((p) => p.kind === 'fence' && p.strains);
  assert.equal(starved.length, 2);
  assert.equal(starved[0].strains[0].label, 'Nothing to sell: no truck came this month');
});

test('goods nobody sells fill the store, stop there, and say so', () => {
  const { c, f } = dealer(['warehouse', 'chopshop'], 0);
  for (let m = 0; m < 6; m++) T.stepMonth(c, f);
  const store = placeAt(c, f, 8, 2), yard = placeAt(c, f, 9, 2);
  assert.equal(store.stock, T.RULES.truck.cellar * T.RULES.goods.makes.warehouse * T.RULES.goods.load.goods);
  assert.equal(store.strains[0].label, 'Store full: ' + store.stock + ' crates wait for a truck');
  assert.equal(yard.stock, T.RULES.truck.cellar * T.RULES.goods.makes.chopshop * T.RULES.goods.load.cars);
  assert.equal(yard.strains[0].label, 'Yard full: ' + yard.stock + ' cars wait for a truck');
  assert.deepEqual([store.holds, yard.holds], ['goods', 'cars']);
});

test('a capo\'s trucks carry his liquor first: goods go with the runs that are left', () => {
  const { c, f } = dealer(['warehouse'], 2);
  T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch', level: 3 }); // four loads a month
  [[4, 1], [5, 1], [4, 3], [5, 3]].forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' }));
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, T.RULES.truck.runs, 'every run of his one truck went to the bars');
  assert.deepEqual(goods(c, f), []);
  f.men.dutch.trucks = 2;
  T.stepMonth(c, f);
  assert.ok(goods(c, f).length > 0, 'a second truck has runs to spare');
  const legs = T.trips(c, f).filter((t) => t.vehicle === 'dutch:truck:1').map((t) => t.leg);
  assert.deepEqual(legs, [...Array(legs.length).keys()], 'one truck, one run after the other, whatever it carries');
});

test('no capo opens one more fence with nothing to sell in it: starved fences call for a chop shop or a warehouse', () => {
  const only = () => { const t = ALL(); for (const k of Object.keys(t)) t[k] = k === 'fence' || k === 'chopshop' || k === 'warehouse' ? 3 : 0; return t; };
  const next = (fences, makers) => {
    const c = town(); T.settle(c, 'dutch', 8, 2);
    [[7, 1], [8, 1], [9, 1]].slice(0, fences).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'fence', capo: 'dutch' }));
    [[7, 3], [8, 3]].slice(0, makers).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'chopshop', capo: 'dutch' }));
    return T.wants(c, 'dutch', { rank: 3, tech: only() }).kind;
  };
  assert.notEqual(next(2, 0), 'fence', 'two fences and nothing to sell');
  assert.equal(next(0, 2), 'fence', 'two chop shops and nobody to sell the cars');
});

// --- weed is a bonus: the loft sells on the spot, and what it grows besides goes by truck to the bars and the brothels ---
const grower = (sellers) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  kept(c, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'loft', capo: 'dutch' });
  sellers.forEach((kind, i) => T.open(c, 1 + i, 1, { owner: 'family', kind, capo: 'dutch' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

test('a loft sends a load of weed a month to a bar or a brothel of the family, by truck', () => {
  const { c, f } = grower(['brothel', 'speakeasy']);
  T.stepMonth(c, f);
  const runs = weed(c, f);
  assert.equal(runs.length, T.RULES.weed.makes);
  assert.deepEqual([runs[0].kind, runs[0].amount, runs[0].vehicle, runs[0].from], ['goods', T.RULES.weed.load, 'dutch:truck:1', { x: 8, y: 2 }]);
  assert.ok(['brothel', 'speakeasy'].includes(T.at(c, runs[0].to.x, runs[0].to.y).kind));
});

test('the place that has weed to sell earns more that month; the one that has none loses nothing', () => {
  const { c, f } = grower(['brothel', 'brothel']);
  const before = T.view(c, f).places.filter((p) => p.kind === 'brothel').map((p) => T.earns(c, p));
  T.stepMonth(c, f);
  const places = T.view(c, f).places.filter((p) => p.kind === 'brothel');
  const served = weed(c, f).map((t) => t.to.x + ',' + t.to.y);
  assert.equal(served.length, 1);
  places.forEach((p, i) => {
    const ratio = T.earns(c, p) / before[i];
    assert.ok(Math.abs(ratio - (served.includes(p.x + ',' + p.y) ? 1 + T.RULES.weed.bonus : 1)) < 1e-6, p.x + ',' + p.y + ' ' + ratio);
    assert.ok(!(p.strains || []).some((s) => s.kind === 'dry'), 'weed is a bonus: nobody is short of it');
  });
});

test('a bar keeps its liquor and its weed apart', () => {
  const { c, f } = grower(['speakeasy']);
  T.open(c, 9, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.stepMonth(c, f);
  assert.equal(hauls(c, f).length, 2);
  assert.equal(weed(c, f).length, 1);
  assert.equal(placeAt(c, f, 1, 1).stock, CRATES, 'one load of liquor poured, one on the shelf');
});

test('weed nobody sells stays in the loft and says so only when the family has somewhere to sell it', () => {
  const alone = grower([]);
  for (let m = 0; m < 6; m++) T.stepMonth(alone.c, alone.f);
  assert.equal(placeAt(alone.c, alone.f, 8, 2).strains, undefined);
  const { c, f } = grower(['brothel']);
  T.stepMonth(c, f);
  T.at(c, 8, 2).stock = T.RULES.truck.cellar * T.RULES.weed.makes; // as much as the loft keeps
  const loft = placeAt(c, f, 8, 2);
  assert.equal(loft.stock, T.RULES.truck.cellar * T.RULES.weed.makes * T.RULES.weed.load);
  assert.equal(loft.holds, 'weed');
  assert.equal(loft.strains.find((s) => s.kind === 'surplus').label, 'Stash full: ' + loft.stock + ' bags wait for a truck');
});

// --- the road is not safe: the rivals hold up what leaves a street they press on, the police stop trucks when the city is hot ---

test('now and then the rivals hold up a car that leaves a street they press on: the load never reaches the club', () => {
  const { c, f } = exposed('mae');
  const e = until(c, f, 'hijack', T.RULES.road.every);
  assert.ok(e, 'within ' + T.RULES.road.every + ' months');
  assert.deepEqual([e.capo, e.x, e.y, e.cargo, e.amount, e.by], ['mae', 5, 3, 'cash', LOAD, 'Callahan']);
  assert.equal(e.label, 'The Callahans hold up Mae\'s car in Lantern Row: $' + LOAD + ' gone');
  const runs = T.trips(c, f).filter((t) => t.kind === 'takings');
  assert.equal(runs.filter((t) => t.lost === 'hijack').length, 1);
  assert.equal(f.men.mae.income, T.RULES.club + LOAD * (runs.length - 1), 'every load but that one came in');
  assert.equal(c.flow.hijacked, LOAD);
});

test('they leave a hard man\'s cars alone, and the streets the family holds firmly', () => {
  const hard = exposed('sal');
  assert.equal(until(hard.c, hard.f, 'hijack', 3 * T.RULES.road.every), null);
  const deep = sixBars();
  T.open(deep.c, 11, 5, { owner: 'Callahan', kind: 'speakeasy' });
  assert.equal(until(deep.c, deep.f, 'hijack', 3 * T.RULES.road.every), null);
});

test('a truck is held up like a car: its load is lost and the bar goes without', () => {
  const { c, f } = exposed('mae', 'still');
  T.open(c, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'mae' });
  T.open(c, 2, 1, { owner: 'family', kind: 'speakeasy', capo: 'mae' });
  const e = until(c, f, 'hijack', T.RULES.road.every);
  assert.deepEqual([e.cargo, e.amount, e.x, e.y], ['liquor', CRATES, 5, 3]);
  assert.equal(e.label, 'The Callahans hold up Mae\'s truck in Lantern Row: ' + CRATES + ' crates of liquor gone');
  const runs = hauls(c, f);
  assert.equal(runs.filter((t) => t.lost === 'hijack').length, 1);
  const dry = T.view(c, f).places.filter((p) => p.kind === 'speakeasy' && (p.strains || []).some((s) => s.kind === 'dry'));
  assert.equal(dry.length, 1, 'the bar that waited for it has nothing to pour');
});

test('when the city is hot the police stop a truck every month and seize its load; cars with cash pass', () => {
  const play = (heat, bought) => {
    const { c, f } = brewer(2);
    c.heat = heat;
    if (bought) T.open(c, 11, 5, { owner: 'family', kind: 'key', key: 'precinct', capo: 'dutch' });
    const e = T.stepMonth(c, f).find((x) => x.type === 'seizure');
    return { e, lost: hauls(c, f).filter((t) => t.lost === 'seizure').length, cash: T.trips(c, f).filter((t) => t.kind === 'takings' && t.lost).length };
  };
  const hot = play(T.RULES.road.heat + 10);
  assert.deepEqual([hot.e.capo, hot.e.cargo, hot.e.amount, hot.lost, hot.cash], ['dutch', 'liquor', CRATES, 1, 0]);
  assert.equal(hot.e.label, 'The police stop Dutch\'s truck: ' + CRATES + ' crates of liquor seized');
  assert.equal(play(T.RULES.road.heat - 10).e, undefined, 'a quiet city: nobody looks into a truck');
  assert.equal(play(T.RULES.road.heat + 10, true).e, undefined, 'with the precinct in its pocket the family drives through');
});

// --- between cities: what one city makes too much of goes down the road to the family's sellers that go without next door ---

test('liquor nobody drinks at home goes down the road to the family\'s dry bars in the next city, so many loads a month', () => {
  const { a, b, f } = twoTowns(3);
  T.month(f, [a, b], ROAD);
  const went = T.convoys(f);
  assert.equal(went.length, T.RULES.convoy.loads);
  assert.deepEqual([went[0].from, went[0].to, went[0].cargo, went[0].amount, went[0].capo], ['town', 'next', 'liquor', CRATES, 'dutch']);
  assert.deepEqual([went[0].x, went[0].y], [8, 2], 'it leaves from the still');
  assert.equal(T.view(b, f).places.filter((p) => p.kind === 'speakeasy' && p.stock === CRATES).length, T.RULES.convoy.loads, 'and waits on the shelves of two bars');
  T.month(f, [a, b], ROAD);
  const dry = T.view(b, f).places.filter((p) => p.kind === 'speakeasy' && (p.strains || []).some((s) => s.kind === 'dry'));
  assert.equal(dry.length, 3 - T.RULES.convoy.loads, 'the month after, those bars pour');
});

test('nothing leaves a city without a road, and nothing leaves that the city itself can drink', () => {
  const far = twoTowns(3);
  T.month(far.f, [far.a, far.b], []);
  assert.deepEqual(T.convoys(far.f), []);
  T.month(far.f, [far.a, far.b]);
  assert.deepEqual(T.convoys(far.f), [], 'no roads given: every city for itself');
  const { a, b, f } = twoTowns(3);
  T.open(a, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(a, 2, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.month(f, [a, b], ROAD);
  assert.deepEqual(T.convoys(f), [], 'two bars at home drink all the still makes');
});

test('a road runs both ways, and carries goods for the fences like liquor for the bars', () => {
  const { a, b, f } = twoTowns(0);
  T.open(b, 8, 2, { owner: 'family', kind: 'warehouse', capo: 'mae' });
  T.open(a, 1, 1, { owner: 'family', kind: 'fence', capo: 'dutch' });
  T.month(f, [a, b], ROAD);
  const went = T.convoys(f);
  assert.equal(went.length, T.RULES.convoy.loads);
  for (const v of went) assert.deepEqual([v.from, v.to, v.cargo, v.capo], ['next', 'town', 'goods', 'mae']);
});
