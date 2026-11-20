// The pace of the picture: never more than 60 images a second, whatever the screen.
const test = require('node:test');
const assert = require('node:assert/strict');

const run = async (hz, ms) => { const { due, CAP } = await import('../render/pace.mjs'); let last = -Infinity, drawn = 0; for (let i = 0; i < hz * ms / 1000; i++) { const t = i * 1000 / hz; if (due(t, last)) { drawn++; last = t; } } return { drawn, CAP }; };

test('a 120 Hz screen draws 60 images a second, a 60 Hz screen keeps its 60, a slow machine loses nothing', async () => {
  assert.equal((await run(120, 1000)).CAP, 60);
  assert.equal((await run(120, 1000)).drawn, 60);
  assert.equal((await run(60, 1000)).drawn, 60);
  assert.equal((await run(144, 1000)).drawn, 48, 'one image out of three on a 144 Hz screen: under the cap');
  assert.equal((await run(30, 1000)).drawn, 30);
  assert.equal((await run(2, 10000)).drawn, 20);
});

test('a screen whose beat wobbles by a millisecond around 60 Hz does not lose every other image', async () => {
  const { due } = await import('../render/pace.mjs');
  let last = -Infinity, drawn = 0, t = 0;
  for (let i = 0; i < 60; i++) { if (due(t, last)) { drawn++; last = t; } t += 1000 / 60 + (i % 2 ? 1 : -1); }
  assert.equal(drawn, 60);
});
