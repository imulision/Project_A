// The goal of the game is on the screen: what the family is after now, what it opens, and the day the game is won.
// (No play tester knew why he was playing: 1.9 out of 5 on "I know what my goal is".)
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');
const R = require('../web/reign.js');
const C = require('../web/cards.js');

const days = (g, n) => { const out = []; for (let i = 0; i < n; i++) { g.paused = false; out.push(...E.tick(g)); } return out; };
// the family holds this share of the whole map today
const hold = (g, share) => { g.history[g.history.length - 1].cities = { ashport: { share } }; return E.settle(g); };
const game = () => { const g = E.createGame({ capo: 'dutch' }); days(g, 24); return g; };
const text = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('a new family is told its next step: the share to hold, the rank it gives and what that opens', () => {
  const goal = E.view(game()).reign.goal;
  assert.equal(goal.need, 3); assert.equal(goal.rank, 'Crew');
  assert.equal(goal.act, 'Act II: The City');
  assert.match(goal.opens, /table/); assert.match(goal.opens, /roads/);
  assert.equal(goal.final, 50); assert.equal(goal.wins, false);
  assert.ok(goal.part >= 0 && goal.part < 1);
});

test('each rank won moves the goal to the next one, and the last one wins the game', () => {
  const g = game();
  hold(g, 4); assert.deepEqual([E.view(g).reign.goal.need, E.view(g).reign.goal.rank], [10, 'Family']);
  hold(g, 12); assert.equal(E.view(g).reign.goal.need, 25);
  hold(g, 30);
  const last = E.view(g).reign.goal;
  assert.deepEqual([last.need, last.rank, last.wins], [50, 'Commission', true]);
  assert.match(last.opens, /won/i);
});

test('the day the family holds half the map the game is won: told once, kept, and the game goes on', () => {
  const g = game();
  assert.equal(E.view(g).reign.won, null);
  const told = hold(g, 51).filter((e) => e.type === 'won');
  assert.equal(told.length, 1);
  assert.match(told[0].label, /Commission/);
  assert.equal(E.view(g).reign.won.month, g.month);
  assert.equal(E.view(g).reign.goal, null, 'nothing left to reach');
  assert.equal(hold(g, 55).filter((e) => e.type === 'won').length, 0, 'never told twice');
  assert.equal(hold(g, 40).filter((e) => e.type === 'won').length, 0);
  assert.equal(hold(g, 52).filter((e) => e.type === 'won').length, 0, 'not even after a fall');
  assert.ok(g.journal.some((e) => e.type === 'won'));
  const again = E.load(E.save(g));
  assert.equal(E.view(again).reign.won.month, E.view(g).reign.won.month);
  days(again, 48);
});

test('the line at the top of the screen says the goal in one glance', () => {
  const g = game(), line = text(C.goalLine(E.view(g)));
  assert.match(line, /Street gang/);
  assert.match(line, /Goal/i); assert.match(line, /3% of the streets/); assert.match(line, /Crew/);
  assert.match(C.goalLine(E.view(g)), /data-goal="1"/, 'a touch opens the whole road');
  hold(g, 51);
  assert.match(text(C.goalLine(E.view(g))), /Commission/);
  assert.equal(C.goalLine({ history: [] }), C.rankLine(C.rank({ history: [] })), 'an old view still shows its rank');
});

test('the sheet of the reign shows the whole road: every rank, its share, what it opens, where the family stands, and how the game is won', () => {
  const g = game(); hold(g, 4);
  const html = C.reign(E.view(g)), t = text(html);
  ['Street gang', 'Crew', 'Family', 'Syndicate', 'Commission'].forEach((r) => assert.match(t, new RegExp(r)));
  ['3%', '10%', '25%', '50%'].forEach((s) => assert.match(t, new RegExp(s)));
  assert.match(t, /half the streets of the six cities/i);
  assert.equal((html.match(/class="step now"/g) || []).length, 1, 'one step is marked as the one the family stands on');
  assert.match(t, /underboss/i);
});

test('the day the game is won a sheet says so, with what it took, and offers to go on or to start again', () => {
  const g = game(); hold(g, 51);
  const html = C.won(E.view(g), E.hud(g)), t = text(html);
  assert.match(t, /Commission/); assert.match(t, /Day \d+/);
  assert.match(html, /data-act="close"/); assert.match(html, /data-act="restart"/);
});

test('the first minutes say what the game is about', () => {
  const g = game(), h = C.hint(E.view(g), E.hud(g), { capo: 1 });
  assert.equal(h.id, 'goal');
  assert.match(h.text, /half the streets/); assert.match(h.text, /3%/);
});
