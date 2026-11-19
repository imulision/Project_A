// What the 3D map has to draw, worked out from the state of the game.
//
// plan(view) turns AshportGame.view(g) into cities made of blocks, districts
// and lots, each lot with the building that stands on it. effects(events)
// turns what happened in a month into fire, gunfire and police lights.
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
      return { id: d.id, name: d.name, c0: r[0], c1: r[1], r0: r[2], r1: r[3], owner: key, ownerName: key === 'family' ? 'Your family' : d.owner,
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
                  tower: hash(i, j, ci * 7 + 6) < 0.3, turn: hash(j, i, ci * 7 + 6), site: null };
      lots.push(lot); byDistrict[di].push(lot);
    }
    // The family's places: each kind has its own lots in a district, so a place never moves when another opens.
    c.districts.forEach(function (d, di) {
      var mine = byDistrict[di], count = {};
      (d.buildings || []).slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function (b) {
        var kind = KINDS.indexOf(b.type), look = SITES[b.type] || OTHER, nth = count[b.type] || 0; count[b.type] = nth + 1;
        var slot = ((kind < 0 ? KINDS.length : kind) + nth * (KINDS.length + 1)) % mine.length, tries = 0;
        while (mine[slot].site && tries++ < mine.length) slot = (slot + 1) % mine.length;
        var lot = mine[slot];
        if (lot.site) return;
        lot.site = { id: b.id, type: b.type, name: b.name, level: b.level, staff: b.staff, sign: look.sign, color: look.color };
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

  function plan(view) {
    var used = {}, index = {};
    var cities = view.cities.map(function (c, ci) { index[c.id] = ci; return planCity(c, ci, used); });
    var routes = (view.routes || []).filter(function (r) { return index[r.from] !== undefined && index[r.to] !== undefined; })
      .map(function (r) { return { a: index[r.from], b: index[r.to], kind: r.kind }; });
    return { cities: cities, routes: routes };
  }

  // What a month's events look like on the map.
  function effects(events) {
    var out = [];
    (events || []).forEach(function (e) {
      var at = { city: e.city, district: e.district, site: e.site || null };
      var add = function (kind) { out.push({ kind: kind, city: at.city, district: at.district, site: at.site }); };
      if (e.type === 'attack') { if (e.outcome === 'hit' && e.site) add('fire'); add('gunfire'); }
      else if (e.type === 'raid') add('police');
    });
    return out;
  }

  var api = { MODELS: MODELS, COLORS: COLORS, SITES: SITES, plan: plan, effects: effects };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportMapView = api;
})(typeof self !== 'undefined' ? self : this);
