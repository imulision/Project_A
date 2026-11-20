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

  // ---- who drives where
  // The rules give each trip a flow; the map gives each flow a colour.
  var FLOW = { logistics: '#ffb347', sales: '#7fe08a', money: '#ffe06a', building: '#c8d0ff', violence: '#ff5a3a' };

  // From one lot to another along the streets. Points are tiles [i, j]; streets are the columns i % 4 = 0 and the rows j % 3 = 0.
  function route(a, b) {
    var ra = a[1] % 3 === 1 ? a[1] - 1 : a[1] + 1, rb = b[1] % 3 === 1 ? b[1] - 1 : b[1] + 1, col = Math.round(a[0] / 4) * 4;
    var pts = [a, [a[0], ra]];
    if (ra !== rb) pts.push([col, ra], [col, rb]);
    pts.push([b[0], rb], b);
    return pts.filter(function (p, k) { return k === 0 || p[0] !== pts[k - 1][0] || p[1] !== pts[k - 1][1]; });
  }
  // ---- the cars and the events
  // The lot that stands for a block: its place if it has one, else the lot a place would take.
  function lotOfBlock(c, x, y) {
    var first = (y * c.bx + x) * 6, spot = c.lots[first + SPOT];
    for (var n = first; n < first + 6; n++) if (c.lots[n] && c.lots[n].site) return c.lots[n];
    return spot || null;
  }
  var HAUL = { liquor: { flow: 'logistics', vehicle: 'truck' }, takings: { flow: 'money', vehicle: 'car' }, wash: { flow: 'sales', vehicle: 'car' }, crew: { flow: 'violence', vehicle: 'car' } };
  // tripsTurf(plan, view): every trip the rules list in a city becomes a car between its two buildings. All of them run the whole month.
  function tripsTurf(plan, view) {
    var out = [];
    view.cities.forEach(function (vc, ci) {
      var c = plan.cities[ci]; if (!c) return;
      var same = {};      // several loads can leave by the same way in a month: each is a car of its own, a moment after the one before
      (vc.trips || []).forEach(function (t, n) {
        var a = lotOfBlock(c, t.from.x, t.from.y), b = lotOfBlock(c, t.to.x, t.to.y), look = HAUL[t.kind] || HAUL.takings; if (!a || !b || a === b) return;
        var way = c.id + ':' + t.kind + ':' + t.from.x + '.' + t.from.y + '>' + t.to.x + '.' + t.to.y, nth = same[way] = (same[way] || 0) + 1;
        out.push({ id: way + (nth > 1 ? '#' + nth : ''), delay: (nth - 1) * 1.6, kind: t.kind, city: c.id, loop: true, color: FLOW[look.flow], vehicle: look.vehicle, violent: t.kind === 'crew',
                   path: route([a.i, a.j], [b.i, b.j]), cargo: t.cargo, amount: t.amount || 0, load: {}, capo: t.capo || null, from: a.site ? a.site.type : 'street', to: b.site ? b.site.type : 'street', by: null, way: t.kind === 'crew' ? t.cargo : null, target: null, n: n });
      });
    });
    return out;
  }
  var FXOF = { burnt: 'fire', repelled: 'gunfire', bust: 'police', rank: 'promotion', opened: 'promotion', enlarged: 'promotion', learned: 'promotion' };
  // effectsTurf(events, plan): fire where a place burns, gunfire where one is fought over, police lights on a bust.
  function effectsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      var kind = e.type === 'taken' ? (e.way === 'force' ? 'gunfire' : 'promotion') : FXOF[e.type]; if (!kind) return;
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0] || plan.cities[0]; if (!c) return;
      var lot = typeof e.x === 'number' ? lotOfBlock(c, e.x, e.y) : null;
      if (!lot) { var k = c.capos.filter(function (m) { return m.id === e.capo; })[0] || c.capos[0]; if (k && typeof k.i === 'number') lot = { i: k.i, j: k.j, bx: k.bx, by: k.by }; }
      if (!lot) return;
      out.push({ kind: kind, city: c.id, i: lot.i, j: lot.j, bx: lot.bx, by: lot.by });
    });
    return out;
  }

  var api = { MODELS: MODELS, COLORS: COLORS, SITES: SITES, FLOW: FLOW, planTurf: planTurf, planEmpire: planEmpire, tripsTurf: tripsTurf, effectsTurf: effectsTurf, route: route };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportMapView = api;
})(typeof self !== 'undefined' ? self : this);
