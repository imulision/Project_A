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

  // A city is a rectangle of blocks. Each block is on a street name (a zone): either the zones are plain rectangles (x0, y0, x1, y1),
  // or `streets` says, block by block and row after row, which zone it is on, and a zone can then be any shape.
  function createCity(spec) {
    var voids = {}, streets = spec.streets ? spec.streets.slice() : null;
    (spec.voids || []).forEach(function (v) { voids[key(v.x, v.y)] = v.kind; });
    var zones = spec.zones.map(function (z) { return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, traits: z.traits }; });
    if (streets) {
      if (streets.length !== spec.w * spec.h) throw new Error(spec.id + ': ' + spec.w * spec.h + ' blocks, ' + streets.length + ' street names');
      // the box each street name fits in
      zones.forEach(function (z) { z.x0 = spec.w; z.y0 = spec.h; z.x1 = -1; z.y1 = -1; });
      streets.forEach(function (n, i) {
        var z = zones[n], x = i % spec.w, y = Math.floor(i / spec.w);
        if (!z) throw new Error(spec.id + ': no street name ' + n);
        z.x0 = Math.min(z.x0, x); z.x1 = Math.max(z.x1, x); z.y0 = Math.min(z.y0, y); z.y1 = Math.max(z.y1, y);
      });
    }
    var c = { id: spec.id, name: spec.name || town({ id: spec.id }), w: spec.w, h: spec.h, voids: voids, zones: zones, blocks: {}, month: 0, rival: null, dice: 1, ops: [], asks: [], refused: {}, repelled: 0, burnt: 0, knocked: {}, grudge: {}, feuds: [], sulk: {}, jailed: [], quiet: 0, heat: 0, washed: 0, flow: null };
    if (streets) c.streets = streets;
    return c;
  }

  // The name of a city as the player reads it (a city saved before it had one is called by its id, with a capital).
  function town(c) { return c.name || String(c.id).charAt(0).toUpperCase() + String(c.id).slice(1); }

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
    var men = lieutenantsOf(c), theirs = everyPlace(c).filter(function (p) { return p.owner === name && p.kind !== 'key' && p.kind !== 'hq'; });
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
  // Where the family starts: the free block where the rivals weigh least on every block within `RULES.room.wide` of it
  // (a block outside the city, or one of their places, counts as a wall). Never in a corner, whatever the deal.
  function homeStreet(c) {
    var K = RULES.room, wall = 2 * RULES.press, best = null;
    for (var y = 1; y < c.h - 1; y++) for (var x = 1; x < c.w - 1; x++) {
      if (!inside(c, x, y) || at(c, x, y)) continue;
      var r = 0;
      for (var wy = -K.wide; wy <= K.wide; wy++) for (var wx = -K.wide; wx <= K.wide; wx++) {
        var qx = x + wx, qy = y + wy, b = inside(c, qx, qy) ? at(c, qx, qy) : null;
        r += !inside(c, qx, qy) ? wall : b && b.owner !== 'family' ? wall : hold(c, qx, qy).rival;
      }
      if (!best || r < best.r) best = { x: x, y: y, r: r };
    }
    return best && { x: best.x, y: best.y };
  }
  // The family's first street is its own: the rivals' places within `RULES.room.clear` of it are gone before the first
  // day (key places and headquarters stay). Whatever the deal, the first man has streets to open on.
  function clearing(c, x, y) {
    var gone = 0;
    everyPlace(c).forEach(function (p) {
      if (p.owner === 'family' || p.kind === 'key' || p.kind === 'hq' || far(x, y, p.x, p.y) > RULES.room.clear) return;
      delete c.blocks[key(p.x, p.y)]; gone += 1;
    });
    if (gone) changed(c);
    return gone;
  }

  // The street name a block is on: its number, then the zone itself.
  function zoneAt(c, x, y) {
    if (x < 0 || y < 0 || x >= c.w || y >= c.h) return -1;
    if (c.streets) return c.streets[y * c.w + x];
    for (var i = 0; i < c.zones.length; i++) {
      var z = c.zones[i];
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return i;
    }
    return -1;
  }
  function zoneOf(c, x, y) { return c.zones[zoneAt(c, x, y)] || null; }

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
      if (p.kind === 'hq') out.stage = c.blocks[p.at].stage || 1;
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
      // `around` of the `need` family places a capo wants near it before he asks the boss for it
      var around = p.owner === 'family' ? 0 : everyPlace(c).filter(function (q) { return q.owner === 'family' && far(p.x, p.y, q.x, q.y) <= RULES.near; }).length;
      return { key: p.key, name: KEYS[p.key].name, x: p.x, y: p.y, owner: p.owner, capo: p.capo, gives: KEYS[p.key].gives, around: around, need: RULES.siege };
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
    if (!inside(c, x, y)) throw new Error(x + ',' + y + ' is outside ' + town(c));
    if (at(c, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (p.kind !== 'club' && p.kind !== 'key' && p.kind !== 'hq' && !TERRAIN[p.kind]) throw new Error('unknown kind of place: ' + p.kind);
    if (p.owner === 'family' && p.kind !== 'hq' && !who(p.capo)) throw new Error('a place of the family needs a capo');
    var b = { owner: p.owner, kind: p.kind, level: p.level || 1, capo: p.owner === 'family' ? p.capo : null };
    if (p.kind === 'key') {
      if (!KEYS[p.key]) throw new Error('unknown key place: ' + p.key);
      if (keys(c).some(function (k) { return k.key === p.key; })) throw new Error(town(c) + ' already has its ' + KEYS[p.key].name);
      b.key = p.key;
      b.level = RULES.keyLevel;
    }
    c.blocks[key(x, y)] = b;
    changed(c);
  }

  // A capo arrives: his social club is his base, and where he is found.
  // Where the boss's money is in this city: in his own purse at home, in the city's coffer anywhere else. What is in
  // a coffer is his only once a car has brought it home by road (empire.js drives it).
  function purse(c, f) {
    if (!c.away) return f;
    if (!c.coffer) c.coffer = { dirty: 0, clean: 0 };
    return c.coffer;
  }
  function clubOf(c, capo) {
    var k = crowns(c);
    if (k.club[capo] === undefined) k.club[capo] = memo(c).places.filter(function (p) { return p.kind === 'club' && p.capo === capo; })[0] || null;
    var club = k.club[capo];
    return club ? { x: club.x, y: club.y } : null;
  }

  function settle(c, capo, x, y) {
    if (clubOf(c, capo)) throw new Error(capo + ' already has a club in ' + town(c));
    open(c, x, y, { owner: 'family', kind: 'club', capo: capo, level: RULES.clubLevel });
  }

  // --- headquarters ---
  // The family's in a city, or the rivals' ('rival' or their name). Nobody runs it and nobody places it by hand.
  function hqOf(c, owner) {
    var ours = owner === 'family', p = memo(c).places.filter(function (q) { return q.kind === 'hq' && (q.owner === 'family') === ours; })[0];
    return p ? { x: p.x, y: p.y, owner: p.owner, kind: 'hq', level: p.level, stage: c.blocks[p.at].stage || 1 } : null;
  }
  // It goes up by itself: the family's on the free block nearest its first club, the rivals' where they press hardest.
  function raiseHq(c, owner) {
    var ours = owner === 'family', has = hqOf(c, owner);
    if (has) return has;
    var first = ours ? memo(c).places.filter(function (q) { return q.owner === 'family' && q.kind === 'club'; })[0] : null, best = null;
    if (ours && !first) throw new Error('the family has no club in ' + town(c));
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      if (!inside(c, x, y) || at(c, x, y)) continue;
      var score = ours ? -far(x, y, first.x, first.y) * 1000 - hold(c, x, y).rival : hold(c, x, y).rival;
      if (!best || score > best.score) best = { x: x, y: y, score: score };
    }
    if (!best) return null;
    c.blocks[key(best.x, best.y)] = { owner: owner, kind: 'hq', level: RULES.hq.level, capo: null, stage: 1 };
    changed(c);
    return hqOf(c, owner);
  }
  function hqStage(share) { var n = 1; RULES.hq.stages.forEach(function (from, i) { if (share >= from) n = i + 1; }); return n; }
  function sizeHq(c, owner, stage) {
    var p = hqOf(c, owner);
    if (p) c.blocks[key(p.x, p.y)].stage = Math.max(1, Math.min(4, stage));
  }
  function razeHq(c, owner) {
    var p = hqOf(c, owner);
    if (p) { delete c.blocks[key(p.x, p.y)]; changed(c); }
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

  // The streets a move would bring to the family: the blocks that are not its own today and would be once the place
  // stands (opened, taken from a rival, or made one level bigger). Nothing is changed in the city.
  function gains(c, move) {
    if (!move || ['open', 'take', 'enlarge'].indexOf(move.move) < 0) return [];
    var m = memo(c), was = at(c, move.x, move.y), out = [];
    var level = move.move === 'enlarge' ? (was ? was.level : 1) + 1 : 1, r = Math.max(level, was ? was.level : 0) + 1;
    var reach = function (lv, x, y) { return lv && Math.abs(x - move.x) <= lv + 1 && Math.abs(y - move.y) <= lv + 1 ? RULES.press * lv / (1 + far(x, y, move.x, move.y)) : 0; };
    for (var y = Math.max(0, move.y - r); y <= Math.min(c.h - 1, move.y + r); y++) {
      for (var x = Math.max(0, move.x - r); x <= Math.min(c.w - 1, move.x + r); x++) {
        if (!inside(c, x, y) || (c.voids && c.voids[key(x, y)]) || grip(c, x, y) === 'family') continue;
        var i = y * c.w + x, old = was ? reach(was.level, x, y) : 0;
        var family = m.family[i] + reach(level, x, y) - (was && was.owner === 'family' ? old : 0), rival = m.rival[i] - (was && was.owner !== 'family' ? old : 0);
        if (Math.max(family, rival) >= RULES.minHold && family >= rival * RULES.edge) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  // The city in hundredths: what the family holds, what its rivals hold, what is fought over, what is nobody's.
  // (worked out once and kept with the other figures of the memo, until a place changes)
  function share(c) {
    var m = memo(c), n = m.share;
    if (!n) {
      n = { family: 0, rival: 0, contested: 0, free: 0 };
      for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) if (inside(c, x, y)) n[grip(c, x, y) || 'free'] += 1;
      Object.keys(n).forEach(function (k) { n[k] = n[k] * 100 / size(c); });
      m.share = n;
    }
    return { family: n.family, rival: n.rival, contested: n.contested, free: n.free };
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

  var api = { town: town, purse: purse, learnt: learnt, createCity: createCity, seed: seed, lieutenantsOf: lieutenantsOf, crown: crown, bestKind: bestKind, landing: landing, homeStreet: homeStreet, clearing: clearing,
      zoneOf: zoneOf, zoneAt: zoneAt, changed: changed, memo: memo, everyPlace: everyPlace, places: places, run: run, keys: keys, held: held, lift: lift, open: open,
      hqOf: hqOf, raiseHq: raiseHq, hqStage: hqStage, sizeHq: sizeHq, razeHq: razeHq, clubOf: clubOf, settle: settle, hold: hold, grip: grip, gains: gains, share: share, frontier: frontier, price: price, tradeOf: tradeOf, worth: worth,
      taste: taste, others: others };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfCity = api;
})(typeof self !== 'undefined' ? self : this);
