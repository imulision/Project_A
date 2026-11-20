// The page has no `require`: every rules file hangs its part on the window,
// and index.html must give them in an order where each finds what it needs.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..', 'web');
const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="\.\/([\w.-]+)"><\/script>/g)].map(m => m[1]);

test('the rules load in a page, in the order index.html gives them', () => {
  const upTo = scripts.indexOf('empire.js');
  assert.ok(upTo > 0, 'index.html loads empire.js');
  const page = vm.createContext({});
  page.self = page;
  scripts.slice(0, upTo + 1).forEach(f => vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), page, { filename: f }));
  const g = page.AshportEmpire.createGame({ capo: 'dutch' });
  assert.ok(page.AshportEmpire.view(g), 'the game the page would play gives a view');
  assert.strictEqual(typeof page.AshportTurf.stepMonth, 'function');
});

test('the loading bar counts every file the page reads', () => {
  const said = Number(/var FILES = (\d+)/.exec(html)[1]);
  const counted = (html.match(/AshportLoad\.file\(\)<\/script>/g) || []).length;
  assert.strictEqual(counted, scripts.length - 1, 'every script but the last is followed by a step of the bar');
  assert.strictEqual(said, scripts.length, 'the last file, city.js, counts itself');
});

test('every turf file is in the page', () => {
  fs.readdirSync(WEB).filter(f => /^turf.*\.js$/.test(f)).forEach(f => assert.ok(scripts.includes(f), f + ' is missing from index.html'));
});
