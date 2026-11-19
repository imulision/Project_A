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
    if (e.type === 'ready') return; // the man waiting shows in promotions(), not in the journal
    var place = W.placeOf(e.district), city = W.cityOf(e.city);
    var entry = { date: dateOf(month), type: e.type, label: e.label, district: e.district, city: e.city, place: place.name + ', ' + city.name };
    if (e.why) entry.why = e.why;
    if (e.kind) entry.kind = e.kind;
    if (e.outcome) entry.outcome = e.outcome;
    if (e.effects) entry.effects = e.effects;
    if (e.building) { entry.building = e.building; entry.tier = e.tier; }
    if (e.ability) entry.ability = e.ability;
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
    appoint: function (g, c) { W.appoint(g.world, c.district, c.capo); },
    seat: function (g, c) { W.seat(g.world, c.seat, c.capo); },
    unseat: function (g, c) { W.unseat(g.world, c.seat); },
    underboss: function (g, c) { W.setUnderboss(g.world, c.city, c.capo); },
    takeover: function (g, c) { W.takeover(g.world, c.district, c.way, c.capo); },
    research: function (g, c) { W.research(g.world, c.building || c.ability); },
    promote: function (g, c) { record(g, W.promote(g.world, c.capo, c.ability), g.world.month); },
    approve: function (g, c) { W.rule(g.world, c.id, true); },
    refuse: function (g, c) { W.rule(g.world, c.id, false); }
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
    var ids = Object.keys(D.CAPOS);
    // the local man of the district comes last: always there, never the best
    if (g.world && districtId && W.district(world, districtId).owner !== 'family') ids.push(W.local(districtId).id);
    var rival = !!g.world && !!districtId && W.district(world, districtId).owner !== 'family';
    return ids.filter(function (id) { return !taken[id]; }).map(function (id) {
      var c = D.CAPOS[id], chances = null;
      if (rival) { chances = {}; W.WAYS.forEach(function (way) { chances[way] = W.odds(world, districtId, way, id).odds; }); }
      var who = W.person(world, id);
      return { id: id, name: c.name, specialty: c.specialty, local: !!c.local, rank: who.rank, rankName: who.rankName,
               stats: { muscle: c.muscle, business: c.business, cunning: c.cunning, charisma: c.charisma, loyalty: c.loyalty, ambition: c.ambition },
               likes: words(c.likes), refuses: words(c.refuses),
               odds: chances, // how each way into this district looks for him: 'good' or 'poor'
               firstMove: districtId ? firstMove(world, districtId, id) : '' };
    });
  }

  // The districts the family can move into now.
  function openings(g) {
    var cash = g.world.treasury.dirty + g.world.treasury.clean, clean = g.world.treasury.clean;
    var busy = {};
    W.takeovers(g.world).forEach(function (t) { busy[t.district] = true; });
    return W.districts(g.world).filter(function (x) { return x.owner !== 'family' && W.reachable(g.world, x.id); }).map(function (x) {
      var p = W.placeOf(x.id);
      return { district: x.id, name: p.name, city: W.cityOf(x.city).name, rival: x.owner, traits: p.traits,
               cost: W.RULES.moveInCost, affordable: cash >= W.RULES.moveInCost, underWay: !!busy[x.id],
               ways: busy[x.id] ? [] : W.WAYS.map(function (way) {
                 var t = W.RULES.takeover[way], cost = W.price(g.world, x.id, way);
                 return { way: way, cur: t.cur, cost: cost, months: t.months, affordable: (t.cur === 'clean' ? clean : cash) >= cost };
               }) };
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
    if (!g.started) return { date: dateOf(0), dirty: 0, clean: 0, named: 0, maxNamed: MAX_NAMED, paused: g.paused, speed: g.speed, alerts: [], pending: 0, promotions: 0, lastMonth: { dirty: 0, clean: 0 } };
    return { date: dateOf(g.world.month), dirty: g.world.treasury.dirty, clean: g.world.treasury.clean,
             named: W.named(g.world).length, maxNamed: MAX_NAMED, paused: g.paused, speed: g.speed, alerts: alerts(g),
             pending: W.proposals(g.world).length, promotions: W.promotions(g.world).length,
             lastMonth: g.world.lastMonth || { dirty: 0, clean: 0 } }; // what the capos sent up: dirty as it is, clean once washed
  }

  function view(g) { return W.view(g.world); }
  // What moves on the map this month (see world.js). Nothing before the game starts.
  function trips(g) { return g.world ? W.trips(g.world) : []; }
  // Last month's chain of one district in figures (see district.js), or null if the family is not there.
  function flows(g, districtId) {
    var x = g.world && W.district(g.world, districtId);
    return x && x.state ? D.flows(x.state) : null;
  }
  // Where the money of a district sits, place by place (see district.js). Empty where the family is not.
  function cash(g, districtId) {
    var x = g.world && W.district(g.world, districtId);
    return x && x.state ? D.cash(x.state) : [];
  }
  // What the capos ask the boss's leave for, with the words the screen needs.
  function proposals(g) {
    if (!g.world) return [];
    return W.proposals(g.world).map(function (p) {
      return { id: p.id, kind: p.kind, district: p.district, city: p.city, capo: p.capo, capoName: D.CAPOS[p.capo].name,
               place: W.placeOf(p.district).name + ', ' + W.cityOf(p.city).name, target: p.target, label: p.label, why: p.why,
               gain: p.gain, risk: p.risk, odds: p.odds, waits: W.RULES.jobs.expires,
               monthsLeft: W.RULES.jobs.expires - (g.world.month - p.month) };
    });
  }
  // What the family is learning now, with its bar, or null.
  function research(g) {
    var r = g.world && W.researching(g.world);
    if (!r) return null;
    if (r.building) { r.name = D.SITES[r.id].name; r.text = r.tier === 1 ? 'A new trade for the capos' : 'Bigger places of this kind'; }
    else { var a = D.ABILITIES[r.id]; r.sector = a.sector; r.name = a.ability.name; r.text = a.ability.text; }
    r.progress = Math.min(1, (r.months - r.monthsLeft + g.ticks / TICKS_PER_MONTH) / r.months);
    return r;
  }
  // The men who have earned a rank and wait for the boss to choose their ability.
  function promotions(g) {
    if (!g.world) return [];
    return W.promotions(g.world).map(function (p) {
      p.capoName = D.CAPOS[p.capo].name;
      p.place = W.placeOf(p.district).name + ', ' + W.cityOf(g.world.districts[p.district].city).name;
      return p;
    });
  }
  // The family rank by rank, for its pyramid: pay, places, who is there, who waits.
  function ranks(g) {
    var who = function (id) { return { id: id, name: D.CAPOS[id].name }; };
    return W.ranks(g.world || W.createWorld({ capo: Object.keys(D.CAPOS)[0] })).map(function (r) {
      r.men = g.world ? r.men.map(who) : [];
      r.waiting = g.world ? r.waiting.map(who) : [];
      return r;
    });
  }
  // The takeovers under way, each with its man and how far it is.
  function takeovers(g) {
    if (!g.world) return [];
    return W.takeovers(g.world).map(function (t) {
      t.capoName = D.CAPOS[t.capo].name;
      t.place = W.placeOf(t.district).name + ', ' + W.cityOf(t.city).name;
      t.progress = Math.min(1, (t.months - t.monthsLeft + g.ticks / TICKS_PER_MONTH) / t.months);
      return t;
    });
  }
  // The last two years of a district, oldest first, for its curves.
  function history(g, districtId) {
    if (!g.world) return [];
    return W.history(g.world, districtId).map(function (h) {
      return { date: dateOf(h.month), month: h.month, share: h.share, heat: h.heat, goodwill: h.goodwill, men: h.men,
               income: h.income, profit: h.profit, toBoss: h.toBoss };
    });
  }
  // What the capo of a district is after and how close he is, or null if the family is not there.
  function intent(g, districtId) {
    var x = g.world && W.district(g.world, districtId);
    if (!x || !x.state) return null;
    var p = D.plan(x.state);
    p.capo = x.state.capo;
    p.capoName = D.CAPOS[x.state.capo].name;
    p.did = x.state.last ? x.state.last.decision : null;
    p.wish = D.wish(x.state); // the closed trade he would open if the family knew how
    return p;
  }
  // The building tree: each trade, its tier, what the next one costs and who asks for it.
  function tree(g) {
    var w = g.world || W.createWorld({ capo: Object.keys(D.CAPOS)[0] }), now = research(g);
    var who = function (id) { return { id: id, name: D.CAPOS[id].name }; };
    return W.tree(w).map(function (b) {
      if (b.next) b.next.affordable = !!g.world && !W.researching(w) && w.treasury.clean >= b.next.cost;
      b.likedBy = g.world ? b.likedBy.map(who) : [];
      b.wantedBy = g.world ? b.wantedBy.map(who) : [];
      b.progress = now && now.id === b.id ? now.progress : null;
      return b;
    });
  }
  // The family's wheel of abilities (see world.js). Dark before the game starts.
  function wheel(g) { return W.wheel(g.world || W.createWorld({ capo: Object.keys(D.CAPOS)[0] })); }
  // One man's card as he is now: rank, what he has practised, what he has unlocked.
  function person(g, id) {
    var who = W.person(g.world || W.createWorld({ capo: Object.keys(D.CAPOS)[0] }), id), c = D.CAPOS[id];
    who.name = c.name;
    who.specialty = c.specialty;
    who.nextRankAt = who.rank < W.RANKS.length - 1 ? W.RANKS[who.rank + 1].xp : null;
    who.abilities = who.abilities.map(function (a) {
      var x = D.ABILITIES[a];
      return { id: a, sector: x.sector, name: x.ability.name, text: x.ability.text };
    });
    return who;
  }
  function save(g) { return JSON.stringify(g); }
  function load(text) {
    var g;
    try { g = JSON.parse(text); } catch (e) { throw new Error('this saved game cannot be read'); }
    if (!g || typeof g !== 'object') throw new Error('this saved game cannot be read');
    if (g.version !== VERSION) throw new Error('this game was saved by another version');
    // saves made before the building tree carry the same version number, and nothing they lack can be guessed
    if (g.world && !g.world.tree) throw new Error('this game was saved by an older version of Ashport and cannot be continued');
    return g;
  }

  var api = { TICKS_PER_MONTH: TICKS_PER_MONTH, SPEEDS: SPEEDS, JOURNAL_SIZE: JOURNAL_SIZE, createGame: createGame, tick: tick,
              command: command, candidates: candidates, openings: openings, hud: hud, view: view, trips: trips, flows: flows, cash: cash, proposals: proposals, history: history, intent: intent, takeovers: takeovers, promotions: promotions, ranks: ranks, research: research, tree: tree, wheel: wheel, person: person, save: save, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportGame = api;
})(typeof self !== 'undefined' ? self : this);
