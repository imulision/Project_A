// The reign: the four acts a family goes through as it grows, and the hidden director who keeps things happening.
// No drawing and no browser here, and nothing of the cities either: empire.js tells this file what it sees
// (the share of the map, the day's events, the cities) and carries out what the director decides.
//
// To retune, change RULES. The acts follow the ranks of the family: nothing here comes at a date.
(function (root) {
  'use strict';

  var RULES = {
    // the ranks of a family: the share of the whole map (in %) each one starts at
    ranks: [['Street gang', 0], ['Crew', 3], ['Family', 10], ['Syndicate', 25], ['Commission', 50]],
    slip: 1,            // points of the map a family must fall under a rank before it loses the act that came with it
    director: {
      // days between two things the director makes happen, act by act: he draws a new wait each time, anywhere between the two
      wait: [[120, 260], [100, 220], [80, 180], [64, 140]],
      size: [1, 1.25, 1.5, 2], // how hard his beats hit, act by act
      dead: 12,         // days with no news before his clock runs twice as fast
      ease: 0.5,        // tension lost a day
      calm: 20,         // at this tension or above he puts no pressure on: the family breathes
      // what each piece of bad news adds to the tension (out of 100); `beat` is his own pressure
      knocks: { burnt: 40, bust: 60, betrayal: 50, hijack: 15, seizure: 20, unpaid: 10, vendetta: 25, fall: 30, beat: 30 },
      growing: 0.2,     // points of the map won over the last `over` cycles for a family to count as growing
      over: 6,
      cargo: 500,       // dirty $ of a lost truck
      captain: 15,      // heat a new police captain brings
      cool: 20,         // heat that leaves with an old one, in a city at least this hot
      truce: 6,         // cycles the rivals leave a city alone while they bury their own
      blood: 4,         // cycles they come twice as hard with guns from out of town
      godson: 10,       // loyalty a capo who was turning sour wins back when the boss stands godfather to his son
      thief: 400        // dirty $ a bookkeeper runs off with
    }
  };
  var DAYS = 24; // days in a cycle of the rules, for the words only (empire.js sets it from the rules)

  // What each act opens, what the boss watches in it and what threatens him. `opens` are keys for the screen and for
  // the orders: nothing of an act is shown or allowed before the family has reached it once.
  var NUMERAL = ['I', 'II', 'III', 'IV'];
  var ACTS = [
    { id: 'street', name: 'The Street', hq: 'Back room', opens: ['places', 'men', 'dirty', 'jobs'], watch: 'Every place, every man', threat: 'The gang next door',
      gives: 'One street, your first men and dirty money', short: 'your first street' },
    { id: 'city', name: 'The City', hq: 'Club', opens: ['clean', 'table', 'roads', 'vault', 'laws'], watch: 'Your capos more than their places', threat: 'The police, and the chief who holds the city',
      gives: 'A table of trusted men, the roads to the cities next door, and a vault where more dirty money sleeps unseen', short: 'the table and the roads' },
    { id: 'roads', name: 'The Roads', hq: 'Hotel floor', opens: ['underboss', 'convoys', 'nerve'], watch: 'Your underbosses and your roads', threat: 'War between families, and betrayal',
      gives: 'An underboss to hold each city for you, and a deeper vault', short: 'underbosses' },
    { id: 'commission', name: 'The Commission', hq: 'Mansion', opens: ['counsel', 'politics', 'press', 'heir'], watch: 'Your name, and who comes after you', threat: 'The federal case, and a knife from inside',
      gives: 'A seat among the families that count, and a Counsel at your table', short: 'a Counsel at your table' }
  ];

  function rankOf(share) { var n = 0; RULES.ranks.forEach(function (r, i) { if (share >= r[1]) n = i; }); return n; }
  // rank(share) -> { n, name, next, from, to, part: how far towards the next rank, from 0 to 1 }
  function rank(share) {
    var n = rankOf(share), nx = RULES.ranks[n + 1], from = RULES.ranks[n][1], to = nx ? nx[1] : null;
    return { n: n, name: RULES.ranks[n][0], next: nx ? nx[0] : null, from: from, to: to, part: to === null ? 1 : Math.max(0, Math.min(1, (share - from) / (to - from))) };
  }

  // The rank a family holds: won the day it reaches the share, lost only once it has fallen `slip` under it, so that a
  // family on a threshold is not said to rise and fall every other day. r.rank is kept with the reign.
  function hold(r, share) {
    var n = r.rank === undefined ? rankOf(share) : r.rank, top = RULES.ranks.length - 1;
    while (n < top && share >= RULES.ranks[n + 1][1]) n += 1;
    while (n > 0 && share < RULES.ranks[n][1] - RULES.slip) n -= 1;
    r.rank = n;
    return n;
  }
  function standing(r, share) {
    var n = hold(r, share), nx = RULES.ranks[n + 1], from = RULES.ranks[n][1], to = nx ? nx[1] : null;
    return { n: n, name: RULES.ranks[n][0], next: nx ? nx[0] : null, from: from, to: to, part: to === null ? 1 : Math.max(0, Math.min(1, (share - from) / (to - from))) };
  }

  // What the family is after now: the share of the map that gives the next rank, and what that rank opens. The last
  // rank wins the game. null once there is nothing left to reach.
  var WON = 'The game is won: your family sits on the Commission';
  function goal(r, share) {
    var n = hold(r, share), top = RULES.ranks.length - 1;
    if (n >= top) return null;
    var nx = RULES.ranks[n + 1], from = RULES.ranks[n][1], a = ACTS[n + 1];
    return { need: nx[1], rank: nx[0], at: Math.round(share * 10) / 10, part: Math.max(0, Math.min(1, (share - from) / (nx[1] - from))),
             act: a ? 'Act ' + NUMERAL[n + 1] + ': ' + a.name : null, opens: a ? a.gives : WON, short: a ? a.short : 'the game is won',
             final: RULES.ranks[top][1], wins: n + 1 === top };
  }
  // The road, rank by rank, for the screen: the share each starts at and what it opens.
  function road(r) {
    return RULES.ranks.map(function (k, i) {
      var a = ACTS[i];
      return { n: i, rank: k[0], from: k[1], act: a ? 'Act ' + NUMERAL[i] + ': ' + a.name : null, gives: a ? a.gives : WON, now: i === (r.rank || 0), done: i < (r.rank || 0), wins: i === RULES.ranks.length - 1 };
    });
  }
  function atTop(r) { return (r.rank || 0) >= RULES.ranks.length - 1; }

  function hash(a, b, c) {
    var n = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0);
  }
  function drawWait(r) {
    var w = RULES.director.wait[r.act];
    return w[0] + hash(r.seed, r.beats, 7) % (w[1] - w[0] + 1);
  }
  function create(seed) {
    var r = { act: 0, reached: 0, tension: 0, quiet: 0, beats: 0, seed: seed || 0 };
    r.left = drawWait(r);
    return r;
  }
  function act(r) {
    var a = ACTS[r.act];
    return { n: r.act, id: a.id, name: a.name, hq: a.hq, numeral: NUMERAL[r.act], opens: a.opens, watch: a.watch, threat: a.threat, gives: a.gives };
  }
  // Is this open yet: something stays open once its act has been reached, even if the family falls back.
  function open(r, what) { return ACTS.some(function (a, i) { return i <= r.reached && a.opens.indexOf(what) >= 0; }); }
  // The act that opens it, in words for the boss; null for what no act holds back.
  function opensAt(what) {
    for (var i = 0; i < ACTS.length; i++) if (ACTS[i].opens.indexOf(what) >= 0) return 'Act ' + NUMERAL[i] + ': ' + ACTS[i].name;
    return null;
  }
  // The family holds this share of the map today: the acts it wins or loses, told one by one.
  function place(r, share) {
    var out = [], top = ACTS.length - 1;
    hold(r, share);
    while (r.act < top && share >= RULES.ranks[r.act + 1][1]) {
      r.act += 1;
      var first = r.act > r.reached, a = ACTS[r.act];
      if (first) r.reached = r.act;
      out.push({ type: 'act', act: r.act, up: true, first: first, name: a.name, numeral: NUMERAL[r.act], opens: a.opens, gives: a.gives,
                 label: 'Act ' + NUMERAL[r.act] + ': ' + a.name });
    }
    while (r.act > 0 && share < RULES.ranks[r.act][1] - RULES.slip) {
      r.act -= 1;
      r.tension = Math.min(100, r.tension + RULES.director.knocks.fall);
      out.push({ type: 'act', act: r.act, up: false, first: false, name: ACTS[r.act].name, numeral: NUMERAL[r.act], opens: [], gives: 'What you opened stays open',
                 label: 'The family falls back to Act ' + NUMERAL[r.act] + ': ' + ACTS[r.act].name });
    }
    return out;
  }

  // --- the director ---
  // News that counts as something happening, good or bad: while it comes by itself the director takes his time.
  var NEWS = { opened: 1, taken: 1, burnt: 1, repelled: 1, rank: 1, welcomed: 1, bust: 1, betrayal: 1, vendetta: 1, hijack: 1, seizure: 1, converted: 1, learned: 1, feud: 1, asks: 1, knocks: 1, act: 1 };
  function hear(r, events) {
    var k = RULES.director.knocks;
    events.forEach(function (e) {
      if (e.type === 'beat') return;
      if (NEWS[e.type]) r.quiet = 0;
      if (k[e.type]) r.tension = Math.min(100, r.tension + k[e.type]);
    });
  }
  function dollars(n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function days(cycles) { return Math.round(cycles * DAYS) + ' days'; }
  // What he can make happen. `where`: the cities it can happen in; `from`: the first act it belongs to.
  var BEATS = {
    truce: { tone: 'good', from: 0, where: function (c) { return c.held && c.rival && !c.quiet; },
             tell: function (c) { return { label: 'The ' + c.rival + 's bury one of their own in ' + c.name, gives: 'They leave your places alone for ' + days(RULES.director.truce) }; } },
    cargo: { tone: 'good', from: 0, where: function (c) { return c.held; },
             tell: function (c, size) { return { amount: Math.round(RULES.director.cargo * size), label: 'A truck with no owner is found in ' + c.name, gives: dollars(RULES.director.cargo * size) + ' for the family' }; } },
    cool: { tone: 'good', from: 1, where: function (c) { return c.held && c.heat >= RULES.director.cool; },
            tell: function (c) { return { label: 'The police captain of ' + c.name + ' is sent to another town', gives: 'The heat falls by ' + RULES.director.cool }; } },
    godson: { tone: 'good', from: 0, where: function (c) { return c.held && c.sour; },
              tell: function (c) { return { capo: c.sour.id, label: c.sour.name.split(' ')[0] + ' asks you to stand godfather to his son', gives: 'He is more loyal (+' + RULES.director.godson + ')' }; } },
    thief: { tone: 'bad', from: 0, where: function (c, sight) { return c.held && (sight.dirty || 0) >= RULES.director.thief * 2; },
             tell: function (c, size) { return { amount: Math.round(RULES.director.thief * size), label: 'A bookkeeper runs off with the count in ' + c.name, gives: dollars(RULES.director.thief * size) + ' of dirty money is gone' }; } },
    blood: { tone: 'bad', from: 0, where: function (c) { return c.held && c.rival && !c.quiet; },
             tell: function (c, size) { return { label: 'The ' + c.rival + 's bring in guns from out of town', gives: 'They come twice as hard in ' + c.name + ' for ' + days(RULES.director.blood * size) }; } },
    captain: { tone: 'bad', from: 1, where: function (c) { return c.held; },
               tell: function (c, size) { return { label: 'A new police captain takes over in ' + c.name, gives: 'The heat rises by ' + Math.round(RULES.director.captain * size) }; } }
  };
  var KINDS = Object.keys(BEATS);
  // One day goes by. sight: { day: days since the reign began, growing: is the family winning streets,
  // dirty: the boss's dirty money, cities: [{ id, name, held, heat, rival, quiet: the rivals already leave it alone,
  // sour: { id, name } the capo there who is turning sour, if any }] }.
  // Returns what he makes happen today ({ type: 'beat', kind, tone, city, size, label, gives }), or null. empire.js carries it out.
  function direct(r, sight) {
    var d = RULES.director;
    r.tension = Math.max(0, r.tension - d.ease);
    r.quiet += 1;
    r.left -= r.quiet > d.dead ? 2 : 1;
    if (r.left > 0) return null;
    if (typeof sight === 'function') sight = sight(); // looked at only on the day he moves
    // after a hard knock he lends a hand; a family that grows unopposed gets trouble; one that stands still gets an opening
    var tone = r.tension >= d.calm ? 'good' : sight.growing ? 'bad' : 'good', size = d.size[r.act], can = [];
    KINDS.forEach(function (kind) {
      var b = BEATS[kind];
      if (b.tone !== tone || b.from > r.act) return;
      sight.cities.forEach(function (c) { if (b.where(c, sight)) can.push({ kind: kind, c: c }); });
    });
    if (!can.length) return null;
    var other = can.filter(function (q) { return q.kind !== r.last; }); // never the same story twice in a row when another can be told
    if (other.length) can = other;
    var pick = can[hash(r.seed, r.beats, sight.day) % can.length], out = { type: 'beat', kind: pick.kind, tone: tone, city: pick.c.id, size: size };
    var said = BEATS[pick.kind].tell(pick.c, size);
    Object.keys(said).forEach(function (k) { out[k] = said[k]; });
    r.beats += 1;
    r.last = pick.kind;
    r.quiet = 0;
    r.left = drawWait(r);
    if (tone === 'bad') r.tension = Math.min(100, r.tension + d.knocks.beat);
    return out;
  }

  var api = { RULES: RULES, ACTS: ACTS, rank: rank, standing: standing, goal: goal, road: road, atTop: atTop, create: create, act: act, open: open, opensAt: opensAt, place: place, hear: hear, direct: direct,
              setDays: function (n) { DAYS = n; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportReign = api;
})(typeof self !== 'undefined' ? self : this);
