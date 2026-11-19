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

  var VERSION = 2;            // 1 was the game by districts (game.js)
  var TICKS_PER_MONTH = 4;
  var SPEEDS = [1, 2, 4];
  var JOURNAL_SIZE = 200;
  var FIRST_YEAR = 1926;
  var BLOCK = { w: 5, h: 6 }; // blocks under each street name
  var RIVAL_PLACES = 30;      // places the family in place holds on top of the key places
  var NAMES = ['sal', 'mae', 'dutch', 'tommy', 'vince', 'danny']; // the six a boss can start with
  var STOPS = { asks: true, knocks: true }; // what waits for the boss's word stops the clock
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function dateOf(month) { return MONTHS[month % 12] + ' ' + (FIRST_YEAR + Math.floor(month / 12)); }

  // A city of world.js laid out as blocks: its street names side by side on
  // two rows, the last one taking whatever is left of its row.
  function layout(spec) {
    var n = spec.districts.length, cols = Math.ceil(n / 2);
    return T.createCity({ id: spec.id, w: cols * BLOCK.w, h: 2 * BLOCK.h, zones: spec.districts.map(function (d, i) {
      var col = i % cols, row = Math.floor(i / cols), last = i === n - 1;
      return { name: d.name, x0: col * BLOCK.w, y0: row * BLOCK.h, x1: last ? cols * BLOCK.w - 1 : (col + 1) * BLOCK.w - 1, y1: (row + 1) * BLOCK.h - 1, traits: d.traits };
    }) });
  }
  function specOf(id) { return W.CITIES.filter(function (c) { return c.id === id; })[0]; }

  function createGame(options) {
    var g = { version: VERSION, started: false, paused: false, speed: 1, ticks: 0, month: 0, family: null, cities: [], journal: [] };
    if (options && options.capo) start(g, options.capo);
    return g;
  }
  function start(g, capo) {
    if (g.started) throw new Error('the game has already started');
    if (NAMES.indexOf(capo) < 0) throw new Error('unknown capo: ' + capo);
    var spec = W.CITIES[0], c = layout(spec);
    T.crown(c, spec.rival);
    T.seed(c, spec.rival, RIVAL_PLACES);
    var spot = T.landing(c);
    g.family = T.createFamily();
    T.settle(c, capo, spot.x, spot.y);
    T.join(g.family, capo);
    g.cities = [c];
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
      var month = g.month;
      T.month(g.family, g.cities).forEach(function (e) {
        record(g, e, month);
        events.push(e);
        if (STOPS[e.type]) g.paused = true;
      });
      g.month += 1;
    }
    return events;
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
    welcome: function (g, o) {
      var c = cityOf(g, o.city);
      T.welcome(c, g.family, o.capo, o.x, o.y);
      record(g, { type: 'welcomed', capo: o.capo, city: c.id, x: o.x, y: o.y,
                  label: T.person(o.capo).name + ' joins the family and opens his club in ' + T.zoneOf(c, o.x, o.y).name }, g.month);
    },
    research: function (g, o) {
      T.research(g.family, o.building);
      record(g, { type: 'studying', kind: o.building, label: 'The family starts learning: ' + D.SITES[o.building].name }, g.month);
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
    return { date: dateOf(g.month), month: g.month, tree: T.tree(g.family), study: g.family.study,
             cities: g.cities.map(function (c) {
               var v = T.view(c, g.family);
               v.name = specOf(c.id).name;
               return v;
             }) };
  }
  function hud(g) {
    var out = { date: dateOf(g.month), paused: g.paused, speed: g.speed, started: g.started };
    if (!g.started) return out;
    var blocks = 0, ours = 0, heat = 0, pending = 0, seats = { taken: 0, total: 0 };
    g.cities.forEach(function (c) {
      var s = T.share(c), n = c.w * c.h, k = T.seats(c);
      blocks += n; ours += s.family * n / 100; heat = Math.max(heat, c.heat || 0);
      pending += T.asks(c).length + T.doors(c, g.family).length;
      seats.taken += k.taken; seats.total += k.total;
    });
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

  var api = { VERSION: VERSION, TICKS_PER_MONTH: TICKS_PER_MONTH, SPEEDS: SPEEDS, JOURNAL_SIZE: JOURNAL_SIZE, NAMES: NAMES,
              createGame: createGame, tick: tick, command: command, candidates: candidates, view: view, hud: hud, save: save, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportEmpire = api;
})(typeof self !== 'undefined' ? self : this);
