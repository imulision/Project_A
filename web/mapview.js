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
      // where he is this month (the rules say on which block and why); at his club when they say nothing
      var there = k.at && k.at.why !== 'home' ? lotOfBlock({ lots: lots, bx: c.w }, k.at.x, k.at.y) : null;
      return { at: { i: there ? there.i : lot.i, j: there ? there.j : lot.j, why: there ? k.at.why : 'home' }, id: k.id, name: k.name, rank: k.rank, i: lot.i, j: lot.j, bx: k.x, by: k.y, move: pl.move || 'hold', kind: pl.kind || null, way: pl.way || null,
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
  var HAUL = { liquor: { flow: 'logistics', vehicle: 'truck' }, goods: { flow: 'logistics', vehicle: 'truck' }, takings: { flow: 'money', vehicle: 'car' }, wash: { flow: 'sales', vehicle: 'car' }, crew: { flow: 'violence', vehicle: 'car' } };
  // tripsTurf(plan, view): every trip the rules list in a city becomes a car between its two buildings. All of them run the whole month.
  // The spot on the street, by the club, where the n-th vehicle of a capo is parked.
  function parking(lot, n) { var r = lot.j % 3 === 1 ? lot.j - 1 : lot.j + 1; return [lot.i + (n % 2 ? 1 : -1) * 0.45 * Math.ceil(n / 2), r]; }
  function join(path, more) { more.forEach(function (q) { var l = path[path.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) path.push(q); }); return path; }
  // tripsTurf(plan, view): what drives in the streets.
  // The trips that name their vehicle are the legs of its round: it leaves its place by the club empty, loads, delivers, and comes home;
  // a vehicle with no trip this month stays parked there. The other trips come and go between their two ends, as before.
  function tripsTurf(plan, view) {
    var out = [];
    view.cities.forEach(function (vc, ci) {
      var c = plan.cities[ci]; if (!c) return;
      var same = {}, rounds = {}, order = [];
      (vc.trips || []).forEach(function (t, n) {
        if (t.kind === 'capo') return;      // a capo's own car does not come and go: it drives once, when he moves (movesTurf)
        var a = lotOfBlock(c, t.from.x, t.from.y), b = lotOfBlock(c, t.to.x, t.to.y), look = HAUL[t.kind] || HAUL.takings; if (!a || !b || a === b) return;
        if (t.vehicle && t.home) { if (!rounds[t.vehicle]) { rounds[t.vehicle] = []; order.push(t.vehicle); } rounds[t.vehicle].push({ t: t, a: a, b: b, n: n }); return; }
        var way = c.id + ':' + t.kind + ':' + t.from.x + '.' + t.from.y + '>' + t.to.x + '.' + t.to.y, nth = same[way] = (same[way] || 0) + 1;
        out.push({ id: way + (nth > 1 ? '#' + nth : ''), delay: (nth - 1) * 1.6, kind: t.kind, city: c.id, loop: true, color: FLOW[look.flow], vehicle: look.vehicle, violent: t.kind === 'crew',
                   path: route([a.i, a.j], [b.i, b.j]), cargo: t.cargo, amount: t.amount || 0, load: {}, capo: t.capo || null, from: a.site ? a.site.type : 'street', to: b.site ? b.site.type : 'street', by: null, way: t.kind === 'crew' ? t.cargo : null, target: null, n: n });
      });
      var nth = function (id) { var m = /:(car|truck):(\d+)$/.exec(id); return m ? (m[1] === 'truck' ? 2 * m[2] : 2 * m[2] - 1) : 0; };
      order.forEach(function (id) {
        var legs = rounds[id].sort(function (x, y) { return (x.t.leg || 0) - (y.t.leg || 0); }), t0 = legs[0].t, look = HAUL[t0.kind] || HAUL.takings;
        var h = lotOfBlock(c, t0.home.x, t0.home.y); if (!h) return;
        var spot = parking(h, nth(id)), door = [h.i, spot[1]], path = [spot, door], stops = [], at = h;
        legs.forEach(function (l) {
          join(path, at === h ? route([h.i, h.j], [l.a.i, l.a.j]).slice(1) : route([at.i, at.j], [l.a.i, l.a.j]));
          stops.push({ k: path.length - 1, load: true, amount: l.t.amount || 0, kind: l.t.kind, cargo: l.t.cargo });
          var before = path.length; join(path, route([l.a.i, l.a.j], [l.b.i, l.b.j]));
          // a load lost on the road never arrives: the vehicle is stopped half way, and drives on empty
          stops.push({ k: l.t.lost ? Math.min(path.length - 2, before + Math.max(0, Math.floor((path.length - before) / 2) - 1)) : path.length - 1, load: false, lost: l.t.lost || null, amount: 0, kind: l.t.kind, cargo: l.t.cargo }); at = l.b;
        });
        join(path, at === h ? [door] : route([at.i, at.j], [h.i, h.j]).slice(0, -1)); join(path, [door, spot]);
        out.push({ id: c.id + ':' + id, round: true, loop: true, kind: t0.kind, city: c.id, color: FLOW[look.flow], vehicle: /:truck:/.test(id) ? 'truck' : look.vehicle, violent: false, home: spot,
                   path: path, stops: stops, cargo: t0.cargo, amount: t0.amount || 0, load: {}, capo: t0.capo || null, from: 'street', to: 'street', by: null, way: null, target: null, n: legs[0].n });
      });
      // the rest of the fleet waits by the club
      (vc.capos || []).forEach(function (k) {
        var h = typeof k.x === 'number' ? lotOfBlock(c, k.x, k.y) : null; if (!h) return;
        [['car', k.cars || 0, 'takings'], ['truck', k.trucks || 0, 'liquor']].forEach(function (f) {
          for (var n = 1; n <= f[1]; n++) { var id = k.id + ':' + f[0] + ':' + n; if (rounds[id]) continue;
            out.push({ id: c.id + ':' + id, round: true, parked: true, loop: true, kind: f[2], city: c.id, color: FLOW[HAUL[f[2]].flow], vehicle: f[0], violent: false, home: parking(h, nth(id)),
                       path: [parking(h, nth(id))], stops: [], cargo: null, amount: 0, load: {}, capo: k.id, from: 'street', to: 'street', by: null, way: null, target: null, n: 0 }); }
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
      var nth = same[a + '>' + b] = (same[a + '>' + b] || 0) + 1;
      out.push({ id: 'convoy:' + v.from + '>' + v.to + ':' + nth, kind: 'convoy', loop: false, a: a, b: b, delay: (nth - 1) * 1.5, color: FLOW.logistics, vehicle: 'truck', violent: false,
                 cargo: v.cargo, amount: v.amount || 0, capo: v.capo || null, way: plan.cities[a].name + ' to ' + plan.cities[b].name, load: {}, from: 'street', to: 'street', by: null, target: null });
    });
    return out;
  }
  // movesTurf(before, after): a capo who is not where he was last month drives there once, in his own car.
  function movesTurf(before, after) {
    var out = [];
    if (!before) return out;
    after.cities.forEach(function (c) {
      var was = before.cities.filter(function (x) { return x.id === c.id; })[0]; if (!was) return;
      c.capos.forEach(function (k) {
        var old = was.capos.filter(function (x) { return x.id === k.id; })[0];
        if (!old || !old.at || !k.at || typeof k.at.i !== 'number' || typeof old.at.i !== 'number' || (old.at.i === k.at.i && old.at.j === k.at.j)) return;
        out.push({ id: c.id + ':capo:' + k.id, kind: 'capo', city: c.id, loop: false, color: COLORS.family, vehicle: 'car', violent: false,
                   path: route([old.at.i, old.at.j], [k.at.i, k.at.j]), cargo: k.at.why, load: {}, capo: k.id, from: 'street', to: 'street', by: null, way: null, target: null, n: 0 });
      });
    });
    return out;
  }
  var FXOF = { hijack: 'gunfire', seizure: 'police', burnt: 'fire', repelled: 'gunfire', bust: 'police', rank: 'promotion', opened: 'promotion', enlarged: 'promotion', learned: 'promotion' };
  // effectsTurf(events, plan): fire where a place burns, gunfire where one is fought over, police lights on a bust.
  function effectsTurf(events, plan) {
    var out = [];
    (events || []).forEach(function (e) {
      // fire, gunfire, police lights and good news have their own light; any other event that has a place is a plain mark there
      var kind = e.type === 'taken' ? (e.way === 'force' ? 'gunfire' : 'promotion') : FXOF[e.type] || 'news';
      var c = plan.cities.filter(function (x) { return x.id === e.city; })[0] || (kind === 'news' ? null : plan.cities[0]); if (!c) return;
      var lot = typeof e.x === 'number' ? lotOfBlock(c, e.x, e.y) : null;
      if (!lot && kind !== 'news') { var k = c.capos.filter(function (m) { return m.id === e.capo; })[0] || c.capos[0]; if (k && typeof k.i === 'number') lot = { i: k.i, j: k.j, bx: k.bx, by: k.by }; }
      if (!lot) return;
      out.push({ kind: kind, type: e.type, city: c.id, i: lot.i, j: lot.j, bx: lot.bx, by: lot.by, say: e.label });
    });
    return out;
  }

  var api = { MODELS: MODELS, COLORS: COLORS, SITES: SITES, FLOW: FLOW, planTurf: planTurf, planEmpire: planEmpire, tripsTurf: tripsTurf, movesTurf: movesTurf, convoysTurf: convoysTurf, effectsTurf: effectsTurf, route: route };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportMapView = api;
})(typeof self !== 'undefined' ? self : this);
