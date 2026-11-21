// What comes up to the boss: capos asking for a key place, the wages and the
// share sent up, and capos of one city who quarrel until he rules.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var G = typeof require === 'function' ? require('./turf-goods.js') : root.AshportTurfGoods;
  var S = typeof require === 'function' ? require('./turf-streets.js') : root.AshportTurfStreets;
  var RULES = R.RULES, key = R.key, far = R.far, owns = R.owns;
  var KEYS = P.KEYS, can = P.can, sway = P.sway, who = P.who;
  var changed = C.changed, income = G.income;
  var everyPlace = C.everyPlace, places = C.places, keys = C.keys, held = C.held, clubOf = C.clubOf;
  var laundries = G.laundries;
  var first = S.first, funds = S.funds, spend = S.spend, zoneOf = C.zoneOf, at = R.at;

  // --- key places: the capo asks, the boss decides ---
  // A capo asks for a key place once the family has it surrounded, and never twice at once.
  function eyes(c, capo) {
    var mine = places(c, capo), out = null;
    keys(c).forEach(function (k) {
      if (out || k.owner === 'family') return;
      if (c.month < (c.refused[k.key] || 0)) return;
      if (c.asks.concat(c.ops).some(function (o) { return o.key === k.key; })) return;
      if (!mine.some(function (p) { return far(k.x, k.y, p.x, p.y) <= RULES.near; })) return;
      var around = everyPlace(c).filter(function (p) { return p.owner === 'family' && far(k.x, k.y, p.x, p.y) <= RULES.near; }).length;
      if (around >= RULES.siege) out = k;
    });
    return out;
  }

  // What a key place is worth to the family as things stand: what its capos make a month with it in their hands, less what they make without.
  function keyWorth(c, x, y) {
    var b = c.blocks[key(x, y)];
    if (!b || b.kind !== 'key') return 0;
    var was = b.owner, capos = {};
    everyPlace(c).forEach(function (p) { if (p.owner === 'family' && p.capo) capos[p.capo] = true; });
    var total = function (owner) {
      b.owner = owner; changed(c);
      return Object.keys(capos).reduce(function (n, id) { return n + income(c, id); }, 0);
    };
    var gain = total('family') - total(was === 'family' ? (c.rival || 'nobody') : was);
    b.owner = was; changed(c);
    return gain;
  }
  // What the capo says the place will bring in, and when he can be held to it. Nothing for a place that brings no money in.
  // An ambitious man swells his figure.
  function expects(c, capo, k, months) {
    if (!KEYS[k.key].lifts && !KEYS[k.key].pours) return null;
    var gain = Math.round(keyWorth(c, k.x, k.y) * (1 + (who(capo).ambition - 50) * RULES.promise.boast / 100));
    return gain > 0 ? { gain: gain, months: months + RULES.promise.after } : null;
  }
  function promises(c) {
    return (c.promises || []).map(function (p) {
      return { capo: p.capo, key: p.key, name: KEYS[p.key].name, x: p.x, y: p.y, expected: p.expected, months: p.due - c.month };
    });
  }
  // The day comes: what the place really brings in, against what was said.
  function judge(c, events) {
    var due = (c.promises || []).filter(function (p) { return c.month >= p.due; });
    if (!due.length) return;
    c.promises = c.promises.filter(function (p) { return c.month < p.due; });
    due.forEach(function (p) {
      var b = c.blocks[key(p.x, p.y)], ours = b && b.kind === 'key' && b.owner === 'family';
      var actual = ours ? Math.round(keyWorth(c, p.x, p.y)) : 0, kept = actual >= p.expected * RULES.promise.near;
      events.push({ type: 'promise', city: c.id, capo: p.capo, kind: 'key', key: p.key, x: p.x, y: p.y, expected: p.expected, actual: actual, kept: kept,
                    label: 'The ' + KEYS[p.key].name + ' brings in $' + actual + ' ' + R.EVERY + ': ' + first(p.capo) + (kept ? ' kept his word' : ' had said $' + p.expected + ', and did not keep his word') });
    });
  }

  // --- a capo who cannot afford what he is after ---
  // A year saving for the same thing without getting there. For a rival's place he asks the boss for what he is short of;
  // anything else he gives up, and leaves alone for a good while.
  function patience(c, f, capo, p, events) {
    var m = f.men[capo], asked = c.asks.filter(function (a) { return a.fund && a.capo === capo; })[0];
    var drop = function () { c.asks = c.asks.filter(function (a) { return a !== asked; }); asked = null; };
    // the months he has gone short: they stop the day he can pay for what he is after
    if (p.waiting !== 'money') { m.aim = null; if (asked) drop(); return; }
    if (!m.aim) m.aim = { since: c.month };
    if (asked && (p.move !== 'take' || asked.x !== p.x || asked.y !== p.y)) drop();
    var short = Math.round(p.cost - p.saved), why = 'he has saved $' + Math.round(p.saved) + ' of the $' + Math.round(p.cost) + ' it takes, and ' + R.days(RULES.patience.months) + ' have gone by';
    if (asked) { asked.cost = short; asked.full = p.cost; asked.why = why; return; } // what he is short of moves with his purse
    if (c.month - m.aim.since < RULES.patience.months) return;
    if (c.month < (m.aim.rest || 0)) return;
    var there = at(c, p.x, p.y), where = zoneOf(c, p.x, p.y).name;
    if (p.move === 'take') {
      if (c.asks.some(function (a) { return a.capo === capo; }) || c.month < (m.begged || 0)) return; // one thing at a time, and not every year
      var name = there.owner + 's\' ' + D.SITES[there.kind].name.toLowerCase();
      c.asks.push({ id: c.id + ':fund:' + capo, fund: true, capo: capo, trade: p.kind, x: p.x, y: p.y, way: p.way, cost: short, full: p.cost, months: p.months, why: why,
                    name: name, gives: 'One more place for ' + first(capo) + ', on streets the ' + there.owner + 's hold' });
      events.push({ type: 'asks', fund: true, capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, way: p.way, cost: short, months: p.months,
                    label: first(capo) + ' asks you for $' + short + ' to take the ' + name + ' in ' + where });
      return;
    }
    m.shuns = m.shuns || {}; m.shuns[key(p.x, p.y)] = c.month + RULES.patience.sore; m.aim.rest = c.month + RULES.patience.months;
    var site = p.name.toLowerCase();
    events.push({ type: 'gaveup', capo: capo, city: c.id, move: p.move, x: p.x, y: p.y, kind: p.kind, cost: p.cost,
                  label: first(capo) + ' gives up ' + (p.move === 'enlarge' ? 'making his ' + site + ' bigger' : p.move === 'convert' ? 'turning his ' + D.SITES[p.from].name.toLowerCase() + ' into a ' + site : 'opening a ' + site)
                    + ' in ' + where + ': too dear for him' });
  }

  function asks(c) {
    return c.asks.map(function (a) {
      if (a.fund) return { id: a.id, capo: a.capo, kind: 'fund', key: a.trade, name: a.name, gives: a.gives, x: a.x, y: a.y, way: a.way, cost: a.cost, months: a.months, why: a.why, expects: null };
      return { id: a.id, capo: a.capo, key: a.key, name: KEYS[a.key].name, gives: KEYS[a.key].gives, x: a.x, y: a.y, way: a.way, cost: a.cost, months: a.months, why: a.why, expects: a.expects || null };
    });
  }

  // Money asked for a rival's place: the boss pays what the capo is short of and the capo puts in his savings, or the capo lets the place go.
  function fund(c, f, a, yes) {
    var m = f.men[a.capo];
    if (yes) {
      if (funds(f) < a.cost) throw new Error('the boss cannot pay the $' + a.cost + ' ' + first(a.capo) + ' is short of');
      spend(f, a.cost);
      m.cash -= a.full - a.cost;
      m.paid = m.paid || {}; m.paid.take = (m.paid.take || 0) + a.full - a.cost; // for his books
      c.ops.push({ capo: a.capo, x: a.x, y: a.y, way: a.way, kind: a.trade, cost: a.full, month: c.month, months: a.months, day: c.turn && c.turn.daily ? c.turn.day || 0 : undefined });
    } else { m.shuns = m.shuns || {}; m.shuns[key(a.x, a.y)] = c.month + RULES.patience.sore; }
    m.aim = null; m.begged = c.month + RULES.patience.sore;
    sway(f, a.capo, yes ? RULES.loyal.granted : -RULES.loyal.refused);
    c.asks = c.asks.filter(function (q) { return q !== a; });
  }

  function answer(c, f, id, yes) {
    var a = c.asks.filter(function (q) { return q.id === id; })[0];
    if (!a) throw new Error('nobody is asking for ' + id);
    if (a.fund) return fund(c, f, a, yes);
    if (yes) {
      if (funds(f) < a.cost) throw new Error('the boss cannot pay the $' + a.cost + ' the ' + KEYS[a.key].name + ' takes');
      spend(f, a.cost);
      c.ops.push({ capo: a.capo, x: a.x, y: a.y, way: a.way, key: a.key, kind: 'key', cost: a.cost, month: c.month, months: a.months, day: c.turn && c.turn.daily ? c.turn.day || 0 : undefined });
      if (a.expects) { c.promises = c.promises || []; c.promises.push({ capo: a.capo, key: a.key, x: a.x, y: a.y, expected: a.expects.gain, due: c.month + a.expects.months }); }
    } else c.refused[a.key] = c.month + RULES.sulk;
    sway(f, a.capo, yes ? RULES.loyal.granted : -RULES.loyal.refused);
    c.asks = c.asks.filter(function (q) { return q !== a; });
  }

  // --- two kinds of money ---
  // The month's money: wages by rank, the share each capo sends up, what the fronts wash, and the heat that follows.
  // The fronts wash what they can of the dirty money: a whole cycle's worth, or the part of it one day washes.
  function launder(c, f, part) {
    var flow = c.flow || (c.flow = { up: 0, sent: {} });
    flow.wash = flow.wash || {};
    f.clean = f.clean || 0;
    laundries(c).forEach(function (l) {
      var n = Math.max(0, Math.min(f.dirty, l.most * part));
      f.dirty -= n; f.clean += n * (1 - l.loss); c.washing = (c.washing || 0) + n; flow.cut = (flow.cut || 0) + n * l.loss;
      flow.wash[key(l.x, l.y)] = (flow.wash[key(l.x, l.y)] || 0) + n;
    });
  }
  // The police raid the counting rooms.
  function bust(c, f, events) {
    var H = RULES.holdings;
    var seized = Math.round(Math.max(0, f.dirty) * RULES.bust * (1 - H.lawyer.spares * owns(f, 'lawyer'))); // the lawyers get some of it back
    f.dirty -= seized; (c.flow || (c.flow = { up: 0, sent: {} })).seized = seized;
    c.heat = RULES.afterBust;
    events.push({ type: 'bust', city: c.id, seized: seized, label: 'The police raid the family\'s counting rooms and seize $' + seized });
  }
  // `daily`: the city is played day by day, the fronts have washed as the days went and the police pick their own day.
  function money(c, f, events, heard, daily) {
    f.clean = f.clean || 0;
    var flow = c.flow || (c.flow = { up: 0, sent: {} });
    flow.pay = 0;
    if (!daily) { flow.cut = 0; flow.seized = 0; flow.wash = {}; c.washing = 0; }
    // every man in the city is paid out of what he sent up: a share of it, and never more than his rank allows.
    // The boss is never asked for money he was not sent.
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var due = Math.min(RULES.pay[f.men[capo].rank], RULES.payShare * (flow.sent[capo] || 0));
      var dirty = Math.min(due, Math.max(0, f.dirty)), clean = Math.min(due - dirty, Math.max(0, f.clean));
      f.dirty -= dirty; f.clean -= clean; flow.pay += dirty + clean;
    });
    // the fronts wash what they can of what is left
    if (!daily) launder(c, f, 1);
    c.washed = c.washing || 0; c.washing = 0;
    // money that sleeps and blood in the streets draw the police
    var loud = events.filter(function (e) { return e.type === 'burnt' || e.type === 'repelled' || (e.type === 'taken' && e.way === 'force'); }).length;
    loud += heard || 0; // what was loud on the days of the cycle, in a city played day by day
    var hidden = 2000 * Object.keys(f.men).filter(function (id) { return clubOf(c, id) && can(c, id, 'backroom'); }).length;
    var H = RULES.holdings;
    hidden += H.company.hides * owns(f, 'company');                                   // the company's books
    c.heat = (c.heat || 0) + (f.dirty > RULES.stash + hidden ? RULES.hot : 0) + loud * RULES.loud * (1 - H.paper.hushes * owns(f, 'paper'))   // the paper tells it kindly
      - RULES.cools * (held(c, 'shield') ? 2 : 1) - H.judge.cools * owns(f, 'judge')
      - (P.lineOf(c) === 'low' ? RULES.line.cools * followers(c, f).follow : 0)                                    // a city that lies low
      - Object.keys(f.men).filter(function (id) { return clubOf(c, id) && can(c, id, 'judge'); }).length - ((c.board && c.board.cools) || 0);
    c.heat = Math.max(0, Math.min(100, c.heat));
    if (c.heat >= 100) { if (daily) c.bust = true; else bust(c, f, events); }
  }

  // --- capos who share a city ---
  function pair(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  // A capo who opens or takes a place within reach of another capo's leaves a grudge between them.
  function rub(c, capo, x, y) {
    var seen = {};
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family' || p.capo === capo || seen[p.capo] || far(x, y, p.x, p.y) > RULES.near) return;
      seen[p.capo] = true;
      c.grudge = c.grudge || {};
      c.grudge[pair(capo, p.capo)] = (c.grudge[pair(capo, p.capo)] || 0) + 1;
    });
  }

  function grudges(c) {
    return Object.keys(c.grudge || {}).filter(function (k) { return c.grudge[k] > 0; }).map(function (k) {
      return { a: k.split('|')[0], b: k.split('|')[1], level: c.grudge[k], feud: RULES.feud };
    });
  }

  function feuds(c) {
    return (c.feuds || []).map(function (q) { return { id: q.id, a: q.a, b: q.b, since: q.month, label: q.label }; });
  }

  function feuding(c, capo) { return (c.feuds || []).some(function (q) { return q.a === capo || q.b === capo; }); }

  // What share of his due a capo sends up: nothing while he sulks, half while he feuds.
  function willing(c, capo) {
    return (c.sulk && c.sulk[capo] > c.month) ? 0 : feuding(c, capo) ? 0.5 : 1;
  }

  // Grudges cool, and those that have piled up break out.
  function tempers(c, events) {
    c.grudge = c.grudge || {}; c.feuds = c.feuds || [];
    Object.keys(c.grudge).forEach(function (k) {
      var a = k.split('|')[0], b = k.split('|')[1];
      if (c.grudge[k] >= RULES.feud && !c.feuds.some(function (q) { return q.id === k; })) {
        var label = first(a) + ' and ' + first(b) + ' are at each other\'s throats over the same streets';
        c.feuds.push({ id: k, a: a, b: b, month: c.month, label: label });
        events.push({ type: 'feud', id: k, a: a, b: b, city: c.id, label: label });
      } else if (c.month % RULES.cool === 0 && c.grudge[k] > 0 && c.grudge[k] < RULES.feud) c.grudge[k] -= 1;
      if (!c.grudge[k]) delete c.grudge[k];
    });
  }

  // The boss rules for one of the two: the feud is over, and the other sulks.
  function rule(c, f, id, winner) {
    var q = (c.feuds || []).filter(function (x) { return x.id === id; })[0];
    if (!q) throw new Error('no such feud: ' + id);
    if (winner !== q.a && winner !== q.b) throw new Error(winner + ' is not part of this feud');
    var loser = winner === q.a ? q.b : q.a;
    c.feuds = c.feuds.filter(function (x) { return x !== q; });
    delete c.grudge[id];
    c.sulk = c.sulk || {};
    c.sulk[loser] = c.month + RULES.sulks;
    sway(f, loser, -RULES.loyal.lost);
    return { winner: winner, loser: loser };
  }

  // A price that grows with the family, rounded to the nearest $50.
  function swell(base, rate, n) { return Math.round(base * Math.pow(1 + rate, Math.max(0, n)) / 50) * 50; }

  // The boss's line for this city: grow, earn, lie low, or none.
  function line(c, how) {
    if (how === null || how === undefined) { delete c.line; return; }
    if (!RULES.line[how] || !RULES.line[how].stat) throw new Error('no such line: ' + how);
    c.line = how;
  }
  function lines() { return ['grow', 'earn', 'low'].map(function (id) { return { id: id, name: RULES.line[id].name, gives: RULES.line[id].gives }; }); }
  function followers(c, f) {
    var here = Object.keys(f.men).filter(function (id) { return clubOf(c, id); });
    return { of: here.length, follow: here.filter(function (id) { var l = P.follows(c, f, id); return l && l.follows; }).length };
  }
  // How well the line is held: the share of the city's capos who follow it.
  function lineHeld(c, f) {
    if (!P.lineOf(c)) return null;
    var n = followers(c, f);
    return { share: n.of ? n.follow / n.of : 0, follow: n.follow, of: n.of, label: n.follow + ' of ' + n.of + (n.of === 1 ? ' capo follows' : ' capos follow') };
  }

  // The boss's share in this city: light, normal or heavy.
  function cutOf(c) { return RULES.cut[c.cut] ? c.cut : 'normal'; }
  function cut(c, how) {
    if (!RULES.cut[how]) throw new Error('no such share: ' + how);
    c.cut = how;
  }
  function cuts() { return Object.keys(RULES.cut).map(function (id) { return { id: id, share: RULES.cut[id].share, loyal: RULES.cut[id].loyal }; }); }

  // What clean money buys for good: what the family owns of each, and what the next size costs.
  function holdings(f) {
    return Object.keys(RULES.holdings).map(function (id) {
      var h = RULES.holdings[id], level = owns(f, id);
      return { id: id, name: h.name, gives: h.gives, level: level, most: h.cost.length, next: level < h.cost.length ? { level: level + 1, cost: h.cost[level] } : null };
    });
  }
  function buy(f, id) {
    var h = RULES.holdings[id];
    if (!h) throw new Error('nothing of that name to buy: ' + id);
    var level = owns(f, id);
    if (level >= h.cost.length) throw new Error('there is nothing more to buy of the ' + h.name);
    if ((f.clean || 0) < h.cost[level]) throw new Error('it takes $' + h.cost[level] + ' of clean money');
    f.clean -= h.cost[level];
    f.holdings = f.holdings || {};
    f.holdings[id] = level + 1;
    return { id: id, name: h.name, level: level + 1, cost: h.cost[level] };
  }

  var api = { launder: launder, bust: bust, patience: patience, line: line, lines: lines, lineHeld: lineHeld, keyWorth: keyWorth, expects: expects, promises: promises, judge: judge, holdings: holdings, buy: buy, cutOf: cutOf, cut: cut, cuts: cuts, eyes: eyes, asks: asks, answer: answer, money: money, rub: rub, grudges: grudges, feuds: feuds, willing: willing, tempers: tempers,
      rule: rule, swell: swell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfBoss = api;
})(typeof self !== 'undefined' ? self : this);
