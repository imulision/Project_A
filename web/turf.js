// The city as one fabric of blocks. No drawing and no browser here.
//
// A block holds at most one place, and a place has one boss. Every place
// presses on the streets around it; where the family presses hardest the
// streets are its own, where a rival does they are his, and in between they
// are contested. A capo spreads from his social club, one block at a time,
// and what he opens depends on the street and on his trade.
//
// To retune, change RULES, TERRAIN and WORTH. The capos and the places
// themselves (cost, who refuses what) come from district.js.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;

  var RULES = {
    press: 40,          // how hard a place of level 1 holds its own block
    clubLevel: 2,       // a social club presses like a place of this level
    minHold: 8,         // below this, nobody holds the block
    edge: 1.25,         // one side must press this much harder than the other to own the streets
    near: 2,            // a capo opens within this many blocks of a place he runs
    reach: [6, 10, 15, 20], // places a Soldier, a Capo, a Veteran and a Legend can run
    dearer: 0.12,       // every place a capo runs makes his next one this much dearer
    trade: 2.5,         // how much more a capo wants the place that is his trade
    likes: 1.8,         // and the other places he likes
    another: 0.3,       // each place of a kind he already runs makes one more that much less tempting
    enlarge: 1.5,       // times a place's price, per level reached, to make it bigger
    purse: 600,         // dirty $ a capo arrives with
    club: 150,          // dirty $ a month a social club makes on its own: no capo is ever left with nothing
    wage: 120,          // dirty $ a month for the men of one place
    yield: 0.5,         // share of a place's worth that is left once it has paid its own costs
    pocket: 1500,       // dirty $ a capo keeps on top of what his next move costs: the rest goes up to the boss
    tribute: 0.30,      // share of a capo's monthly profit owed to the boss
    bigger: 0.5,        // what each level above the first adds to what a place earns
    dry: 1 / 3,         // what a speakeasy earns with nothing to pour
    pours: 2,           // speakeasies one still of level 1 keeps wet
    xp: [0, 150, 500, 1200], // months of places run before a man is worth each rank
    rivalGrows: 9,      // months between two places a rival family opens
    rivalMost: 25,      // share of the city's blocks a rival family never goes beyond
    rivalEvery: 6,      // months between two raids on the family's places
    rivalReach: 10,     // a rival only raids a block it presses on at least this hard
    anger: 12,          // every this many places the family runs in the city, the rivals hit twice as hard again
    stand: 0.2,         // a capo of no Muscle holds this share of the family's press against a raid; each point adds a tenth
    // how a capo takes a rival's place: what it costs next to opening one, and how long it takes
    take: { force: { cost: 1.5, months: 4 }, bribe: { cost: 2, months: 3 }, buy: { cost: 3, months: 2 } }
  };
  var RANKS = ['Soldier', 'Capo', 'Veteran', 'Legend'];
  // What a street must be good for, for each kind of place to pay.
  var TERRAIN = { still: 'industry', speakeasy: 'nightlife', gambling: 'nightlife', loft: 'industry', rented: 'wealth', front: 'wealth',
                  warehouse: 'port', brothel: 'nightlife', chopshop: 'industry', fence: 'port', loans: 'wealth', union: 'industry' };
  // What a place is worth a month on a street made for it, before anything else.
  var WORTH = { still: 300, speakeasy: 420, gambling: 420, loft: 600, rented: 150, front: 250, warehouse: 100,
                brothel: 700, chopshop: 500, fence: 450, loans: 400, union: 350 };
  var KINDS = Object.keys(TERRAIN);

  function key(x, y) { return x + ',' + y; }
  function inside(c, x, y) { return x >= 0 && y >= 0 && x < c.w && y < c.h; }
  function at(c, x, y) { return c.blocks[key(x, y)] || null; }
  function far(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

  function createCity(spec) {
    return { id: spec.id, w: spec.w, h: spec.h, zones: spec.zones.map(function (z) {
      return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, traits: z.traits };
    }), blocks: {}, month: 0, rival: null, dice: 1, ops: [] };
  }
  // A throw of the city's own dice: the same city always plays out the same way.
  function roll(c, n) {
    c.dice = (c.dice * 1103515245 + 12345) % 2147483648;
    return Math.floor(c.dice / 2147483648 * n);
  }
  // The rival family that was there first: n places scattered over the city.
  function seed(c, name, n) {
    c.rival = name;
    for (var placed = 0; placed < n;) {
      var x = roll(c, c.w), y = roll(c, c.h);
      if (at(c, x, y)) continue;
      open(c, x, y, { owner: name, kind: bestKind(c, x, y) });
      placed += 1;
    }
  }
  function bestKind(c, x, y) {
    return KINDS.slice().sort(function (a, b) { return worth(c, x, y, b) * WORTH[b] - worth(c, x, y, a) * WORTH[a]; })[roll(c, 4)];
  }
  // Where a newcomer lands: the free block the rivals press on least.
  function landing(c) {
    var best = null;
    for (var y = 1; y < c.h - 1; y++) for (var x = 1; x < c.w - 1; x++) {
      if (at(c, x, y)) continue;
      var r = hold(c, x, y).rival;
      if (!best || r < best.r) best = { x: x, y: y, r: r };
    }
    return best && { x: best.x, y: best.y };
  }
  function zoneOf(c, x, y) {
    for (var i = 0; i < c.zones.length; i++) {
      var z = c.zones[i];
      if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
    }
    return null;
  }
  // Every place of the city, or only those a capo runs.
  function places(c, capo) {
    return Object.keys(c.blocks).map(function (k) {
      var p = c.blocks[k], xy = k.split(',');
      return { x: Number(xy[0]), y: Number(xy[1]), owner: p.owner, kind: p.kind, level: p.level, capo: p.capo };
    }).filter(function (p) { return capo === undefined || p.capo === capo; });
  }
  function run(c, capo) { return places(c, capo).filter(function (p) { return p.kind !== 'club'; }); }

  function open(c, x, y, p) {
    if (!inside(c, x, y)) throw new Error(x + ',' + y + ' is outside ' + c.id);
    if (at(c, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (p.kind !== 'club' && p.kind !== 'key' && !TERRAIN[p.kind]) throw new Error('unknown kind of place: ' + p.kind);
    if (p.owner === 'family' && !D.CAPOS[p.capo]) throw new Error('a place of the family needs a capo');
    c.blocks[key(x, y)] = { owner: p.owner, kind: p.kind, level: p.level || 1, capo: p.owner === 'family' ? p.capo : null };
  }
  // A capo arrives: his social club is his base, and where he is found.
  function clubOf(c, capo) {
    var club = places(c, capo).filter(function (p) { return p.kind === 'club'; })[0];
    return club ? { x: club.x, y: club.y } : null;
  }
  function settle(c, capo, x, y) {
    if (clubOf(c, capo)) throw new Error(capo + ' already has a club in ' + c.id);
    open(c, x, y, { owner: 'family', kind: 'club', capo: capo, level: RULES.clubLevel });
  }

  // How hard the family and its rivals press on one block.
  function hold(c, x, y) {
    var h = { family: 0, rival: 0 };
    places(c).forEach(function (p) {
      var d = far(x, y, p.x, p.y);
      if (d > p.level + 1) return;
      h[p.owner === 'family' ? 'family' : 'rival'] += RULES.press * p.level / (1 + d);
    });
    return h;
  }
  // Whose streets a block is: 'family', 'rival', 'contested', or null when nobody holds it.
  function grip(c, x, y) {
    var h = hold(c, x, y);
    if (Math.max(h.family, h.rival) < RULES.minHold) return null;
    if (h.family >= h.rival * RULES.edge) return 'family';
    if (h.rival >= h.family * RULES.edge) return 'rival';
    return 'contested';
  }
  // The city in hundredths: what the family holds, what its rivals hold, what is fought over, what is nobody's.
  function share(c) {
    var n = { family: 0, rival: 0, contested: 0, free: 0 };
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) n[grip(c, x, y) || 'free'] += 1;
    Object.keys(n).forEach(function (k) { n[k] = n[k] * 100 / (c.w * c.h); });
    return n;
  }

  // The free blocks a capo can open on: streets the family holds, close to a place he runs.
  function frontier(c, capo) {
    var mine = places(c, capo), out = [];
    if (!mine.length) return out;
    for (var y = 0; y < c.h; y++) {
      for (var x = 0; x < c.w; x++) {
        if (at(c, x, y) || grip(c, x, y) !== 'family') continue;
        if (mine.some(function (p) { return far(x, y, p.x, p.y) <= RULES.near; })) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function price(c, capo, kind) {
    return Math.round(D.SITES[kind].cost * Math.pow(1 + RULES.dearer, run(c, capo).length));
  }
  // The place a capo's whole trade is built on: the first kind of place he likes.
  function tradeOf(capo) {
    return D.CAPOS[capo].likes.filter(function (k) { return TERRAIN[k]; })[0] || null;
  }
  function worth(c, x, y, kind) { return 0.4 + 0.6 * zoneOf(c, x, y).traits[TERRAIN[kind]]; }
  function taste(capo, kind) {
    return kind === tradeOf(capo) ? RULES.trade : D.CAPOS[capo].likes.indexOf(kind) >= 0 ? RULES.likes : 1;
  }

  // How well the family's stills keep its speakeasies wet, across the whole city: 0 to 1.
  function liquor(c) {
    var stills = 0, bars = 0;
    places(c).forEach(function (p) {
      if (p.owner !== 'family') return;
      if (p.kind === 'still') stills += 1 + RULES.bigger * (p.level - 1);
      if (p.kind === 'speakeasy') bars += 1;
    });
    return { stills: stills, bars: bars, wet: bars ? Math.min(1, RULES.pours * stills / bars) : 1 };
  }
  // What one place brings in a month: the street, its size, how firmly it is held, and the liquor for a bar.
  function earns(c, p, wet) {
    if (!WORTH[p.kind]) return 0;
    var h = hold(c, p.x, p.y);
    return WORTH[p.kind] * RULES.yield * worth(c, p.x, p.y, p.kind) * (1 + RULES.bigger * (p.level - 1)) * (h.family / (h.family + h.rival))
      * (p.kind === 'speakeasy' ? RULES.dry + (1 - RULES.dry) * wet : 1);
  }
  function income(c, capo) {
    var wet = liquor(c).wet;
    return run(c, capo).reduce(function (n, p) { return n + earns(c, p, wet); }, clubOf(c, capo) ? RULES.club : 0);
  }
  function wages(c, capo) { return RULES.wage * run(c, capo).length; }

  // How a capo takes what is not his: the hard men by force, the talkers with an envelope, the others with a cheque.
  function wayOf(capo) {
    var k = D.CAPOS[capo];
    return k.muscle >= 7 ? 'force' : k.cunning + k.charisma >= 13 ? 'bribe' : 'buy';
  }
  // A place taken keeps its trade, unless the capo refuses it or the family cannot run it.
  function keeps(capo, kind, tech) {
    return D.CAPOS[capo].refuses.indexOf(kind) >= 0 || !(tech[kind] >= 1) ? tradeOf(capo) || 'speakeasy' : kind;
  }
  function takes(c) {
    return c.ops.map(function (o) {
      return { capo: o.capo, x: o.x, y: o.y, way: o.way, cost: o.cost, months: o.months, monthsLeft: Math.max(0, o.months - (c.month - o.month)) };
    });
  }

  // What a capo would do next, if he had the money: open a place on his
  // frontier, make one bigger once he runs all his rank allows, or nothing.
  // `tech` is the family's building tree (0 = the trade is closed).
  function wants(c, capo, o) {
    var card = D.CAPOS[capo], mine = run(c, capo), club = clubOf(c, capo), best = null;
    var count = {}, drink = liquor(c);
    mine.forEach(function (p) { count[p.kind] = (count[p.kind] || 0) + 1; });
    // no capo opens one more bar with nothing to pour in it, and a dry city calls for a still
    var thirst = function (kind) {
      if (kind === 'speakeasy') return drink.bars > 0 && drink.bars >= RULES.pours * drink.stills ? 0.4 : 1;
      return kind === 'still' && drink.bars > RULES.pours * drink.stills ? 1.5 : 1;
    };
    if (mine.length < RULES.reach[o.rank]) {
      frontier(c, capo).forEach(function (b) {
        KINDS.forEach(function (kind) {
          if (!(o.tech[kind] >= 1) || card.refuses.indexOf(kind) >= 0) return;
          var score = worth(c, b.x, b.y, kind) * taste(capo, kind) * WORTH[kind] / D.SITES[kind].cost / (1 + RULES.another * (count[kind] || 0)) * thirst(kind);
          var d = club ? far(b.x, b.y, club.x, club.y) : 0;
          if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && d < best.d)) best = { score: score, d: d, x: b.x, y: b.y, kind: kind };
        });
      });
      if (best) {
        var liked = taste(capo, best.kind) > 1, z = zoneOf(c, best.x, best.y);
        return { move: 'open', x: best.x, y: best.y, kind: best.kind, name: D.SITES[best.kind].name, cost: price(c, capo, best.kind),
                 why: (liked ? 'his kind of business, and ' : '') + z.name + ' is ' + (worth(c, best.x, best.y, best.kind) >= 1 ? 'made for it' : 'the best he has') };
      }
    }
    if (mine.length < RULES.reach[o.rank]) {
      // hemmed in: the weakest rival place within reach, taken his own way
      var all = places(c, capo), prey = null;
      places(c).forEach(function (p) {
        if (p.owner === 'family' || p.kind === 'key') return;
        if (!all.some(function (q) { return far(p.x, p.y, q.x, q.y) <= RULES.near; })) return;
        var r = hold(c, p.x, p.y).rival;
        if (!prey || r < prey.r) prey = { r: r, p: p };
      });
      if (prey) {
        var way = wayOf(capo), kind = keeps(capo, prey.p.kind, o.tech);
        return { move: 'take', way: way, x: prey.p.x, y: prey.p.y, kind: kind, name: D.SITES[kind].name, months: RULES.take[way].months,
                 cost: Math.round(price(c, capo, kind) * RULES.take[way].cost),
                 why: 'no free street left around him: he goes for the ' + prey.p.owner + 's\' place next door' };
      }
    }
    var small = mine.filter(function (p) { return p.kind !== 'key' && p.level < Math.min(D.RULES.maxLevel, o.tech[p.kind] || 0); });
    small.sort(function (a, b) { return a.level - b.level || WORTH[b.kind] * taste(capo, b.kind) - WORTH[a.kind] * taste(capo, a.kind) || a.y - b.y || a.x - b.x; });
    if (!small.length) return null;
    var p = small[0];
    return { move: 'enlarge', x: p.x, y: p.y, kind: p.kind, name: D.SITES[p.kind].name, cost: Math.round(RULES.enlarge * D.SITES[p.kind].cost * p.level),
             why: mine.length >= RULES.reach[o.rank] ? 'he runs all the places his rank allows: he makes them bigger' : 'no street left to open on' };
  }

  // --- the family in a city, month after month ---
  // `f` is what the family carries from city to city: its building tree,
  // its men (cash in hand, rank, what they have learned) and the boss's money.
  function join(f, capo) {
    if (!D.CAPOS[capo]) throw new Error('unknown capo: ' + capo);
    if (!f.men[capo]) f.men[capo] = { cash: RULES.purse, xp: 0, rank: 0, income: 0 };
    return f.men[capo];
  }
  function first(capo) { return D.CAPOS[capo].name.split(' ')[0]; }
  // What he is after and how far his money is from it, for the screen.
  function plan(c, f, capo) {
    var m = f.men[capo], busy = c.ops.filter(function (o) { return o.capo === capo; })[0];
    if (busy) return { move: 'take', way: busy.way, x: busy.x, y: busy.y, cost: busy.cost, saved: busy.cost, progress: 1, waiting: 'time', why: 'his men are on their way' };
    var w = wants(c, capo, { rank: m.rank, tech: f.tech });
    if (!w) return { move: 'hold', waiting: 'rank', cost: 0, saved: 0, progress: 1, why: 'he runs all he can at his rank' };
    var saved = Math.max(0, Math.min(w.cost, m.cash - wages(c, capo)));
    return { move: w.move, way: w.way, months: w.months, kind: w.kind, name: w.name, x: w.x, y: w.y, cost: w.cost, saved: saved, progress: w.cost ? saved / w.cost : 1,
             waiting: saved >= w.cost ? null : 'money', why: w.why };
  }
  function settleTakes(c, events) {
    c.ops = c.ops.filter(function (o) {
      if (c.month - o.month < o.months) return true;
      var was = at(c, o.x, o.y);
      if (!was || was.owner === 'family') return false; // nothing left to take
      c.blocks[key(o.x, o.y)] = { owner: 'family', kind: o.kind, level: 1, capo: o.capo };
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
    var theirs = places(c).filter(function (p) { return p.owner !== 'family'; }), ours = places(c).filter(function (p) { return p.owner === 'family'; });
    if (theirs.length >= RULES.rivalMost * c.w * c.h / 100) return;
    var best = null;
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      if (at(c, x, y) || grip(c, x, y) !== 'rival') continue;
      var d = ours.reduce(function (n, p) { return Math.min(n, far(x, y, p.x, p.y)); }, 99);
      if (!best || d < best.d) best = { x: x, y: y, d: d };
    }
    if (best) open(c, best.x, best.y, { owner: c.rival, kind: bestKind(c, best.x, best.y) });
  }
  // Now and then they come for the family's place they press on hardest. A capo's Muscle decides if it stands.
  function rivalRaids(c, events) {
    if (c.month % RULES.rivalEvery !== 0) return;
    var target = null;
    places(c).forEach(function (p) {
      if (p.owner !== 'family' || p.kind === 'club' || p.kind === 'key') return;
      var h = hold(c, p.x, p.y);
      if (h.rival < RULES.rivalReach) return;
      if (!target || h.rival - h.family > target.margin) target = { margin: h.rival - h.family, p: p, h: h };
    });
    if (!target) return;
    var p = target.p, by = c.rival || places(c).filter(function (q) { return q.owner !== 'family'; })[0].owner, where = zoneOf(c, p.x, p.y).name;
    var e = { capo: p.capo, city: c.id, x: p.x, y: p.y, kind: p.kind, by: by };
    var fury = 1 + places(c).filter(function (q) { return q.owner === 'family'; }).length / RULES.anger; // the bigger the family, the harder they come
    if (target.h.family * (RULES.stand + D.CAPOS[p.capo].muscle / 10) >= target.h.rival * fury) {
      e.type = 'repelled';
      e.label = 'The ' + by + 's come for ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where + ' and are thrown back';
    } else {
      delete c.blocks[key(p.x, p.y)];
      e.type = 'burnt';
      e.label = 'The ' + by + 's burn out ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where;
    }
    events.push(e);
  }
  function stepMonth(c, f) {
    var events = [];
    c.month += 1;
    settleTakes(c, events);
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var m = f.men[capo], inc = income(c, capo), pay = wages(c, capo), profit = inc - pay;
      m.income = inc;
      if (profit > 0) { f.dirty += profit * RULES.tribute; m.cash += profit * (1 - RULES.tribute); } else m.cash += profit;
      m.xp += run(c, capo).length;
      if (m.rank < RANKS.length - 1 && m.xp >= RULES.xp[m.rank + 1]) {
        m.rank += 1;
        events.push({ type: 'rank', capo: capo, city: c.id, rank: m.rank,
                      label: first(capo) + ' rises to ' + RANKS[m.rank] + ': he can now run ' + RULES.reach[m.rank] + ' places' });
      }
      var p = plan(c, f, capo);
      // what he cannot use goes up to the boss rather than sleep in his club
      var spare = m.cash - (p.cost || 0) - pay - RULES.pocket;
      if (spare > 0 && (p.move === 'hold' || p.waiting !== 'money')) { m.cash -= spare; f.dirty += spare; }
      if (p.move === 'hold' || p.waiting) return;
      m.cash -= p.cost;
      if (p.move === 'take') {
        c.ops.push({ capo: capo, x: p.x, y: p.y, way: p.way, kind: p.kind, cost: p.cost, month: c.month, months: p.months });
        events.push({ type: 'moving', capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, way: p.way, months: p.months, cost: p.cost,
                      label: first(capo) + ' goes for the ' + at(c, p.x, p.y).owner + 's\' place in ' + zoneOf(c, p.x, p.y).name });
        return;
      }
      if (p.move === 'open') open(c, p.x, p.y, { owner: 'family', kind: p.kind, capo: capo });
      else at(c, p.x, p.y).level += 1;
      events.push({ type: p.move === 'open' ? 'opened' : 'enlarged', capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, cost: p.cost, why: p.why,
                    label: first(capo) + (p.move === 'open' ? ' opens a ' : ' enlarges his ') + p.name.toLowerCase() + ' in ' + zoneOf(c, p.x, p.y).name });
    });
    rivalGrows(c);
    rivalRaids(c, events);
    return events;
  }

  var api = { seed: seed, landing: landing, wayOf: wayOf, takes: takes, RANKS: RANKS, liquor: liquor, income: income, join: join, plan: plan, stepMonth: stepMonth, RULES: RULES, TERRAIN: TERRAIN, WORTH: WORTH, createCity: createCity, zoneOf: zoneOf, at: at, open: open, settle: settle, clubOf: clubOf,
              places: places, hold: hold, grip: grip, share: share, frontier: frontier, price: price, tradeOf: tradeOf, wants: wants };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurf = api;
})(typeof self !== 'undefined' ? self : this);
