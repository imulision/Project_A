// The sheets of the screen, as text: what the boss reads when he touches a man, a district or the family.
// No browser here: a sheet is worked out from the state of the game alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../web/game.js');
const S = require('../web/sheets.js');

const count = (html, re) => (html.match(re) || []).length;
const played = (capo, months) => {
  const g = G.createGame(); G.command(g, { type: 'start', capo });
  for (let i = 0; i < G.TICKS_PER_MONTH * months; i++) { G.tick(g); G.proposals(g).forEach((p) => G.command(g, { type: 'approve', id: p.id })); }
  S.use(g); return g;
};

test('before the game starts, the boss chooses among six faces and sees one man in full', () => {
  S.use(G.createGame());
  const html = S.start();
  assert.equal(count(html, /data-face="/g), 6);
  assert.equal(count(html, /class="stat"/g), 4, 'his four stats are gauges');
  assert.match(html, /data-act="start" data-capo="/);
  assert.match(S.man('mae'), /Mae/, 'touching another face shows that man');
});

test('a district of the family shows its capo, what he is after, its figures with their curve, its chain and its places', () => {
  played('dutch', 20);
  const html = S.district('ashport-hillside');
  assert.match(html, /<h2>Hillside<\/h2>/);
  assert.ok(count(html, /class="tile"/g) >= 6);
  assert.ok(count(html, /<svg class="spark/g) >= 4, 'each figure has its curve');
  assert.match(html, /class="intent"/);
  assert.ok(count(html, /class="node/g) >= 8, 'liquor and money are a chain');
  assert.ok(count(html, /class="place/g) >= 2);
  assert.match(html, /LAUNDERING/, 'a laundry is marked as such');
});

test('a district of a rival offers three ways in, and says which suits the man sent', () => {
  played('sal', 12);
  const html = S.district('ashport-market');
  assert.equal(count(html, /data-order="takeover"/g), 3);
  const men = S.pick('takeover', 'ashport-market', 'force');
  assert.match(men, /data-act="takeover:ashport-market:force"/);
  assert.match(S.man('mae'), /Poor odds/);
});

test('nothing to decide, no sheet', () => {
  S.use(G.createGame({ capo: 'sal' }));
  assert.equal(S.proposals(), null);
  assert.equal(S.promotions(), null);
});

test('the family sheet draws the wheel, the pyramid of ranks and the places the family can run', () => {
  played('dutch', 20);
  const html = S.family();
  assert.equal(count(html, /data-skill="/g), 18);
  assert.ok(count(html, /class="slot/g) >= 3);
  assert.ok(count(html, /data-know="/g) >= 8);
  assert.match(S.know('gambling'), /Open this trade|Enlarge|Being learnt|As large/);
  assert.match(S.skill('0:0'), /Liquor/);
});

test('the journal tells the months with an icon each', () => {
  played('dutch', 12);
  assert.ok(count(S.journal(), /class="ev"/g) > 5);
});

test('a car says in a few words what it carries and for whom', () => {
  played('dutch', 3);
  const tip = S.carTip({ cargo: 'liquor', load: { crates: 30 }, from: 'still', to: 'speakeasy', vehicle: 'truck', kind: 'liquor', district: 'ashport-hillside' });
  assert.match(tip, /Liquor/); assert.match(tip, /30 crates/); assert.match(tip, /Hillside, sent by Dutch/);
});

test('whatever a name holds, a sheet never lets it write markup', () => {
  assert.equal(S.esc('<b>"x"&'), '&lt;b&gt;&quot;x&quot;&amp;');
});
