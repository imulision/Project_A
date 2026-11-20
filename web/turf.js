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
    Object.keys(f.men || {}).forEach(function (id) {
      var club = clubOf(c, id), w = club && whereabouts(c, f, id);
      if (w && w.why !== 'home') out.push({ kind: 'capo', cargo: w.why, capo: id, from: { x: club.x, y: club.y }, to: { x: w.x, y: w.y }, vehicle: id + ':own', home: { x: club.x, y: club.y } });
    });
    if (f.dirty > 0) washes.forEach(function (p) {
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
      out.push({ kind: 'dry', label: !k.drink.stills ? 'Nothing to pour: the family has no still' : b.wet === 0 ? 'Nothing to pour: no truck came this month'
        : 'Running dry: liquor for ' + Math.round(100 * wet) + '% of what it could sell' });
    }
    if (p.kind === 'fence' && wet < 1) {
      out.push({ kind: 'dry', label: !k.goods.makers ? 'Nothing to sell: the family has no warehouse and no chop shop' : b.wet === 0 ? 'Nothing to sell: no truck came this month'
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

  function view(c, f) {
    var m = memo(c), blocks = [], flow = c.flow || {};
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      var gap = c.voids && c.voids[key(x, y)], b = { x: x, y: y, grip: grip(c, x, y), family: gap ? 0 : m.family[y * c.w + x], rival: gap ? 0 : m.rival[y * c.w + x] };
      if (gap) b.void = gap; // nothing stands here: water, a rail yard or waste ground
      blocks.push(b);
    }
    var choke = { load: loadOf(f), drink: liquor(c), goods: supplied(c), washed: flow.wash || {}, most: {}, cellar: {} };
    choke.smokers = everyPlace(c).filter(function (p) { return p.owner === 'family' && CHAINS[2].sells.indexOf(p.kind) >= 0; }).length;
    cellars(c).forEach(function (s) { choke.cellar[key(s.p.x, s.p.y)] = { most: s.most, cargo: s.cargo }; });
    laundries(c).forEach(function (l) { choke.most[key(l.x, l.y)] = l.most; });
    return {
      id: c.id, w: c.w, h: c.h, month: c.month, heat: c.heat || 0, under: underOf(c),
      rival: c.rival || (everyPlace(c).filter(function (p) { return p.owner !== 'family'; })[0] || {}).owner || null,
      zones: c.zones.map(function (z) { return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 }; }),
      blocks: blocks,
      places: places(c).map(function (p) {
        p.name = p.kind === 'club' ? 'Social Club' : p.kind === 'key' ? KEYS[p.key].name : D.SITES[p.kind].name;
        return { x: p.x, y: p.y, owner: p.owner, kind: p.kind, key: p.key, man: p.man, name: p.name, level: p.level, capo: p.capo, till: p.till };
      }).map(function (p) {
        if (!p.key) delete p.key; if (!p.man) delete p.man; if (!p.till) delete p.till;
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
      keys: keys(c), share: share(c), cut: B.cutOf(c), cuts: B.cuts(), promises: B.promises(c), chief: S.chief(c), seats: seats(c), takes: takes(c), asks: asks(c), doors: doors(c, f), grudges: grudges(c), feuds: feuds(c), trips: trips(c, f), tree: tree(f), wishes: wishes(c, f),
      money: { dirty: f.dirty, clean: f.clean || 0, washed: c.washed || 0, washes: washing(c).most, up: flow.up || 0, pay: flow.pay || 0, cut: flow.cut || 0, seized: flow.seized || 0 },
      capos: Object.keys(f.men).filter(function (id) { return clubOf(c, id); }).map(function (id) {
        var man = f.men[id], club = clubOf(c, id);
        return { id: id, name: who(id).name, specialty: who(id).specialty, rank: man.rank, rankName: RANKS[man.rank], x: club.x, y: club.y,
                 places: run(c, id).length, reach: RULES.reach[man.rank], sulks: Math.max(0, ((c.sulk || {})[id] || 0) - c.month), sent: (flow.sent || {})[id] || 0, at: whereabouts(c, f, id), under: underOf(c) === id, mood: mood(f, id), gift: gifts(c, f, id), abilities: abilities(f, id), cars: man.cars || 1, trucks: cellars(c).some(function (s) { return s.p.capo === id; }) ? man.trucks || 1 : 0, waiting: Math.round(man.waiting || 0), income: man.income, cash: man.cash, way: wayOf(id), plan: plan(c, f, id), partings: partings(c, f, id) };
      })
    };
  }

  function stepMonth(c, f) {
    var events = [];
    c.month += 1;
    learnt(c, f);
    c.flow = { up: 0, sent: {}, pay: 0, cut: 0, seized: 0, wash: {}, runs: [] }; // last month's money, for the screen
    settleTakes(c, events);
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
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var m = f.men[capo];
      m.cars = m.cars || 1;
      var load = loadOf(f), haul = collect(c, capo, m.cars, drives[capo], load, trap);
      m.stuck = haul.full > 0;
      if (haul.went) m.help = { x: haul.went.x, y: haul.went.y, why: 'carry', kind: at(c, haul.went.x, haul.went.y).kind };
      var inc = haul.got + RULES.club, makes = drink.idle[capo] !== undefined,
          pay = wages(c, capo) + RULES.car.upkeep * (m.cars - 1) + (makes ? RULES.truck.upkeep * (m.trucks - 1) : 0);
      // his men are paid out of what his places brought in: a bad month never puts him in debt, and what his club
      // makes on its own stays his, so that he can always save for his next move
      pay = Math.min(pay, haul.got);
      var profit = inc - pay;
      m.income = inc; m.waiting = haul.waiting;
      // tills that keep filling with no car free to empty them: he buys another one
      if (!haul.idle && haul.waiting >= 2 * load && m.cash - pay >= RULES.car.cost) {
        m.cash -= RULES.car.cost; m.cars += 1;
        events.push({ type: 'car', capo: capo, city: c.id, cars: m.cars, cost: RULES.car.cost,
                      label: first(capo) + ' buys a ' + (['', '', 'second', 'third', 'fourth', 'fifth'][m.cars] || 'new') + ' car: his takings were piling up' });
      }
      // loads that wait in his cellars while bars go dry, and no truck free: he buys another one
      if (makes && drink.dry && drink.idle[capo] === 0 && drink.waits[capo] >= 2 && m.cash - pay >= RULES.truck.cost) {
        m.cash -= RULES.truck.cost; m.trucks += 1;
        events.push({ type: 'truck', capo: capo, city: c.id, trucks: m.trucks, cost: RULES.truck.cost,
                      label: first(capo) + ' buys a ' + (['', '', 'second', 'third', 'fourth', 'fifth'][m.trucks] || 'new') + ' truck: liquor sits in his cellar while bars go dry' });
      }
      // the boss's share comes off the top, before the men are paid; a capo with nothing left sends what he has
      // a bitter man sends nothing at all
      var gives = mood(f, capo) === 'bitter' ? 0 : willing(c, capo);
      var sent = Math.max(0, Math.min(RULES.cut[B.cutOf(c)].share * gives * inc, m.cash + profit));
      f.dirty += sent; m.cash += profit - sent;
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
      if (spare > 0 && gives === 1 && (p.move === 'hold' || p.waiting !== 'money')) { var his = RULES.keeps[m.rank] * (can(c, capo, 'silent') ? 0.5 : 1); m.cash -= spare; f.dirty += spare * (1 - his); sent += spare * (1 - his); }
      c.flow.sent[capo] = sent; c.flow.up += sent;
      if (p.move === 'hold' || p.waiting) return;
      m.cash -= p.cost;
      if (p.move !== 'enlarge') rub(c, capo, p.x, p.y);
      if (p.move === 'take') {
        c.ops.push({ capo: capo, x: p.x, y: p.y, way: p.way, kind: p.kind, cost: p.cost, month: c.month, months: p.months });
        events.push({ type: 'moving', capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, way: p.way, months: p.months, cost: p.cost,
                      label: first(capo) + ' goes for the ' + at(c, p.x, p.y).owner + 's\' place in ' + zoneOf(c, p.x, p.y).name });
        return;
      }
      if (p.move === 'open') open(c, p.x, p.y, { owner: 'family', kind: p.kind, capo: capo });
      else { at(c, p.x, p.y).level += 1; changed(c); }
      events.push({ type: p.move === 'open' ? 'opened' : 'enlarged', capo: capo, city: c.id, x: p.x, y: p.y, kind: p.kind, cost: p.cost, why: p.why,
                    label: first(capo) + (p.move === 'open' ? ' opens a ' : ' enlarges his ') + p.name.toLowerCase() + ' in ' + zoneOf(c, p.x, p.y).name });
    });
    if (trap && trap.done) {
      var held2 = trap.done, cash = held2.cargo === 'cash', gang = c.rival || everyPlace(c).filter(function (q) { return q.owner !== 'family'; })[0].owner;
      if (cash) c.flow.hijacked = held2.amount;
      c.lurk = c.month + RULES.road.every; // they lie low for a while
      events.push({ type: 'hijack', capo: held2.capo, city: c.id, x: trap.x, y: trap.y, cargo: held2.cargo, amount: held2.amount, by: gang,
                    label: 'The ' + gang + 's hold up ' + first(held2.capo) + '\'s ' + (cash ? 'car' : 'truck') + ' in ' + zoneOf(c, trap.x, trap.y).name + ': '
                      + (cash ? '$' + held2.amount : held2.amount + CARGOES[held2.cargo]) + ' gone' });
    }
    rivalGrows(c);
    rivalRaids(c, events);
    revenge(c, events);
    tempers(c, events);
    money(c, f, events);
    hearts(c, f, events);
    B.judge(c, events);
    // an event about one of the family's men that names no place happens at his club
    events.forEach(function (e) {
      var club = e.x === undefined && e.capo && f.men[e.capo] && clubOf(c, e.capo);
      if (club) { e.x = club.x; e.y = club.y; }
    });
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
    return events;
  }

  // The family's month: every city plays its month, then the convoys ride between them.
  function month(f, cities, roads) {
    var events = [];
    f.crowns = cities.reduce(function (n, c) { return n + keys(c).filter(function (k) { return k.owner === 'family'; }).length; }, 0);
    cities.forEach(function (c) { events = events.concat(stepMonth(c, f)); });
    ride(f, cities, roads);
    payTable(f, events);
    if (f.study && --f.study.monthsLeft <= 0) {
      f.tech[f.study.kind] = f.study.tier;
      events.push({ type: 'learned', kind: f.study.kind, tier: f.study.tier, label: f.study.kind === 'cars' ? 'The family now drives cars that carry $' + RULES.car.loads[f.study.tier] + ' a run'
        : 'The family can now run a ' + D.SITES[f.study.kind].name.toLowerCase() + ' of tier ' + f.study.tier });
      f.study = null;
    }
    return events;
  }

  var api = { keyWorth: B.keyWorth, touch: C.changed, holdings: B.holdings, buy: B.buy, cut: B.cut, loyalty: loyalty, gift: gift, underboss: underboss, table: table, seat: seat, unseat: unseat, abilities: abilities, SCHOOLS: SCHOOLS, convoys: convoys, earns: earns, send: send, partings: partings, part: part, trips: trips, grudges: grudges, feuds: feuds, rule: rule, funds: funds, createFamily: createFamily, tree: tree, research: research, wishes: wishes, month: month, view: view, washing: washing, seats: seats, spots: spots, PEOPLE: PEOPLE, person: person, doors: doors, welcome: welcome, crown: crown, KEYS: KEYS, keys: keys, asks: asks, answer: answer, cover: cover, seed: seed, landing: landing, wayOf: wayOf, takes: takes, RANKS: RANKS, liquor: liquor, income: income, join: join, plan: plan, stepMonth: stepMonth, RULES: RULES, TERRAIN: TERRAIN, WORTH: WORTH, createCity: createCity, zoneOf: zoneOf, at: at, open: open, settle: settle, clubOf: clubOf,
              places: places, size: R.size, hold: hold, grip: grip, share: share, frontier: frontier, price: price, tradeOf: tradeOf, wants: wants };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurf = api;
})(typeof self !== 'undefined' ? self : this);
