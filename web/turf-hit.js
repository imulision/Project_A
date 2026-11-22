// The live hit: a guarded place taken gun in hand is played in three steps (the street, the door, inside).
// The street is fought on arrival; at the door and inside the boss may call it (press on, hold, pull out).
// If he says nothing the capo decides alone, by his own character. No drawing and no browser here.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var RULES = R.RULES, key = R.key, at = R.at;
  var who = P.who;

  RULES.hit = {
    guarded: 60,      // a rival place is guarded when the rivals press this hard on its block
    wait: 12,         // days the capo waits for the boss's word at each step before he decides alone
    crew: 3,          // men a capo of no Muscle and no rank brings; each two points of Muscle and each rank add one
    guard: 2,         // men who guard any place; each level adds `perLevel`, and every `perPress` of rival press one more
    perLevel: 2, perPress: 30,
    split: [0.3, 0.4], // share of the guards met in the street and at the door; the rest are inside
    toll: 0.9,        // men lost for each guard met by a capo of no Muscle; each point of Muscle takes `grit` off
    grit: 0.06,
    rout: 2,          // a crew down to this many men runs
    face: 8,          // loyalty a capo loses when he is pulled out or routed
    blood: 100,       // dirty $ each man lost costs his capo
    heat: 2,          // heat each man lost brings
    noise: 6,         // heat of a place burnt out or of a crew routed in the street
    till: 1           // cycles of the place's worth found in its till
  };
  var STAGES = ['The street', 'The door', 'Inside'];
  var CALLS = { press: 'Press on', hold: 'Hold', pull: 'Pull out' };
  var land = null; // how a place taken gun in hand becomes the family's: given by turf-streets.js

  function first(capo) { return who(capo).name.split(' ')[0]; }
  function site(o) { return D.SITES[o.kind].name; }
  function jitter(c, h, n) { return ((c.month * 31 + h.x * 17 + h.y * 13 + h.stage * 7 + n * 5 + h.capo.length) % 3 === 0) ? 1 : 0; }

  // Is this take a live hit: gun in hand, on a place the rivals press hard on. A key place stays the boss's own affair.
  function guarded(c, o) {
    if (o.way !== 'force' || o.key || o.kind === 'key' || o.kind === 'hq') return false;
    var b = at(c, o.x, o.y);
    return !!b && b.owner !== 'family' && C.hold(c, o.x, o.y).rival >= RULES.hit.guarded;
  }
  function tollOf(capo) { return Math.max(0.2, RULES.hit.toll - RULES.hit.grit * who(capo).muscle); }
  // The men of ours a step costs: the fewest and the most.
  function cost(h) { var n = Math.round(h.guards[h.stage] * tollOf(h.capo)); return { lo: n, hi: n + 1 }; }
  // One step is fought: its guards are gone, and some of ours with them.
  function fight(c, h) {
    var lost = Math.min(h.ours, cost(h).lo + jitter(c, h, 1));
    h.ours -= lost; h.lost += lost;
    h.theirs -= h.guards[h.stage]; h.guards[h.stage] = 0;
    return lost;
  }
  function tell(c, h, step, more) {
    var e = { type: 'hit', step: step, id: h.id, city: c.id, capo: h.capo, x: h.x, y: h.y, kind: h.kind, stage: h.stage, ours: h.ours, theirs: h.theirs, lost: h.lost };
    Object.keys(more).forEach(function (k) { e[k] = more[k]; });
    return e;
  }
  // What the boss reads at a step.
  function title(h) { return h.stage === 1 ? (h.last > 1 ? 'They were waiting at the door' : 'The street is his') : (h.last > 1 ? 'The door cost him dear' : 'The door is down'); }
  function say(h) {
    var down = h.last === 0 ? 'Nobody of ours is down' : h.last === 1 ? 'One of ours is down' : R.NUMBER[h.last][0].toUpperCase() + R.NUMBER[h.last].slice(1) + ' of ours are down';
    return down + '. ' + first(h.capo) + (h.stage === 1 ? ' holds the street' : ' is at the door') + ' and waits for your word.';
  }
  // What the capo does if the boss says nothing: a hothead goes in, a careful man counts first.
  function alone(h) {
    var p = who(h.capo), ahead = h.ours - cost(h).hi > RULES.hit.rout && h.ours >= h.theirs;
    if (ahead) return 'press';
    if (p.ambition >= 60 || p.muscle >= 7) return 'press';
    return p.cunning >= 6 && h.stage === 1 ? 'pull' : 'hold';
  }
  function calls(h) {
    var n = cost(h), name = site(h);
    return [
      { id: 'press', name: CALLS.press, gains: h.stage === 2 ? ['The ' + name, 'Its till'] : ['The door, then the ' + name.toLowerCase()], risks: [n.lo + ' to ' + n.hi + ' men', 'Heat'] },
      { id: 'hold', name: CALLS.hold, gains: ['The street: their place burns'], risks: ['No ' + name.toLowerCase(), '1 or 2 men'] },
      { id: 'pull', name: CALLS.pull, gains: ['No more men lost'], risks: ['Nothing won', first(h.capo) + ' loses face'] }
    ];
  }
  function ask(c, h, events) {
    h.left = RULES.hit.wait;
    events.push(tell(c, h, 'call', { title: title(h), label: first(h.capo) + ' waits for your word at the ' + site(h).toLowerCase() + ': ' + title(h).toLowerCase() }));
  }
  function ours(c) { var n = 0; for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) if (R.inside(c, x, y) && C.grip(c, x, y) === 'family') n += 1; return n; }
  // The hit is over: what was won and what it cost.
  function end(c, f, h, outcome, call, watched, events) {
    var K = RULES.hit, m = f.men[h.capo], before = ours(c), name = site(h), him = first(h.capo), till = 0, heat = h.lost * K.heat;
    c.hits = c.hits.filter(function (q) { return q.id !== h.id; });
    if (outcome === 'won') {
      var was = at(c, h.x, h.y);
      till = Math.round(K.till * R.WORTH[h.kind] * (was && was.level || 1));
      land(c, events, h.op);
    } else if (outcome === 'held') {
      delete c.blocks[key(h.x, h.y)]; C.changed(c);
      heat += K.noise;
    } else {
      P.sway(f, h.capo, -K.face);
      if (outcome === 'routed') heat += K.noise;
    }
    if (m) m.cash = Math.max(0, m.cash - h.lost * K.blood);
    // the till comes home with the men: it is the capo's when they are back at the club
    if (till > 0) { (c.loots = c.loots || []).push({ capo: h.capo, x: h.x, y: h.y, amount: till }); if (!(c.turn && c.turn.daily)) home(c, f, events); }
    c.heat = Math.min(99, (c.heat || 0) + heat);
    var result = { outcome: outcome, won: outcome === 'won', call: call, watched: watched, place: outcome === 'won' ? 1 : 0, streets: ours(c) - before, till: till, lost: h.lost, heat: Math.min(99, heat) };
    result.title = { won: 'The ' + name + ' is ours', held: 'The ' + name + ' burns', pulled: him + ' pulled out of the ' + name.toLowerCase(), routed: him + '\'s men ran' }[outcome];
    var men = h.lost === 0 ? 'no man' : h.lost === 1 ? 'one man' : R.NUMBER[Math.min(10, h.lost)] + ' men';
    result.say = (watched ? { won: him + ' went in on your word.', held: him + ' held the street on your word.', pulled: 'You called him back.', routed: 'He went in on your word.' }[outcome] : 'You were not watching.')
      + ' He lost ' + men + (outcome === 'won' ? ' and took $' + till + ' from the till.' : outcome === 'held' ? ' and their place is gone.' : outcome === 'pulled' ? ' and kept the rest.' : ' and has nothing to show for it.');
    c.hitLast = { id: h.id, capo: h.capo, x: h.x, y: h.y, kind: h.kind, name: name, rival: h.rival, month: c.month, result: result };
    events.push(tell(c, h, 'end', { call: call, watched: watched, result: result, label: result.title + ': ' + him + ' lost ' + men }));
  }
  // The men are back from a place they took: its till is counted at the club.
  function home(c, f, events) {
    (c.loots || []).forEach(function (l) {
      var m = f.men[l.capo], club = C.clubOf(c, l.capo);
      if (!m || !club) return; // nobody left to bring it to: it is lost
      m.cash += l.amount;
      events.push({ type: 'loot', city: c.id, capo: l.capo, x: club.x, y: club.y, from: { x: l.x, y: l.y }, amount: l.amount });
    });
    c.loots = [];
  }
  // A call is carried out, by the boss (watched) or by the capo alone.
  function resolve(c, f, h, call, watched, events) {
    if (call === 'pull') return end(c, f, h, 'pulled', call, watched, events);
    if (call === 'hold') {
      var lost = Math.min(h.ours, 1 + jitter(c, h, 2));
      h.ours -= lost; h.lost += lost;
      return end(c, f, h, 'held', call, watched, events);
    }
    h.last = fight(c, h);
    if (h.ours <= RULES.hit.rout) return end(c, f, h, 'routed', call, watched, events);
    if (h.stage === 2) return end(c, f, h, 'won', call, watched, events);
    h.stage += 1;
    events.push(tell(c, h, 'stage', { call: call, watched: watched, label: first(h.capo) + '\'s men are through the door of the ' + site(h).toLowerCase() }));
    ask(c, h, events);
  }
  // The men arrive: the street is fought at once, then the capo waits for a word at the door.
  function open(c, f, o, events) {
    var K = RULES.hit, b = at(c, o.x, o.y), p = who(o.capo), m = f.men[o.capo] || { rank: 0 };
    var total = K.guard + K.perLevel * (b.level || 1) + Math.floor(C.hold(c, o.x, o.y).rival / K.perPress), g0 = Math.ceil(total * K.split[0]), g1 = Math.ceil(total * K.split[1]);
    c.hitSeq = (c.hitSeq || 0) + 1;
    var h = { id: c.id + ':hit' + c.hitSeq, capo: o.capo, x: o.x, y: o.y, kind: b.kind, rival: b.owner, op: o, stage: 0, lost: 0, last: 0,
              ours: K.crew + Math.round(p.muscle / 2) + (m.rank || 0), theirs: total, guards: [g0, g1, Math.max(0, total - g0 - g1)] };
    c.hits = c.hits || []; c.hits.push(h);
    events.push(tell(c, h, 'start', { label: first(o.capo) + ' hits the ' + b.owner + 's\' ' + site(h).toLowerCase() + ' in ' + C.zoneOf(c, o.x, o.y).name }));
    h.last = fight(c, h);
    if (h.ours <= K.rout) { end(c, f, h, 'routed', 'press', false, events); return h; }
    h.stage = 1;
    ask(c, h, events);
    // played a whole cycle in one blow, nobody can be asked: he goes to the end alone
    if (!(c.turn && c.turn.daily)) while (c.hits.indexOf(h) >= 0) resolve(c, f, h, alone(h), false, events);
    return h;
  }
  // One day goes by: a capo left without a word decides alone.
  function pass(c, f, events) {
    home(c, f, events);
    (c.hits || []).slice().forEach(function (h) {
      h.left -= 1;
      if (h.left <= 0) resolve(c, f, h, alone(h), false, events);
    });
  }
  // The boss's word. Returns what it set off.
  function call(c, f, id, what) {
    var h = (c.hits || []).filter(function (q) { return q.id === id; })[0], events = [];
    if (!h) throw new Error('no such hit: ' + id);
    if (!CALLS[what]) throw new Error('no such call: ' + what);
    resolve(c, f, h, what, true, events);
    return events;
  }
  function view(c) {
    return (c.hits || []).map(function (h) {
      return { id: h.id, capo: h.capo, x: h.x, y: h.y, kind: h.kind, name: site(h), rival: h.rival, stage: h.stage, stages: STAGES, ours: h.ours, theirs: h.theirs, lost: h.lost,
               title: title(h), say: say(h), calls: calls(h), alone: alone(h), left: h.left, of: RULES.hit.wait };
    });
  }
  function on(c, capo) { return (c.hits || []).filter(function (h) { return h.capo === capo; })[0] || null; }

  var api = { STAGES: STAGES, guarded: guarded, open: open, pass: pass, call: call, view: view, on: on, setLand: function (fn) { land = fn; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfHit = api;
})(typeof self !== 'undefined' ? self : this);
