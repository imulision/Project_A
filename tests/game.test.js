// The game as the screen sees it: time that runs and pauses, the boss's
// orders, what happened, and who can be named. No drawing here.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../web/game.js');
const W = require('../web/world.js');
const D = require('../web/district.js');

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
  assert.deepEqual(G.command(g, { type: 'seat', seat: 'fixer', capo: 'tommy' }), { ok: true });
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
  const answer = G.command(g, { type: 'takeover', district: 'lorne-harbour', way: 'force', capo: 'mae' });
  assert.equal(answer.ok, false);
  assert.match(answer.error, /out of reach/);
  assert.equal(G.command(g, { type: 'dance' }).ok, false);
  assert.equal(JSON.stringify(g), before);
});

test('every order of the boss goes through: replace, seat, unseat, underboss', () => {
  const g = G.createGame({ capo: 'sal' });
  Object.assign(g.world.treasury, { dirty: 50000, clean: 50000 });
  W.claim(g.world, 'ashport-market', 'danny'); // the family already holds two districts of the city
  for (const c of [
    { type: 'appoint', district: 'ashport-hillside', capo: 'mae' },
    { type: 'seat', seat: 'fixer', capo: 'tommy' },
    { type: 'unseat', seat: 'fixer' },
    { type: 'underboss', city: 'ashport', capo: 'tommy' },
    { type: 'takeover', district: 'ashport-docks', way: 'buy' },
  ]) assert.deepEqual(G.command(g, c), { ok: true }, JSON.stringify(c));
  assert.equal(W.district(g.world, 'ashport-hillside').state.capo, 'mae');
  assert.equal(g.world.underbosses.ashport, 'tommy');
  assert.equal(G.takeovers(g)[0].district, 'ashport-docks', 'the underboss chose the man');
  assert.match(G.command(g, { type: 'claim', district: 'ashport-station', capo: 'vince' }).error, /no such order/, 'nobody walks into a district for a flat fee any more');
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

test('the screen can ask what moves on the map this month', () => {
  const g = G.createGame();
  assert.deepEqual(G.trips(g), []);
  G.command(g, { type: 'start', capo: 'dutch' });
  month(g);
  const trips = G.trips(g);
  assert.ok(trips.some((t) => t.kind === 'liquor') && trips.some((t) => t.kind === 'tribute'));
  assert.deepEqual(G.trips(G.load(G.save(g))), trips);
});

test('the screen can ask for the flows of one of the family\'s districts', () => {
  const g = G.createGame({ capo: 'dutch' });
  month(g);
  const f = G.flows(g, 'ashport-hillside');
  assert.ok(f.made > 0 && f.sold > 0 && f.income > 0);
  assert.equal(G.flows(g, 'ashport-docks'), null);
});

test('the boss reads what his capos ask leave for, and answers yes or no', () => {
  const g = G.createGame({ capo: 'sal' });
  g.world.districts['ashport-hillside'].state.attacked = 3;
  month(g);
  const asks = G.proposals(g);
  assert.equal(asks.length, 1);
  assert.ok(asks[0].capoName && asks[0].place && asks[0].label && asks[0].why && asks[0].monthsLeft > 0);
  assert.equal(G.hud(g).pending, 1);
  assert.equal(g.journal[0].type, 'proposal');
  assert.deepEqual(G.command(g, { type: 'refuse', id: 'nope' }).ok, false);
  assert.deepEqual(G.command(g, { type: 'approve', id: asks[0].id }), { ok: true });
  assert.equal(G.hud(g).pending, 0);
  month(g);
  assert.ok(g.journal.some((e) => e.type === 'job' && e.outcome === 'done'));
});

test('the screen reads the wheel and each man\'s rank, and the journal tells of promotions', () => {
  const g = G.createGame({ capo: 'dutch' });
  assert.equal(G.wheel(g).sectors.length, 6);
  assert.equal(G.candidates(g, 'ashport-market')[0].rankName, 'Soldier');
  for (let i = 0; i < 36; i++) month(g);
  assert.ok(g.journal.some((e) => e.type === 'promotion'));
  const dutch = G.person(g, 'dutch');
  assert.ok(dutch.rank >= 1 && dutch.abilities[0].name && dutch.abilities[0].text && dutch.name);
  assert.ok(G.wheel(g).lit >= 1);
  assert.equal(G.wheel(G.createGame()).lit, 0);
  assert.deepEqual(G.person(G.load(G.save(g)), 'dutch'), dutch);
});

// --- never stuck ---
test('the local man of a district is offered with the big names, and marked as such', () => {
  const g = G.createGame({ capo: 'sal' });
  const cards = G.candidates(g, 'ashport-market');
  assert.equal(cards.filter((c) => c.local).length, 1);
  assert.equal(cards.length, 6);
  assert.ok(G.person(g, cards.find((c) => c.local).id).name);
  assert.ok(G.candidates(g).every((c) => !c.local), 'no local man without a district');
});

// A boss who takes every district he can, as soon as he can pay for it.
function greedy(g, months) {
  for (let m = 0; m < months; m++) {
    month(g);
    G.proposals(g).forEach((p) => G.command(g, { type: 'approve', id: p.id }));
    for (const o of G.openings(g)) {
      const cards = G.candidates(g, o.district);
      assert.ok(cards.length > 0, `${G.hud(g).date}: nobody to name in ${o.name}`);
      const way = o.ways.find((w) => w.affordable);
      if (!way || o.underWay) continue;
      const man = cards.find((c) => c.odds[way.way] === 'good') || cards.find((c) => c.local) || cards[0];
      assert.deepEqual(G.command(g, { type: 'takeover', district: o.district, way: way.way, capo: man.id }), { ok: true });
      break; // one move a month, whatever the odds
    }
  }
}

test('a boss who keeps expanding for twenty years is never left without a move', () => {
  const g = G.createGame({ capo: 'dutch' });
  greedy(g, 240);
  const cities = G.view(g).cities;
  const held = cities.reduce((n, c) => n + c.held, 0);
  assert.ok(held >= 5, `${held} districts after twenty years, sending men whatever their chances`);
  assert.ok(G.openings(g).every((o) => G.candidates(g, o.district).length > 0));
  G.load(G.save(g));
});

test('the screen can draw the curves of a district and say what its capo is after', () => {
  const g = G.createGame({ capo: 'dutch' });
  for (let i = 0; i < 14; i++) month(g);
  const h = G.history(g, W.HOME);
  assert.equal(h.length, 14);
  assert.equal(h[0].date, 'January 1926');
  const p = G.intent(g, W.HOME);
  assert.equal(p.capoName, 'Dutch Keller');
  assert.ok(p.label && p.progress >= 0 && p.progress <= 1);
  assert.equal(G.intent(g, 'ashport-docks'), null);
});

test('the top bar says what reached the boss last month, clean and dirty', () => {
  const g = G.createGame({ capo: 'dutch' });
  const before = { ...g.world.treasury };
  for (let i = 0; i < 12; i++) month(g);
  const last = G.hud(g).lastMonth;
  assert.equal(typeof last.clean, 'number');
  assert.equal(typeof last.dirty, 'number');
  assert.ok(g.world.treasury.clean > before.clean);
});

test('a request says how long the capo waits in all, for a gauge', () => {
  const g = G.createGame({ capo: 'sal' });
  for (let i = 0; i < 60 && !G.proposals(g).length; i++) { g.world.districts[W.HOME].state.attacked = 1; month(g); }
  const p = G.proposals(g)[0];
  assert.equal(p.waits, W.RULES.jobs.expires);
  assert.ok(p.monthsLeft <= p.waits);
});

// --- taking a district ---
test('the screen is told the ways into a district, their price, and each man\'s chances', () => {
  const g = G.createGame({ capo: 'sal' });
  const o = G.openings(g).find((x) => x.district === 'ashport-market');
  assert.deepEqual(o.ways.map((w) => w.way), ['force', 'bribe', 'buy']);
  for (const w of o.ways) { assert.ok(w.cost > 0 && w.months > 0); assert.ok(['dirty', 'clean'].includes(w.cur)); assert.equal(typeof w.affordable, 'boolean'); }
  const tommy = G.candidates(g, 'ashport-market').find((c) => c.id === 'tommy');
  assert.equal(tommy.odds.bribe, 'good');
  assert.equal(tommy.odds.buy, 'good');
});

test('the boss orders a takeover, watches it advance, and reads how it ended', () => {
  const g = G.createGame({ capo: 'sal' });
  g.world.treasury.dirty = 20000;
  assert.deepEqual(G.command(g, { type: 'takeover', district: 'ashport-market', way: 'bribe', capo: 'tommy' }), { ok: true });
  month(g);
  const t = G.takeovers(g)[0];
  assert.equal(t.capoName, 'Tommy "the Priest" Byrne');
  assert.equal(t.place, 'Market Street, Ashport');
  assert.ok(t.progress > 0 && t.progress < 1);
  for (let i = 0; i < t.months; i++) month(g);
  assert.equal(G.view(g).cities[0].held, 2);
  assert.ok(g.journal.some((e) => e.type === 'takeover' && e.outcome === 'done'));
  assert.equal(G.command(g, { type: 'takeover', district: 'ashport-docks', way: 'buy', capo: 'mae' }).ok, false);
});

// A boss who only uses takeovers, and only the ones his man says look good.
function patient(g, months, learns) {
  for (let m = 0; m < months; m++) {
    month(g);
    G.proposals(g).forEach((p) => G.command(g, { type: 'approve', id: p.id }));
    G.promotions(g).forEach((p) => G.command(g, { type: 'promote', capo: p.capo, ability: p.options[0].id }));
    if (learns && !G.research(g)) {
      // he has the family learn what his capos ask for, the cheapest first
      const asked = G.tree(g).filter((b) => b.wantedBy.length && b.next && b.next.affordable).sort((x, y) => x.next.cost - y.next.cost)[0];
      if (asked) assert.deepEqual(G.command(g, { type: 'research', building: asked.id }), { ok: true });
    }
    if (G.takeovers(g).length) continue;
    search: for (const o of G.openings(g)) {
      for (const w of o.ways) {
        if (!w.affordable) continue;
        const man = G.candidates(g, o.district).find((c) => c.odds[w.way] === 'good');
        if (!man) continue;
        assert.deepEqual(G.command(g, { type: 'takeover', district: o.district, way: w.way, capo: man.id }), { ok: true });
        break search;
      }
    }
  }
}

test('with takeovers alone, a patient boss still builds a family across several cities in twenty years', () => {
  const g = G.createGame({ capo: 'dutch' });
  patient(g, 240);
  const cities = G.view(g).cities;
  const held = cities.reduce((n, c) => n + c.held, 0);
  assert.ok(held >= 8, `${held} districts after twenty years`);
  assert.ok(held <= 30, `${held} districts: taking a district is meant to be hard`);
  assert.ok(cities.filter((c) => c.held > 0).length >= 2);
});

test('the boss reads who waits for a promotion, promotes him, and sees the family by rank', () => {
  const g = G.createGame({ capo: 'dutch' });
  for (let i = 0; i < 60 && !G.promotions(g).length; i++) month(g);
  const offer = G.promotions(g)[0];
  assert.equal(offer.capoName, 'Dutch Keller');
  assert.ok(offer.options.every((o) => o.name && o.text && o.sector));
  assert.equal(G.hud(g).promotions, 1);
  assert.deepEqual(G.command(g, { type: 'promote', capo: 'dutch', ability: offer.options[1].id }), { ok: true });
  assert.ok(g.journal.some((e) => e.type === 'promotion'));
  const ranks = G.ranks(g);
  assert.equal(ranks[1].men[0].name, 'Dutch Keller');
  assert.equal(ranks[1].pay, W.RANKS[1].pay);
});

test('the boss orders a research from the wheel and watches its bar', () => {
  const g = G.createGame({ capo: 'dutch' });
  for (let i = 0; i < 60 && !G.promotions(g).length; i++) month(g);
  const ability = G.promotions(g)[0].options[0].id;
  G.command(g, { type: 'promote', capo: 'dutch', ability });
  assert.equal(G.research(g), null);
  g.world.treasury.clean = 50000;
  assert.deepEqual(G.command(g, { type: 'research', ability }), { ok: true });
  month(g);
  const r = G.research(g);
  assert.equal(r.id, ability);
  assert.ok(r.name && r.progress > 0 && r.progress < 1);
  for (let i = 0; i < r.months; i++) month(g);
  assert.equal(G.research(g), null);
  assert.ok(g.journal.some((e) => e.type === 'research'));
});

test('the screen reads the money of a district place by place, and nothing where the family is not', () => {
  const g = G.createGame({ capo: 'dutch' });
  for (let i = 0; i < 12; i++) month(g);
  assert.ok(G.cash(g, W.HOME).some((c) => c.at === 'hideout' && c.kind === 'dirty'));
  assert.deepEqual(G.cash(g, 'ashport-docks'), []);
});

test('the screen reads the building tree, orders a trade and watches its bar', () => {
  const blank = G.tree(G.createGame());
  assert.equal(blank.find((b) => b.id === 'still').tier, 1);
  assert.equal(blank.find((b) => b.id === 'gambling').tier, 0);
  const g = G.createGame({ capo: 'danny' });
  const gambling = () => G.tree(g).find((b) => b.id === 'gambling');
  assert.equal(gambling().next.affordable, false);
  assert.equal(G.command(g, { type: 'research', building: 'gambling' }).ok, false);
  g.world.treasury.clean = 5000;
  assert.equal(gambling().next.affordable, true);
  assert.deepEqual(gambling().likedBy.map((p) => p.name), [D.CAPOS.danny.name]);
  assert.deepEqual(G.command(g, { type: 'research', building: 'gambling' }), { ok: true });
  assert.equal(gambling().next.affordable, false, 'one subject at a time');
  month(g);
  const r = G.research(g);
  assert.deepEqual([r.id, r.building, r.tier, r.name], ['gambling', true, 1, 'Gambling room']);
  assert.ok(r.progress > 0 && r.progress < 1);
  assert.ok(gambling().progress > 0 && gambling().progress < 1);
  for (let i = 0; i < r.months; i++) month(g);
  assert.equal(gambling().tier, 1);
  assert.equal(gambling().progress, null);
  assert.ok(g.journal.some((e) => e.type === 'research' && e.building === 'gambling'));
});

test('a capo who waits for a trade says so, and the tree names him', () => {
  const g = G.createGame({ capo: 'danny' });
  let asked = null;
  for (let i = 0; i < 36 && !asked; i++) { month(g); asked = G.tree(g).find((b) => b.wantedBy.length); }
  assert.ok(asked, 'within three years Danny asks for a trade');
  assert.deepEqual(asked.wantedBy.map((p) => p.id), ['danny']);
  assert.equal(G.intent(g, W.HOME).wish.site, asked.id);
});

test('a boss who has the family learn what its capos ask for ends twenty years with more trades and more money coming in', () => {
  const plain = G.createGame({ capo: 'dutch' }), learned = G.createGame({ capo: 'dutch' });
  patient(plain, 240);
  patient(learned, 240, true);
  const trades = (g) => G.tree(g).filter((b) => b.tier > 0).length;
  const held = (g) => G.view(g).cities.reduce((n, c) => n + c.held, 0);
  const income = (g) => G.hud(g).lastMonth.dirty + G.hud(g).lastMonth.clean;
  assert.equal(trades(plain), 4);
  assert.ok(trades(learned) >= 7, trades(learned) + ' trades known');
  assert.ok(held(learned) >= held(plain), held(learned) + ' districts against ' + held(plain));
  assert.ok(income(learned) > 1.5 * income(plain), Math.round(income(learned)) + ' a month against ' + Math.round(income(plain)));
});
