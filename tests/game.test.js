// The game as the screen sees it: time that runs and pauses, the boss's
// orders, what happened, and who can be named. No drawing here.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../web/game.js');
const W = require('../web/world.js');

const month = (g) => { const out = []; for (let i = 0; i < G.TICKS_PER_MONTH; i++) out.push(...G.tick(g)); return out; };

test('a new game waits for the boss to name his first capo', () => {
  const g = G.createGame();
  assert.equal(g.started, false);
  assert.deepEqual(G.tick(g), []);
  assert.equal(G.hud(g).date, 'January 1926');
  assert.deepEqual(G.command(g, { type: 'start', capo: 'sal' }), { ok: true });
  assert.equal(g.started, true);
  assert.equal(W.district(g.world, 'ashport-hillside').state.capo, 'sal');
});

test('time runs in ticks, a month every few ticks, and the date follows', () => {
  const g = G.createGame({ capo: 'sal' });
  for (let i = 0; i < G.TICKS_PER_MONTH - 1; i++) assert.deepEqual(G.tick(g), []);
  const events = G.tick(g);
  assert.ok(events.some((e) => e.type === 'decision'));
  assert.equal(G.hud(g).date, 'February 1926');
  for (let i = 0; i < 11; i++) month(g);
  assert.equal(G.hud(g).date, 'January 1927');
});

test('a paused game does not move, and the boss can still give orders', () => {
  const g = G.createGame({ capo: 'sal' });
  G.command(g, { type: 'pause' });
  assert.deepEqual(month(g), []);
  assert.equal(G.hud(g).date, 'January 1926');
  assert.deepEqual(G.command(g, { type: 'claim', district: 'ashport-docks', capo: 'dutch' }), { ok: true });
  G.command(g, { type: 'resume' });
  month(g);
  assert.equal(G.hud(g).date, 'February 1926');
});

test('at double speed a month takes half the ticks', () => {
  const g = G.createGame({ capo: 'sal' });
  assert.deepEqual(G.command(g, { type: 'speed', value: 2 }), { ok: true });
  for (let i = 0; i < G.TICKS_PER_MONTH / 2; i++) G.tick(g);
  assert.equal(G.hud(g).date, 'February 1926');
  assert.equal(G.command(g, { type: 'speed', value: 7 }).ok, false);
});

test('an order that cannot be carried out says why and changes nothing', () => {
  const g = G.createGame({ capo: 'sal' });
  const before = JSON.stringify(g);
  const answer = G.command(g, { type: 'claim', district: 'lorne-harbour', capo: 'mae' });
  assert.equal(answer.ok, false);
  assert.match(answer.error, /out of reach/);
  assert.equal(G.command(g, { type: 'dance' }).ok, false);
  assert.equal(JSON.stringify(g), before);
});

test('every order of the boss goes through: replace, seat, unseat, underboss', () => {
  const g = G.createGame({ capo: 'sal' });
  for (const c of [
    { type: 'claim', district: 'ashport-market', capo: 'danny' },
    { type: 'appoint', district: 'ashport-hillside', capo: 'mae' },
    { type: 'seat', seat: 'fixer', capo: 'tommy' },
    { type: 'unseat', seat: 'fixer' },
    { type: 'underboss', city: 'ashport', capo: 'tommy' },
    { type: 'claim', district: 'ashport-docks' },
  ]) assert.deepEqual(G.command(g, c), { ok: true }, JSON.stringify(c));
  assert.equal(W.district(g.world, 'ashport-hillside').state.capo, 'mae');
  assert.equal(g.world.underbosses.ashport, 'tommy');
});

test('the journal keeps what happened, newest first, with its date and place', () => {
  const g = G.createGame({ capo: 'sal' });
  month(g); month(g);
  const [latest] = g.journal;
  assert.equal(latest.date, 'February 1926');
  assert.equal(latest.district, 'ashport-hillside');
  assert.equal(latest.place, 'Hillside, Ashport');
  assert.ok(latest.label && latest.type);
  for (let i = 0; i < 400; i++) month(g);
  assert.ok(g.journal.length <= G.JOURNAL_SIZE);
});

test('the men who can be named come with their card and what they would do first', () => {
  const g = G.createGame({ capo: 'sal' });
  const cards = G.candidates(g, 'ashport-docks');
  assert.ok(!cards.some((c) => c.id === 'sal'), 'Sal already holds Hillside');
  const mae = cards.find((c) => c.id === 'mae');
  assert.equal(mae.name, 'Mae "the Ledger" Whitlock');
  assert.equal(mae.specialty, 'Bookkeeper');
  assert.deepEqual(Object.keys(mae.stats), ['muscle', 'business', 'cunning', 'charisma', 'loyalty', 'ambition']);
  assert.ok(mae.likes.length && mae.refuses.length);
  assert.ok(mae.likes.every((s) => /^[A-Z]/.test(s)), 'likes are shown in words, not in code names');
  assert.ok(typeof mae.firstMove === 'string' && mae.firstMove.length > 5);
});

test('the districts the boss can move into are listed with their price', () => {
  const g = G.createGame({ capo: 'sal' });
  const open = G.openings(g);
  assert.ok(open.some((o) => o.district === 'ashport-docks'));
  assert.ok(!open.some((o) => o.district === 'ashport-hillside'));
  assert.ok(!open.some((o) => o.district === 'lorne-harbour'));
  assert.ok(open.every((o) => o.cost === W.RULES.moveInCost && o.affordable === true && o.name && o.city));
  g.world.treasury.dirty = 0;
  assert.ok(G.openings(g).every((o) => o.affordable === false));
});

test('the top of the screen says the date, the money, the people named and what needs a look', () => {
  const g = G.createGame({ capo: 'mae' });
  for (let i = 0; i < 6; i++) month(g);
  const h = G.hud(g);
  assert.equal(h.date, 'July 1926');
  assert.ok(h.dirty >= 0 && h.clean >= 0);
  assert.equal(h.named, 1);
  assert.equal(h.maxNamed, 9);
  assert.equal(h.paused, false);
  assert.equal(h.speed, 1);
  assert.ok(h.alerts.some((a) => a.district === 'ashport-hillside' && /attack|hit/i.test(a.text)), JSON.stringify(h.alerts));
});

test('a game can be saved and picked up exactly where it was', () => {
  const g = G.createGame({ capo: 'sal' });
  month(g); G.tick(g);
  const copy = G.load(G.save(g));
  month(g); month(copy);
  assert.deepEqual(copy, g);
  assert.throws(() => G.load('{"version":999}'), /saved by another version/);
});

test('the map view comes with the game', () => {
  const g = G.createGame({ capo: 'sal' });
  assert.equal(G.view(g).cities.length, 6);
});

test('in a page, the three rule files load with plain script tags and play a year', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const page = { self: {} };
  page.self.self = page.self;
  vm.createContext(page.self);
  for (const file of ['district.js', 'world.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'web', file), 'utf8'), page.self, { filename: file });
  }
  const date = vm.runInContext(`
    var g = AshportGame.createGame({ capo: 'dutch' });
    for (var i = 0; i < 12 * AshportGame.TICKS_PER_MONTH; i++) AshportGame.tick(g);
    AshportGame.hud(g).date + ' / ' + AshportGame.view(g).cities.length + ' / ' + (g.journal.length > 5);
  `, page.self);
  assert.equal(date, 'January 1927 / 6 / true');
});

test('before the game starts, the boss can already look at the men he could name', () => {
  const g = G.createGame();
  const cards = G.candidates(g);
  assert.equal(cards.length, 6);
  assert.ok(cards.every((c) => c.firstMove.length > 5), 'each one says what he would do with Hillside');
  assert.deepEqual(G.candidates(g, 'ashport-hillside').map((c) => c.id), cards.map((c) => c.id));
  assert.equal(g.started, false);
});
