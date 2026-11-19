// The game as the screen sees it. No drawing and no browser here.
//
// The screen calls tick() on a timer, sends the boss's orders through
// command(), and reads hud(), view(), journal, candidates() and openings()
// to draw. Everything that decides anything lives in world.js and
// district.js; this file only keeps time and translates.
(function (root) {
  'use strict';

  var node = typeof require === 'function';
  var W = node ? require('./world.js') : root.AshportWorld;
  var D = node ? require('./district.js') : root.AshportDistrict;

  var VERSION = 1;
  var TICKS_PER_MONTH = 4;
  var SPEEDS = [1, 2, 4];
  var JOURNAL_SIZE = 200;
  var FIRST_YEAR = 1926;
  var MAX_NAMED = W.CITIES.length + W.SEATS.length; // six underbosses and the table
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // What a capo likes or refuses, in words for the screen.
  var WORDS = {
    protection: 'Protection', seize: 'Taking by force', push: 'Taking streets', bribe: 'Paying the police',
    still: 'Stills', speakeasy: 'Speakeasies', gambling: 'Gambling', loft: 'Cannabis', warehouse: 'Warehouses',
    front: 'Fronts', rented: 'Rented laundries', brothel: 'Brothels', chopshop: 'Stolen cars', fence: 'Fencing',
    loans: 'Loan sharking', union: 'Unions'
  };

  function dateOf(month) { return MONTHS[month % 12] + ' ' + (FIRST_YEAR + Math.floor(month / 12)); }
  function words(list) { return list.map(function (k) { return WORDS[k] || k; }); }

  function createGame(options) {
    var g = { version: VERSION, started: false, paused: false, speed: 1, ticks: 0, world: null, journal: [] };
    if (options && options.capo) { g.world = W.createWorld({ capo: options.capo }); g.started = true; }
    return g;
  }

  function record(g, e, month) {
    if (e.type === 'decision' && e.kind === 'hold') return;
    var place = W.placeOf(e.district), city = W.cityOf(e.city);
    var entry = { date: dateOf(month), type: e.type, label: e.label, district: e.district, city: e.city, place: place.name + ', ' + city.name };
    if (e.why) entry.why = e.why;
    if (e.kind) entry.kind = e.kind;
    if (e.outcome) entry.outcome = e.outcome;
    g.journal.unshift(entry);
    if (g.journal.length > JOURNAL_SIZE) g.journal.length = JOURNAL_SIZE;
  }

  // One beat of the clock. Returns what happened, if a month just ended.
  function tick(g) {
    if (!g.started || g.paused) return [];
    g.ticks += g.speed;
    if (g.ticks < TICKS_PER_MONTH) return [];
    g.ticks -= TICKS_PER_MONTH;
    var month = g.world.month, events = W.stepMonth(g.world);
    events.forEach(function (e) { record(g, e, month); });
    return events;
  }

  var ORDERS = {
    start: function (g, c) {
      if (g.started) throw new Error('the game has already started');
      g.world = W.createWorld({ capo: c.capo });
      g.started = true;
    },
    pause: function (g) { g.paused = true; },
    resume: function (g) { g.paused = false; },
    speed: function (g, c) {
      if (SPEEDS.indexOf(c.value) < 0) throw new Error('no such speed: ' + c.value);
      g.speed = c.value;
    },
    claim: function (g, c) { W.claim(g.world, c.district, c.capo); },
    appoint: function (g, c) { W.appoint(g.world, c.district, c.capo); },
    seat: function (g, c) { W.seat(g.world, c.seat, c.capo); },
    unseat: function (g, c) { W.unseat(g.world, c.seat); },
    underboss: function (g, c) { W.setUnderboss(g.world, c.city, c.capo); }
  };

  // An order of the boss. Never throws: the answer says whether it went through.
  function command(g, c) {
    var order = c && ORDERS[c.type];
    if (!order) return { ok: false, error: 'no such order: ' + (c && c.type) };
    if (!g.started && c.type !== 'start') return { ok: false, error: 'name your first capo to begin' };
    try { order(g, c); } catch (e) { return { ok: false, error: e.message }; }
    return { ok: true };
  }

  // What this capo would do with his first month in that district.
  function firstMove(world, districtId, capo) {
    var x = W.district(world, districtId), d;
    if (x.state) { d = JSON.parse(JSON.stringify(x.state)); d.capo = capo; }
    else {
      var start = { capo: capo, traits: W.placeOf(districtId).traits };
      Object.keys(W.RULES.foothold).forEach(function (k) { start[k] = W.RULES.foothold[k]; });
      d = D.createDistrict(start);
    }
    var pick = D.chooseProject(d);
    return pick.label + ': ' + pick.why;
  }

  // The men still free, each with his card and what he announces for that district.
  // Before the game starts, every man is free and speaks for the family's first district.
  function candidates(g, districtId) {
    var taken = {}, world = g.world;
    if (world) W.posts(world).forEach(function (n) { taken[n.capo] = true; });
    else { world = W.createWorld({ capo: Object.keys(D.CAPOS)[0] }); districtId = districtId || W.HOME; }
    return Object.keys(D.CAPOS).filter(function (id) { return !taken[id]; }).map(function (id) {
      var c = D.CAPOS[id];
      return { id: id, name: c.name, specialty: c.specialty,
               stats: { muscle: c.muscle, business: c.business, cunning: c.cunning, charisma: c.charisma, loyalty: c.loyalty, ambition: c.ambition },
               likes: words(c.likes), refuses: words(c.refuses),
               firstMove: districtId ? firstMove(world, districtId, id) : '' };
    });
  }

  // The districts the family can move into now.
  function openings(g) {
    var cash = g.world.treasury.dirty;
    return W.districts(g.world).filter(function (x) { return x.owner !== 'family' && W.reachable(g.world, x.id); }).map(function (x) {
      var p = W.placeOf(x.id);
      return { district: x.id, name: p.name, city: W.cityOf(x.city).name, rival: x.owner, traits: p.traits,
               cost: W.RULES.moveInCost, affordable: cash >= W.RULES.moveInCost };
    });
  }

  function alerts(g) {
    var list = [];
    W.districts(g.world).forEach(function (x) {
      var s = x.state;
      if (!s) return;
      var add = function (text) { list.push({ district: x.id, city: x.city, text: s.name + ': ' + text }); };
      if (s.attacked > 0) add('hit by the ' + W.cityOf(x.city).rival + 's');
      if (s.watched > 0) add('watched by the police after a raid');
      else if (s.heat >= 50) add('the police are getting close');
      if (s.share < 15 && s.month > W.RULES.grace) add('losing the streets');
      if (s.profit < 0) add('losing money');
    });
    return list;
  }

  // The top of the screen.
  function hud(g) {
    if (!g.started) return { date: dateOf(0), dirty: 0, clean: 0, named: 0, maxNamed: MAX_NAMED, paused: g.paused, speed: g.speed, alerts: [] };
    return { date: dateOf(g.world.month), dirty: g.world.treasury.dirty, clean: g.world.treasury.clean,
             named: W.named(g.world).length, maxNamed: MAX_NAMED, paused: g.paused, speed: g.speed, alerts: alerts(g) };
  }

  function view(g) { return W.view(g.world); }
  function save(g) { return JSON.stringify(g); }
  function load(text) {
    var g = JSON.parse(text);
    if (g.version !== VERSION) throw new Error('this game was saved by another version');
    return g;
  }

  var api = { TICKS_PER_MONTH: TICKS_PER_MONTH, SPEEDS: SPEEDS, JOURNAL_SIZE: JOURNAL_SIZE, createGame: createGame, tick: tick,
              command: command, candidates: candidates, openings: openings, hud: hud, view: view, save: save, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportGame = api;
})(typeof self !== 'undefined' ? self : this);
