// The sheets of the new screen (web/cards.js): each one is HTML worked out from what AshportEmpire shows, with no page behind it.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const C = require('../web/cards.js');

// A game played with a boss who says yes to all he can afford, stopped at the first moment `until` is true.
function play(until, months) {
  const g = E.createGame({ capo: 'sal' }); g.reign.left = 1e9; // the director keeps out of this story (see reign.test.js)
  for (let i = 0; i < (months || 240) * E.TICKS_PER_MONTH; i++) {
    E.tick(g);
    const v = E.view(g);
    if (until(v, g)) return { g, v };
    v.cities.forEach((c) => {
      c.asks.forEach((a) => { try { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: true }); } catch (e) { E.command(g, { type: 'answer', city: c.id, id: a.id, yes: false }); } });
      // (a free block next to the family's own, wherever the city's outline leaves one)
      c.doors.forEach((d) => { const s = require('../web/turf.js').spots(g.cities.find((q) => q.id === c.id))[0]; try { E.command(g, { type: 'welcome', city: c.id, from: c.id, capo: d.capo, x: s.x, y: s.y }); } catch (e) { /* cannot pay yet */ } });
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
  const { g } = play(some('doors'));
  g.reign.reached = 2; // the roads are open (see hq-gives.test.js)
  const v = E.view(g), city = v.cities.find((c) => c.doors.length), d = city.doors[0];
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
  assert.match(html, /96 days/);
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
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq'), key = city.keys[0];
  const mine = C.block(v, 'ashport', ours.x, ours.y);
  assert.match(mine, new RegExp(city.zones[city.blocks[ours.y * city.w + ours.x].zone].name));
  // (a street name can be any shape: the block says which one it is on, not a rectangle)
  city.blocks.filter((b) => !b.void).forEach((b) => assert.match(C.block(v, 'ashport', b.x, b.y), new RegExp('<h2>' + city.zones[b.zone].name + '</h2>')));
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
  let v = E.view(g), html = C.know(v, shut.kind, E.hud(g));
  assert.ok(v.tree.find((t) => t.kind === shut.kind).paying, 'its money is on the road first');
  assert.match(html, /money is on its way/i);
  assert.doesNotMatch(html, /data-act="research"/);
  const other = v.tree.find((t) => t.kind !== shut.kind && t.next);
  assert.match(C.know(v, other.kind, E.hud(g)), /one thing at a time/i);
  assert.doesNotMatch(C.know(v, other.kind, E.hud(g)), /data-act="research"/);
  assert.match(C.payingLine(v.paying[v.paying.length - 1], v), new RegExp('for learning ' + shut.name.toLowerCase()));
  for (let i = 0; i < 400 && !E.view(g).tree.find((t) => t.kind === shut.kind).studying; i++) E.tick(g);
  v = E.view(g); html = C.know(v, shut.kind, E.hud(g));
  assert.match(html, /Learning/);
  assert.doesNotMatch(html, /data-act="research"/);
  assert.match(C.know(v, other.kind, E.hud(g)), /one thing at a time/i);
});

test('a holding being paid for says its money is on the road and is not sold twice', () => {
  const { g } = play((v) => v.month >= 12);
  g.family.clean = 99999;
  const h = E.view(g).holdings.find((q) => q.next);
  E.command(g, { type: 'buy', holding: h.id });
  const v = E.view(g), now = v.holdings.find((q) => q.id === h.id);
  assert.ok(now.paying, 'paid by trip');
  const html = C.family(v, E.hud(g));
  assert.match(html, /money is on its way/i);
  assert.doesNotMatch(html, new RegExp('data-act="buy" data-holding="' + h.id + '"(?![^>]*disabled)'));
  assert.match(C.payingLine(v.paying[v.paying.length - 1], v), new RegExp('for ' + h.name.toLowerCase() + ', signed at City Hall'));
});

test('the journal reads newest first, each line with its date', () => {
  const { g } = play((v) => v.month >= 24);
  const html = C.journal(g.journal);
  const last = g.journal[g.journal.length - 1];
  assert.ok(html.indexOf(last.label.replace(/'/g, '&#39;').replace(/"/g, '&quot;')) < html.lastIndexOf(C.day(g.journal[0].month, g.journal[0].day) + '<') || g.journal.length === 1);
  assert.match(html, new RegExp(C.day(last.month, last.day) + '<')); assert.doesNotMatch(html, /January|19\d\d</, 'no date in months');
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
  const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < E.TICKS_PER_MONTH; i++) E.tick(g);
  const v = E.view(g), k = v.cities[0].capos[0];
  assert.ok(k.sent > 0, 'he sent something up');
  const sheet = C.capo(v, v.cities[0].id, k.id);
  assert.ok(sheet.includes('SENT UP</small><b>' + C.money(k.sent)), 'what he sent up');
  assert.ok(sheet.includes('CARS</small><b>' + k.cars), 'his cars');
  // cash that waits in a place's till for a car is said on the place and on the capo
  const c = v.cities[0], p = c.places.find((q) => q.owner === 'family' && q.kind !== 'club' && q.kind !== 'hq'); p.till = 90; k.waiting = 90;
  assert.match(C.block(v, c.id, p.x, p.y), /\$90 \/ \$150<\/b> in the till[^]*class="nxb"><u style="width:60%"/);
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
  assert.equal(C.clock({ paused: false }, true), null, 'the boss never chooses a street: nothing stops the time for it');
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

test('the button that takes a man in says the street he picked for his club: the boss is never asked for one', () => {
  const { g, v } = play(some('doors'));
  const city = v.cities.find((c) => c.doors.length), d = city.doors[0];
  city.seats = { taken: 1, total: 3 };
  d.spot = { x: 2, y: 3, street: 'Canal Street' };
  assert.match(C.requests(v, Object.assign({}, E.hud(g), { dirty: 99999, clean: 0 })), /A club on Canal Street · \$/);
  delete d.spot;
  assert.match(C.requests(v, Object.assign({}, E.hud(g), { dirty: 99999, clean: 0 })), new RegExp('A club in ' + city.name + ' · \\$'));
});

test('a capo\'s sheet says where he is this month', () => {
  const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < E.TICKS_PER_MONTH; i++) E.tick(g);
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
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq'), key = city.keys[0];
  const mine = C.blockTip(v, 'ashport', ours.x, ours.y);
  assert.match(mine, new RegExp(ours.name)); assert.match(mine, /Sal runs it/);
  assert.doesNotMatch(mine, /<button|<h2/, 'no button, no title: it is a word, not a page');
  assert.ok(mine.replace(/<svg.*?<\/svg>/g, '').replace(/<[^>]+>/g, '').length < 160, 'short: a line for each figure, no more');
  assert.match(C.blockTip(v, 'ashport', key.x, key.y), new RegExp(key.name));
  const p = { ...ours, till: 90 }, c = { ...city, places: city.places.map((q) => (q === ours ? p : q)) };
  assert.match(C.blockTip({ ...v, cities: [c] }, c.id, p.x, p.y), /\$90 \/ \$150 in the till/);
  let empty = null; for (let y = 0; y < city.h && !empty; y++) for (let x = 0; x < city.w; x++) if (!city.places.some((q) => q.x === x && q.y === y)) { empty = C.blockTip(v, 'ashport', x, y); break; }
  assert.match(empty, /street|holds/i); assert.doesNotMatch(empty, /Nothing of note/);
  assert.equal(C.blockTip(v, 'nowhere', 0, 0), null);
});

test('a place that chokes says so: on its bubble, on its page, and in the list the map reads', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq');
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
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq');
  const see = (more) => { const p = { ...ours, room: 0, weedRoom: 0, ...more }, c = { ...city, places: city.places.map((q) => (q === ours ? p : q)) }, w = { ...v, cities: [c] }; return [C.blockTip(w, c.id, p.x, p.y), C.block(w, c.id, p.x, p.y)]; };
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
  assert.match(sheet, /\$300 every 24 days/); assert.match(sheet, /Dutch Keller/, 'and he sees who already sits');
});

test('a taken chair says what it costs and gives, and the man can be sent away', () => {
  const { v } = play((v) => v.month >= 2);
  const sheet = C.chair({ ...v, table: TABLE }, 'bookkeeper');
  assert.match(sheet, /Dutch Keller/); assert.match(sheet, /washes 35% more/); assert.match(sheet, /\$300 every 24 days/);
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
  assert.match(waits, /in 168 days/);
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
  assert.equal(feud.threat, 'bad'); assert.match(feud.say, /Seamus Callahan.*168 days/);
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
  assert.match(sides, /class="side yes"[\s\S]*IF YOU SAY YES[\s\S]*−\$1,800[\s\S]*\+\$340 every 24 days[\s\S]*promised[\s\S]*240 days[\s\S]*data-yes="1"/);
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
  assert.match(feud, /class="move no"[\s\S]*Vendetta: 168 days[\s\S]*twice as hard/); assert.doesNotMatch(feud, /data-act="show"/);
  assert.equal(C.chief({ id: 'ashport', chief: null }), ''); assert.equal(C.chief({ id: 'ashport' }), '');
  const { v } = play((v) => v.month >= 2);
  assert.match(C.city(v, 'ashport'), /class="chief"/, 'he is on the city sheet');
  assert.equal(C.EVENT.vendetta, 'attack'); assert.ok(C.BAD.vendetta);
});

test('a promise is followed: what is owed is listed on the city sheet, and the day it is judged the news says kept or broken', () => {
  const promises = [{ capo: 'dutch', key: 'brewery', name: 'Brewery', x: 12, y: 8, expected: 340, months: 4 }];
  const html = C.promises({ id: 'ashport', promises });
  assert.match(html, /Promises/); assert.match(html, /Dutch/); assert.match(html, /\+\$340 every 24 days from the Brewery/); assert.match(html, /judged in 96 days/);
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

// ---- is the family getting anywhere? One verdict over the last year, and one word under each capo
const past = (rows) => ({ history: rows.map(([share, income, dirty, clean], n) => ({ month: n + 1, dirty: dirty || 0, clean: clean || 0, cities: { ashport: { share, income }, calder: { share: 0, income: 0 } } })) });
const flat = (n, row) => Array.from({ length: n }, () => row);

test('the boss reads whether his family grows, stands still or loses ground over the last year', () => {
  assert.equal(C.trend({ history: [] }), null); assert.equal(C.trend(past(flat(2, [4, 100]))), null, 'too early to say');
  const up = C.trend(past(flat(12, [4, 100]).concat([[8, 100]])));
  assert.equal(up.tone, 'good'); assert.equal(up.word, 'GROWING'); assert.equal(up.streets.diff, 2, 'two points of the whole map'); assert.equal(up.months, 12);
  assert.match(up.say, /\+2% of the streets in 288 days/);
  const down = C.trend(past([[8, 100]].concat(flat(12, [4, 100]))));
  assert.equal(down.tone, 'bad'); assert.equal(down.word, 'LOSING GROUND'); assert.match(down.say, /−2% of the streets/);
  const still = C.trend(past(flat(24, [4, 100])));
  assert.equal(still.tone, 'warn'); assert.equal(still.word, 'STANDING STILL'); assert.match(still.say, /No street won in 288 days/);
  const richer = C.trend(past(flat(12, [4, 100]).concat([[4, 400]])));
  assert.equal(richer.tone, 'good'); assert.equal(richer.word, 'EARNING MORE'); assert.match(richer.say, /\+\$300 sent up every 24 days/);
  const poorer = C.trend(past(flat(12, [4, 400]).concat([[4, 100]])));
  assert.equal(poorer.tone, 'bad'); assert.equal(poorer.word, 'EARNING LESS'); assert.match(poorer.say, /−\$300 sent up every 24 days/);
  const young = C.trend(past(flat(5, [0, 0]).concat([[6, 50]])));
  assert.equal(young.months, 5); assert.match(young.say, /in 120 days/);
  // on the screen: an arrow, the word in its colour, the figure
  const line = C.trendLine(up); assert.match(line, /class="trend good"/); assert.match(line, /GROWING/); assert.match(line, /▲/);
  assert.match(C.trendLine(down), /▼/); assert.equal(C.trendLine(null), 'Your capos are at work');
  assert.match(C.trendMark(up), /class="good"/); assert.match(C.trendMark(up), /\+2/); assert.equal(C.trendMark(still), ''); assert.equal(C.trendMark(null), '');
});

test('under each capo, one word says what he is doing and whether it works, with what his streets earn', () => {
  const town = { id: 'ashport', places: [], heat: 0 }, man = (o) => ({ id: 'dutch', name: 'Dutch', income: 400, places: 3, mood: 'steady', plan: { move: 'hold' }, ...o });
  const of = (o, c) => C.doing({ ...town, ...c }, man(o));
  assert.deepEqual(of({}), { word: 'HOLDING', tone: 'idle', earns: '$400' });
  assert.deepEqual(of({ plan: { move: 'open', kind: 'speakeasy', name: 'Speakeasy', waiting: 'time', progress: 0.5 } }), { word: 'OPENING', tone: 'good', earns: '$400' });
  assert.equal(of({ plan: { move: 'take', way: 'force' } }).word, 'TAKING'); assert.equal(of({ plan: { move: 'enlarge' } }).word, 'ENLARGING');
  const saving = of({ plan: { move: 'open', waiting: 'money', cost: 1000, saved: 900, progress: 0.9 } });
  assert.equal(saving.word, 'SAVING 90%'); assert.equal(saving.tone, 'good');
  assert.equal(of({ income: 0, plan: { move: 'open', waiting: 'money', cost: 1000, saved: 0, progress: 0 } }).tone, 'bad', 'saving with nothing coming in is going nowhere');
  assert.deepEqual(of({ income: 0 }), { word: 'EARNS NOTHING', tone: 'bad', earns: '$0' });
  assert.deepEqual(of({ income: 0, places: 0 }), { word: 'SETTLING IN', tone: 'idle', earns: '$0' });
  assert.equal(of({ mood: 'bitter' }).word, 'BITTER'); assert.equal(of({ mood: 'bitter' }).tone, 'bad');
  assert.equal(of({}, { chief: { name: 'Seamus', vendetta: 3 } }).word, 'VENDETTA');
  const raid = of({ at: { why: 'raid', label: 'Facing the Callahans' } }); assert.equal(raid.word, 'UNDER ATTACK'); assert.equal(raid.tone, 'warn');
  const html = C.mark({ capo: 'dutch', move: 'hold' }, C.health(town, man()), of({}));
  assert.match(html, /class="say idle"/); assert.match(html, /HOLDING/); assert.match(html, /\$400/);
  assert.doesNotMatch(C.mark({ capo: 'dutch', move: 'hold' }), /class="say/);
});

test('the month\'s account: where the dirty cash came from and went, what came back clean, said the same way for both', () => {
  const view = { cities: [{ money: { up: 135, pay: 81, washed: 210, washes: 1418, cut: 52.5, seized: 0 } }, { money: { up: 65, pay: 0, washed: 0, washes: 0, cut: 0, seized: 40 } }] };
  const a = C.account(view, { dirty: 500, clean: 900, change: { dirty: -231, clean: 58 } });
  assert.deepEqual(a.dirty.map((l) => [l.key, l.amount]), [['up', 200], ['pay', -81], ['wash', -210], ['seized', -40], ['other', -100]]);
  assert.deepEqual(a.clean.map((l) => [l.key, l.amount]), [['back', 158], ['other', -100]]);
  assert.deepEqual([a.dirtyIn, a.dirtyOut, a.cleanIn, a.cleanOut], [200, 431, 158, 100]);
  assert.equal(a.dirtyLine, '+$200 \u2212$431'); assert.equal(a.cleanLine, '+$158 \u2212$100', 'the two tiles speak the same way');
  assert.match(a.room, /can wash \$1,418 every 24 days.*only \$210/);
  const html = C.accountCard(view, { dirty: 500, clean: 900, change: { dirty: -231, clean: 58 } });
  assert.match(html, /Sent up by your capos/); assert.match(html, /\+\$200/); assert.match(html, /Wages/); assert.match(html, /−\$81/); assert.match(html, /Seized by the police/);
  assert.match(C.accountCard(view, { dirty: 500, clean: 900, change: { dirty: -231, clean: 58 } }, 'clean'), /kept \$53 as their cut/); assert.match(html, /−\$231/); assert.match(html, /data-act="close"/);
  // nothing to tell that is not there: no line at zero, no laundry said plainly
  const bare = C.account({ cities: [{ money: { up: 50, pay: 0, washed: 0, washes: 0, cut: 0, seized: 0 } }] }, { dirty: 50, clean: 0, change: { dirty: 50, clean: 0 } });
  assert.deepEqual(bare.dirty.map((l) => l.key), ['up']); assert.deepEqual(bare.clean, []); assert.equal(bare.cleanLine, 'no laundry yet'); assert.match(bare.room, /No laundry yet/);
});

test('the family has a rank, a bar towards the next one, and a mark where it stood a year ago', () => {
  const at = (now, was) => C.rank(past(flat(12, [was * 2, 0]).concat([[now * 2, 0]])));      // (two cities in `past`: the map share is half of Ashport's)
  const gang = at(1.5, 1.5);
  assert.equal(gang.name, 'Street gang'); assert.equal(gang.next, 'Crew'); assert.equal(gang.to, 3); assert.equal(gang.part, 0.5); assert.equal(gang.was, 0.5); assert.equal(gang.moved, null);
  const crew = at(6.5, 1.5);
  assert.equal(crew.name, 'Crew'); assert.equal(crew.next, 'Family'); assert.deepEqual([crew.from, crew.to], [3, 10]); assert.equal(crew.part, 0.5); assert.equal(crew.was, 0, 'a year ago it was below this rank'); assert.equal(crew.moved, 'up');
  const fallen = at(1.5, 6.5); assert.equal(fallen.name, 'Street gang'); assert.equal(fallen.moved, 'down'); assert.equal(fallen.was, 1, 'it stood higher');
  assert.equal(at(12, 12).name, 'Family'); assert.equal(at(30, 30).name, 'Syndicate');
  const top = at(60, 60); assert.equal(top.name, 'Commission'); assert.equal(top.next, null); assert.equal(top.part, 1);
  assert.equal(C.rank({ history: [] }).name, 'Street gang');
  const html = C.rankLine(crew);
  assert.match(html, /CREW/i); assert.match(html, /Family at 10%/); assert.match(html, /width:50%/); assert.match(html, /class="was"[^>]*left:0%/); assert.match(html, /class="rk up"/);
  assert.match(C.rankLine(fallen), /class="rk down"/); assert.doesNotMatch(C.rankLine(top), /class="bar"/);
});

test('each capo has a power, and the page remembers a year of it to say whether he rises or falls', () => {
  assert.equal(C.power({ places: 5, income: 900 }), 140, 'ten a place, one for every ten dollars a month'); assert.equal(C.power({}), 0);
  const v = (month, places, income) => ({ month, cities: [{ id: 'ashport', capos: [{ id: 'sal', places, income }] }] });
  let log = {};
  for (let m = 1; m <= 14; m++) log = C.powerLog(log, v(m, 2, 100));
  assert.equal(log.ashportsal.length, 13, 'a year and the month in hand, no more'); assert.deepEqual(log.ashportsal[12], [14, 30]);
  assert.deepEqual(C.powerLog(log, v(14, 2, 100)), log, 'a month is written once');
  log = C.powerLog(log, v(15, 5, 900));
  assert.deepEqual(C.powerTrend(log, 'ashportsal'), { now: 140, diff: 110, tone: 'good', months: 12 });
  const fall = C.powerLog(log, v(16, 1, 0)); assert.equal(C.powerTrend(fall, 'ashportsal').tone, 'bad'); assert.equal(C.powerTrend(fall, 'ashportsal').diff, -20);
  assert.equal(C.powerTrend(C.powerLog({}, v(1, 2, 100)), 'ashportsal').tone, 'idle', 'nothing to compare with yet'); assert.equal(C.powerTrend({}, 'nobody'), null);
  // a new game starts its own memory, and a man who left is forgotten
  assert.deepEqual(C.powerLog(log, v(1, 1, 0)), { ashportsal: [[1, 10]] });
  assert.deepEqual(Object.keys(C.powerLog(log, { month: 16, cities: [{ id: 'ashport', capos: [{ id: 'mae', places: 1, income: 0 }] }] })), ['ashportmae']);
  // on the map and on his sheet
  const d = C.doing({ id: 'ashport', places: [] }, { id: 'sal', income: 900, places: 5, plan: { move: 'hold' } }, C.powerTrend(log, 'ashportsal'));
  assert.deepEqual(d.power, { now: 140, diff: 110, tone: 'good', months: 12 });
  const html = C.mark({ capo: 'sal', move: 'hold' }, null, d); assert.match(html, /class="pw good"/); assert.match(html, /▲/); assert.match(html, /140/);
  const line = C.powerLine(C.powerTrend(log, 'ashportsal')); assert.match(line, /POWER/); assert.match(line, /140/); assert.match(line, /\+110 in 288 days/);
  assert.match(C.powerLine(C.powerTrend(fall, 'ashportsal')), /−20/); assert.equal(C.powerLine(null), '');
});

// ---- the same reading at every level: a city, a street name, the men side by side, and the moment a step is won or lost
test('each city and each street name says what the family holds of it, and which way it went in a year', () => {
  const rows = flat(12, [4, 100]).concat([[10, 100]]), v = past(rows);
  assert.deepEqual(C.cityTrend(v, 'ashport'), { now: 10, diff: 6, tone: 'good' }); assert.equal(C.cityTrend(v, 'calder').tone, 'idle'); assert.equal(C.cityTrend({ history: [] }, 'ashport'), null);
  assert.match(C.cityMark(C.cityTrend(v, 'ashport')), /▲ \+6/); assert.equal(C.cityMark(C.cityTrend(v, 'calder')), ''); assert.equal(C.cityMark(null), '');
  const blocks = [{ x: 0, y: 0, zone: 0, grip: 'family' }, { x: 1, y: 0, zone: 0, grip: 'rival' }, { x: 2, y: 0, zone: 0, void: 'water' }, { x: 3, y: 0, zone: 1, grip: 'family' }];
  const city = { id: 'ashport', w: 4, h: 1, zones: [{ name: 'Docks' }, { name: 'Uptown' }], blocks };
  const old = { month: 1, dirty: 0, clean: 0, cities: { ashport: { share: 0, income: 0, zones: [20, 100] } } }, now = { month: 13, dirty: 0, clean: 0, cities: { ashport: { share: 0, income: 0, zones: [50, 100] } } };
  const z = C.zoneShares({ cities: [city], history: [old].concat(flat(11, old), [now]) });
  assert.deepEqual(z['ashport-0'], { name: 'Docks', share: 50, diff: 30, tone: 'good' }, 'the water is not counted'); assert.deepEqual(z['ashport-1'], { name: 'Uptown', share: 100, diff: 0, tone: 'idle' });
  // an old save keeps no history of its street names, nor a name on its blocks: the share is said when it can be, the arrow is not
  assert.deepEqual(C.zoneShares({ cities: [city], history: [] })['ashport-0'], { name: 'Docks', share: 50, diff: null, tone: 'idle' });
  assert.deepEqual(C.zoneShares({ cities: [{ ...city, blocks: blocks.map(({ zone, ...b }) => b) }], history: [] }), {});
  assert.equal(C.zoneMark(z['ashport-0']), '50% ▲'); assert.equal(C.zoneMark(z['ashport-1']), '100%'); assert.equal(C.zoneMark({ share: 0, diff: null, tone: 'idle' }), '');
});

test('the power of each man is read in the history of the rules when they keep it, and the men are ranked side by side', () => {
  const row = (m, sal, mae) => ({ month: m, dirty: 0, clean: 0, cities: { ashport: { share: 5, income: 0, capos: { sal: { places: sal, income: 100 }, ...(mae == null ? {} : { mae: { places: mae, income: 0 } }) } } } });
  const view = { month: 14, history: [row(1, 1, null)].concat(Array.from({ length: 13 }, (_, n) => row(n + 2, n < 12 ? 2 : 5, 3))),
    cities: [{ id: 'ashport', name: 'Ashport', capos: [{ id: 'sal', name: 'Sal Moretti', places: 5, income: 100 }, { id: 'mae', name: 'Mae Lin', places: 3, income: 0 }] }] };
  const rows = C.powerRows(view, { ashportsal: [[1, 999]] });
  assert.equal(rows.ashportsal.length, 13); assert.deepEqual(rows.ashportsal[12], [14, 60]); assert.deepEqual(rows.ashportsal[0], [2, 30], 'the rules\' history wins over the page\'s memory');
  assert.deepEqual(C.powerTrend(rows, 'ashportsal'), { now: 60, diff: 30, tone: 'good', months: 12 });
  // rows without the men (an old save): the page's own memory stands in
  const bare = { ...view, history: view.history.map((r) => ({ ...r, cities: { ashport: { share: 5, income: 0 } } })) };
  assert.deepEqual(C.powerRows(bare, { ashportsal: [[1, 999]] }), { ashportsal: [[1, 999]] });
  const html = C.ranking(view, rows);
  assert.ok(html.indexOf('Sal') < html.indexOf('Mae'), 'the strongest first'); assert.match(html, /data-act="capo" data-city="ashport" data-capo="sal"/); assert.match(html, /60/); assert.match(html, /▲ \+30/);
  assert.equal(C.ranking({ cities: [{ id: 'a', capos: [{ id: 'sal', name: 'Sal' }] }] }, {}), '', 'one man alone is not ranked');
  assert.match(C.powerLine(C.powerTrend(rows, 'ashportsal'), rows.ashportsal), /class="spark/, 'and his sheet draws the year');
});

test('a step won or lost is a moment: the rank of the family, a street name held whole or lost', () => {
  const st = (n, zones) => ({ rank: { n, name: ['Street gang', 'Crew', 'Family'][n] }, zones });
  const z = (share, name) => ({ name: name || 'The Docks', share });
  assert.deepEqual(C.moments(null, st(1, {})), [], 'nothing to tell when the game is opened');
  assert.deepEqual(C.moments(st(0, {}), st(1, {})), [{ kind: 'rank-up', tone: 'good', title: 'YOUR FAMILY IS NOW A CREW', sub: 'It holds enough of the map to be counted.' }]);
  const down = C.moments(st(2, {}), st(1, {})); assert.equal(down[0].kind, 'rank-down'); assert.equal(down[0].tone, 'bad'); assert.match(down[0].title, /FALLS BACK TO A CREW/);
  assert.deepEqual(C.moments(st(1, { a: z(80) }), st(1, { a: z(100) })).map((m) => [m.kind, m.title]), [['zone-won', 'THE DOCKS IS YOURS']]);
  assert.deepEqual(C.moments(st(1, { a: z(100) }), st(1, { a: z(90) })).map((m) => [m.kind, m.tone]), [['zone-broken', 'bad']]);
  assert.deepEqual(C.moments(st(1, { a: z(10) }), st(1, { a: z(0) })).map((m) => [m.kind, m.title]), [['zone-lost', 'DRIVEN OUT OF THE DOCKS']]);
  assert.deepEqual(C.moments(st(1, { a: z(50) }), st(1, { a: z(60) })), [], 'a street more is not a moment');
  assert.match(C.moment(down[0]), /class="moment bad"/); assert.match(C.moment(down[0]), /FALLS BACK/);
});

test('a capo\'s sheet shows how far he is from his next rank', () => {
  const html = C.nextRank({ next: { rank: 1, name: 'Capo', xp: 102, of: 150 } });
  assert.match(html, /Capo/); assert.match(html, /width:68%/); assert.match(html, /102 \/ 150/);
  assert.equal(C.nextRank({ next: null }), ''); assert.equal(C.nextRank({}), '', 'an old save says nothing of it');
});

test('what holds the family back is said in plain words: what, since when, why, and what the boss can do', () => {
  const idle = { id: 'idle', since: 43, what: '$5,536 of clean money sleeps', why: 'Nothing was bought or learned with it in 3 years', lever: 'A better gambling room costs $1,000' };
  const boxed = { id: 'boxed:sal', city: 'ashport', capo: 'sal', x: 4, y: 9, since: 7, what: 'Sal cannot take the pier', why: 'The Callahans hold every street around it', lever: null };
  const view = { stalls: [idle, boxed], cities: [{ id: 'ashport', name: 'Ashport', stalls: [boxed] }] };
  assert.match(C.stallLine(view), /\$5,536 of clean money sleeps/); assert.match(C.stallLine(view), /data-stalls="1"/); assert.match(C.stallLine(view), /\+1/, 'and how many more');
  assert.equal(C.stallLine({ stalls: [] }), ''); assert.equal(C.stallLine({}), '', 'an old game says nothing');
  const one = C.stall(idle);
  assert.match(one, /for 1032 days/); assert.match(one, /Nothing was bought/); assert.match(one, /class="lever"/); assert.match(one, /A better gambling room costs \$1,000/); assert.doesNotMatch(one, /data-act/);
  const two = C.stall(boxed);
  assert.match(two, /for 168 days/); assert.match(two, /Nothing you can do about it yet/); assert.match(two, /data-act="show" data-city="ashport" data-x="4" data-y="9"/);
  assert.match(C.stall({ ...boxed, x: undefined, y: undefined }), /data-act="capo" data-city="ashport" data-capo="sal"/);
  const card = C.stallsCard(view); assert.match(card, /What holds you back/); assert.match(card, /sleeps[\s\S]*pier/); assert.match(card, /data-act="close"/);
  assert.match(C.stallsOf(view.cities[0]), /What holds this city back[\s\S]*pier/); assert.equal(C.stallsOf({ id: 'calder', stalls: [] }), ''); assert.equal(C.stallsOf({ id: 'calder' }), '');
});

test('the boss reads what became of his decisions: each one, and a year on what it gave, good, bad or neither', () => {
  const d = (o) => ({ id: 'd1', month: 0, date: 'January 1926', type: 'line', city: 'ashport', label: 'Your word for Ashport: grow', due: 12, result: null, ...o });
  const view = { month: 5, decisions: [d({ id: 'd3', type: 'welcomed', capo: 'otto', label: 'You took in Otto Brenner in Ashport', month: 4, due: 16 }),
    d({ id: 'd2', type: 'cut', label: 'Your share in Ashport: 30%', result: { month: 3, date: 'April 1926', label: 'You changed your word after 3 months', good: null } }),
    d({ result: { month: 12, date: 'January 1927', label: 'A year on under Grow: 5 places (was 1)', good: true } }),
    d({ id: 'd0', type: 'denied', label: 'You refused Sal the pier', result: { month: 12, date: 'January 1927', label: 'Sal lost two places since', good: false } })] };
  const html = C.decisions(view);
  assert.match(html, /Your decisions/); assert.ok(html.indexOf('Otto') < html.indexOf('30%'), 'the latest first');
  assert.match(html, /You took in Otto Brenner[\s\S]*?class="then wait"[^>]*>Its result in 264 days/);
  assert.match(html, /class="then good"[^>]*>A year on under Grow/); assert.match(html, /class="then bad"[^>]*>Sal lost two places/); assert.match(html, /class="then idle"[^>]*>You changed your word/);
  assert.match(html, /data-act="close"/);
  assert.match(C.decisions({ month: 3, decisions: [] }), /Nothing decided yet/); assert.match(C.decisions({ month: 3 }), /Nothing decided yet/);
  // in the journal the result of a decision is marked good or bad
  const j = C.journal([{ type: 'outcome', good: true, label: 'A year on under Grow', date: 'January 1927' }, { type: 'outcome', good: false, label: 'Sal lost two places', date: 'May 1927' }, { type: 'outcome', good: null, label: 'Neither', date: 'June 1927' }]);
  assert.match(j, /class="i no"[\s\S]*Sal lost two places/); assert.match(j, /class="i ok"[\s\S]*A year on under Grow/); assert.equal((j.match(/class="i ok"/g) || []).length, 1);
  assert.equal(C.bad({ type: 'outcome', good: false }), true); assert.equal(C.bad({ type: 'outcome', good: true }), false);
  assert.match(j, /data-act="decisions"/, 'and the journal leads to the decisions');
});

test('the rival\'s strength has its arrow too, and a place wears its level', () => {
  const row = (rival) => ({ month: 1, dirty: 0, clean: 0, cities: { ashport: { share: 5, income: 0, rival } } });
  const c = { id: 'ashport', rival: 'Callahan', chief: { id: 'seamus', name: 'Seamus Callahan', family: 'Callahan', strength: 40, vendetta: 0 } };
  const weaker = { history: [row(55)].concat(flat(11, row(50)), [row(40)]) };
  assert.deepEqual(C.rivalTrend(weaker, 'ashport'), { now: 40, diff: -15, tone: 'good' }, 'a rival who weakens is good news');
  assert.equal(C.rivalTrend({ history: [row(40)].concat(flat(11, row(40)), [row(52)]) }, 'ashport').tone, 'bad');
  assert.equal(C.rivalTrend({ history: flat(13, { month: 1, cities: { ashport: { share: 5 } } }) }, 'ashport'), null, 'an old save keeps no trace of it');
  assert.match(C.chief(c, weaker), /class="rt good"[^>]*>▼ −15 in 288 days/); assert.doesNotMatch(C.chief(c), /class="rt/);
  assert.equal(C.pin({ site: 'speakeasy', owner: 'family', level: 1 }), C.pin({ site: 'speakeasy', owner: 'family' }));
  assert.match(C.pin({ site: 'speakeasy', owner: 'family', level: 2 }), /class="lv">II</); assert.match(C.pin({ site: 'speakeasy', owner: 'family', level: 3 }), /class="lv">III</);
  assert.doesNotMatch(C.pin({ site: 'speakeasy', owner: 'Callahan', level: 3 }), /class="lv"/, 'a rival does not show his books');
});

test('a new game is asked for from the family page or the journal, and erases nothing before the boss says so', () => {
  const g = E.createGame({ capo: 'sal' }); for (let i = 0; i < 5 * E.TICKS_PER_MONTH; i++) E.tick(g);
  const v = E.view(g), h = E.hud(g);
  assert.match(C.family(v, h), /data-act="restart"/);
  assert.match(C.journal(g.journal), /data-act="restart"/);
  assert.doesNotMatch(C.family(v, h) + C.journal(g.journal), /data-act="new"/, 'no button erases the game in one touch');
  const ask = C.restart({ month: 30, day: 4 });
  assert.match(ask, /data-act="new"/); assert.match(ask, /data-act="close"/);
  assert.match(ask, /stops on day 725/, 'it says which game is lost'); assert.match(C.restart(), /its first day/);
});

test('a money tile at the top is a total alone: under the dirty one what waits in the tills, under the clean one a word while nothing washes', () => {
  const view = { cities: [{ money: { up: 135, pay: 81, washed: 210, washes: 1418, cut: 52.5, seized: 0 }, places: [{ owner: 'family', till: 90.4 }, { owner: 'family', till: 40 }, { owner: 'callahan', till: 500 }, { owner: 'family' }] }] };
  const a = C.account(view, { dirty: 500, clean: 900, change: { dirty: -231, clean: 58 } });
  const d = C.moneyTile(a, 'dirty', view);
  assert.match(d, /IN THE TILLS[^]*<b>\$130<\/b>/); assert.doesNotMatch(d, /IN <b>|OUT|month|\/ mo/);
  assert.equal(C.moneyTile(a, 'clean', view), '');
  assert.equal(C.moneyTile(a, 'dirty', { cities: [] }), '', 'nothing in the tills, nothing said');
  const bare = C.account({ cities: [{ money: { up: 50, pay: 0, washed: 0, washes: 0, cut: 0, seized: 0 } }] }, { dirty: 50, clean: 0, change: { dirty: 50, clean: 0 } });
  assert.match(C.moneyTile(bare, 'clean'), /no laundry yet/);
});
test('the till of a place is a bar that fills up to the load a car comes for', () => {
  assert.equal(C.tillBar({ till: 0 }), ''); assert.equal(C.tillBar(null), '');
  assert.match(C.tillBar({ till: 75 }), /\$75 \/ \$150<\/b> in the till<i class="nxb"><u style="width:50%"/);
  assert.match(C.tillBar({ till: 180 }), /a car is coming for it[^]*width:100%/);
  assert.match(C.tillBar({ till: 100, load: 400 }), /\$100 \/ \$400<\/b>[^]*width:25%/, 'the load is the one the rules give for this place');
});

test('the money page: one money at a time, each line with its icon, its bar and its amount', () => {
  const view = { cities: [{ money: { up: 135, pay: 81, washed: 210, washes: 1418, cut: 52.5, seized: 0 } }, { money: { up: 65, pay: 0, washed: 0, washes: 0, cut: 0, seized: 40 } }],
                 history: [{ month: 1, dirty: 400, clean: 700 }, { month: 2, dirty: 731, clean: 842 }, { month: 3, dirty: 500, clean: 900 }] };
  const hud = { date: 'March 1926', dirty: 500, clean: 900, change: { dirty: -231, clean: 58 } };
  const d = C.accountCard(view, hud);
  assert.match(d, /class="tab on" data-act="account" data-which="dirty"/); assert.match(d, /data-act="account" data-which="clean"/);
  assert.match(d, /DIRTY CASH · \$500/); assert.match(d, /CLEAN MONEY · \$900/);
  assert.match(d, /Sent up by your capos/); assert.doesNotMatch(d, /Back from the laundries/, 'the other money is on its own tab');
  assert.equal((d.match(/class="mrow /g) || []).length, 5); assert.match(d, /class="mrow out"[^]*?width:100%[^]*?−\$210/, 'the biggest line fills its bar');
  const c = C.accountCard(view, hud, 'clean');
  assert.match(c, /class="tab on" data-act="account" data-which="clean"/); assert.match(c, /Back from the laundries/); assert.match(c, /kept \$53 as their cut/);
});

test('the money page draws both monies held over the months on one chart, and says the month in three figures', () => {
  const view = { cities: [{ money: { up: 200, pay: 81, washed: 210, washes: 1418, cut: 52, seized: 40 } }],
                 history: [{ month: 1, dirty: 400, clean: 700 }, { month: 2, dirty: 731, clean: 842 }, { month: 3, dirty: 500, clean: 900 }] };
  const hud = { date: 'March 1926', dirty: 500, clean: 900, change: { dirty: -231, clean: 58 } };
  const d = C.accountCard(view, hud);
  assert.match(d, /class="kp"[^]*IN[^]*\+\$200[^]*OUT[^]*−\$431[^]*LEFT[^]*−\$231/);
  assert.equal((d.match(/<path class="held /g) || []).length, 2, 'a curve for the dirty cash, one for the clean money');
  assert.match(d, /class="held dirty" d="M[\d. ]+L[\d. ]+L[\d. ]+"/);
  assert.match(d, /Dirty cash \$500/); assert.match(d, /Clean money \$900/);
  assert.match(d, /\$1k/, 'the scale is written');
  assert.doesNotMatch(d, /class="mbar/, 'the curves replace the bars by month');
  assert.match(C.accountCard(view, hud, 'clean'), /class="kp"[^]*\+\$158[^]*−\$100[^]*\+\$58/);
  // one month of history is not a curve yet
  assert.doesNotMatch(C.accountCard({ cities: view.cities, history: [view.history[0]] }, hud), /class="held /);
});

// ---- a capo's books (the shapes the rules give: capos[].book, .pace, .plan.monthsLeft, places[].made / made6 / costs, history rows by capo)
const booksView = () => {
  const row = (month, made, wages, sent, spent, saved, spentOn) => ({ month, dirty: 0, clean: 0, cities: { ashport: { share: 10, income: sent, capos: { danny: { places: 3, income: made, rank: 0, made, wages, sent, spent, spentOn: spentOn || {}, saved } } } } });
  return {
    history: [row(250, 300, 100, 30, 0, 100), row(251, 400, 240, 60, 0, 200), row(252, 420, 240, 63, 900, 0, { enlarge: 900 }), row(253, 440, 240, 66, 0, 134), row(254, 460, 240, 69, 0, 285), row(255, 480, 240, 72, 0, 453), row(256, 500, 240, 75, 0, 638), row(257, 600, 240, 90, 1400, 0, { open: 1400 })],
    cities: [{ id: 'ashport', name: 'Ashport', w: 4, h: 4, zones: [{ name: 'Canal Street', x0: 0, y0: 0, x1: 3, y1: 3 }], blocks: [], asks: [],
      places: [{ x: 1, y: 1, owner: 'family', kind: 'club', name: 'Social Club', level: 1, capo: 'danny', made: 150, made6: 150, costs: 0 },
               { x: 1, y: 2, owner: 'family', kind: 'speakeasy', name: 'Speakeasy', level: 2, capo: 'danny', made: 300, made6: 200, costs: 120 },
               { x: 2, y: 2, owner: 'family', kind: 'gambling', name: 'Gambling Room', level: 1, capo: 'danny', made: 150, made6: 133, costs: 120 },
               { x: 3, y: 3, owner: 'family', kind: 'still', name: 'Still', level: 1, capo: 'sal', made: 90, made6: 90, costs: 120 },
               { x: 0, y: 3, owner: 'Kessler', kind: 'gambling', name: 'Gambling Room', level: 1 }],
      capos: [{ id: 'danny', name: 'Danny "the Kid" Reyes', specialty: 'Gambler', rank: 0, rankName: 'Soldier', x: 1, y: 1, places: 3, reach: 6, income: 600, sent: 90, cash: 0, pace: 222,
                book: { made: 600, wages: 240, sent: 90, spent: { open: 1400 }, saved: 0, put: 0 },
                plan: { move: 'take', kind: 'gambling', name: 'Gambling Room', x: 0, y: 3, cost: 6546, saved: 2588, progress: 0.4, waiting: 'money', why: 'no free street left around him', monthsLeft: 18 } }] }]
  };
};

test('a capo\'s books speak in one unit of time: a month, averaged over the last six, or the last month alone', () => {
  const v = booksView();
  const six = C.books(v, 'ashport', 'danny');
  assert.equal(six.span, 6); assert.equal(six.months, 6);
  assert.deepEqual([six.made, six.wages, six.sent, six.kept], [483, 240, 73, 170], 'each figure is the mean of the six months, and what he keeps is what is left');
  assert.equal(six.spent, 2300, 'what he bought is the total of the same six months');
  assert.deepEqual(six.bought.map((b) => [b.what, b.amount, b.ago]), [['open', 1400, 0], ['enlarge', 900, 5]], 'newest first');
  const one = C.books(v, 'ashport', 'danny', 1);
  assert.deepEqual([one.span, one.made, one.wages, one.sent, one.kept, one.spent], [1, 600, 240, 90, 270, 1400]);
  // his places, in the same unit; another man's places and the rivals' are not his
  assert.deepEqual(six.places.map((p) => [p.kind, p.made, p.costs, p.left]), [['speakeasy', 200, 120, 80], ['club', 150, 0, 150], ['gambling', 133, 120, 13]]);
  assert.deepEqual(one.places.map((p) => p.made), [300, 150, 150]);
  // a young game: the mean of what there is, and it says how many months
  const young = booksView(); young.history = young.history.slice(-2);
  assert.equal(C.books(young, 'ashport', 'danny').months, 2); assert.equal(C.books(young, 'ashport', 'danny').made, 550);
  // a game saved before the rules kept his books: last month from what the view always had, nothing invented
  const old = booksView(); old.history.forEach((m) => { const k = m.cities.ashport.capos.danny; delete k.made; delete k.wages; delete k.sent; delete k.spent; delete k.spentOn; delete k.saved; });
  delete old.cities[0].capos[0].book; old.cities[0].places.forEach((p) => { delete p.made; delete p.made6; delete p.costs; });
  const o = C.books(old, 'ashport', 'danny');
  assert.equal(o.months, 0); assert.equal(o.made, 600); assert.equal(o.sent, 90); assert.equal(o.wages, null); assert.deepEqual(o.places, []);
});

test('the page of a capo\'s books: his month step by step, place by place, what he wants and what he bought', () => {
  const v = booksView(), html = C.booksCard(v, 'ashport', 'danny');
  assert.match(html, /Danny/); assert.match(html, /Every 24 days, averaged over the last 144 days/);
  assert.match(html, /class="tab on" data-act="books"[^>]*data-span="6"/); assert.match(html, /data-act="books"[^>]*data-span="1"/);
  assert.match(html, /His places made[^]*\+\$483[^]*Men paid[^]*−\$240[^]*Sent up to you[^]*−\$73[^]*He keeps[^]*\$170/);
  assert.equal((html.match(/<tr class="pl"/g) || []).length, 3); assert.match(html, /Speakeasy[^]*\+\$200[^]*−\$120[^]*\$80/);
  assert.match(html, /class="sum"[^]*\+\$483[^]*−\$240[^]*\$243/, 'the table adds up to his month');
  assert.match(html, /\$2,588 of \$6,546/); assert.match(html, /about 432 days/); assert.match(html, /needs \$3,958 more/);
  assert.match(html, /What he bought[^]*\$2,300 in 144 days/); assert.match(html, /24 days ago[^]*Opened a place[^]*−\$1,400/); assert.match(html, /144 days ago[^]*Made a place bigger[^]*−\$900/);
  assert.match(html, /data-act="capo"/, 'back to the man');
  assert.match(html, /What he wants[^]*class="nxb"><u style="width:\d+%"/, 'how far his plan is, as a bar');
  const one = C.booksCard(v, 'ashport', 'danny', 1);
  assert.match(one, /The last 24 days alone/); assert.match(one, /class="tab on" data-act="books"[^>]*data-span="1"/); assert.match(one, /\+\$600/);
  // he has the money, or he saves nothing: said plainly
  v.cities[0].capos[0].plan.monthsLeft = null; assert.match(C.booksCard(v, 'ashport', 'danny'), /puts nothing aside/);
  v.cities[0].capos[0].plan = { move: 'hold', why: 'he runs all he can at his rank', cost: 0, saved: 0, progress: 1, waiting: 'rank' };
  assert.doesNotMatch(C.booksCard(v, 'ashport', 'danny'), /needs \$/);
  assert.equal(C.booksCard(v, 'ashport', 'nobody'), null);
  assert.match(C.capo(v, 'ashport', 'danny', { dirty: 0, clean: 0 }), /data-act="books"/, 'his books open from his sheet');
});

test('the money page speaks in the same unit as a capo\'s books: a month averaged over six, or the last month alone', () => {
  const m = (month, dirty, clean, up, pay, washed, cut, seized) => ({ month, dirty, clean, money: { up, pay, washed, cut, seized, hijacked: 0 } });
  const view = { cities: [{ money: { up: 600, pay: 100, washed: 200, washes: 1418, cut: 50, seized: 0 } }],
    history: [m(1, 1000, 0, 0, 0, 0, 0, 0), m(2, 1100, 100, 300, 100, 100, 0, 0), m(3, 1200, 200, 300, 100, 100, 0, 0), m(4, 1300, 300, 300, 100, 100, 0, 0), m(5, 1400, 400, 300, 100, 100, 0, 0), m(6, 1500, 500, 300, 100, 100, 0, 0), m(7, 1800, 650, 600, 100, 200, 50, 0)] };
  const hud = { date: 'July 1926', dirty: 1800, clean: 650, change: { dirty: 300, clean: 150 } };
  const six = C.account(view, hud, 6);
  assert.equal(six.months, 6);
  assert.deepEqual(six.dirty.map((l) => [l.key, l.amount]), [['up', 350], ['pay', -100], ['wash', -117]]);
  assert.equal(six.dirtyNet, 133, 'what the dirty cash gained a month, from where it stood six months ago');
  assert.deepEqual(six.clean.map((l) => [l.key, l.amount]), [['back', 108]]); assert.equal(six.cleanNet, 108);
  assert.deepEqual(C.account(view, hud, 1).dirty.map((l) => [l.key, l.amount]), [['up', 600], ['pay', -100], ['wash', -200]]);
  const html = C.accountCard(view, hud);
  assert.match(html, /Every 24 days, averaged over the last 144 days/); assert.match(html, /class="tab on" data-act="account"[^>]*data-span="6"/); assert.match(html, /\+\$350/);
  const one = C.accountCard(view, hud, 'dirty', 1);
  assert.match(one, /The last 24 days alone/); assert.match(one, /\+\$600/); assert.match(one, /class="tab on" data-act="account"[^>]*data-span="1"/);
  assert.match(one, /data-which="clean"[^>]*data-span="1"/, 'changing money keeps the unit');
  // the tiles at the top of the screen stay on the real month
});

test('a capo short of money for a rival\'s place asks the boss for the rest, and the card says so in its own words', () => {
  const v = booksView();
  v.cities[0].feuds = []; v.cities[0].doors = [];
  v.cities[0].asks = [{ id: 7, capo: 'danny', kind: 'fund', key: 'gambling', name: 'Kesslers\' gambling room', gives: 'A second room for his tables', x: 0, y: 3, way: 'buy', cost: 3958, months: 2, why: 'no free street left around him', expects: null }];
  const html = C.requests(v, { dirty: 5000, clean: 0 });
  assert.match(html, /Danny asks for \$3,958/); assert.match(html, /Kesslers&#39; gambling room|Kesslers' gambling room/);
  assert.doesNotMatch(html, /wants the/); assert.doesNotMatch(html, /No money promised/);
  assert.match(html, /He puts in his own savings/); assert.match(html, /Yes, pay the rest/); assert.match(html, /lets the place go/);
  assert.match(html, /data-act="answer"[^>]*data-yes="1"/); assert.match(html, /data-act="answer"[^>]*data-yes="0"/);
});

// ---- the next streets, at the top of the screen: one line, one bar, never a count of months
test('the line of the next streets says who does what, what it wins, and how far it is, without a count of months', () => {
  const list = [{ id: 'ashport:sal', city: 'ashport', capo: 'sal', who: 'Sal', does: 'opens a speakeasy', x: 8, y: 9, streets: 2, advance: 0.48, state: 'money', stuck: false, gains: [] },
                { id: 'ashport:dutch', city: 'ashport', capo: 'dutch', who: 'Dutch', does: 'takes a warehouse', x: 1, y: 1, streets: 1, advance: 0.2, state: 'stuck', stuck: true, gains: [] }];
  const h = C.nextLine(list, 0);
  assert.match(h, /Next streets/); assert.match(h, /Sal opens a speakeasy/); assert.match(h, /\+2 streets/); assert.match(h, /Saving for it/);
  assert.match(h, /width:48%/); assert.match(h, /1 \/ 2/);
  assert.match(h, /data-city="ashport"/); assert.match(h, /data-x="8"/); assert.match(h, /data-y="9"/);
  assert.doesNotMatch(h, /month/i);
  const s = C.nextLine(list, 1);
  assert.match(s, /class="nx stuck"/); assert.match(s, /Stalled: he saves nothing/); assert.match(s, /\+1 street</, 'one street is not written streets'); assert.match(s, /2 \/ 2/);
  assert.match(C.nextLine(list, 5), /Dutch/, 'the line turns round the list');
  assert.doesNotMatch(C.nextLine(list.slice(0, 1), 0), /1 \/ 1/, 'alone, it carries no count');
  assert.equal(C.nextLine([], 0), '');
  assert.match(C.nextLine([{ ...list[0], state: 'men', advance: 0.8 }], 0), /His men are on their way/);
  assert.match(C.nextLine([{ ...list[0], due: 3 }], 0), /Saving for it · 72 days/, 'the days left, when his pace tells them');
  assert.match(C.nextLine([{ ...list[0], state: 'ready', advance: 1 }], 0), /Any day now/);
});
test('the mark of a claim over the map: a ring that fills and the streets it wins', () => {
  const h = C.claim({ streets: 3, advance: 0.5, stuck: false });
  assert.match(h, /<svg class="ring"/); assert.match(h, /\+3<\/i> streets/);
  assert.match(h, /stroke-dasharray="47\.12/);
});

// ---- time is counted in days
test('the day the game has reached is counted from the first one, and a length the rules give in turns is said in days', () => {
  assert.equal(C.day(0, 0), 'Day 1'); assert.equal(C.day(13, 0), 'Day 313'); assert.equal(C.day(13, 23), 'Day 336');
  assert.equal(C.day({ month: 2, day: 5 }), 'Day 54'); assert.equal(C.dayNo(1), 25);
});

test('a new act and what the hidden director sends each have their picture, and say what they change', () => {
  const act = C.news({ type: 'act', act: 2, up: true, label: 'Act II: The City', gives: 'The table opens' });
  assert.match(act, /data-ic="ambition"|<svg/); assert.doesNotMatch(act, /class="news bad"/);
  assert.match(act, /Act II: The City/); assert.match(act, /<small>The table opens<\/small>/);
  const good = C.news({ type: 'beat', kind: 'truce', tone: 'good', city: 'ashport', label: 'The Callahans ask for a truce', gives: 'No attack for a while' });
  assert.match(good, /class="news good"/); assert.match(good, /<small>No attack for a while<\/small>/);
  const ill = C.news({ type: 'beat', kind: 'thief', tone: 'bad', city: 'ashport', label: 'A thief in the house', gives: 'The till is short' });
  assert.match(ill, /class="news bad"/);
  assert.notEqual(C.eventIcon({ type: 'beat', tone: 'bad' }), 'time'); assert.notEqual(C.eventIcon({ type: 'beat', tone: 'good' }), 'time'); assert.equal(C.eventIcon({ type: 'act' }), 'ambition');
  assert.match(C.news({ type: 'act', up: false, label: 'The family falls back to Act I: The Street' }), /class="news bad"/);
  const j = C.journal([{ type: 'beat', tone: 'bad', label: 'A thief in the house', gives: 'The till is short', month: 3 }]);
  assert.match(j, /class="i no"/); assert.match(j, /The till is short/);
});

// ---- the live hit
const HIT = { id: 'ashport:hit1', capo: 'sal', x: 5, y: 10, kind: 'chopshop', name: 'Chop shop', rival: 'Callahan', stage: 1, stages: ['The street', 'The door', 'Inside'], ours: 7, theirs: 6, lost: 2,
  title: 'They were waiting at the door', say: 'Two of ours are down. Sal holds the street and waits for your word.',
  calls: [{ id: 'press', name: 'Press on', gains: ['The door, then the chop shop'], risks: ['2 to 3 men', 'Heat'] }, { id: 'hold', name: 'Hold', gains: ['The street: their place burns'], risks: ['No chop shop', '1 or 2 men'] },
          { id: 'pull', name: 'Pull out', gains: ['No more men lost'], risks: ['Nothing won', 'Sal loses face'] }], alone: 'press', left: 9, of: 12 };

test('a live hit has its band: who hits what, both sides, and the three steps with the one being played', () => {
  const html = C.hitBand(HIT);
  assert.match(html, /Live/); assert.match(html, /Callahan family/); assert.match(html, /Sal hits the Chop shop/);
  assert.match(html, /<b>7<\/b>/); assert.match(html, /<b class="r">6<\/b>/);
  assert.match(html, /style="width:54%"/, 'the bar is shared by the men of each side');
  assert.match(html, /class="done">The street/); assert.match(html, /class="now">The door/); assert.match(html, /class="">Inside/);
});

test('the boss is given the three calls with what each wins and costs, and is told what the capo does if left alone', () => {
  const html = C.hitCall(HIT, 'ashport');
  assert.match(html, /They were waiting at the door/); assert.match(html, /Two of ours are down/);
  const calls = acts(html, 'call');
  assert.equal(calls.length, 3);
  assert.match(calls[0], /data-city="ashport"/); assert.match(calls[0], /data-hit="ashport:hit1"/); assert.match(calls[0], /data-call="press"/);
  assert.match(html, /<span class="g">The door, then the chop shop<\/span>/); assert.match(html, /<span class="b">Heat<\/span>/);
  assert.match(html, /Left alone, Sal <em>presses on<\/em>/);
  assert.match(html, /style="width:75%"/, 'the time he still waits');
  assert.match(calls[0], /class="[^"]*hot/, 'the call he would make himself is marked');
  assert.equal(acts(html, 'unlive').length, 1, 'the boss can look away');
  assert.match(C.hitCall(Object.assign({}, HIT, { alone: 'pull' }), 'ashport'), /Sal <em>pulls out<\/em>/);
  assert.equal(C.hitCall(Object.assign({}, HIT, { calls: [] }), 'ashport'), '', 'nothing to call, nothing shown');
});

test('the end of a hit says what was won and what it cost', () => {
  const last = { id: 'ashport:hit1', capo: 'sal', x: 5, y: 10, kind: 'chopshop', name: 'Chop shop', rival: 'Callahan',
    result: { outcome: 'won', won: true, call: 'press', watched: true, place: 1, streets: 4, till: 1200, lost: 4, heat: 8, title: 'The Chop shop is ours', say: 'Sal went in on your word. He lost four men and took $1200 from the till.' } };
  const html = C.hitEnd(last);
  assert.match(html, /The Chop shop is ours/); assert.match(html, /Sal went in on your word/);
  assert.match(html, /<b>\+1<\/b><span>Place<\/span>/); assert.match(html, /<b>\+4<\/b><span>Streets<\/span>/); assert.match(html, /<b>\$1,200<\/b><span>Till<\/span>/);
  assert.match(html, /class="b"><b>4<\/b><span>Men lost<\/span>/); assert.match(html, /class="b"><b>\+8<\/b><span>Heat<\/span>/);
  assert.equal(acts(html, 'unlive').length, 1);
  const lost = C.hitEnd({ capo: 'sal', name: 'Chop shop', result: { outcome: 'pulled', won: false, place: 0, streets: 0, till: 0, lost: 1, heat: 2, title: 'Sal pulled out of the chop shop', say: 'You called him back. He lost one man and kept the rest.' } });
  assert.match(lost, /class="[^"]*lost/); assert.doesNotMatch(lost, /Place<\/span>/); assert.doesNotMatch(lost, /Till<\/span>/);
  assert.equal(C.eventIcon({ type: 'hit' }), 'muscle');
  assert.match(C.news({ type: 'hit', step: 'end', result: { won: false }, label: 'Sal pulled out' }), /class="news bad"/);
  assert.match(C.news({ type: 'hit', step: 'end', result: { won: true }, label: 'The chop shop is ours' }), /class="news good"/);
});

// ---- the headquarters
test('a headquarters has a bubble and a sheet of its own: whose it is, what it is at this act, who sits there', () => {
  const g = E.createGame({ capo: 'sal' }), v = JSON.parse(JSON.stringify(E.view(g))), c = v.cities[0], hq = c.hq.family, rv = c.hq.rival;
  rv.stage = 4; c.places.forEach((q) => { if (q.kind === 'hq' && q.owner !== 'family') q.stage = 4; });
  const mine = C.blockTip(v, c.id, hq.x, hq.y), theirs = C.blockTip(v, c.id, rv.x, rv.y);
  assert.match(mine, /Your headquarters/); assert.match(mine, /Back room/); assert.match(mine, /You sit here/);
  assert.doesNotMatch(mine, /level/); assert.doesNotMatch(mine, /unknown/);
  assert.match(theirs, new RegExp('The ' + c.rival + ' headquarters')); assert.match(theirs, /Mansion/);
  if (c.chief) assert.match(theirs, new RegExp(c.chief.name.split(' ')[0] + '.* sits here'));
  const sheet = C.block(v, c.id, hq.x, hq.y);
  assert.match(sheet, /Your headquarters/); assert.match(sheet, /Act I/); assert.doesNotMatch(sheet, /level 2/);
  assert.match(sheet, /share of every capo is driven here/);
  const pin = C.pin({ site: 'hq', owner: 'family', level: 1 }); assert.doesNotMatch(pin, /unknown/);
  const town = JSON.parse(JSON.stringify(v)); town.cities[0].hq.family.home = false; town.cities[0].hq.family.who = [];
  assert.match(C.blockTip(town, c.id, hq.x, hq.y), /Nobody sits here yet/);
});

test('the share of the boss that waits at a club is seen there, with the load it leaves by', () => {
  const g = E.createGame({ capo: 'sal' }), v = JSON.parse(JSON.stringify(E.view(g))), c = v.cities[0], k = c.capos[0];
  k.share = 60; k.shareLoad = 150;
  assert.match(C.blockTip(v, c.id, k.x, k.y), /\$60 \/ \$150.*your share/);
  assert.match(C.block(v, c.id, k.x, k.y), /\$60 \/ \$150<\/b> of your share/);
  k.share = 0; assert.doesNotMatch(C.blockTip(v, c.id, k.x, k.y), /your share/);
});

test('what an act has not opened yet says so: the underboss button is greyed with the reason, the police threshold is the one of the vault', () => {
  const g = E.createGame({ capo: 'sal' }), v = JSON.parse(JSON.stringify(E.view(g))), city = v.cities[0], k = city.capos[0], other = { ...k, id: 'mae', name: 'Mae Rourke' };
  const two = { ...v, cities: [{ ...city, under: null, capos: [k, other] }] };
  assert.ok(v.reign.closed.underboss);
  assert.match(C.capo(two, city.id, k.id), /data-act="underboss"[^>]*disabled[^]*An underboss comes with Act III/);
  two.reign = { ...v.reign, closed: {} };
  assert.doesNotMatch(C.capo(two, city.id, k.id), /data-act="underboss"[^>]*disabled/);
  assert.equal(C.vault(v, { vault: 5000 }), 5000); assert.equal(C.vault({ reign: { vault: 4000 } }, {}), 4000);
  assert.equal(C.wash(v, { dirty: 4500, vault: 5000 }).hot, false); assert.equal(C.wash(v, { dirty: 5500, vault: 5000 }).hot, true);
});

test('a laundry says what waits there: dirty money to be washed, clean money that waits for the car', () => {
  const g = E.createGame({ capo: 'sal' }), v = JSON.parse(JSON.stringify(E.view(g))), c = v.cities[0], k = c.capos[0];
  const p = { x: k.x + 1, y: k.y, owner: 'family', kind: 'rented', name: 'Rented laundry', level: 1, capo: k.id, wash: { waiting: 63, ready: 49, most: 210 } };
  c.places = c.places.filter((q) => q.x !== p.x || q.y !== p.y).concat([p]);
  assert.match(C.blockTip(v, c.id, p.x, p.y), /\$63 to wash[^]*\$49 clean, waiting for the car/);
  const sheet = C.block(v, c.id, p.x, p.y);
  assert.match(sheet, /<b>\$63 \/ \$210<\/b> of dirty money waits to be washed[^]*width:30%/);
  assert.match(sheet, /<b>\$49<\/b> washed, waiting for the car to the headquarters/);
  p.wash = { waiting: 0, ready: 0, most: 210 };
  assert.doesNotMatch(C.blockTip(v, c.id, p.x, p.y), /to wash|waiting for the car/); assert.doesNotMatch(C.block(v, c.id, p.x, p.y), /washed, waiting/);
});

test('the headquarters of another city says what sleeps in its coffer, and the load that takes the road', () => {
  const g = E.createGame({ capo: 'sal' }), v = JSON.parse(JSON.stringify(E.view(g))), c = v.cities[0], hq = c.hq.family;
  hq.home = false; c.coffer = { dirty: 250, clean: 50, load: 600 };
  assert.match(C.blockTip(v, c.id, hq.x, hq.y), /\$300 \/ \$600 in the coffer/);
  assert.match(C.block(v, c.id, hq.x, hq.y), /<b>\$300 \/ \$600<\/b> in the coffer[^]*width:50%[^]*\$250 dirty[^]*\$50 clean/);
  delete c.coffer; assert.doesNotMatch(C.block(v, c.id, hq.x, hq.y), /in the coffer/);
});

test('a car that carries money says whose and where to: the share of the boss, washed money, the take of a hit, the van between cities', () => {
  assert.match(C.carTip({ kind: 'tribute', cargo: 'cash', amount: 150, capo: 'sal' }), /Your share, on its way to the headquarters[^]*\$150 on board/);
  assert.match(C.carTip({ kind: 'clean', cargo: 'clean', amount: 120 }), /Washed money, on its way to the headquarters[^]*\$120 on board/);
  assert.match(C.carTip({ kind: 'loot', cargo: 'cash', amount: 240, capo: 'sal' }), /The take of a hit, on its way to the club[^]*\$240 on board/);
  const van = C.carTip({ kind: 'convoy', cargo: 'cash', amount: 600, way: 'Calder Falls to Ashport' });
  assert.match(van, /The money of a city, on the road to your headquarters[^]*Calder Falls to Ashport[^]*\$600 on board/);
  const back = C.carTip({ kind: 'convoy', cargo: 'cash', amount: 0, way: 'Ashport to Calder Falls' });
  assert.match(back, /The van drives home empty/); assert.doesNotMatch(back, /\$|on board/);
  assert.equal(C.carLoad({ kind: 'tribute', amount: 150 }), '$150'); assert.equal(C.carLoad({ kind: 'convoy', cargo: 'cash', amount: 600 }), '$600'); assert.equal(C.carLoad({ kind: 'convoy', cargo: 'cash', amount: 0 }), '');
  assert.equal(C.carLoad({ kind: 'convoy', cargo: 'liquor', amount: 20 }), '');
});

test('what the boss pays is on its way: the words for it, the gift button that waits, the list at the headquarters', () => {
  const g = E.createGame({ capo: 'sal' }), v = JSON.parse(JSON.stringify(E.view(g))), c = v.cities[0], k = c.capos[0], hq = c.hq.family;
  const p = { id: 1, order: 'gift', city: c.id, capo: k.id, x: k.x, y: k.y, amount: 1500, sent: 600, arrived: 300, rides: [{ amount: 300, days: 2, gone: 1 }] };
  assert.equal(C.payingLine(p), '$1,500 for a gift to Sal'); assert.equal(C.payingLine({ ...p, order: 'welcome' }), '$1,500 for the club of Sal'); assert.equal(C.payingLine({ ...p, order: 'answer' }), '$1,500 for what Sal asked');
  assert.equal(C.onItsWay({ ...v, paying: [p] }, 'gift', c.id, k.id), 'The money leaves your headquarters by loads: $1,500 for a gift to Sal.');
  assert.equal(C.onItsWay(v, 'gift', c.id, k.id), '');
  v.paying = [p];
  const sheet = C.block(v, c.id, hq.x, hq.y);
  assert.match(sheet, /Leaving from here[^]*\$1,500 for a gift to Sal[^]*\$300 \/ \$1,500<\/b> arrived[^]*\$300 on the road[^]*width:20%/);
  k.gift = { cost: 1500, wait: 0, paying: true };
  assert.match(C.capo(v, c.id, k.id, { clean: 5000 }), /data-act="gift"[^>]*disabled[^]*The money is on its way/);
  v.paying = []; assert.doesNotMatch(C.block(v, c.id, hq.x, hq.y), /Leaving from here/);
});

test('a club whose capo is away keeps its own mark on the map', () => {
  const labels = [{ id: 'kashportsal', capo: 'sal', city: 'ashport', where: 'raid' }, { id: 'kashportmae', capo: 'mae', city: 'ashport', where: 'home' }, { id: 'kashportdutch', capo: 'dutch', city: 'ashport', where: 'home', riding: true },
    { id: 's1', site: 'club', role: 'club', capo: 'sal', city: 'ashport' }];
  const empty = C.emptyClubs(labels);
  assert.deepEqual(Object.keys(empty).sort(), ['ashportdutch', 'ashportsal'], 'his face is elsewhere, or in his car: the club shows its mark');
});

test('what the family knows is drawn as a wheel: one spoke a trade, three rings for its tiers, the family at the centre', () => {
  const { g } = play((v) => v.month >= 12);
  const v = E.view(g), html = C.wheel(v, v.tree[0].kind);
  assert.match(html, /class="wheel"/);
  const spokes = html.match(/<button class="know[^"]*" data-know="[^"]+" style="left:[\d.]+%;top:[\d.]+%"/g) || [];
  assert.equal(spokes.length, v.tree.length, 'every trade has its place on the rim');
  assert.equal(new Set(spokes.map((s) => /style="([^"]+)"/.exec(s)[1])).size, v.tree.length, 'each its own place');
  const lit = (html.match(/<i class="ring on"/g) || []).length, all = (html.match(/<i class="ring/g) || []).length;
  assert.equal(all, v.tree.length * 3, 'three rings a spoke');
  assert.equal(lit, v.tree.reduce((n, t) => n + t.tier, 0), 'a ring is lit for every tier the family knows');
  assert.match(html, /class="hub"/);
  assert.equal((html.match(/class="know[^"]* sel"/g) || []).length, 1, 'the trade looked at stands out');
  assert.match(html, /know shut/, 'a trade not known yet is dimmed');
  assert.match(C.family(v, E.hud(g)), /class="wheel"/, 'it is the tree of the family sheet');
  // a trade being paid for or learned shows its next ring coming
  g.family.clean = 99999; const shut = v.tree.find((t) => t.tier === 0 && t.next);
  E.command(g, { type: 'research', building: shut.kind });
  assert.equal((C.wheel(E.view(g), shut.kind).match(/<i class="ring next"/g) || []).length, 1);
});

test('a till and a store say how much they hold out of how much', () => {
  assert.deepEqual(C.store({ stock: 60, holds: 'liquor', room: 80 }).map((s) => s[1]), ['60 / 80 cases of liquor in store']);
  assert.deepEqual(C.store({ stock: 60, holds: 'liquor' }).map((s) => s[1]), ['60 cases of liquor in store'], 'no ceiling told: the count alone');
  assert.deepEqual(C.store({ stock: 0, holds: 'goods', room: 40 }).map((s) => s[1]), ['0 / 40 crates in store'], 'an empty store that has a ceiling still says so');
  assert.deepEqual(C.store({ weed: 3, weedRoom: 5 }).map((s) => s[1]), ['3 / 5 bags of weed to sell']);
  assert.deepEqual(C.store({ weed: 0, weedRoom: 20 }), [], 'a bar that was never brought weed says nothing of it');
  const { g } = play((v) => v.cities[0].places.some((p) => p.owner === 'family' && p.till > 0 && p.load > 0));
  const v = E.view(g), p = v.cities[0].places.find((q) => q.owner === 'family' && q.till > 0 && q.load > 0);
  const tip = C.blockTip(v, v.cities[0].id, p.x, p.y);
  assert.ok(tip.includes('$' + Math.round(p.till) + ' / $' + p.load + ' in the till'), 'the till against the load a car comes for: ' + tip.replace(/<svg[^]*?<\/svg>/g, ''));
});

// What a building is doing must be seen, not read: its bubble draws each figure as a gauge, and names each figure so the
// screen can show what moved while the bubble stays open.
test('the bubble of a place draws its figures as gauges that can be followed', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq');
  const see = (more, rides) => { const p = { ...ours, room: 0, weedRoom: 0, till: 0, ...more }, c = { ...city, rides: rides || [], places: city.places.map((q) => (q === ours ? p : q)) }; return C.blockTip({ ...v, cities: [c] }, c.id, p.x, p.y); };
  const t = see({ till: 90, load: 150, stock: 60, room: 80, holds: 'liquor' });
  assert.match(t, /data-k="till" data-v="90"[^>]*>.*\$90 \/ \$150 in the till.*width:60%/);
  assert.match(t, /data-k="stock" data-v="60"[^>]*>.*60 \/ 80 cases of liquor in store.*width:75%/);
  const w = see({ wash: { waiting: 184, ready: 40, most: 92 } });
  assert.match(w, /data-k="wash" data-v="184"/); assert.match(w, /data-k="ready" data-v="40"/);
  // what is on the road to it or from it is part of what it is doing
  const club = city.places.find((p) => p.kind === 'club');
  const out = see({}, [{ kind: 'takings', capo: 'sal', vehicle: 'sal:car:1', from: { x: ours.x, y: ours.y }, to: { x: club.x, y: club.y }, amount: 46.8, days: 3, gone: 1 }]);
  assert.match(out, /\$47 on the road to the Social Club/);
  const inn = see({}, [{ kind: 'haul', cargo: 'liquor', capo: 'sal', vehicle: 'sal:truck:1', from: { x: club.x, y: club.y }, to: { x: ours.x, y: ours.y }, amount: 20, days: 9, gone: 3 }]);
  assert.match(inn, /20 cases of liquor coming · 6 days/);
  assert.doesNotMatch(see({}, [{ kind: 'haul', cargo: 'liquor', from: { x: club.x, y: club.y }, to: { x: ours.x, y: ours.y }, amount: 20, days: 9, gone: 9 }]), /coming/, 'what has arrived is no longer on the road');
});

test('what moved between two looks at a bubble is told figure by figure', () => {
  assert.deepEqual(C.moved({ till: 90, stock: 60, wash: 10 }, { till: 102, stock: 57, wash: 10, ready: 5 }), { till: 12, stock: -3 });
  assert.equal(C.delta('till', 12), '+$12'); assert.equal(C.delta('stock', -3), '−3'); assert.equal(C.delta('ready', -40), '−$40');
});

test('every place of the family has a gauge for the map: how full is what it fills', () => {
  const { v } = play((v) => v.month >= 12);
  const city = v.cities[0], ours = city.places.find((p) => p.owner === 'family' && p.kind !== 'club' && p.kind !== 'hq');
  const of = (more) => { const p = { ...ours, room: 0, till: 0, wash: undefined, ...more }, c = { ...city, places: city.places.map((q) => (q === ours ? p : q)) }; return C.fills({ ...v, cities: [c] })[c.id + ':' + p.x + ',' + p.y]; };
  assert.equal(of({ till: 75, load: 150 }), 0.5);
  assert.equal(of({ kind: 'still', stock: 20, room: 80, holds: 'liquor' }), 0.25, 'a place that only makes fills its cellar');
  assert.equal(of({ wash: { waiting: 46, ready: 0, most: 92 } }), 0.5);
  assert.equal(of({ till: 400, load: 150 }), 1);
  const rival = city.places.find((p) => p.owner !== 'family');
  assert.equal(C.fills(v)[city.id + ':' + rival.x + ',' + rival.y], undefined);
});
