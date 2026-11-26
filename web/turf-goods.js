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
    if (c.month < (c.lurk || 0) || c.month <= (c.quiet || 0) || (c.chief && c.chief.gone)) return null;
    var out = { at: {}, done: null }, any = false, shield = held(c, 'shield');
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family' || p.kind === 'club' || p.kind === 'key' || p.kind === 'hq' || can(c, p.capo, 'escorts')) return;
      var h = hold(c, p.x, p.y);
      if (h.rival < RULES.rivalReach || h.rival <= h.family * (RULES.road.hold + RULES.road.muscle * who(p.capo).muscle + shield)) return;
      out.at[p.y * c.w + p.x] = true; any = true;
    });
    return any ? out : null;
  }

  var CARGOES = { liquor: ' crates of liquor', goods: ' crates of goods', cars: ' stolen cars', weed: ' bags of weed' };

  // One month of goods: every cellar and store fills with what was made, the trucks of the men who make it drive full
  // loads to the family's emptiest sellers, liquor first, and every seller sells what it has.
  function distil(c, f, trap, daily) {
    var all = cellars(c), left = {}, made = {}, out = { dry: false, idle: {}, waits: {}, seized: null };
    var police = (c.heat || 0) >= RULES.road.heat && !held(c, 'shield');
    all.forEach(function (s) {
      s.b.stock = Math.min(s.most, (s.b.stock || 0) + s.makes);
      var m = f.men[s.p.capo];
      if (m && left[s.p.capo] === undefined) { m.trucks = m.trucks || 1; left[s.p.capo] = m.trucks * (RULES.truck.runs + (can(c, s.p.capo, 'nightruns') ? 2 : 0)); }
    });
    c.flow.hauls = [];
    // played day by day the trucks leave on their own days (haulDay): what is told here is the trucks that are free
    if (daily) Object.keys(left).forEach(function (capo) { var now = today(c); left[capo] = rigs(f.men[capo], clubOf(c, capo)).filter(function (t) { return t.free <= now; }).length; });
    CHAINS.forEach(function (chain) {
      var src = all.filter(function (s) { return s.chain === chain.id; }), short = false;
      var bars = everyPlace(c).filter(function (p) { return p.owner === 'family' && chain.sells.indexOf(p.kind) >= 0; }).map(function (p) { return { p: p, b: c.blocks[key(p.x, p.y)] }; });
      for (;;) {
        if (daily) break;
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
  // The trucks of a man, like his cars: each somewhere, and free from a given day.
  function rigs(m, club) {
    if (!m.rigs) m.rigs = [];
    while (m.rigs.length < (m.trucks || 1)) m.rigs.push({ x: club.x, y: club.y, free: 0 });
    return m.rigs;
  }
  // One day of the trucks in a city played day by day: every truck that is free takes a load from its capo's fullest
  // cellar to the family's emptiest seller, liquor first. It drives to the cellar (`wait` days), loads, and drives to
  // the seller (`days` days); the load is on the shelf the day it gets there (c.rides, kind 'haul'), and the truck
  // waits there for its next load. A load already on its way to a seller counts for its shelf (b.due).
  function haulDay(c, f, drink, trap) {
    var all = cellars(c), out = [], now = today(c), police = (c.heat || 0) >= RULES.road.heat && !held(c, 'shield');
    Object.keys(f.men).forEach(function (capo) {
      var club = clubOf(c, capo), m = f.men[capo];
      if (!club || !all.some(function (s) { return s.p.capo === capo; })) return;
      rigs(m, club).forEach(function (truck, n) {
        if (truck.free > now) return;
        var from = null, to = null, chain = null;
        CHAINS.some(function (ch) {
          from = null; to = null;
          all.forEach(function (s) { if (s.chain === ch.id && s.p.capo === capo && s.b.stock >= 1 && (!from || s.b.stock > from.b.stock)) from = s; });
          if (!from) return false;
          everyPlace(c).forEach(function (p) {
            if (p.owner !== 'family' || ch.sells.indexOf(p.kind) < 0) return;
            var q = { p: p, b: c.blocks[key(p.x, p.y)] }, has = function (z) { return (z.b[ch.shelf] || 0) + ((z.b.due || {})[ch.shelf] || 0); };
            if (has(q) + 1 > RULES.truck.shelf) return;
            if (!to || has(q) < has(to) || (has(q) === has(to) && far(from.p.x, from.p.y, p.x, p.y) < far(from.p.x, from.p.y, to.p.x, to.p.y))) to = q;
          });
          chain = ch;
          return !!to;
        });
        if (!from || !to) return;
        var here = truck.x === from.p.x && truck.y === from.p.y, wait = here ? 0 : tripDays(truck, from.p), days = tripDays(from.p, to.p);
        var made = c.flow.hauls.filter(function (q) { return q.capo === capo && q.truck === n + 1; }).length;
        // a truck has room for RULES.truck.holds loads: it takes what the cellar has and the shelf has room for
        var room = RULES.truck.shelf - ((to.b[chain.shelf] || 0) + ((to.b.due || {})[chain.shelf] || 0));
        // (and it leaves the other sellers that have nothing their part of what the cellar holds)
        var dry = everyPlace(c).filter(function (p) { var q = c.blocks[key(p.x, p.y)]; return p.owner === 'family' && chain.sells.indexOf(p.kind) >= 0 && (q[chain.shelf] || 0) + ((q.due || {})[chain.shelf] || 0) < 1; }).length;
        var loads = Math.max(1, Math.min(RULES.truck.holds, Math.floor(from.b.stock / Math.max(1, dry)), Math.floor(room)));
        var h = { kind: 'haul', capo: capo, at: { x: truck.x, y: truck.y }, cargo: from.cargo, shelf: chain.shelf, loads: loads, from: { x: from.p.x, y: from.p.y }, to: { x: to.p.x, y: to.p.y }, amount: loads * loadOfCargo(from.cargo),
                  truck: n + 1, leg: made, vehicle: capo + ':truck:' + (n + 1), wait: wait, left: now + wait, days: days, arrives: now + wait + days };
        // a load the rivals or the police take on the road never reaches the shelf
        if (trap && !trap.done && (trap.at[from.p.y * c.w + from.p.x] || trap.at[to.p.y * c.w + to.p.x])) { h.lost = 'hijack'; trap.done = h; trap.x = trap.at[from.p.y * c.w + from.p.x] ? from.p.x : to.p.x; trap.y = trap.at[from.p.y * c.w + from.p.x] ? from.p.y : to.p.y; }
        else if (police && drink && !drink.seized && !can(c, capo, 'friends')) { h.lost = 'seizure'; drink.seized = h; }
        from.b.stock -= loads;
        if (!h.lost) { to.b.due = to.b.due || {}; to.b.due[chain.shelf] = (to.b.due[chain.shelf] || 0) + loads; }
        truck.x = to.p.x; truck.y = to.p.y; truck.free = h.arrives;
        (c.rides = c.rides || []).push(h);
        c.flow.hauls.push(h);
        out.push(h);
      });
    });
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

  // The places of a capo that put nothing in a till (a still, a warehouse): no car comes for takings there, so their
  // men are paid at his club.
  function idlePlaces(c, capo) { var wet = liquor(c).wet; return run(c, capo).filter(function (p) { return !(earns(c, p, wet) > 0); }); }
  function clubWages(c, capo) { return RULES.wage * idlePlaces(c, capo).length * (can(c, capo, 'tight') ? 0.85 : 1); }
  // What the men of a capo's places were paid on the spot since it was last asked: { sum, at: [{ x, y, amount }] }.
  function leftPay(c, capo) { var l = (c.left && c.left[capo]) || { sum: 0, at: [] }; if (c.left) delete c.left[capo]; return l; }
  function wages(c, capo) { return RULES.wage * run(c, capo).length * (can(c, capo, 'tight') ? 0.85 : 1); }

  // What a place made goes into its till. The capo's cars fetch it one full load at a time, the fullest till first.
  // What a capo's places put in their tills: all of a cycle's takings, or the part of it one day makes.
  function fill(c, capo, part) {
    var wet = liquor(c).wet, made = c.flow.made || (c.flow.made = {});
    var whole = RULES.wage * (can(c, capo, 'tight') ? 0.85 : 1);
    run(c, capo).forEach(function (p) {
      var b = at(c, p.x, p.y), e = earns(c, p, wet) * part;
      b.till = (b.till || 0) + e; b.making = (b.making || 0) + e;
      // its men are owed their pay as the days go (never more than RULES.owed cycles of it): the car that comes for
      // the takings leaves it to them first (see `drive`)
      if (e > 0) b.owed = Math.min(RULES.owed * whole, (b.owed || 0) + whole * part);
      made[p.kind] = (made[p.kind] || 0) + e;
    });
  }
  // The fullest till of a capo that holds a load, if any.
  function fullest(c, capo, load) {
    var mine = run(c, capo), best = null;
    for (var i = 0; i < mine.length; i++) { var b = at(c, mine[i].x, mine[i].y); if (b.till >= load && (!best || b.till > best.b.till)) best = { p: mine[i], b: b }; }
    return best;
  }
  // A car loads at a place: it leaves the men of the place their pay first, and takes what is left, a full load
  // when there is one. Returns what it takes.
  function loadUp(c, capo, best, load, room) {
    var paid = Math.min(best.b.owed || 0, best.b.till);
    if (paid > 0) {
      best.b.till -= paid; best.b.owed -= paid;
      var all = c.left || (c.left = {}), left = all[capo] || (all[capo] = { sum: 0, at: [] });
      left.sum += paid; left.at.push({ x: best.p.x, y: best.p.y, amount: paid });
    }
    var takes = Math.min(room || load, best.b.till);
    if (takes >= 1) best.b.till -= takes;
    return takes;
  }
  // --- cars and time ---
  // The day it is, counted from the first day of the game; the days a car takes between two blocks (never less than
  // one); and the cars of a man: his own first, then every car he bought, each somewhere and free from a given day.
  function today(c) { return c.month * RULES.days + ((c.turn && c.turn.day) || 0); }
  function tripDays(a, b) { return Math.max(1, Math.ceil((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) / RULES.car.speed)); }
  // The name of the n-th car of a man, the same whatever it carries: his cars are numbered from 1.
  function carId(capo, n) { return capo + ':car:' + ((n || 0) + 1); }
  function fleet(m, club) {
    if (!m.fleet) { m.fleet = m.car ? [m.car] : []; delete m.car; }
    while (m.fleet.length < (m.cars || 1)) m.fleet.push({ x: club.x, y: club.y, free: 0 });
    return m.fleet;
  }
  // In a city played day by day: every car of the capo that is free goes for the fullest till that holds a load. It
  // drives there, loads, and drives back to the club; the money is his the day it is back (c.rides, kind 'takings').
  // There is no count of runs: a car goes again when it is home. `h.left` is told the cars that found nothing to fetch.
  function dispatch(c, f, capo, h, load, trap) {
    var out = [], m = f.men[capo], club = clubOf(c, capo), now = today(c);
    h.left = 0;
    fleet(m, club).forEach(function (car, n) {
      if (car.free > now) return;
      // a till that holds `load` calls a car; the car has room for RULES.car.holds times as much
      var best = fullest(c, capo, load), takes = best ? loadUp(c, capo, best, load, load * RULES.car.holds) : 0;
      if (takes < 1) { h.left += 1; return; }
      var here = car.x === best.p.x && car.y === best.p.y, wait = here ? 0 : tripDays(car, best.p), days = tripDays(best.p, club);
      var r = { kind: 'takings', capo: capo, car: n, x: best.p.x, y: best.p.y, from: { x: best.p.x, y: best.p.y }, to: { x: club.x, y: club.y },
                amount: takes, wait: wait, left: now + wait, days: days, arrives: now + wait + days };
      // the car the rivals wait for never reaches the club
      if (trap && !trap.done && trap.at[r.y * c.w + r.x]) { r.lost = 'hijack'; r.cargo = 'cash'; trap.done = r; trap.x = r.x; trap.y = r.y; }
      // the name of the car, and the place of this run in its round, for the trips of the cycle
      r.vehicle = carId(capo, n);
      r.leg = c.flow.runs.filter(function (q) { return q.capo === capo && q.car === n; }).length;
      car.x = club.x; car.y = club.y; car.free = r.arrives;
      (c.rides = c.rides || []).push(r);
      c.flow.runs.push(r);
      out.push(r);
    });
    return out;
  }
  // The cars go for the fullest till that holds a load, as long as one is free. `h` is what the capo's cars have done
  // since his last day; every run is written in the cycle's trips and returned.
  function drive(c, capo, h, cars, load, trap) {
    var out = [];
    while (h.left + h.mine > 0) {
      var best = fullest(c, capo, load);
      if (!best) break;
      var takes = loadUp(c, capo, best, load);
      if (takes < 1) continue; // their pay was all there was: nothing to drive home
      var r = { capo: capo, x: best.p.x, y: best.p.y, amount: takes };
      // the car the rivals wait for never reaches the club
      if (trap && !trap.done && trap.at[r.y * c.w + r.x]) { r.lost = 'hijack'; r.cargo = 'cash'; trap.done = r; trap.x = r.x; trap.y = r.y; } else h.got += takes;
      // its car and the leg of that car's round, counted over the trips of the cycle the city will show
      var n = 0, own = 0, legs = {};
      c.flow.runs.forEach(function (q) { if (q.capo === capo) { if (q.own) own += 1; else { n += 1; legs[q.car] = (legs[q.car] || 0) + 1; } } });
      if (h.left > 0) { r.car = n % cars + 1; r.leg = legs[r.car] || 0; h.left -= 1; }
      else { r.own = true; r.leg = own; h.mine -= 1; h.went = h.went || { x: r.x, y: r.y }; }
      c.flow.runs.push(r);
      out.push(r);
    }
    return out;
  }
  function fresh(cars, own) { return { got: 0, left: cars * RULES.car.runs, mine: own || 0, went: null }; }
  // One day in a city played day by day: every till takes its day's part, and a car leaves for each one that is full.
  function pass(c, f, day, load) {
    var out = [], trap = c.turn && c.turn.trap;
    c.hauls = c.hauls || {};
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var cars = f.men[capo].cars || 1, h = c.hauls[capo] || (c.hauls[capo] = fresh(cars, 0));
      fill(c, capo, 1 / RULES.days);
      dispatch(c, f, capo, h, load, trap).forEach(function (r) {
        // a departure: the car is `wait` days on its way to the place, then `days` on its way home
        var e = { type: 'run', city: c.id, capo: capo, x: r.x, y: r.y, amount: r.amount, day: day, wait: r.wait, days: r.days, vehicle: r.vehicle };
        if (r.lost) e.lost = r.lost;
        r.day = day;
        out.push(e);
      });
    });
    return out;
  }
  // A capo's day: what his cars brought. In a city played day by day (`c.turn.daily`) the tills have filled and the
  // cars have driven since his last day; otherwise the whole cycle is played here in one go.
  function collect(c, capo, cars, own, load, trap) {
    var daily = c.turn && c.turn.daily, h = (daily && c.hauls && c.hauls[capo]) || fresh(cars, own), waiting = 0, full = 0;
    if (!daily) { fill(c, capo, 1); drive(c, capo, h, cars, load, trap); }
    run(c, capo).forEach(function (p) {
      var b = at(c, p.x, p.y);
      if (!b.mades) b.mades = []; b.mades.push(b.making || 0); if (b.mades.length > 6) b.mades.shift();
      b.making = 0;
      waiting += b.till || 0; if (b.till >= load) full += 1;
    });
    if (daily) { c.hauls = c.hauls || {}; c.hauls[capo] = fresh(cars, own); }
    return { got: h.got, waiting: waiting, idle: h.left, full: full, went: h.went };
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
    // what he gave up on, or was refused, he leaves alone for a while
    // nor does he go into the streets around a key place the rivals hold: that is the boss's affair
    var strong = C.keys(c).filter(function (k) { return k.owner !== 'family'; });
    var shunned = function (x, y) {
      return (o.shun && o.shun[key(x, y)] > c.month) || strong.some(function (k) { return far(x, y, k.x, k.y) <= RULES.bastion; });
    };
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
    // told to grow, he stretches: more places than a man of his rank should run
    var room = mine.length < RULES.reach[o.rank] + (o.line === 'grow' ? RULES.line.stretch : 0);
    var opens = function () {
      if (!room) return null;
      frontier(c, capo).forEach(function (b) {
        if (shunned(b.x, b.y)) return;
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
      return null;
    };
    var takes = function () {
      if (!room) return null;
      // hemmed in: the weakest rival place within reach, taken his own way
      var all = places(c, capo), prey = null;
      everyPlace(c).forEach(function (p) {
        if (p.owner === 'family' || p.kind === 'key' || p.kind === 'hq' || shunned(p.x, p.y)) return;
        if (!all.some(function (q) { return far(p.x, p.y, q.x, q.y) <= RULES.near; })) return;
        var r = hold(c, p.x, p.y).rival;
        if (!prey || r < prey.r) prey = { r: r, p: p };
      });
      if (prey) {
        var way = wayOf(capo), kind = keeps(capo, prey.p.kind, o.tech);
        return { move: 'take', way: way, x: prey.p.x, y: prey.p.y, kind: kind, name: D.SITES[kind].name, months: RULES.take[way].months,
                 cost: Math.round(price(c, capo, kind) * RULES.take[way].cost * (can(c, capo, 'envelopes') ? 0.75 : 1) * (prey.p.owner === c.rival ? P.temperOf(c).walls : 1)),
                 why: 'no free street left around him: he goes for the ' + prey.p.owner + 's\' place next door' };
      }
      return null;
    };
    var grows = function () {
    var small = mine.filter(function (p) { return p.kind !== 'key' && !shunned(p.x, p.y) && p.level < Math.min(D.RULES.maxLevel, o.tech[p.kind] || 0); });
    small.sort(function (a, b) { return a.level - b.level || WORTH[b.kind] * taste(capo, b.kind) - WORTH[a.kind] * taste(capo, a.kind) || a.y - b.y || a.x - b.x; });
    if (!small.length) return null;
    var p = small[0];
    return { move: 'enlarge', x: p.x, y: p.y, kind: p.kind, name: D.SITES[p.kind].name, cost: Math.round(RULES.enlarge * D.SITES[p.kind].cost * p.level),
             why: mine.length >= RULES.reach[o.rank] ? 'he runs all the places his rank allows: he makes them bigger' : 'no street left to open on' };
    };
    // a place on a street that is not made for it, turned into a trade that street suits and that is worth far more there.
    // A place that washes, or that makes what the family is short of, is left alone.
    var converts = function () {
      var turn = null;
      mine.forEach(function (p) {
        var since = at(c, p.x, p.y).turned;
        if (p.kind === 'key' || p.kind === 'club' || p.kind === 'hq' || shunned(p.x, p.y) || (since !== undefined && c.month - since < RULES.convert.rest)) return;
        if (worth(c, p.x, p.y, p.kind) >= 1 || D.SITES[p.kind].wash || thirst(p.kind) > 1) return;
        var value = function (kind) { return worth(c, p.x, p.y, kind) * taste(capo, kind) * WORTH[kind] * thirst(kind); };
        KINDS.forEach(function (kind) {
          if (kind === p.kind || !(o.tech[kind] >= 1) || card.refuses.indexOf(kind) >= 0 || worth(c, p.x, p.y, kind) < 1) return;
          var gain = value(kind) / value(p.kind);
          if (gain >= RULES.convert.gain && (!turn || gain > turn.gain + 1e-9)) turn = { gain: gain, p: p, kind: kind };
        });
      });
      if (!turn) return null;
      return { move: 'convert', x: turn.p.x, y: turn.p.y, kind: turn.kind, from: turn.p.kind, name: D.SITES[turn.kind].name, cost: Math.round(RULES.convert.cost * price(c, capo, turn.kind)),
               why: zoneOf(c, turn.p.x, turn.p.y).name + ' suits ' + R.a(D.SITES[turn.kind].name.toLowerCase()) + ' far better than his ' + D.SITES[turn.p.kind].name.toLowerCase() };
    };
    // the order he tries them in: his own, or the one the boss's line asks for
    var order = o.line === 'earn' ? [converts, grows, opens, takes] : o.line === 'low' ? [opens, converts, grows] : [opens, converts, takes, grows];
    for (var i = 0; i < order.length; i++) { var w = order[i](); if (w) return w; }
    return null;
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
      return { x: p.x, y: p.y, capo: p.capo, most: site(p).wash * worth(c, p.x, p.y, p.kind) * (1 + (p.level - 1) * 1.5) * (can(c, p.capo, 'ledgers') ? 1.25 : 1) * ((c.board && c.board.wash) || 1), loss: site(p).loss };
    }).sort(function (a, b) { return a.loss - b.loss; });
  }

  var api = { liquor: liquor, CHAINS: CHAINS, loadOfCargo: loadOfCargo, supplied: supplied, cellars: cellars, ambush: ambush, CARGOES: CARGOES,
      distil: distil, haulDay: haulDay, earns: earns, income: income, wages: wages, clubWages: clubWages, idlePlaces: idlePlaces, leftPay: leftPay, collect: collect, pass: pass, today: today, tripDays: tripDays, fleet: fleet, carId: carId, chokes: chokes, busy: busy, wayOf: wayOf, takes: takes,
      wants: wants, washing: washing, laundries: laundries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfGoods = api;
})(typeof self !== 'undefined' ? self : this);
