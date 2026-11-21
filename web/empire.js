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
  var R = node ? require('./reign.js') : root.AshportReign;

  var VERSION = 3;            // 1 was the game by districts, since removed
  R.setDays(T.RULES.days);
  var TICKS_PER_MONTH = T.RULES.days;  // beats of the clock in a month at speed 1 (the screen beats once a second)
  var SPEEDS = [1, 2, 4];
  var JOURNAL_SIZE = 200;
  var HISTORY = 24;           // months kept for the curves
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
  // The street names of a city. With a picture (spec.streets: one string per row of blocks, one letter per block, 'a' for the
  // first name of the list, 'b' for the second...) a name can be any shape. Without one, the names stand side by side on two rows.
  function layout(spec) {
    var n = spec.districts.length, cols = Math.ceil(n / 2), w = cols * BLOCK.w, h = 2 * BLOCK.h, streets = null;
    if (spec.streets) {
      if (spec.streets.length !== h) throw new Error(spec.id + ': ' + spec.streets.length + ' rows of street names, ' + h + ' expected');
      streets = [];
      spec.streets.forEach(function (row, y) {
        if (row.length !== w) throw new Error(spec.id + ': row ' + y + ' is ' + row.length + ' blocks long, ' + w + ' expected');
        for (var x = 0; x < w; x++) {
          var z = row.charCodeAt(x) - 97;
          if (!(z >= 0 && z < n)) throw new Error(spec.id + ': no street name for \'' + row[x] + '\' at ' + x + ',' + y);
          streets.push(z);
        }
      });
    }
    return T.createCity({ id: spec.id, w: w, h: h, voids: voidsOf(spec, w, h), streets: streets, zones: spec.districts.map(function (d, i) {
      var col = i % cols, row = Math.floor(i / cols), last = i === n - 1;
      return { name: d.name, x0: col * BLOCK.w, y0: row * BLOCK.h, x1: last ? cols * BLOCK.w - 1 : (col + 1) * BLOCK.w - 1, y1: (row + 1) * BLOCK.h - 1, traits: d.traits };
    }) });
  }
  // --- what holds the family back, all cities together ---
  var GRAVE = { unpaid: 0, losing: 1, boxed: 2, idle: 3, sulk: 4, nobody: 5 }, IDLE = 12; // months clean money sleeps before it is said
  function dollars(n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // The cheapest thing the family's clean money could buy today: a holding, or something to learn.
  function cheapest(g) {
    var f = g.family, has = f.clean || 0, best = null;
    T.holdings(f).forEach(function (h) { if (h.next && h.next.cost <= has && (!best || h.next.cost < best.cost)) best = { name: h.name, cost: h.next.cost }; });
    if (!f.study) T.tree(f).forEach(function (t) { if (t.next && t.next.cost <= has && (!best || t.next.cost < best.cost)) best = { name: 'A better ' + t.name.toLowerCase(), cost: t.next.cost }; });
    return best;
  }
  function stalls(g) {
    var out = [], f = g.family;
    g.cities.forEach(function (c) { T.stalls(c, f).forEach(function (s) { s.city = c.id; out.push(s); }); });
    // a man of the table with no club of his own, left unpaid
    Object.keys(f.owed || {}).forEach(function (post) {
      var id = f.table && f.table[post];
      if (!id || g.cities.some(function (c) { return T.clubOf(c, id); })) return;
      out.push({ id: 'unpaid:' + id, capo: id, since: 0, what: T.person(id).name.split(' ')[0] + ' was not paid',
                 why: 'The table costs $' + T.RULES.table.pay + ' a man ' + T.EVERY + ': the family had $' + Math.round(T.funds(f)) + ' in hand', lever: 'Free his chair, or wait for money to come up' });
    });
    var buy = cheapest(g), since = g.idle !== undefined && g.idle !== null ? g.month - g.idle : 0;
    if (buy && since >= IDLE) {
      out.push({ id: 'idle', since: since, what: dollars(f.clean) + ' of clean money sleeps',
                 why: 'Nothing was bought or learned with it in ' + T.days(12 * Math.max(1, Math.floor(since / 12))), lever: buy.name + ' costs ' + dollars(buy.cost) });
    }
    var grave = function (s) { return GRAVE[s.id.split(':')[0]]; };
    return out.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) { return grave(a.s) - grave(b.s) || b.s.since - a.s.since || a.i - b.i; })
              .slice(0, 3).map(function (q) { return q.s; });
  }

  // --- what became of the boss's decisions ---
  // Each decision is kept with what the city looked like that day. A year on the game says what it gave, once: an 'outcome'
  // in the news (the clock does not stop for it) and a result on the decision. good is true, false, or null when it cannot be said.
  var DECISIONS = 20, YEAR = 12;
  function ours(c) { return T.places(c).filter(function (p) { return p.owner === 'family'; }).length; }
  function sour(g, c) { return Object.keys(g.family.men).filter(function (id) { return T.clubOf(c, id) && T.loyalty(g.family, id) < T.RULES.loyal.restless; }).length; }
  function sight(g, c) { return { places: ours(c), up: Math.round((c.flow && c.flow.up) || 0), heat: Math.round(c.heat || 0), sour: sour(g, c) }; }
  function firstName(id) { return T.person(id).name.split(' ')[0]; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function close(g, d, label, good) { d.result = { month: g.month, date: dateOf(g.month), label: label, good: good }; }
  function decide(g, d) {
    g.decisions = g.decisions || [];
    g.seq = (g.seq || 0) + 1;
    d.id = 'd' + g.seq; d.month = g.month; d.date = dateOf(g.month); d.due = g.month + YEAR; d.result = null;
    // a word given again for the same city closes the one before it
    if (d.type === 'line' || d.type === 'cut') g.decisions.forEach(function (q) {
      if (q.type === d.type && q.city === d.city && !q.result) close(g, q, 'You changed your word after ' + T.days(g.month - q.month), null);
    });
    g.decisions.push(d);
    if (g.decisions.length > DECISIONS) g.decisions.splice(0, g.decisions.length - DECISIONS);
  }
  var OUTCOMES = {
    welcomed: function (g, c, d) {
      if (!g.family.men[d.capo] || !T.clubOf(c, d.capo)) return { label: firstName(d.capo) + ' is gone from ' + specOf(c.id).name, good: false };
      var n = T.run(c, d.capo).length;
      return { label: firstName(d.capo) + ' runs ' + plural(n, 'place') + ' in ' + specOf(c.id).name + ' and makes ' + dollars(g.family.men[d.capo].income) + ' ' + T.EVERY, good: n >= 2 };
    },
    granted: function (g, c, d) {
      var k = T.keys(c).filter(function (q) { return q.key === d.key; })[0];
      return k.owner === 'family' ? { label: 'the ' + k.name + ' is yours', good: true } : { label: 'the ' + k.owner + 's still hold the ' + k.name, good: false };
    },
    denied: function (g, c, d) {
      var k = T.keys(c).filter(function (q) { return q.key === d.key; })[0];
      return k.owner === 'family' ? { label: 'the ' + k.name + ' is yours all the same', good: null }
        : { label: 'the ' + k.owner + 's still hold the ' + k.name + ', and you kept the ' + dollars(d.cost) + ' it would have cost', good: null };
    },
    funded: function (g, c, d) {
      var b = T.at(c, d.x, d.y);
      return b && b.owner === 'family' ? { label: 'the place is yours, and ' + firstName(b.capo) + ' runs it', good: true }
        : { label: 'the place is not yours' + (b ? ': the ' + b.owner + 's still hold it' : ' any more'), good: false };
    },
    unfunded: function (g, c, d) {
      var b = T.at(c, d.x, d.y);
      return b && b.owner === 'family' ? { label: 'the place is yours all the same', good: null }
        : { label: 'the place is not yours, and you kept the ' + dollars(d.cost), good: null };
    },
    line: function (g, c, d) {
      var now = sight(g, c), was = d.was, by = { grow: now.places - was.places, earn: now.up - was.up, low: was.heat - now.heat }[d.line];
      return { under: d.line ? ' under ' + T.RULES.line[d.line].name : ' with no word given', good: by === undefined || by === 0 ? null : by > 0,
               label: now.places + ' places (was ' + was.places + '), ' + dollars(now.up) + ' ' + T.EVERY + ' sent up (was ' + dollars(was.up) + '), heat ' + now.heat + ' (was ' + was.heat + ')' };
    },
    cut: function (g, c, d) {
      var now = sight(g, c), was = d.was;
      return { under: ' with a ' + d.cut + ' share', good: now.sour > was.sour ? false : now.up > was.up ? true : null,
               label: dollars(now.up) + ' ' + T.EVERY + ' sent up (was ' + dollars(was.up) + '), ' + plural(now.sour, 'sour capo') + ' (was ' + was.sour + ')' };
    },
    parted: function (g, c, d) {
      var now = sight(g, c), was = d.was;
      return { under: ' without ' + firstName(d.capo), good: now.up > was.up ? true : now.up < was.up ? false : null,
               label: now.places + ' places in ' + specOf(c.id).name + ' (was ' + was.places + '), ' + dollars(now.up) + ' ' + T.EVERY + ' sent up (was ' + dollars(was.up) + ')' };
    }
  };
  // The decisions that are a year old today.
  function outcomes(g, events) {
    (g.decisions || []).forEach(function (d) {
      if (d.result || g.month < d.due || !OUTCOMES[d.type]) return;
      var o = OUTCOMES[d.type](g, cityOf(g, d.city), d), label = T.days(12) + ' on' + (o.under || '') + ': ' + o.label;
      close(g, d, label, o.good);
      var e = { type: 'outcome', decision: d.id, city: d.city, good: o.good, label: label };
      if (d.capo) e.capo = d.capo;
      record(g, e, g.month); events.push(e);
    });
  }
  function decisions(g) {
    return (g.decisions || []).slice().reverse().map(function (d) {
      var out = {}; Object.keys(d).forEach(function (k) { if (k !== 'was') out[k] = d[k]; });
      return out;
    });
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
    g.reign = R.create(NAMES.indexOf(capo) + 1);
    g.started = true;
  }

  function record(g, e, month) {
    var line = { month: month, date: dateOf(month) };
    Object.keys(e).forEach(function (k) { line[k] = e[k]; });
    g.journal.push(line);
    if (g.journal.length > JOURNAL_SIZE) g.journal.splice(0, g.journal.length - JOURNAL_SIZE);
  }
  // The month that just ended, kept for the curves of the screen: the last HISTORY months, oldest first.
  function remember(g) {
    var line = { month: g.month, dirty: Math.round(g.family.dirty), clean: Math.round(g.family.clean || 0), cities: {} };
    // the family's money lines for the month, and what each trade put in the tills
    var lines = { up: 0, pay: 0, washed: 0, cut: 0, seized: 0, hijacked: 0 }, made = {};
    g.cities.forEach(function (c) {
      var flow = c.flow || {};
      lines.up += flow.up || 0; lines.pay += flow.pay || 0; lines.washed += c.washed || 0; lines.cut += flow.cut || 0; lines.seized += flow.seized || 0; lines.hijacked += flow.hijacked || 0;
      Object.keys(flow.made || {}).forEach(function (k) { made[k] = (made[k] || 0) + flow.made[k]; });
    });
    Object.keys(lines).forEach(function (k) { lines[k] = Math.round(lines[k]); });
    line.money = lines; line.trades = {};
    Object.keys(made).forEach(function (k) { if (Math.round(made[k]) > 0) line.trades[k] = Math.round(made[k]); });
    g.cities.forEach(function (c) {
      var share = T.share(c), here = line.cities[c.id] = { share: Math.round(share.family * 10) / 10, income: Math.round((c.flow && c.flow.up) || 0) };
      // for the curves of the screen: how strong the rival is, what each capo runs and earns, and how much of each street name is ours
      here.rival = Math.round(share.rival);
      here.capos = {};
      Object.keys(g.family.men).forEach(function (id) {
        if (!T.clubOf(c, id)) return;
        var b = g.family.men[id].book || { made: 0, wages: 0, sent: 0, spent: {}, saved: g.family.men[id].cash }, on = {}, total = 0;
        Object.keys(b.spent).forEach(function (k) { var n = Math.round(b.spent[k]); if (n > 0) { on[k] = n; total += n; } });
        here.capos[id] = { places: T.run(c, id).length, income: g.family.men[id].income, rank: g.family.men[id].rank,
                           made: Math.round(b.made), wages: Math.round(b.wages), sent: Math.round(b.sent), spent: total, spentOn: on, saved: Math.round(g.family.men[id].cash) };
      });
      var all = c.zones.map(function () { return 0; }), ours = all.slice();
      for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
        if (c.voids && c.voids[x + ',' + y]) continue;
        var z = T.zoneAt(c, x, y);
        all[z] += 1; if (T.grip(c, x, y) === 'family') ours[z] += 1;
      }
      here.zones = all.map(function (n, i) { return n ? Math.round(100 * ours[i] / n) : 0; });
    });
    g.history = g.history || [];
    g.history.push(line);
    if (g.history.length > HISTORY) g.history.splice(0, g.history.length - HISTORY);
  }
  // --- the reign: its acts and its director ---
  function reignOf(g) { if (!g.reign) g.reign = R.create(); return g.reign; }
  function mapShare(line) { var s = 0, n = 0; Object.keys((line && line.cities) || {}).forEach(function (k) { s += line.cities[k].share || 0; n += 1; }); return n ? s / n : 0; }
  function shareNow(g) { var h = g.history || []; return h.length ? mapShare(h[h.length - 1]) : 0; }
  // The family's share of the map has just been counted: the acts it wins or loses go into the journal.
  function settle(g) {
    var told = R.place(reignOf(g), shareNow(g));
    told.forEach(function (e) { record(g, e, g.month); });
    return told;
  }
  // What the director decided, carried out in the city: a beat only ever moves what the rules already know.
  function strike(g, b) {
    var c = cityOf(g, b.city), d = R.RULES.director, size = b.size || 1;
    if (b.kind === 'cargo') g.family.dirty += Math.round(d.cargo * size);
    else if (b.kind === 'captain') c.heat = Math.min(99, (c.heat || 0) + Math.round(d.captain * size));
    else if (b.kind === 'cool') c.heat = Math.max(0, (c.heat || 0) - d.cool);
    else if (b.kind === 'truce') { c.quiet = Math.max(c.quiet || 0, c.month + d.truce); c.lurk = Math.max(c.lurk || 0, c.month + d.truce); }
    else if (b.kind === 'blood') { c.vendetta = Math.max(c.vendetta || 0, c.month + Math.round(d.blood * size)); c.quiet = Math.min(c.quiet || 0, c.month); }
    else if (b.kind === 'godson') T.sway(g.family, b.capo, d.godson);
    else if (b.kind === 'thief') g.family.dirty = Math.max(0, g.family.dirty - b.amount);
    else throw new Error('no such beat: ' + b.kind);
  }
  // The capo of a city who is turning sour, the least loyal first.
  function sourest(g, c) {
    var worst = null;
    Object.keys(g.family.men).forEach(function (id) {
      var l = T.loyalty(g.family, id);
      if (T.clubOf(c, id) && l < T.RULES.loyal.restless && (!worst || l < worst.loyal)) worst = { id: id, name: T.person(id).name, loyal: l };
    });
    return worst;
  }
  // The director hears the day's news, then may make something happen himself.
  function direct(g, today, month, events) {
    var r = reignOf(g), h = g.history || [], d = R.RULES.director;
    R.hear(r, today);
    var b = R.direct(r, function () {
      var growing = h.length > 1 && mapShare(h[h.length - 1]) - mapShare(h[Math.max(0, h.length - 1 - d.over)]) >= d.growing;
      return { day: g.month * TICKS_PER_MONTH + g.ticks, growing: growing, dirty: g.family.dirty, cities: g.cities.map(function (c) {
      return { sour: sourest(g, c), id: c.id, name: specOf(c.id).name, held: held(g, c), heat: c.heat || 0, rival: c.rival || null, quiet: (c.quiet || 0) > c.month };
      }) };
    });
    if (!b) return;
    strike(g, b);
    record(g, b, month); events.push(b);
  }
  // The day of the month a man makes his move: always the same one, between the opening of the month and its closing.
  var dayOf = T.dayOf;
  var PASSING = { run: true, pay: true }; // told to the screen as they happen, never written in the journal
  // What has just happened goes into the journal; what waits for the boss's word stops the clock.
  function tell(g, happened, month, events) {
    happened.forEach(function (e) {
      record(g, e, month);
      events.push(e);
      // a man the boss can neither seat nor send anywhere waits at the door without stopping the clock
      if (e.type === 'knocks' && !canAnswer(g, cityOf(g, e.city), e.capo)) return;
      if (STOPS[e.type]) g.paused = true;
    });
  }
  // One day of the month (g.ticks counts them). The month opens on the first, every man has his own day, and it closes on the last.
  function day(g, events) {
    var d = g.ticks, month = g.month, f = g.family, last = d >= TICKS_PER_MONTH - 1, heard = events.length;
    if (d === 0) {
      g.was = { dirty: f.dirty, clean: f.clean || 0 };
      tell(g, T.begin(f, g.cities), month, events);
    }
    // the cars that leave today are for the screen to drive: they are not news for the journal
    var passed = T.pass(f, g.cities, d);
    passed.forEach(function (e) { if (PASSING[e.type]) events.push(e); });
    tell(g, passed.filter(function (e) { return !PASSING[e.type]; }), month, events);
    Object.keys(f.men).forEach(function (capo) { if (dayOf(capo) === d) tell(g, T.act(f, g.cities, capo), month, events); });
    direct(g, events.slice(heard), month, events);
    g.ticks = last ? 0 : d + 1;
    if (!last) return;
    tell(g, T.end(f, g.cities, W.ROUTES), month, events);
    var was = g.was || { dirty: f.dirty, clean: f.clean || 0 };
    g.change = { dirty: Math.round(f.dirty) - Math.round(was.dirty), clean: Math.round(f.clean || 0) - Math.round(was.clean) };
    g.waiting = g.waiting || {};
    // and is announced again the day a word can be given
    g.cities.forEach(function (c) {
      T.doors(c, g.family).forEach(function (q) {
        var k = c.id + ':' + q.capo;
        if (q.door !== 'poach' && c.under && T.clubOf(c, c.under)) return; // the underboss sees to him: nothing to tell the boss
        if (!answerable(g, c, q)) { g.waiting[k] = true; return; }
        if (!g.waiting[k]) return;
        delete g.waiting[k];
        var e = { type: 'knocks', ready: true, capo: q.capo, city: c.id, door: q.door, by: q.by, cost: q.cost, label: q.name + ' can now be taken in' };
        record(g, e, month); events.push(e); g.paused = true;
      });
    });
    g.month += 1;
    outcomes(g, events);
    remember(g);
    settle(g).forEach(function (e) { events.push(e); });
    g.idle = cheapest(g) ? (g.idle !== undefined && g.idle !== null ? g.idle : g.month - 1) : null; // since when clean money could have been spent
  }
  // One beat of the clock: one day at speed 1, two at speed 2, four at speed 4. A month is TICKS_PER_MONTH days.
  function tick(g) {
    var events = [];
    if (!g.started || g.paused) return events;
    for (var n = 0; n < g.speed && !g.paused; n++) day(g, events);
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
      if (a.kind === 'fund') {
        var him = T.person(a.capo).name, sum = dollars(a.cost);
        decide(g, { type: o.yes ? 'funded' : 'unfunded', city: c.id, capo: a.capo, x: a.x, y: a.y, cost: a.cost,
                    label: (o.yes ? 'You gave ' + him + ' ' + sum + ' for the ' : 'You refused ' + him + ' ' + sum + ' for the ') + a.name });
        record(g, { type: o.yes ? 'granted' : 'denied', fund: true, capo: a.capo, city: c.id, x: a.x, y: a.y, cost: a.cost,
                    label: o.yes ? 'You give ' + him + ' ' + sum + ' for the ' + a.name : 'You tell ' + him + ' to do without the ' + a.name }, g.month);
        return;
      }
      decide(g, { type: o.yes ? 'granted' : 'denied', city: c.id, capo: a.capo, key: a.key, cost: a.cost,
                  label: (o.yes ? 'You gave ' + T.person(a.capo).name + ' your word for the ' : 'You refused ' + T.person(a.capo).name + ' the ') + a.name });
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
    // the boss gives a city its line: grow, earn, lie low, or none
    line: function (g, o) {
      var c = cityOf(g, o.city);
      if (!held(g, c)) throw new Error('the family has no man in ' + specOf(c.id).name);
      var was = sight(g, c);
      T.line(c, o.line);
      var said = o.line ? T.RULES.line[o.line].name.toLowerCase() : null;
      decide(g, { type: 'line', city: c.id, line: o.line || null, was: was, label: said ? 'Your word for ' + specOf(c.id).name + ': ' + said : 'You left ' + specOf(c.id).name + ' to its capos' });
      record(g, { type: 'line', city: c.id, line: o.line || null, label: said ? 'Your word for ' + specOf(c.id).name + ': ' + said : 'You leave ' + specOf(c.id).name + ' to its capos' }, g.month);
    },
    // the boss buys something that lasts, in clean money
    buy: function (g, o) {
      var b = T.buy(g.family, o.holding);
      record(g, { type: 'bought', holding: b.id, level: b.level, cost: b.cost, label: 'You buy ' + (b.level > 1 ? 'more of ' : '') + 'the ' + b.name }, g.month);
    },
    // the boss sets how much he takes in a city: light, normal or heavy
    cut: function (g, o) {
      var c = cityOf(g, o.city);
      if (!held(g, c)) throw new Error('the family has no man in ' + specOf(c.id).name);
      var was = sight(g, c);
      T.cut(c, o.cut);
      decide(g, { type: 'cut', city: c.id, cut: o.cut, was: was, label: 'You took a ' + o.cut + ' share in ' + specOf(c.id).name });
      record(g, { type: 'cut', city: c.id, cut: o.cut, label: 'You take a ' + o.cut + ' share in ' + specOf(c.id).name }, g.month);
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
      decide(g, { type: 'welcomed', city: c.id, capo: o.capo, label: (from !== c ? 'You sent ' + T.person(o.capo).name + ' to ' : 'You took in ' + T.person(o.capo).name + ' in ') + specOf(c.id).name });
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
      var c = cityOf(g, o.city), name = T.person(o.capo) ? T.person(o.capo).name : o.capo, was = sight(g, c), r = T.part(c, g.family, o.capo, o.way);
      decide(g, { type: 'parted', city: c.id, capo: o.capo, way: o.way, was: was,
                  label: { retire: 'You paid ' + name + ' off', kill: 'You had ' + name + ' killed', jail: 'You gave ' + name + ' to the police' }[o.way] });
      var said = { retire: 'You pay ' + name + ' off. He leaves the city', kill: name + ' is found in the river', jail: 'The police come for ' + name + ' at dawn' };
      record(g, { type: 'parted', capo: o.capo, city: c.id, way: o.way, kept: r.kept, closed: r.closed,
                  label: said[o.way] + (r.closed ? ': ' + r.closed + (r.closed > 1 ? ' places close' : ' place closes') : '') }, g.month);
    },
    research: function (g, o) {
      T.research(g.family, o.building);
      g.family.study.day = g.ticks; // learned on this day of a later cycle
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
    if (!g.started) return { date: dateOf(0), cities: [], tree: [], history: [], stalls: [], decisions: [], next: null, reign: null };
    var out = { date: dateOf(g.month), month: g.month, day: g.ticks, days: TICKS_PER_MONTH, history: g.history || [], stalls: stalls(g), decisions: decisions(g), holdings: T.holdings(g.family), tree: T.tree(g.family), study: g.family.study, table: T.table(g.family),
             routes: W.ROUTES.map(function (r) { return { from: r.from, to: r.to, kind: r.kind }; }),
             cities: g.cities.map(function (c) {
               var v = T.view(c, g.family);
               v.name = specOf(c.id).name;
               v.held = held(g, c);
               v.capos.forEach(function (k) { k.day = dayOf(k.id); }); // the day of the month he makes his move
               // where each man at the door could be sent instead: the cities next door that still have a seat
               var free = T.table(g.family).filter(function (s) { return !s.capo; }).map(function (s) { return s.post; });
               v.doors.forEach(function (d) { d.roads = roadsOf(g, c, d); var own = d.door === 'poach' ? null : T.clubSpot(c, d.capo); d.spot = own && { x: own.x, y: own.y, street: T.zoneOf(c, own.x, own.y).name }; d.open = answerable(g, c, d); d.chairs = d.door === 'poach' ? [] : free; if (v.under && d.door !== 'poach') d.handled = v.under; });
               return v;
             }) };
    // the next streets to fall anywhere: the move that is furthest along
    var r = reignOf(g), share = shareNow(g);
    out.reign = { share: Math.round(share * 10) / 10, rank: R.rank(share), act: R.act(r), reached: r.reached,
                  acts: R.ACTS.map(function (a, i) { return { id: a.id, name: a.name, numeral: ['I', 'II', 'III', 'IV'][i], opens: a.opens, watch: a.watch, threat: a.threat, gives: a.gives, open: i <= r.reached, now: i === r.act, from: R.RULES.ranks[i][1], rank: R.RULES.ranks[i][0] }; }) };
    out.next = out.cities.reduce(function (best, c) { return c.next && (!best || c.next.advance > best.advance) ? Object.assign({ city: c.id }, c.next) : best; }, null);
    return out;
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
    out.act = R.act(reignOf(g)).numeral;
    return out;
  }

  // A city saved when cities were plain rectangles takes today's outline and street shapes. A block that carries a place stays.
  function outline(c) {
    var spec = specOf(c.id);
    if (!spec || !spec.streets || c.streets) return;
    var now = layout(spec);
    if (now.w !== c.w || now.h !== c.h) return;
    c.streets = now.streets; c.zones = now.zones; c.voids = {};
    Object.keys(now.voids).forEach(function (k) { if (!c.blocks[k]) c.voids[k] = now.voids[k]; });
  }
  function save(g) { return JSON.stringify(g); }
  function load(text) {
    var g;
    try { g = JSON.parse(text); } catch (e) { throw new Error('this saved game cannot be read'); }
    if (!g || typeof g !== 'object') throw new Error('this saved game cannot be read');
    if (g.version !== VERSION) throw new Error('this game was saved by an older version of Ashport and cannot be continued');
    (g.cities || []).forEach(outline);
    // a game saved when a month was played in one blow, or cut off in a way that cannot be picked up: its month starts again
    if (!(g.ticks >= 0 && g.ticks < TICKS_PER_MONTH) || (g.ticks > 0 && (g.cities || []).some(function (c) { return !c.turn; }))) {
      g.ticks = 0;
      (g.cities || []).forEach(function (c) { if (c.turn) { c.flow = c.turn.shown; c.turn = null; } });
    }
    return g;
  }

  var api = { dayOf: dayOf, DECISIONS: DECISIONS, layout: layout, START_CASH: START_CASH, VERSION: VERSION, TICKS_PER_MONTH: TICKS_PER_MONTH, SPEEDS: SPEEDS, JOURNAL_SIZE: JOURNAL_SIZE, HISTORY: HISTORY, NAMES: NAMES,
              createGame: createGame, settle: settle, strike: strike, tick: tick, command: command, candidates: candidates, view: view, hud: hud, save: save, load: load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportEmpire = api;
})(typeof self !== 'undefined' ? self : this);
