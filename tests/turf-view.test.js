// What the screen reads: the view of a city, the trips in its streets, where each capo is, what chokes.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../web/turf.js');
const D = require('../web/district.js');
const H = require('./turf-helpers.js');
const town = H.town, family = H.family, LOAD = H.LOAD, kept = H.kept, sixBars = H.sixBars, whereIs = H.whereIs;

// --- what the screen reads: one plain picture of the city, nothing to work out ---

test('the view of a city gives the map everything it draws', () => {
  const c = town(), f = family({ dirty: 9000, clean: 0 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch', level: 2 });
  T.open(c, 9, 3, { owner: 'Callahan', kind: 'key', key: 'port' });
  T.open(c, 9, 1, { owner: 'Callahan', kind: 'still' });
  T.stepMonth(c, f);
  const v = T.view(c, f);
  assert.equal(v.id, 'town'); assert.equal(v.w, 12); assert.equal(v.h, 6); assert.equal(v.month, 1);
  assert.deepEqual(v.zones.map((z) => z.name), ['Lantern Row', 'The Works']);
  assert.equal(v.blocks.length, 12 * 6, 'every block, row by row');
  const b = v.blocks[2 * 12 + 3];
  assert.deepEqual([b.x, b.y, b.grip], [3, 2, 'family']);
  assert.ok(b.family > 0 && b.rival === 0);
  assert.equal(v.blocks[3 * 12 + 9].grip, 'rival');
  const bar = v.places.find((p) => p.x === 3 && p.y === 2);
  const { till, strains, ...drawn } = bar;
  assert.deepEqual(strains, [{ kind: 'dry', label: 'Nothing to pour: the family has no still' }]);
  assert.deepEqual(drawn, { x: 3, y: 2, owner: 'family', kind: 'speakeasy', name: D.SITES.speakeasy.name, level: 2, capo: 'dutch', made: drawn.made, made6: drawn.made6, costs: T.RULES.wage }); // (its books: tests/turf-ledger.test.js)
  assert.ok(till > 0 && till < T.RULES.car.load, 'and what waits in its till for the next car');
  assert.equal(v.places.find((p) => p.kind === 'club').name, 'Social Club');
  const port = v.places.find((p) => p.kind === 'key');
  assert.equal(port.key, 'port'); assert.equal(port.name, 'The Port'); assert.equal(port.owner, 'Callahan');
  assert.deepEqual(v.keys, T.keys(c));
  assert.deepEqual(v.share, T.share(c));
  const dutch = v.capos[0];
  assert.deepEqual([dutch.id, dutch.name, dutch.rank, dutch.rankName, dutch.x, dutch.y], ['dutch', 'Dutch Keller', 0, 'Soldier', 2, 2]);
  assert.equal(dutch.places, T.places(c, 'dutch').length - 1);
  assert.equal(dutch.reach, T.RULES.reach[0]);
  assert.deepEqual(dutch.plan, Object.assign(T.plan(c, f, 'dutch'), { monthsLeft: dutch.plan.monthsLeft, due: dutch.plan.due, advance: dutch.plan.advance, gains: dutch.plan.gains })); // (how far his money is from it: tests/turf-ledger.test.js; the streets it brings: tests/turf-next.test.js)
  assert.ok(dutch.income > 0 && typeof dutch.cash === 'number' && dutch.way === 'buy');
  assert.deepEqual([v.money.dirty, v.money.clean, v.money.washed, v.money.washes], [f.dirty, f.clean, T.washing(c).washed, T.washing(c).most]);
  assert.deepEqual(Object.keys(v.money).sort(), ['clean', 'cut', 'dirty', 'pay', 'seized', 'up', 'washed', 'washes']);
  assert.equal(v.heat, c.heat);
  assert.deepEqual(v.seats, T.seats(c));
  assert.deepEqual(v.takes, T.takes(c)); assert.deepEqual(v.asks, T.asks(c)); assert.deepEqual(v.doors, T.doors(c, f));
  assert.equal(v.rival, 'Callahan');
  assert.deepEqual(v.tree, T.tree(f)); assert.deepEqual(v.wishes, T.wishes(c, f));
  assert.doesNotThrow(() => JSON.stringify(v));
  T.view(c, f).places[0].level = 9;
  assert.notEqual(T.view(c, f).places[0].level, 9, 'the view is a copy: the screen cannot change the game through it');
});

// --- what moves in the streets this month, for the map ---

test('the trips of a city: liquor from the stills to the bars, takings to the club, dirty money to the laundry, crews to what they take', () => {
  const c = town(), f = family({ dirty: 5000 });
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 3, 2, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 3, 3, { owner: 'family', kind: 'rented', capo: 'dutch' });
  T.open(c, 10, 4, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'dutch', x: 10, y: 4, way: 'buy', kind: 'speakeasy', cost: 1, month: 0, months: 3 });
  const trips = T.trips(c, f), of = (kind) => trips.filter((t) => t.kind === kind);
  assert.deepEqual(of('liquor'), [], 'no month has gone by: no truck has left the still');
  assert.deepEqual(of('takings'), [], 'no month has gone by: no till is full, no car has left');
  assert.deepEqual(of('wash'), [{ kind: 'wash', cargo: 'cash', capo: 'dutch', from: { x: 2, y: 2 }, to: { x: 3, y: 3 }, amount: 0 }], 'no month has gone by: nothing washed yet');
  assert.deepEqual(of('crew'), [{ kind: 'crew', cargo: 'buy', capo: 'dutch', from: { x: 2, y: 2 }, to: { x: 10, y: 4 } }]);
  f.dirty = 0;
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'wash'), [], 'nothing to wash, nobody drives to the laundry');
  assert.deepEqual(T.view(c, f).trips, T.trips(c, f));
});

test('a truck leaves the fullest cellar for the thirstiest bar, the nearest one first; a bar with no still gets no truck', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 5, 2); T.join(f, 'dutch'); kept(c, 'dutch');
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  T.open(c, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.stepMonth(c, f);
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'liquor'), []);
  T.open(c, 0, 4, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 10, 1, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.open(c, 9, 4, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.stepMonth(c, f);
  const runs = T.trips(c, f).filter((t) => t.kind === 'liquor');
  assert.equal(runs.length, 4, 'two loads from each still');
  const from = (x, y) => [...new Set(runs.filter((t) => t.to.x === x && t.to.y === y).map((t) => t.from.x + ',' + t.from.y))];
  assert.deepEqual(from(1, 1), ['0,4']);
  assert.deepEqual(from(9, 4), ['10,1']);
});

// --- a capo is somewhere: at his club, or where his business takes him ---

test('a capo with nothing on his hands is at his club', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  assert.deepEqual(whereIs(c, f, 'dutch'), { x: 2, y: 2, why: 'home', label: 'At his club' });
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'capo'), [], 'and nobody is on the road');
});

test('a capo who is taking a place stands in front of it until it is settled', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.open(c, 4, 2, { owner: 'Callahan', kind: 'speakeasy' });
  c.ops.push({ capo: 'sal', x: 4, y: 2, way: 'force', kind: 'speakeasy', cost: 1, month: 0, months: 3 });
  const at = whereIs(c, f, 'sal');
  assert.deepEqual([at.x, at.y, at.why], [4, 2, 'take']);
  assert.match(at.label, /Taking the Callahans' speakeasy in Lantern Row/i);
  assert.deepEqual(T.trips(c, f).filter((t) => t.kind === 'capo'), [{ kind: 'capo', cargo: 'take', capo: 'sal', from: { x: 2, y: 2 }, to: { x: 4, y: 2 }, vehicle: 'sal:own', home: { x: 2, y: 2 } }]);
  c.ops.length = 0;
  assert.equal(whereIs(c, f, 'sal').why, 'home', 'then he goes home');
});

test('a capo goes where the rivals struck, and stays there for the month', () => {
  const c = town(), f = family();
  T.settle(c, 'mae', 3, 3); T.join(f, 'mae');
  f.men.mae.cash = -100000;
  T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'mae' });
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  let hit = null;
  for (let m = 0; m < 24 && !hit; m++) hit = T.stepMonth(c, f).find((e) => e.type === 'burnt' || e.type === 'repelled');
  assert.ok(hit);
  const at = whereIs(c, f, 'mae');
  assert.deepEqual([at.x, at.y, at.why], [hit.x, hit.y, 'raid']);
  assert.match(at.label, /Callahans/);
  T.stepMonth(c, f);
  assert.equal(whereIs(c, f, 'mae').why, 'home', 'a month later she is back');
});

test('the man who holds the street is the one who goes to the fight', () => {
  const c = town(), f = family();
  T.settle(c, 'mae', 3, 3); T.join(f, 'mae'); f.men.mae.cash = -100000;
  T.open(c, 5, 3, { owner: 'family', kind: 'still', capo: 'mae' });
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 2 });
  T.settle(c, 'sal', 5, 5); T.join(f, 'sal'); f.men.sal.cash = -100000;
  let hit = null;
  for (let m = 0; m < 24 && !hit; m++) hit = T.stepMonth(c, f).find((e) => e.type === 'repelled');
  assert.equal(hit.heldBy, 'sal');
  assert.deepEqual([whereIs(c, f, 'sal').x, whereIs(c, f, 'sal').y, whereIs(c, f, 'sal').why], [hit.x, hit.y, 'raid']);
  assert.notEqual(whereIs(c, f, 'mae').why, 'raid');
});

test('two capos at each other\'s throats: the one who started it stands at the other\'s door', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.settle(c, 'dutch', 8, 3); T.join(f, 'dutch');
  c.feuds = [{ id: 'sal|dutch', a: 'sal', b: 'dutch', month: 0, label: 'x' }];
  const at = whereIs(c, f, 'sal');
  assert.deepEqual([at.x, at.y, at.why], [8, 3, 'feud']);
  assert.match(at.label, /Dutch/);
  assert.equal(whereIs(c, f, 'dutch').why, 'home', 'the other waits for him at home');
});

test('a capo who asks for a key place waits in front of it for the boss\'s word', () => {
  const c = town(), f = family();
  T.settle(c, 'sal', 2, 2); T.join(f, 'sal');
  T.open(c, 4, 3, { owner: 'Callahan', kind: 'key', key: 'precinct' });
  c.asks.push({ id: 'town:precinct', capo: 'sal', key: 'precinct', x: 4, y: 3, way: 'force', cost: 1, months: 1, why: 'x' });
  const at = whereIs(c, f, 'sal');
  assert.deepEqual([at.x, at.y, at.why], [4, 3, 'asks']);
});

// --- a place that chokes says so ---
const strainsAt = (c, f, x, y) => (T.view(c, f).places.find((p) => p.x === x && p.y === y).strains || []).map((s) => s.kind);

test('a place whose till holds two loads or more shows cash piling up', () => {
  const { c, f } = sixBars();
  assert.deepEqual(strainsAt(c, f, 1, 1), [], 'nothing yet');
  f.men.dutch.cash = 0;
  T.stepMonth(c, f);
  const full = T.view(c, f).places.filter((p) => (p.till || 0) >= 2 * LOAD);
  assert.ok(full.length > 0);
  for (const p of full) {
    assert.deepEqual(p.strains.map((s) => s.kind), ['cash']);
    assert.equal(p.strains[0].label, 'Cash piling up: $' + Math.round(p.till) + ' waits for a car');
  }
  const light = T.view(c, f).places.find((p) => p.kind === 'gambling' && (p.till || 0) < 2 * LOAD);
  if (light) assert.equal(light.strains, undefined);
});

test('bars with too few stills show they run dry, and a still nobody drinks from shows its surplus', () => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  T.open(c, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  assert.deepEqual(strainsAt(c, f, 8, 2), ['surplus'], 'a still and no bar');
  assert.match(T.view(c, f).places.find((p) => p.kind === 'still').strains[0].label, /More liquor than the bars can pour/);
  T.open(c, 1, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  T.open(c, 2, 1, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.deepEqual([strainsAt(c, f, 8, 2), strainsAt(c, f, 1, 1)], [[], []], 'one still pours for two bars: nothing chokes');
  for (const [x, y] of [[3, 1], [1, 3], [2, 3]]) T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' });
  assert.deepEqual(strainsAt(c, f, 1, 1), ['dry']);
  assert.equal(T.view(c, f).places.find((p) => p.x === 1 && p.y === 1).strains[0].label, 'Running dry: liquor for ' + Math.round(100 * T.liquor(c).wet) + '% of what it could sell');
  T.open(c, 9, 4, { owner: 'Callahan', kind: 'speakeasy' });
  assert.deepEqual(strainsAt(c, f, 9, 4), [], 'the rivals\' places say nothing');
});

test('a laundry that washed all it could while dirty money still waits shows it is swamped', () => {
  const c = town(), f = family({ dirty: 50000, clean: 0 });
  T.settle(c, 'mae', 2, 2); T.join(f, 'mae');
  T.open(c, 3, 2, { owner: 'family', kind: 'rented', capo: 'mae' });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  assert.deepEqual(strainsAt(c, f, 3, 2), [], 'no month has gone by');
  T.stepMonth(c, f);
  assert.deepEqual(strainsAt(c, f, 3, 2), ['swamped']);
  assert.match(T.view(c, f).places.find((p) => p.kind === 'rented').strains[0].label, /^Washing all it can: \$[\d,]+ of dirty money still waits$/);
  f.dirty = 0;
  T.stepMonth(c, f);
  assert.deepEqual(strainsAt(c, f, 3, 2), []);
});
