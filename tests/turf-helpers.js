// What the tests of the city game share: towns ready to play and the small moves the tests repeat.
const T = require('../web/turf.js');
const D = require('../web/district.js');

// A small town: the west is where people go out at night, the east is factories and a port.
const town = () => T.createCity({ id: 'town', w: 12, h: 6, zones: [
  { name: 'Lantern Row', x0: 0, y0: 0, x1: 5, y1: 5, traits: { nightlife: 1.5, industry: 0.3, port: 0, wealth: 1 } },
  { name: 'The Works', x0: 6, y0: 0, x1: 11, y1: 5, traits: { nightlife: 0.3, industry: 1.5, port: 1.2, wealth: 0.4 } },
] });

const ALL = () => { const t = {}; for (const k of Object.keys(D.SITES)) t[k] = 3; return t; };

const year = (c, f, n = 12) => { const out = []; for (let i = 0; i < n; i++) out.push(...T.stepMonth(c, f)); return out; };

const family = (more) => Object.assign({ tech: ALL(), men: {}, dirty: 0 }, more);

const ashport = () => T.createCity({ id: 'ashport', w: 20, h: 12, zones: [
  ['Uptown', 1.2, 0, 0, 1.5], ['Hillside', 1, 0.4, 0, 1.2], ['Market Street', 1.5, 0.5, 0, 1], ['Union Station', 0.8, 1, 0.8, 0.8],
  ['Little Calabria', 1.2, 0.5, 0, 0.5], ['Canal Street', 1, 1, 0.8, 0.5], ['Stockyards', 0.5, 1.5, 0.5, 0.5], ['The Docks', 0.8, 1.2, 1.5, 0.5],
].map((z, i) => ({ name: z[0], x0: (i % 4) * 5, y0: Math.floor(i / 4) * 6, x1: (i % 4) * 5 + 4, y1: Math.floor(i / 4) * 6 + 5,
                   traits: { nightlife: z[1], industry: z[2], port: z[3], wealth: z[4] } })) });

const rivals = (c) => T.places(c).filter((p) => p.owner !== 'family');


// Sal with three places around the Callahans' brewery, and a boss with money.
const siege = () => {
  const c = town(), f = family();
  f.dirty = 20000;
  T.settle(c, 'sal', 8, 3);
  T.join(f, 'sal');
  T.open(c, 10, 3, { owner: 'Callahan', kind: 'key', key: 'brewery' });
  T.open(c, 9, 2, { owner: 'family', kind: 'loans', capo: 'sal' });
  return { c, f };
};


const rich = () => family({ dirty: 20000 });

const coming = (c, f) => T.doors(c, f).map((d) => d.capo).sort();


// Mae with her club and one front on the best street for it, and a family that opens nothing new.
const laundry = (level) => {
  const c = town(), f = family({ tech: {}, clean: 0 });
  T.settle(c, 'mae', 2, 2); T.join(f, 'mae').cash = 0;
  if (level) T.open(c, 3, 2, { owner: 'family', kind: 'front', capo: 'mae', level });
  return { c, f };
};

const kinds = (c, capo) => T.places(c, capo).filter((p) => p.kind !== 'club').map((p) => p.kind + p.level).sort();

// Dutch with his club and six big bars that together make more than two cars can carry in a month.
const LOAD = T.RULES.car.load, RUNS = T.RULES.car.runs;

// A capo who waits for the boss's word in front of a key place lends no hand to his own places.
const kept = (c, capo) => c.asks.push({ id: 'town:port', capo, key: 'port', x: 11, y: 5, way: 'buy', cost: 1e9, months: 1, why: 'kept busy' });

const sixBars = (free) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  if (!free) kept(c, 'dutch');
  for (const [x, y] of [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]]) T.open(c, x, y, { owner: 'family', kind: 'gambling', capo: 'dutch', level: 3 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0; // nothing to open or enlarge: only the money moves
  return { c, f };
};

const whereIs = (c, f, id) => T.view(c, f).capos.find((k) => k.id === id).at;

const brewer = (bars, more) => {
  const c = town(), f = family();
  T.settle(c, 'dutch', 2, 2); T.join(f, 'dutch');
  kept(c, 'dutch');
  T.open(c, 8, 2, Object.assign({ owner: 'family', kind: 'still', capo: 'dutch' }, more));
  [[1, 1], [2, 1], [3, 1], [1, 3], [2, 3], [3, 3]].slice(0, bars).forEach(([x, y]) => T.open(c, x, y, { owner: 'family', kind: 'speakeasy', capo: 'dutch' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

const placeAt = (c, f, x, y) => T.view(c, f).places.find((p) => p.x === x && p.y === y);

const hauls = (c, f) => T.trips(c, f).filter((t) => t.kind === 'liquor');

const weed = (c, f) => T.trips(c, f).filter((t) => t.cargo === 'weed');

const exposed = (capo, kind, more) => {
  const c = town(), f = family();
  T.settle(c, capo, 3, 3); T.join(f, capo);
  kept(c, capo);
  T.open(c, 5, 3, Object.assign({ owner: 'family', kind: kind || 'gambling', capo }, more));
  T.open(c, 7, 3, { owner: 'Callahan', kind: 'speakeasy', level: 3 });
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { c, f };
};

const until = (c, f, type, months) => { for (let m = 0; m < months; m++) { const e = T.stepMonth(c, f).find((x) => x.type === type); if (e) return e; } return null; };

const twoTowns = (bars) => {
  const a = town(), b = town(), f = family();
  b.id = 'next';
  T.settle(a, 'dutch', 2, 2); T.join(f, 'dutch'); kept(a, 'dutch');
  T.open(a, 8, 2, { owner: 'family', kind: 'still', capo: 'dutch' });
  T.settle(b, 'mae', 2, 2); T.join(f, 'mae'); kept(b, 'mae');
  [[1, 1], [2, 1], [3, 1]].slice(0, bars).forEach(([x, y]) => T.open(b, x, y, { owner: 'family', kind: 'speakeasy', capo: 'mae' }));
  for (const k of Object.keys(f.tech)) f.tech[k] = 0;
  return { a, b, f };
};

const ROAD = [{ from: 'town', to: 'next' }];

module.exports = { town, ALL, year, family, ashport, rivals, siege, rich, coming, laundry, kinds, LOAD, RUNS, kept, sixBars, whereIs, brewer,
  placeAt, hauls, weed, exposed, until, twoTowns, ROAD };
