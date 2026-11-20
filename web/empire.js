// The game without districts, as the screen sees it. No drawing and no browser here.
//
// The screen calls tick() on a timer, sends the boss's orders through
// command(), and reads hud(), view(), candidates() and the journal to draw.
// Everything that decides anything lives in turf.js; this file only keeps
// time, translates, and saves.
(function (root) {
  'use strict';

  var node = typeof require === 'function';
  var T = node ? require('./turf.js') : root.AshportTurf;
  var W = node ? require('./world.js') : root.AshportWorld;
  var D = node ? require('./district.js') : root.AshportDistrict;

  var VERSION = 3;            // 1 was the game by districts, since removed
  var TICKS_PER_MONTH = 4;
  var SPEEDS = [1, 2, 4];
  var JOURNAL_SIZE = 200;
  var FIRST_YEAR = 1926;
  var BLOCK = { w: 5, h: 6 }; // blocks under each street name
  var START_CASH = 2500;      // dirty $ the boss starts with: what it takes to set up the first man who knocks
  var RIVAL_PLACES = 30;      // places the family in place holds on top of the key places
  var NAMES = ['sal', 'mae', 'dutch', 'tommy', 'vince', 'danny']; // the six a boss can start with
  var STOPS = { asks: true, knocks: true, feud: true }; // what waits for the boss's word stops the clock
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function dateOf(month) { return MONTHS[month % 12] + ' ' + (FIRST_YEAR + Math.floor(month / 12)); }

  // A city of world.js laid out as blocks: its street names side by side on
  // two rows, the last one taking whatever is left of its row.
  // The blocks a city's outline takes away: each side eaten in by so many blocks. Where two sides meet, the first one named wins.
  function voidsOf(spec, w, h) {
    var seen = {}, out = [];
    (spec.gaps || []).forEach(function (g) {
      g.depths.forEach(function (deep, i) {
        for (var d = 0; d < deep; d++) {
          var along = g.from + i, x = g.side === 'west' ? d : g.side === 'east' ? w - 1 - d : along, y = g.side === 'north' ? d : g.side === 'south' ? h - 1 - d : along;
          if (x < 0 || y < 0 || x >= w || y >= h || seen[x + ',' + y]) continue;
          seen[x + ',' + y] = true; out.push({ x: x, y: y, kind: g.kind });
        }
      });
    });
    return out;
  }
  function layout(spec) {
    var n = spec.districts.length, cols = Math.ceil(n / 2), w = cols * BLOCK.w, h = 2 * BLOCK.h;
    return T.createCity({ id: spec.id, w: w, h: h, voids: voidsOf(spec, w, h), zones: spec.districts.map(function (d, i) {
      var col = i % cols, row = Math.floor(i / cols), last = i === n - 1;
      return { name: d.name, x0: col * BLOCK.w, y0: row * BLOCK.h, x1: last ? cols * BLOCK.w - 1 : (col + 1) * BLOCK.w - 1, y1: (row + 1) * BLOCK.h - 1, traits: d.traits };
    }) });
  }
  function linked(a, b) { return W.ROUTES.some(function (r) { return (r.from === a && r.to === b) || (r.from === b && r.to === a); }); }
  function held(g, c) { return Object.keys(g.family.men).some(function (id) { return T.clubOf(c, id); }); }
  function specOf(id) { return W.CITIES.filter(function (c) { return c.id === id; })[0]; }

  function createGame(options) {
    var g = { version: VERSION, started: false, paused: false, speed: 1, ticks: 0, month: 0, family: null, cities: [], journal: [] };
    if (options && options.capo) start(g, options.capo);
    return g;
  }
  function start(g, capo) {
    if (g.started) throw new Error('the game has already started');
    if (NAMES.indexOf(capo) < 0) throw new Error('unknown capo: ' + capo);
    // every city of the map, each held by the family that was there first and laid out by its own dice
    g.cities = W.CITIES.map(function (spec, i) {
      var c = layout(spec);
      c.dice = i + 1;
      T.crown(c, spec.rival);
      T.seed(c, spec.rival, Math.round(RIVAL_PLACES * c.w * c.h / 240));
      return c;
    });
    var home = g.cities[0], spot = T.landing(home);
    g.family = T.createFamily();
    g.family.dirty = START_CASH;
    T.settle(home, capo, spot.x, spot.y);
    T.join(g.family, capo);
    g.started = true;
  }

  function record(g, e, month) {
    var line = { month: month, date: dateOf(month) };
    Object.keys(e).forEach(function (k) { line[k] = e[k]; });
    g.journal.push(line);
    if (g.journal.length > JOURNAL_SIZE) g.journal.splice(0, g.journal.length - JOURNAL_SIZE);
  }
  // One beat of the clock. A month of rules every TICKS_PER_MONTH beats at speed 1.
  function tick(g) {
    if (!g.started || g.paused) return [];
    g.ticks += g.speed;
    var events = [];
    while (g.ticks >= TICKS_PER_MONTH && !g.paused) {
      g.ticks -= TICKS_PER_MONTH;
      var month = g.month, was = { dirty: g.family.dirty, clean: g.family.clean || 0 };
      var happened = T.month(g.family, g.cities, W.ROUTES);
      g.change = { dirty: Math.round(g.family.dirty) - Math.round(was.dirty), clean: Math.round(g.family.clean || 0) - Math.round(was.clean) };
      g.waiting = g.waiting || {};
      happened.forEach(function (e) {
        record(g, e, month);
        events.push(e);
        // a man the boss can neither seat nor send anywhere waits at the door without stopping the clock
        if (e.type === 'knocks' && !canAnswer(g, cityOf(g, e.city), e.capo)) return;
        if (STOPS[e.type]) g.paused = true;
      });
      // and is announced again the day a word can be given
      g.cities.forEach(function (c) {
        T.doors(c, g.family).forEach(function (d) {
          var k = c.id + ':' + d.capo;
          if (!answerable(g, c, d)) { g.waiting[k] = true; return; }
          if (!g.waiting[k]) return;
          delete g.waiting[k];
          var e = { type: 'knocks', ready: true, capo: d.capo, city: c.id, door: d.door, by: d.by, cost: d.cost, label: d.name + ' can now be taken in' };
          record(g, e, month); events.push(e); g.paused = true;
        });
      });
      g.month += 1;
    }
    return events;
  }

  // Where a man at the door could be sent instead: the cities next door that still have a seat.
  function roadsOf(g, c, d) {
    if (d.door === 'poach') return [];
    return g.cities.filter(function (q) {
      var s = T.seats(q);
      return linked(c.id, q.id) && s.taken < s.total;
    }).map(function (q) { return { city: q.id, name: specOf(q.id).name, cost: d.cost + T.RULES.doors.road }; });
  }
  // Can the boss say yes to this man today: a seat here or down a road, and the money for it.
  function answerable(g, c, d) {
    var s = T.seats(c), has = T.funds(g.family);
    return (s.taken < s.total && has >= d.cost) || roadsOf(g, c, d).some(function (r) { return has >= r.cost; });
  }
  function canAnswer(g, c, capo) {
    var d = T.doors(c, g.family).filter(function (q) { return q.capo === capo; })[0];
    return !!d && answerable(g, c, d);
  }
  function cityOf(g, id) {
    var c = g.cities.filter(function (q) { return q.id === id; })[0];
    if (!c) throw new Error('no such city: ' + id);
    return c;
  }
  var ORDERS = {
    start: function (g, o) { start(g, o.capo); },
    pause: function (g) { g.paused = true; },
    resume: function (g) { g.paused = false; },
    speed: function (g, o) {
      if (SPEEDS.indexOf(o.speed) < 0) throw new Error('no such speed: ' + o.speed);
      g.speed = o.speed;
    },
    // a capo asked for a key place: the boss says yes or no
    answer: function (g, o) {
      var c = cityOf(g, o.city), a = T.asks(c).filter(function (q) { return q.id === o.id; })[0];
      T.answer(c, g.family, o.id, !!o.yes);
      record(g, { type: o.yes ? 'granted' : 'denied', capo: a.capo, city: c.id, key: a.key, x: a.x, y: a.y,
                  label: o.yes ? 'You give ' + T.person(a.capo).name + ' your word for the ' + a.name : 'You tell ' + T.person(a.capo).name + ' to leave the ' + a.name + ' alone' }, g.month);
    },
    // somebody is at the door: the boss takes him in and picks the street for his club
    // or sends him down the road: `from` is the city where he knocked, `city` the one he opens
    // a man at the door takes a chair at the boss's table instead of a street; and the boss takes a chair back
    seat: function (g, o) {
      T.seat(cityOf(g, o.city), g.family, o.capo, o.post);
      var chair = T.table(g.family).filter(function (s) { return s.post === o.post; })[0];
      record(g, { type: 'seated', capo: o.capo, city: o.city, post: o.post, label: chair.who + ' takes the ' + chair.name + '\'s chair at the table' }, g.month);
    },
    unseat: function (g, o) {
      var chair = T.table(g.family).filter(function (s) { return s.post === o.post; })[0];
      T.unseat(g.family, o.post);
      record(g, { type: 'unseated', capo: chair.capo, post: o.post, label: chair.who + ' leaves the table, and the family' }, g.month);
    },
    // the boss names the capo who holds a city for him: he takes in the men at its door from then on
    underboss: function (g, o) {
      var c = cityOf(g, o.city);
      T.underboss(c, g.family, o.capo);
      record(g, { type: 'underboss', capo: o.capo, city: c.id, label: T.person(o.capo).name + ' is now the family\'s underboss in ' + specOf(c.id).name }, g.month);
    },
    // the boss makes one of his capos a gift, in clean money: it warms a man who was turning sour
    gift: function (g, o) {
      var c = cityOf(g, o.city);
      T.gift(c, g.family, o.capo);
      var club = T.clubOf(c, o.capo);
      record(g, { type: 'gift', capo: o.capo, city: c.id, cost: T.RULES.loyal.gift, x: club.x, y: club.y, label: 'You make ' + T.person(o.capo).name + ' a gift' }, g.month);
    },
    welcome: function (g, o) {
      var c = cityOf(g, o.city), from = cityOf(g, o.from || o.city);
      if (from !== c && !linked(from.id, c.id)) throw new Error('no road from ' + specOf(from.id).name + ' to ' + specOf(c.id).name);
      T.send(from, c, g.family, o.capo, o.x, o.y);
      var club = T.clubOf(c, o.capo), e = { type: 'welcomed', capo: o.capo, city: c.id, x: club.x, y: club.y,
        label: T.person(o.capo).name + ' joins the family and opens his club in ' + T.zoneOf(c, club.x, club.y).name + (from !== c ? ', ' + specOf(c.id).name : '') };
      if (from !== c) e.from = from.id;
      record(g, e, g.month);
    },
    // two capos are at each other's throats: the boss rules for one of them
    rule: function (g, o) {
      var c = cityOf(g, o.city), r = T.rule(c, g.family, o.id, o.winner);
      record(g, { type: 'ruled', city: c.id, winner: r.winner, loser: r.loser,
                  label: 'You rule for ' + T.person(r.winner).name + '. ' + T.person(r.loser).name + ' will not forget it' }, g.month);
    },
    // the boss parts with a capo: paid off, killed, or given to the police
    part: function (g, o) {
      var c = cityOf(g, o.city), name = T.person(o.capo) ? T.person(o.capo).name : o.capo, r = T.part(c, g.family, o.capo, o.way);
      var said = { retire: 'You pay ' + name + ' off. He leaves the city', kill: name + ' is found in the river', jail: 'The police come for ' + name + ' at dawn' };
      record(g, { type: 'parted', capo: o.capo, city: c.id, way: o.way, kept: r.kept, closed: r.closed,
                  label: said[o.way] + (r.closed ? ': ' + r.closed + (r.closed > 1 ? ' places close' : ' place closes') : '') }, g.month);
    },
    research: function (g, o) {
      T.research(g.family, o.building);
      record(g, { type: 'studying', kind: o.building, label: 'The family starts learning: ' + (o.building === 'cars' ? 'bigger cars' : D.SITES[o.building].name) }, g.month);
    }
  };
  function command(g, order) {
    var run = order && ORDERS[order.type];
    if (!run) throw new Error('no such order: ' + (order && order.type));
    if (!g.started && order.type !== 'start') throw new Error('the game has not started');
    run(g, order);
  }

  // The six a boss can start with, for the first screen.
  function candidates() {
    return NAMES.map(function (id) {
      var c = T.person(id);
      return { id: id, name: c.name, specialty: c.specialty, muscle: c.muscle, business: c.business, cunning: c.cunning, charisma: c.charisma,
               loyalty: c.loyalty, ambition: c.ambition, way: T.wayOf(id), trade: D.SITES[T.tradeOf(id)].name,
               likes: c.likes.filter(function (k) { return D.SITES[k]; }).map(function (k) { return D.SITES[k].name; }),
               refuses: c.refuses.filter(function (k) { return D.SITES[k]; }).map(function (k) { return D.SITES[k].name; }) };
    });
  }
  function view(g) {
    if (!g.started) return { date: dateOf(0), cities: [], tree: [] };
    return { date: dateOf(g.month), month: g.month, tree: T.tree(g.family), study: g.family.study, table: T.table(g.family),
             routes: W.ROUTES.map(function (r) { return { from: r.from, to: r.to, kind: r.kind }; }),
             cities: g.cities.map(function (c) {
               var v = T.view(c, g.family);
               v.name = specOf(c.id).name;
               v.held = held(g, c);
               // where each man at the door could be sent instead: the cities next door that still have a seat
               var free = T.table(g.family).filter(function (s) { return !s.capo; }).map(function (s) { return s.post; });
               v.doors.forEach(function (d) { d.roads = roadsOf(g, c, d); d.open = answerable(g, c, d); d.chairs = d.door === 'poach' ? [] : free; if (v.under && d.door !== 'poach') d.handled = v.under; });
               return v;
             }) };
  }
  function hud(g) {
    var out = { date: dateOf(g.month), paused: g.paused, speed: g.speed, started: g.started };
    if (!g.started) return out;
    var blocks = 0, ours = 0, heat = 0, pending = 0, seats = { taken: 0, total: 0 }, cities = { held: 0, total: g.cities.length };
    g.cities.forEach(function (c) {
      var s = T.share(c), n = T.size(c), k = T.seats(c);
      blocks += n; ours += s.family * n / 100; heat = Math.max(heat, c.heat || 0);
      pending += T.asks(c).length + T.doors(c, g.family).filter(function (d) { return answerable(g, c, d); }).length + T.feuds(c).length;
      if (!held(g, c)) return;
      cities.held += 1; seats.taken += k.taken; seats.total += k.total;
    });
    out.cities = cities;
    out.change = g.change || { dirty: 0, clean: 0 }; // what last month did to the two kinds of money
    out.dirty = Math.round(g.family.dirty); out.clean = Math.round(g.family.clean);
    out.heat = heat; out.share = Math.round(ours * 100 / blocks); out.men = Object.keys(g.family.men).length;
    out.seats = seats; out.pending = pending;
    return out;
  }

  function save(g) { return JSON.stringify(g); }
  function load(text) {
    var g;
    try { g = JSON.parse(text); } catch (e) { throw new Error('this saved game cannot be read'); }
    if (!g || typeof g !== 'object') throw new Error('this saved game cannot be read');
    if (g.version !== VERSION) throw new Error('this game was saved by an older version of Ashport and cannot be continued');
    return g;
  }

  var api = { layout: layout, START_CASH: START_CASH, VERSION: VERSION, TICKS_PER_MONTH: TICKS_PER_MONTH, SPEEDS: SPEEDS, JOURNAL_SIZE: JOURNAL_SIZE, NAMES: NAMES,
              createGame: createGame, tick: tick, command: command, candidates: candidates, view: view, hud: hud, save: save, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportEmpire = api;
})(typeof self !== 'undefined' ? self : this);
