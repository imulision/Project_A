// The way between two cities that share no road: by the roads through the cities in between, never across the land.
const test = require('node:test');
const assert = require('node:assert/strict');

const ROADS = [{ a: 0, b: 1, pts: [[0, 0], [5, 0], [10, 0]] }, { a: 2, b: 1, pts: [[10, 10], [10, 5], [10, 0]] }, { a: 2, b: 3, pts: [[10, 10], [20, 10]] }];

test('two neighbours are joined by their road, in the direction of the trip', async () => {
  const { roadWay } = await import('../render/roads.mjs');
  assert.deepEqual(roadWay(ROADS, 0, 1), [[0, 0], [5, 0], [10, 0]]);
  assert.deepEqual(roadWay(ROADS, 1, 0), [[10, 0], [5, 0], [0, 0]]);
});

test('two cities with no road between them are joined through the cities on the way', async () => {
  const { roadWay } = await import('../render/roads.mjs');
  assert.deepEqual(roadWay(ROADS, 0, 3), [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [20, 10]]);
  assert.deepEqual(roadWay(ROADS, 3, 0), [[20, 10], [10, 10], [10, 5], [10, 0], [5, 0], [0, 0]]);
});

test('a city no road reaches has no way', async () => {
  const { roadWay } = await import('../render/roads.mjs');
  assert.equal(roadWay(ROADS, 0, 7), null);
});
