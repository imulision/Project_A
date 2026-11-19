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

test('the trips of the family say which district and which city they run in', () => {
  const w = W.createWorld({ capo: 'dutch' });
  W.claim(w, 'ashport-market', 'mae');
  W.stepMonth(w);
  const trips = W.trips(w);
  assert.ok(trips.length > 4);
  assert.ok(trips.every((t) => t.city === 'ashport' && (t.district === 'ashport-hillside' || t.district === 'ashport-market')));
  assert.ok(trips.some((t) => t.district === 'ashport-market' && t.kind === 'liquor'));
});

test('when a rival family comes for a district, its cars show among the trips of that month only', () => {
  const w = W.createWorld({ capo: 'mae' });
  for (let i = 0; i < W.RULES.attackEvery - 1; i++) W.stepMonth(w);
  assert.equal(W.trips(w).filter((t) => t.kind === 'attack').length, 0);
  const hit = W.stepMonth(w).find((e) => e.type === 'attack');
  const raids = W.trips(w).filter((t) => t.kind === 'attack');
  assert.equal(raids.length, 1);
  assert.deepEqual([raids[0].from, raids[0].district, raids[0].violent, raids[0].outcome], ['rivals', hit.district, true, hit.outcome]);
  W.stepMonth(w);
  assert.equal(W.trips(w).filter((t) => t.kind === 'attack').length, 0);
});

// --- the violent jobs: a capo proposes, the boss rules ---
const untilProposal = (w, max = 24) => {
  for (let i = 0; i < max; i++) {
    const p = W.stepMonth(w).find((e) => e.type === 'proposal');
    if (p) return p;
  }
  return null;
};

test('a capo with muscle whose district has just been hit asks the boss for leave to kill one of theirs', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.district(w, W.HOME).state.attacked = 3;
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  assert.ok(p, 'Sal asks');
  assert.equal(p.kind, 'hit');
  assert.equal(p.district, W.HOME);
  assert.equal(p.capo, 'sal');
  assert.match(p.label, /Callahan/);
  assert.equal(W.proposals(w).length, 1);
  assert.equal(W.proposals(w)[0].id, p.id);
});

test('a capo who refuses bloodshed or lacks the muscle never proposes a killing', () => {
  const w = W.createWorld({ capo: 'mae' });
  W.district(w, W.HOME).state.attacked = 3;
  assert.equal(W.stepMonth(w).filter((e) => e.type === 'proposal' && e.kind === 'hit').length, 0);
});

test('an ambitious capo short of money in a rich district proposes a kidnapping for ransom', () => {
  const w = W.createWorld({ capo: 'vince' });
  const s = W.district(w, W.HOME).state;
  s.profit = 50; s.sites.still = 0; // a district that earns next to nothing
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  assert.ok(p);
  assert.equal(p.kind, 'kidnap');
});

test('nothing violent of that weight happens until the boss says yes', () => {
  const w = W.createWorld({ capo: 'sal' });
  W.district(w, W.HOME).state.attacked = 3;
  W.stepMonth(w);
  const events = W.stepMonth(w);
  assert.equal(events.filter((e) => e.type === 'job').length, 0);
  assert.equal(W.proposals(w).length, 1, 'he does not ask twice while he waits');
});

test('with the boss\'s leave, Sal\'s men kill a rival lieutenant: the rivals are weakened, the police stir', () => {
  const w = W.createWorld({ capo: 'sal' });
  const s = W.district(w, W.HOME).state;
  s.attacked = 3;
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  const before = W.rivalStrength(w, 'ashport'), heat = s.heat;
  W.rule(w, p.id, true);
  const job = W.stepMonth(w).find((e) => e.type === 'job');
  assert.deepEqual([job.kind, job.outcome, job.district], ['hit', 'done', W.HOME]);
  assert.ok(W.rivalStrength(w, 'ashport') < before - 1);
  assert.ok(s.heat > heat + 5);
  assert.equal(W.proposals(w).length, 0);
  const trip = W.trips(w).find((t) => t.kind === 'hit');
  assert.deepEqual([trip.flow, trip.violent, trip.district, trip.to], ['violence', true, W.HOME, 'rivals']);
  for (let i = 0; i < W.RULES.jobs.hit.lasts + 1; i++) W.stepMonth(w);
  assert.ok(W.rivalStrength(w, 'ashport') > before, 'the rivals recover in time');
});

test('a killing sent by a capo who is not up to it goes wrong: men die and the rivals come', () => {
  const w = W.createWorld({ capo: 'dutch' });
  const s = W.district(w, W.HOME).state;
  s.attacked = 3; s.crews = 0;
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  assert.equal(p.kind, 'hit');
  W.rule(w, p.id, true);
  const job = W.stepMonth(w).find((e) => e.type === 'job');
  assert.equal(job.outcome, 'failed');
  assert.equal(job.dead, W.RULES.jobs.hit.dead);
  assert.ok(s.attacked > 0);
});

test('a kidnapping that works brings a ransom, and costs Heat and Goodwill', () => {
  const w = W.createWorld({ capo: 'vince' });
  const s = W.district(w, W.HOME).state;
  s.profit = 50; s.sites.still = 0;
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  W.rule(w, p.id, true);
  const dirty = s.dirty, heat = s.heat, goodwill = s.goodwill;
  const job = W.stepMonth(w).find((e) => e.type === 'job');
  assert.deepEqual([job.kind, job.outcome], ['kidnap', 'done']);
  assert.ok(job.ransom >= 1000);
  assert.ok(s.dirty > dirty + 500 && s.heat > heat + 8 && s.goodwill < goodwill - 4);
  assert.ok(W.trips(w).some((t) => t.kind === 'kidnap'));
});

test('a capo told no holds a grudge, and one left without an answer lets it drop', () => {
  const w = W.createWorld({ capo: 'sal' });
  const s = W.district(w, W.HOME).state;
  s.attacked = 3;
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  W.rule(w, p.id, false);
  assert.equal(s.grudge, 1);
  assert.equal(W.proposals(w).length, 0);
  assert.throws(() => W.rule(w, p.id, true), /no such proposal/);

  const v = W.createWorld({ capo: 'sal' });
  W.district(v, W.HOME).state.attacked = 3;
  W.stepMonth(v);
  for (let i = 0; i < W.RULES.jobs.expires; i++) W.stepMonth(v);
  assert.equal(W.proposals(v).length, 0);
  assert.equal(W.district(v, W.HOME).state.grudge, 0);
});

test('after a job or a refusal, the same capo waits a year before asking again', () => {
  const w = W.createWorld({ capo: 'sal' });
  const s = W.district(w, W.HOME).state;
  s.attacked = 3;
  const p = W.stepMonth(w).find((e) => e.type === 'proposal');
  W.rule(w, p.id, false);
  for (let i = 0; i < W.RULES.jobs.every - 2; i++) {
    s.attacked = 3;
    assert.equal(W.stepMonth(w).filter((e) => e.type === 'proposal').length, 0);
  }
});

// --- capos who grow: ranks and abilities ---
const play = (w, months) => { const out = []; for (let i = 0; i < months; i++) out.push(...W.stepMonth(w)); return out; };

test('every capo starts as a soldier with nothing learned', () => {
  const w = W.createWorld({ capo: 'sal' });
  const p = W.person(w, 'sal');
  assert.deepEqual([p.rank, p.rankName, p.abilities.length], [0, 'Soldier', 0]);
  assert.deepEqual(W.RANKS.map((r) => r.name), ['Soldier', 'Capo', 'Veteran', 'Legend']);
  assert.equal(W.person(w, 'mae').rank, 0);
});

test('a capo in post learns month after month, and a man without a post learns nothing', () => {
  const w = W.createWorld({ capo: 'dutch' });
  play(w, 6);
  const dutch = W.person(w, 'dutch');
  assert.ok(dutch.xp.liquor > 5);
  assert.ok(dutch.total > 10);
  assert.equal(W.person(w, 'mae').total, 0);
});

test('with time a capo is promoted and unlocks an ability of what he has practised most', () => {
  const w = W.createWorld({ capo: 'dutch' });
  const events = play(w, 36);
  const up = events.filter((e) => e.type === 'promotion');
  assert.ok(up.length >= 1, 'promoted within three years');
  assert.deepEqual([up[0].capo, up[0].rank, up[0].rankName, up[0].district], ['dutch', 1, 'Capo', W.HOME]);
  const p = W.person(w, 'dutch');
  assert.equal(p.abilities.length, p.rank);
  const best = up[0].sector;
  assert.ok(D.WHEEL[best].some((a) => a.id === up[0].ability), `${up[0].ability} is a ${best} ability`);
  assert.match(up[0].label, /Dutch/);
  assert.deepEqual(W.district(w, W.HOME).state.skills, p.abilities, 'his district works with what he knows');
});

test('two capos who run their districts differently do not learn the same things', () => {
  const a = W.createWorld({ capo: 'sal' }), b = W.createWorld({ capo: 'mae' });
  play(a, 60); play(b, 60);
  const sal = W.person(a, 'sal'), mae = W.person(b, 'mae');
  assert.ok(sal.rank >= 1 && mae.rank >= 1);
  assert.notDeepEqual(sal.abilities, mae.abilities);
});

test('what a capo knows goes with him: his old district loses it, his new one gains it', () => {
  const w = W.createWorld({ capo: 'dutch' });
  play(w, 36);
  const known = W.person(w, 'dutch').abilities;
  assert.ok(known.length > 0);
  W.appoint(w, W.HOME, 'tommy');
  W.stepMonth(w);
  assert.deepEqual(W.district(w, W.HOME).state.skills, []);
  W.claim(w, 'ashport-market', 'dutch');
  W.stepMonth(w);
  assert.deepEqual(W.district(w, 'ashport-market').state.skills, known);
  assert.deepEqual(W.person(w, 'dutch').abilities, known);
});

test('the family\'s wheel lights the abilities of the men in post, and says who holds them', () => {
  const w = W.createWorld({ capo: 'dutch' });
  assert.equal(W.wheel(w).lit, 0);
  play(w, 36);
  const wheel = W.wheel(w);
  assert.equal(wheel.sectors.length, 6);
  assert.equal(wheel.sectors[0].rings.length, 3);
  const lit = wheel.sectors.flatMap((s) => s.rings).filter((r) => r.lit);
  assert.equal(lit.length, wheel.lit);
  assert.ok(lit.length >= 1);
  assert.deepEqual(lit[0].by, ['dutch']);
  W.appoint(w, W.HOME, 'tommy');
  assert.equal(W.wheel(w).lit, 0, 'out of a post, his knowledge leaves the wheel');
});

test('a capo whose question was left to drop does not ask again the month after', () => {
  const w = W.createWorld({ capo: 'vince' });
  const s = W.district(w, W.HOME).state;
  let asked = 0;
  for (let i = 0; i < W.RULES.jobs.every; i++) {
    s.profit = 50; s.sites.still = 0;
    asked += W.stepMonth(w).filter((e) => e.type === 'proposal').length;
  }
  assert.equal(asked, 1);
});

// --- rivals who are not a clock ---
test('the rivals grow bolder with the years, but only up to a point', () => {
  const w = W.createWorld({ capo: 'sal' });
  w.month = 12 * 40;
  assert.ok(W.rivalStrength(w, 'calder') <= W.RULES.rivalCap);
  w.month = 12 * 2;
  assert.ok(W.rivalStrength(w, 'calder') > W.RULES.rivalStrength);
});

test('rivals who were thrown back come weaker the next time, and take a year to try again', () => {
  const w = W.createWorld({ capo: 'sal' });
  const s = W.district(w, W.HOME).state;
  s.guards = 8; s.men = 30;
  const first = play(w, W.RULES.attackEvery).find((e) => e.type === 'attack');
  assert.equal(first.outcome, 'repelled');
  const before = W.RULES.rivalStrength + W.RULES.rivalGrowth * w.month / 12;
  assert.ok(W.rivalStrength(w, 'ashport') < before);
  assert.equal(play(w, W.RULES.attackAfterDefeat - 1).filter((e) => e.type === 'attack').length, 0);
  assert.equal(play(w, 1).filter((e) => e.type === 'attack').length, 1);
});

test('rivals who drew blood come back sooner and bolder', () => {
  const w = W.createWorld({ capo: 'mae' });
  const s = W.district(w, W.HOME).state;
  s.guards = 0;
  const first = play(w, W.RULES.attackEvery).find((e) => e.type === 'attack');
  assert.equal(first.outcome, 'hit');
  const plain = W.RULES.rivalStrength + W.RULES.rivalGrowth * w.month / 12;
  assert.ok(W.rivalStrength(w, 'ashport') > plain);
  s.guards = 0; s.attacked = 0;
  assert.equal(play(w, W.RULES.attackEvery).filter((e) => e.type === 'attack').length, 1);
});

test('left alone for ten years, every capo still holds a real part of Hillside', () => {
  for (const capo of Object.keys(D.CAPOS)) {
    const w = W.createWorld({ capo });
    play(w, 120);
    const s = W.district(w, W.HOME).state;
    assert.ok(s.share >= 15, `${capo}: ${Math.round(s.share)}% of the streets after ten years`);
    assert.ok(s.men >= 8, `${capo}: ${s.men} men left`);
  }
});

// --- local men: the boss is never short of someone to name ---
test('every district has a local man the boss can put in charge of it', () => {
  const D = require('../web/district.js');
  const w = W.createWorld({ capo: 'sal' });
  const man = W.local('ashport-market');
  assert.equal(man.local, 'ashport-market');
  assert.ok(man.name.length > 3);
  for (const k of ['muscle', 'business', 'cunning', 'charisma']) assert.ok(man[k] >= 2 && man[k] <= 6, k);
  W.claim(w, 'ashport-market', man.id);
  assert.equal(W.district(w, 'ashport-market').state.capo, man.id);
  assert.ok(!Object.keys(D.CAPOS).includes(man.id), 'the big names stay a short list');
  for (let i = 0; i < 24; i++) W.stepMonth(w);
});

test('a local man only runs his own district', () => {
  const w = W.createWorld({ capo: 'sal' });
  assert.throws(() => W.claim(w, 'ashport-market', W.local('ashport-docks').id), /only knows/);
});

test('an underboss with no big name left promotes the local man', () => {
  const w = W.createWorld({ capo: 'sal' });
  w.treasury.dirty = 50000;
  W.claim(w, 'ashport-market', 'mae');
  W.setUnderboss(w, 'ashport', 'dutch');
  W.seat(w, 'bookkeeper', 'tommy'); W.seat(w, 'routes', 'vince'); W.seat(w, 'fixer', 'danny');
  W.claim(w, 'ashport-docks');
  assert.equal(W.district(w, 'ashport-docks').state.capo, W.local('ashport-docks').id);
});

test('clean money pays for a new district when the dirty money runs short', () => {
  const w = W.createWorld({ capo: 'sal' });
  w.treasury.dirty = 400; w.treasury.clean = 5000;
  W.claim(w, 'ashport-market', 'mae');
  assert.equal(w.treasury.dirty, 0);
  assert.equal(w.treasury.clean, 5000 - (W.RULES.moveInCost - 400));
});

test('each killing asked for names another lieutenant, until the rival family has none left', () => {
  const w = W.createWorld({ capo: 'sal' });
  const s = W.district(w, W.HOME).state;
  const names = [];
  for (let i = 0; i < 240 && names.length < 10; i++) {
    s.attacked = 1; s.crews = 6; s.men = Math.max(s.men, 40); s.dirty = Math.max(s.dirty, 5000);
    W.stepMonth(w);
    W.proposals(w).forEach((p) => { if (p.kind === 'hit') { names.push(p.target); W.rule(w, p.id, true); } });
  }
  assert.equal(names.length, W.LIEUTENANTS.Callahan.length);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, W.LIEUTENANTS.Callahan);
});

test('the world remembers the last two years of each district, month by month', () => {
  const w = W.createWorld({ capo: 'dutch' });
  for (let i = 0; i < 30; i++) W.stepMonth(w);
  const h = W.history(w, W.HOME);
  assert.equal(h.length, 24);
  assert.equal(h[23].month, 29);
  for (const k of ['share', 'heat', 'goodwill', 'men', 'income', 'profit', 'toBoss']) assert.equal(typeof h[23][k], 'number', k);
  assert.deepEqual(W.history(w, 'ashport-docks'), []);
});

test('a request says what there is to gain, what is risked and how it looks; the result says what it changed', () => {
  const w = W.createWorld({ capo: 'sal' });
  const s = W.district(w, W.HOME).state;
  let p = null, done = null;
  for (let i = 0; i < 40 && !done; i++) {
    s.attacked = 1; s.crews = 6;
    const events = W.stepMonth(w);
    done = events.find((e) => e.type === 'job');
    if (!p && W.proposals(w).length) { p = W.proposals(w)[0]; W.rule(w, p.id, true); }
  }
  assert.ok(p.gain.length > 10 && p.risk.length > 10);
  assert.equal(p.odds, 'good');
  assert.equal(done.outcome, 'done');
  assert.ok(done.effects.length >= 2);
  assert.ok(done.effects.every((t) => typeof t === 'string'));
  s.crews = 0;
  const weak = W.createWorld({ capo: 'vince' });
  const v = W.district(weak, W.HOME).state;
  weak.rivalMood = { ashport: W.RULES.rivalMood }; // the Callahans are riding high
  for (let i = 0; i < 80 && !W.proposals(weak).some((q) => q.kind === 'hit'); i++) { v.attacked = 1; v.crews = 0; W.stepMonth(weak); }
  assert.equal(W.proposals(weak).find((q) => q.kind === 'hit').odds, 'poor');
});

// --- taking a district: by force, by bribery or by buying it. Never easy. ---
const rich = (extra) => { const w = W.createWorld({ capo: 'sal' }); Object.assign(w.treasury, { dirty: 20000, clean: 50000 }, extra); return w; };
const run = (w, n) => { const out = []; for (let i = 0; i < n; i++) out.push(...W.stepMonth(w)); return out; };

test('buying a district takes clean money and time, then the capo is in', () => {
  const w = rich();
  const cost = W.price(w, 'ashport-market', 'buy');
  const op = W.takeover(w, 'ashport-market', 'buy', 'mae');
  assert.equal(w.treasury.clean, 50000 - cost);
  assert.equal(w.treasury.dirty, 20000);
  assert.equal(W.district(w, 'ashport-market').owner, 'Callahan');
  assert.throws(() => W.seat(w, 'bookkeeper', 'mae'), /already holds/);
  const events = run(w, op.months);
  assert.equal(W.district(w, 'ashport-market').owner, 'family');
  assert.equal(W.district(w, 'ashport-market').state.capo, 'mae');
  const done = events.find((e) => e.type === 'takeover' && e.outcome === 'done');
  assert.equal(done.district, 'ashport-market');
  assert.ok(done.effects.length >= 1);
  assert.deepEqual(W.takeovers(w), []);
});

test('a takeover under way says how far it is', () => {
  const w = rich();
  const op = W.takeover(w, 'ashport-market', 'buy', 'mae');
  run(w, 1);
  const t = W.takeovers(w)[0];
  assert.equal(t.district, 'ashport-market');
  assert.equal(t.way, 'buy');
  assert.equal(t.monthsLeft, op.months - 1);
  assert.throws(() => W.takeover(w, 'ashport-market', 'bribe', 'tommy'), /already/);
});

test('every district the family holds makes the next one dearer, whatever the way', () => {
  const w = rich();
  for (const way of ['force', 'bribe', 'buy']) {
    const first = W.price(w, 'ashport-docks', way);
    const two = rich(); W.claim(two, 'ashport-market', 'mae');
    assert.ok(W.price(two, 'ashport-docks', way) > first, way);
  }
  assert.ok(W.price(w, 'ashport-uptown', 'buy') > W.price(w, 'ashport-docks', 'buy'), 'a rich district costs more to buy');
});

test('force without the men for it fails: money and men lost, and the capo said so beforehand', () => {
  const w = rich();
  const home = W.district(w, W.HOME).state;
  home.crews = 0;
  assert.equal(W.odds(w, 'ashport-market', 'force', 'mae').odds, 'poor');
  const men = home.men;
  const op = W.takeover(w, 'ashport-market', 'force', 'mae');
  home.crews = 0;
  let events = [];
  for (let i = 0; i < op.months; i++) { home.crews = 0; events.push(...W.stepMonth(w)); }
  const failed = events.find((e) => e.type === 'takeover');
  assert.equal(failed.outcome, 'failed');
  assert.equal(W.district(w, 'ashport-market').owner, 'Callahan');
  assert.ok(failed.effects.some((t) => /dead/.test(t)));
  assert.ok(w.treasury.dirty < 20000);
  W.seat(w, 'bookkeeper', 'mae'); // she is free again
});

test('force works with crews behind a hard man, and better once the rivals have lost a lieutenant', () => {
  const w = rich();
  const home = W.district(w, W.HOME).state;
  home.crews = 1;
  const before = W.odds(w, 'ashport-market', 'force', 'vince');
  w.weakened = { ashport: 12 };
  const after = W.odds(w, 'ashport-market', 'force', 'vince');
  assert.ok(after.power - after.needed > before.power - before.needed);
  home.crews = 4;
  assert.equal(W.odds(w, 'ashport-market', 'force', 'vince').odds, 'good');
});

test('bribery is for men with a tongue and a head, or for a family with a fixer', () => {
  const w = rich();
  assert.equal(W.odds(w, 'ashport-market', 'bribe', 'tommy').odds, 'good');
  const local = W.local('ashport-market').id;
  assert.equal(W.odds(w, 'ashport-market', 'bribe', local).odds, 'poor');
  assert.equal(W.odds(w, 'ashport-market', 'bribe', 'dutch').odds, 'poor');
  W.seat(w, 'fixer', 'danny');
  assert.equal(W.odds(w, 'ashport-market', 'bribe', 'dutch').odds, 'good');
  assert.equal(W.odds(w, 'ashport-market', 'buy', local).odds, 'good');
});

test('a bribe that fails costs the money and warns the police', () => {
  const w = rich();
  const op = W.takeover(w, 'ashport-market', 'bribe', 'dutch');
  assert.equal(w.treasury.dirty, 20000 - op.cost);
  const events = run(w, op.months);
  const failed = events.find((e) => e.type === 'takeover');
  assert.equal(failed.outcome, 'failed');
  assert.equal(W.district(w, 'ashport-market').owner, 'Callahan');
  assert.ok(failed.effects.some((t) => /Heat \+/.test(t)));
});

test('a takeover needs the money for its way, and a district within reach', () => {
  const w = rich({ clean: 0 });
  assert.throws(() => W.takeover(w, 'ashport-market', 'buy', 'mae'), /afford/);
  assert.throws(() => W.takeover(w, 'lorne-harbour', 'force', 'mae'), /out of reach/);
  assert.throws(() => W.takeover(w, 'ashport-market', 'charm', 'mae'), /no such way/);
});

// --- ranks: the boss promotes, pays, and has only so many places ---
const untilReady = (w, max = 60) => { for (let i = 0; i < max && !W.promotions(w).length; i++) W.stepMonth(w); return W.promotions(w)[0]; };

test('a man ready to rise waits for the boss, who picks one of two abilities for him', () => {
  const w = W.createWorld({ capo: 'dutch' });
  const offer = untilReady(w);
  assert.deepEqual([offer.capo, offer.rank, offer.rankName], ['dutch', 1, 'Capo']);
  assert.equal(offer.options.length, 2);
  assert.notEqual(offer.options[0].sector, offer.options[1].sector);
  assert.equal(offer.pay, W.RANKS[1].pay);
  assert.equal(W.person(w, 'dutch').rank, 0, 'nothing changes until the boss speaks');
  const e = W.promote(w, 'dutch', offer.options[1].id);
  assert.equal(e.type, 'promotion');
  assert.equal(e.ability, offer.options[1].id);
  assert.deepEqual(W.person(w, 'dutch').abilities, [offer.options[1].id]);
  assert.equal(W.person(w, 'dutch').rank, 1);
  assert.deepEqual(W.promotions(w), []);
  assert.throws(() => W.promote(w, 'dutch', offer.options[0].id), /not waiting/);
});

test('the boss cannot give an ability that was not on offer', () => {
  const w = W.createWorld({ capo: 'dutch' });
  untilReady(w);
  assert.throws(() => W.promote(w, 'dutch', 'death-squad'), /not on offer/);
});

test('left without an answer for three months, he takes what he has practised most', () => {
  const w = W.createWorld({ capo: 'dutch' });
  const offer = untilReady(w);
  const events = play(w, W.RULES.promotionWait + 1);
  const up = events.find((e) => e.type === 'promotion');
  assert.equal(up.ability, offer.options[0].id);
  assert.equal(W.person(w, 'dutch').rank, 1);
});

test('a rank is a wage the boss pays every month, street money first', () => {
  const w = W.createWorld({ capo: 'dutch' });
  const offer = untilReady(w);
  W.promote(w, 'dutch', offer.options[0].id);
  w.treasury.dirty = 40; w.treasury.clean = 5000;
  W.stepMonth(w);
  assert.equal(w.lastMonth.wages, W.RANKS[1].pay);
  assert.deepEqual(w.lastMonth.wagesFrom, { dirty: 40, clean: W.RANKS[1].pay - 40 }, 'clean money covers what the street money cannot');
  assert.equal(W.district(w, W.HOME).state.paid, true);
});

test('a man the boss cannot pay holds it against him', () => {
  const w = W.createWorld({ capo: 'dutch' });
  const offer = untilReady(w);
  W.promote(w, 'dutch', offer.options[0].id);
  const s = W.district(w, W.HOME).state;
  w.treasury.dirty = 0; w.treasury.clean = 0;
  s.boss.dirty = s.boss.clean = 0;
  const events = [];
  for (let i = 0; i < 2; i++) { w.treasury.dirty = 0; w.treasury.clean = 0; events.push(...W.stepMonth(w)); }
  assert.equal(s.paid, false);
  assert.ok(events.some((e) => e.type === 'unpaid-wage' && e.capo === 'dutch'));
});

test('the family has only so many places at each rank, and more as it grows', () => {
  const w = W.createWorld({ capo: 'dutch' });
  w.treasury.dirty = 50000;
  const one = W.ranks(w);
  assert.deepEqual(one.map((r) => r.name), ['Soldier', 'Capo', 'Veteran', 'Legend']);
  assert.equal(one[0].places, null, 'anyone can be a soldier');
  assert.ok(one[1].places >= 1 && one[2].places <= one[1].places && one[3].places <= one[2].places);
  W.claim(w, 'ashport-market', 'mae'); W.claim(w, 'ashport-docks', 'sal'); W.claim(w, 'ashport-canal', 'tommy');
  W.claim(w, 'ashport-uptown', 'vince'); W.claim(w, 'ashport-station', 'danny');
  const six = W.ranks(w);
  assert.ok(six[1].places > one[1].places);
  assert.ok(six[0].men.includes('dutch'));
});

test('with every place of a rank taken, a man who has earned it waits', () => {
  const w = W.createWorld({ capo: 'dutch' });
  W.RULES.places[1] = { base: 0, every: 3 }; // no Capo place for a family of one district
  try {
    play(w, 48);
    assert.deepEqual(W.promotions(w), []);
    assert.equal(W.person(w, 'dutch').rank, 0);
    assert.deepEqual(W.ranks(w)[1].waiting, ['dutch']);
  } finally { W.RULES.places[1] = { base: 2, every: 3 }; }
});

// --- research: what one man knows, the boss can pay to teach the whole family ---
const withAbility = () => {
  const w = W.createWorld({ capo: 'dutch' });
  const offer = untilReady(w);
  W.promote(w, 'dutch', offer.options[0].id);
  w.treasury.dirty = 50000; w.treasury.clean = 50000;
  return { w, ability: offer.options[0].id };
};

test('the boss pays clean money and waits, and the whole family learns what one capo knows', () => {
  const { w, ability } = withAbility();
  W.claim(w, 'ashport-market', 'mae');
  const cost = W.RULES.research.cost[0], months = W.RULES.research.months[0];
  const clean = w.treasury.clean;
  W.research(w, ability);
  assert.equal(w.treasury.clean, clean - cost);
  assert.deepEqual([W.researching(w).id, W.researching(w).monthsLeft, W.researching(w).months], [ability, months, months]);
  assert.ok(!W.district(w, 'ashport-market').state.skills.includes(ability));
  const events = play(w, months + 1);
  const done = events.find((e) => e.type === 'research');
  assert.equal(done.ability, ability);
  assert.match(done.label, /whole family/);
  assert.equal(W.researching(w), null);
  assert.ok(W.district(w, 'ashport-market').state.skills.includes(ability), 'Mae\'s district works with it too');
  assert.equal(W.district(w, W.HOME).state.skills.filter((a) => a === ability).length, 1, 'never counted twice');
});

test('research needs a man in post who knows the thing, clean money, and one subject at a time', () => {
  const { w, ability } = withAbility();
  assert.throws(() => W.research(w, 'death-squad'), /nobody in the family/);
  w.treasury.clean = 10;
  assert.throws(() => W.research(w, ability), /clean money/);
  w.treasury.clean = 50000;
  W.research(w, ability);
  assert.throws(() => W.research(w, ability), /already/);
});

test('the wheel says what can be researched, at what price, and what the family already shares', () => {
  const { w, ability } = withAbility();
  const ring = () => W.wheel(w).sectors.flatMap((s) => s.rings).find((r) => r.id === ability);
  assert.deepEqual([ring().lit, ring().shared, ring().research.open], [true, false, true]);
  assert.equal(ring().research.cost, W.RULES.research.cost[0]);
  const dark = W.wheel(w).sectors.flatMap((s) => s.rings).find((r) => !r.lit);
  assert.equal(dark.research.open, false);
  W.research(w, ability);
  assert.equal(ring().research.monthsLeft, W.RULES.research.months[0]);
  play(w, W.RULES.research.months[0] + 1);
  assert.equal(ring().shared, true);
  assert.equal(ring().research.open, false);
  assert.ok(W.RULES.research.cost[2] > W.RULES.research.cost[1] && W.RULES.research.cost[1] > W.RULES.research.cost[0]);
});

test('what the family has learned stays when the man who taught it is gone', () => {
  const { w, ability } = withAbility();
  W.research(w, ability);
  play(w, W.RULES.research.months[0] + 1);
  W.appoint(w, W.HOME, 'mae');
  play(w, 1);
  assert.ok(W.district(w, W.HOME).state.skills.includes(ability));
});

// --- the building tree: the family learns trades, then learns to run them bigger ---
const START = ['still', 'speakeasy', 'rented', 'warehouse'];
const branch = (w, id) => W.tree(w).find((b) => b.id === id);

test('a new family knows liquor, a rented laundry and a warehouse, and nothing else', () => {
  const w = W.createWorld({ capo: 'danny' });
  assert.deepEqual(W.tree(w).map((b) => b.id), Object.keys(D.SITES));
  for (const b of W.tree(w)) {
    assert.equal(b.tier, START.includes(b.id) ? 1 : 0, b.id);
    assert.equal(b.of, 3);
    assert.equal(b.name, D.SITES[b.id].name);
    assert.ok(['laundering', 'production', 'sales', 'storage', 'business'].includes(b.role), b.id);
  }
  play(w, 36);
  const s = W.district(w, W.HOME).state;
  for (const k of Object.keys(D.SITES)) if (!START.includes(k)) assert.equal(s.sites[k], 0, k);
  assert.ok(s.levels.still === 1 && s.levels.speakeasy === 1, 'nothing grows past tier I');
});

test('the boss pays clean money for a trade, waits, and his capos start opening it', () => {
  const w = W.createWorld({ capo: 'mae' });
  w.treasury.clean = 50000;
  const next = branch(w, 'gambling').next;
  assert.deepEqual([next.tier, next.cost, next.months], [1, W.RULES.tree.cost[0], W.RULES.tree.months[0]]);
  W.research(w, 'gambling');
  assert.equal(w.treasury.clean, 50000 - next.cost);
  assert.deepEqual([W.researching(w).id, W.researching(w).building, W.researching(w).tier], ['gambling', true, 1]);
  assert.equal(branch(w, 'gambling').monthsLeft, next.months);
  assert.equal(branch(w, 'gambling').tier, 0, 'not known until the months have passed');
  const events = play(w, next.months + 1);
  const done = events.find((e) => e.type === 'research');
  assert.deepEqual([done.building, done.tier], ['gambling', 1]);
  assert.match(done.label, /Gambling room/);
  assert.equal(branch(w, 'gambling').tier, 1);
  play(w, 36);
  assert.ok(W.district(w, W.HOME).state.sites.gambling > 0);
});

test('each tier costs more and takes longer, and the third is the last', () => {
  const w = W.createWorld({ capo: 'mae' });
  w.treasury.clean = 500000;
  for (let t = 2; t <= 3; t++) {
    const next = branch(w, 'still').next;
    assert.deepEqual([next.tier, next.cost, next.months], [t, W.RULES.tree.cost[t - 1], W.RULES.tree.months[t - 1]]);
    W.research(w, 'still');
    play(w, next.months + 1);
    assert.equal(branch(w, 'still').tier, t);
  }
  assert.equal(branch(w, 'still').next, null);
  assert.throws(() => W.research(w, 'still'), /as far as it goes/);
  assert.ok(W.RULES.tree.cost[2] > W.RULES.tree.cost[1] && W.RULES.tree.cost[1] > W.RULES.tree.cost[0]);
  assert.ok(W.RULES.tree.months[2] > W.RULES.tree.months[1] && W.RULES.tree.months[1] > W.RULES.tree.months[0]);
});

test('a trade is paid in clean money, one subject at a time, abilities included', () => {
  const w = W.createWorld({ capo: 'mae' });
  assert.throws(() => W.research(w, 'gambling'), /clean money/);
  w.treasury.clean = 50000;
  W.research(w, 'gambling');
  assert.throws(() => W.research(w, 'loft'), /already/);
  assert.throws(() => W.research(w, 'nonsense'), /no such/);
});

test('a capo in post who likes the trade teaches it: the family learns it in half the time', () => {
  const months = W.RULES.tree.months[0];
  const danny = W.createWorld({ capo: 'danny' }), mae = W.createWorld({ capo: 'mae' });
  assert.deepEqual(branch(danny, 'gambling').likedBy, ['danny']);
  assert.equal(branch(danny, 'gambling').next.months, Math.ceil(months / 2));
  assert.deepEqual(branch(mae, 'gambling').likedBy, []);
  assert.equal(branch(mae, 'gambling').next.months, months);
  danny.treasury.clean = 50000;
  W.research(danny, 'gambling');
  assert.equal(W.researching(danny).months, Math.ceil(months / 2));
});

test('the tree says which capos are asking for a closed trade', () => {
  const w = W.createWorld({ capo: 'danny' });
  play(w, 12);
  const asked = W.tree(w).filter((b) => b.wantedBy.length);
  assert.ok(asked.length > 0, 'after a year Danny wants something the family cannot do');
  assert.ok(asked.every((b) => b.tier === 0 && b.wantedBy[0] === 'danny'));
  assert.ok(!asked.some((b) => D.CAPOS.danny.refuses.includes(b.id)));
});

test('a district the family moves into works with what the family knows', () => {
  const w = W.createWorld({ capo: 'danny' });
  w.treasury.dirty = 50000; w.treasury.clean = 50000;
  W.research(w, 'gambling');
  play(w, W.RULES.tree.months[0] + 1);
  W.claim(w, 'ashport-market', 'mae');
  assert.equal(W.district(w, 'ashport-market').state.tech.gambling, 1);
  assert.equal(W.district(w, 'ashport-market').state.tech.loft, 0);
});

test('a game saved before the tree keeps every trade it had', () => {
  const w = W.createWorld({ capo: 'danny' });
  delete w.tree;
  play(w, 1);
  assert.ok(W.tree(w).every((b) => b.tier === 3));
});
