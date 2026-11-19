// The map: six cities, their districts, the routes between them, and the
// family that grows across them one named person at a time.
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../web/world.js');
const D = require('../web/district.js');

const held = (w) => W.districts(w).filter((x) => x.owner === 'family');

test('the map has six cities of six to eight districts, each with its own character', () => {
  assert.equal(W.CITIES.length, 6);
  assert.equal(W.CITIES.reduce((n, c) => n + c.districts.length, 0), 41);
  assert.equal(W.CITIES.find((c) => c.id === 'ashport').districts.length, 8);
  const ids = new Set();
  for (const city of W.CITIES) {
    assert.ok(city.districts.length >= 6 && city.districts.length <= 8, city.name);
    assert.ok(Number.isFinite(city.x) && Number.isFinite(city.y), city.name + ' has no place on the map');
    assert.ok(city.terrain && city.character, city.name);
    for (const d of city.districts) {
      assert.ok(!ids.has(d.id), d.id);
      ids.add(d.id);
      for (const t of ['nightlife', 'industry', 'port', 'wealth']) assert.ok(d.traits[t] >= 0, d.id + ' ' + t);
    }
  }
});

test('every city can be reached from every other by the routes', () => {
  const seen = new Set([W.CITIES[0].id]);
  for (let pass = 0; pass < W.CITIES.length; pass++) {
    for (const r of W.ROUTES) {
      if (seen.has(r.from)) seen.add(r.to);
      if (seen.has(r.to)) seen.add(r.from);
    }
  }
  assert.equal(seen.size, 6);
  for (const r of W.ROUTES) assert.ok(['rail', 'road', 'river', 'sea'].includes(r.kind), r.kind);
});

test('the family starts with one district of one city, the rest belongs to rivals', () => {
  const w = W.createWorld({ capo: 'sal' });
  assert.equal(held(w).length, 1);
  assert.equal(held(w)[0].id, 'ashport-hillside');
  assert.equal(held(w)[0].state.capo, 'sal');
  assert.equal(held(w)[0].state.name, 'Hillside');
  assert.equal(W.districts(w).length, 41);
  for (const x of W.districts(w)) if (x.owner !== 'family') assert.ok(typeof x.owner === 'string' && x.state === null);
});

test('a district keeps the character of its place on the map', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-docks', 'dutch');
  const docks = W.district(w, 'ashport-docks');
  assert.equal(docks.state.traits.port, 1.5);
  assert.equal(docks.state.name, 'The Docks');
});

test('the family can only move into a district next to what it holds', () => {
  const w = W.createWorld({ capo: 'sal' });
  assert.throws(() => W.claim(w, 'lorne-harbour', 'mae'), /out of reach/);
  W.claim(w, 'ashport-docks', 'mae'); // same city
  const linked = W.ROUTES.find((r) => r.from === 'ashport' || r.to === 'ashport');
  const next = linked.from === 'ashport' ? linked.to : linked.from;
  const first = W.CITIES.find((c) => c.id === next).districts[0].id;
  W.claim(w, first, 'dutch'); // a city one route away
  assert.equal(held(w).length, 3);
});

test('one person holds one post', () => {
  const w = W.createWorld({ capo: 'sal' });
  assert.throws(() => W.claim(w, 'ashport-docks', 'sal'), /already/);
  W.seat(w, 'bookkeeper', 'mae');
  assert.throws(() => W.claim(w, 'ashport-docks', 'mae'), /already/);
  assert.throws(() => W.seat(w, 'fixer', 'sal'), /already/);
  assert.throws(() => W.seat(w, 'cook', 'tommy'), /no such seat/);
});

test('replacing a capo keeps the district and frees the man', () => {
  const w = W.createWorld({ capo: 'sal' });
  for (let i = 0; i < 6; i++) W.stepMonth(w);
  const before = W.district(w, 'ashport-hillside').state;
  const men = before.men, share = before.share;
  W.appoint(w, 'ashport-hillside', 'mae');
  const after = W.district(w, 'ashport-hillside').state;
  assert.equal(after.capo, 'mae');
  assert.equal(after.men, men);
  assert.equal(after.share, share);
  W.claim(w, 'ashport-docks', 'sal'); // Sal is free again
  assert.throws(() => W.appoint(w, 'ashport-market', 'tommy'), /not the family's/);
});

test('the table serves every district of the family', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-docks', 'dutch');
  W.seat(w, 'bookkeeper', 'mae');
  W.seat(w, 'routes', 'vince');
  for (const x of held(w)) assert.deepEqual(x.state.support, { bookkeeper: true, routes: true, fixer: false });
  W.claim(w, 'ashport-market', 'danny');
  assert.equal(W.district(w, 'ashport-market').state.support.bookkeeper, true);
  W.unseat(w, 'bookkeeper');
  for (const x of held(w)) assert.equal(x.state.support.bookkeeper, false);
});

test('a month runs every district and brings every tribute to the boss', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-docks', 'dutch');
  const before = w.treasury.dirty + w.treasury.clean;
  const events = W.stepMonth(w);
  assert.equal(w.month, 1);
  const owed = held(w).reduce((sum, x) => sum + x.state.boss.dirty + x.state.boss.clean, 0);
  assert.ok(owed > 0);
  assert.ok(Math.abs(w.treasury.dirty + w.treasury.clean - before - owed) < 0.01);
  assert.deepEqual([...new Set(events.map((e) => e.district))].sort(), ['ashport-docks', 'ashport-hillside']);
  assert.ok(events.every((e) => e.city === 'ashport'));
});

test('the boss never has more than nine people to name', () => {
  const w = W.createWorld({ capo: 'sal' });
  assert.equal(W.named(w).length, 1);
  W.seat(w, 'fixer', 'tommy');
  W.claim(w, 'ashport-docks', 'dutch');
  assert.deepEqual(W.named(w).map((n) => n.capo).sort(), ['dutch', 'sal', 'tommy']);
  assert.ok(W.named(w).every((n) => n.post && n.capo));
});

test('a city reports how much of it the family holds and how hot it runs', () => {
  const w = W.createWorld({ capo: 'sal' });
  const ashport = W.cityReport(w, 'ashport');
  const n = W.CITIES.find((c) => c.id === 'ashport').districts.length;
  assert.equal(ashport.districts, n);
  assert.equal(ashport.held, 1);
  assert.ok(Math.abs(ashport.share - 35 / n) < 0.01);
  assert.equal(ashport.heat, 30);
  assert.equal(W.cityReport(w, 'lorne').held, 0);
  assert.equal(W.cityReport(w, 'lorne').share, 0);
});

test('the map can draw the whole world from one plain object', () => {
  const w = W.createWorld({ capo: 'mae' });
  W.stepMonth(w);
  const v = JSON.parse(JSON.stringify(W.view(w)));
  assert.equal(v.cities.length, 6);
  assert.ok(v.routes.length >= 5);
  const ashport = v.cities.find((c) => c.id === 'ashport');
  assert.ok(Number.isFinite(ashport.x) && Number.isFinite(ashport.y));
  const hillside = ashport.districts.find((x) => x.id === 'ashport-hillside');
  assert.equal(hillside.owner, 'family');
  assert.equal(hillside.capo, 'mae');
  assert.ok(hillside.buildings.length >= 4);
  assert.ok(hillside.buildings.every((b) => b.district === 'Hillside' && D.SITES[b.type]));
  const rival = ashport.districts.find((x) => x.owner !== 'family');
  assert.equal(rival.capo, null);
  assert.deepEqual(rival.buildings, []);
});

test('the world survives a round trip through JSON', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-docks', 'dutch');
  W.seat(w, 'fixer', 'tommy');
  W.stepMonth(w);
  const copy = JSON.parse(JSON.stringify(w));
  W.stepMonth(w); W.stepMonth(copy);
  assert.deepEqual(copy, w);
});

test('five years across three districts and a full table break no rule', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-docks', 'dutch');
  W.claim(w, 'ashport-market', 'danny');
  W.seat(w, 'bookkeeper', 'mae'); W.seat(w, 'routes', 'vince'); W.seat(w, 'fixer', 'tommy');
  for (let i = 0; i < 60; i++) W.stepMonth(w);
  assert.equal(w.month, 60);
  assert.ok(w.treasury.clean > 0 && w.treasury.dirty > 0);
  for (const x of held(w)) assert.ok(D.busyMen(x.state) <= x.state.men, x.id);
  assert.equal(W.named(w).length, 6);
});

// --- moving in, rivals, underbosses ---

test('moving into a district costs the boss money and starts with a few streets', () => {
  const w = W.createWorld({ capo: 'sal' });
  const cash = w.treasury.dirty;
  W.claim(w, 'ashport-docks', 'dutch');
  assert.equal(cash - w.treasury.dirty, W.RULES.moveInCost);
  const docks = W.district(w, 'ashport-docks').state;
  assert.equal(docks.share, 15);
  assert.equal(docks.men, 11);
  assert.equal(docks.crews, 1); // the men who took the first streets
  assert.ok(docks.share < W.district(w, 'ashport-hillside').state.share);
});

test('the boss cannot move in with an empty treasury', () => {
  const w = W.createWorld({ capo: 'sal' });
  w.treasury.dirty = 200;
  assert.throws(() => W.claim(w, 'ashport-docks', 'dutch'), /cannot afford/);
  assert.equal(W.district(w, 'ashport-docks').owner, 'Callahan');
});

test('every six months the rivals hit the family where it is weakest', () => {
  const w = W.createWorld({ capo: 'mae' });
  const events = [];
  for (let i = 0; i < 6; i++) events.push(...W.stepMonth(w));
  const attacks = events.filter((e) => e.type === 'attack');
  assert.equal(attacks.length, 1);
  assert.equal(attacks[0].by, 'Callahan');
  assert.equal(attacks[0].district, 'ashport-hillside');
  assert.equal(attacks[0].outcome, 'hit');
  assert.ok(attacks[0].streets > 0 && attacks[0].stolen >= 0);
});

test('a district held by a hard man with crews on the street throws the rivals back', () => {
  const w = W.createWorld({ capo: 'sal' });
  const events = [];
  for (let i = 0; i < 6; i++) events.push(...W.stepMonth(w));
  const attack = events.find((e) => e.type === 'attack');
  assert.equal(attack.outcome, 'repelled');
});

test('a hit costs streets, a place and cash, and the capo answers with guards', () => {
  const w = W.createWorld({ capo: 'mae' });
  for (let i = 0; i < 5; i++) W.stepMonth(w);
  const s = W.district(w, 'ashport-hillside').state;
  const before = { share: s.share, places: Object.values(s.sites).reduce((a, b) => a + b, 0), guards: s.guards };
  W.stepMonth(w);
  assert.ok(s.share < before.share - 5);
  assert.ok(Object.values(s.sites).reduce((a, b) => a + b, 0) < before.places + 1);
  for (let i = 0; i < 3; i++) W.stepMonth(w);
  assert.ok(s.guards > before.guards, 'expected more guards after the attack');
});

test('rivals grow bolder with the years', () => {
  const w = W.createWorld({ capo: 'sal' });
  const early = W.rivalStrength(w, 'ashport');
  w.month = 48;
  assert.ok(W.rivalStrength(w, 'ashport') > early);
});

test('an underboss needs a city where the family holds at least two districts', () => {
  const w = W.createWorld({ capo: 'sal' });
  assert.throws(() => W.setUnderboss(w, 'ashport', 'tommy'), /two districts/);
  W.claim(w, 'ashport-market', 'danny');
  W.setUnderboss(w, 'ashport', 'tommy');
  assert.equal(w.underbosses.ashport, 'tommy');
  assert.throws(() => W.claim(w, 'ashport-docks', 'tommy'), /already/);
});

test('with an underboss in the city, he picks the capo that suits the district', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-market', 'danny');
  assert.throws(() => W.claim(w, 'ashport-docks'), /name a capo/);
  W.setUnderboss(w, 'ashport', 'tommy');
  W.claim(w, 'ashport-docks'); // the boss names nobody
  const docks = W.district(w, 'ashport-docks');
  assert.equal(docks.state.capo, 'dutch'); // the bootlegger who likes to fence, on the docks
  assert.equal(docks.appointedBy, 'tommy');
});

test('the boss never names more than nine people, however large the family', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-market', 'danny');
  W.setUnderboss(w, 'ashport', 'tommy');
  W.claim(w, 'ashport-docks');
  const posts = W.named(w).map((n) => n.post).sort();
  assert.deepEqual(posts, ['ashport-hillside', 'ashport-market', 'underboss:ashport']);
  assert.ok(W.named(w).length <= W.CITIES.length + W.SEATS.length);
});

test('the rivals give a new foothold a year before they come for it', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.claim(w, 'ashport-docks', 'mae');
  const events = [];
  for (let i = 0; i < 12; i++) events.push(...W.stepMonth(w));
  assert.ok(events.filter((e) => e.type === 'attack').every((e) => e.district !== 'ashport-docks'));
  for (let i = 0; i < 6; i++) events.push(...W.stepMonth(w));
  assert.ok(W.RULES.grace === 12);
});

test('a foothold pays its way and grows, whoever is sent there', () => {
  const D = require('../web/district.js');
  for (const capo of Object.keys(D.CAPOS)) {
    const w = W.createWorld({ capo: capo === 'sal' ? 'mae' : 'sal' });
    W.claim(w, 'ashport-market', capo);
    const s = W.district(w, 'ashport-market').state;
    let losing = 0;
    for (let i = 0; i < 24; i++) { W.stepMonth(w); if (s.profit < 0) losing++; }
    assert.ok(losing <= 3, `${capo}: ${losing} months at a loss`);
    assert.ok(s.share > 15, `${capo}: ${Math.round(s.share)}% of the streets after two years`);
  }
});
