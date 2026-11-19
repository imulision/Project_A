// What the 3D map has to draw, worked out from the state of the game.
//
// plan(view) turns AshportGame.view(g) into cities made of blocks, districts
// and lots, each lot with the building that stands on it. trips(plan, list)
// turns AshportGame.trips(g) into cars with a route along the streets. effects(events, plan) turns what
// happened in a month into fire, gunfire and police lights.
// Nothing is drawn here and nothing is random: the same state always gives
// the same map, so the renderer only rebuilds a city when its key changes.
(function (root) {
  'use strict';

  // A city is a grid of blocks. A block is 4 tiles wide and 3 deep, with a
  // street on its first column and first row, so it holds 3 x 2 lots.
  // District rectangles are in blocks: [col0, col1, row0, row1].
  var LAYOUTS = {
    '6x7': [[0, 2, 0, 4], [2, 4, 0, 2], [4, 6, 0, 3], [2, 4, 2, 5], [4, 6, 3, 7], [0, 2, 4, 7], [2, 4, 5, 7]],
    '5x8': [[0, 2, 0, 3], [2, 5, 0, 2], [2, 5, 2, 5], [0, 2, 3, 6], [2, 5, 5, 8], [0, 2, 6, 8]],
    '7x9': [[0, 3, 0, 3], [3, 7, 0, 2], [3, 5, 2, 5], [5, 7, 2, 5], [0, 3, 3, 6], [3, 5, 5, 9], [5, 7, 5, 9], [0, 3, 6, 9]],
    '6x8': [[0, 3, 0, 3], [3, 6, 0, 2], [3, 6, 2, 5], [0, 3, 3, 5], [0, 3, 5, 8], [3, 6, 5, 8]],
    '6x8b': [[0, 3, 0, 2], [3, 6, 0, 3], [0, 3, 2, 5], [3, 6, 3, 5], [0, 2, 5, 8], [2, 4, 5, 8], [4, 6, 5, 8]]
  };
  // Cities with the same number of districts do not all get the same shape.
  var SHAPES = { 6: ['6x8', '5x8'], 7: ['6x7', '6x8b'], 8: ['7x9'] };

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
  var KINDS = Object.keys(SITES);
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

  function ownerKey(owner) {
    if (owner === 'family') return 'family';
    var k = String(owner || '').toLowerCase();
    return COLORS[k] ? k : 'other';
  }
  // How well the family holds a district shows in its buildings: 0, 1 or 2.
  function wealthOf(d) { return d.owner !== 'family' ? -1 : d.share >= 55 ? 2 : d.share >= 25 ? 1 : 0; }

  function shapeOf(count, index) {
    var list = SHAPES[count] || SHAPES[count < 6 ? 6 : 8];
    return list[index % list.length];
  }

  function planCity(c, ci, used) {
    var n = c.districts.length, turn = used[n] || 0; used[n] = turn + 1;
    var shape = shapeOf(n, turn), size = shape.split('x'), bx = parseInt(size[0], 10), by = parseInt(size[1], 10), rects = LAYOUTS[shape];
    var districts = c.districts.map(function (d, i) {
      var r = rects[i % rects.length], key = ownerKey(d.owner);
      return { id: d.id, name: d.name, capo: key === 'family' ? d.capo || null : null, c0: r[0], c1: r[1], r0: r[2], r1: r[3], owner: key, ownerName: key === 'family' ? 'Your family' : d.owner,
               wealth: wealthOf(d), capo: d.capo, share: d.share, heat: d.heat, watched: !!d.watched };
    });
    var lots = [], byDistrict = districts.map(function () { return []; });
    for (var i = 0; i < bx * 4 + 1; i++) for (var j = 0; j < by * 3 + 1; j++) {
      if (i % 4 === 0 || j % 3 === 0) continue;
      var di = -1;
      for (var k = 0; k < districts.length && di < 0; k++) { var d = districts[k]; if (i > d.c0 * 4 && i < d.c1 * 4 && j > d.r0 * 3 && j < d.r1 * 3) di = k; }
      if (di < 0) continue;
      var w = districts[di].wealth, ours = w >= 0;
      var tall = hash(i, j, ci * 7 + 1) < (ours ? [0.2, 0.5, 0.8][w] : 0.3), r = hash(i, j, ci * 7 + 2);
      var lot = { i: i, j: j, district: di, tall: tall,
                  model: tall ? (w === 2 && hash(i, j, ci * 7 + 3) < 0.45 ? pick(HIGH, r) : pick(MID, r)) : pick(LOW, r),
                  tint: Math.floor(hash(i, j, ci * 7 + 4) * TINTS), lit: ours ? w + 1 : 0, ours: ours,
                  shop: hash(i, j, ci * 7 + 5) < (ours ? [0.4, 0.65, 0.9][w] : 0.3),
                  tower: hash(i, j, ci * 7 + 6) < 0.3, turn: hash(j, i, ci * 7 + 6), site: null, hideout: false };
      lots.push(lot); byDistrict[di].push(lot);
    }
    // The family's places: each kind has its own lots in a district, so a place never moves when another opens.
    c.districts.forEach(function (d, di) {
      var mine = byDistrict[di], count = {};
      mine[mine.length >> 1].hideout = true;      // one fixed building per district: where the capo sits
      (d.buildings || []).slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function (b) {
        var kind = KINDS.indexOf(b.type), look = SITES[b.type] || OTHER, nth = count[b.type] || 0; count[b.type] = nth + 1;
        var slot = ((kind < 0 ? KINDS.length : kind) + nth * (KINDS.length + 1)) % mine.length, tries = 0;
        while ((mine[slot].site || mine[slot].hideout) && tries++ < mine.length) slot = (slot + 1) % mine.length;
        var lot = mine[slot];
        if (lot.site || lot.hideout) return;
        lot.site = { id: b.id, type: b.type, name: b.name, level: b.level, staff: b.staff, role: b.role || 'business', sign: look.sign, color: look.color };
        lot.model = look.model; lot.tall = MID.indexOf(look.model) >= 0 || HIGH.indexOf(look.model) >= 0; lot.shop = true; lot.ours = true; lot.lit = 3;
      });
    });
    var key = districts.map(function (d, di) {
      return d.owner + d.wealth + ':' + byDistrict[di].filter(function (l) { return l.site; }).map(function (l) { return l.site.id + '.' + l.site.level; }).join(',');
    }).join('|');
    return { id: c.id, name: c.name, u: c.x, v: c.y, bx: bx, by: by, home: ci === 0, key: key,
             held: districts.filter(function (d) { return d.owner === 'family'; }).length, total: districts.length,
             rival: ownerKey((c.districts.filter(function (d) { return d.owner !== 'family'; })[0] || {}).owner),
             districts: districts, lots: lots };
  }

  // ---- the city of the new game: no districts, a grid of blocks, one place a block
  // planTurf(city) turns one city of AshportEmpire.view(g) into the same kind of plan as above, so the renderer draws
  // both. A block of the rules is a block of the map (six lots). Its place stands on a fixed lot of it.
  var KEYS = {
    brewery: { model: 'era_works', sign: 'BREWERY' }, hotel: { model: 'era_hotel9', sign: 'GRAND HOTEL' }, port: { model: 'era_warehouse', sign: 'PORT AUTHORITY' },
    depot: { model: 'era_warehouse', sign: 'FREIGHT DEPOT' }, cityhall: { model: 'era_deco11', sign: 'CITY HALL' }, precinct: { model: 'era_office8', sign: 'PRECINCT' }
  };
  var CLUB = { model: 'era_corner5', sign: 'SOCIAL CLUB' };
  var WASH = { rented: 1, front: 1 };
  var SPOT = 1;      // which of the six lots of a block carries its place

  function planTurf(c, ci) {
    ci = ci || 0;
    var zones = c.zones.map(function (z, n) { return { id: c.id + '-' + n, name: z.name, c0: z.x0, c1: z.x1 + 1, r0: z.y0, r1: z.y1 + 1, capo: null }; });
    var zoneOf = function (x, y) { for (var n = 0; n < zones.length; n++) { var z = zones[n]; if (x >= z.c0 && x < z.c1 && y >= z.r0 && y < z.r1) return n; } return 0; };
    var rival = ownerKey(c.rival), placeAt = {}, capoAt = {};
    c.places.forEach(function (p) { placeAt[p.x + ',' + p.y] = p; });
    var lots = [], looks = [], count = zones.map(function () { return { all: 0, family: 0, rival: 0 }; });
    var blocks = c.blocks.map(function (b) {
      var ours = b.grip === 'family', w = !ours ? -1 : b.family >= 66 ? 2 : b.family >= 33 ? 1 : 0, zi = zoneOf(b.x, b.y), n = 0;
      count[zi].all++; if (ours) count[zi].family++; else if (b.grip === 'rival') count[zi].rival++;
      looks.push(w);
      for (var j = b.y * 3 + 1; j <= b.y * 3 + 2; j++) for (var i = b.x * 4 + 1; i <= b.x * 4 + 3; i++, n++) {
        var tall = hash(i, j, ci * 7 + 1) < (ours ? [0.2, 0.5, 0.8][w] : 0.3), r = hash(i, j, ci * 7 + 2);
        var lot = { i: i, j: j, bx: b.x, by: b.y, district: zi, tall: tall,
                    model: tall ? (w === 2 && hash(i, j, ci * 7 + 3) < 0.45 ? pick(HIGH, r) : pick(MID, r)) : pick(LOW, r),
                    tint: Math.floor(hash(i, j, ci * 7 + 4) * TINTS), lit: ours ? w + 1 : 0, ours: ours,
                    shop: hash(i, j, ci * 7 + 5) < (ours ? [0.4, 0.65, 0.9][w] : 0.3),
                    tower: hash(i, j, ci * 7 + 6) < 0.3, turn: hash(j, i, ci * 7 + 6), site: null, hideout: false };
        var p = n === SPOT && placeAt[b.x + ',' + b.y];
        if (p) {
          var mine = p.owner === 'family', look = p.kind === 'key' ? KEYS[p.key] || OTHER : p.kind === 'club' ? CLUB : SITES[p.kind] || OTHER;
          lot.site = { id: b.x + '.' + b.y, type: p.kind, key: p.key || null, name: p.name, level: p.level, owner: mine ? 'family' : p.owner, capo: mine ? p.capo || null : null,
                       role: p.kind === 'key' ? 'key' : p.kind === 'club' ? 'club' : WASH[p.kind] ? 'laundering' : 'business',
                       sign: look.sign, color: mine ? (look.color || COLORS.family) : COLORS[ownerKey(p.owner)] };
          lot.model = look.model; lot.tall = MID.indexOf(look.model) >= 0 || HIGH.indexOf(look.model) >= 0; lot.shop = true; lot.ours = mine; lot.lit = mine ? 3 : 1; lot.tower = false;
          lot.hideout = mine && p.kind === 'club';
          if (lot.hideout) capoAt[p.capo] = lot;
        }
        lots.push(lot);
      }
      return { x: b.x, y: b.y, grip: b.grip, hold: Math.max(0, Math.min(1, (ours ? b.family : b.grip === 'rival' ? b.rival : Math.max(b.family, b.rival)) / 100)) };
    });
    zones.forEach(function (z, n) {
      var k = count[n]; z.share = k.all ? 100 * k.family / k.all : 0;
      z.owner = k.family > k.rival ? 'family' : k.rival ? rival : 'other'; z.ownerName = z.owner === 'family' ? 'Your family' : z.owner === 'other' ? '' : c.rival;
      z.wealth = z.owner !== 'family' ? -1 : z.share >= 55 ? 2 : z.share >= 25 ? 1 : 0; z.heat = c.heat; z.watched = false;
    });
    var capos = c.capos.map(function (k) {
      var lot = capoAt[k.id] || {}, pl = k.plan || {};
      return { id: k.id, name: k.name, rank: k.rank, i: lot.i, j: lot.j, bx: k.x, by: k.y, move: pl.move || 'hold', kind: pl.kind || null, way: pl.way || null,
               tx: pl.x, ty: pl.y, progress: pl.progress === undefined ? 1 : pl.progress, waiting: pl.waiting || null, why: pl.why || '', cash: k.cash, income: k.income };
    });
    var key = c.places.map(function (p) { return p.x + '.' + p.y + p.owner.charAt(0) + p.kind + p.level; }).sort().join(',') + '|' + looks.join('');
    return { id: c.id, name: c.name, u: 0, v: 200, bx: c.w, by: c.h, home: true, key: key, turf: true,
             held: Math.round(c.share.family), total: 100, rival: rival, rivalName: c.rival, heat: c.heat,
             districts: zones, lots: lots, blocks: blocks, capos: capos };
  }

  // The whole map of the new game. `where` is AshportWorld.CITIES: where each city sits. The cities are far bigger than
  // in the first game, so the map is stretched by SCALE to keep the country between them.
  var SCALE = 2.6;
  function planEmpire(view, where) {
    var at = {}, index = {};
    (where || []).forEach(function (c) { at[c.id] = c; });
    var cities = view.cities.map(function (c, n) { var p = planTurf(c, n), w = at[c.id] || { x: 0, y: 200 }; index[c.id] = n; p.u = w.x * SCALE; p.v = w.y * SCALE; p.home = n === 0; p.present = !!c.held; return p; });
    var routes = (view.routes || []).filter(function (r) { return index[r.from] !== undefined && index[r.to] !== undefined; })
      .map(function (r) { return { a: index[r.from], b: index[r.to], kind: r.kind }; });
    return { cities: cities, routes: routes, scale: SCALE };
  }

  function plan(view) {
    var used = {}, index = {};
    var cities = view.cities.map(function (c, ci) { index[c.id] = ci; return planCity(c, ci, used); });
    var routes = (view.routes || []).filter(function (r) { return index[r.from] !== undefined && index[r.to] !== undefined; })
      .map(function (r) { return { a: index[r.from], b: index[r.to], kind: r.kind }; });
    return { cities: cities, routes: routes };
  }

  // ---- who drives where
  // The rules give each trip a flow; the map gives each flow a colour.
  var FLOW = { logistics: '#ffb347', sales: '#7fe08a', money: '#ffe06a', building: '#c8d0ff', violence: '#ff5a3a' };
  var POLICE = '#5a8dff';
  var ONCE = ['works', 'streets', 'seizure', 'raid', 'attack', 'hit', 'kidnap'];   // a crew sent out; everything else runs all month
  var CONVOY = { attack: 3, raid: 2 };
  var MAX_LOOPS = 8;

  // From one lot to another along the streets. Points are tiles [i, j]; streets are the columns i % 4 = 0 and the rows j % 3 = 0.
  function route(a, b) {
    var ra = a[1] % 3 === 1 ? a[1] - 1 : a[1] + 1, rb = b[1] % 3 === 1 ? b[1] - 1 : b[1] + 1, col = Math.round(a[0] / 4) * 4;
    var pts = [a, [a[0], ra]];
    if (ra !== rb) pts.push([col, ra], [col, rb]);
    pts.push([b[0], rb], b);
    return pts.filter(function (p, k) { return k === 0 || p[0] !== pts[k - 1][0] || p[1] !== pts[k - 1][1]; });
  }
  function byId(a, b) { return a.site.id < b.site.id ? -1 : a.site.id > b.site.id ? 1 : 0; }
  function lotsOf(c, di) { return c.lots.filter(function (l) { return l.district === di; }); }
  function sitesOf(c, di) { return lotsOf(c, di).filter(function (l) { return l.site; }).sort(byId); }
  function ofKind(sites, kinds) { return sites.filter(function (l) { return kinds.indexOf(l.site.type) >= 0; }); }
  // The place of a given kind that an event talks about: the rules name its kind, the newest one is meant.
  function placeOf(c, di, what) {
    var sites = sitesOf(c, di), exact = sites.filter(function (l) { return l.site.id === what; }), kind = ofKind(sites, [what]);
    return exact[0] || kind[kind.length - 1] || null;
  }
  function someLot(c, di, salt) { var lots = lotsOf(c, di).filter(function (l) { return !l.site && !l.hideout; }); return lots.length ? pick(lots, hash(di, salt, lots.length)) : null; }
  // Where strangers come from: the nearest district that is not this one, a rival's if there is one.
  function outside(c, di, by) {
    var best = -1;
    c.districts.forEach(function (d, k) { if (k !== di && (best < 0 || (d.owner === by && c.districts[best].owner !== by))) best = k; });
    return best;
  }

  // A fixed building of the district that is not one of its businesses: where the capo sits and the money is counted.
  function hideout(c, di) { return lotsOf(c, di).filter(function (l) { return l.hideout; })[0] || null; }
  // Where a word of the rules is on the map.
  function pointOf(c, di, what, salt, by) {
    if (what === 'hideout' || what === 'boss') return hideout(c, di);
    if (what === 'streets' || what === 'shops') return someLot(c, di, 11 + salt);
    if (what === 'police' || what === 'rivals') return someLot(c, outside(c, di, by), 23 + salt);
    return placeOf(c, di, what) || someLot(c, di, 37 + salt);
  }

  // The cars on the road. `list` is AshportGame.trips(g): the rules say who goes from where to where and why,
  // the map finds the buildings and the streets between them. Routine runs loop; a crew sent out goes once.
  // 'hillside-still-2' is a still: the kind of place at the end of a trip, for the screen to picture.
  function endOf(end) { var m = /-([a-z]+)-\d+$/.exec(String(end)); return m && SITES[m[1]] ? m[1] : String(end); }
  function trips(plan, list) {
    var out = [], loops = {};
    (list || []).forEach(function (t, n) {
      var c = plan.cities.filter(function (x) { return x.id === t.city; })[0]; if (!c) return;
      var di = -1; c.districts.forEach(function (d, k) { if (d.id === t.district) di = k; }); if (di < 0) return;
      var loop = ONCE.indexOf(t.kind) < 0, by = t.by ? ownerKey(t.by) : null, cars = CONVOY[t.kind] || 1;
      if (loop) { loops[t.district] = (loops[t.district] || 0) + 1; if (loops[t.district] > MAX_LOOPS) return; }
      var color = t.vehicle === 'police' ? POLICE : t.kind === 'attack' && by ? COLORS[by] : FLOW[t.flow] || FLOW.money;
      var ti = -1; if (t.target) c.districts.forEach(function (d, k) { if (d.id === t.target) ti = k; });
      var load = {}; ['crates', 'amount', 'men'].forEach(function (f) { if (typeof t[f] === 'number') load[f] = t[f]; });
      for (var k = 0; k < cars; k++) {
        var a = pointOf(c, di, t.from, n * 7 + k, by), b = pointOf(c, di, t.to, n * 7 + k, by);
        if (ti >= 0) b = hideout(c, ti) || someLot(c, ti, 61 + n) || b;      // men sent to take a district go into it
        if (!a || !b) continue;
        if (a === b) { a = someLot(c, di, 53 + n); if (!a || a === b) continue; }
        out.push({ id: loop ? t.district + ':' + t.kind + ':' + t.from + '>' + t.to : 'once:' + n + ':' + k, kind: t.kind, city: c.id, loop: loop, color: color,
                   vehicle: t.vehicle === 'truck' || t.vehicle === 'police' ? t.vehicle : 'car', violent: !!t.violent, path: route([a.i, a.j], [b.i, b.j]),
                   district: t.district, cargo: t.kind, load: load, from: endOf(t.from), to: endOf(t.to), by: t.by || null, way: t.way || null, target: t.target || null });
      }
    });
    return out;
  }

  // What a month's events look like on the map. With the plan, each one lands on the place it names.
  function effects(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      var site = e.site || null;
      if (plan && site) plan.cities.forEach(function (c) { if (c.id !== e.city) return;
        c.districts.forEach(function (d, di) { if (d.id !== e.district) return; var l = placeOf(c, di, site); if (l) site = l.site.id; }); });
      var add = function (kind) { out.push({ kind: kind, city: e.city, district: e.district, site: site }); };
      if (e.type === 'attack') { if (e.outcome === 'hit' && e.site) add('fire'); add('gunfire'); }
      else if (e.type === 'raid') add('police');
      else if (e.type === 'promotion') add('promotion');
      else if (e.type === 'takeover') add(e.outcome === 'failed' ? 'police' : e.way === 'force' ? 'gunfire' : 'promotion');
      else if (e.type === 'job') { if (e.outcome === 'failed') add('police'); else if (e.kind === 'hit') add('gunfire'); }
    });
    return out;
  }

  var api = { MODELS: MODELS, COLORS: COLORS, SITES: SITES, FLOW: FLOW, plan: plan, planTurf: planTurf, planEmpire: planEmpire, route: route, trips: trips, effects: effects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportMapView = api;
})(typeof self !== 'undefined' ? self : this);
