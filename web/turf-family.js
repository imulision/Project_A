// The family across cities: the building tree it carries from city to city,
// what it has learnt, and the convoys between its cities.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var G = typeof require === 'function' ? require('./turf-goods.js') : root.AshportTurfGoods;
  var S = typeof require === 'function' ? require('./turf-streets.js') : root.AshportTurfStreets;
  var RULES = R.RULES, TERRAIN = R.TERRAIN, KINDS = R.KINDS, key = R.key;
  var who = P.who, sits = P.sits;
  var everyPlace = C.everyPlace, clubOf = C.clubOf;
  var CHAINS = G.CHAINS, loadOfCargo = G.loadOfCargo, cellars = G.cellars;
  var first = S.first;

  // --- the family, and the building tree it carries from city to city ---
  // What one car of the family carries in a run.
  function loadOf(f) { return RULES.car.loads[Math.max(1, Math.min(3, (f.tech && f.tech.cars) || 1))]; }

  function carries(tier) { return 'A car carries $' + RULES.car.loads[tier] + ' a run'; }

  // What a trade is, in a line; and what a tier of it brings: the right to open it, then bigger places.
  function brings(kind, tier) {
    var site = D.SITES[kind], more = Math.round(RULES.bigger * 100) + ' %';
    if (tier === 1) return 'Your capos can open it';
    if (site.wash) return 'They can make it bigger: it washes 150 % more';
    if (RULES.goods.makes[kind] || kind === 'still' || kind === 'loft') return 'They can make it bigger: it makes ' + more + ' more';
    return 'They can make it bigger: it earns ' + more + ' more';
  }

  function nameOf(kind) { return kind === 'cars' ? 'Cars' : D.SITES[kind].name; }

  function createFamily() {
    var tech = {};
    KINDS.forEach(function (k) { tech[k] = RULES.learn.open.indexOf(k) >= 0 ? 1 : 0; });
    tech.cars = 1;
    return { tech: tech, men: {}, dirty: 0, clean: 0, study: null };
  }

  function likedBy(f, kind) {
    return Object.keys(f.men).filter(function (id) { return who(id).likes.indexOf(kind) >= 0; });
  }

  // Every trade: the tier the family knows, what the next one costs, and who in the family likes it.
  function tree(f) {
    var out = KINDS.map(function (kind) {
      var tier = f.tech[kind] || 0, wanted = likedBy(f, kind);
      return { kind: kind, name: D.SITES[kind].name, street: TERRAIN[kind], tier: tier, wanted: wanted, gives: D.SITES[kind].does,
               studying: f.study && f.study.kind === kind ? Math.max(1, f.study.monthsLeft) : 0,
               next: tier >= RULES.learn.cost.length ? null
                 : { tier: tier + 1, cost: RULES.learn.cost[tier], months: RULES.learn.months[tier] * (wanted.length ? RULES.learn.taught : 1), gives: brings(kind, tier + 1) } };
    });
    // the cars: not a place, but learned the same way; asked for by the men whose tills were left full
    var cars = Math.max(1, f.tech.cars || 1), stuck = Object.keys(f.men).filter(function (id) { return f.men[id].stuck; });
    out.push({ kind: 'cars', name: 'Cars', street: null, tier: cars, wanted: cars < 3 ? stuck : [], gives: carries(cars),
               studying: f.study && f.study.kind === 'cars' ? Math.max(1, f.study.monthsLeft) : 0,
               next: cars >= 3 ? null : { tier: cars + 1, cost: RULES.learn.cost[cars], months: RULES.learn.months[cars] * (stuck.length ? RULES.learn.taught : 1), gives: carries(cars + 1) } });
    return out;
  }

  function research(f, kind) {
    if (!TERRAIN[kind] && kind !== 'cars') throw new Error('unknown kind of place: ' + kind);
    if (f.study) throw new Error('the family is already learning ' + nameOf(f.study.kind));
    var t = tree(f).filter(function (q) { return q.kind === kind; })[0];
    if (!t.next) throw new Error('there is nothing more to learn about ' + t.name);
    if ((f.clean || 0) < t.next.cost) throw new Error('it takes $' + t.next.cost + ' of clean money');
    f.clean -= t.next.cost;
    f.study = { kind: kind, tier: t.next.tier, monthsLeft: t.next.months };
  }

  // The closed trade each capo of the city would open first.
  function wishes(c, f) {
    var out = [];
    Object.keys(f.men).forEach(function (id) {
      if (!clubOf(c, id)) return;
      var kind = who(id).likes.filter(function (k) { return TERRAIN[k] && !(f.tech[k] >= 1) && who(id).refuses.indexOf(k) < 0; })[0];
      if (kind) out.push({ capo: id, kind: kind, name: D.SITES[kind].name, label: first(id) + ' wants to open a ' + D.SITES[kind].name.toLowerCase() });
      if (f.men[id].stuck && (f.tech.cars || 1) < 3) out.push({ capo: id, kind: 'cars', name: 'Cars', label: first(id) + ' wants bigger cars: his tills are piling up' });
    });
    return out;
  }

  // One month for the whole family: every city, then what it is learning.
  // What went down the roads last month, for the map of the cities.
  function convoys(f) { return f.convoys || []; }

  // Once every city has served itself, what waits in its cellars and stores goes down each road to the family's sellers
  // that had nothing to sell next door. It is on their shelves for the month to come.
  function ride(f, cities, roads) {
    f.convoys = [];
    (roads || []).forEach(function (r) {
      [[r.from, r.to], [r.to, r.from]].forEach(function (way) {
        var a = cities.filter(function (c) { return c.id === way[0]; })[0], b = cities.filter(function (c) { return c.id === way[1]; })[0];
        var left = RULES.convoy.loads + (sits(f, 'routes') ? Math.floor(who(sits(f, 'routes')).cunning / RULES.table.cunning) : 0);
        if (!a || !b) return;
        CHAINS.forEach(function (chain) {
          if (chain.bonus) return;
          var src = cellars(a).filter(function (s) { return s.chain === chain.id; });
          var sellers = everyPlace(b).filter(function (p) { return p.owner === 'family' && chain.sells.indexOf(p.kind) >= 0; })
            .map(function (p) { return { p: p, b: b.blocks[key(p.x, p.y)] }; }).filter(function (q) { return (q.b[chain.sold] || 0) < 1; });
          while (left > 0) {
            var from = null, to = null;
            src.forEach(function (s) { if (s.b.stock >= 1 && (!from || s.b.stock > from.b.stock)) from = s; });
            sellers.forEach(function (q) { var has = q.b[chain.shelf] || 0; if (has + 1 <= RULES.truck.shelf && (!to || has < (to.b[chain.shelf] || 0))) to = q; });
            if (!from || !to) break;
            from.b.stock -= 1; to.b[chain.shelf] = (to.b[chain.shelf] || 0) + 1; left -= 1;
            f.convoys.push({ from: a.id, to: b.id, cargo: from.cargo, amount: loadOfCargo(from.cargo), capo: from.p.capo, x: from.p.x, y: from.p.y, tx: to.p.x, ty: to.p.y });
          }
        });
      });
    });
  }

  var api = { loadOf: loadOf, createFamily: createFamily, tree: tree, research: research, wishes: wishes, convoys: convoys, ride: ride };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfFamily = api;
})(typeof self !== 'undefined' ? self : this);
