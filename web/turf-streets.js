// A capo's month in the streets: what he plans, what he takes, how the rival
// grows and raids, and what the boss has to spend.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var G = typeof require === 'function' ? require('./turf-goods.js') : root.AshportTurfGoods;
  var RULES = R.RULES, key = R.key, at = R.at, far = R.far;
  var KEYS = P.KEYS, who = P.who, can = P.can;
  var run = C.run, bestKind = C.bestKind, zoneOf = C.zoneOf, changed = C.changed, everyPlace = C.everyPlace, held = C.held, open = C.open, clubOf = C.clubOf,
      hold = C.hold, grip = C.grip;
  var wages = G.wages, busy = G.busy, wants = G.wants, washing = G.washing;

  // --- the family in a city, month after month ---
  // `f` is what the family carries from city to city: its building tree,
  // its men (cash in hand, rank, what they have learned) and the boss's money.
  function join(f, capo) {
    if (!who(capo)) throw new Error('unknown capo: ' + capo);
    if (!f.men[capo]) f.men[capo] = { cash: RULES.purse, xp: 0, rank: 0, income: 0, cars: 1 };
    return f.men[capo];
  }

  function first(capo) { return who(capo).name.split(' ')[0]; }

  // What he is after and how far his money is from it, for the screen.
  function plan(c, f, capo) {
    var m = f.men[capo], busy = c.ops.filter(function (o) { return o.capo === capo && !o.key; })[0]; // a key place is the boss's affair: the capo goes on with his own
    if (busy) return { move: 'take', way: busy.way, x: busy.x, y: busy.y, cost: busy.cost, saved: busy.cost, progress: 1, waiting: 'time', why: 'his men are on their way' };
    var w = wants(c, capo, { rank: m.rank, tech: f.tech, wash: f.dirty - washing(c).most > RULES.stash });
    if (!w) return { move: 'hold', waiting: 'rank', cost: 0, saved: 0, progress: 1, why: 'he runs all he can at his rank' };
    var saved = Math.max(0, Math.min(w.cost, m.cash - wages(c, capo)));
    return { move: w.move, way: w.way, months: w.months, kind: w.kind, name: w.name, x: w.x, y: w.y, cost: w.cost, saved: saved, progress: w.cost ? saved / w.cost : 1,
             waiting: saved >= w.cost ? null : 'money', why: w.why };
  }

  function settleTakes(c, events) {
    var struck = null;
    settle(c, events, function (o) { struck = o; });
    if (struck) swear(c, events, struck);
  }
  // A chief struck gun in hand swears a vendetta. Struck again, it starts over without another word.
  function swear(c, events, o) {
    var id = P.chiefOf(c), on = (c.vendetta || 0) > c.month;
    if (!id) return;
    c.vendetta = c.month + RULES.vendetta.months;
    if (on) return;
    events.push({ type: 'vendetta', city: c.id, chief: id, family: c.rival, months: RULES.vendetta.months, x: o.x, y: o.y,
                  label: who(id).name + ' swears he will have blood for ' + zoneOf(c, o.x, o.y).name });
  }
  function settle(c, events, hit) {
    c.ops = c.ops.filter(function (o) {
      if (c.month - o.month < o.months) return true;
      var was = at(c, o.x, o.y);
      if (!was || was.owner === 'family') return false; // nothing left to take
      if (o.key) {
        was.owner = 'family'; was.capo = o.capo;
        changed(c);
        if (o.way === 'force') hit(o);
        events.push({ type: 'taken', capo: o.capo, city: c.id, x: o.x, y: o.y, kind: 'key', key: o.key, way: o.way, from: c.rival,
                      label: 'The ' + KEYS[o.key].name + ' is ours: ' + first(o.capo) + ' holds it now' });
        return false;
      }
      c.blocks[key(o.x, o.y)] = { owner: 'family', kind: o.kind, level: 1, capo: o.capo };
      changed(c);
      if (o.way === 'force') hit(o);
      events.push({ type: 'taken', capo: o.capo, city: c.id, x: o.x, y: o.y, kind: o.kind, way: o.way, from: was.owner,
                    label: o.way === 'force' ? first(o.capo) + '\'s men take the ' + was.owner + 's\' place in ' + zoneOf(c, o.x, o.y).name + ', gun in hand'
                         : o.way === 'bribe' ? 'The ' + was.owner + 's\' man in ' + zoneOf(c, o.x, o.y).name + ' takes ' + first(o.capo) + '\'s envelope'
                         : first(o.capo) + ' buys out the ' + was.owner + 's\' place in ' + zoneOf(c, o.x, o.y).name });
      return false;
    });
  }

  // The rivals open a place of their own now and then, on the free block they press on hardest toward the family.
  function rivalGrows(c) {
    if (!c.rival || c.month % RULES.rivalGrows !== 0) return;
    var theirs = everyPlace(c).filter(function (p) { return p.owner !== 'family'; }), ours = everyPlace(c).filter(function (p) { return p.owner === 'family'; });
    if (theirs.length >= RULES.rivalMost * R.size(c) / 100) return;
    var best = null;
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      if (at(c, x, y) || grip(c, x, y) !== 'rival') continue;
      var d = ours.reduce(function (n, p) { return Math.min(n, far(x, y, p.x, p.y)); }, 99);
      if (!best || d < best.d) best = { x: x, y: y, d: d };
    }
    if (!best) return;
    open(c, best.x, best.y, { owner: c.rival, kind: bestKind(c, best.x, best.y) });
    c.rivalLast = { type: 'opened', month: c.month, x: best.x, y: best.y, label: 'Opened a ' + D.SITES[at(c, best.x, best.y).kind].name.toLowerCase() + ' in ' + zoneOf(c, best.x, best.y).name };
    // it answers to the lieutenant next door
    var near = theirs.filter(function (p) { return p.man; }).sort(function (a, b) { return far(best.x, best.y, a.x, a.y) - far(best.x, best.y, b.x, b.y); })[0];
    if (near) { at(c, best.x, best.y).man = near.man; changed(c); }
  }

  // Who answers when a family place is hit: the hardest capo with a club close by, or its own.
  function cover(c, x, y) {
    var grit = function (capo) { return who(capo).muscle + (can(c, capo, 'hard') ? 2 : 0); };
    var p = at(c, x, y), best = { capo: p.capo, muscle: grit(p.capo) };
    everyPlace(c).forEach(function (q) {
      if (q.owner !== 'family' || q.kind !== 'club' || far(x, y, q.x, q.y) > RULES.cover) return;
      if (grit(q.capo) > best.muscle) best = { capo: q.capo, muscle: grit(q.capo) };
    });
    return best;
  }

  // Now and then they come for the family's place they press on hardest. A capo's Muscle decides if it stands.
  function rivalRaids(c, events) {
    if (c.month % RULES.rivalEvery !== 0 || c.month <= (c.quiet || 0)) return;
    var target = null;
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family' || p.kind === 'club' || p.kind === 'key' || can(c, p.capo, 'feared')) return;
      if (c.sated && c.sated[p.capo] > c.month) return;   // they burnt one of his not long ago
      var h = hold(c, p.x, p.y);
      if (h.rival < RULES.rivalReach) return;
      if (!target || h.rival - h.family > target.margin) target = { margin: h.rival - h.family, p: p, h: h };
    });
    if (!target) return;
    var p = target.p, by = c.rival || everyPlace(c).filter(function (q) { return q.owner !== 'family'; })[0].owner, where = zoneOf(c, p.x, p.y).name;
    var guard = cover(c, p.x, p.y);
    var e = { capo: p.capo, city: c.id, x: p.x, y: p.y, kind: p.kind, by: by, heldBy: guard.capo };
    var fury = 1 + everyPlace(c).filter(function (q) { return q.owner === 'family'; }).length / RULES.anger; // the bigger the family, the harder they come
    if ((c.vendetta || 0) > c.month) fury *= 1 + RULES.vendetta.fury;                                      // and harder still while their chief wants blood
    if (target.h.family * (RULES.stand + guard.muscle / 10 + held(c, 'shield')) >= target.h.rival * fury) {
      e.type = 'repelled';
      c.repelled += 1;
      e.label = 'The ' + by + 's come for ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where
        + (guard.capo === p.capo ? ' and are thrown back' : ': ' + first(guard.capo) + '\'s men throw them back');
    } else {
      delete c.blocks[key(p.x, p.y)];
      changed(c);
      e.type = 'burnt';
      // they have had their fill of this man for a while; the bigger the family, the sooner they are back
      c.sated = c.sated || {}; c.sated[p.capo] = c.month + Math.round(RULES.sated / fury);
      c.burnt = (c.burnt || 0) + 1;
      e.label = 'The ' + by + 's burn out ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where;
    }
    c.rivalLast = { type: e.type, month: c.month, x: p.x, y: p.y, label: e.type === 'burnt' ? 'Burnt out ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where : 'Came for ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where + ' and was thrown back' };
    c.raid = { month: c.month, x: p.x, y: p.y, capo: guard.capo || p.capo, by: by, kind: p.kind };
    events.push(e);
  }

  // Where a capo is this month, and what took him there: the place he is taking, the street the rivals
  // struck, the door of the man he quarrels with, the key place he asks for. Otherwise his club.
  function whereabouts(c, f, capo) {
    var club = clubOf(c, capo), op = c.ops.filter(function (o) { return o.capo === capo; })[0];
    var site = function (kind, key) { return (kind === 'key' ? KEYS[key].name : D.SITES[kind].name).toLowerCase(); };
    if (op) {
      var b = at(c, op.x, op.y), whose = b && b.owner !== 'family' ? 'the ' + b.owner + 's\' ' : 'the ';
      return { x: op.x, y: op.y, why: 'take', label: 'Taking ' + whose + site(op.kind, op.key) + ' in ' + zoneOf(c, op.x, op.y).name };
    }
    if (c.raid && c.raid.month === c.month && c.raid.capo === capo) {
      return { x: c.raid.x, y: c.raid.y, why: 'raid', label: 'Facing the ' + c.raid.by + 's in ' + zoneOf(c, c.raid.x, c.raid.y).name };
    }
    var feud = (c.feuds || []).filter(function (q) { return q.a === capo && clubOf(c, q.b); })[0];
    if (feud) { var other = clubOf(c, feud.b); return { x: other.x, y: other.y, why: 'feud', label: 'Having it out with ' + first(feud.b) }; }
    var ask = c.asks.filter(function (a) { return a.capo === capo; })[0];
    if (ask) return { x: ask.x, y: ask.y, why: 'asks', label: 'Waiting for your word in front of the ' + KEYS[ask.key].name };
    var h = f.men && f.men[capo] && f.men[capo].help;
    if (h && at(c, h.x, h.y)) {
      return { x: h.x, y: h.y, why: h.why, label: h.why === 'carry' ? 'Driving the takings of his ' + site(h.kind) + ' home himself'
        : 'Standing over his ' + site(h.kind) + ' in ' + zoneOf(c, h.x, h.y).name };
    }
    return { x: club.x, y: club.y, why: 'home', label: 'At his club' };
  }

  // What the boss can spend: his dirty money, and his clean money once the dirty runs out.
  function funds(f) { return Math.max(0, f.dirty) + Math.max(0, f.clean || 0); }

  function spend(f, cost) {
    var dirty = Math.min(cost, Math.max(0, f.dirty));
    f.dirty -= dirty;
    f.clean = (f.clean || 0) - (cost - dirty);
  }

  // The man across the street, as the boss can read him: how strong, what he did last, and whether he wants blood.
  function chief(c) {
    var id = P.chiefOf(c);
    if (!id) return null;
    return { id: id, name: who(id).name, family: c.rival, strength: Math.round(C.share(c).rival), last: c.rivalLast || null, vendetta: Math.max(0, (c.vendetta || 0) - c.month) };
  }

  var api = { chief: chief, join: join, first: first, plan: plan, settleTakes: settleTakes, rivalGrows: rivalGrows, cover: cover, rivalRaids: rivalRaids,
      whereabouts: whereabouts, funds: funds, spend: spend };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfStreets = api;
})(typeof self !== 'undefined' ? self : this);
