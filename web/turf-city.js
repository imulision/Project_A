// The city as one fabric of blocks.
//
// A block holds at most one place, and a place has one boss. Every place
// presses on the streets around it; where the family presses hardest the
// streets are its own, where a rival does they are his, and in between they
// are contested. Here: making a city, reading who holds what, opening a place.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var RULES = R.RULES, TERRAIN = R.TERRAIN, WORTH = R.WORTH, KINDS = R.KINDS, key = R.key, inside = R.inside, size = R.size, at = R.at, far = R.far;
  var KEYS = P.KEYS, PEOPLE = P.PEOPLE, who = P.who, SCHOOLS = P.SCHOOLS, schoolOf = P.schoolOf, sits = P.sits;

  function createCity(spec) {
    var voids = {};
    (spec.voids || []).forEach(function (v) { voids[key(v.x, v.y)] = v.kind; });
    return { id: spec.id, w: spec.w, h: spec.h, voids: voids, zones: spec.zones.map(function (z) {
      return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, traits: z.traits };
    }), blocks: {}, month: 0, rival: null, dice: 1, ops: [], asks: [], refused: {}, repelled: 0, burnt: 0, knocked: {}, grudge: {}, feuds: [], sulk: {}, jailed: [], quiet: 0, heat: 0, washed: 0, flow: null };
  }

  // A throw of the city's own dice: the same city always plays out the same way.
  function roll(c, n) {
    c.dice = (c.dice * 1103515245 + 12345) % 2147483648;
    return Math.floor(c.dice / 2147483648 * n);
  }

  // The rival family that was there first: n places scattered over the city.
  function seed(c, name, n) {
    c.rival = name;
    for (var placed = 0; placed < n;) {
      var x = roll(c, c.w), y = roll(c, c.h);
      if (!inside(c, x, y) || at(c, x, y)) continue;
      open(c, x, y, { owner: name, kind: bestKind(c, x, y) });
      placed += 1;
    }
    // its lieutenants share the places, from the west of the city to the east
    var men = lieutenantsOf(c), theirs = everyPlace(c).filter(function (p) { return p.owner === name && p.kind !== 'key'; });
    if (!men.length) return;
    theirs.sort(function (a, b) { return a.x - b.x || a.y - b.y; }).forEach(function (p, i) {
      at(c, p.x, p.y).man = men[Math.min(men.length - 1, Math.floor(i * men.length / theirs.length))];
    });
    changed(c);
  }

  // The lieutenants of the family in place in this city. A city nobody was written for borrows the family's first three.
  function lieutenantsOf(c) {
    var all = Object.keys(PEOPLE).filter(function (id) { return PEOPLE[id].lieutenant === c.rival; });
    var here = all.filter(function (id) { return PEOPLE[id].home === c.id; });
    return here.length ? here : all.filter(function (id) { return PEOPLE[id].home === PEOPLE[all[0]].home; });
  }

  // The key places go to whoever was there first: each on the street that suits it best, well apart from the others.
  function crown(c, name) {
    c.rival = name;
    Object.keys(KEYS).forEach(function (id) {
      var best = null, others = keys(c);
      for (var y = 1; y < c.h - 1; y++) for (var x = 1; x < c.w - 1; x++) {
        if (!inside(c, x, y) || at(c, x, y) || others.some(function (k) { return far(x, y, k.x, k.y) < 3; })) continue;
        var z = zoneOf(c, x, y), t = z.traits[KEYS[id].street];
        // the middle of the best street for it
        var mid = far(2 * x, 2 * y, z.x0 + z.x1, z.y0 + z.y1);
        if (!best || t > best.t || (t === best.t && mid < best.mid)) best = { x: x, y: y, t: t, mid: mid };
      }
      open(c, best.x, best.y, { owner: name, kind: 'key', key: id });
    });
  }

  function bestKind(c, x, y) {
    return KINDS.slice().sort(function (a, b) { return worth(c, x, y, b) * WORTH[b] - worth(c, x, y, a) * WORTH[a]; })[roll(c, 4)];
  }

  // Where a newcomer lands: the free block the rivals press on least.
  function landing(c) {
    var best = null;
    for (var y = 1; y < c.h - 1; y++) for (var x = 1; x < c.w - 1; x++) {
      if (!inside(c, x, y) || at(c, x, y)) continue;
      var r = hold(c, x, y).rival;
      if (!best || r < best.r) best = { x: x, y: y, r: r };
    }
    return best && { x: best.x, y: best.y };
  }

  function zoneOf(c, x, y) {
    for (var i = 0; i < c.zones.length; i++) {
      var z = c.zones[i];
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
    }
    return null;
  }

  // What is worked out once and kept until a place changes: the list of
  // places and how hard each side presses on every block. It lives beside the
  // city, never in it, so a saved game carries none of it. Whatever changes
  // c.blocks must call changed(c).
  var kept = new WeakMap();

  function changed(c) { kept.delete(c); }

  function memo(c) {
    var m = kept.get(c);
    if (m) return m;
    m = { family: new Float64Array(c.w * c.h), rival: new Float64Array(c.w * c.h) };
    m.places = Object.keys(c.blocks).map(function (k) {
      var p = c.blocks[k], xy = k.split(',');
      var out = { x: Number(xy[0]), y: Number(xy[1]), owner: p.owner, kind: p.kind, level: p.level, capo: p.capo, at: k };
      if (p.key) out.key = p.key;
      if (p.man) out.man = p.man;
      return out;
    });
    m.places.forEach(function (p) {
      var r = p.level + 1, side = p.owner === 'family' ? m.family : m.rival, press = RULES.press * p.level;
      for (var y = Math.max(0, p.y - r); y <= Math.min(c.h - 1, p.y + r); y++) {
        for (var x = Math.max(0, p.x - r); x <= Math.min(c.w - 1, p.x + r); x++) {
          side[y * c.w + x] += press / (1 + far(x, y, p.x, p.y));
        }
      }
    });
    kept.set(c, m);
    return m;
  }

  // The same list for the rules' own reading: no copies, never to be written to, and without the tills.
  function everyPlace(c) { return memo(c).places; }

  // Every place of the city, or only those a capo runs.
  function places(c, capo) {
    return memo(c).places.filter(function (p) { return capo === undefined || p.capo === capo; }).map(function (p) {
      var out = { x: p.x, y: p.y, owner: p.owner, kind: p.kind, level: p.level, capo: p.capo };
      var till = c.blocks[p.at].till;
      if (till) out.till = till;
      if (p.key) out.key = p.key;
      if (p.man) out.man = p.man;
      return out;
    });
  }

  // The businesses a capo runs. Kept until a place changes, and never to be written to.
  function run(c, capo) {
    var k = crowns(c);
    if (!k.run[capo]) k.run[capo] = memo(c).places.filter(function (p) { return p.capo === capo && p.kind !== 'club' && p.kind !== 'key'; });
    return k.run[capo];
  }

  // The key places of the city, and who holds each.
  function keys(c) {
    return everyPlace(c).filter(function (p) { return p.kind === 'key'; }).map(function (p) {
      return { key: p.key, name: KEYS[p.key].name, x: p.x, y: p.y, owner: p.owner, capo: p.capo, gives: KEYS[p.key].gives };
    });
  }

  // What the family's key places add up to, for one line of KEYS.
  // Both are asked for every place every month, so they are worked out once and kept with the rest of memo(c).
  function crowns(c) {
    var m = memo(c);
    if (!m.crowns) m.crowns = { list: m.places.filter(function (p) { return p.kind === 'key' && p.owner === 'family'; }), held: {}, lift: {}, club: {}, run: {} };
    return m.crowns;
  }

  function held(c, what) {
    var k = crowns(c);
    if (k.held[what] === undefined) k.held[what] = k.list.reduce(function (n, p) { return n + (KEYS[p.key][what] || 0); }, 0);
    return k.held[what];
  }

  function lift(c, kind) {
    var k = crowns(c);
    if (k.lift[kind] === undefined) {
      k.lift[kind] = k.list.reduce(function (n, p) { var l = KEYS[p.key].lifts; return n + (l && l.street === TERRAIN[kind] ? l.by : 0); }, 1);
    }
    return k.lift[kind];
  }

  function open(c, x, y, p) {
    if (!inside(c, x, y)) throw new Error(x + ',' + y + ' is outside ' + c.id);
    if (at(c, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (p.kind !== 'club' && p.kind !== 'key' && !TERRAIN[p.kind]) throw new Error('unknown kind of place: ' + p.kind);
    if (p.owner === 'family' && !who(p.capo)) throw new Error('a place of the family needs a capo');
    var b = { owner: p.owner, kind: p.kind, level: p.level || 1, capo: p.owner === 'family' ? p.capo : null };
    if (p.kind === 'key') {
      if (!KEYS[p.key]) throw new Error('unknown key place: ' + p.key);
      if (keys(c).some(function (k) { return k.key === p.key; })) throw new Error(c.id + ' already has its ' + KEYS[p.key].name);
      b.key = p.key;
      b.level = RULES.keyLevel;
    }
    c.blocks[key(x, y)] = b;
    changed(c);
  }

  // A capo arrives: his social club is his base, and where he is found.
  function clubOf(c, capo) {
    var k = crowns(c);
    if (k.club[capo] === undefined) k.club[capo] = memo(c).places.filter(function (p) { return p.kind === 'club' && p.capo === capo; })[0] || null;
    var club = k.club[capo];
    return club ? { x: club.x, y: club.y } : null;
  }

  function settle(c, capo, x, y) {
    if (clubOf(c, capo)) throw new Error(capo + ' already has a club in ' + c.id);
    open(c, x, y, { owner: 'family', kind: 'club', capo: capo, level: RULES.clubLevel });
  }

  // How hard the family and its rivals press on one block.
  function hold(c, x, y) {
    var m = memo(c), i = y * c.w + x;
    return inside(c, x, y) ? { family: m.family[i], rival: m.rival[i] } : { family: 0, rival: 0 };
  }

  // Whose streets a block is: 'family', 'rival', 'contested', or null when nobody holds it.
  function grip(c, x, y) {
    var h = hold(c, x, y);
    if (Math.max(h.family, h.rival) < RULES.minHold) return null;
    if (h.family >= h.rival * RULES.edge) return 'family';
    if (h.rival >= h.family * RULES.edge) return 'rival';
    return 'contested';
  }

  // The city in hundredths: what the family holds, what its rivals hold, what is fought over, what is nobody's.
  function share(c) {
    var n = { family: 0, rival: 0, contested: 0, free: 0 };
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) if (inside(c, x, y)) n[grip(c, x, y) || 'free'] += 1;
    Object.keys(n).forEach(function (k) { n[k] = n[k] * 100 / size(c); });
    return n;
  }

  // The free blocks a capo can open on: streets the family holds, close to a place he runs.
  function frontier(c, capo) {
    var mine = everyPlace(c).filter(function (p) { return p.capo === capo; }), out = [];
    if (!mine.length) return out;
    for (var y = 0; y < c.h; y++) {
      for (var x = 0; x < c.w; x++) {
        if (at(c, x, y) || grip(c, x, y) !== 'family') continue;
        if (mine.some(function (p) { return far(x, y, p.x, p.y) <= RULES.near; })) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function price(c, capo, kind) {
    return Math.round(D.SITES[kind].cost * Math.pow(1 + RULES.dearer, run(c, capo).length) * (1 - held(c, 'cheaper')));
  }

  // The place a capo's whole trade is built on: the first kind of place he likes.
  function tradeOf(capo) {
    return who(capo).likes.filter(function (k) { return TERRAIN[k]; })[0] || null;
  }

  function worth(c, x, y, kind) { return 0.4 + 0.6 * zoneOf(c, x, y).traits[TERRAIN[kind]]; }

  function taste(capo, kind) {
    return kind === tradeOf(capo) ? RULES.trade : who(capo).likes.indexOf(kind) >= 0 ? RULES.likes : 1;
  }

  // The city remembers what its men know, so that every rule can ask without the family at hand.
  function learnt(c, f) {
    var book = sits(f, 'bookkeeper'), fix = sits(f, 'fixer');
    c.board = { wash: book ? 1 + RULES.table.wash * who(book).business : 1, cools: fix ? Math.floor(who(fix).charisma / RULES.table.charisma) : 0 };
    c.skills = {};
    Object.keys(f.men || {}).forEach(function (capo) {
      var rank = f.men[capo].rank || 0, list = SCHOOLS[schoolOf(capo)];
      for (var i = 0; i < rank && i < list.length; i++) (c.skills[capo] = c.skills[capo] || {})[list[i].id] = true;
    });
  }

  function others(c, f, capo) { return Object.keys(f.men).filter(function (id) { return id !== capo && clubOf(c, id); }); }

  var api = { learnt: learnt, createCity: createCity, seed: seed, lieutenantsOf: lieutenantsOf, crown: crown, bestKind: bestKind, landing: landing,
      zoneOf: zoneOf, changed: changed, memo: memo, everyPlace: everyPlace, places: places, run: run, keys: keys, held: held, lift: lift, open: open,
      clubOf: clubOf, settle: settle, hold: hold, grip: grip, share: share, frontier: frontier, price: price, tradeOf: tradeOf, worth: worth,
      taste: taste, others: others };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfCity = api;
})(typeof self !== 'undefined' ? self : this);
