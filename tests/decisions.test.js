// What became of the boss's decisions: each one is remembered, and a year on the game says what it gave.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const T = require('../web/turf.js');

const months = (g, n) => { const out = []; for (let i = 0; i < n * E.TICKS_PER_MONTH; i++) { g.paused = false; out.push(...E.tick(g)); } return out; };
const ashport = (g) => g.cities[0];
// A game where somebody has just been taken in next to the first capo.
const withTwo = () => {
  const g = E.createGame({ capo: 'dutch' }), c = ashport(g);
  g.family.dirty = 50000; g.family.clean = 50000; c.burnt = 99; // (a city this burnt brings a man of need to the door)
  const d = T.doors(c, g.family)[0], s = T.spots(c)[0];
  E.command(g, { type: 'welcome', city: 'ashport', capo: d.capo, x: s.x, y: s.y });
  return { g, capo: d.capo };
};

test('a new game has no decision to show', () => {
  assert.deepEqual(E.view(E.createGame()).decisions, []);
  assert.deepEqual(E.view(E.createGame({ capo: 'dutch' })).decisions, []);
});

test('taking a man in is remembered: what was decided, when, and that its outcome is still to come', () => {
  const { g, capo } = withTwo();
  const d = E.view(g).decisions;
  assert.equal(d.length, 1);
  assert.deepEqual([d[0].type, d[0].city, d[0].capo, d[0].month, d[0].due, d[0].result], ['welcomed', 'ashport', capo, 0, 12, null]);
  assert.equal(d[0].label, 'You took in ' + T.person(capo).name + ' in Ashport');
  assert.equal(d[0].date, 'January 1926');
});

test('a year on, the game says what the man has become, once, in the news and on the decision', () => {
  const { g, capo } = withTwo();
  assert.ok(!months(g, 11).some((e) => e.type === 'outcome'), 'not before a year');
  const told = months(g, 1).filter((e) => e.type === 'outcome');
  assert.equal(told.length, 1);
  const places = T.run(ashport(g), capo).length, income = g.family.men[capo].income, first = T.person(capo).name.split(' ')[0];
  assert.equal(told[0].label, 'A year on: ' + first + ' runs ' + places + ' place' + (places === 1 ? '' : 's') + ' in Ashport and makes $' + income.toLocaleString('en-US') + ' a month');
  assert.equal(told[0].good, places >= 2);
  assert.deepEqual([told[0].city, told[0].capo, told[0].decision], ['ashport', capo, E.view(g).decisions[0].id]);
  const d = E.view(g).decisions[0];
  assert.deepEqual(d.result, { month: 12, date: 'January 1927', label: told[0].label, good: told[0].good });
  assert.ok(g.journal.some((l) => l.type === 'outcome' && l.label === told[0].label));
  assert.equal(g.paused, false, 'the clock does not stop for it');
  assert.ok(!months(g, 24).some((e) => e.type === 'outcome'), 'said once');
});

test('a man taken in who is gone a year later: the outcome says so', () => {
  const { g, capo } = withTwo();
  months(g, 3);
  E.command(g, { type: 'part', city: 'ashport', capo, way: 'retire' });
  const told = months(g, 9).filter((e) => e.type === 'outcome' && e.capo === capo && /A year on: \w+ is gone/.test(e.label));
  assert.equal(told.length, 1);
  assert.equal(told[0].good, false);
});

test('the boss\'s line for a city: a year on, the places, the money sent up and the heat, each against what it was', () => {
  const g = E.createGame({ capo: 'dutch' }), c = ashport(g);
  months(g, 6);
  const was = { places: T.places(c).filter((p) => p.owner === 'family').length, up: Math.round(c.flow.up), heat: Math.round(c.heat || 0) };
  E.command(g, { type: 'line', city: 'ashport', line: 'low' });
  assert.equal(E.view(g).decisions[0].label, 'Your word for Ashport: lie low');
  const told = months(g, 12).filter((e) => e.type === 'outcome')[0];
  const now = { places: T.places(c).filter((p) => p.owner === 'family').length, up: Math.round(c.flow.up), heat: Math.round(c.heat || 0) };
  assert.equal(told.label, 'A year on under Lie low: ' + now.places + ' places (was ' + was.places + '), $' + now.up.toLocaleString('en-US') + ' a month sent up (was $' + was.up.toLocaleString('en-US') + '), heat ' + now.heat + ' (was ' + was.heat + ')');
  assert.equal(told.good, now.heat < was.heat ? true : now.heat > was.heat ? false : null, 'lie low is judged on the heat');
});

test('a word changed before the year is out closes the first one without a verdict', () => {
  const g = E.createGame({ capo: 'dutch' });
  months(g, 2);
  E.command(g, { type: 'line', city: 'ashport', line: 'grow' });
  months(g, 5);
  E.command(g, { type: 'line', city: 'ashport', line: 'earn' });
  const d = E.view(g).decisions;
  assert.deepEqual(d.map((q) => q.label), ['Your word for Ashport: earn', 'Your word for Ashport: grow'], 'the newest first');
  assert.deepEqual(d[1].result, { month: 7, date: E.view(g).date, label: 'You changed your word after 5 months', good: null });
  assert.equal(months(g, 12).filter((e) => e.type === 'outcome').length, 1, 'only the second is judged');
});

test('the boss\'s share in a city: a year on, what comes up and how many capos have turned sour', () => {
  const g = E.createGame({ capo: 'dutch' }), c = ashport(g);
  months(g, 6);
  const sour = () => Object.keys(g.family.men).filter((id) => T.clubOf(c, id) && T.view(c, g.family).capos.find((k) => k.id === id).mood !== 'steady').length;
  const was = { up: Math.round(c.flow.up), sour: sour() };
  E.command(g, { type: 'cut', city: 'ashport', cut: 'heavy' });
  assert.equal(E.view(g).decisions[0].label, 'You took a heavy share in Ashport');
  const told = months(g, 12).filter((e) => e.type === 'outcome')[0], now = { up: Math.round(c.flow.up), sour: sour() };
  assert.equal(told.label, 'A year on with a heavy share: $' + now.up.toLocaleString('en-US') + ' a month sent up (was $' + was.up.toLocaleString('en-US') + '), ' + now.sour + ' sour capo' + (now.sour === 1 ? '' : 's') + ' (was ' + was.sour + ')');
  assert.equal(told.good, now.sour > was.sour ? false : now.up > was.up ? true : null);
});

test('parting with a capo: a year on, what the city has become without him', () => {
  const { g, capo } = withTwo(), c = ashport(g);
  months(g, 13); // (the outcome of taking him in has been told)
  const was = { places: T.places(c).filter((p) => p.owner === 'family').length, up: Math.round(c.flow.up) }, name = T.person(capo).name;
  E.command(g, { type: 'part', city: 'ashport', capo, way: 'retire' });
  assert.equal(E.view(g).decisions[0].label, 'You paid ' + name + ' off');
  const told = months(g, 12).filter((e) => e.type === 'outcome').pop();
  const now = { places: T.places(c).filter((p) => p.owner === 'family').length, up: Math.round(c.flow.up) };
  assert.equal(told.label, 'A year on without ' + name.split(' ')[0] + ': ' + now.places + ' places in Ashport (was ' + was.places + '), $' + now.up.toLocaleString('en-US') + ' a month sent up (was $' + was.up.toLocaleString('en-US') + ')');
  assert.equal(told.good, now.up > was.up ? true : now.up < was.up ? false : null);
});

test('a word given or refused for a key place: a year on, who holds it', () => {
  const g = E.createGame({ capo: 'sal' });
  let ask = null;
  for (let m = 0; m < 240 && !ask; m++) {
    months(g, 1);
    for (const c of E.view(g).cities) {
      for (const d of c.doors) { const s = T.spots(g.cities.find((q) => q.id === c.id))[0]; try { E.command(g, { type: 'welcome', city: c.id, capo: d.capo, x: s.x, y: s.y }); } catch (e) { /* cannot pay yet */ } }
      if (c.asks.length) ask = { city: c.id, a: c.asks[0] };
    }
  }
  assert.ok(ask, 'a capo asked for a key place');
  E.command(g, { type: 'answer', city: ask.city, id: ask.a.id, yes: false });
  const d = E.view(g).decisions[0];
  assert.deepEqual([d.type, d.capo, d.key], ['denied', ask.a.capo, ask.a.key]);
  assert.equal(d.label, 'You refused ' + T.person(ask.a.capo).name + ' the ' + ask.a.name);
  const c = g.cities.find((q) => q.id === ask.city);
  let told = null;
  for (let m = 0; m < 12 && !told; m++) { told = months(g, 1).find((e) => e.type === 'outcome' && e.decision === d.id); for (const v of E.view(g).cities) for (const a of v.asks) E.command(g, { type: 'answer', city: v.id, id: a.id, yes: false }); }
  const owner = T.keys(c).find((k) => k.key === ask.a.key).owner;
  assert.equal(told.label, 'A year on: the ' + owner + 's still hold the ' + ask.a.name + ', and you kept the $' + ask.a.cost.toLocaleString('en-US') + ' it would have cost');
  assert.equal(told.good, null);
});

test('the game keeps the last twenty decisions, and a saved game keeps them too', () => {
  const g = E.createGame({ capo: 'dutch' });
  for (let i = 0; i < 25; i++) { months(g, 1); E.command(g, { type: 'line', city: 'ashport', line: ['grow', 'earn', 'low'][i % 3] }); }
  assert.equal(E.view(g).decisions.length, E.DECISIONS);
  assert.equal(E.DECISIONS, 20);
  const ids = E.view(g).decisions.map((d) => d.id);
  assert.equal(new Set(ids).size, 20, 'each has its own id');
  const back = E.load(E.save(g));
  assert.deepEqual(E.view(back).decisions, E.view(g).decisions);
  delete back.decisions;
  assert.deepEqual(E.view(back).decisions, [], 'a game saved before decisions were kept');
  months(back, 13);
});
