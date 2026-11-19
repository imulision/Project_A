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

  // terrain is for the map; character says what the city is good for;
  // rival is the family that holds it at the start.
  var CITIES = [
    { id: 'ashport', name: 'Ashport', terrain: 'lake', character: 'The big lake port. Everything passes through it.', rival: 'Callahan',
      districts: [
        place('ashport-hillside', 'Hillside', 1, 0.4, 0, 1.2),
        place('ashport-docks', 'The Docks', 0.8, 1.2, 1.5, 0.5),
        place('ashport-market', 'Market Street', 1.5, 0.5, 0, 1),
        place('ashport-stockyards', 'Stockyards', 0.5, 1.5, 0.5, 0.5),
        place('ashport-uptown', 'Uptown', 1.2, 0, 0, 1.5)
      ] },
    { id: 'calder', name: 'Calder Falls', terrain: 'mountains', character: 'A mill town in the hills. Unions and timber.', rival: 'Novak',
      districts: [
        place('calder-millrace', 'Millrace', 0.5, 1.5, 0, 0.5),
        place('calder-highstreet', 'High Street', 1, 0.5, 0, 1),
        place('calder-sawyers', 'Sawyers Row', 0.8, 1.2, 0, 0.5),
        place('calder-heights', 'The Heights', 0.5, 0, 0, 1.5)
      ] },
    { id: 'laurent', name: 'Port Laurent', terrain: 'river', character: 'The border town on the river. Whisky comes in here.', rival: 'Duval',
      districts: [
        place('laurent-landing', 'The Landing', 1, 0.5, 1.5, 0.5),
        place('laurent-customs', 'Customs Row', 0.5, 0.5, 1.2, 1),
        place('laurent-frenchtown', 'Frenchtown', 1.5, 0.5, 0.5, 0.8),
        place('laurent-ferry', 'Ferry Point', 0.8, 1, 1, 0.5)
      ] },
    { id: 'adele', name: 'Saint Adele', terrain: 'plain', character: 'The state capital. Judges, senators and old money.', rival: 'Whitcombe',
      districts: [
        place('adele-capitol', 'Capitol Hill', 0.8, 0, 0, 1.5),
        place('adele-oldquarter', 'Old Quarter', 1.5, 0.5, 0, 1),
        place('adele-southside', 'Southside', 1, 1, 0, 0.5),
        place('adele-fairgrounds', 'Fairgrounds', 1.2, 0.5, 0, 0.8)
      ] },
    { id: 'blackwater', name: 'Blackwater', terrain: 'mountains', character: 'Coal and rail. Hard men and company stores.', rival: 'Kessler',
      districts: [
        place('blackwater-pithead', 'Pithead', 0.5, 1.5, 0, 0.5),
        place('blackwater-junction', 'The Junction', 1, 1.2, 0.5, 0.5),
        place('blackwater-company', 'Company Town', 0.5, 1, 0, 0.8),
        place('blackwater-ridge', 'Ridge Road', 0.8, 0.5, 0, 1.2)
      ] },
    { id: 'marrow', name: 'Marrow Bay', terrain: 'coast', character: 'A seaside resort. Casinos, hotels and night boats.', rival: 'Santoro',
      districts: [
        place('marrow-boardwalk', 'The Boardwalk', 1.5, 0, 0.5, 1.2),
        place('marrow-harbor', 'Harbor Side', 1, 0.5, 1.5, 0.5),
        place('marrow-grand', 'Grand Avenue', 1.2, 0, 0, 1.5),
        place('marrow-cannery', 'Cannery Flats', 0.5, 1.2, 1, 0.5)
      ] }
  ];
  var ROUTES = [
    { from: 'ashport', to: 'calder', kind: 'rail' },
    { from: 'ashport', to: 'laurent', kind: 'river' },
    { from: 'ashport', to: 'adele', kind: 'road' },
    { from: 'adele', to: 'blackwater', kind: 'rail' },
    { from: 'calder', to: 'blackwater', kind: 'road' },
    { from: 'adele', to: 'marrow', kind: 'rail' },
    { from: 'laurent', to: 'marrow', kind: 'sea' }
  ];
  var SEATS = ['bookkeeper', 'routes', 'fixer'];
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

  // Everyone the boss has named, with the post each one holds.
  function named(w) {
    var list = [];
    SEATS.forEach(function (s) { if (w.table[s]) list.push({ capo: w.table[s], post: s }); });
    familyDistricts(w).forEach(function (x) { list.push({ capo: x.state.capo, post: x.id }); });
    return list;
  }
  function mustBeFree(w, capo) {
    if (!D.CAPOS[capo]) throw new Error('unknown capo: ' + capo);
    named(w).forEach(function (n) { if (n.capo === capo) throw new Error(capo + ' already holds ' + n.post); });
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
    var x = district(w, id), p = placeOf(id);
    if (x.owner === 'family') throw new Error(id + ' is already the family\'s');
    mustBeFree(w, capo);
    if (!reachable(w, id)) throw new Error(id + ' is out of reach: the family holds nothing next to it');
    x.owner = 'family';
    x.state = D.createDistrict({ capo: capo, name: p.name, traits: p.traits, support: tableSupport(w) });
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
      routes: ROUTES.map(function (r) { return { from: r.from, to: r.to, kind: r.kind }; }),
      cities: CITIES.map(function (c) {
        var report = cityReport(w, c.id);
        return {
          id: c.id, name: c.name, terrain: c.terrain, character: c.character, held: report.held, share: report.share, heat: report.heat,
          districts: c.districts.map(function (p) {
            var x = w.districts[p.id], s = x.state;
            return { id: p.id, name: p.name, traits: p.traits, owner: x.owner, capo: s ? s.capo : null,
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
    var w = { month: 0, treasury: { dirty: 0, clean: 0 }, table: { bookkeeper: null, routes: null, fixer: null }, districts: {} };
    CITIES.forEach(function (c) {
      c.districts.forEach(function (p) { w.districts[p.id] = { id: p.id, city: c.id, owner: c.rival, state: null }; });
    });
    var home = placeOf(HOME);
    w.districts[HOME].owner = 'family';
    w.districts[HOME].state = D.createDistrict({ capo: o.capo, name: home.name, traits: home.traits });
    return w;
  }

  var api = { CITIES: CITIES, ROUTES: ROUTES, SEATS: SEATS, createWorld: createWorld, district: district, districts: districts,
              claim: claim, appoint: appoint, seat: seat, unseat: unseat, named: named, stepMonth: stepMonth,
              cityReport: cityReport, view: view };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportWorld = api;
})(typeof self !== 'undefined' ? self : this);
