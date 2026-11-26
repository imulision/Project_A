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

// The days the cars drive by. Frames slower than a twentieth of a second, or a page left in the background, used to leave the cars
// behind the rules: a place opened before its capo was seen there, and his next trip was driven twice as fast to make up.
test('the streets keep the days of the rules: behind after slow frames, they are back on the day at the next beat', async () => {
  const { streetClock } = await import('../render/pace.mjs');
  const c = streetClock(); c.beat(10, 1);
  for (let i = 0; i < 20; i++) c.frame(0.05, 1);      // one second of time at 1x, but drawn in slow frames that only count 0.05 s each
  assert.equal(c.now(), 11, 'a day in a second');
  c.beat(11, 1); for (let i = 0; i < 4; i++) c.frame(0.05, 1);      // a second of time that the frames counted as a fifth of it
  assert.ok(Math.abs(c.now() - 11.2) < 1e-9);
  c.beat(12, 1); assert.ok(Math.abs(c.now() - 11.2) < 1e-9, 'no jump at the beat: a car left behind by a few frames is not thrown forward');
  for (let i = 0; i < 60; i++) c.frame(1 / 60, 1);      // one smooth second after it
  assert.ok(Math.abs(c.now() - 13) < 0.02, 'it has made up the gap within the second, driving a little faster (' + c.now() + ')');
  let step = 0, was = c.now(); c.beat(13, 1); for (let i = 0; i < 60; i++) { c.frame(1 / 60, 1); step = Math.max(step, c.now() - was); was = c.now(); }
  assert.ok(step < 2.5 / 60, 'never more than two and a half frames of road in one frame (' + (step * 60).toFixed(2) + ')');
  c.beat(40, 1); assert.equal(c.now(), 40, 'back from the background: where the rules are');
});
test('the streets never run ahead of the rules: while the clock waits (a sheet open), the cars wait at the end of the beat', async () => {
  const { streetClock } = await import('../render/pace.mjs');
  const c = streetClock(); c.beat(5, 4);      // a beat of four days at 4x
  for (let i = 0; i < 200; i++) c.frame(0.05, 4);
  assert.equal(c.now(), 9, 'no further than the four days of the beat');
  for (let i = 0; i < 200; i++) c.frame(0.05, 4, true);
  assert.ok(Math.abs(c.now() - 49) < 1e-6, 'unless asked to run free (a test that drives the streets by hand)');
  c.beat(9, 4); assert.ok(c.now() > 48.9, 'a clock run free is not sent back');
  c.beat(0, 1); assert.equal(c.now(), 0, 'a new game starts its streets on its first day'); c.frame(0.5, 1); assert.equal(c.now(), 0.5);
});
