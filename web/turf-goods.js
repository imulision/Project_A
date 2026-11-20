// What the places make, carry and earn: liquor, goods, cars and weed, the
// trucks that move them and what the road takes, the takings of each place,
// the washing of money, and what a capo wants to open next.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var RULES = R.RULES, WORTH = R.WORTH, KINDS = R.KINDS, key = R.key, at = R.at, far = R.far;
  var KEYS = P.KEYS, who = P.who, TRADE = P.TRADE, can = P.can;
  var zoneOf = C.zoneOf, everyPlace = C.everyPlace, places = C.places, run = C.run, held = C.held, lift = C.lift, clubOf = C.clubOf, hold = C.hold,
      frontier = C.frontier, price = C.price, tradeOf = C.tradeOf, worth = C.worth, taste = C.taste;

  // How well the family's stills keep its speakeasies wet, across the whole city: 0 to 1.
  function liquor(c) {
    var stills = held(c, 'pours'), bars = 0;
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family') return;
      if (p.kind === 'still') stills += (1 + RULES.bigger * (p.level - 1)) * pushed(c, p);
      if (p.kind === 'speakeasy') bars += 1;
    });
    return { stills: stills, bars: bars, wet: bars ? Math.min(1, RULES.pours * stills / bars) : 1 };
  }

  // Goods go from where they are made to where they are sold, by truck. Liquor from the stills to the bars; hijacked
  // goods from the warehouses and stolen cars from the chop shops to the fences. A seller with nothing to sell earns
  // only the `short` share of what it could.
  // `shelf` and `sold` are where a seller's block keeps what it has of the chain and what it sold of it last month.
  var CHAINS = [{ id: 'liquor', sells: ['speakeasy'], short: RULES.dry, shelf: 'stock', sold: 'wet' }, { id: 'goods', sells: ['fence'], short: RULES.goods.short, shelf: 'stock', sold: 'wet' },
                { id: 'weed', sells: ['speakeasy', 'brothel'], bonus: true, shelf: 'weed', sold: 'high' }];

  var SELLS = { speakeasy: CHAINS[0], fence: CHAINS[1] };

  var CARGO = { still: 'liquor', warehouse: 'goods', chopshop: 'cars', loft: 'weed' };

  function loadOfCargo(cargo) { return cargo === 'liquor' ? RULES.truck.load : cargo === 'weed' ? RULES.weed.load : RULES.goods.load[cargo]; }

  // How well the family's warehouses and chop shops keep its fences in goods, across the whole city: 0 to 1.
  function supplied(c) {
    var makes = 0, fences = 0, makers = 0;
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family') return;
      if (RULES.goods.makes[p.kind]) { makers += 1; makes += RULES.goods.makes[p.kind] * (1 + RULES.bigger * (p.level - 1)); }
      if (p.kind === 'fence') fences += 1;
    });
    return { makers: makers, makes: makes, fences: fences, fed: fences ? Math.min(1, makes / fences) : 1 };
  }

  // What a seller had to sell this month: the loads the trucks really brought it, or, before any month has gone by,
  // what the family could make for it.
  function poured(c, p, wet) {
    var b = c.blocks[p.x + ',' + p.y];
    if (b && b.wet !== undefined) return b.wet;
    return p.kind === 'fence' ? supplied(c).fed : wet;
  }

  // Where goods are made: the family's stills, and the brewery if it holds it; its warehouses and chop shops. What
  // each makes in a month, in loads.
  function cellars(c) {
    var out = [];
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family') return;
      var b = c.blocks[key(p.x, p.y)], size = 1 + RULES.bigger * (p.level - 1);
      if (p.kind === 'still') out.push({ p: p, b: b, chain: 'liquor', cargo: 'liquor', makes: RULES.pours * size * pushed(c, p) });
      else if (p.kind === 'key' && KEYS[p.key].pours) out.push({ p: p, b: b, chain: 'liquor', cargo: 'liquor', makes: RULES.pours * KEYS[p.key].pours });
      else if (RULES.goods.makes[p.kind]) out.push({ p: p, b: b, chain: 'goods', cargo: CARGO[p.kind], makes: RULES.goods.makes[p.kind] * size * pushed(c, p) });
      else if (p.kind === 'loft') out.push({ p: p, b: b, chain: 'weed', cargo: 'weed', makes: RULES.weed.makes * size * pushed(c, p) * (can(c, p.capo, 'harvest') ? 2 : 1) });
    });
    // what each keeps before it stops making
    out.forEach(function (s) { s.most = RULES.truck.cellar * s.makes * (can(c, s.p.capo, 'deep') ? 2 : 1); });
    return out;
  }

  // Where the rivals lie in wait this month: every place of the family they press on hard enough for its capo's Muscle
  // (his own: the cars are his business). The
  // first load that leaves one of them is theirs.
  function ambush(c) {
    if (c.month < (c.lurk || 0) || c.month <= (c.quiet || 0)) return null;
    var out = { at: {}, done: null }, any = false, shield = held(c, 'shield');
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family' || p.kind === 'club' || p.kind === 'key' || can(c, p.capo, 'escorts')) return;
      var h = hold(c, p.x, p.y);
      if (h.rival < RULES.rivalReach || h.rival <= h.family * (RULES.road.hold + RULES.road.muscle * who(p.capo).muscle + shield)) return;
      out.at[p.y * c.w + p.x] = true; any = true;
    });
    return any ? out : null;
  }

  var CARGOES = { liquor: ' crates of liquor', goods: ' crates of goods', cars: ' stolen cars', weed: ' bags of weed' };

  // One month of goods: every cellar and store fills with what was made, the trucks of the men who make it drive full
  // loads to the family's emptiest sellers, liquor first, and every seller sells what it has.
  function distil(c, f, trap) {
    var all = cellars(c), left = {}, made = {}, out = { dry: false, idle: {}, waits: {}, seized: null };
    var police = (c.heat || 0) >= RULES.road.heat && !held(c, 'shield');
    all.forEach(function (s) {
      s.b.stock = Math.min(s.most, (s.b.stock || 0) + s.makes);
      var m = f.men[s.p.capo];
      if (m && left[s.p.capo] === undefined) { m.trucks = m.trucks || 1; left[s.p.capo] = m.trucks * (RULES.truck.runs + (can(c, s.p.capo, 'nightruns') ? 2 : 0)); }
    });
    c.flow.hauls = [];
    CHAINS.forEach(function (chain) {
      var src = all.filter(function (s) { return s.chain === chain.id; }), short = false;
      var bars = everyPlace(c).filter(function (p) { return p.owner === 'family' && chain.sells.indexOf(p.kind) >= 0; }).map(function (p) { return { p: p, b: c.blocks[key(p.x, p.y)] }; });
      for (;;) {
        var from = null, to = null;
        src.forEach(function (s) { if (s.b.stock >= 1 && left[s.p.capo] > 0 && (!from || s.b.stock > from.b.stock)) from = s; });
        if (!from) break;
        bars.forEach(function (q) {
          var has = q.b[chain.shelf] || 0;
          if (has + 1 > RULES.truck.shelf) return;
          if (!to || has < (to.b[chain.shelf] || 0) || (has === (to.b[chain.shelf] || 0) && far(from.p.x, from.p.y, q.p.x, q.p.y) < far(from.p.x, from.p.y, to.p.x, to.p.y))) to = q;
        });
        if (!to) break;
        var who2 = from.p.capo, n = made[who2] || 0, trucks = f.men[who2].trucks;
        var h = { capo: who2, cargo: from.cargo, from: { x: from.p.x, y: from.p.y }, to: { x: to.p.x, y: to.p.y }, amount: loadOfCargo(from.cargo), truck: n % trucks + 1, leg: Math.floor(n / trucks) };
        // a load the rivals or the police take on the road never reaches the shelf
        if (trap && !trap.done && (trap.at[from.p.y * c.w + from.p.x] || trap.at[to.p.y * c.w + to.p.x])) { h.lost = 'hijack'; trap.done = h; trap.x = trap.at[from.p.y * c.w + from.p.x] ? from.p.x : to.p.x; trap.y = trap.at[from.p.y * c.w + from.p.x] ? from.p.y : to.p.y; }
        else if (police && !out.seized && !can(c, who2, 'friends')) { h.lost = 'seizure'; out.seized = h; }
        from.b.stock -= 1; left[who2] -= 1; made[who2] = n + 1;
        if (!h.lost) to.b[chain.shelf] = (to.b[chain.shelf] || 0) + 1;
        c.flow.hauls.push(h);
      }
      bars.forEach(function (q) {
        var sold = Math.min(1, q.b[chain.shelf] || 0);
        q.b[chain.shelf] = (q.b[chain.shelf] || 0) - sold; q.b[chain.sold] = sold;
        if (sold < 1 && !chain.bonus) short = true;
      });
      if (short) out.dry = true;
      // only the loads a starved seller waits for call for one more truck
      if (short || chain.id === 'liquor') src.forEach(function (s) { out.waits[s.p.capo] = (out.waits[s.p.capo] || 0) + Math.floor(s.b.stock); });
    });
    out.idle = left;
    return out;
  }

  // A place makes more the month its capo stands over it.
  function pushed(c, p) { return c.push && c.push[p.y * c.w + p.x] ? 1 + RULES.own.boost : 1; }

  // What one place brings in a month: the street, its size, how firmly it is held, and the liquor for a bar.
  function earns(c, p, wet) {
    if (!WORTH[p.kind]) return 0;
    var h = hold(c, p.x, p.y);
    return WORTH[p.kind] * RULES.yield * worth(c, p.x, p.y, p.kind) * (1 + RULES.bigger * (p.level - 1)) * (h.family / (h.family + h.rival)) * lift(c, p.kind)
      * (SELLS[p.kind] ? SELLS[p.kind].short + (1 - SELLS[p.kind].short) * poured(c, p, wet) : 1) * (p.kind === 'speakeasy' || p.kind === 'brothel' ? 1 + RULES.weed.bonus * (can(c, p.capo, 'dealers') ? 2 : 1) * ((c.blocks[p.x + ',' + p.y] || {}).high || 0) : 1) * (p.kind === 'still' ? 1 : pushed(c, p)) * (c.skills && TRADE[p.kind] && can(c, p.capo, TRADE[p.kind][0]) ? TRADE[p.kind][1] : 1);
  }

  function income(c, capo) {
    var wet = liquor(c).wet;
    return run(c, capo).reduce(function (n, p) { return n + earns(c, p, wet); }, clubOf(c, capo) ? RULES.club : 0);
  }

  function wages(c, capo) { return RULES.wage * run(c, capo).length * (can(c, capo, 'tight') ? 0.85 : 1); }

  // What a place made goes into its till. The capo's cars fetch it one full load at a time, the fullest till first.
  function collect(c, capo, cars, own, load, trap) {
    var wet = liquor(c).wet, got = 0, left = cars * RULES.car.runs, mine = own || 0, waiting = 0, full = 0, went = null, done = 0, drove = 0;
    var tills = run(c, capo).map(function (p) { var b = at(c, p.x, p.y); b.till = (b.till || 0) + earns(c, p, wet); return { p: p, b: b }; });
    while (left + mine > 0) {
      var best = null;
      for (var i = 0; i < tills.length; i++) if (tills[i].b.till >= load && (!best || tills[i].b.till > best.b.till)) best = tills[i];
      if (!best) break;
      best.b.till -= load;
      var r = { capo: capo, x: best.p.x, y: best.p.y, amount: load };
      // the car the rivals wait for never reaches the club
      if (trap && !trap.done && trap.at[r.y * c.w + r.x]) { r.lost = 'hijack'; r.cargo = 'cash'; trap.done = r; trap.x = r.x; trap.y = r.y; } else got += load;
      if (left > 0) { r.car = done % cars + 1; r.leg = Math.floor(done / cars); done += 1; left -= 1; }
      else { r.own = true; r.leg = drove; drove += 1; mine -= 1; went = went || { x: r.x, y: r.y }; }
      c.flow.runs.push(r);
    }
    for (var j = 0; j < tills.length; j++) { waiting += tills[j].b.till; if (tills[j].b.till >= load) full += 1; }
    return { got: got, waiting: waiting, idle: left, full: full, went: went };
  }

  // Where a free capo lends a hand: his still when the bars run dry, otherwise the place that makes him the most.
  function chokes(c, capo) {
    var drink = liquor(c), mine = run(c, capo), best = null;
    var stills = mine.filter(function (p) { return p.kind === 'still'; });
    if (drink.wet < 1 && stills.length) return stills.reduce(function (a, b) { return b.level > a.level ? b : a; });
    mine.forEach(function (p) { var e = earns(c, p, drink.wet); if (e > 0 && (!best || e > best.e)) best = { p: p, e: e }; });
    return best && best.p;
  }

  function busy(c, capo) {
    return c.ops.some(function (o) { return o.capo === capo; }) || c.asks.some(function (a) { return a.capo === capo; })
      || (c.feuds || []).some(function (q) { return q.a === capo; });
  }

  // How a capo takes what is not his: the hard men by force, the talkers with an envelope, the others with a cheque.
  function wayOf(capo) {
    var k = who(capo);
    return k.muscle >= 7 ? 'force' : k.cunning + k.charisma >= 13 ? 'bribe' : 'buy';
  }

  // A place taken keeps its trade, unless the capo refuses it or the family cannot run it.
  function keeps(capo, kind, tech) {
    return who(capo).refuses.indexOf(kind) >= 0 || !(tech[kind] >= 1) ? tradeOf(capo) || 'speakeasy' : kind;
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
    var card = who(capo), mine = run(c, capo), club = clubOf(c, capo), best = null;
    var count = {}, drink = liquor(c), stock = supplied(c);
    mine.forEach(function (p) { count[p.kind] = (count[p.kind] || 0) + 1; });
    // no capo opens one more bar with nothing to pour in it, and a dry city calls for a still
    var thirst = function (kind) {
      if (kind === 'speakeasy') return drink.bars > 0 && drink.bars >= RULES.pours * drink.stills ? 0.4 : 1;
      // and no one more still when the family already makes a still's worth more than its bars pour
      if (kind === 'still') return drink.bars > RULES.pours * drink.stills ? 1.5 : RULES.pours * drink.stills >= drink.bars + RULES.pours ? 0.4 : 1;
      // and the same for a fence with nothing to sell, and for the warehouse or the chop shop that would fill it
      if (kind === 'fence') return stock.fences > 0 && stock.fences >= stock.makes ? 0.4 : 1;
      return RULES.goods.makes[kind] && stock.fences > stock.makes ? 1.5 : 1;
    };
    if (mine.length < RULES.reach[o.rank]) {
      frontier(c, capo).forEach(function (b) {
        KINDS.forEach(function (kind) {
          if (!(o.tech[kind] >= 1) || card.refuses.indexOf(kind) >= 0) return;
          var soap = o.wash && D.SITES[kind].wash ? RULES.soap : 1;
          var score = worth(c, b.x, b.y, kind) * taste(capo, kind) * WORTH[kind] / D.SITES[kind].cost / (1 + RULES.another * (count[kind] || 0)) * thirst(kind) * soap;
          var d = club ? far(b.x, b.y, club.x, club.y) : 0;
          if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && d < best.d)) best = { score: score, d: d, x: b.x, y: b.y, kind: kind };
        });
      });
      if (best) {
        var liked = taste(capo, best.kind) > 1, z = zoneOf(c, best.x, best.y);
        return { move: 'open', x: best.x, y: best.y, kind: best.kind, name: D.SITES[best.kind].name, cost: price(c, capo, best.kind),
                 why: o.wash && D.SITES[best.kind].wash ? 'the boss\'s dirty money needs a wash' : (liked ? 'his kind of business, and ' : '') + z.name + ' is ' + (worth(c, best.x, best.y, best.kind) >= 1 ? 'made for it' : 'the best he has') };
      }
    }
    if (mine.length < RULES.reach[o.rank]) {
      // hemmed in: the weakest rival place within reach, taken his own way
      var all = places(c, capo), prey = null;
      everyPlace(c).forEach(function (p) {
        if (p.owner === 'family' || p.kind === 'key') return;
        if (!all.some(function (q) { return far(p.x, p.y, q.x, q.y) <= RULES.near; })) return;
        var r = hold(c, p.x, p.y).rival;
        if (!prey || r < prey.r) prey = { r: r, p: p };
      });
      if (prey) {
        var way = wayOf(capo), kind = keeps(capo, prey.p.kind, o.tech);
        return { move: 'take', way: way, x: prey.p.x, y: prey.p.y, kind: kind, name: D.SITES[kind].name, months: RULES.take[way].months,
                 cost: Math.round(price(c, capo, kind) * RULES.take[way].cost * (can(c, capo, 'envelopes') ? 0.75 : 1)),
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

  // --- washing money ---
  // What the family's fronts in the city can wash a month, and what they washed last month.
  function washing(c) {
    return { washed: c.washed || 0, most: Math.round(laundries(c).reduce(function (n, l) { return n + l.most; }, 0)) };
  }

  // Every place of the family that washes (what it can wash and what it keeps come from district.js), the cheapest first.
  function laundries(c) {
    var site = function (p) { return D.SITES[p.kind]; };
    return everyPlace(c).filter(function (p) { return p.owner === 'family' && site(p) && site(p).wash; }).map(function (p) {
      return { x: p.x, y: p.y, most: site(p).wash * worth(c, p.x, p.y, p.kind) * (1 + (p.level - 1) * 1.5) * (can(c, p.capo, 'ledgers') ? 1.25 : 1) * ((c.board && c.board.wash) || 1), loss: site(p).loss };
    }).sort(function (a, b) { return a.loss - b.loss; });
  }

  var api = { liquor: liquor, CHAINS: CHAINS, loadOfCargo: loadOfCargo, supplied: supplied, cellars: cellars, ambush: ambush, CARGOES: CARGOES,
      distil: distil, earns: earns, income: income, wages: wages, collect: collect, chokes: chokes, busy: busy, wayOf: wayOf, takes: takes,
      wants: wants, washing: washing, laundries: laundries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfGoods = api;
})(typeof self !== 'undefined' ? self : this);
