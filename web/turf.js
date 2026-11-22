// The city game, one month at a time. No drawing and no browser here.
//
// This file ties the rules together: stepMonth plays a month of one city,
// month plays the family's month, view is everything the screen reads.
// The rules themselves live in the turf-*.js files, loaded in this order:
// rules (numbers), people, city (blocks and streets), goods (chains, trucks,
// takings), streets (plans, rivals), boss (asks, money, feuds), men (doors,
// table, underboss, partings), family (tree, convoys).
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var G = typeof require === 'function' ? require('./turf-goods.js') : root.AshportTurfGoods;
  var S = typeof require === 'function' ? require('./turf-streets.js') : root.AshportTurfStreets;
  var B = typeof require === 'function' ? require('./turf-boss.js') : root.AshportTurfBoss;
  var M = typeof require === 'function' ? require('./turf-men.js') : root.AshportTurfMen;
  var H = typeof require === 'function' ? require('./turf-hit.js') : root.AshportTurfHit;
  var F = typeof require === 'function' ? require('./turf-family.js') : root.AshportTurfFamily;
  var RULES = R.RULES, RANKS = R.RANKS, TERRAIN = R.TERRAIN, WORTH = R.WORTH, key = R.key, at = R.at;
  var KEYS = P.KEYS, PEOPLE = P.PEOPLE, who = P.who, SCHOOLS = P.SCHOOLS, schoolOf = P.schoolOf, abilities = P.abilities, table = P.table,
      can = P.can, person = P.person, loyalty = P.loyalty, sway = P.sway, mood = P.mood;
  var learnt = C.learnt, createCity = C.createCity, seed = C.seed, lieutenantsOf = C.lieutenantsOf, crown = C.crown, landing = C.landing,
      zoneOf = C.zoneOf, changed = C.changed, memo = C.memo, everyPlace = C.everyPlace, places = C.places, run = C.run, keys = C.keys, open = C.open,
      clubOf = C.clubOf, settle = C.settle, hold = C.hold, grip = C.grip, share = C.share, frontier = C.frontier, price = C.price,
      tradeOf = C.tradeOf;
  var liquor = G.liquor, CHAINS = G.CHAINS, loadOfCargo = G.loadOfCargo, supplied = G.supplied, cellars = G.cellars, ambush = G.ambush,
      CARGOES = G.CARGOES, distil = G.distil, earns = G.earns, income = G.income, wages = G.wages, collect = G.collect, chokes = G.chokes,
      busy = G.busy, wayOf = G.wayOf, takes = G.takes, wants = G.wants, washing = G.washing, laundries = G.laundries;
  var join = S.join, first = S.first, plan = S.plan, settleTakes = S.settleTakes, rivalGrows = S.rivalGrows, cover = S.cover,
      rivalRaids = S.rivalRaids, whereabouts = S.whereabouts, funds = S.funds;
  var eyes = B.eyes, asks = B.asks, answer = B.answer, money = B.money, rub = B.rub, grudges = B.grudges, feuds = B.feuds, willing = B.willing,
      tempers = B.tempers, rule = B.rule, swell = B.swell;
  var seat = M.seat, unseat = M.unseat, payTable = M.payTable, doors = M.doors, spots = M.spots, seats = M.seats, welcome = M.welcome, send = M.send,
      underOf = M.underOf, underboss = M.underboss, partings = M.partings, part = M.part, revenge = M.revenge,
      gift = M.gift, gifts = M.gifts, hearts = M.hearts;
  var loadOf = F.loadOf, createFamily = F.createFamily, tree = F.tree, research = F.research, wishes = F.wishes, convoys = F.convoys, ride = F.ride;

  // --- what moves in the streets ---
  // The trips of the month, for the map: liquor from the nearest still to each
  // bar, every place's takings to its capo's club, the boss's dirty money from
  // the clubs to the laundries, and the crews on their way to what they take.
  function trips(c, f) {
    var ours = everyPlace(c).filter(function (p) { return p.owner === 'family'; }), out = [];
    var at2 = function (p) { return { x: p.x, y: p.y }; }, washed = (c.flow && c.flow.wash) || {};
    var washes = ours.filter(function (p) { return D.SITES[p.kind] && D.SITES[p.kind].wash; });
    // one trip for every truckload that really left a cellar last month
    ((c.flow && c.flow.hauls) || []).forEach(function (h) {
      var garage = clubOf(c, h.capo);
      if (garage && at(c, h.from.x, h.from.y) && at(c, h.to.x, h.to.y)) {
        out.push({ kind: h.cargo && h.cargo !== 'liquor' ? 'goods' : 'liquor', cargo: h.cargo || 'liquor', capo: h.capo, from: { x: h.from.x, y: h.from.y }, to: { x: h.to.x, y: h.to.y }, amount: h.amount,
                   vehicle: h.capo + ':truck:' + (h.truck || 1), leg: h.leg || 0, home: { x: garage.x, y: garage.y } });
        if (h.lost) out[out.length - 1].lost = h.lost; // held up by the rivals or stopped by the police on the way
      }
    });
    ((c.flow && c.flow.runs) || []).forEach(function (r) {
      var club = clubOf(c, r.capo);
      if (!club || !at(c, r.x, r.y)) return;
      var t = { kind: 'takings', cargo: 'cash', capo: r.capo, from: { x: r.x, y: r.y }, to: club, amount: r.amount,
                vehicle: r.capo + (r.own ? ':own' : ':car:' + (r.car || 1)), leg: r.leg || 0, home: { x: club.x, y: club.y } };
      if (r.own) t.own = true; // the capo drove this one himself
      if (r.lost) t.lost = r.lost;
      out.push(t);
    });
    // the boss's share on its way to the headquarters: one load a trip, in the capo's own car
    var seat = C.hqOf(c, 'family');
    if (seat) ((c.flow && c.flow.tributes) || []).forEach(function (r, n) {
      var club = clubOf(c, r.capo);
      if (club) out.push({ kind: 'tribute', cargo: 'cash', capo: r.capo, from: { x: club.x, y: club.y }, to: { x: seat.x, y: seat.y }, amount: r.amount, vehicle: r.capo + ':own', leg: n, home: { x: club.x, y: club.y } });
    });
    Object.keys(f.men || {}).forEach(function (id) {
      var club = clubOf(c, id), w = club && whereabouts(c, f, id);
      if (w && w.why !== 'home') out.push({ kind: 'capo', cargo: w.why, capo: id, from: { x: club.x, y: club.y }, to: { x: w.x, y: w.y }, vehicle: id + ':own', home: { x: club.x, y: club.y } });
    });
    // the money to wash and the money washed: played day by day, every load is a leg of the capo's own car between
    // the headquarters and his laundry; a cycle played in one blow only says who drives to which laundry
    if (seat && c.turn && c.turn.daily) {
      var hq = { x: seat.x, y: seat.y };
      ((c.flow && c.flow.cleans) || []).forEach(function (r, n) {
        var club = clubOf(c, r.capo);
        if (club) out.push({ kind: 'clean', cargo: 'clean', capo: r.capo, from: { x: r.x, y: r.y }, to: hq, amount: r.amount, vehicle: r.capo + ':own', leg: n, home: { x: club.x, y: club.y } });
      });
      ((c.flow && c.flow.washes) || []).forEach(function (r, n) {
        var club = clubOf(c, r.capo);
        if (club) out.push({ kind: 'wash', cargo: 'cash', capo: r.capo, from: hq, to: { x: r.x, y: r.y }, amount: r.amount, vehicle: r.capo + ':own', leg: n, home: { x: club.x, y: club.y } });
      });
    } else if (f.dirty > 0) washes.forEach(function (p) {
      var club = clubOf(c, p.capo);
      if (club) out.push({ kind: 'wash', cargo: 'cash', capo: p.capo, from: club, to: at2(p), amount: Math.round(washed[key(p.x, p.y)] || 0) });
    });
    c.ops.forEach(function (o) {
      var club = clubOf(c, o.capo);
      if (club) out.push({ kind: 'crew', cargo: o.way, capo: o.capo, from: club, to: { x: o.x, y: o.y } });
    });
    return out;
  }

  // --- what the screen reads ---
  // One plain picture of the city: every block and who holds it, every place,
  // every capo with where he is and what he is after, and what waits for the boss.
  // Where a place of the family chokes: cash nobody fetches, a bar with nothing to pour, a still nobody drinks from,
  // a laundry that cannot keep up. Each with a line the screen can show as it is.
  function strains(c, f, p, k) {
    var out = [], dollars = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
    if ((p.till || 0) >= 2 * k.load) out.push({ kind: 'cash', label: 'Cash piling up: ' + dollars(p.till) + ' waits for a car' });
    var b = c.blocks[key(p.x, p.y)], wet = b.wet !== undefined ? b.wet : p.kind === 'fence' ? k.goods.fed : k.drink.wet, cell = k.cellar[key(p.x, p.y)];
    if (p.kind === 'speakeasy' && wet < 1) {
      out.push({ kind: 'dry', label: !k.drink.stills ? 'Nothing to pour: the family has no still' : b.wet === 0 ? 'Nothing to pour: no truck came'
        : 'Running dry: liquor for ' + Math.round(100 * wet) + '% of what it could sell' });
    }
    if (p.kind === 'fence' && wet < 1) {
      out.push({ kind: 'dry', label: !k.goods.makers ? 'Nothing to sell: the family has no warehouse and no chop shop' : b.wet === 0 ? 'Nothing to sell: no truck came'
        : 'Running short: goods for ' + Math.round(100 * wet) + '% of what it could sell' });
    }
    if (cell && (b.stock || 0) >= cell.most - 1e-9) {
      var n = Math.round((b.stock || 0) * loadOfCargo(cell.cargo));
      if (cell.cargo !== 'weed' || k.smokers) out.push({ kind: 'surplus', label: (cell.cargo === 'liquor' ? 'Cellar full: ' + n + ' crates' : cell.cargo === 'cars' ? 'Yard full: ' + n + ' cars' : cell.cargo === 'weed' ? 'Stash full: ' + n + ' bags' : 'Store full: ' + n + ' crates') + ' wait for a truck' });
    }
    else if (p.kind === 'still' && b.stock === undefined && RULES.pours * k.drink.stills >= k.drink.bars + RULES.pours) out.push({ kind: 'surplus', label: 'More liquor than the bars can pour' });
    var most = k.most[key(p.x, p.y)];
    if (most && f.dirty > 0 && (k.washed[key(p.x, p.y)] || 0) >= 0.95 * most) out.push({ kind: 'swamped', label: 'Washing all it can: ' + dollars(f.dirty) + ' of dirty money still waits' });
    return out;
  }

  // --- what holds the family back in a city ---
  // Each trouble says what is happening, since when (in months), why, and what the boss can do about it (lever, or null when
  // there is nothing he can do). The gravest first, three at most. Nothing here changes how the game plays.
  var STALL = { nobody: 24, boxed: 3, lost: 3 }; // months without a new man, months a capo saves alone, places lost in a year
  function troubles(c, f) {
    var out = [], here = Object.keys(f.men).filter(function (id) { return clubOf(c, id); });
    if (!here.length) return out;
    var began = function (id) { return c.stalled && c.stalled[id] !== undefined ? c.month - c.stalled[id] : 0; };
    var dollars = function (n) { return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    var sentence = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
    // a man of the table who was not paid
    Object.keys(f.owed || {}).forEach(function (post) {
      var id = f.table && f.table[post];
      if (!id || !clubOf(c, id)) return;
      out.push({ id: 'unpaid:' + id, capo: id, since: began('unpaid:' + id), what: first(id) + ' was not paid',
                 why: 'The table costs $' + RULES.table.pay + ' a man ' + R.EVERY + ': the family had $' + Math.round(funds(f)) + ' in hand',
                 lever: 'Free his chair, or wait for money to come up' });
    });
    // ground lost over the last year
    var ago = (c.tally || []).filter(function (q) { return q.month <= c.month - 12; }).pop();
    var mine = everyPlace(c).filter(function (p) { return p.owner === 'family'; }).length;
    if (ago && ago.places - mine >= STALL.lost) {
      var lost = ago.places - mine, burnt = Math.min(lost, (c.burnt || 0) - ago.burnt);
      out.push({ id: 'losing', since: began('losing'), what: 'The family lost ' + lost + ' places here in ' + R.days(12),
                 why: burnt > 0 ? 'The ' + c.rival + 's burnt ' + burnt + ' of them' : 'Your capos could not hold them',
                 lever: P.lineOf(c) === 'grow' ? 'Under Grow your capos guard their places less well: change the line' : null });
    }
    // a capo with no free street left, who saves alone to take a place from the rivals
    here.forEach(function (id) {
      var p = plan(c, f, id);
      if (p.move !== 'take' || p.waiting !== 'money') return;
      out.push({ id: 'boxed:' + id, capo: id, x: p.x, y: p.y, since: began('boxed:' + id), min: STALL.boxed, cost: p.cost,
                 what: first(id) + ' is saving alone to take a place: ' + dollars(p.saved) + ' of ' + dollars(p.cost), why: sentence(p.why), lever: null });
    });
    // a capo who sulks
    here.forEach(function (id) {
      var left = ((c.sulk || {})[id] || 0) - c.month;
      if (left <= 0) return;
      out.push({ id: 'sulk:' + id, capo: id, since: began('sulk:' + id), what: first(id) + ' sends nothing up',
                 why: 'He sulks for ' + R.days(left) + ' more', lever: 'A gift of $' + RULES.loyal.gift + ' may bring him round' });
    });
    // nobody new for a long time, and nobody at the door
    var quiet = c.month - (c.joined || 0);
    if (quiet >= STALL.nobody && !doors(c, f).length) {
      var gone = f.gone || {};
      var mentors = here.filter(function (id) { return Object.keys(PEOPLE).some(function (q) { return PEOPLE[q].mentor === id && !f.men[q] && !gone[q]; }); });
      out.push({ id: 'nobody', since: quiet, what: 'No new man in ' + R.days(12 * Math.floor(quiet / 12)),
                 why: mentors.length ? 'A capo brings a man in when he runs ' + R.NUMBER[RULES.vouch] + ' places: ' + mentors.map(function (id) { return first(id) + ' runs ' + run(c, id).length; }).join(', ')
                                     : 'None of your capos here has a man of his own left to bring in',
                 lever: mentors.length && P.lineOf(c) !== 'grow' ? 'Set the line to Grow: your capos run more places' : null });
    }
    return out;
  }
  function stalls(c, f) {
    var all = troubles(c, f).filter(function (s) { return !s.min || s.since >= s.min; });
    // of the capos boxed in, only the one who has the most to save is named
    var dearest = all.filter(function (s) { return s.cost; }).sort(function (a, b) { return b.cost - a.cost; })[0];
    return all.filter(function (s) { return !s.cost || s === dearest; }).slice(0, 3).map(function (s) { delete s.min; delete s.cost; return s; });
  }
  // The city's own count, kept for a year, and the month each trouble began.
  function mark(c, f) {
    c.tally = c.tally || [];
    c.tally.push({ month: c.month, places: everyPlace(c).filter(function (p) { return p.owner === 'family'; }).length, burnt: c.burnt || 0 });
    if (c.tally.length > 13) c.tally.splice(0, c.tally.length - 13);
    var was = c.stalled || {}, now = {};
    troubles(c, f).forEach(function (s) { now[s.id] = was[s.id] !== undefined ? was[s.id] : c.month - 1; });
    c.stalled = now;
  }

  // The headquarters of a city, for the screen: who sits in each. `home` is the family's own, where the boss and his table sit.
  function hqs(c, f) {
    var ours = C.hqOf(c, 'family'), theirs = C.hqOf(c, 'rival'), chief = P.chiefOf(c), under = underOf(c);
    if (ours) { ours.name = 'Headquarters'; ours.home = !!c.home; ours.who = c.home ? ['boss'].concat(table(f).filter(function (s) { return s.capo; }).map(function (s) { return s.capo; })) : under ? [under] : []; }
    if (theirs) { theirs.name = 'Headquarters'; theirs.who = chief ? [chief] : []; }
    return { family: ours, rival: theirs };
  }
  function view(c, f) {
    var m = memo(c), blocks = [], flow = c.flow || {};
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      var gap = c.voids && c.voids[key(x, y)], b = { x: x, y: y, zone: C.zoneAt(c, x, y), grip: grip(c, x, y), family: gap ? 0 : m.family[y * c.w + x], rival: gap ? 0 : m.rival[y * c.w + x] };
      if (gap) b.void = gap; // nothing stands here: water, a rail yard or waste ground
      blocks.push(b);
    }
    var choke = { load: loadOf(f), drink: liquor(c), goods: supplied(c), washed: flow.wash || {}, most: {}, cellar: {} };
    choke.smokers = everyPlace(c).filter(function (p) { return p.owner === 'family' && CHAINS[2].sells.indexOf(p.kind) >= 0; }).length;
    cellars(c).forEach(function (s) { choke.cellar[key(s.p.x, s.p.y)] = { most: s.most, cargo: s.cargo }; });
    laundries(c).forEach(function (l) { choke.most[key(l.x, l.y)] = l.most; });
    var out = {
      id: c.id, w: c.w, h: c.h, month: c.month, heat: c.heat || 0, under: underOf(c),
      rival: c.rival || (everyPlace(c).filter(function (p) { return p.owner !== 'family'; })[0] || {}).owner || null,
      zones: c.zones.map(function (z) { return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 }; }),
      blocks: blocks,
      places: places(c).map(function (p) {
        p.name = p.kind === 'hq' ? 'Headquarters' : p.kind === 'club' ? 'Social Club' : p.kind === 'key' ? KEYS[p.key].name : D.SITES[p.kind].name;
        if (p.kind === 'hq') return { x: p.x, y: p.y, owner: p.owner, kind: 'hq', name: p.name, level: p.level, stage: p.stage, capo: null };
        return { x: p.x, y: p.y, owner: p.owner, kind: p.kind, key: p.key, man: p.man, name: p.name, level: p.level, capo: p.capo, till: p.till };
      }).map(function (p) {
        if (!p.key) delete p.key; if (!p.man) delete p.man; if (!p.till) delete p.till;
        if (p.owner === 'family' && p.kind !== 'hq') {
          p.load = loadOf(f); // what its till must hold before a car comes for it
          // a laundry: the dirty money waiting to be washed, the clean money waiting for the car, what it washes in a cycle
          if (choke.most[key(p.x, p.y)] !== undefined && p.owner === 'family') { var lb = at(c, p.x, p.y); p.wash = { waiting: Math.round(lb.dirty || 0), ready: Math.round(lb.washed || 0), most: Math.round(choke.most[key(p.x, p.y)]) }; }
          // its books: what it made last month, what it makes on average over the last six, what its men cost a month
          var mades = c.blocks[key(p.x, p.y)].mades || [];
          p.made = mades.length ? Math.round(mades[mades.length - 1]) : 0;
          p.made6 = mades.length ? Math.round(mades.reduce(function (a, b) { return a + b; }, 0) / mades.length) : 0;
          p.costs = p.kind === 'club' || p.kind === 'key' ? 0 : Math.round(RULES.wage * (can(c, p.capo, 'tight') ? 0.85 : 1));
        }
        var holds = p.kind === 'speakeasy' ? 'liquor' : p.kind === 'fence' ? 'goods' : (choke.cellar[key(p.x, p.y)] || {}).cargo;
        var crates = p.owner === 'family' && holds ? Math.round((c.blocks[key(p.x, p.y)].stock || 0) * loadOfCargo(holds)) : 0;
        var bags = p.owner === 'family' ? Math.round((c.blocks[key(p.x, p.y)].weed || 0) * RULES.weed.load) : 0;
        if (bags) p.weed = bags; // bags of weed a bar or a brothel has left to sell
        if (crates) { p.stock = crates; p.holds = holds; } // what waits in a cellar, a store or a yard, or on a seller's shelf: crates of liquor or goods, or cars
        var s = p.owner === 'family' ? strains(c, f, p, choke) : [];
        if (s.length) p.strains = s;
        return p;
      }),
      lieutenants: lieutenantsOf(c).map(function (id) {
        return { id: id, name: who(id).name, specialty: who(id).specialty, places: everyPlace(c).filter(function (p) { return p.man === id; }).length };
      }).filter(function (l) { return l.places > 0; }),
      hq: hqs(c, f), coffer: c.away ? { dirty: Math.round(C.purse(c, f).dirty), clean: Math.round(C.purse(c, f).clean), load: RULES.convoy.cash } : undefined, hits: H.view(c), hitLast: c.hitLast || null, keys: keys(c), share: share(c), cut: B.cutOf(c), cuts: B.cuts(), promises: B.promises(c), chief: S.chief(c), line: P.lineOf(c), lines: B.lines(), lineHeld: B.lineHeld(c, f), seats: seats(c), takes: takes(c), asks: asks(c), doors: doors(c, f), stalls: stalls(c, f), grudges: grudges(c), feuds: feuds(c), trips: trips(c, f), tree: tree(f), wishes: wishes(c, f),
      trades: trades(c),
      money: { dirty: f.dirty, clean: f.clean || 0, washed: c.washed || 0, washes: washing(c).most, up: flow.up || 0, pay: flow.pay || 0, cut: flow.cut || 0, seized: flow.seized || 0 },
      capos: Object.keys(f.men).filter(function (id) { return clubOf(c, id); }).map(function (id) {
        var man = f.men[id], club = clubOf(c, id), led = P.follows(c, f, id);
        return { follows: led ? led.follows : null, followsWhy: led ? led.why : null, id: id, name: who(id).name, specialty: who(id).specialty, rank: man.rank, rankName: RANKS[man.rank], x: club.x, y: club.y,
                 share: Math.round(man.share || 0), shareLoad: loadOf(f), // the boss's share waiting at his club, and the load a car takes to the headquarters
                 places: run(c, id).length, reach: RULES.reach[man.rank] + (led && led.follows && P.lineOf(c) === 'grow' ? RULES.line.stretch : 0), next: man.rank < RANKS.length - 1 ? { rank: man.rank + 1, name: RANKS[man.rank + 1], xp: man.xp || 0, of: RULES.xp[man.rank + 1] } : null, sulks: Math.max(0, ((c.sulk || {})[id] || 0) - c.month), sent: (flow.sent || {})[id] || 0, at: whereabouts(c, f, id), under: underOf(c) === id, mood: mood(f, id), gift: gifts(c, f, id), abilities: abilities(f, id), cars: man.cars || 1, trucks: cellars(c).some(function (s) { return s.p.capo === id; }) ? man.trucks || 1 : 0, waiting: Math.round(man.waiting || 0), income: man.income, cash: man.cash, way: wayOf(id), plan: gained(c, dated(plan(c, f, id), paceOf(man))), pace: paceOf(man), counts: (man.puts || []).length, book: bookOf(man), partings: partings(c, f, id) };
      })
    };
    out.next = nextOf(out.capos); // the next streets to fall, or null
    return out;
  }

  // --- the books ---
  // What each trade put in the tills last month, in whole dollars.
  function trades(c) {
    var made = (c.flow && c.flow.made) || {}, out = {};
    Object.keys(made).forEach(function (k) { if (Math.round(made[k]) > 0) out[k] = Math.round(made[k]); });
    return out;
  }
  // A capo's books for the last month, in whole dollars.
  function bookOf(man) {
    var b = man.book || { made: 0, wages: 0, sent: 0, spent: {}, saved: man.cash, put: 0 }, spent = {};
    Object.keys(b.spent).forEach(function (k) { if (Math.round(b.spent[k]) > 0) spent[k] = Math.round(b.spent[k]); });
    return { made: Math.round(b.made), wages: Math.round(b.wages), sent: Math.round(b.sent), spent: spent, saved: Math.round(man.cash), put: Math.round(b.put) };
  }
  // What he puts aside a month before he buys anything, over the last six months.
  function paceOf(man) {
    var puts = man.puts || [];
    return puts.length ? Math.max(0, Math.round(puts.reduce(function (a, b) { return a + b; }, 0) / puts.length)) : 0;
  }
  // The months his plan is from being paid at that pace; null when he puts nothing aside.
  function gained(c, p) { p.gains = C.gains(c, p); return p; }
  function dated(p, pace) {
    p.monthsLeft = p.waiting !== 'money' ? 0 : pace > 0 ? Math.ceil((p.cost - p.saved) / pace) : null;
    // the months before the move is done: the money first, then the time his men take; null when it never comes
    p.due = p.waiting === 'time' ? p.left : p.waiting === 'rank' ? null : p.monthsLeft === null ? null : p.monthsLeft + (p.months || 0);
    // how far along the whole move is, from nothing put aside to the place in hand: the money is RULES.paidFor of the way
    // when his men must then go and take it, all of it otherwise
    var share = p.months ? RULES.paidFor : 1;
    p.advance = p.waiting === 'time' ? share + (1 - share) * (1 - p.left / Math.max(1, p.months)) : p.waiting === 'rank' ? 0 : share * Math.min(1, p.progress);
    return p;
  }
  // The next streets to fall in a city: the soonest plan that brings any, in words the screen can show as they are.
  var DOES = { open: 'opens', take: 'takes', enlarge: 'enlarges' };
  function nextOf(capos) {
    var best = null;
    capos.forEach(function (k) {
      var p = k.plan;
      if (!p.gains.length || p.waiting === 'rank') return;
      if (!best || p.advance > best.advance) best = { capo: k.id, move: p.move, kind: p.kind, name: p.name, x: p.x, y: p.y, months: p.due, streets: p.gains.length, waiting: p.waiting, advance: p.advance, stuck: p.waiting === 'money' && p.monthsLeft === null && k.counts >= 2 };
    });
    if (best) best.label = who(best.capo).name.split(' ')[0] + ' ' + DOES[best.move] + ' a ' + (best.name || 'place').toLowerCase() + ': +' + best.streets + (best.streets === 1 ? ' street' : ' streets');
    return best;
  }

  // A month has three parts: it opens (what was taken, the key places asked for, the trucks on the road), then every
  // capo has his day (his takings, his men, his share sent up, his next move), then it closes (the rivals, the boss's
  // money, the door). `c.turn` is the month being played; it is null between two months.
  function opening(c, f, events) {
    c.month += 1;
    learnt(c, f);
    c.flow = { up: 0, sent: {}, pay: 0, cut: 0, seized: 0, wash: {}, runs: [], made: {} }; // last month's money, for the screen
    settleTakes(c, events, f);
    Object.keys(f.men).forEach(function (capo) {
      var k = clubOf(c, capo) && !c.asks.some(function (a) { return a.capo === capo; }) && eyes(c, capo);
      if (!k) return;
      var way = wayOf(capo);
      var a = { id: c.id + ':' + k.key, capo: capo, key: k.key, x: k.x, y: k.y, way: way,
                cost: swell(RULES.keyCost * RULES.take[way].cost, RULES.greed, Math.max(f.crowns || 0, keys(c).filter(function (q) { return q.owner === 'family'; }).length)), months: RULES.take[way].months * RULES.keyMonths,
                why: 'his places stand all around it' };
      a.expects = B.expects(c, capo, k, a.months);
      c.asks.push(a);
      events.push({ type: 'asks', capo: capo, city: c.id, x: k.x, y: k.y, key: k.key, way: way, cost: a.cost, months: a.months,
                    label: first(capo) + ' wants the ' + KEYS[k.key].name + ' and asks for your word' });
    });
    // every capo who is free goes where his business chokes: the tills his cars left full, or the place he can push
    c.push = {};
    var drives = {};
    Object.keys(f.men).forEach(function (capo) {
      var m = f.men[capo];
      if (!clubOf(c, capo)) return;
      m.help = null;
      if (busy(c, capo)) return;
      if (m.stuck) { drives[capo] = RULES.own.runs; return; }
      var p = chokes(c, capo);
      if (p) m.help = { x: p.x, y: p.y, why: 'boost', kind: p.kind };
    });
    Object.keys(f.men).forEach(function (capo) { var h = clubOf(c, capo) && f.men[capo].help; if (h) c.push[h.y * c.w + h.x] = true; });
    var trap = ambush(c), drink = distil(c, f, trap);
    if (drink.seized) {
      events.push({ type: 'seizure', capo: drink.seized.capo, city: c.id, x: drink.seized.from.x, y: drink.seized.from.y, cargo: drink.seized.cargo, amount: drink.seized.amount,
                    label: 'The police stop ' + first(drink.seized.capo) + '\'s truck: ' + drink.seized.amount + CARGOES[drink.seized.cargo] + ' seized' });
    }
    c.turn = { drives: drives, trap: trap, drink: drink, acted: {} };
  }
  function capoDay(c, f, capo, events) {
    var t = c.turn, drives = t.drives, trap = t.trap, drink = t.drink;
    if (t.acted[capo] || !f.men[capo] || !clubOf(c, capo)) return;
    t.acted[capo] = true;
    (function () {
      var m = f.men[capo];
      m.cars = m.cars || 1;
      // his books for the month: what he put into a place between two months is counted with this one
      var spent = m.paid || {}, before = m.cash + Object.keys(spent).reduce(function (n, k) { return n + spent[k]; }, 0);
      m.paid = null;
      var buys = function (on, cost) { if (cost > 0) spent[on] = (spent[on] || 0) + cost; if (m.book) { m.book.saved = m.cash; m.book.put = m.cash - before; } };
      // in a city played day by day the money was shared out as the cars came back: `tab` is what that came to
      var tab = t.daily && c.hauls && c.hauls[capo] && c.hauls[capo].tab;
      var load = loadOf(f), haul = collect(c, capo, m.cars, drives[capo], load, trap);
      m.stuck = haul.full > 0;
      if (haul.went && at(c, haul.went.x, haul.went.y)) m.help = { x: haul.went.x, y: haul.went.y, why: 'carry', kind: at(c, haul.went.x, haul.went.y).kind }; // (the place may have burnt since)
      var makes = drink.idle[capo] !== undefined, inc = tab ? tab.made : haul.got + RULES.club,
          pay = tab ? tab.wages : Math.min(dues(c, f, capo, makes), haul.got), had = function () { return tab ? m.cash : m.cash - pay; };
      if (tab) before = m.cash - (tab.made - tab.wages - tab.sent) + Object.keys(spent).reduce(function (n, k) { return n + spent[k]; }, 0);
      m.income = inc; m.waiting = haul.waiting;
      // tills that keep filling with no car free to empty them: he buys another one
      if (!haul.idle && haul.waiting >= 2 * load && had() >= RULES.car.cost) {
        m.cash -= RULES.car.cost; m.cars += 1; buys('car', RULES.car.cost);
        events.push({ type: 'car', capo: capo, city: c.id, cars: m.cars, cost: RULES.car.cost,
                      label: first(capo) + ' buys a ' + (['', '', 'second', 'third', 'fourth', 'fifth'][m.cars] || 'new') + ' car: his takings were piling up' });
      }
      // loads that wait in his cellars while bars go dry, and no truck free: he buys another one
      if (makes && drink.dry && drink.idle[capo] === 0 && drink.waits[capo] >= 2 && had() >= RULES.truck.cost) {
        m.cash -= RULES.truck.cost; m.trucks += 1; buys('truck', RULES.truck.cost);
        events.push({ type: 'truck', capo: capo, city: c.id, trucks: m.trucks, cost: RULES.truck.cost,
                      label: first(capo) + ' buys a ' + (['', '', 'second', 'third', 'fourth', 'fifth'][m.trucks] || 'new') + ' truck: liquor sits in his cellar while bars go dry' });
      }
      // the boss's share comes off the top, before the men are paid; a capo with nothing left sends what he has
      // a bitter man sends nothing at all
      var gives = giving(c, f, capo), sent = tab ? tab.sent : shareOut(c, f, capo, haul.got, RULES.club, pay).sent;
      m.xp += run(c, capo).length;
      if (m.rank < RANKS.length - 1 && m.xp >= RULES.xp[m.rank + 1]) {
        m.rank += 1;
        var gift = SCHOOLS[schoolOf(capo)][m.rank - 1];
        events.push({ type: 'rank', capo: capo, city: c.id, rank: m.rank, ability: gift.id,
                      label: first(capo) + ' rises to ' + RANKS[m.rank] + ': he can now run ' + RULES.reach[m.rank] + ' places, and learns ' + gift.name });
        learnt(c, f);
        sway(f, capo, RULES.loyal.rank);
      }
      var p = plan(c, f, capo);
      // what he cannot use goes up to the boss rather than sleep in his club; the bigger the man, the more of it he spends on himself
      var spare = m.cash - (p.cost || 0) - pay - RULES.pocket;
      if (spare > 0 && gives === 1 && (p.move === 'hold' || p.waiting !== 'money')) { var his = RULES.keeps[m.rank] * (can(c, capo, 'silent') ? 0.5 : 1); m.cash -= spare; f.dirty += spare * (1 - his); sent += spare * (1 - his); buys('himself', spare * his); }
      c.flow.sent[capo] = sent; c.flow.up += sent;
      B.patience(c, f, capo, p, events);
      m.book = { made: inc, wages: pay, sent: sent, spent: spent, saved: m.cash, put: m.cash - before };
      c.flow.made.club = (c.flow.made.club || 0) + RULES.club;
      var home = clubOf(c, capo), den = at(c, home.x, home.y); if (!den.mades) den.mades = []; den.mades.push(RULES.club); if (den.mades.length > 6) den.mades.shift();
      // what he puts aside is counted before what he pays for his moves: buying a place is what he was saving for
      var moved = function () { return (spent.open || 0) + (spent.enlarge || 0) + (spent.take || 0) + (spent.convert || 0); };
      if (!m.puts) m.puts = []; m.puts.push(m.book.put + moved()); if (m.puts.length > 6) m.puts.shift();
      if (p.move === 'hold' || p.waiting) return;
      m.cash -= p.cost; buys(p.move, p.cost);
      m.puts[m.puts.length - 1] = m.book.put + moved();
      enact(c, f, capo, p, events);
    })();
  }
  // What a capo owes his men and his garage over a cycle.
  function dues(c, f, capo, makes) {
    var m = f.men[capo];
    return wages(c, capo) + RULES.car.upkeep * ((m.cars || 1) - 1) + (makes ? RULES.truck.upkeep * ((m.trucks || 1) - 1) : 0);
  }
  // A bitter man sends nothing at all.
  function giving(c, f, capo) { return mood(f, capo) === 'bitter' ? 0 : willing(c, capo); }
  // Money comes in: the boss's share comes off the top, the men are paid out of what the places brought (a bad
  // spell never puts him in debt, and what his club makes on its own stays his), the rest is the capo's.
  // `held`: the share stays at the club until the capo drives it to the headquarters (a city played day by day).
  function shareOut(c, f, capo, got, club, due, held) {
    var m = f.men[capo], inc = got + club, pay = Math.min(due, got), profit = inc - pay;
    var sent = Math.max(0, Math.min(RULES.cut[B.cutOf(c)].share * giving(c, f, capo) * inc, m.cash + profit));
    if (!held) f.dirty += sent;
    m.cash += profit - sent;
    return { inc: inc, pay: pay, sent: sent };
  }
  // One day of a capo in a city played day by day: what his cars brought today is shared out at once, and if he can
  // pay for his next move he makes it.
  function ready(c, f, capo, got, events) {
    var m = f.men[capo], h = c.hauls[capo], tab = h.tab || (h.tab = { made: 0, wages: 0, sent: 0, owed: 0 });
    tab.owed += dues(c, f, capo, c.turn.drink.idle[capo] !== undefined) / RULES.days;
    var r = shareOut(c, f, capo, got, RULES.club / RULES.days, tab.owed, true);
    tab.owed -= r.pay; tab.made += r.inc; tab.wages += r.pay; tab.sent += r.sent;
    // the boss's share waits at the club; a car takes it to the headquarters one full load at a time, one trip a day,
    // and it is his only when it gets there. A city with no headquarters sends it up as it comes.
    var seat = C.hqOf(c, 'family'), home = clubOf(c, capo), full = loadOf(f);
    var went = false;
    m.share = (m.share || 0) + r.sent;
    if (!seat) { C.purse(c, f).dirty += m.share; m.share = 0; }
    else while (m.share >= full) { // no limit of trips: the car goes again as long as a full load waits
      m.share -= full; C.purse(c, f).dirty += full; went = true;
      events.push({ type: 'tribute', city: c.id, capo: capo, x: seat.x, y: seat.y, from: { x: home.x, y: home.y }, amount: full });
      if (c.flow) (c.flow.tributes = c.flow.tributes || []).push({ capo: capo, amount: full });
    }
    B.carry(c, f, capo, went, full, events); // the same car, the same day: the money to wash and the money washed
    // what was paid is told place by place, for the screen: the men of each place, and the garage at the club
    if (r.pay > 0) {
      var mine = run(c, capo), all = dues(c, f, capo, c.turn.drink.idle[capo] !== undefined), men = wages(c, capo), club = clubOf(c, capo);
      var each = all > 0 && mine.length ? r.pay * (men / all) / mine.length : 0, garage = all > 0 ? r.pay * (1 - men / all) : 0;
      if (each > 0) mine.forEach(function (q) { events.push({ type: 'pay', what: 'wages', city: c.id, capo: capo, x: q.x, y: q.y, amount: each }); });
      if (garage > 0) events.push({ type: 'pay', what: 'upkeep', city: c.id, capo: capo, x: club.x, y: club.y, amount: garage });
    }
    // he looks at his next move again only when his purse reaches what it lacked; his count day starts him afresh
    if (h.need !== undefined && m.cash < h.need) return;
    var p = plan(c, f, capo);
    h.need = p.move === 'hold' || p.waiting === 'time' ? Infinity : p.waiting === 'money' ? m.cash + (p.cost - p.saved) : undefined;
    if (p.move === 'hold' || p.waiting) return;
    m.cash -= p.cost;
    if (p.cost > 0) { m.paid = m.paid || {}; m.paid[p.move] = (m.paid[p.move] || 0) + p.cost; } // counted in his books at his next count
    enact(c, f, capo, p, events);
  }
  // A move paid for is made: a place turned, men sent for a rival's place, a place opened or made bigger.
  function enact(c, f, capo, p, events) {
    (function () {
      if (p.move === 'convert') {
        var turned = at(c, p.x, p.y);
        turned.kind = p.kind; turned.level = Math.max(1, Math.min(turned.level, f.tech[p.kind] || 1)); turned.turned = c.month;
        changed(c);
        events.push({ type: 'converted', capo: capo, city: c.id, x: p.x, y: p.y, from: p.from, kind: p.kind, cost: p.cost, why: p.why,
                      label: first(capo) + ' turns his ' + D.SITES[p.from].name.toLowerCase() + ' into a ' + p.name.toLowerCase() + ' in ' + zoneOf(c, p.x, p.y).name });
        return;
      }
      if (p.move !== 'enlarge') rub(c, capo, p.x, p.y);
      if (p.move === 'take') {
        c.ops.push(leaving(c, { capo: capo, x: p.x, y: p.y, way: p.way, kind: p.kind, cost: p.cost, month: c.month, months: p.months }));
        events.push({ type: 'moving', capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, way: p.way, months: p.months, cost: p.cost,
                      label: first(capo) + ' goes for the ' + at(c, p.x, p.y).owner + 's\' place in ' + zoneOf(c, p.x, p.y).name });
        return;
      }
      if (p.move === 'open') { open(c, p.x, p.y, { owner: 'family', kind: p.kind, capo: capo }); at(c, p.x, p.y).turned = c.month; } // (and he does not turn it into something else the year after)
      else { at(c, p.x, p.y).level += 1; changed(c); }
      events.push({ type: p.move === 'open' ? 'opened' : 'enlarged', capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, cost: p.cost, why: p.why,
                    label: first(capo) + (p.move === 'open' ? ' opens a ' : ' enlarges his ') + p.name.toLowerCase() + ' in ' + zoneOf(c, p.x, p.y).name });
    })();
  }
  // An event about one of the family's men that names no place happens at his club.
  function homed(c, f, events) {
    events.forEach(function (e) {
      var club = e.x === undefined && e.city === c.id && e.capo && f.men[e.capo] && clubOf(c, e.capo);
      if (club) { e.x = club.x; e.y = club.y; }
    });
  }
  // In a city played day by day a man who sets out is expected on the same day of a later cycle.
  function leaving(c, o) { if (c.turn && c.turn.daily) o.day = c.turn.day || 0; return o; }
  // The day of this cycle a city sees to one of its affairs: its own, and never the same two cycles running.
  function choreDay(c, name) {
    var n = c.month * 7;
    for (var i = 0; i < c.id.length; i++) n += c.id.charCodeAt(i) * (i + 3);
    for (var k = 0; k < name.length; k++) n += name.charCodeAt(k) * (k + 5);
    return 1 + n % (RULES.days - 2);
  }
  // A car or a truck the rivals held up: told once, the day it happens.
  function heldUp(c, trap, events) {
    if (!trap || !trap.done || trap.told) return;
    trap.told = true;
    var held2 = trap.done, cash = held2.cargo === 'cash', gang = c.rival || everyPlace(c).filter(function (q) { return q.owner !== 'family'; })[0].owner;
    if (cash) c.flow.hijacked = held2.amount;
    c.lurk = c.month + RULES.road.every; // they lie low for a while
    events.push({ type: 'hijack', capo: held2.capo, city: c.id, x: trap.x, y: trap.y, cargo: held2.cargo, amount: held2.amount, by: gang,
              label: 'The ' + gang + 's hold up ' + first(held2.capo) + '\'s ' + (cash ? 'car' : 'truck') + ' in ' + zoneOf(c, trap.x, trap.y).name + ': '
                + (cash ? '$' + held2.amount : held2.amount + CARGOES[held2.cargo]) + ' gone' });
  }
  function rivals(c, f, events) {
    rivalGrows(c);
    rivalRaids(c, events, f);
    revenge(c, events);
    tempers(c, events);
  }
  // The men at the door: an underboss takes one in himself, the others knock for the boss.
  function door(c, f, events) {
    var under = underOf(c), taken = false;
    doors(c, f).forEach(function (d) {
      // a city with an underboss: he takes one man in a month himself, where the rivals press least, with the boss's
      // money. A rival's lieutenant who would cross is still the boss's affair.
      if (under && d.door !== 'poach') {
        var s = seats(c), quiet = landing(c), free = spots(c);
        var spot = quiet && free.filter(function (q) { return q.x === quiet.x && q.y === quiet.y; })[0] || free[0];
        if (taken || s.taken >= s.total || !spot || funds(f) < d.cost) return;
        send(c, c, f, d.capo, spot.x, spot.y);
        taken = true;
        events.push({ type: 'welcomed', capo: d.capo, city: c.id, x: spot.x, y: spot.y, by: under, cost: d.cost,
                      label: d.name + ' joins the family: ' + first(under) + ' gives him a club in ' + zoneOf(c, spot.x, spot.y).name });
        return;
      }
      if (c.knocked[d.capo]) return;
      c.knocked[d.capo] = true;
      events.push({ type: 'knocks', capo: d.capo, city: c.id, door: d.door, by: d.by, cost: d.cost, label: d.name + ' would join the family. ' + d.why });
    });
  }
  var LOUD = { burnt: true, repelled: true };
  function noisy(e) { return LOUD[e.type] || (e.type === 'taken' && e.way === 'force'); }
  // One day of a city's own affairs: men who get where they were sent, a hold-up told, the rivals and the door on
  // the day this cycle gives them.
  function chores(c, f, day, events) {
    var t = c.turn, mine = [];
    t.day = day; t.done = t.done || {};
    settleTakes(c, mine, f);
    H.pass(c, f, mine);
    if (!t.done.rivals && day >= choreDay(c, 'rivals')) { t.done.rivals = true; rivals(c, f, mine); }
    if (!t.done.door && day >= choreDay(c, 'door')) { t.done.door = true; door(c, f, mine); }
    B.wash(c, f, 1 / RULES.days);
    if (c.bust && day >= choreDay(c, 'police')) { c.bust = false; B.bust(c, f, mine); }
    homed(c, f, mine);
    t.noise = (t.noise || 0) + mine.filter(noisy).length;
    mine.forEach(function (e) { events.push(e); });
  }
  function closing(c, f, events) {
    var t = c.turn, done = t.done || {};
    c.turn = null;
    heldUp(c, t.trap, events);
    if (!done.rivals) rivals(c, f, events);
    // what was loud on the days of the cycle counts with what is loud at its close
    money(c, f, events, t.noise || 0, !!t.daily);
    hearts(c, f, events);
    B.judge(c, events);
    homed(c, f, events);
    if (!done.door) door(c, f, events);
    mark(c, f);
  }
  function stepMonth(c, f) {
    var events = [];
    opening(c, f, events);
    Object.keys(f.men).forEach(function (capo) { capoDay(c, f, capo, events); });
    closing(c, f, events);
    return events;
  }

  // --- the month day by day ---
  // While a month is being played the city goes on showing the money of the month before (c.flow); the month's own
  // figures are kept aside and shown when it closes.
  function begin(f, cities) {
    var events = [];
    f.crowns = cities.reduce(function (n, c) { return n + keys(c).filter(function (k) { return k.owner === 'family'; }).length; }, 0);
    cities.forEach(function (c) {
      var shown = c.flow;
      opening(c, f, events); homed(c, f, events);
      c.turn.flow = c.flow; c.turn.shown = shown; c.flow = shown;
    });
    return events;
  }
  // One day goes by: the tills fill and the cars leave for those that are full. Returns the cars that left.
  function pass(f, cities, day) {
    var events = [];
    if (f.study && f.study.day !== undefined && f.study.monthsLeft <= 0 && day >= f.study.day) learn(f, events);
    cities.forEach(function (c) {
      if (!c.turn) return;
      c.turn.daily = true;
      c.flow = c.turn.flow;
      var got = {}, mine = [];
      chores(c, f, day, events);
      G.pass(c, f, day, loadOf(f)).forEach(function (e) { events.push(e); if (!e.lost) got[e.capo] = (got[e.capo] || 0) + e.amount; });
      heldUp(c, c.turn.trap, mine);
      Object.keys(f.men).forEach(function (capo) { if (clubOf(c, capo)) ready(c, f, capo, got[capo] || 0, mine); });
      homed(c, f, mine);
      mine.forEach(function (e) { events.push(e); });
      c.flow = c.turn.shown;
    });
    return events;
  }
  // The day of the cycle a man counts his takings, pays his men and makes his move: his own, and always the same.
  function dayOf(capo) {
    var n = 0;
    for (var i = 0; i < capo.length; i++) n += capo.charCodeAt(i) * (i + 1);
    return 2 + n % (RULES.days - 4);
  }
  function act(f, cities, capo) {
    var events = [];
    cities.forEach(function (c) {
      if (!c.turn) return;
      c.flow = c.turn.flow;
      capoDay(c, f, capo, events); homed(c, f, events);
      c.flow = c.turn.shown;
    });
    return events;
  }
  function end(f, cities, roads) {
    var events = [];
    if (!cities.some(function (c) { return c.turn; })) return events;
    cities.forEach(function (c) {
      if (!c.turn) return;
      c.flow = c.turn.flow;
      closing(c, f, events);
    });
    after(f, cities, roads, events);
    return events;
  }

  // The family's month: every city plays its month, then the convoys ride between them.
  function month(f, cities, roads) {
    var events = [];
    f.crowns = cities.reduce(function (n, c) { return n + keys(c).filter(function (k) { return k.owner === 'family'; }).length; }, 0);
    cities.forEach(function (c) { events = events.concat(stepMonth(c, f)); });
    after(f, cities, roads, events);
    return events;
  }
  // What the family does once every city has played its month: the convoys, the table, what it is learning.
  function after(f, cities, roads, events) {
    ride(f, cities, roads);
    payTable(f, events);
    // what was paid for on a day of a cycle is learned on that day (T.pass); otherwise as the cycle closes
    if (f.study && --f.study.monthsLeft <= 0 && f.study.day === undefined) learn(f, events);
  }
  function learn(f, events) {
    f.tech[f.study.kind] = f.study.tier;
    events.push({ type: 'learned', kind: f.study.kind, tier: f.study.tier, label: f.study.kind === 'cars' ? 'The family now drives cars that carry $' + RULES.car.loads[f.study.tier] + ' a run'
      : 'The family can now run a ' + D.SITES[f.study.kind].name.toLowerCase() + ' of tier ' + f.study.tier });
    f.study = null;
  }

  var api = { purse: C.purse, hqs: hqs, hqOf: C.hqOf, raiseHq: C.raiseHq, hqStage: C.hqStage, sizeHq: C.sizeHq, razeHq: C.razeHq, call: H.call, clubSpot: M.clubSpot, sway: sway, EVERY: R.EVERY, days: R.days, pass: pass, dayOf: dayOf, gains: C.gains, grip: C.grip, begin: begin, act: act, end: end, stalls: stalls, zoneAt: C.zoneAt, run: C.run, worth: C.worth, line: B.line, keyWorth: B.keyWorth, touch: C.changed, holdings: B.holdings, buy: B.buy, cut: B.cut, loyalty: loyalty, gift: gift, underboss: underboss, table: table, seat: seat, unseat: unseat, abilities: abilities, SCHOOLS: SCHOOLS, convoys: convoys, earns: earns, send: send, partings: partings, part: part, trips: trips, grudges: grudges, feuds: feuds, rule: rule, funds: funds, createFamily: createFamily, tree: tree, research: research, wishes: wishes, month: month, view: view, washing: washing, seats: seats, spots: spots, PEOPLE: PEOPLE, person: person, doors: doors, welcome: welcome, crown: crown, KEYS: KEYS, keys: keys, asks: asks, answer: answer, cover: cover, seed: seed, landing: landing, wayOf: wayOf, takes: takes, RANKS: RANKS, liquor: liquor, income: income, join: join, plan: plan, stepMonth: stepMonth, RULES: RULES, TERRAIN: TERRAIN, WORTH: WORTH, createCity: createCity, zoneOf: zoneOf, at: at, open: open, settle: settle, clubOf: clubOf,
              places: places, size: R.size, hold: hold, grip: grip, share: share, frontier: frontier, price: price, tradeOf: tradeOf, wants: wants };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurf = api;
})(typeof self !== 'undefined' ? self : this);
