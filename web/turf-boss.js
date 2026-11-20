// What comes up to the boss: capos asking for a key place, the wages and the
// share sent up, and capos of one city who quarrel until he rules.
(function (root) {
  'use strict';
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var G = typeof require === 'function' ? require('./turf-goods.js') : root.AshportTurfGoods;
  var S = typeof require === 'function' ? require('./turf-streets.js') : root.AshportTurfStreets;
  var RULES = R.RULES, key = R.key, far = R.far;
  var KEYS = P.KEYS, can = P.can;
  var everyPlace = C.everyPlace, places = C.places, keys = C.keys, held = C.held, clubOf = C.clubOf;
  var laundries = G.laundries;
  var first = S.first, funds = S.funds, spend = S.spend;

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

  function asks(c) {
    return c.asks.map(function (a) {
      return { id: a.id, capo: a.capo, key: a.key, name: KEYS[a.key].name, gives: KEYS[a.key].gives, x: a.x, y: a.y, way: a.way, cost: a.cost, months: a.months, why: a.why };
    });
  }

  function answer(c, f, id, yes) {
    var a = c.asks.filter(function (q) { return q.id === id; })[0];
    if (!a) throw new Error('nobody is asking for ' + id);
    if (yes) {
      if (funds(f) < a.cost) throw new Error('the boss cannot pay the $' + a.cost + ' the ' + KEYS[a.key].name + ' takes');
      spend(f, a.cost);
      c.ops.push({ capo: a.capo, x: a.x, y: a.y, way: a.way, key: a.key, kind: 'key', cost: a.cost, month: c.month, months: a.months });
    } else c.refused[a.key] = c.month + RULES.sulk;
    c.asks = c.asks.filter(function (q) { return q !== a; });
  }

  // --- two kinds of money ---
  // The month's money: wages by rank, the share each capo sends up, what the fronts wash, and the heat that follows.
  function money(c, f, events) {
    f.clean = f.clean || 0;
    var flow = c.flow || (c.flow = { up: 0, sent: {} });
    flow.pay = 0; flow.cut = 0; flow.seized = 0; flow.wash = {};
    // every man in the city is paid by his rank
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var due = RULES.pay[f.men[capo].rank], dirty = Math.min(due, Math.max(0, f.dirty)), clean = Math.min(due - dirty, Math.max(0, f.clean));
      f.dirty -= dirty; f.clean -= clean; flow.pay += dirty + clean;
      if (dirty + clean < due) events.push({ type: 'unpaid', capo: capo, city: c.id, due: due, label: first(capo) + ' has not been paid this month' });
    });
    // the fronts wash what they can of what is left
    c.washed = 0;
    laundries(c).forEach(function (l) {
      var n = Math.max(0, Math.min(f.dirty, l.most));
      f.dirty -= n; f.clean += n * (1 - l.loss); c.washed += n; flow.cut += n * l.loss; flow.wash[key(l.x, l.y)] = n;
    });
    // money that sleeps and blood in the streets draw the police
    var loud = events.filter(function (e) { return e.type === 'burnt' || e.type === 'repelled' || (e.type === 'taken' && e.way === 'force'); }).length;
    var hidden = 2000 * Object.keys(f.men).filter(function (id) { return clubOf(c, id) && can(c, id, 'backroom'); }).length;
    c.heat = (c.heat || 0) + (f.dirty > RULES.stash + hidden ? RULES.hot : 0) + loud * RULES.loud - RULES.cools * (held(c, 'shield') ? 2 : 1)
      - Object.keys(f.men).filter(function (id) { return clubOf(c, id) && can(c, id, 'judge'); }).length - ((c.board && c.board.cools) || 0);
    c.heat = Math.max(0, Math.min(100, c.heat));
    if (c.heat >= 100) {
      var seized = Math.round(Math.max(0, f.dirty) * RULES.bust);
      f.dirty -= seized; flow.seized = seized;
      c.heat = RULES.afterBust;
      events.push({ type: 'bust', city: c.id, seized: seized, label: 'The police raid the family\'s counting rooms and seize $' + seized });
    }
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
    return { winner: winner, loser: loser };
  }

  // A price that grows with the family, rounded to the nearest $50.
  function swell(base, rate, n) { return Math.round(base * Math.pow(1 + rate, Math.max(0, n)) / 50) * 50; }

  var api = { eyes: eyes, asks: asks, answer: answer, money: money, rub: rub, grudges: grudges, feuds: feuds, willing: willing, tempers: tempers,
      rule: rule, swell: swell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfBoss = api;
})(typeof self !== 'undefined' ? self : this);
