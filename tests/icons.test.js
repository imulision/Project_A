// The pictures of the screen: icons, portraits, small curves and round gauges, all as SVG text.
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../web/icons.js');
const D = require('../web/district.js');

test('every place, stat, cargo and move the rules know has its icon', () => {
  const names = Object.keys(D.SITES).concat(['muscle', 'business', 'cunning', 'charisma', 'loyalty', 'ambition'],
    ['protection', 'seize', 'push', 'bribe'], ['liquor', 'takings', 'laundering', 'tribute', 'works', 'streets', 'collection', 'seizure', 'raid', 'attack', 'hit', 'kidnap'],
    ['dirty', 'clean', 'men', 'heat', 'goodwill', 'truck', 'car', 'police']);
  names.forEach((n) => { assert.ok(I.has(n), 'no icon for ' + n); assert.match(I.icon(n), /^<svg[^>]*class="ic"/); });
});

test('an unknown name still draws something, so a new rule never breaks the screen', () => {
  assert.equal(I.has('zeppelin'), false);
  assert.match(I.icon('zeppelin'), /^<svg/);
});

test('every capo has his own face', () => {
  const faces = Object.keys(D.CAPOS).map((id) => I.portrait(id));
  faces.forEach((f) => assert.match(f, /^<svg[^>]*class="face"/));
  assert.equal(new Set(faces).size, faces.length);
  assert.match(I.portrait('nobody-we-know'), /^<svg/);
});

test('a curve has one point per month and says which way it goes', () => {
  const up = I.spark([1, 2, 4, 8]), down = I.spark([8, 4, 2, 1]), flat = I.spark([3, 3, 3]);
  assert.equal(up.match(/points="([^"]*)"/)[1].trim().split(' ').length, 4);
  assert.match(up, /class="spark up"/); assert.match(down, /class="spark down"/); assert.match(flat, /class="spark flat"/);
  assert.match(I.spark([5]), /class="spark flat"/, 'one month is not yet a trend');
  assert.match(I.spark([]), /^<svg/);
});

test('for a figure where less is better, going down is good news', () => {
  assert.match(I.spark([8, 4, 2, 1], { lessIsBetter: true }), /class="spark up"/);
});

test('a round gauge fills with the part done, and never past full', () => {
  const dash = (s) => +s.match(/stroke-dasharray="([\d.]+)/)[1];
  assert.equal(dash(I.ring(0)), 0);
  assert.ok(dash(I.ring(0.5)) > 0 && dash(I.ring(0.5)) < dash(I.ring(1)));
  assert.equal(dash(I.ring(3)), dash(I.ring(1)));
});

test('a bar of pips shows a stat out of ten', () => {
  assert.equal((I.pips(7, 10).match(/class="on"/g) || []).length, 7);
});

test('everybody the rules can name has a face of his own, never the stranger in the hat', () => {
  const T = require('../web/turf.js');
  const strip = (svg) => svg.replace(/id="[^"]+"|url\(#[^)]+\)/g, '');      // the drawing without its own name in it
  const stranger = strip(I.portrait('nobody-we-know')), seen = new Map();
  for (const id of Object.keys(T.PEOPLE).concat(Object.keys(D.CAPOS))) {
    const face = strip(I.portrait(id));
    assert.notEqual(face, stranger, id + ' has no face');
    if (seen.has(face) && seen.get(face) !== id) assert.fail(id + ' has the face of ' + seen.get(face));
    seen.set(face, id);
  }
});
