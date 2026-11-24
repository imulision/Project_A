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

// A capo who is sent somewhere else while his car is still on the road does not jump back to where he set out from:
// the car drives on from where it is, to the end of the way it was on, then on to the new one.
test('a new trip of a car still on the road starts where the car is', async () => {
  const { goOn } = await import('../render/roads.mjs');
  const was = [[0, 0], [10, 0], [10, 10]], len = [10, 20];
  assert.deepEqual(goOn(was, len, 15, [10, 5], [[10, 10], [20, 10]]), [[10, 5], [10, 10], [20, 10]], 'half way down the second street, on to the new way');
  assert.deepEqual(goOn(was, len, 5, [5, 0], [[10, 10], [20, 10]]), [[5, 0], [10, 0], [10, 10], [20, 10]]);
  // the new way does not start where the old one ended: the car turns the corner to it, along the streets
  assert.deepEqual(goOn(was, len, 20, [10, 10], [[0, 20], [0, 30]]), [[10, 10], [10, 20], [0, 20], [0, 30]]);
  assert.deepEqual(goOn(was, len, 20, [10, 10], [[10, 10], [0, 10]]), [[10, 10], [0, 10]]);
});
