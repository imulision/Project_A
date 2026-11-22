// What the 3D map has to draw, worked out from the state of the game.
//
// planEmpire(view, where) turns AshportEmpire.view(g) into cities made of blocks and lots, each lot with the
// building that stands on it. tripsTurf(plan, view) turns the trips of the rules into cars with a route along
// the streets. effectsTurf(events, plan) turns what happened in a month into fire, gunfire and police lights.
// Nothing is drawn here and nothing is random: the same state always gives
// the same map, so the renderer only rebuilds a city when its key changes.
(function (root) {
  'use strict';

  var LOW = ['era_row3', 'era_shop2', 'era_tenement4', 'era_tenement4b', 'era_warehouse', 'era_works'];
  var MID = ['era_tenement5', 'era_tenement6', 'era_hotel6', 'era_corner5'];
  var HIGH = ['era_office8', 'era_hotel9', 'era_deco11'];
  var MODELS = LOW.concat(MID, HIGH);
  var TINTS = 6;

  // What each kind of place looks like from the street.
  var SITES = {
    still: { model: 'era_works', sign: 'ICE & COAL', color: '#ffe9b0' },
    speakeasy: { model: 'era_tenement4', sign: 'THE BLUE DOOR', color: '#7fd0ff' },
    gambling: { model: 'era_hotel6', sign: 'ROYALE', color: '#ff8a7a' },
    loft: { model: 'era_tenement4b', sign: 'ROOMS', color: '#b9f0a0' },
    rented: { model: 'era_shop2', sign: 'LAUNDRY', color: '#ffe9b0' },
    front: { model: 'era_corner5', sign: 'IMPORT CO.', color: '#ffcf6b' },
    warehouse: { model: 'era_warehouse', sign: 'STORAGE', color: '#ffcf6b' },
    brothel: { model: 'era_hotel6', sign: 'HOTEL ROUGE', color: '#ff5a6a' },
    chopshop: { model: 'era_works', sign: 'GARAGE', color: '#ffb060' },
    fence: { model: 'era_shop2', sign: 'PAWN & LOAN', color: '#ffcf6b' },
    loans: { model: 'era_office8', sign: 'CREDIT', color: '#d8c8ff' },
    union: { model: 'era_office8', sign: 'LOCAL 14', color: '#ff8a7a' }
  };
  var OTHER = { model: 'era_shop2', sign: 'OPEN', color: '#ffe9b0' };

  var COLORS = { family: '#ffc74a', callahan: '#4fd07a', northside: '#5aa2ff', dockers: '#ff6a5a', kessler: '#b88cff', other: '#b9b2c8' };

  // A number between 0 and 1 that depends only on its arguments.
  function hash(a, b, c) {
    var h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }
  function pick(list, r) { return list[Math.min(list.length - 1, Math.floor(r * list.length))]; }
  // A number between 0 and 1 that changes slowly from one lot to the next: neighbours get close values, so that
  // what it decides (how tall, how full, what trade) comes in neighbourhoods and not as a sprinkle.
  function field(i, j, seed, size) {
    var x = i / size, y = j / size, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    var a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed), c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  }
  var YARDS = ['era_warehouse', 'era_works'];      // what stands where the town works: sheds and workshops

  function ownerKey(owner) {
    if (owner === 'family') return 'family';
    var k = String(owner || '').toLowerCase();
    return COLORS[k] ? k : 'other';
  }
  // ---- a city: a grid of blocks, one place a block
  // A block is 4 tiles wide and 3 deep, with a street on its first column and first row, so it holds 3 x 2 lots.
  // planTurf(city) turns one city of AshportEmpire.view(g) into a plan for the renderer. A block of the rules is a
  // block of the map (six lots). Its place stands on a fixed lot of it.
  var KEYS = {
    brewery: { model: 'era_works', sign: 'BREWERY' }, hotel: { model: 'era_hotel9', sign: 'GRAND HOTEL' }, port: { model: 'era_warehouse', sign: 'PORT AUTHORITY' },
    depot: { model: 'era_warehouse', sign: 'FREIGHT DEPOT' }, cityhall: { model: 'era_deco11', sign: 'CITY HALL' }, precinct: { model: 'era_office8', sign: 'PRECINCT' }
  };
  var CLUB = { model: 'era_corner5', sign: 'SOCIAL CLUB' };
  var WASH = { rented: 1, front: 1 };
  // Which of the six lots of a block carries its place: one of the three of the front row, the one that faces the player, and not
  // the same from one block to the next. (A place in the back row would hide behind its neighbours.)
  function spotOf(ci, x, y) { return 3 + Math.min(2, Math.floor(hash(x, y, ci * 7 + 21) * 3)); }

  // `was`, when given, is what the family held of each street name a year ago, in percent (the history of the rules).
  function planTurf(c, ci, was) {
    ci = ci || 0;
    var zones = c.zones.map(function (z, n) { return { id: c.id + '-' + n, name: z.name, c0: z.x0, c1: z.x1 + 1, r0: z.y0, r1: z.y1 + 1, capo: null }; });
    var zoneOf = function (x, y) { var q = c.blocks[y * c.w + x]; if (q && typeof q.zone === 'number' && zones[q.zone]) return q.zone;      // the block says its street name; an old save only has rectangles
      for (var n = 0; n < zones.length; n++) { var z = zones[n]; if (x >= z.c0 && x < z.c1 && y >= z.r0 && y < z.r1) return n; } return 0; };
    var rival = ownerKey(c.rival), placeAt = {}, capoAt = {};
    c.places.forEach(function (p) { placeAt[p.x + ',' + p.y] = p; });
    var lots = [], looks = [], count = zones.map(function () { return { all: 0, real: 0, family: 0, rival: 0 }; });
    var blocks = c.blocks.map(function (b) {
      var ours = b.grip === 'family', w = !ours ? -1 : b.family >= 66 ? 2 : b.family >= 33 ? 1 : 0, zi = zoneOf(b.x, b.y), n = 0;
      count[zi].all++; if (!b.void) count[zi].real++; if (ours) count[zi].family++; else if (b.grip === 'rival') count[zi].rival++;
      looks.push(w);
      // A town is not a chessboard. How far the block is from the edge, and three slow fields, shape it: the middle is
      // full and tall in places, the rim thins out and stays low, a block here and there is a park, sheds stand together.
      // None of it depends on who holds the street, so the ground never changes under the player.
      var here = placeAt[b.x + ',' + b.y], seat = here && here.kind === 'hq' ? hqBlock(here.stage) : null;      // a headquarters shapes its whole block
      var rim = Math.min(b.x, b.y, c.w - 1 - b.x, c.h - 1 - b.y), park = !placeAt[b.x + ',' + b.y] && rim > 0 && hash(b.x, b.y, ci * 7 + 12) < 0.045;
      for (var j = b.y * 3 + 1; j <= b.y * 3 + 2; j++) for (var i = b.x * 4 + 1; i <= b.x * 4 + 3; i++, n++) {
        var dense = field(i, j, ci * 7 + 11, 6), works = field(i, j, ci * 7 + 13, 8) > 0.7, r = hash(i, j, ci * 7 + 2);
        var chance = (ours ? [0.2, 0.5, 0.8][w] : 0.3) * Math.max(0, dense * 3.2 - 0.9) * (rim === 0 ? 0.25 : rim === 1 ? 0.7 : 1);
        var tall = !works && hash(i, j, ci * 7 + 1) < chance;
        var open = b.void ? b.void : park ? 'park' : hash(i, j, ci * 7 + 14) < (rim === 0 ? 0.42 : rim === 1 ? 0.1 : dense < 0.3 ? 0.07 : 0.015) ? 'yard' : null;
        var lot = { i: i, j: j, bx: b.x, by: b.y, district: zi, tall: tall, open: open,
                    model: tall ? (w === 2 && hash(i, j, ci * 7 + 3) < 0.45 ? pick(HIGH, r) : pick(MID, r)) : works ? pick(YARDS, r) : pick(LOW, r),
                    tint: Math.floor(hash(i, j, ci * 7 + 4) * TINTS), lit: ours ? w + 1 : 0, ours: ours,
                    shop: hash(i, j, ci * 7 + 5) < (ours ? [0.4, 0.65, 0.9][w] : 0.3),
                    tower: hash(i, j, ci * 7 + 6) < 0.3, turn: hash(j, i, ci * 7 + 6), site: null, hideout: false };
        var p = n === (seat ? 4 : spotOf(ci, b.x, b.y)) && here;
        if (seat && seat[n]) { lot.tower = false; lot.tint = 2; lot.shop = false; lot.ours = here.owner === 'family'; lot.lit = lot.ours ? 3 : 1; lot.open = seat[n].open || null; }
        if (p) {
          var mine = p.owner === 'family', look = seat ? hqLook(p, c) : p.kind === 'key' ? KEYS[p.key] || OTHER : p.kind === 'club' ? CLUB : SITES[p.kind] || OTHER;
          lot.site = { id: b.x + '.' + b.y, type: p.kind, key: p.key || null, name: p.name, level: seat ? Math.max(1, Math.min(4, p.stage || 1)) : p.level, owner: mine ? 'family' : p.owner, capo: mine ? p.capo || null : null,
                       role: seat ? 'hq' : p.kind === 'key' ? 'key' : p.kind === 'club' ? 'club' : WASH[p.kind] ? 'laundering' : 'business',
                       sign: look.sign, color: mine ? (look.color || COLORS.family) : COLORS[ownerKey(p.owner)] };
          lot.model = look.model; lot.tall = !!seat || MID.indexOf(look.model) >= 0 || HIGH.indexOf(look.model) >= 0; lot.shop = true; lot.ours = mine; lot.lit = mine ? 3 : 1; lot.tower = false;
          lot.open = null;
          lot.hideout = mine && p.kind === 'club';
          if (lot.hideout) capoAt[p.capo] = lot;
        }
        lots.push(lot);
      }
      return { x: b.x, y: b.y, zone: zi, grip: b.grip, void: b.void || null, press: ours ? Math.min(1, b.rival / Math.max(1, b.family)) : 0, hold: Math.max(0, Math.min(1, (ours ? b.family : b.grip === 'rival' ? b.rival : Math.max(b.family, b.rival)) / 100)) };
    });
    // A street name that grew over the year thrives, one that shrank goes quiet: five points of it either way.
    var trends = zones.map(function (z, n) { var k = count[n], old = was && typeof was[n] === 'number' ? was[n] : null, d = old == null || !k.real ? 0 : Math.round(100 * k.family / k.real) - old;
      z.trend = d >= 5 ? 'up' : d <= -5 ? 'down' : null; return z.trend ? z.trend.charAt(0) : '-'; });
    lots.forEach(function (l) { var t = zones[l.district].trend; if (!t || !l.ours || l.site) return; if (t === 'up') l.boom = true; else l.low = true; });
    // A town is not a grid either: here and there the street between two blocks side by side is built over, and they stand as one
    // long block. Never two in a row, so that every crossing keeps its ways out; the cars drive round (route).
    var shut = [], shutAt = {}, gone = function (x, y) { return x < 0 || y < 0 || x >= c.w || y >= c.h || !!c.blocks[y * c.w + x].void; }, infill = [];
    for (var sy = 0; sy < c.h; sy++) for (var sx = 1; sx < c.w; sx++) {
      if (gone(sx - 1, sy) || gone(sx, sy) || hash(sx, sy, ci * 7 + 31) >= 0.2) continue;
      if (shutAt[sx + ',' + (sy - 1)] || shutAt[(sx - 1) + ',' + sy]) continue;
      shutAt[sx + ',' + sy] = 1; shut.push({ x: sx, y: sy });
      var like = lots[(sy * c.w + sx - 1) * 6 + 2];      // the building on its left: same hands, same lights
      for (var fj = sy * 3 + 1; fj <= sy * 3 + 2; fj++) { var fr = hash(sx * 4, fj, ci * 7 + 2);
        infill.push({ i: sx * 4, j: fj, bx: sx - 1, by: sy, district: like.district, tall: false, open: null, model: pick(LOW, fr), tint: Math.floor(hash(sx * 4, fj, ci * 7 + 4) * TINTS),
                      lit: like.ours ? like.lit : 0, ours: like.ours, shop: fr < 0.4, tower: false, turn: 0.5, site: null, hideout: false, infill: true }); }
    }
    // Men stand where the family is: a doorman at each of its places, two at a club, and a crew of three more where a capo faces the rivals.
    var crews = [];
    lots.forEach(function (l) { if (l.site && l.site.owner === 'family') l.men = l.hideout || l.site.role === 'hq' ? 2 : 1; });
    c.capos.forEach(function (k) { if (k.at && k.at.why === 'raid') lots.forEach(function (l) { if (l.site && l.site.owner === 'family' && l.bx === k.at.x && l.by === k.at.y) { l.men += 3; crews.push(k.at.x + '.' + k.at.y); } }); });
    // A place burnt out stays a black shell for a while (c.scars, kept by the page), and works under way show where they are built.
    var marks = [], mark = function (x, y, what) { var l = lots[(y * c.w + x) * 6 + spotOf(ci, x, y)]; if (!l || (l.open && what !== 'works')) return; if (l.open && !c.blocks[y * c.w + x].void) l.open = null; if (l.open) return; l[what] = true; if (what === 'burnt' && !l.site) { l.shop = false; l.tower = false; } marks.push(what.charAt(0) + x + '.' + y); };
    (c.scars || []).forEach(function (q) { if (!placeAt[q.x + ',' + q.y]) mark(q.x, q.y, 'burnt'); });
    c.capos.forEach(function (k) { var pl = k.plan; if (pl && pl.waiting === 'time' && typeof pl.x === 'number') mark(pl.x, pl.y, 'works'); });
    // The streets of a capo in trouble go quiet: each street of the family follows the nearest place a capo runs.
    var ill = {}, run = c.places.filter(function (p) { return p.owner === 'family' && p.capo; });
    c.capos.forEach(function (k) { if (k.trouble) ill[k.id] = 1; });
    if (Object.keys(ill).length) lots.forEach(function (l) { if (!l.ours || l.site) return; var best = null, far = 1e9;
      run.forEach(function (p) { var d = Math.abs(p.x - l.bx) + Math.abs(p.y - l.by); if (d < far) { far = d; best = p; } });
      if (best && ill[best.capo]) l.low = true; });
    // Where a street name is written: over the block of its own that is nearest the middle of all of them, never on the water.
    zones.forEach(function (z, n) {
      var mine = blocks.filter(function (b) { return b.zone === n && !b.void; }), sx = 0, sy = 0, best = null, far = 1e9;
      if (!mine.length) mine = blocks.filter(function (b) { return b.zone === n; });
      mine.forEach(function (b) { sx += b.x; sy += b.y; });
      mine.forEach(function (b) { var d = Math.abs(b.x - sx / mine.length) + Math.abs(b.y - sy / mine.length); if (d < far) { far = d; best = b; } });
      z.cx = best ? best.x + 0.5 : (z.c0 + z.c1) / 2; z.cy = best ? best.y + 0.5 : (z.r0 + z.r1) / 2;
    });
    zones.forEach(function (z, n) {
      var k = count[n]; z.share = k.all ? 100 * k.family / k.all : 0;
      z.owner = k.family > k.rival ? 'family' : k.rival ? rival : 'other'; z.ownerName = z.owner === 'family' ? 'Your family' : z.owner === 'other' ? '' : c.rival;
      z.wealth = z.owner !== 'family' ? -1 : z.share >= 55 ? 2 : z.share >= 25 ? 1 : 0; z.heat = c.heat; z.watched = false;
    });
    var capos = c.capos.map(function (k) {
      var lot = capoAt[k.id] || {}, pl = k.plan || {};
      // where he is this month (the rules say on which block and why); at his club when they say nothing
      var there = k.at && k.at.why !== 'home' ? lotOfBlock({ lots: lots, bx: c.w }, k.at.x, k.at.y) : null;
      return { at: { i: there ? there.i : lot.i, j: there ? there.j : lot.j, why: there ? k.at.why : 'home' }, id: k.id, name: k.name, rank: k.rank, i: lot.i, j: lot.j, bx: k.x, by: k.y, move: pl.move || 'hold', kind: pl.kind || null, way: pl.way || null,
               tx: pl.x, ty: pl.y, progress: pl.progress === undefined ? 1 : pl.progress, waiting: pl.waiting || null, why: pl.why || '', cash: k.cash, income: k.income };
    });
    var key = c.places.map(function (p) { return p.x + '.' + p.y + p.owner.charAt(0) + p.kind + p.level + (p.stage || ''); }).sort().join(',') + '|' + looks.join('') + '|' + Object.keys(ill).sort().join(',') + '|' + marks.sort().join(',') + '|' + crews.sort().join(',') + '|' + trends.join('');
    return { id: c.id, name: c.name, n: ci, u: 0, v: 200, bx: c.w, by: c.h, home: true, key: key, turf: true,
             held: Math.round(c.share.family), total: 100, rival: rival, rivalName: c.rival, heat: c.heat,
             districts: zones, lots: lots, blocks: blocks, capos: capos, shut: shut, infill: infill };
  }

  // The whole map of the new game. `where` is AshportWorld.CITIES: where each city sits. The cities are far bigger than
  // in the first game, so the map is stretched by SCALE to keep the country between them.
  var SCALE = 2.6;
  function planEmpire(view, where) {
    var at = {}, index = {};
    (where || []).forEach(function (c) { at[c.id] = c; });
    var hist = view.history || [], old = hist.length > 1 ? hist[Math.max(0, hist.length - 13)] : null;
    var cities = view.cities.map(function (c, n) { var p = planTurf(c, n, old && ((old.cities || {})[c.id] || {}).zones), w = at[c.id] || { x: 0, y: 200 }; index[c.id] = n; p.u = w.x * SCALE; p.v = w.y * SCALE; p.home = n === 0; p.present = !!c.held; return p; });
    var routes = (view.routes || []).filter(function (r) { return index[r.from] !== undefined && index[r.to] !== undefined; })
      .map(function (r) { return { a: index[r.from], b: index[r.to], kind: r.kind }; });
    return { cities: cities, routes: routes, scale: SCALE };
  }

  // ---- a headquarters and its block
  // The six lots of the block of a headquarters, back row first, at each of its four stages (one an act): null leaves the lot as
  // the town made it. The headquarters stands in the middle of the front row; the block around it becomes the family's as it grows.
  var HQS = ['hq_backroom', 'hq_club', 'hq_hotel', 'hq_seat'], HQSIGN = ['BARBER', 'ATHLETIC CLUB', 'HOTEL ROYALE', 'PALAZZO'];
  // What a headquarters looks like: the building of its stage, and the name over its door (the rivals put their own name up).
  function hqLook(p, c) { var s = Math.max(1, Math.min(4, p.stage || 1)); return { model: HQS[s - 1], sign: p.owner === 'family' ? HQSIGN[s - 1] : String(c.rival || p.owner).toUpperCase() + ' & SONS' }; }
  function hqBlock(stage) {
    var s = Math.max(1, Math.min(4, stage || 1)), hq = { model: HQS[s - 1], hq: true }, court = { open: 'court' }, yard = { open: 'yard' }, park = { open: 'park' };
    return s === 1 ? [null, null, null, null, hq, null]
      : s === 2 ? [null, yard, null, null, hq, yard]
      : s === 3 ? [null, yard, null, court, hq, court]      // from here on it is one wide building: the lots beside it are its own paved ground
      : [park, park, park, court, hq, court];
  }

  // ---- who drives where
  // The rules give each trip a flow; the map gives each flow a colour.
  var FLOW = { logistics: '#ffb347', sales: '#7fe08a', money: '#ffe06a', building: '#c8d0ff', violence: '#ff5a3a' };

  // From one lot to another along the streets. Points are tiles [i, j]; streets are the columns i % 4 = 0 and the rows j % 3 = 0.
  // With the plan of the city (c), the car takes the shortest way that stays in the town: no street runs between two gaps of the
  // outline (water, rails, waste ground), and none where two blocks stand as one. Without it, or if there is no way, it turns once.
  function route(a, b, c) {
    var ra = a[1] % 3 === 1 ? a[1] - 1 : a[1] + 1, rb = b[1] % 3 === 1 ? b[1] - 1 : b[1] + 1, col = Math.round(a[0] / 4) * 4;
    var pts = [a, [a[0], ra]], way = c && c.blocks ? around(c, a[0], ra, b[0], rb) : null;
    if (way) pts = pts.concat(way);
    else if (ra !== rb) pts.push([col, ra], [col, rb]);
    pts.push([b[0], rb], b);
    return pts.filter(function (p, k) { return k === 0 || p[0] !== pts[k - 1][0] || p[1] !== pts[k - 1][1]; });
  }
  // The crossings to drive through, from a tile of a row street to another: the shortest way over the streets that exist.
  function around(c, ai, aj, bi, bj) {
    var W = c.bx + 1, H = c.by + 1, memo = c.ways || (c.ways = {});
    if (!memo.open) {
      var gone = function (x, y) { return x < 0 || y < 0 || x >= c.bx || y >= c.by || !!c.blocks[y * c.bx + x].void; }, shut = {};
      (c.shut || []).forEach(function (q) { shut[q.x + ',' + q.y] = 1; });
      // open.row[y * W + x]: the row street y, along the block column x; open.col[y * W + x]: the column street x, along the block row y
      memo.open = { row: [], col: [] };
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        memo.open.row[y * W + x] = x < c.bx && !(gone(x, y - 1) && gone(x, y));
        memo.open.col[y * W + x] = y < c.by && !(gone(x - 1, y) && gone(x, y)) && !shut[x + ',' + y];
      }
    }
    var open = memo.open, ax = Math.floor(ai / 4), ay = aj / 3, bx = Math.floor(bi / 4), by = bj / 3;
    if (ai % 4 === 0) ax = Math.min(ax, c.bx - 1); if (bi % 4 === 0) bx = Math.min(bx, c.bx - 1);
    if (ay === by && ax === bx) return [];      // the same stretch of street
    var dist = [], from = [], todo = [], n, INF = 1e9;
    for (n = 0; n < W * H; n++) { dist[n] = INF; from[n] = -1; }
    var start = function (x, cost) { var k = ay * W + x; if (cost < dist[k]) { dist[k] = cost; todo.push(k); } };
    start(ax, ai - ax * 4); start(ax + 1, (ax + 1) * 4 - ai);
    while (todo.length) {
      var best = 0; for (n = 1; n < todo.length; n++) if (dist[todo[n]] < dist[todo[best]]) best = n;
      var k = todo.splice(best, 1)[0], x0 = k % W, y0 = (k - x0) / W;
      var step = function (to, cost, ok) { if (ok && dist[k] + cost < dist[to]) { if (dist[to] === INF) todo.push(to); dist[to] = dist[k] + cost; from[to] = k; } };
      if (x0 + 1 < W) step(k + 1, 4, open.row[k]);
      if (x0 > 0) step(k - 1, 4, open.row[k - 1]);
      if (y0 + 1 < H) step(k + W, 3, open.col[k]);
      if (y0 > 0) step(k - W, 3, open.col[k - W]);
    }
    var e0 = by * W + bx, e1 = e0 + 1, c0 = dist[e0] + bi - bx * 4, c1 = dist[e1] + (bx + 1) * 4 - bi, end = c0 <= c1 ? e0 : e1;
    if (dist[end] >= INF) return null;
    var out = [];
    for (n = end; n >= 0; n = from[n]) out.unshift([(n % W) * 4, Math.floor(n / W) * 3]);
    return out;
  }
  // ---- the cars and the events
  // The lot that stands for a block: its place if it has one, else the lot a place would take.
  function lotOfBlock(c, x, y) {
    var first = (y * c.bx + x) * 6, spot = c.lots[first + spotOf(c.n, x, y)];
    for (var n = first; n < first + 6; n++) if (c.lots[n] && c.lots[n].site) return c.lots[n];
    return spot || null;
  }
  var HAUL = { liquor: { flow: 'logistics', vehicle: 'truck' }, goods: { flow: 'logistics', vehicle: 'truck' }, takings: { flow: 'money', vehicle: 'car' }, tribute: { flow: 'money', vehicle: 'car' }, clean: { flow: 'sales', vehicle: 'car' }, wash: { flow: 'sales', vehicle: 'car' }, crew: { flow: 'violence', vehicle: 'car' } };
  // tripsTurf(plan, view): every trip the rules list in a city becomes a car between its two buildings. All of them run the whole month.
  // The spot on the street, by the club, where the n-th vehicle of a capo is parked.
  function parking(lot, n) { var r = lot.j % 3 === 1 ? lot.j - 1 : lot.j + 1; return [lot.i + (n % 2 ? 1 : -1) * 0.45 * Math.ceil(n / 2), r]; }
  function join(path, more) { more.forEach(function (q) { var l = path[path.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) path.push(q); }); return path; }
  // tripsTurf(plan, view): what drives in the streets.
  // The trips that name their vehicle are the legs of its round: it leaves its place by the club empty, loads, delivers, and comes home;
  // a vehicle with no trip this month stays parked there. The other trips come and go between their two ends, as before.
  // `timed`: the page draws the cars sent for takings from their own departures (runsTurf), each with its real days; they are left out here,
  // and so wait parked by the club until a run sends them out.
  function tripsTurf(plan, view, timed) {
    var out = [];
    view.cities.forEach(function (vc, ci) {
      var c = plan.cities[ci]; if (!c) return;
      var same = {}, rounds = {}, order = [];
      (vc.trips || []).forEach(function (t, n) {
        if (timed && t.vehicle) return;      // every vehicle of a capo is timed by the rules: seen when it leaves (runsTurf, haulsTurf), parked by the club meanwhile
        if (t.kind === 'capo') return;      // a capo's own car does not come and go: it drives once, when he moves (movesTurf)
        var a = lotOfBlock(c, t.from.x, t.from.y), b = lotOfBlock(c, t.to.x, t.to.y), look = HAUL[t.kind] || HAUL.takings; if (!a || !b || a === b) return;
        if (t.vehicle && t.home) { if (!rounds[t.vehicle]) { rounds[t.vehicle] = []; order.push(t.vehicle); } rounds[t.vehicle].push({ t: t, a: a, b: b, n: n }); return; }
        var way = c.id + ':' + t.kind + ':' + t.from.x + '.' + t.from.y + '>' + t.to.x + '.' + t.to.y, nth = same[way] = (same[way] || 0) + 1;
        out.push({ id: way + (nth > 1 ? '#' + nth : ''), delay: (nth - 1) * 1.6, kind: t.kind, city: c.id, loop: true, color: FLOW[look.flow], vehicle: look.vehicle, violent: t.kind === 'crew',
                   path: route([a.i, a.j], [b.i, b.j], c), cargo: t.cargo, amount: t.amount || 0, load: {}, capo: t.capo || null, from: a.site ? a.site.type : 'street', to: b.site ? b.site.type : 'street', by: null, way: t.kind === 'crew' ? t.cargo : null, target: null, n: n });
      });
      var nth = function (id) { var m = /:(car|truck):(\d+)$/.exec(id); return m ? (m[1] === 'truck' ? 2 * m[2] : 2 * m[2] - 1) : 0; };
      order.forEach(function (id) {
        var legs = rounds[id].sort(function (x, y) { return (x.t.leg || 0) - (y.t.leg || 0); }), t0 = legs[0].t, look = HAUL[t0.kind] || HAUL.takings;
        var h = lotOfBlock(c, t0.home.x, t0.home.y); if (!h) return;
        var spot = parking(h, nth(id)), door = [h.i, spot[1]], path = [spot, door], stops = [], at = h;
        legs.forEach(function (l) {
          join(path, at === h ? route([h.i, h.j], [l.a.i, l.a.j], c).slice(1) : route([at.i, at.j], [l.a.i, l.a.j], c));
          stops.push({ k: path.length - 1, load: true, amount: l.t.amount || 0, kind: l.t.kind, cargo: l.t.cargo });
          var before = path.length; join(path, route([l.a.i, l.a.j], [l.b.i, l.b.j], c));
          // a load lost on the road never arrives: the vehicle is stopped half way, and drives on empty
          stops.push({ k: l.t.lost ? Math.min(path.length - 2, before + Math.max(0, Math.floor((path.length - before) / 2) - 1)) : path.length - 1, load: false, lost: l.t.lost || null, amount: 0, kind: l.t.kind, cargo: l.t.cargo }); at = l.b;
        });
        join(path, at === h ? [door] : route([at.i, at.j], [h.i, h.j], c).slice(0, -1)); join(path, [door, spot]);
        out.push({ id: c.id + ':' + id, round: true, loop: true, kind: t0.kind, city: c.id, color: FLOW[look.flow], vehicle: /:truck:/.test(id) ? 'truck' : look.vehicle, violent: false, home: spot,
                   path: path, stops: stops, cargo: t0.cargo, amount: t0.amount || 0, load: {}, capo: t0.capo || null, from: 'street', to: 'street', by: null, way: null, target: null, n: legs[0].n });
      });
      // the police patrol a city that runs hot: one car more for every thirty points of heat, each on its own beat
      var town = c.lots.filter(function (l) { return l.open !== 'water' && l.open !== 'rail' && l.open !== 'waste'; });      // they keep to the town
      var beats = Math.min(3, Math.floor((vc.heat || 0) / 30));
      for (var q = 0; q < beats; q++) {
        var pa = town[Math.floor(hash(q, 1, ci * 7 + 21) * town.length)], pb = town[Math.floor(hash(q, 2, ci * 7 + 22) * town.length)]; if (!pa || !pb || pa === pb) continue;
        out.push({ id: c.id + ':patrol:' + q, loop: true, kind: 'patrol', city: c.id, color: '#4a7dff', vehicle: 'police', violent: false, path: route([pa.i, pa.j], [pb.i, pb.j], c),
                   cargo: null, amount: 0, load: {}, capo: null, from: 'street', to: 'street', by: null, way: null, target: null, n: 0 });
      }
      // the rest of the fleet waits by the club
      (vc.capos || []).forEach(function (k) {
        var h = typeof k.x === 'number' ? lotOfBlock(c, k.x, k.y) : null; if (!h) return;
        [['car', k.cars || 0, 'takings'], ['truck', k.trucks || 0, 'liquor']].forEach(function (f) {
          for (var n = 1; n <= f[1]; n++) { var id = k.id + ':' + f[0] + ':' + n; if (rounds[id]) continue;
            var rig = f[0] === 'truck' ? (k.rigs || [])[n - 1] : null, lot = (rig && typeof rig.x === 'number' && lotOfBlock(c, rig.x, rig.y)) || h, spot = parking(lot, nth(id));      // a truck waits where it last unloaded
            out.push({ id: c.id + ':' + id, round: true, parked: true, loop: true, kind: f[2], city: c.id, color: FLOW[HAUL[f[2]].flow], vehicle: f[0], violent: false, home: spot,
                       path: [spot], stops: [], cargo: null, amount: 0, load: {}, capo: k.id, from: 'street', to: 'street', by: null, way: null, target: null, n: 0 }); }
        });
      });
    });
    return out;
  }
  // convoysTurf(plan, convoys): what one city sent to the next last month, each load a truck on the road between them, once.
  function convoysTurf(plan, convoys) {
    var out = [], same = {};
    (convoys || []).forEach(function (v) {
      var a = -1, b = -1; plan.cities.forEach(function (c, n) { if (c.id === v.from) a = n; if (c.id === v.to) b = n; }); if (a < 0 || b < 0 || a === b) return;
      var nth = same[a + '>' + b] = (same[a + '>' + b] || 0) + 1, cash = v.cargo === 'cash';      // money takes the road in a car, goods in a truck
      out.push({ id: (cash ? 'cash:' : 'convoy:') + v.from + '>' + v.to + ':' + nth, kind: 'convoy', loop: false, a: a, b: b, delay: (nth - 1) * 1.5, color: cash ? FLOW.money : FLOW.logistics, vehicle: cash ? 'car' : 'truck', violent: false,
                 days: v.days > 0 ? v.days : 0, cargo: v.cargo, amount: v.amount || 0, capo: v.capo || null, way: plan.cities[a].name + ' to ' + plan.cities[b].name, load: {}, from: 'street', to: 'street', by: null, target: null });
    });
    return out;
  }
  // runsTurf(events, plan): a car sent for the takings of a place. It drives out empty for `wait` days, loads, and drives home for `days`:
  // one car, out and back once, named after the car of the capo it is (veh), so that the same car is not also seen parked.
  function runsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      if (e.type !== 'run' || typeof e.x !== 'number') return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0], k = c && c.capos.filter(function (m) { return m.id === e.capo; })[0]; if (!k || typeof k.i !== 'number') return;
      var b = lotOfBlock(c, e.x, e.y); if (!b || (b.i === k.i && b.j === k.j)) return;
      var go = route([k.i, k.j], [b.i, b.j], c), path = join(go.slice(), route([b.i, b.j], [k.i, k.j], c)), w = Math.max(0.25, e.wait || 0), d = Math.max(0.25, e.days || 1);
      out.push({ id: c.id + ':run:' + (e.vehicle || e.capo) + ':' + e.x + '.' + e.y, veh: e.vehicle ? c.id + ':' + e.vehicle : null, kind: 'takings', city: c.id, loop: false, color: FLOW.money, vehicle: 'car', violent: false, path: path,
                 stages: [{ k: go.length - 1, days: w }, { k: path.length - 1, days: d }], days: w + d, wait: 0, cargo: 'cash', amount: Math.round(e.amount || 0), load: {}, capo: e.capo, from: b.site ? b.site.type : 'street', to: 'club', by: null, way: null, target: null, n: 0 });
    });
    return out;
  }
  // departuresTurf(events, plan): a car that leaves with money (the share of the boss, money to wash, washed money) drives once,
  // from where it loads to where it is counted. The rules say how many days it waits before it has loaded (wait) and how many it
  // drives (days): the map keeps to them at any speed of the game, so that it arrives the day the money is counted.
  var CARRIES = { tribute: 'cash', wash: 'cash', clean: 'clean' };
  function departuresTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      if (!CARRIES[e.type] || !e.from || typeof e.x !== 'number') return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0], a = c && lotOfBlock(c, e.from.x, e.from.y), b = c && lotOfBlock(c, e.x, e.y); if (!a || !b || a === b) return;
      out.push({ id: c.id + ':' + e.type + ':' + (e.capo || '') + ':' + e.from.x + '.' + e.from.y, veh: e.vehicle ? c.id + ':' + e.vehicle : null, kind: e.type, city: c.id, loop: false, color: FLOW[HAUL[e.type].flow], vehicle: 'car', violent: false, path: route([a.i, a.j], [b.i, b.j], c),
                 days: Math.max(1, e.days || 1), wait: Math.max(0, e.wait || 0), cargo: CARRIES[e.type], amount: e.amount || 0, load: {}, capo: e.capo || null, from: a.site ? a.site.type : 'street', to: b.site ? b.site.type : 'street', by: null, way: null, target: null, n: 0 });
    });
    return out;
  }
  // paymentsTurf(events, plan): what the boss pays leaves his headquarters in its van, one load a trip. In his own city the van
  // drives to the place that is owed; for another city it takes the road. It keeps to the days the rules give it.
  function paymentsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      if (e.type !== 'payment' || e.step !== 'leaves') return;
      if (e.van && e.van !== e.city) { out.push.apply(out, convoysTurf(plan, [{ from: e.van, to: e.city, cargo: 'cash', amount: e.amount, capo: e.capo, days: e.days }]).map(function (t) { t.id = 'pay:' + e.id + ':' + t.id; return t; })); return; }
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0], a = c && e.from && lotOfBlock(c, e.from.x, e.from.y), b = c && lotOfBlock(c, e.x, e.y); if (!a || !b || a === b) return;
      out.push({ id: c.id + ':payment:' + e.id + ':' + (e.vehicle || ''), kind: 'payment', city: c.id, loop: false, color: FLOW.money, vehicle: 'truck', violent: false, path: route([a.i, a.j], [b.i, b.j], c),
                 days: Math.max(1, e.days || 1), wait: 0, cargo: 'cash', amount: e.amount || 0, load: {}, capo: e.capo || null, from: 'hq', to: b.site ? b.site.type : 'street', by: null, way: e.order || null, target: null, n: 0 });
    });
    return out;
  }
  // leavingTurf(events, plan, day): what takes the road to another city today, goods in a truck and money in a car, each seen once.
  // The day is part of its name: the truck of tomorrow is another truck, not this one sent back to the start.
  function leavingTurf(events, plan, day) {
    return convoysTurf(plan, (events || []).filter(function (e) { return e.type === 'convoy' && e.step === 'leaves'; })).map(function (t) { t.id += '@' + (day || 0); return t; });
  }
  // haulsTurf(events, plan, standing): a truck sent for a load. It drives from where it stands (the seller of its last delivery, or the
  // club) to the cellar in `wait` days, loads, and drives to the seller in `days`. It stays there until its next load (stay).
  // standing: { 'city:capo:truck:N': { x, y } }, the block where each truck was left.
  function haulsTurf(events, plan, standing) {
    var out = [];
    (events || []).forEach(function (e) {
      if (e.type !== 'haul' || !e.from || typeof e.x !== 'number') return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0], k = c && c.capos.filter(function (m) { return m.id === e.capo; })[0]; if (!k) return;
      var a = lotOfBlock(c, e.from.x, e.from.y), b = lotOfBlock(c, e.x, e.y); if (!a || !b || a === b) return;
      var veh = c.id + ':' + (e.vehicle || e.capo + ':truck:1'), at = e.at || (standing || {})[veh], s = at ? lotOfBlock(c, at.x, at.y) : null, start = s ? [s.i, s.j] : typeof k.i === 'number' ? [k.i, k.j] : [a.i, a.j];
      var go = start[0] === a.i && start[1] === a.j ? [[a.i, a.j]] : route(start, [a.i, a.j], c), leg = route([a.i, a.j], [b.i, b.j], c);
      if (e.lost) leg = leg.slice(0, Math.max(2, Math.ceil(leg.length / 2)));      // a load held up or seized never arrives: the truck is stopped half way
      var path = join(go.slice(), leg), look = HAUL[e.cargo] || HAUL.liquor;
      out.push({ id: veh + ':haul:' + e.from.x + '.' + e.from.y + '>' + e.x + '.' + e.y, veh: veh, stay: !e.lost, lost: e.lost || null, kind: e.cargo === 'liquor' ? 'liquor' : 'goods', city: c.id, loop: false, color: FLOW[look.flow], vehicle: 'truck', violent: false, path: path,
                 stages: [{ k: go.length - 1, days: Math.max(0.25, e.wait || 0) }, { k: path.length - 1, days: Math.max(0.25, e.days || 1) }], days: Math.max(0.25, e.wait || 0) + Math.max(0.25, e.days || 1), wait: 0,
                 cargo: e.cargo, amount: e.amount || 0, load: {}, capo: e.capo, from: a.site ? a.site.type : 'street', to: b.site ? b.site.type : 'street', by: null, way: null, target: null, n: 0 });
    });
    return out;
  }
  // errandsTurf(events, plan): a capo who goes to open, enlarge or convert a place drives there himself with the money, in the days the
  // rules give him. The place only changes when he is there.
  function errandsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      if (e.type !== 'errand' || e.step !== 'leaves' || !e.from || typeof e.x !== 'number') return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0], a = c && lotOfBlock(c, e.from.x, e.from.y), b = c && lotOfBlock(c, e.x, e.y); if (!a || !b) return;
      var path = a === b ? [[a.i, a.j], [b.i, b.j]] : route([a.i, a.j], [b.i, b.j], c);
      out.push({ id: c.id + ':capo:' + e.capo, kind: 'capo', city: c.id, loop: false, color: COLORS.family, vehicle: 'car', violent: false, path: path, days: Math.max(0.25, e.days || 1), wait: 0,
                 cargo: e.move, amount: Math.round(e.amount || 0), load: {}, capo: e.capo, from: 'club', to: b.site ? b.site.type : 'street', by: null, way: e.move, target: null, n: 0 });
    });
    return out;
  }
  // ridesTurf(view, plan): the cars that are on their way today, each as far along as the rules say (gone, in days). It is what a
  // game opened again shows at once: the money that had left is still on the road, where it was.
  function ridesTurf(view, plan) {
    var out = [], n = 0, add = function (trips, gone) { trips.forEach(function (t) { t.id += ':again' + (n++); t.gone = Math.max(0, Math.min(t.days, gone || 0)); out.push(t); }); };
    (view.cities || []).forEach(function (c) {
      (c.rides || []).forEach(function (r) {
        if (r.kind === 'takings') add(runsTurf([{ type: 'run', city: c.id, capo: r.capo, x: r.from.x, y: r.from.y, amount: r.amount, wait: r.wait || 0, days: r.days, vehicle: r.vehicle }], plan), (r.gone > 0 ? Math.max(0.25, r.wait || 0) : 0) + r.gone);
        else if (r.kind === 'haul') { var hv = {}; hv[c.id + ':' + r.vehicle] = r.from; add(haulsTurf([{ type: 'haul', city: c.id, capo: r.capo, cargo: r.cargo, from: r.from, x: r.to.x, y: r.to.y, amount: r.amount, wait: 0, days: r.days, vehicle: r.vehicle }], plan, hv), (r.gone > 0 ? 0.25 : 0) + r.gone); }
        else add(departuresTurf([{ type: r.kind, city: c.id, capo: r.capo, from: r.from, x: r.to.x, y: r.to.y, amount: r.amount, days: r.days, wait: 0, vehicle: r.vehicle }], plan), r.gone);
      });
    });
    var home = (view.cities || []).filter(function (c) { return c.hq && c.hq.family && c.hq.family.home; })[0], hq = home && home.hq.family;
    (view.paying || []).forEach(function (p) {
      (p.rides || []).forEach(function (r, k) {
        if (hq) add(paymentsTurf([{ type: 'payment', step: 'leaves', id: p.id, order: p.order, city: p.city, capo: p.capo, from: { x: hq.x, y: hq.y }, x: p.x, y: p.y, amount: r.amount, days: r.days, van: home.id, vehicle: home.id + ':van:' + k }], plan), r.gone);
      });
    });
    (view.onRoad || []).forEach(function (r) { add(convoysTurf(plan, [{ from: r.from, to: r.to, cargo: 'cash', amount: r.amount, days: r.days }]), r.gone); });
    return out;
  }
  // movesTurf(before, after): a capo who is not where he was last month drives there once, in his own car.
  var ERRAND = { open: 1, enlarge: 1, convert: 1 };
  function movesTurf(before, after) {
    var out = [];
    if (!before) return out;
    after.cities.forEach(function (c) {
      var was = before.cities.filter(function (x) { return x.id === c.id; })[0]; if (!was) return;
      c.capos.forEach(function (k) {
        var old = was.capos.filter(function (x) { return x.id === k.id; })[0];
        if (!old || !old.at || !k.at || typeof k.at.i !== 'number' || typeof old.at.i !== 'number' || (old.at.i === k.at.i && old.at.j === k.at.j) || ERRAND[k.at.why]) return;      // (an errand is timed by the rules: errandsTurf)
        out.push({ id: c.id + ':capo:' + k.id, kind: 'capo', city: c.id, loop: false, color: COLORS.family, vehicle: 'car', violent: false,
                   path: route([old.at.i, old.at.j], [k.at.i, k.at.j], c), cargo: k.at.why, load: {}, capo: k.id, from: 'street', to: 'street', by: null, way: null, target: null, n: 0 });
      });
    });
    return out;
  }
  var FXOF = { vendetta: 'gunfire', betrayal: 'betrayal', hijack: 'gunfire', seizure: 'police', burnt: 'fire', repelled: 'gunfire', bust: 'police', rank: 'promotion', opened: 'build', enlarged: 'build', converted: 'build', learned: 'promotion' };
  var PAID = { moving: 1, car: 1, truck: 1 };      // what a capo paid out of his own purse when it happened (one who only asks has spent nothing yet; what the boss pays leaves his headquarters, not the place)
  // effectsTurf(events, plan): fire where a place burns, gunfire where one is fought over, police lights on a bust.
  function effectsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      // fire, gunfire, police lights and good news have their own light; any other event that has a place is a plain mark there
      // a place that goes up has its scaffold, a key place taken its beam of light, a decision that paid or cost its own colour
      if (e.type === 'outcome' && typeof e.good !== 'boolean') return;
      if (e.type === 'run' || e.type === 'pay' || e.type === 'haul' || (e.type === 'arrived' && e.kind === 'haul')) return;      // goods on a truck are not money
      if (e.type === 'errand') {      // the money a capo takes with him is seen leaving his club; if he turns back it is his again
        var ec = plan.cities.filter(function (x) { return x.id === e.city; })[0], ek = ec && ec.capos.filter(function (m) { return m.id === e.capo && typeof m.i === 'number'; })[0], el = ek && ec.lots.filter(function (l) { return l.i === ek.i && l.j === ek.j; })[0];
        if (el && e.amount > 0) out.push({ kind: 'pay', type: 'errand', city: ec.id, capo: e.capo, i: el.i, j: el.j, bx: el.bx, by: el.by, say: null, spent: e.step === 'leaves' ? Math.round(e.amount) : 0, gain: e.step === 'leaves' ? 0 : Math.round(e.amount) });
        return;
      }      // a car that leaves and a pay packet are seen as money moving, never as a mark
      if (e.type === 'payment') {      // what the boss pays: seen leaving his headquarters load by load, and arriving where it is owed
        var yc = plan.cities.filter(function (x) { return x.id === (e.step === 'leaves' ? e.van || e.city : e.city); })[0]; if (!yc || !(e.amount > 0)) return;
        var yl = e.step === 'leaves' ? yc.lots.filter(function (l) { return l.site && l.site.role === 'hq' && l.site.owner === 'family'; })[0] : e.step === 'arrives' && typeof e.x === 'number' ? lotOfBlock(yc, e.x, e.y) : null;
        if (yl) out.push({ kind: 'pay', type: 'payment', city: yc.id, capo: e.capo || null, i: yl.i, j: yl.j, bx: yl.bx, by: yl.by, say: null, spent: e.step === 'leaves' ? Math.round(e.amount) : 0, gain: e.step === 'leaves' ? 0 : Math.round(e.amount) });
        return;
      }
      if (e.type === 'convoy') {      // money of another city on the road: its car is seen leaving, and the load is counted over the headquarters it reaches
        var vc = e.step === 'arrives' && e.amount > 0 ? plan.cities.filter(function (x) { return x.id === e.to; })[0] : null, vl = vc && vc.lots.filter(function (l) { return l.site && l.site.role === 'hq' && l.site.owner === 'family'; })[0];
        if (vl) out.push({ kind: 'pay', type: 'convoy', city: vc.id, capo: null, i: vl.i, j: vl.j, bx: vl.bx, by: vl.by, say: null, spent: 0, gain: Math.round(e.amount) });
        return;
      }
      if (e.type === 'wash' || e.type === 'tribute' || e.type === 'clean') return;      // a car that leaves with money: the car is seen, nothing is counted before it arrives      // dirty money driven to a laundry: its car is seen, nothing is counted yet
      if (e.type === 'arrived' || e.type === 'loot') {      // the share of the boss driven in from a club, washed money driven back: counted over the headquarters where it arrives
        var tc = plan.cities.filter(function (x) { return x.id === e.city; })[0], tl = tc && typeof e.x === 'number' ? lotOfBlock(tc, e.x, e.y) : null;
        if (tl && e.amount > 0 && e.kind !== 'wash') out.push({ kind: 'pay', type: e.kind || e.type, city: tc.id, capo: e.capo || null, i: tl.i, j: tl.j, bx: tl.bx, by: tl.by, say: null, spent: 0, gain: Math.round(e.amount) });
        return;
      }
      var kind = e.type === 'taken' ? (e.kind === 'key' ? 'key' : e.way === 'force' ? 'gunfire' : 'promotion') : e.type === 'outcome' ? (e.good ? 'good' : 'bad') : FXOF[e.type] || 'news';
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0] || (kind === 'news' ? null : plan.cities[0]); if (!c) return;
      var lot = typeof e.x === 'number' ? lotOfBlock(c, e.x, e.y) : null;
      if (!lot && kind !== 'news') { var k = c.capos.filter(function (m) { return m.id === e.capo; })[0] || c.capos[0]; if (k && typeof k.i === 'number') lot = { i: k.i, j: k.j, bx: k.bx, by: k.by }; }
      // money never leaves from thin air: no figure over the place itself, what it cost is seen leaving the purse at the capo's club
      var payer = PAID[e.type] && e.cost > 0 ? c.capos.filter(function (m) { return m.id === e.capo && typeof m.i === 'number'; })[0] : null;
      if (payer) out.push({ kind: 'pay', type: 'pay', city: c.id, capo: payer.id, i: payer.i, j: payer.j, bx: payer.bx, by: payer.by, say: null, spent: Math.round(e.cost) });
      if (!lot) return;
      out.push({ kind: kind, type: e.type, city: c.id, i: lot.i, j: lot.j, bx: lot.bx, by: lot.by, say: e.label, spent: e.type === 'bust' && e.seized > 0 && typeof e.x === 'number' ? Math.round(e.seized) : 0 });      // (what the police seize, they take where it is kept)
    });
    // a take under way: the place being taken is ringed for as long as the capo stands before it
    plan.cities.forEach(function (c) { c.capos.forEach(function (k) { if (k.at && k.at.why === 'take' && typeof k.at.i === 'number') out.push({ kind: 'siege', type: 'take', city: c.id, i: k.at.i, j: k.at.j, say: null, spent: 0 }); }); });
    return out;
  }
  // arrivalsTurf(events, plan): a man the boss takes in drives in once, from the rim of the town to his new club.
  function arrivalsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      if (e.type === 'loot' && e.from) {      // the take of a hit: the men drive it home, from the place they took to their club
        var lc = plan.cities.filter(function (x) { return x.id === e.city; })[0], la = lc && lotOfBlock(lc, e.from.x, e.from.y), lb = lc && lotOfBlock(lc, e.x, e.y); if (!la || !lb || la === lb) return;
        out.push({ id: lc.id + ':loot:' + e.capo + ':' + e.from.x + '.' + e.from.y, kind: 'loot', city: lc.id, loop: false, color: FLOW.money, vehicle: 'car', violent: false, path: route([la.i, la.j], [lb.i, lb.j], lc),
                   cargo: 'cash', amount: e.amount || 0, load: {}, capo: e.capo || null, from: la.site ? la.site.type : 'street', to: 'club', by: null, way: null, target: null, n: 0 });
        return;
      }
      if (e.type !== 'welcomed' || typeof e.x !== 'number') return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0]; if (!c) return;
      var k = c.capos.filter(function (m) { return m.id === e.capo; })[0], lot = k && typeof k.i === 'number' ? k : lotOfBlock(c, e.x, e.y); if (!lot) return;
      var W = c.bx * 4, H = c.by * 3, rim = [[0, lot.j], [W, lot.j], [lot.i, 0], [lot.i, H]].sort(function (a, b) { return Math.abs(a[0] - lot.i) + Math.abs(a[1] - lot.j) - Math.abs(b[0] - lot.i) - Math.abs(b[1] - lot.j); });
      var path = null;
      for (var n = 0; n < rim.length && !path; n++) { var r = route(rim[n], [lot.i, lot.j], c); if (r && r.length > 1) path = r; }
      if (!path) return;
      out.push({ id: c.id + ':arrives:' + e.capo, kind: 'capo', city: c.id, loop: false, color: COLORS.family, vehicle: 'car', violent: false, path: path, cargo: 'arrives', load: {}, capo: e.capo, from: 'street', to: 'street', by: null, way: null, target: null, n: 0 });
    });
    return out;
  }

  // What a capo pays, the day he pays it: the takings his cars brought to the club are shared out there, so the figure leaves from the club;
  // what a car left at a place on its way is paid at that place.
  // (wages of all his places and the upkeep of his garage together), read by the map as money that leaves.
  function paysTurf(events, plan) {
    var by = {}, out = [];
    if (!plan) return out;
    (events || []).forEach(function (e) {
      if (e.type !== 'pay') return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0], k = c && c.capos.filter(function (m) { return m.id === e.capo; })[0]; if (!k || typeof k.i !== 'number') return;
      // wages the car that came for the takings left with the men of a place are paid there, where the money was
      var at = e.left && typeof e.x === 'number' ? lotOfBlock(c, e.x, e.y) : null, id = c.id + ':' + k.id + (at ? ':' + e.x + '.' + e.y : ''), o = by[id];
      if (!o) { o = by[id] = { kind: 'pay', type: 'pay', city: c.id, capo: k.id, i: at ? at.i : k.i, j: at ? at.j : k.j, bx: at ? at.bx : k.bx, by: at ? at.by : k.by, say: null, spent: 0 }; out.push(o); }
      o.spent += +e.amount || 0;
    });
    return out.map(function (o) { o.spent = Math.round(o.spent); return o; }).filter(function (o) { return o.spent >= 1; });
  }
  // The streets about to be won: one claim for each capo whose plan wins streets, the furthest along first and those who put nothing aside last.
  // { id, city, capo, who, does, x, y, streets, advance (0 to 1), state: 'money' | 'men' | 'ready' | 'stuck', stuck, gains: [{ x, y }] }
  var DOES = { open: 'opens a ', take: 'takes a ', enlarge: 'enlarges his ', convert: 'turns a place into a ' };
  function claimsTurf(view) {
    var list = [];
    (view.cities || []).forEach(function (c) {
      (c.capos || []).forEach(function (k) {
        var p = k.plan; if (!p || !p.gains || !p.gains.length) return;
        var adv = Math.max(0, Math.min(1, +p.advance || 0)), stuck = adv < 1 && (p.due === null || p.due === undefined) && !(k.counts < 2);      // (before his second day of accounts his pace is not known yet)
        list.push({ id: c.id + ':' + k.id, city: c.id, capo: k.id, who: String(k.name || k.id).split(' ')[0], does: (DOES[p.move] || p.move + ' a ') + String(p.name || p.kind).toLowerCase(), x: p.x, y: p.y, streets: p.gains.length, advance: adv, due: typeof p.due === 'number' ? p.due : null,
                    state: stuck ? 'stuck' : adv >= 1 ? 'ready' : p.waiting === 'money' ? 'money' : 'men', stuck: stuck, gains: p.gains.map(function (b) { return { x: b.x, y: b.y }; }) });
      });
    });
    return list.sort(function (a, b) { return (a.stuck - b.stuck) || (b.advance - a.advance); });
  }
  var api = { MODELS: MODELS, COLORS: COLORS, SITES: SITES, FLOW: FLOW, planTurf: planTurf, planEmpire: planEmpire, spotOf: spotOf, hqBlock: hqBlock, leavingTurf: leavingTurf, paymentsTurf: paymentsTurf, departuresTurf: departuresTurf, runsTurf: runsTurf, haulsTurf: haulsTurf, errandsTurf: errandsTurf, ridesTurf: ridesTurf, tripsTurf: tripsTurf, movesTurf: movesTurf, convoysTurf: convoysTurf, effectsTurf: effectsTurf, arrivalsTurf: arrivalsTurf, claimsTurf: claimsTurf, paysTurf: paysTurf, route: route };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportMapView = api;
})(typeof self !== 'undefined' ? self : this);
