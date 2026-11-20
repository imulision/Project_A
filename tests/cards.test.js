// The sheets of the new screen (web/cards.js): each one is HTML worked out from what AshportEmpire shows, with no page behind it.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const C = require('../web/cards.js');

// A game played with a boss who says yes to all he can afford, stopped at the first moment `until` is true.
function play(until, months) {
  const g = E.createGame({ capo: 'sal' });
  for (let i = 0; i < (months || 240) * E.TICKS_PER_MONTH; i++) {
    E.tick(g);
    const v = E.view(g);
    if (until(v, g)) return { g, v };
    v.cities.forEach((c) => {
      c.asks.forEach((a) => { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: true }); } catch (e) { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } });
      c.doors.forEach((d) => { try { E.command(g, { type: 'welcome', city: c.id, from: c.id, capo: d.capo, x: 6, y: 11 }); } catch (e) { /* cannot pay yet */ } });
      c.feuds.forEach((f) => E.command(g, { type: 'rule', city: c.id, id: f.id, winner: f.a }));
    });
    if (g.paused) E.command(g, { type: 'resume' });
  }
  throw new Error('the game never got there');
}
const some = (k) => (v) => v.cities.some((c) => c[k].length);
const two = (v) => v.cities[0].capos.length > 1;
const acts = (html, act) => (html.match(new RegExp('data-act="' + act + '"[^>]*>', 'g')) || []);

test('the first sheet shows the six men a boss can start with, the first one in full', () => {
  const html = C.start(E.candidates());
  assert.equal((html.match(/data-face="/g) || []).length, 6);
  assert.match(html, /data-act="start" data-capo="sal"/);
  assert.match(html, /Enforcer/);
  assert.match(html, /Loan office/, 'what he likes to open is told');
});

test('a man looked at alone carries his own start button', () => {
  assert.match(C.man(E.candidates()[1], 'start', 'Start with'), /data-act="start" data-capo="mae"[^>]*>Start with Mae</);
});

test('money is written the same way everywhere', () => {
  assert.equal(C.money(2481.7), '$2,482');
});

test('nothing waiting: the sheet of requests says so and offers nothing to press', () => {
  const g = E.createGame({ capo: 'sal' });
  const html = C.requests(E.view(g), E.hud(g));
  assert.match(html, /Nobody waits/);
  assert.equal(acts(html, 'welcome').length + acts(html, 'answer').length + acts(html, 'rule').length, 0);
});

test('a man at the door: his price, a street to choose here, and each road he could take', () => {
  const { g, v } = play(some('doors'));
  const city = v.cities.find((c) => c.doors.length), d = city.doors[0];
  const html = C.requests(v, E.hud(g));
  assert.match(html, new RegExp(d.name.split(' ')[0]));
  assert.match(html, new RegExp('\\' + C.money(d.cost)));
  assert.equal(acts(html, 'seat').length, 1, 'one button to seat him in the city where he knocked');
  assert.equal(acts(html, 'road').length, d.roads.length, 'one button per road');
  assert.match(html, new RegExp('data-act="road" data-from="' + city.id + '" data-city="' + d.roads[0].city + '" data-capo="' + d.capo + '"'));
});

test('what the boss cannot pay cannot be pressed, and the sheet says what is missing', () => {
  const { g, v } = play(some('doors'));
  const hud = Object.assign({}, E.hud(g), { dirty: 0, clean: 0 });
  const html = C.requests(v, hud);
  assert.equal(acts(html, 'seat').filter((b) => /disabled/.test(b)).length, 1);
  assert.match(html, /short/i);
});

test('a city with every seat taken cannot take the man in, and says what would open a seat', () => {
  const { g, v } = play(some('doors'));
  const city = v.cities.find((c) => c.doors.length);
  city.seats = { taken: 3, total: 3 };
  const html = C.requests(v, Object.assign({}, E.hud(g), { dirty: 99999 }));
  assert.match(acts(html, 'seat')[0], /disabled/);
  assert.match(html, /No seat left in /);
  assert.match(html, /key place/);
});

test('two capos at odds: both faces, one button each', () => {
  const { g, v } = play(some('feuds'));
  const city = v.cities.find((c) => c.feuds.length), f = city.feuds[0];
  const html = C.requests(v, E.hud(g));
  const b = acts(html, 'rule');
  assert.equal(b.length, 2);
  assert.match(b[0], new RegExp('data-city="' + city.id + '" data-id="' + f.id.replace('|', '\\|') + '" data-winner="' + f.a + '"'));
  assert.match(b[1], new RegExp('data-winner="' + f.b + '"'));
});

test('a capo asks for a key place: what it gives, what it costs, yes or no', () => {
  const ask = { id: 'sal:brewery', capo: 'sal', key: 'brewery', name: 'Brewery', x: 12, y: 8, gives: 'Pours for eight speakeasies', way: 'force', cost: 1800, months: 4, why: 'It pours for his bars' };
  const v = E.view(E.createGame({ capo: 'sal' }));
  v.cities[0].asks = [ask];
  const html = C.requests(v, { dirty: 5000, clean: 0, pending: 1 });
  assert.match(html, /Brewery/);
  assert.match(html, /\$1,800/);
  assert.match(html, /4 months/);
  assert.match(html, /Pours for eight speakeasies/, 'what the place gives is told');
  assert.match(html, /data-act="answer" data-city="ashport" data-id="sal:brewery" data-yes="1"/);
  assert.match(html, /data-act="answer" data-city="ashport" data-id="sal:brewery" data-yes="0"/);
});

test('the sheet of a capo: what he is after, what he runs, and the ways to part with him', () => {
  const { v } = play(two);
  const k = v.cities[0].capos[0];
  const html = C.capo(v, 'ashport', k.id);
  assert.match(html, /Sal/);
  assert.match(html, new RegExp(k.rankName));
  assert.match(html, new RegExp(k.places + ' / ' + k.reach), 'places he runs out of what his rank allows');
  assert.match(html, new RegExp('\\' + C.money(k.income)));
  assert.equal(acts(html, 'parting').length, 3);
  const alone = E.view(E.createGame({ capo: 'sal' }));
  assert.match(C.capo(alone, 'ashport', 'sal'), /only capo/, 'a boss cannot part with his last man');
  assert.equal(C.capo(v, 'ashport', 'nobody'), null, 'an unknown man has no sheet');
});

test('parting with a capo is asked twice: the second sheet says what it costs and carries the order', () => {
  const { v } = play(two);
  const html = C.parting(v, 'ashport', 'sal', 'kill');
  assert.match(html, /Have him killed/);
  assert.match(html, /data-act="part" data-city="ashport" data-capo="sal" data-way="kill"/);
  assert.match(html, /data-act="capo" data-city="ashport" data-capo="sal"/, 'and a way back');
});

test('a block: its street, who holds it, and the place that stands there', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club'), key = city.keys[0];
  const mine = C.block(v, 'ashport', ours.x, ours.y);
  assert.match(mine, new RegExp(city.zones.find((z) => ours.x >= z.x0 && ours.x <= z.x1 && ours.y >= z.y0 && ours.y <= z.y1).name));
  assert.match(mine, /Sal/, 'the man who runs it');
  const theirs = C.block(v, 'ashport', key.x, key.y);
  assert.match(theirs, new RegExp(key.name));
  assert.match(theirs, new RegExp(key.gives));
  assert.match(theirs, /Callahan/);
});

test('a city: how its streets are shared, its seats, its key places and the men on both sides', () => {
  const { v } = play((v) => v.month >= 12);
  const html = C.city(v, 'ashport');
  assert.match(html, /Ashport/);
  assert.match(html, /class="shares"/);
  assert.match(html, /Brewery/);
  assert.match(html, /data-act="capo" data-city="ashport" data-capo="sal"/);
  assert.match(html, /Finn/, 'the rival family has faces too');
  const far = C.city(v, v.cities[1].id);
  assert.match(far, /no man of yours/i);
});

test('the family sheet: every capo, the trades the family knows, and what each next step costs', () => {
  const { g, v } = play((v) => v.month >= 12);
  const html = C.family(v, E.hud(g));
  assert.match(html, /data-act="capo" data-city="ashport" data-capo="sal"/);
  assert.equal((html.match(/data-know="/g) || []).length, v.tree.length);
  const shut = v.tree.find((t) => t.tier === 0 && t.next);
  const one = C.know(v, shut.kind, { dirty: 0, clean: 99999 });
  assert.match(one, new RegExp(shut.name));
  assert.match(one, new RegExp('\\' + C.money(shut.next.cost)));
  assert.match(one, new RegExp('data-act="research" data-building="' + shut.kind + '"'));
  assert.match(C.know(v, shut.kind, { dirty: 0, clean: 0 }), /disabled/);
});

test('a trade being learned shows how far along it is and offers no second order', () => {
  const { g } = play((v) => v.month >= 12);
  g.family.clean = 99999;
  const shut = E.view(g).tree.find((t) => t.tier === 0 && t.next);
  E.command(g, { type: 'research', building: shut.kind });
  const v = E.view(g), html = C.know(v, shut.kind, E.hud(g));
  assert.match(html, /Learning/);
  assert.doesNotMatch(html, /data-act="research"/);
  const other = v.tree.find((t) => t.kind !== shut.kind && t.next);
  assert.match(C.know(v, other.kind, E.hud(g)), /one thing at a time/i);
});

test('the journal reads newest first, each line with its date', () => {
  const { g } = play((v) => v.month >= 24);
  const html = C.journal(g.journal);
  const last = g.journal[g.journal.length - 1];
  assert.ok(html.indexOf(last.label.replace(/'/g, '&#39;').replace(/"/g, '&quot;')) < html.indexOf(g.journal[0].date + '<') || g.journal.length === 1);
  assert.match(html, new RegExp(last.date));
  assert.match(C.journal([]), /Nothing yet/);
});

test('what a car carries is told in a few words', () => {
  assert.match(C.carTip({ kind: 'liquor', cargo: 'liquor', capo: 'dutch' }), /Liquor/);
  assert.match(C.carTip({ kind: 'crew', cargo: 'force', capo: 'sal' }), /Sal/);
});

test('the mark over a capo on the map: his face, a gauge and what he is doing', () => {
  const html = C.mark({ capo: 'sal', move: 'open', kind: 'speakeasy', progress: 0.5 });
  assert.match(html, /class="pf"/);
  assert.match(html, /class="do"/);
  assert.match(html, /class="ring"/);
});

test('names with quotes and brackets never break a sheet', () => {
  const html = C.journal([{ date: 'May 1926', type: 'opened', label: 'A <b> "place"' }]);
  assert.doesNotMatch(html, /<b> "place"/);
});

test('labels that would sit on one another: the more important one stays, the other hides', () => {
  const box = (id, rank, x, y, w, h) => ({ id, rank, x, y, w: w || 22, h: h || 22 });
  const hidden = C.crowded([box('pinA', 3, 100, 100), box('name', 1, 105, 100, 120, 24), box('capo', 0, 400, 400, 46, 46), box('pinB', 3, 410, 410), box('pinC', 3, 700, 100), box('pinD', 3, 710, 105), box('far', 3, 50, 600)]);
  assert.deepEqual(Object.keys(hidden).sort(), ['pinA', 'pinB', 'pinD'], 'a name beats a pin, a capo beats a pin, and of two equal pins the first by name stays');
  assert.deepEqual(C.crowded([]), {});
});

test('the same labels always give the same answer, whatever order they come in', () => {
  const a = { id: 'a', rank: 2, x: 0, y: 0, w: 20, h: 20 }, b = { id: 'b', rank: 2, x: 5, y: 5, w: 20, h: 20 };
  assert.deepEqual(C.crowded([a, b]), C.crowded([b, a]));
});

test('every key place has a picture of its own kind, never the unknown mark', () => {
  const T = require('../web/turf.js'), I = require('../web/icons.js');
  Object.keys(T.KEYS).forEach((k) => { assert.ok(I.has(C.iconName(k)), k); assert.notEqual(C.iconName(k), 'unknown', k); });
  assert.equal(C.iconName('club'), 'hideout');
  assert.equal(C.iconName('speakeasy'), 'speakeasy');
});

test('dirty cash has one picture everywhere: on the top bar, on the cars that carry it and on those that take it to be washed', () => {
  const I = require('../web/icons.js');
  assert.equal(I.icon('dirty'), I.icon('takings'));
  assert.equal(C.HAUL.wash[0], 'dirty');
  assert.notEqual(C.HAUL.wash[1], C.HAUL.takings[1], 'the colour still tells the two trips apart');
  assert.notEqual(I.icon('dirty'), I.icon('clean'));
});
