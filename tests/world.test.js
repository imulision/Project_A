// The map: six cities, their districts, the routes between them, and the
// family that grows across them one named person at a time.
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../web/world.js');
const D = require('../web/district.js');

const held = (w) => W.districts(w).filter((x) => x.owner === 'family');

test('the map has six cities of several districts, each with its own character', () => {
  assert.equal(W.CITIES.length, 6);
  const ids = new Set();
  for (const city of W.CITIES) {
    assert.ok(city.districts.length >= 4, city.name);
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
  assert.ok(W.districts(w).length >= 24);
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
  assert.throws(() => W.claim(w, 'blackwater-pithead', 'mae'), /out of reach/);
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
  const events = W.stepMonth(w);
  assert.equal(w.month, 1);
  const owed = held(w).reduce((sum, x) => sum + x.state.boss.dirty + x.state.boss.clean, 0);
  assert.ok(owed > 0);
  assert.ok(Math.abs(w.treasury.dirty + w.treasury.clean - owed) < 0.01);
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
  assert.equal(W.cityReport(w, 'blackwater').held, 0);
  assert.equal(W.cityReport(w, 'blackwater').share, 0);
});

test('the map can draw the whole world from one plain object', () => {
  const w = W.createWorld({ capo: 'mae' });
  W.stepMonth(w);
  const v = JSON.parse(JSON.stringify(W.view(w)));
  assert.equal(v.cities.length, 6);
  assert.ok(v.routes.length >= 5);
  const hillside = v.cities[0].districts.find((x) => x.id === 'ashport-hillside');
  assert.equal(hillside.owner, 'family');
  assert.equal(hillside.capo, 'mae');
  assert.ok(hillside.buildings.length >= 4);
  assert.ok(hillside.buildings.every((b) => b.district === 'Hillside' && D.SITES[b.type]));
  const rival = v.cities[0].districts.find((x) => x.owner !== 'family');
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
