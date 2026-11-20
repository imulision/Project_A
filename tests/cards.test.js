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

test('money that can be followed: the month\'s change beside a total, the amount a car carries, what a capo sent up', () => {
  assert.equal(C.change(52), '+$52');
  assert.equal(C.change(-1300), '−$1,300');
  assert.equal(C.change(0), '');
  assert.equal(C.change(undefined), '');
  assert.equal(C.carLoad({ kind: 'takings', amount: 142 }), '$142');
  assert.equal(C.carLoad({ kind: 'wash', amount: 80 }), '$80');
  assert.equal(C.carLoad({ kind: 'takings', amount: 0 }), '');
  assert.equal(C.carLoad({ kind: 'liquor', amount: 30 }), '', 'only cash is counted in dollars');
  assert.match(C.carTip({ kind: 'takings', cargo: 'cash', capo: 'sal', amount: 142 }), /\$142 on board/);
  assert.match(C.carTip({ kind: 'takings', cargo: 'cash', capo: 'sal', amount: 142 }), /Sal/);
  const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < 8; i++) E.tick(g);
  const v = E.view(g), k = v.cities[0].capos[0];
  assert.ok(k.sent > 0, 'he sent something up');
  const sheet = C.capo(v, v.cities[0].id, k.id);
  assert.ok(sheet.includes('SENT UP</small><b>' + C.money(k.sent)), 'what he sent up');
  assert.ok(sheet.includes('CARS</small><b>' + k.cars), 'his cars');
  // cash that waits in a place's till for a car is said on the place and on the capo
  const c = v.cities[0], p = c.places.find((q) => q.owner === 'family' && q.kind !== 'club'); p.till = 90; k.waiting = 90;
  assert.match(C.block(v, c.id, p.x, p.y), /\$90 in the till, waiting for a car/);
  assert.match(C.capo(v, c.id, k.id), /\$90 waits in his tills/);
});

test('the laundries: what the family can wash a month is said under the dirty total, and too much dirty cash is flagged', () => {
  const view = { cities: [{ money: { washes: 300, washed: 120, cut: 30 } }, { money: { washes: 150, washed: 0, cut: 0 } }, {}] };
  const T = require('../web/turf.js');
  assert.deepEqual(C.wash(view, { dirty: 2000 }), { washes: 450, washed: 120, cut: 30, hot: false, line: 'washes $450/mo' });
  assert.equal(C.wash(view, { dirty: T.RULES.stash + 1 }).hot, true);
  assert.equal(C.wash({ cities: [{ money: { washes: 0 } }] }, { dirty: 10 }).line, 'no laundry yet');
});

test('time that stands still says so, and says why', () => {
  assert.equal(C.clock({ paused: false }), null);
  assert.deepEqual(C.clock({ paused: true, pending: 0 }), { word: 'TIME STOPPED', why: 'Tap Play to go on' });
  assert.deepEqual(C.clock({ paused: true, pending: 2 }), { word: 'TIME STOPPED', why: '2 wait for your word' });
  assert.deepEqual(C.clock({ paused: true, pending: 1 }), { word: 'TIME STOPPED', why: '1 waits for your word' });
  assert.deepEqual(C.clock({ paused: false }, true), { word: 'TIME STOPPED', why: 'Choose a street' });
});

test('an answer the boss cannot pay says how far he is from it, and the sheet says how to let time go on', () => {
  const { g, v } = play(some('doors'));
  const city = v.cities.find((c) => c.doors.length), d = city.doors[0];
  city.seats = { taken: 3, total: 3 };
  d.roads = [{ city: 'calder', name: 'Calder Falls', cost: 3250 }];
  const html = C.requests(v, Object.assign({}, E.hud(g), { dirty: 2600, clean: 0 }));
  assert.match(acts(html, 'road')[0], /disabled/);
  assert.match(html, /Send him to Calder Falls · \$3,250<small>Not enough money: \$2,600 of \$3,250<\/small>/);
  assert.equal(acts(html, 'later').length, 1, 'one button leaves them waiting');
  assert.match(html, /Leave them waiting/);
});

test('a capo\'s sheet says where he is this month', () => {
  const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < 8; i++) E.tick(g);
  const v = E.view(g), c = v.cities[0], k = c.capos[0];
  k.at = { x: 1, y: 1, why: 'take', label: 'Taking the speakeasy in Little Calabria' };
  assert.match(C.capo(v, c.id, k.id), /Taking the speakeasy in Little Calabria/);
});

test('a label at the edge of another does not blink: once hidden it comes back only with room to spare, once shown it leaves only when really covered', () => {
  const capo = { id: 'capo', rank: 0, x: 100, y: 100, w: 46, h: 46 };
  const name = (x) => ({ id: 'name', rank: 1, x, y: 100, w: 100, h: 24 });
  // shown before: touching by a pixel or two is not enough to hide it
  assert.deepEqual(C.crowded([capo, name(144)], {}), {});
  assert.deepEqual(C.crowded([capo, name(130)], {}), { name: true });
  // hidden before: just clear is not enough to bring it back
  assert.deepEqual(C.crowded([capo, name(148)], { name: true }), { name: true });
  assert.deepEqual(C.crowded([capo, name(160)], { name: true }), {});
  // so a camera that shakes by a pixel around the edge changes nothing, whichever state it was in
  [145, 146, 147, 146, 145, 147].reduce((was, x) => { const now = C.crowded([capo, name(x)], was); assert.deepEqual(now, was); return now; }, {});
  [145, 146, 147, 146, 145, 147].reduce((was, x) => { const now = C.crowded([capo, name(x)], was); assert.deepEqual(now, was); return now; }, { name: true });
  // with no memory given, the plain rule stands
  assert.deepEqual(C.crowded([capo, name(145)]), { name: true });
});

test('a badge over the map says what just happened there', () => {
  const t = C.fxTip('gunfire', "Rocco's men take the Northsides' place in The Landing, gun in hand");
  assert.match(t, /Gunfire/); assert.match(t, /Rocco&#39;s men take|Rocco's men take/);
  assert.match(C.fxTip('fire'), /Fire/);
  assert.match(C.fxTip('unknown'), /unknown/);
  assert.equal(C.FX.police[1], 'Police');
});

test('a touched street answers with a few words beside the finger, not a sheet', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club'), key = city.keys[0];
  const mine = C.blockTip(v, 'ashport', ours.x, ours.y);
  assert.match(mine, new RegExp(ours.name)); assert.match(mine, /Sal runs it/);
  assert.doesNotMatch(mine, /<button|<h2/, 'no button, no title: it is a word, not a page');
  assert.ok(mine.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '').length < 90, 'short');
  assert.match(C.blockTip(v, 'ashport', key.x, key.y), new RegExp(key.name));
  const p = { ...ours, till: 90 }, c = { ...city, places: city.places.map((q) => (q === ours ? p : q)) };
  assert.match(C.blockTip({ ...v, cities: [c] }, c.id, p.x, p.y), /\$90 in the till/);
  let empty = null; for (let y = 0; y < city.h && !empty; y++) for (let x = 0; x < city.w; x++) if (!city.places.some((q) => q.x === x && q.y === y)) { empty = C.blockTip(v, 'ashport', x, y); break; }
  assert.match(empty, /street|holds/i); assert.doesNotMatch(empty, /Nothing of note/);
  assert.equal(C.blockTip(v, 'nowhere', 0, 0), null);
});

test('a place that chokes says so: on its bubble, on its page, and in the list the map reads', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club');
  const p = { ...ours, strains: [{ kind: 'cash', label: 'The till is full: no car comes often enough' }, { kind: 'dry', label: 'Not enough liquor to sell' }] };
  const c = { ...city, places: city.places.map((q) => (q === ours ? p : q)) }, w = { ...v, cities: [c] };
  assert.match(C.blockTip(w, c.id, p.x, p.y), /The till is full/);
  assert.match(C.block(w, c.id, p.x, p.y), /The till is full[\s\S]*Not enough liquor to sell/);
  assert.deepEqual(C.strains(w)[c.id + ':' + p.x + ',' + p.y], ['cash', 'dry']);
  assert.deepEqual(C.strains({ cities: [{ id: 'a', places: [{ x: 1, y: 1 }, { x: 2, y: 1, strains: [] }] }] }), {}, 'nothing to show while all runs well');
  assert.match(C.strainBadge(['cash', 'dry']), /<i[^>]*>.*<i/s, 'one mark for each kind');
  assert.equal(C.strainBadge(undefined), '');
});

test('what the family knows: bigger cars are a line like the trades, with what a tier gives', () => {
  const { v } = play((v) => v.month >= 2);
  const tree = v.tree.filter((t) => t.kind !== 'cars').concat([{ kind: 'cars', name: 'Cars', street: null, tier: 1, wanted: [], gives: 'A car carries $150 a run', studying: 0, next: { tier: 2, cost: 2000, months: 4, gives: 'A car carries $300 a run' } }]);
  const w = { ...v, tree };
  assert.match(C.family(w, { clean: 0 }), /data-know="cars"/);
  assert.ok(require('../web/icons.js').has('cars'), 'it has its own picture');
  const k = C.know(w, 'cars', { clean: 5000 });
  assert.match(k, /A car carries \$150 a run/); assert.match(k, /A car carries \$300 a run/);
});

test('a truck says what it hauls: liquor, crates, stolen cars or weed, each with its picture and its count', () => {
  const pic = (car) => C.haul(car)[0];
  assert.equal(pic({ kind: 'liquor', cargo: 'liquor' }), 'liquor');
  assert.equal(new Set([pic({ kind: 'goods', cargo: 'goods' }), pic({ kind: 'goods', cargo: 'cars' }), pic({ kind: 'goods', cargo: 'weed' }), pic({ kind: 'liquor' }), pic({ kind: 'takings' })]).size, 5, 'no two alike');
  assert.equal(pic({ kind: 'something new' }), 'takings');
  assert.match(C.carTip({ kind: 'goods', cargo: 'goods', amount: 20, capo: 'sal' }), /20 crates on board/);
  assert.match(C.carTip({ kind: 'goods', cargo: 'cars', amount: 4, capo: 'sal' }), /4 cars on board/);
  assert.match(C.carTip({ kind: 'goods', cargo: 'weed', amount: 10, capo: 'sal' }), /10 bags on board/);
  assert.match(C.carTip({ kind: 'liquor', cargo: 'liquor', amount: 20, capo: 'sal' }), /20 cases on board/);
  assert.match(C.carTip({ kind: 'takings', cargo: 'cash', amount: 142, capo: 'sal' }, true), /Empty/, 'on its way out, it says it is empty');
});

test('a place says what it has in store, in the bubble and on its page', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club');
  const see = (more) => { const p = { ...ours, ...more }, c = { ...city, places: city.places.map((q) => (q === ours ? p : q)) }, w = { ...v, cities: [c] }; return [C.blockTip(w, c.id, p.x, p.y), C.block(w, c.id, p.x, p.y)]; };
  see({ stock: 40, holds: 'liquor' }).forEach((t) => assert.match(t, /40 cases of liquor in store/));
  see({ stock: 8, holds: 'cars' }).forEach((t) => assert.match(t, /8 stolen cars in store/));
  see({ stock: 20, holds: 'weed' }).forEach((t) => assert.match(t, /20 bags of weed in store/));
  see({ stock: 12.6, holds: 'goods' }).forEach((t) => assert.match(t, /12 crates in store/));
  see({ weed: 5 }).forEach((t) => assert.match(t, /5 bags of weed to sell/));
  see({ stock: 0, holds: 'liquor' }).forEach((t) => assert.doesNotMatch(t, /in store/));
});

test('a hold-up or a seizure on the road is in the journal with its own picture', () => {
  const j = C.journal([{ type: 'hijack', label: 'The Callahans hold up a truck', month: 3 }, { type: 'seizure', label: 'The police stop a truck', month: 4 }]);
  assert.match(j, /hold up a truck/); assert.match(j, /police stop a truck/);
  assert.ok(C.EVENT.hijack && C.EVENT.seizure && C.EVENT.truck);
});

test('a truck between two cities says what it hauls and where it goes', () => {
  assert.equal(C.haul({ kind: 'convoy', cargo: 'liquor' })[0], 'liquor');
  assert.equal(C.haul({ kind: 'convoy', cargo: 'cars' })[0], C.haul({ kind: 'goods', cargo: 'cars' })[0]);
  const t = C.carTip({ kind: 'convoy', cargo: 'liquor', amount: 20, capo: 'sal', way: 'Ashport to Calder Falls' });
  assert.match(t, /20 cases on board/); assert.match(t, /Ashport to Calder Falls/);
});

test("a capo's sheet shows what he has learned and what waits at his next rank, each a touch away", () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], k0 = city.capos[0];
  const k = { ...k0, abilities: [{ id: 'night', name: 'Night runs', gives: 'His trucks are held up half as often', school: 'Liquor', rank: 1, has: true }, { id: 'b', name: 'Cut liquor', gives: 'His bars sell a fifth more', school: 'Liquor', rank: 2, has: false }, { id: 'c', name: 'Own judge', gives: 'Seizures cost him half', school: 'Law', rank: 3, has: false }] };
  const w = { ...v, cities: [{ ...city, capos: [k] }] }, html = C.capo(w, city.id, k.id);
  assert.match(html, /class="skill on"[^>]*data-tip="Night runs: His trucks are held up half as often"/);
  assert.match(html, /class="skill"[^>]*data-tip="At rank 2 · Cut liquor: His bars sell a fifth more"/);
  assert.equal((html.match(/class="skill( on)?"/g) || []).length, 3);
  assert.doesNotMatch(C.capo(v, city.id, k0.id).replace(/abilities/g, ''), /class="skills"><\/div>/, 'no empty row for a capo without any');
});

// ---- the table: three chairs for the whole family
const TABLE = [{ post: 'bookkeeper', name: 'Bookkeeper', capo: 'dutch', who: 'Dutch Keller', specialty: 'Bootlegger', pay: 300, paid: true, gives: 'Every laundry of the family washes 35% more' },
  { post: 'routes', name: 'Routes', capo: null, who: null, specialty: null, pay: 300, paid: null, gives: null }, { post: 'fixer', name: 'Fixer', capo: null, who: null, specialty: null, pay: 300, paid: null, gives: null }];
const DOOR = { capo: 'mae', name: 'Mae Rourke', specialty: 'Madam', door: 'name', by: null, why: 'A city with nightlife', cost: 2500, roads: [], open: true, chairs: ['routes', 'fixer'] };

test('the family sheet shows the table: who sits, what he gives, and the empty chairs', () => {
  const { v } = play((v) => v.month >= 2);
  const html = C.family({ ...v, table: TABLE }, { men: 1, clean: 0 });
  assert.match(html, /The table/);
  assert.match(html, /data-act="chair" data-post="bookkeeper"/, 'a taken chair opens its sheet');
  assert.match(html, /Bookkeeper: Dutch Keller\. Every laundry of the family washes 35% more/);
  assert.equal((html.match(/class="slot chair empty"/g) || []).length, 2);
  assert.doesNotMatch(C.family(v.table ? { ...v, table: undefined } : v, { men: 1, clean: 0 }), /The table/, 'no table, no section');
});

test('a man at the door can be given a chair at the table instead of a street', () => {
  const { v } = play((v) => v.month >= 2);
  const c = { ...v.cities[0], doors: [DOOR] }, w = { ...v, cities: [c], table: TABLE };
  assert.match(C.requests(w, { dirty: 0, clean: 0 }), /data-act="chairs" data-city="ashport" data-capo="mae"/);
  const none = { ...w, cities: [{ ...c, doors: [{ ...DOOR, chairs: [] }] }] };
  assert.doesNotMatch(C.requests(none, { dirty: 0, clean: 0 }), /data-act="chairs"/, 'no free chair for him, no button');
  const sheet = C.chairs(w, 'ashport', 'mae');
  assert.match(sheet, /Mae Rourke/);
  assert.match(sheet, /data-act="sit" data-city="ashport" data-capo="mae" data-post="routes"/);
  assert.match(sheet, /data-act="sit" data-city="ashport" data-capo="mae" data-post="fixer"/);
  assert.doesNotMatch(sheet, /data-post="bookkeeper"/, 'a taken chair is not on offer');
  assert.match(sheet, /\$300 a month/); assert.match(sheet, /Dutch Keller/, 'and he sees who already sits');
});

test('a taken chair says what it costs and gives, and the man can be sent away', () => {
  const { v } = play((v) => v.month >= 2);
  const sheet = C.chair({ ...v, table: TABLE }, 'bookkeeper');
  assert.match(sheet, /Dutch Keller/); assert.match(sheet, /washes 35% more/); assert.match(sheet, /\$300 a month/);
  assert.match(sheet, /data-act="unseat" data-post="bookkeeper"/); assert.match(sheet, /cannot be taken back/);
  assert.match(C.chair({ ...v, table: TABLE.map((t) => ({ ...t, paid: false })) }, 'bookkeeper'), /not paid/i);
  assert.equal(C.chair({ ...v, table: TABLE }, 'routes'), null, 'an empty chair has no sheet');
});

test('an event is a small tile on the edge of the screen: its picture, its words, and where it happened', () => {
  const t = C.news({ type: 'opened', city: 'ashport', x: 4, y: 10, label: "Sal opens a speakeasy in Canal Street" });
  assert.match(t, /^<button class="news"/); assert.match(t, /data-city="ashport" data-x="4" data-y="10"/); assert.match(t, /Sal opens a speakeasy/);
  assert.match(C.news({ type: 'burnt', city: 'ashport', x: 1, y: 2, label: 'fire' }), /class="news bad"/);
  const nowhere = C.news({ type: 'learned', label: 'The family learns' });
  assert.doesNotMatch(nowhere, /data-x/); assert.match(nowhere, /The family learns/);
  assert.match(C.news({ type: 'a new kind', label: 'x' }), /<svg/, 'an unknown event still has a picture');
  assert.match(C.fxTip('news', 'Sal asks for a truck', 'asks'), /Sal asks for a truck/);
  assert.doesNotMatch(C.fxTip('news', 'Sal asks', 'asks'), /undefined|news/);
});

// ---- the underboss: one capo who holds a city for the boss
test('a capo can be made underboss of his city once it has two capos, and the sheet says who holds it', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], k = { ...city.capos[0], under: false }, other = { ...k, id: 'mae', name: 'Mae Rourke' };
  const two = { ...v, cities: [{ ...city, under: null, capos: [k, other] }] };
  assert.match(C.capo(two, city.id, k.id), /data-act="underboss" data-city="ashport" data-capo="sal"/);
  const alone = { ...v, cities: [{ ...city, under: null, capos: [k] }] };
  assert.doesNotMatch(C.capo(alone, city.id, k.id), /data-act="underboss"/, 'a city with one capo needs none');
  const held = { ...v, cities: [{ ...city, under: k.id, capos: [{ ...k, under: true }, other] }] };
  assert.match(C.capo(held, city.id, k.id), /Underboss of Ashport/); assert.doesNotMatch(C.capo(held, city.id, k.id), /data-act="underboss"/);
  assert.match(C.capo(held, city.id, 'mae'), /data-act="underboss"/, 'the boss can give the city to another man');
  assert.match(C.city(held, city.id), /class="slot under"/, 'and the city sheet marks him');
});

test('a man at the door of a city that has an underboss is his to take in: no decision for the boss', () => {
  const { v } = play((v) => v.month >= 2);
  const door = { capo: 'mae', name: 'Mae Rourke', specialty: 'Madam', door: 'name', by: null, why: 'A city with nightlife', cost: 2500, roads: [], open: true, chairs: ['routes'], handled: 'sal' };
  const html = C.requests({ ...v, cities: [{ ...v.cities[0], doors: [door] }] }, { dirty: 9000, clean: 0 });
  assert.match(html, /Sal will take (her|him) in himself|Sal takes him in himself/); assert.doesNotMatch(html, /data-act="seat"/);
  assert.match(html, /data-act="chairs"/, 'the boss may still give him a chair at his table');
  const poach = C.requests({ ...v, cities: [{ ...v.cities[0], doors: [{ ...door, door: 'poach' }] }] }, { dirty: 9000, clean: 0 });
  assert.match(poach, /data-act="welcome"/, 'a man taken from a rival stays the boss\'s call');
});

// ---- a page that fails must never freeze the game
test('a sheet that cannot be drawn says so and lets time go on, instead of throwing', () => {
  const html = C.capo({ cities: [{ id: 'a', name: 'A', capos: [{ id: 'nobody at all' }] }] }, 'a', 'nobody at all');
  assert.match(html, /could not be drawn/); assert.match(html, /data-act="later"/);
  assert.match(C.requests({ cities: [{ id: 'a', feuds: null, asks: null, doors: null }] }, {}), /could not be drawn/);
});

test('whoever starts and whatever happens in fifteen years, every sheet of every month can be drawn', () => {
  const broken = /could not be drawn/;
  E.NAMES.forEach((name) => {
    const g = E.createGame({ capo: name });
    for (let m = 0; m < 180; m++) {
      for (let i = 0; i < E.TICKS_PER_MONTH; i++) { E.tick(g); if (g.paused && !E.hud(g).pending) E.command(g, { type: 'resume' }); }
      const v = E.view(g), h = E.hud(g), at = name + ', month ' + m + ': ';
      const draw = (what, html) => { assert.ok(html == null || !broken.test(html), at + what + ' ' + String(html).slice(0, 300)); };
      draw('requests', C.requests(v, h)); draw('family', C.family(v, h)); draw('journal', C.journal(g.journal));
      (v.table || []).forEach((t) => draw('chair ' + t.post, C.chair(v, t.post)));
      (v.tree || []).forEach((t) => draw('know ' + t.kind, C.know(v, t.kind, h)));
      v.cities.forEach((c) => {
        draw('city ' + c.id, C.city(v, c.id));
        c.capos.forEach((k) => { draw('capo ' + k.id, C.capo(v, c.id, k.id)); (k.partings || []).forEach((p) => draw('parting', C.parting(v, c.id, k.id, p.way))); });
        c.doors.forEach((d) => draw('chairs ' + d.capo, C.chairs(v, c.id, d.capo)));
        c.places.forEach((p) => { draw('block', C.block(v, c.id, p.x, p.y)); draw('bubble', C.blockTip(v, c.id, p.x, p.y)); });
        (c.trips || []).forEach((t) => C.carTip(t));
      });
      (g.journal.slice(-6)).forEach((e) => C.news(e));
      // he answers as he can, differently from one month to the next, so that every kind of door and request is met
      v.cities.forEach((c) => {
        c.asks.forEach((a) => { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: m % 3 !== 0 }); } catch (e) { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } catch (e2) { /* gone */ } } });
        c.feuds.forEach((f) => { try { E.command(g, { type: 'rule', city: c.id, id: f.id, winner: m % 2 ? f.a : f.b }); } catch (e) { /* gone */ } });
        c.doors.forEach((d) => { if (d.handled) return;
          const chair = (d.chairs || [])[0];
          try { if (chair && m % 4 === 0) E.command(g, { type: 'seat', city: c.id, capo: d.capo, post: chair }); else { const s = global.AshportTurf.spots(g.cities.find((q) => q.id === c.id))[0]; E.command(g, { type: 'welcome', city: c.id, from: c.id, capo: d.capo, x: s.x, y: s.y }); } } catch (e) { /* cannot pay, or no seat */ } });
        if (c.capos.length > 1 && !c.under) { try { E.command(g, { type: 'underboss', city: c.id, capo: c.capos[0].id }); } catch (e) { /* not yet */ } }
      });
      if (g.paused) E.command(g, { type: 'resume' });
    }
  });
});

// A man can come through a key place or from a rival family: what stands behind him is then not a person.
test('the sheet of requests opens whoever stands behind the man at the door', () => {
  const door = (more) => Object.assign({ capo: 'gus', name: 'Gus Hartmann', specialty: 'Brewmaster', door: 'name', by: null, why: 'He comes with the brewery.', cost: 800, roads: [], chairs: [] }, more);
  const view = { cities: [{ id: 'ashport', name: 'Ashport', feuds: [], asks: [], seats: { taken: 1, total: 6 },
    doors: [door({ by: 'brewery' }), door({ capo: 'finn', name: 'Finn O\'Rourke', door: 'poach', by: 'Callahan' }), door({ capo: 'rocco', name: 'Rocco Bellini', door: 'rise', by: 'sal' }), door({ capo: 'otto', name: 'Otto Brenner', by: 'nobody-known' })] }] };
  const html = C.requests(view, { dirty: 5000, clean: 0, pending: 4 });
  assert.match(html, /Gus Hartmann/);
  assert.match(html, /Finn O'Rourke|Finn O&#39;Rourke/);
  assert.match(html, /spoken for by Sal/);
  assert.equal(html.match(/spoken for by/g).length, 1, 'only a man of the family speaks for another');
});

// ---- loyalty: the screen gets a mood, never a number
test('a capo sheet shows his mood, and a gift the boss can make when he has the clean money', () => {
  const g = E.createGame(); E.command(g, { type: 'start', capo: 'sal' }); E.tick(g, E.TICKS_PER_MONTH);
  const v = E.view(g), city = v.cities[0], k0 = city.capos[0];
  const with_ = (more) => ({ ...v, cities: [{ ...city, capos: [{ ...k0, ...more }] }] });
  const steady = C.capo(with_({ mood: 'steady', gift: { cost: 1500, wait: 0 } }), city.id, k0.id, { clean: 2000 });
  assert.match(steady, /class="move mood steady"/); assert.match(steady, /Steady/);
  assert.match(steady, /data-act="gift" data-city="ashport" data-capo="sal"[^>]*>.*?Make him a gift · \$1,500/);
  assert.doesNotMatch(steady.match(/<button[^>]*data-act="gift"[^>]*>/)[0], /disabled/);
  const bitter = C.capo(with_({ mood: 'bitter', gift: { cost: 1500, wait: 0 } }), city.id, k0.id, { clean: 400 });
  assert.match(bitter, /class="move mood bitter"/); assert.match(bitter, /sends nothing up/);
  assert.match(bitter.match(/<button[^>]*data-act="gift"[^>]*>/)[0], /disabled/, 'not without the clean money');
  assert.match(bitter, /clean money/);
  const waits = C.capo(with_({ mood: 'restless', gift: { cost: 1500, wait: 7 } }), city.id, k0.id, { clean: 9000 });
  assert.match(waits, /class="move mood restless"/);
  assert.match(waits.match(/<button[^>]*data-act="gift"[^>]*>/)[0], /disabled/, 'one gift a year');
  assert.match(waits, /in 7 months/);
  const old = C.capo(with_({ mood: undefined, gift: undefined }), city.id, k0.id);
  assert.doesNotMatch(old, /class="move mood|data-act="gift"/, 'rules that say nothing of loyalty draw nothing');
});

test('a restless or bitter man is marked on his portrait in the city sheet', () => {
  const g = E.createGame(); E.command(g, { type: 'start', capo: 'sal' }); E.tick(g, E.TICKS_PER_MONTH);
  const v = E.view(g), city = v.cities[0], k0 = city.capos[0];
  const of = (mood) => C.city({ ...v, cities: [{ ...city, capos: [{ ...k0, mood }] }] }, city.id);
  assert.match(of('bitter'), /class="slot[^"]* bitter"[^>]*data-tip="[^"]*bitter/);
  assert.match(of('restless'), /class="slot[^"]* restless"[^>]*data-tip="[^"]*restless/);
  assert.doesNotMatch(of('steady'), /class="slot[^"]* (steady|restless|bitter)"/);
});

test('whispers, a betrayal and a gift have their tile and their line in the journal', () => {
  const w = C.news({ type: 'whispers', label: 'Word gets around: Sal is bitter', city: 'ashport', x: 3, y: 4 });
  assert.match(w, /class="news bad"/); assert.match(w, /data-x="3"/);
  assert.match(C.news({ type: 'betrayal', label: 'Sal goes over to the Callahans', city: 'ashport', x: 3, y: 4 }), /class="news bad"/);
  assert.doesNotMatch(C.news({ type: 'gift', label: 'A gift for Sal', city: 'ashport', x: 3, y: 4 }), /class="news bad"/);
  ['whispers', 'betrayal', 'gift'].forEach((t) => assert.ok(C.EVENT[t], t + ' has its own icon'));
  assert.notEqual(C.EVENT.betrayal, C.EVENT.gift);
});

// ---- the same bad news is not told again every month
test('a tile that would say the same thing month after month is told once, and again only after a quiet month', () => {
  const seen = {}, e = { type: 'unpaid', city: 'ashport', capo: 'sal', label: 'Sal has not been paid this month' }, other = { type: 'opened', city: 'ashport', capo: 'sal', label: 'Sal opens a speakeasy' };
  assert.deepEqual(C.untold([e, other], seen, 10), [e, other]);
  assert.deepEqual(C.untold([e], seen, 11), [], 'the month after, it is known');
  assert.deepEqual(C.untold([e], seen, 12), []);
  assert.deepEqual(C.untold([], seen, 13), []);
  assert.deepEqual(C.untold([e], seen, 14), [e], 'after a month without it, it is news again');
  assert.deepEqual(C.untold([other, other], seen, 14), [other], 'and never twice in the same month');
});

test('the capos whose mood the boss should see over the map: the restless and the bitter, not the steady', () => {
  const view = { cities: [{ id: 'ashport', capos: [{ id: 'sal', mood: 'bitter' }, { id: 'mae', mood: 'steady' }, { id: 'vince' }] }, { id: 'dunmore', capos: [{ id: 'dutch', mood: 'restless' }] }] };
  assert.deepEqual(C.moods(view), { ashportsal: 'bitter', dunmoredutch: 'restless' });
});

test('the mark of a betrayal on the map says what it is when touched', () => {
  const t = C.fxTip('betrayal', 'Sal goes over to the Callahans', 'betrayal');
  assert.match(t, /Betrayal/); assert.match(t, /Sal goes over/); assert.doesNotMatch(t, /undefined/);
});

// ---- the first minutes: a few words at the right moment, once each, then nothing
test('a new boss is told what to look at, one thing at a time, each only once', () => {
  const city = (more) => Object.assign({ id: 'ashport', name: 'Ashport', held: true, capos: [{ id: 'sal', name: 'Sal Moretti', sent: 0, income: 0 }], places: [], asks: [], feuds: [], doors: [], trips: [] }, more);
  const hud = (more) => Object.assign({ started: true, dirty: 0, clean: 0, pending: 0, month: 0 }, more), seen = {};
  const first = C.hint({ cities: [city()] }, hud(), seen);
  assert.equal(first.id, 'capo'); assert.match(first.text, /Sal/); assert.match(first.text, /decides/);
  assert.equal(C.hint({ cities: [city()] }, hud(), seen).id, 'capo', 'it stays until the boss has read it');
  seen.capo = 1;
  assert.equal(C.hint({ cities: [city()] }, hud(), seen), null, 'nothing more to say until something new happens');
  const asks = { cities: [city({ asks: [{ id: 1, capo: 'sal' }] })] };
  assert.equal(C.hint(asks, hud({ pending: 1 }), seen).id, 'asks'); seen.asks = 1;
  const pays = { cities: [city({ capos: [{ id: 'sal', name: 'Sal Moretti', sent: 120, income: 300 }] })] };
  assert.equal(C.hint(pays, hud({ dirty: 400 }), seen).id, 'money'); seen.money = 1;
  assert.equal(C.hint(pays, hud({ dirty: 2400 }), seen), null, 'the starting cash is no trouble');
  assert.equal(C.hint(pays, hud({ dirty: 3400 }), seen).id, 'wash'); seen.wash = 1;
  const knocks = { cities: [city({ doors: [{ capo: 'mae', name: 'Mae Rourke' }] })] };
  assert.equal(C.hint(knocks, hud({ pending: 1 }), seen).id, 'door'); seen.door = 1;
  assert.equal(C.hint(knocks, hud({ pending: 1, dirty: 9000 }), seen), null, 'five things, then the boss is on his own');
  assert.equal(C.hint({ cities: [] }, { started: false }, {}), null, 'nothing before the game starts');
  [first].forEach((h) => { assert.ok(h.icon); assert.ok(h.text.length < 140, 'short enough to read at a glance'); });
});

test('a hint is a strip with one button that puts it away', () => {
  const html = C.hintStrip({ id: 'capo', icon: 'men', text: 'Sal decides.' });
  assert.match(html, /class="hint"/); assert.match(html, /data-hint="capo"/); assert.match(html, /Sal decides\./); assert.match(html, /<svg/);
  assert.equal(C.hintStrip(null), '');
});

// ---- curves: did a decision pay? the last months of the family and of each city
test('the family sheet and the city sheets carry the curves of the last months', () => {
  const { g, v } = play((v) => v.month >= 8), h = E.hud(g);
  assert.ok(v.history.length >= 6);
  const fam = C.curves(v);
  assert.equal((fam.match(/class="tile curve"/g) || []).length, 3, 'dirty, clean, sent up');
  assert.match(fam, /DIRTY/); assert.match(fam, /CLEAN/); assert.match(fam, /SENT UP/);
  assert.equal((fam.match(/<polyline/g) || []).length, 3);
  assert.equal(fam.match(/points="([^"]*)"/)[1].trim().split(' ').length, v.history.length, 'one point a month');
  assert.match(fam, new RegExp(C.money(v.history[v.history.length - 1].dirty).replace('$', '\\$')), 'with the figure of the last month');
  const town = C.curves(v, 'ashport');
  assert.equal((town.match(/class="tile curve"/g) || []).length, 2, 'streets held and what the city sends up');
  assert.match(town, /STREETS/); assert.match(town, /%/);
  assert.match(C.family(v, h), /class="tile curve"/); assert.match(C.city(v, 'ashport'), /class="tile curve"/);
  assert.equal(C.curves({ ...v, history: v.history.slice(0, 1) }), '', 'one month is not yet a curve');
  assert.equal(C.curves({ ...v, history: undefined }), '', 'an old game without history draws none');
  assert.doesNotMatch(C.city(v, 'dunmore'), /class="tile curve"/, 'nothing to follow where the family is not');
});

test('the city sheet lets the boss choose the share he takes, and says what each costs him in loyalty', () => {
  const cuts = [{ id: 'light', share: 0.08, loyal: 10 }, { id: 'normal', share: 0.15, loyal: 0 }, { id: 'heavy', share: 0.25, loyal: -15 }];
  const c = { id: 'ashport', held: true, cut: 'normal', cuts };
  const html = C.cut(c);
  assert.match(html, /Your share/);
  assert.equal((html.match(/data-act="cut"/g) || []).length, 3);
  assert.match(html, /data-cut="light"[^>]*>[\s\S]*?8%[\s\S]*?loyalty \+10/);
  assert.match(html, /data-cut="heavy"[^>]*>[\s\S]*?25%[\s\S]*?loyalty −15/);
  assert.match(html, /<button class="on" data-act="cut" data-city="ashport" data-cut="normal" disabled>/, 'the share in force is marked and cannot be chosen again');
  assert.doesNotMatch(html.match(/data-cut="normal"[\s\S]*?<\/button>/)[0], /loyalty/, 'nothing to say where nothing changes');
  assert.equal(C.cut({ id: 'dunmore', held: false, cut: 'normal', cuts }), '', 'no share where the family has no man');
  assert.equal(C.cut({ id: 'ashport', held: true }), '', 'an old game without shares shows none');
  const { v } = play((v) => v.month >= 2);
  const town = { ...v, cities: v.cities.map((x) => (x.id === 'ashport' ? { ...x, cut: 'heavy', cuts } : x)) };
  assert.match(C.city(town, 'ashport'), /class="on" data-act="cut" data-city="ashport" data-cut="heavy"/, 'it is on the city sheet');
});

test('the family sheet sells what clean money buys for good, with its price and why it cannot be bought', () => {
  const holdings = [{ id: 'lawyer', name: 'Law Firm', gives: 'The police seize less', level: 1, most: 3, next: { level: 2, cost: 25000 } },
    { id: 'judge', name: 'Judge', gives: 'Your men come out sooner', level: 0, most: 3, next: { level: 1, cost: 6000 } },
    { id: 'paper', name: 'Newspaper', gives: 'Heat falls faster', level: 3, most: 3, next: null }];
  const html = C.holdings({ holdings }, { clean: 7000 });
  assert.match(html, /What clean money buys/);
  assert.equal((html.match(/data-act="buy"/g) || []).length, 2, 'nothing more to buy of what is full');
  assert.match(html, /data-act="buy" data-holding="judge">[\s\S]*?\$6,000/);
  assert.match(html, /data-act="buy" data-holding="lawyer" disabled>[\s\S]*?\$25,000[\s\S]*?It takes \$25,000 of clean money/);
  assert.match(html, /Law Firm[\s\S]*?1 \/ 3/); assert.match(html, /Newspaper[\s\S]*?3 \/ 3/);
  assert.match(html, /The police seize less/);
  assert.equal(C.holdings({}, { clean: 0 }), '', 'an old game without holdings shows none');
  const { g, v } = play((v) => v.month >= 2);
  assert.match(C.family({ ...v, holdings }, E.hud(g)), /What clean money buys/, 'it is on the family sheet');
});

test('money seen on the map: what comes in is written with a plus, what leaves with a minus', () => {
  assert.deepEqual(C.pop(120), { text: '+$120', cls: 'in' });
  assert.deepEqual(C.pop(-1500), { text: '−$1,500', cls: 'out' });
  assert.equal(C.pop(0), null); assert.equal(C.pop(undefined), null);
});

test('the detail of a trade says in plain sight what it gives, and what the next tier would add', () => {
  const tree = [{ kind: 'still', name: 'Stills', tier: 1, gives: 'Makes the liquor your bars sell', next: { tier: 2, cost: 3500, months: 6, gives: 'They can make it bigger: it makes 50 % more' } }];
  const html = C.know({ tree }, 'still', { clean: 5000 });
  assert.match(html, /<p class="gives">Makes the liquor your bars sell<\/p>/);
  assert.match(html, /<div class="move next">.*?<span><b>Tier 2 brings<\/b> They can make it bigger: it makes 50 % more<\/span><\/div>/);
  assert.ok(html.indexOf('class="move next"') < html.indexOf('data-act="research"'), 'what it brings is read before the price');
  const fresh = C.know({ tree: [{ ...tree[0], tier: 0, next: { ...tree[0].next, tier: 1 } }] }, 'still', { clean: 0 });
  assert.match(fresh, /<b>Learning it brings<\/b>/);
  assert.doesNotMatch(C.know({ tree: [{ ...tree[0], next: null }] }, 'still', { clean: 0 }), /class="move next"/);
});

test('the health of a capo\'s streets is read in three lights, money, men and threat, with the one line that matters', () => {
  const city = (o) => ({ id: 'ashport', heat: 8, chief: { id: 'seamus', name: 'Seamus Callahan', vendetta: 0 }, places: [{ x: 3, y: 10, owner: 'family', capo: 'dutch', kind: 'club' }], ...o });
  const man = (o) => ({ id: 'dutch', name: 'Dutch Keller', places: 2, income: 450, mood: 'steady', at: { why: 'home' }, ...o });
  const fine = C.health(city(), man());
  assert.deepEqual([fine.money, fine.men, fine.threat, fine.worst], ['good', 'good', 'good', 'good']); assert.equal(fine.say, 'His streets are doing well');
  const choked = C.health(city({ places: [{ x: 4, y: 10, owner: 'family', capo: 'dutch', strains: [{ kind: 'dry', label: 'No liquor to pour' }] }] }), man());
  assert.equal(choked.money, 'warn'); assert.equal(choked.worst, 'warn'); assert.match(choked.say, /No liquor to pour/);
  const broke = C.health(city(), man({ income: 0 }));
  assert.equal(broke.money, 'bad'); assert.match(broke.say, /earn nothing/i);
  assert.equal(C.health(city(), man({ income: 0, places: 0 })).money, 'warn', 'a man who has just arrived has nothing to earn from yet');
  assert.equal(C.health(city(), man({ mood: 'restless' })).men, 'warn'); const bitter = C.health(city(), man({ mood: 'bitter' })); assert.equal(bitter.men, 'bad'); assert.match(bitter.say, /Dutch/);
  const raided = C.health(city(), man({ at: { why: 'raid', label: 'Facing the Callahans in Little Calabria' } }));
  assert.equal(raided.threat, 'warn'); assert.equal(raided.say, 'Facing the Callahans in Little Calabria');
  const feud = C.health(city({ chief: { id: 'seamus', name: 'Seamus Callahan', vendetta: 7 } }), man());
  assert.equal(feud.threat, 'bad'); assert.match(feud.say, /Seamus Callahan.*7 months/);
  assert.equal(C.health(city(), man({ income: 0, mood: 'restless' })).worst, 'bad', 'the worst of the three sets the colour');
  assert.equal(C.health(city({ chief: undefined }), man({ at: undefined, income: undefined, mood: undefined })).worst, 'good', 'an old game is not alarmed');
  // over the map: three small lights under his face; on his sheet: the same, named
  const pips = C.mark({ capo: 'dutch', progress: 0.5 }, choked);
  assert.match(pips, /<span class="hp" data-tip="[^"]*No liquor to pour"><i class="warn"><\/i><i class="good"><\/i><i class="good"><\/i><\/span>/);
  assert.doesNotMatch(C.mark({ capo: 'dutch', progress: 0.5 }), /class="hp"/);
  const all = C.healths({ cities: [{ ...city(), capos: [man({ mood: 'bitter' })] }] });
  assert.equal(all.ashportdutch.worst, 'bad');
  const line = C.healthLine(feud);
  assert.match(line, /class="move health bad"/); assert.match(line, /MONEY[\s\S]*MEN[\s\S]*THREAT/); assert.match(line, /Seamus Callahan/);
});

test('a capo\'s ask is laid out as a choice: what a yes costs and what he promises, what a no leaves behind', () => {
  const ask = { id: 'sal:brewery', capo: 'sal', key: 'brewery', name: 'Brewery', x: 12, y: 8, gives: 'Pours for eight speakeasies', way: 'force', cost: 1800, months: 4, why: 'It pours for his bars', expects: { gain: 340, months: 10 } };
  const v = E.view(E.createGame({ capo: 'sal' })); v.cities[0].asks = [ask];
  const html = C.requests(v, { dirty: 5000, clean: 0, pending: 1 });
  const sides = html.match(/<div class="sides">([\s\S]*?)<\/div><\/div><\/div>/)[0];
  assert.match(sides, /class="side yes"[\s\S]*IF YOU SAY YES[\s\S]*−\$1,800[\s\S]*\+\$340 a month[\s\S]*promised[\s\S]*10 months[\s\S]*data-yes="1"/);
  assert.match(sides, /class="side no"[\s\S]*IF YOU SAY NO[\s\S]*Sal[\s\S]*data-yes="0"/);
  assert.ok(sides.indexOf('class="side yes"') < sides.indexOf('class="side no"'));
  v.cities[0].asks = [{ ...ask, expects: null }];
  const hall = C.requests(v, { dirty: 5000, clean: 0, pending: 1 });
  assert.doesNotMatch(hall, /a month, promised/); assert.match(hall, /No money promised/, 'a place that earns nothing says so');
  v.cities[0].asks = [{ ...ask, expects: undefined }];
  assert.doesNotMatch(C.requests(v, { dirty: 5000, clean: 0, pending: 1 }), /promised/, 'an old game makes no promise');
});

test('the rival of a city has a face: his name, how strong he is, what he last did, and his vendetta', () => {
  const c = { id: 'ashport', rival: 'Callahan', chief: { id: 'seamus', name: 'Seamus Callahan', family: 'Callahan', strength: 91, last: { type: 'burnt', month: 6, x: 4, y: 10, label: 'Burnt Dutch\'s speakeasy in Little Calabria' }, vendetta: 0 } };
  const html = C.chief(c);
  assert.match(html, /class="chief"/); assert.match(html, /<svg class="face"/); assert.match(html, /Seamus Callahan/); assert.match(html, /Head of the Callahan family/);
  assert.match(html, /91% of the streets/); assert.match(html, /style="width:91%"/);
  assert.match(html, /data-act="show" data-city="ashport" data-x="4" data-y="10"[^>]*>[\s\S]*Burnt Dutch&#39;s speakeasy|Burnt Dutch's speakeasy/);
  assert.doesNotMatch(html, /Vendetta/);
  const feud = C.chief({ ...c, chief: { ...c.chief, vendetta: 7, last: null } });
  assert.match(feud, /class="move no"[\s\S]*Vendetta: 7 months[\s\S]*twice as hard/); assert.doesNotMatch(feud, /data-act="show"/);
  assert.equal(C.chief({ id: 'ashport', chief: null }), ''); assert.equal(C.chief({ id: 'ashport' }), '');
  const { v } = play((v) => v.month >= 2);
  assert.match(C.city(v, 'ashport'), /class="chief"/, 'he is on the city sheet');
  assert.equal(C.EVENT.vendetta, 'attack'); assert.ok(C.BAD.vendetta);
});

test('a promise is followed: what is owed is listed on the city sheet, and the day it is judged the news says kept or broken', () => {
  const promises = [{ capo: 'dutch', key: 'brewery', name: 'Brewery', x: 12, y: 8, expected: 340, months: 4 }];
  const html = C.promises({ id: 'ashport', promises });
  assert.match(html, /Promises/); assert.match(html, /Dutch/); assert.match(html, /\+\$340 a month from the Brewery/); assert.match(html, /judged in 4 months/);
  assert.equal(C.promises({ id: 'ashport', promises: [] }), ''); assert.equal(C.promises({ id: 'ashport' }), '');
  const kept = C.news({ type: 'promise', city: 'ashport', capo: 'dutch', x: 12, y: 8, expected: 340, actual: 410, kept: true, label: 'The Brewery pays $410 a month, as Dutch promised' });
  const broken = C.news({ type: 'promise', city: 'ashport', capo: 'dutch', x: 12, y: 8, expected: 340, actual: 120, kept: false, label: 'The Brewery pays $120 a month, not the $340 Dutch promised' });
  assert.doesNotMatch(kept, /class="news bad"/); assert.match(broken, /class="news bad"/);
  assert.match(kept, /as Dutch promised/);
});

test('the places burnt out these last months are remembered, city by city, for the map to keep them black', () => {
  const journal = [{ month: 3, type: 'burnt', city: 'ashport', x: 4, y: 10 }, { month: 9, type: 'burnt', city: 'ashport', x: 5, y: 9 }, { month: 10, type: 'opened', city: 'ashport', x: 6, y: 9 }, { month: 10, type: 'burnt', city: 'dunmore', x: 1, y: 1 }];
  assert.deepEqual(C.scars(journal, 11), { ashport: [{ x: 5, y: 9 }], dunmore: [{ x: 1, y: 1 }] });
  assert.deepEqual(C.scars(journal, 30), {}); assert.deepEqual(C.scars(undefined, 3), {});
  assert.match(C.carTip({ kind: 'patrol', vehicle: 'police' }), /Police patrol/);
});

test('the boss gives a city its line, sees who follows it, and each capo says why he does or does not', () => {
  const lines = [{ id: 'grow', name: 'Grow', gives: 'They take two more places than their rank allows, and guard them less well' }, { id: 'earn', name: 'Earn', gives: 'They make their places bigger before opening new ones' }, { id: 'low', name: 'Lie low', gives: 'They take nothing from the rivals, and the heat falls faster' }];
  const c = { id: 'ashport', held: true, line: 'earn', lines, lineHeld: { share: 2 / 3, follow: 2, of: 3, label: '2 of 3 capos follow' } };
  const html = C.line(c);
  assert.match(html, /Your line for the city/); assert.equal((html.match(/data-act="line"/g) || []).length, 3);
  assert.match(html, /class="on" data-act="line" data-city="ashport" data-line=""/, 'a touch on the line in force lifts it');
  assert.match(html, /data-act="line" data-city="ashport" data-line="grow">[\s\S]*?Grow[\s\S]*?two more places/);
  assert.match(html, /2 of 3 capos follow/);
  assert.doesNotMatch(C.line({ ...c, line: null, lineHeld: null }), /class="on"/);
  assert.equal(C.line({ id: 'dunmore', held: false, lines }), ''); assert.equal(C.line({ id: 'ashport', held: true }), '', 'an old game has no line');
  assert.match(C.follows({ follows: true, followsWhy: 'It is his way' }), /class="move yes"[\s\S]*Follows your line[\s\S]*It is his way/);
  assert.match(C.follows({ follows: false, followsWhy: 'Not his way, and he is not loyal enough to bend' }), /class="move no"[\s\S]*Does not follow your line[\s\S]*not loyal enough/);
  assert.equal(C.follows({ follows: null }), ''); assert.equal(C.follows({}), '');
  assert.equal(C.EVENT.line, 'loyalty');
});
