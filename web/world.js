// The map of the game: six cities, their districts, the routes between
// them, and the family's posts. No drawing and no browser here.
//
// A capo runs a district (district.js does the work). Three seats at the
// boss's table serve the whole family. The boss names people; this file
// only keeps track of who holds what and runs every district each month.
//
// To change the map, edit CITIES and ROUTES. Nothing else needs to change.
(function (root) {
  'use strict';

  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;

  function place(id, name, nightlife, industry, port, wealth) {
    return { id: id, name: name, traits: { nightlife: nightlife, industry: industry, port: port, wealth: wealth } };
  }

  // x, y and terrain are for the map (the same list is read by the 3D view);
  // character says what the city is good for;
  // rival is the family that holds it at the start.
  var CITIES = [
    { id: 'ashport', name: 'Ashport', x: -70, y: 95, terrain: 'plain', character: 'The big city. Everything passes through it.', rival: 'Callahan',
      districts: [
        place('ashport-uptown', 'Uptown', 1.2, 0, 0, 1.5),
        place('ashport-hillside', 'Hillside', 1, 0.4, 0, 1.2),
        place('ashport-market', 'Market Street', 1.5, 0.5, 0, 1),
        place('ashport-station', 'Union Station', 0.8, 1, 0.8, 0.8),
        place('ashport-calabria', 'Little Calabria', 1.2, 0.5, 0, 0.5),
        place('ashport-canal', 'Canal Street', 1, 1, 0.8, 0.5),
        place('ashport-stockyards', 'Stockyards', 0.5, 1.5, 0.5, 0.5),
        place('ashport-docks', 'The Docks', 0.8, 1.2, 1.5, 0.5)
      ] },
    { id: 'calder', name: 'Calder Falls', x: 30, y: 20, terrain: 'mountains', character: 'A mill town in the hills. Foundries, quarries and unions.', rival: 'Northside',
      districts: [
        place('calder-millrace', 'Millrace', 0.5, 1.5, 0, 0.5),
        place('calder-highstreet', 'High Street', 1.2, 0.5, 0, 1.2),
        place('calder-landing', 'The Landing', 1, 0.8, 0.8, 0.5),
        place('calder-quarry', 'Quarry Row', 0.5, 1.2, 0, 0.5),
        place('calder-foundry', 'Foundry', 0.5, 1.5, 0, 0.5),
        place('calder-northgate', 'Northgate', 0.8, 0.5, 0, 1.2),
        place('calder-ironbridge', 'Iron Bridge', 1, 1, 0.5, 0.8)
      ] },
    { id: 'marrow', name: 'Marrow Bay', x: 75, y: 150, terrain: 'coast', character: 'A bay of canneries, shipyards and night boats.', rival: 'Callahan',
      districts: [
        place('marrow-oldtown', 'Old Town', 1.5, 0.5, 0, 1),
        place('marrow-cannery', 'Cannery Row', 0.5, 1.5, 1, 0.5),
        place('marrow-bayside', 'Bayside', 1.2, 0, 0.5, 1.5),
        place('marrow-flats', 'The Flats', 0.8, 1, 0, 0.5),
        place('marrow-lantern', 'Lantern Row', 1.5, 0, 0, 0.8),
        place('marrow-shipwrights', 'Shipwrights', 0.5, 1.2, 1.5, 0.5)
      ] },
    { id: 'dunmore', name: 'Dunmore', x: -15, y: 235, terrain: 'hills', character: 'Coal, rail and breweries. Hard men and company stores.', rival: 'Kessler',
      districts: [
        place('dunmore-depot', 'Depot', 0.8, 1.2, 0.8, 0.5),
        place('dunmore-coalhill', 'Coal Hill', 0.5, 1.5, 0, 0.5),
        place('dunmore-main', 'Main Street', 1.2, 0.5, 0, 1.2),
        place('dunmore-brewers', 'Brewers Yard', 1, 1.2, 0, 0.8),
        place('dunmore-pitrow', 'Pit Row', 0.5, 1.5, 0, 0.5),
        place('dunmore-gallows', 'Gallows Corner', 1.5, 0.5, 0, 0.5)
      ] },
    { id: 'lorne', name: 'Port Lorne', x: 50, y: 370, terrain: 'coast', character: 'The sea port at the border. Whisky comes in here.', rival: 'Dockers',
      districts: [
        place('lorne-harbour', 'Harbour', 1, 0.8, 1.5, 0.5),
        place('lorne-saltworks', 'Saltworks', 0.5, 1.5, 0.5, 0.5),
        place('lorne-chapel', 'Chapel Hill', 0.5, 0, 0, 1.5),
        place('lorne-netmakers', 'Netmakers', 0.8, 1, 1, 0.5),
        place('lorne-customs', 'Customs House', 0.5, 0.5, 1.5, 1.2),
        place('lorne-ropewalk', 'Rope Walk', 1.5, 0.5, 0.8, 0.5),
        place('lorne-breakwater', 'Breakwater', 0.8, 0.5, 1.2, 0.5)
      ] },
    { id: 'vesper', name: 'Saint Vesper', x: -85, y: 300, terrain: 'plain', character: 'The cathedral city. Judges, bishops and old money.', rival: 'Callahan',
      districts: [
        place('vesper-cathedral', 'Cathedral', 0.5, 0, 0, 1.5),
        place('vesper-tannery', 'Tannery', 0.5, 1.5, 0, 0.5),
        place('vesper-hill', 'Vesper Hill', 0.8, 0, 0, 1.5),
        place('vesper-lowgate', 'Lowgate', 1.5, 0.5, 0, 0.5),
        place('vesper-bishops', 'Bishops Court', 1, 0, 0, 1.5),
        place('vesper-slaughter', 'Slaughter Lane', 1, 1.2, 0, 0.5),
        place('vesper-paupers', 'Paupers Field', 0.8, 0.8, 0, 0.5)
      ] }
  ];
  var ROUTES = [
    { from: 'ashport', to: 'calder', kind: 'rail' },
    { from: 'ashport', to: 'marrow', kind: 'road' },
    { from: 'ashport', to: 'dunmore', kind: 'rail' },
    { from: 'calder', to: 'marrow', kind: 'road' },
    { from: 'marrow', to: 'dunmore', kind: 'road' },
    { from: 'dunmore', to: 'vesper', kind: 'road' },
    { from: 'dunmore', to: 'lorne', kind: 'rail' },
    { from: 'vesper', to: 'lorne', kind: 'road' },
    { from: 'marrow', to: 'lorne', kind: 'sea' }
  ];
  var SEATS = ['bookkeeper', 'routes', 'fixer'];
  var RULES = {
    startCash: 2500,     // dirty $ the boss starts with
    moveInCost: 1000,    // dirty $ the boss pays to set a capo up in a new district
    foothold: { share: 5, men: 8, dirty: 500, clean: 0, heat: 20, goodwill: 40, sites: { still: 1, speakeasy: 1 } },
    attackEvery: 6,      // months between two moves of a rival family
    rivalStrength: 3,    // what a district must put up to throw the rivals back
    rivalGrowth: 0.5,    // how much bolder the rivals get every year
    hitStreets: 8,       // streets lost to a successful attack
    hitLoot: 0.2,        // share of the stash the rivals carry off
    alarm: 6,            // months a capo stays on his guard after a hit
    grace: 12            // months the rivals leave a new foothold alone
  };
  var HOME = 'ashport-hillside';

  function cityOf(id) {
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i];
    throw new Error('no such city: ' + id);
  }
  function district(w, id) {
    if (!w.districts[id]) throw new Error('no such district: ' + id);
    return w.districts[id];
  }
  function districts(w) {
    var list = [];
    CITIES.forEach(function (c) { c.districts.forEach(function (p) { list.push(w.districts[p.id]); }); });
    return list;
  }
  function familyDistricts(w) { return districts(w).filter(function (x) { return x.owner === 'family'; }); }
  function placeOf(id) {
    var found = null;
    CITIES.forEach(function (c) { c.districts.forEach(function (p) { if (p.id === id) found = p; }); });
    return found;
  }

  // Everyone who holds a post in the family.
  function posts(w) {
    var list = [];
    SEATS.forEach(function (s) { if (w.table[s]) list.push({ capo: w.table[s], post: s, by: 'boss' }); });
    Object.keys(w.underbosses).forEach(function (c) { list.push({ capo: w.underbosses[c], post: 'underboss:' + c, by: 'boss' }); });
    familyDistricts(w).forEach(function (x) { list.push({ capo: x.state.capo, post: x.id, by: x.appointedBy || 'boss' }); });
    return list;
  }
  // Only the people the boss named himself: the table, the underbosses, and
  // the capos of the districts no underboss looks after.
  function named(w) {
    return posts(w).filter(function (n) { return n.by === 'boss'; }).map(function (n) { return { capo: n.capo, post: n.post }; });
  }
  function mustBeFree(w, capo) {
    if (!D.CAPOS[capo]) throw new Error('unknown capo: ' + capo);
    posts(w).forEach(function (n) { if (n.capo === capo) throw new Error(capo + ' already holds ' + n.post); });
  }
  // The underboss's choice: the free capo whose tastes suit the district
  // best, with a leaning toward men who think like him.
  function pickCapo(w, id, underboss) {
    var traits = placeOf(id).traits, taken = {}, best = null, bestScore = -1;
    posts(w).forEach(function (n) { taken[n.capo] = true; });
    Object.keys(D.CAPOS).forEach(function (key) {
      if (taken[key]) return;
      var c = D.CAPOS[key], score = 0;
      c.likes.forEach(function (k) {
        if (D.RACKETS.indexOf(k) >= 0) score = Math.max(score, traits[D.SITES[k].trait]);
        if (D.CAPOS[underboss].likes.indexOf(k) >= 0) score += 0.25;
      });
      if (score > bestScore) { best = key; bestScore = score; }
    });
    if (!best) throw new Error('nobody left to name in ' + id);
    return best;
  }
  function tableSupport(w) {
    return { bookkeeper: !!w.table.bookkeeper, routes: !!w.table.routes, fixer: !!w.table.fixer };
  }
  function shareSupport(w) {
    var s = tableSupport(w);
    familyDistricts(w).forEach(function (x) { x.state.support = { bookkeeper: s.bookkeeper, routes: s.routes, fixer: s.fixer }; });
  }

  function reachable(w, id) {
    var target = w.districts[id].city, cities = {};
    familyDistricts(w).forEach(function (x) { cities[x.city] = true; });
    if (cities[target]) return true;
    return ROUTES.some(function (r) { return (r.from === target && cities[r.to]) || (r.to === target && cities[r.from]); });
  }

  // The family moves into a district and the boss names who runs it.
  // (How a district is taken from a rival is a later step: for now it is given.)
  function claim(w, id, capo) {
    var x = district(w, id), p = placeOf(id), underboss = w.underbosses[x.city], by = 'boss';
    if (x.owner === 'family') throw new Error(id + ' is already the family\'s');
    if (capo) mustBeFree(w, capo);
    else if (!underboss) throw new Error('name a capo for ' + id + ': the family has no underboss in that city');
    if (!reachable(w, id)) throw new Error(id + ' is out of reach: the family holds nothing next to it');
    if (w.treasury.dirty < RULES.moveInCost) throw new Error('the boss cannot afford to move into ' + id);
    if (!capo) { capo = pickCapo(w, id, underboss); by = underboss; }
    var start = { capo: capo, name: p.name, traits: p.traits, support: tableSupport(w) };
    Object.keys(RULES.foothold).forEach(function (k) { start[k] = RULES.foothold[k]; });
    w.treasury.dirty -= RULES.moveInCost;
    x.owner = 'family';
    x.state = D.createDistrict(start);
    x.appointedBy = by === 'boss' ? null : by;
  }

  // The boss puts a city in the hands of an underboss, who then names its capos.
  function setUnderboss(w, cityId, capo) {
    cityOf(cityId);
    var mine = familyDistricts(w).filter(function (x) { return x.city === cityId; });
    if (mine.length < 2) throw new Error('an underboss needs a city where the family holds two districts');
    mustBeFree(w, capo);
    w.underbosses[cityId] = capo;
  }

  function defence(s) {
    return s.guards * (0.5 + D.CAPOS[s.capo].muscle / 10) + s.crews;
  }
  function rivalStrength(w, cityId) {
    cityOf(cityId);
    return RULES.rivalStrength + RULES.rivalGrowth * w.month / 12;
  }
  // The rival family of a city goes for the family's weakest district there.
  function attack(w, c) {
    var mine = familyDistricts(w).filter(function (x) { return x.city === c.id && (x.id === HOME || x.state.month > RULES.grace); });
    if (!mine.length) return null;
    var target = mine.reduce(function (a, b) { return defence(b.state) < defence(a.state) ? b : a; });
    var s = target.state, e = { type: 'attack', by: c.rival, district: target.id, city: c.id };
    if (defence(s) >= rivalStrength(w, c.id)) {
      e.outcome = 'repelled'; e.streets = 0; e.stolen = 0; e.site = null;
      e.label = 'The ' + c.rival + 's come for ' + s.name + ' and are thrown back';
      return e;
    }
    var site = null;
    Object.keys(s.sites).forEach(function (k) {
      if (k !== 'warehouse' && s.sites[k] > (site ? s.sites[site] : 0)) site = k;
    });
    e.outcome = 'hit';
    e.streets = Math.min(s.share, RULES.hitStreets);
    e.stolen = s.dirty * RULES.hitLoot;
    e.site = site;
    s.share -= e.streets;
    s.dirty -= e.stolen;
    s.lost += e.stolen;
    if (site) s.sites[site] -= 1;
    s.attacked = RULES.alarm;
    e.label = 'The ' + c.rival + 's hit ' + s.name + ': ' + (site ? 'a ' + D.SITES[site].name.toLowerCase() + ' burns, ' : '') + '$' + Math.round(e.stolen) + ' gone';
    return e;
  }

  // The boss replaces the capo of a district. The district stays as it is.
  function appoint(w, id, capo) {
    var x = district(w, id);
    if (x.owner !== 'family') throw new Error(id + ' is not the family\'s');
    mustBeFree(w, capo);
    x.state.capo = capo;
  }

  function seat(w, name, capo) {
    if (SEATS.indexOf(name) < 0) throw new Error('no such seat: ' + name);
    mustBeFree(w, capo);
    w.table[name] = capo;
    shareSupport(w);
  }
  function unseat(w, name) {
    if (SEATS.indexOf(name) < 0) throw new Error('no such seat: ' + name);
    w.table[name] = null;
    shareSupport(w);
  }

  // One month everywhere. Returns what happened, tagged with its place.
  function stepMonth(w) {
    var events = [];
    familyDistricts(w).forEach(function (x) {
      var before = { dirty: x.state.boss.dirty, clean: x.state.boss.clean };
      D.stepMonth(x.state).forEach(function (e) {
        e.district = x.id;
        e.city = x.city;
        events.push(e);
      });
      w.treasury.dirty += x.state.boss.dirty - before.dirty;
      w.treasury.clean += x.state.boss.clean - before.clean;
    });
    w.month += 1;
    if (w.month % RULES.attackEvery === 0) {
      CITIES.forEach(function (c) { var e = attack(w, c); if (e) events.push(e); });
    }
    return events;
  }

  function cityReport(w, cityId) {
    var c = cityOf(cityId), mine = [];
    c.districts.forEach(function (p) { if (w.districts[p.id].owner === 'family') mine.push(w.districts[p.id].state); });
    var sum = function (k) { return mine.reduce(function (n, s) { return n + s[k]; }, 0); };
    return { id: c.id, name: c.name, districts: c.districts.length, held: mine.length,
             share: sum('share') / c.districts.length, heat: mine.length ? sum('heat') / mine.length : 0,
             men: sum('men') };
  }

  // Everything the map needs, as one plain object.
  function view(w) {
    return {
      month: w.month,
      treasury: { dirty: w.treasury.dirty, clean: w.treasury.clean },
      table: { bookkeeper: w.table.bookkeeper, routes: w.table.routes, fixer: w.table.fixer },
      underbosses: JSON.parse(JSON.stringify(w.underbosses)),
      routes: ROUTES.map(function (r) { return { from: r.from, to: r.to, kind: r.kind }; }),
      cities: CITIES.map(function (c) {
        var report = cityReport(w, c.id);
        return {
          id: c.id, name: c.name, x: c.x, y: c.y, terrain: c.terrain, character: c.character, held: report.held, share: report.share, heat: report.heat,
          districts: c.districts.map(function (p) {
            var x = w.districts[p.id], s = x.state;
            return { id: p.id, name: p.name, traits: p.traits, owner: x.owner, capo: s ? s.capo : null, appointedBy: x.appointedBy,
                     share: s ? s.share : 0, heat: s ? s.heat : 0, goodwill: s ? s.goodwill : 0, men: s ? s.men : 0,
                     crews: s ? s.crews : 0, watched: s ? s.watched > 0 : false,
                     buildings: s ? D.buildings(s) : [] };
          })
        };
      })
    };
  }

  function createWorld(options) {
    var o = options || {};
    var w = { month: 0, treasury: { dirty: RULES.startCash, clean: 0 }, table: { bookkeeper: null, routes: null, fixer: null },
              underbosses: {}, districts: {} };
    CITIES.forEach(function (c) {
      c.districts.forEach(function (p) { w.districts[p.id] = { id: p.id, city: c.id, owner: c.rival, state: null, appointedBy: null }; });
    });
    var home = placeOf(HOME);
    w.districts[HOME].owner = 'family';
    w.districts[HOME].state = D.createDistrict({ capo: o.capo, name: home.name, traits: home.traits });
    return w;
  }

  var api = { CITIES: CITIES, ROUTES: ROUTES, SEATS: SEATS, RULES: RULES, setUnderboss: setUnderboss, defence: defence,
              rivalStrength: rivalStrength, posts: posts, createWorld: createWorld, district: district, districts: districts,
              claim: claim, appoint: appoint, seat: seat, unseat: unseat, named: named, stepMonth: stepMonth,
              cityReport: cityReport, view: view };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportWorld = api;
})(typeof self !== 'undefined' ? self : this);
