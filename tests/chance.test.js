// A little chance from one game to the next: a seed lays the rivals out another way, moves the first club, and has
// the director and the capos come at other times. The same seed always plays the same game; no seed is the game the
// tests have always played.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../web/empire.js');

const play = (g, n) => { for (let i = 0; i < n; i++) { g.paused = false; E.tick(g); } return g; };
const rivals = (g) => E.view(g).cities.map((c) => c.places.filter((p) => p.owner !== 'family').map((p) => p.x + ',' + p.y + p.kind).sort().join(' '));
const story = (g) => g.journal.map((e) => e.month + ':' + e.label).join('\n');

test('the same seed plays the same game', () => {
  const a = play(E.createGame({ capo: 'sal', seed: 7 }), 300), b = play(E.createGame({ capo: 'sal', seed: 7 }), 300);
  assert.equal(story(a), story(b));
  assert.deepEqual(rivals(a), rivals(b));
});

test('no seed is the game that was always played, and a saved game keeps its seed', () => {
  const a = E.createGame({ capo: 'sal' }), b = E.createGame({ capo: 'sal', seed: 0 });
  assert.deepEqual(rivals(a), rivals(b));
  const g = E.createGame({ capo: 'sal', seed: 12 });
  assert.equal(E.load(E.save(g)).seed, 12);
});

test('another seed is another game: the rivals stand elsewhere, and the story is not the same', () => {
  const a = E.createGame({ capo: 'sal', seed: 1 }), b = E.createGame({ capo: 'sal', seed: 2 }), c = E.createGame({ capo: 'sal' });
  assert.notDeepEqual(rivals(a)[0], rivals(b)[0]);
  assert.notDeepEqual(rivals(a)[0], rivals(c)[0]);
  assert.notEqual(story(play(a, 600)), story(play(b, 600)));
});

test('the page gives the seed with the first order', () => {
  const g = E.createGame();
  E.command(g, { type: 'start', capo: 'mae', seed: 5 });
  assert.equal(g.seed, 5);
  assert.deepEqual(rivals(g), rivals(E.createGame({ capo: 'mae', seed: 5 })));
});

test('whatever the seed, the first man opens a place in his first sixty days and the game plays on', () => {
  [1, 2, 3, 4, 5, 6].forEach((seed) => ['sal', 'mae', 'dutch', 'tommy', 'vince', 'danny'].slice(seed % 2 ? 0 : 3, seed % 2 ? 3 : 6).forEach((capo) => {
    const g = play(E.createGame({ capo, seed }), 60);
    const k = E.view(g).cities[0].capos[0];
    assert.ok(k.places >= 1, capo + ' with seed ' + seed + ' runs ' + k.places);
    play(g, 400);
    assert.ok(E.view(g).cities[0].share.family > 0);
  }));
});
