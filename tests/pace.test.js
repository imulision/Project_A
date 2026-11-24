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

// A pacer keeps the time of the next image due, so a 90 Hz screen (every 11 ms) draws two images out of three
// and still reaches 60, where "16 ms since the last image" would draw one out of two: 45.
const runPacer = async (hz, ms, wobble = 0) => { const { pacer } = await import('../render/pace.mjs'); const due = pacer(); let drawn = 0; for (let i = 0; i < hz * ms / 1000; i++) if (due(i * 1000 / hz + (i % 2 ? wobble : -wobble))) drawn++; return drawn; };

test('the pacer gives 60 images a second on a 90, 120 or 144 Hz screen, and every image on a 60 or 30 Hz one', async () => {
  const perSecond = async (hz, wobble) => Math.round(await runPacer(hz, 10000, wobble) / 10);      /* over ten seconds: the edge of a window adds an image */
  assert.equal(await perSecond(90), 60);
  assert.equal(await perSecond(120), 60);
  assert.equal(await perSecond(144), 60);
  assert.equal(await perSecond(60, 1), 60);
  assert.equal(await perSecond(30), 30);
});

test('after a long stall the pacer does not draw a burst of images to catch up', async () => {
  const { pacer } = await import('../render/pace.mjs'); const due = pacer();
  for (let t = 0; t < 100; t += 1000 / 120) due(t);
  let drawn = 0; for (let t = 600; t < 650; t += 1000 / 120) if (due(t)) drawn++;
  assert.ok(drawn <= 4, 'about three images in 50 ms, not thirty: ' + drawn);
});

// The resolution follows the phone: down a step when it has been slow for a while, back up when it has been
// at ease for a while, never under a floor that would look pixelated, and not straight back to a step that was slow.
test('the resolution drops a step after three slow seconds, and only then', async () => {
  const { quality } = await import('../render/pace.mjs'); let q = quality.start(2);
  q = quality.tick(q, 35, 1000); q = quality.tick(q, 35, 2000); assert.equal(q.pr, 2);
  q = quality.tick(q, 35, 3000); assert.equal(q.pr, 1.75);
});

test('a single slow second (a city being built) changes nothing', async () => {
  const { quality } = await import('../render/pace.mjs'); let q = quality.start(2);
  for (let s = 1; s <= 20; s++) q = quality.tick(q, s % 3 ? 58 : 20, s * 1000);
  assert.equal(q.pr, 2);
});

test('the resolution never goes under the floor, however slow the phone', async () => {
  const { quality, FLOOR } = await import('../render/pace.mjs'); let q = quality.start(2);
  for (let s = 1; s <= 100; s++) q = quality.tick(q, 20, s * 1000);
  assert.equal(q.pr, FLOOR); assert.ok(FLOOR >= 1.5);
  q = quality.start(1); for (let s = 1; s <= 10; s++) q = quality.tick(q, 20, s * 1000);
  assert.equal(q.pr, 1, 'a screen that starts under the floor stays as it is');
});

test('the resolution climbs back when the phone is at ease again, but not to a step that was just too slow', async () => {
  const { quality } = await import('../render/pace.mjs'); let q = quality.start(2), s = 0;
  for (; s < 3; s++) q = quality.tick(q, 35, s * 1000 + 1000);
  assert.equal(q.pr, 1.75);
  for (; s < 30; s++) q = quality.tick(q, 60, s * 1000 + 1000);
  assert.equal(q.pr, 1.75, 'two was slow a moment ago: stay a step under it');
  for (; s < 200; s++) q = quality.tick(q, 60, s * 1000 + 1000);
  assert.equal(q.pr, 2, 'a few minutes later, two is tried again');
});

test('down to the floor, the resolution climbs back step by step', async () => {
  const { quality, FLOOR } = await import('../render/pace.mjs'); let q = quality.start(2), s = 1;
  for (; s < 40; s++) q = quality.tick(q, 20, s * 1000);
  assert.equal(q.pr, FLOOR);
  for (; s < 400; s++) q = quality.tick(q, 60, s * 1000);
  assert.equal(q.pr, 2);
});
