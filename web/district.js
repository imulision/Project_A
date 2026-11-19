// Rules for one district run by a capo. No drawing and no browser here.
//
// The boss only names the capo. Each month the capo looks at his district,
// picks one project (chooseProject), and then the month plays out
// (stepMonth): production, sales, wages, the boss's cut, laundering, the
// stash, the police and the street.
//
// To retune the game, change RULES, SITES and CAPOS. To teach capos a new
// move, add one entry to PROJECTS. Nothing else needs to change.
(function (root) {
  'use strict';

  var RULES = {
    wage: 40,               // dirty $ per man per month
    upkeep: 50,             // dirty $ per place per month
    crate: 40,              // $ per crate sold in a speakeasy
    demand: 170,            // crates a month the whole district can drink
    tribute: 0.30,          // share of the month's profit owed to the boss
    cleanTributeShare: 0.5, // how much of the month's laundering may go to the boss
    stash: 1500,            // dirty $ a district can hide without a warehouse
    stashPerWarehouse: 1000,
    spill: 0.25,            // share of the overflow lost every month
    spillHeat: 400,         // overflow $ per point of Heat
    cellar: 40,             // crates kept without a warehouse
    cellarPerWarehouse: 150,
    washReserve: 900,       // dirty $ kept at hand on top of the payroll
    raidHeat: 60,
    raidSeizure: 500,
    raidCooling: 18,
    watch: 6,               // months a raided district is watched: nobody makes noise
    thinProfit: 150,        // below this monthly profit, conquest is a luxury
    cooling: 3,             // Heat lost every month on its own
    rivalPush: 1.0,         // streets the rivals take back every month
    rivalNotice: 30,        // below this share, the rivals push back less and less
    rivalWall: 60,          // above this share, every street is fought for
    rivalWallStep: 5,       // one more street lost per month for each of these points above the wall
    lastStand: 25,          // below this share, a capo posts guards
    guardHold: 0.25,        // streets held per guard, under a capo of average Muscle
    charm: 0.2,             // Goodwill per month per point of Charisma above 5
    goodwillPull: 0.08,     // share of the gap to 50 that Goodwill closes by itself every month
    pullBack: 6,            // months a capo waits before sending out men he has just called back
    crewReach: 0.2,         // streets gained per street crew per point of Muscle
    crewMuscle: 4,          // a crew's own worth, under a capo with less Muscle than that
    idleMen: 3,             // more idle men than this are sent home when the district barely pays
    grudge: 15,             // points of Loyalty a capo forgets for every time the boss told him no
    hireFee: 60,
    likes: 1.5,             // a project the capo likes counts this much more
    minNeed: 3,             // below this, a project is not worth a month
    protectionTake: 260,    // per collector crew when half the district is held
    bribe: 200,
    rent: 80,
    seizeGoodwill: 6,
    seizeHeat: 5,
    pushHeat: 2,
    exportBonus: 0.3,       // extra income on what leaves town when the family runs the routes
    familyWash: 300,        // dirty $ a month the family's bookkeeper washes for a district
    fixerCooling: 2,        // Heat lost every month when the family's fixer works the city
    racketNeed: 3           // how much a capo wants a racket in a district made for it
  };

  // What a place costs, who works there, and what it does every month.
  var SITES = {
    still:     { name: 'Cellar still',   cost: 400,  cur: 'dirty', staff: 2, heat: 0.5,  goodwill: 0,    crates: 20 },
    speakeasy: { name: 'Speakeasy',      cost: 600,  cur: 'dirty', staff: 3, heat: 0.5,  goodwill: 0.6,  seats: 28 },
    gambling:  { name: 'Gambling room',  cost: 500,  cur: 'dirty', staff: 2, heat: 1,    goodwill: 0,    income: 420, skill: 'business' },
    loft:      { name: 'Cannabis loft',  cost: 700,  cur: 'dirty', staff: 2, heat: 2,    goodwill: -0.5, income: 600 },
    rented:    { name: 'Rented laundry', cost: 300,  cur: 'dirty', staff: 1, heat: 0,    goodwill: 0,    wash: 300, loss: 0.25 },
    front:     { name: 'Owned front',    cost: 1000, cur: 'clean', staff: 1, heat: -0.5, goodwill: 0.5,  wash: 500, loss: 0.15 },
    warehouse: { name: 'Warehouse',      cost: 1200, cur: 'clean', staff: 1, heat: 0,    goodwill: 0 },
    // The other rackets. `trait` is what the district must be good for,
    // `skill` the stat of the capo that makes it pay, `exports` what leaves town.
    brothel:   { name: 'Brothel',        cost: 800,  cur: 'dirty', staff: 3, heat: 1.5,  goodwill: -1,   income: 700, trait: 'nightlife', secrets: 1 },
    chopshop:  { name: 'Chop shop',      cost: 700,  cur: 'dirty', staff: 3, heat: 1.5,  goodwill: -0.5, income: 500, trait: 'industry', skill: 'cunning', exports: true },
    fence:     { name: 'Fence',          cost: 500,  cur: 'dirty', staff: 2, heat: 1,    goodwill: 0,    income: 450, trait: 'port', skill: 'business', exports: true },
    loans:     { name: 'Loan office',    cost: 600,  cur: 'dirty', staff: 2, heat: 0.5,  goodwill: -1,   income: 400, trait: 'wealth', skill: 'muscle' },
    union:     { name: 'Union local',    cost: 900,  cur: 'dirty', staff: 2, heat: 0.5,  goodwill: 0.5,  income: 350, trait: 'industry', skill: 'charisma' }
  };
  var RACKETS = ['brothel', 'chopshop', 'fence', 'loans', 'union'];
  var SITE_KEYS = Object.keys(SITES);
  var CREW = { street: { men: 3, heat: 1, goodwill: -0.5 }, protection: { men: 2, heat: 1, goodwill: -1.5 } };
  var RAID_ORDER = ['loft', 'brothel', 'chopshop', 'fence', 'speakeasy', 'still']; // a speakeasy is only shut if another remains

  var CAPOS = {
    sal:   { name: 'Sal "the Hammer" Moretti', specialty: 'Enforcer', muscle: 8, business: 4, cunning: 3, charisma: 6, loyalty: 65, ambition: 70,
             likes: ['protection', 'seize', 'push', 'loans'], refuses: ['bribe'] },
    mae:   { name: 'Mae "the Ledger" Whitlock', specialty: 'Bookkeeper', muscle: 2, business: 8, cunning: 8, charisma: 4, loyalty: 70, ambition: 40,
             likes: ['front', 'rented', 'bribe'], refuses: ['protection', 'seize', 'loft', 'brothel'] },
    dutch: { name: 'Dutch Keller', specialty: 'Bootlegger', muscle: 5, business: 7, cunning: 5, charisma: 3, loyalty: 55, ambition: 50,
             likes: ['still', 'speakeasy', 'warehouse', 'fence'], refuses: ['protection'] },
    tommy: { name: 'Tommy "the Priest" Byrne', specialty: 'Politician', muscle: 3, business: 5, cunning: 6, charisma: 9, loyalty: 80, ambition: 30,
             likes: ['speakeasy', 'gambling', 'bribe', 'union'], refuses: ['loft', 'seize', 'brothel'] },
    vince: { name: 'Vince "Three-Fingers" Kowalski', specialty: 'Pusher', muscle: 7, business: 3, cunning: 6, charisma: 3, loyalty: 45, ambition: 80,
             likes: ['loft', 'push', 'seize', 'chopshop'], refuses: ['front'] },
    danny: { name: 'Danny "the Kid" Reyes', specialty: 'Gambler', muscle: 5, business: 6, cunning: 4, charisma: 6, loyalty: 60, ambition: 90,
             likes: ['gambling', 'push', 'loft', 'brothel'], refuses: [] }
  };

  function capoOf(d) { return CAPOS[d.capo]; }
  // The Heat at which a capo stops making noise. The ambitious go past the raid line.
  function nerve(c) { return 30 + c.ambition / 2; }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function trade(c) { return 0.8 + 0.04 * c.business; }
  function craft(c) { return 0.6 + 0.05 * c.cunning; }
  function payroll(d) { return d.men * RULES.wage; }
  function stashRoom(d) { return RULES.stash + RULES.stashPerWarehouse * d.sites.warehouse; }
  function made(d) { return d.sites.still * SITES.still.crates * trade(capoOf(d)); }
  function seats(d) { return d.sites.speakeasy * SITES.speakeasy.seats; }
  function thirst(d) { return RULES.demand * d.share / 100; }
  function washing(d) {
    return (d.sites.rented * SITES.rented.wash + d.sites.front * SITES.front.wash) * craft(capoOf(d))
      + (d.support.bookkeeper ? RULES.familyWash : 0);
  }
  function skillOf(c, site) { return site.skill ? 0.8 + 0.04 * c[site.skill] : 1; }
  // The liquor comes first: no capo branches out while his speakeasies run dry.
  function liquorSettled(d) {
    return made(d) >= Math.min(thirst(d), seats(d)) - 8 && seats(d) >= Math.min(thirst(d), made(d) + 10) - 8;
  }
  // Everything the district brings in this month except the liquor.
  function sideIncome(d) {
    var total = d.collectors * RULES.protectionTake * d.share / 50;
    SITE_KEYS.forEach(function (k) { total += d.sites[k] * placeIncome(d, k); });
    return total;
  }
  // What one place of that kind brings in a month, liquor apart.
  function placeIncome(d, k) {
    var s = SITES[k];
    if (!s.income) return 0;
    return s.income * (s.trait ? d.traits[s.trait] : 1) * skillOf(capoOf(d), s) * (s.exports && d.support.routes ? 1 + RULES.exportBonus : 1);
  }
  // What the district would bring in this month, liquor included, without changing it.
  function income(d) {
    return Math.min(d.stock + made(d), seats(d), thirst(d)) * RULES.crate + sideIncome(d);
  }
  // The rivals do not bother with a family that holds only a few streets.
  function rivalPush(d) {
    return RULES.rivalPush * Math.min(1, d.share / RULES.rivalNotice) + Math.max(0, d.share - RULES.rivalWall) / RULES.rivalWallStep;
  }
  function siteCount(d) { return SITE_KEYS.reduce(function (n, k) { return n + d.sites[k]; }, 0); }

  function busyMen(d) {
    var n = d.guards + d.crews * CREW.street.men + d.collectors * CREW.protection.men;
    SITE_KEYS.forEach(function (k) { n += d.sites[k] * SITES[k].staff; });
    return n;
  }

  function open(kind) {
    return function (d) { d.sites[kind] += 1; };
  }
  function build(kind, label, why, need) {
    return { kind: kind, label: label, why: why, cost: SITES[kind].cost, cur: SITES[kind].cur, men: SITES[kind].staff, hot: SITES[kind].heat > 0, need: need, apply: open(kind) };
  }
  function racket(kind, label, why) {
    var site = SITES[kind];
    return build(kind, label, why, function (d) {
      var fit = d.traits[site.trait];
      if (fit < 0.5 || d.sites[kind] >= Math.round(2 * fit)) return 0;
      if (!liquorSettled(d) || d.profit < RULES.thinProfit) return 0;
      return RULES.racketNeed * fit;
    });
  }
  function stashFull(d) { return d.dirty > 0.7 * stashRoom(d) && d.sites.warehouse < 2; }
  function washShort(d) { return washing(d) < 0.6 * Math.max(d.profit, 300); }
  function cashPiling(d) { return d.dirty > 0.4 * stashRoom(d); }

  // Everything a capo can decide to do with a month. `need` says how badly
  // the district calls for it (0 = not at all); the capo's tastes do the rest.
  // Order matters only to break ties: the first of two equal needs wins.
  var PROJECTS = [
    { kind: 'push', label: 'Sends 3 men to take new streets', why: 'there are streets left to take', cost: 0, cur: 'dirty', men: CREW.street.men, hot: true,
      need: function (d, c) {
        if (d.pulledBack > 0) return 0;
        if (d.profit < RULES.thinProfit && d.share >= 30) return 0;
        if (d.share < 85 && c.muscle >= 4 && d.crews < 4) return 4;
        return d.share < 30 && d.crews < 1 ? 3 : 0;
      },
      apply: function (d) { d.crews += 1; d.heat += RULES.pushHeat; } },
    { kind: 'protection', label: 'Puts 2 men on protection', why: 'the shops on his streets pay nothing yet', cost: 0, cur: 'dirty', men: CREW.protection.men, hot: true,
      need: function (d) { return d.collectors < Math.min(3, d.crews + 1) ? 5 : 0; },
      apply: function (d) { d.collectors += 1; } },
    build('still', 'Sets up a cellar still', 'the speakeasies run dry',
      function (d) { return made(d) < Math.min(thirst(d), seats(d) + 10) - 8 ? 6 : 0; }),
    build('speakeasy', 'Turns a shop into a speakeasy', 'more drinkers than seats',
      function (d) { return seats(d) < Math.min(thirst(d), made(d) + 10) - 8 ? 6 : 0; }),
    build('gambling', 'Opens a gambling room', 'a back room sits empty',
      function (d, c) { return d.sites.gambling < d.sites.speakeasy ? 3 + c.business / 4 : 0; }),
    build('loft', 'Installs a cannabis loft', 'easy margin while the street is quiet',
      function (d) { return d.heat < 45 && d.sites.loft < 2 ? 3 : 0; }),
    racket('brothel', 'Opens a brothel', 'the night trade is there for the taking'),
    racket('chopshop', 'Sets up a chop shop', 'cars are easy money in a district of garages'),
    racket('fence', 'Sets up a fence for hijacked goods', 'too much comes off the ships to ignore'),
    racket('loans', 'Opens a loan office', 'people here have something to lose'),
    racket('union', 'Takes over a union local', 'the factories can be made to pay'),
    { kind: 'seize', label: 'Takes a warehouse by force', why: 'the stash is full, and he takes room rather than pay for it', cost: 0, cur: 'dirty', men: SITES.warehouse.staff, hot: true,
      need: function (d) { return stashFull(d) ? 6 : 0; },
      apply: function (d) { d.sites.warehouse += 1; d.goodwill -= RULES.seizeGoodwill; d.heat += RULES.seizeHeat; } },
    build('warehouse', 'Buys a warehouse', 'the stash is full',
      function (d) { return stashFull(d) ? 4 : 0; }),
    build('front', 'Buys a laundry as a front', 'clean money buys a better laundry',
      function (d) { return !washShort(d) ? 0 : cashPiling(d) ? 6 : 3; }),
    build('rented', 'Rents a laundry under another name', 'dirty money outruns the laundering',
      function (d) { return washShort(d) && cashPiling(d) && d.clean < 1000 ? 5 : 0; }),
    { kind: 'bribe', label: 'Puts the precinct on the payroll', why: 'the police are getting close', cost: RULES.bribe, cur: 'dirty', men: 0,
      need: function (d) { return d.heat > 40 && !d.bribing ? 6 : 0; },
      apply: function (d) { d.bribing = true; } },
    { kind: 'guard', label: 'Posts 2 more guards', why: 'the rivals are at his door', cost: 0, cur: 'dirty', men: 2,
      need: function (d) {
        if (d.attacked > 0 && d.guards < 6) return 9; // he has just been hit
        return d.share < RULES.lastStand && streetsChange(d) < 0 && d.guards < 8 ? 5 : 0;
      },
      apply: function (d) { d.guards += 2; } },
    { kind: 'lielow', label: 'Pulls men off the street', why: 'the police are watching', cost: 0, cur: 'dirty', men: 0,
      need: function (d, c) { return (d.watched > 0 || d.heat > nerve(c)) && d.heat > 45 && d.crews + d.collectors > 0 ? 6 : 0; },
      apply: function (d) { if (d.collectors > 0) d.collectors -= 1; else d.crews -= 1; d.pulledBack = RULES.pullBack; } },
    { kind: 'recall', label: 'Calls a street crew back', why: 'the district does not pay for conquest', cost: 0, cur: 'dirty', men: 0,
      need: function (d) { return d.crews === 0 ? 0 : d.profit < 0 ? 7 : d.profit < RULES.thinProfit ? 4 : 0; },
      apply: function (d) { d.crews -= 1; d.pulledBack = RULES.pullBack; } },
    { kind: 'trim', label: 'Lets idle men go', why: 'the district loses money', cost: 0, cur: 'dirty', men: 0,
      need: function (d) {
        var idle = d.men - busyMen(d);
        return idle > 0 && d.profit < 0 ? 8 : idle > RULES.idleMen && d.profit < RULES.thinProfit ? 3 : 0;
      },
      apply: function (d) { d.men -= Math.ceil((d.men - busyMen(d)) / 2); } }
  ];

  function canHire(d, p, n, wages) {
    var spent = (p.cur === 'dirty' ? p.cost : 0) + n * RULES.hireFee;
    return d.profit > n * RULES.wage && d.dirty - spent >= wages ? n : 0;
  }

  function hold(why) { return { kind: 'hold', label: 'Holds steady', why: why, cost: 0, cur: 'dirty', men: 0, hire: 0 }; }

  // The capo's choice for the month. Pure: it reads the district and returns
  // what he would do and why, without changing anything.
  function chooseProject(d) {
    var c = capoOf(d), wages = payroll(d), free = d.men - busyMen(d), wanted = [], shortOfMen = false;
    PROJECTS.forEach(function (p, order) {
      if (c.refuses.indexOf(p.kind) >= 0) return;
      if (p.hot && (d.watched > 0 || d.heat > nerve(c))) return;
      var weight = p.need(d, c) * (c.likes.indexOf(p.kind) >= 0 ? RULES.likes : 1);
      var affordable = p.cost === 0 || d[p.cur] - p.cost >= (p.cur === 'dirty' ? wages : 0);
      if (weight >= RULES.minNeed && affordable) wanted.push({ p: p, weight: weight, order: order });
    });
    wanted.sort(function (a, b) { return b.weight - a.weight || a.order - b.order; });
    for (var i = 0; i < wanted.length; i++) {
      var p = wanted[i].p, hire = 0;
      if (free < p.men) {
        // he brings in a whole crew if he can pay for it, otherwise just the men the job needs
        hire = canHire(d, p, Math.max(2 + Math.floor(c.charisma / 3), p.men - free), wages) || canHire(d, p, p.men - free, wages);
        if (!hire) { shortOfMen = true; continue; }
      }
      return { kind: p.kind, label: p.label, why: p.why, cost: p.cost, cur: p.cur, men: p.men, hire: hire };
    }
    return hold(shortOfMen ? 'wants more men but cannot pay them' : 'nothing worth the money this month');
  }

  function projectOf(kind) {
    for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].kind === kind) return PROJECTS[i];
    return null;
  }

  function decide(d) {
    var pick = chooseProject(d);
    if (pick.kind !== 'hold') {
      d.men += pick.hire;
      d.dirty -= pick.hire * RULES.hireFee;
      d[pick.cur] -= pick.cost;
      projectOf(pick.kind).apply(d);
    }
    return { type: 'decision', kind: pick.kind, label: pick.label, why: pick.why, hired: pick.hire };
  }

  function sell(d, c) {
    d.stock += made(d);
    var sold = Math.min(d.stock, seats(d), thirst(d));
    d.stock = Math.min(d.stock - sold, RULES.cellar + RULES.cellarPerWarehouse * d.sites.warehouse);
    var income = sold * RULES.crate + sideIncome(d);
    var costs = payroll(d) + siteCount(d) * RULES.upkeep + d.sites.rented * RULES.rent + (d.bribing ? RULES.bribe : 0);
    return { sold: sold, income: income, costs: costs, profit: income - costs };
  }

  function launder(d, c) {
    var washed = Math.max(0, Math.min(washing(d), d.dirty - payroll(d) - RULES.washReserve));
    var loss = d.sites.front > 0 || d.support.bookkeeper ? SITES.front.loss : SITES.rented.loss;
    d.dirty -= washed;
    d.clean += washed * (1 - loss);
    return { washed: washed, washLoss: washed * loss, cleaned: washed * (1 - loss) };
  }

  function raid(d) {
    var site = null;
    for (var i = 0; i < RAID_ORDER.length && !site; i++) {
      var k = RAID_ORDER[i];
      if (d.sites[k] > (k === 'speakeasy' ? 1 : 0)) site = k;
    }
    var seized = Math.min(d.dirty, RULES.raidSeizure);
    if (site) d.sites[site] -= 1;
    d.dirty -= seized;
    d.lost += seized;
    d.heat -= RULES.raidCooling;
    d.raids += 1;
    d.watched = RULES.watch + 1; // counted down at the end of this same month
    var arrested = 0;
    if (d.crews > 0) { d.crews -= 1; arrested = CREW.street.men; }
    else if (d.collectors > 0) { d.collectors -= 1; arrested = CREW.protection.men; }
    d.men -= arrested;
    return { type: 'raid', site: site, seized: seized, arrested: arrested, label: 'Police raid: ' + (site ? 'a ' + SITES[site].name.toLowerCase() + ' is shut, ' : '') + (arrested ? arrested + ' men arrested, ' : '') + '$' + Math.round(seized) + ' seized' };
  }

  // How much the neighbourhood warms to the family this month.
  function goodwillChange(d) {
    var c = capoOf(d), change = d.crews * CREW.street.goodwill + d.collectors * CREW.protection.goodwill;
    SITE_KEYS.forEach(function (k) { change += d.sites[k] * SITES[k].goodwill; });
    return change + (c.charisma - 5) * RULES.charm - (d.goodwill - 50) * RULES.goodwillPull;
  }

  // Streets gained or lost this month, in points of the district.
  function streetsChange(d) {
    var c = capoOf(d);
    return d.crews * Math.max(c.muscle, RULES.crewMuscle) * RULES.crewReach + (d.goodwill - 50) / 30 - rivalPush(d)
      + d.guards * RULES.guardHold * (0.5 + c.muscle / 10);
  }

  // One month of the district. Changes `d` and returns what happened.
  function stepMonth(d) {
    var c = capoOf(d), events = [decide(d)];
    var m = sell(d, c);
    d.profit = m.profit;

    // the boss's cut, less what the capo keeps for himself
    var owed = Math.max(0, m.profit) * RULES.tribute;
    var skim = owed * Math.min(100, 100 - c.loyalty + RULES.grudge * d.grudge) / 250;
    d.dirty += m.profit - owed;
    var w = launder(d, c);
    var paid = owed - skim;
    var paidClean = Math.min(paid, w.cleaned * RULES.cleanTributeShare);
    d.clean -= paidClean;
    d.dirty += paidClean; // he keeps the dirty dollars he would have sent
    d.boss.clean += paidClean;
    d.boss.dirty += paid - paidClean;

    SITE_KEYS.forEach(function (k) { if (SITES[k].secrets) d.secrets += d.sites[k] * SITES[k].secrets; });

    // too much dirty money
    var overflow = Math.max(0, d.dirty - stashRoom(d));
    var spilled = overflow * RULES.spill;
    d.dirty -= spilled;
    d.lost += spilled + skim + w.washLoss;

    // men who are not paid walk away
    if (d.dirty < 0) {
      var idle = d.men - busyMen(d);
      if (idle > 0) { d.men -= idle; events.push({ type: 'unpaid', left: idle, label: idle + ' unpaid men walk away' }); }
      d.dirty = 0;
    }

    // the police
    var heat = -RULES.cooling - (d.support.fixer ? RULES.fixerCooling : 0) + overflow / RULES.spillHeat + d.crews * CREW.street.heat + d.collectors * CREW.protection.heat;
    SITE_KEYS.forEach(function (k) { heat += d.sites[k] * SITES[k].heat; });
    if (d.bribing) heat -= 2 + c.cunning / 2;
    d.heat = clamp(d.heat + heat);
    var raided = null;
    if (d.heat >= RULES.raidHeat) {
      raided = raid(d);
      events.push(raided);
    }

    // the street
    d.goodwill = clamp(d.goodwill + goodwillChange(d));
    d.share = clamp(d.share + streetsChange(d));

    if (d.pulledBack > 0) d.pulledBack -= 1;
    if (d.attacked > 0) d.attacked -= 1;
    if (d.watched > 0) d.watched -= 1;
    d.month += 1;
    d.last = { sold: m.sold, income: m.income, costs: m.costs, profit: m.profit, owed: owed, skim: skim,
               washed: w.washed, washLoss: w.washLoss, overflow: overflow, spilled: spilled,
               decision: events[0].kind, raid: raided ? raided.site || 'none' : null };
    return events;
  }

  function createDistrict(options) {
    var o = options || {};
    if (!CAPOS[o.capo]) throw new Error('unknown capo: ' + o.capo);
    var d = {
      name: 'Hillside', capo: o.capo, month: 0,
      men: 14, guards: 2, crews: 0, collectors: 0,
      sites: {},
      traits: { nightlife: 1, industry: 0.4, port: 0, wealth: 1.2 }, // a hill of houses above the city
      support: { bookkeeper: false, routes: false, fixer: false },   // what the family's table does for him
      dirty: 800, clean: 300, profit: 800, stock: 0, secrets: 0,
      heat: 30, goodwill: 50, share: 35, bribing: false,
      boss: { dirty: 0, clean: 0 }, lost: 0, raids: 0, watched: 0, pulledBack: 0, attacked: 0, grudge: 0, last: null
    };
    SITE_KEYS.forEach(function (k) { d.sites[k] = 0; });
    d.sites.still = 2; d.sites.speakeasy = 2;
    Object.keys(o).forEach(function (k) {
      if (k === 'sites' || k === 'traits' || k === 'support') Object.keys(o[k]).forEach(function (s) { d[k][s] = o[k][s]; });
      else if (k in d) d[k] = o[k];
    });
    return d;
  }

  // The flows the map can show, and the flow each kind of trip belongs to.
  var FLOWS = ['logistics', 'sales', 'money', 'building', 'violence'];
  var FLOW_OF = { liquor: 'logistics', takings: 'sales', laundering: 'money', tribute: 'money', works: 'building',
                  streets: 'violence', collection: 'violence', seizure: 'violence', raid: 'violence', attack: 'violence' };

  // Last month's chain in figures: what was made, what waits in the cellar,
  // what was sold and what held sales back, then where the money went.
  function flows(d) {
    var m = d.last || { sold: 0, income: 0, costs: 0, profit: 0, washed: 0, owed: 0, skim: 0, spilled: 0 };
    var limit = thirst(d) <= seats(d) && thirst(d) <= d.stock + made(d) ? 'drinkers' : seats(d) <= d.stock + made(d) ? 'seats' : 'stills';
    return { made: d.last ? made(d) : 0, stock: d.stock, sold: m.sold, seats: seats(d), drinkers: thirst(d), limit: limit,
             income: m.income, costs: m.costs, profit: m.profit, washed: m.washed, tribute: m.owed - m.skim, kept: m.skim, spilled: m.spilled };
  }

  function slugOf(d) { return d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  // What moved in the district last month, for the map to show: one entry per
  // trip, from a place to a place. Ends are building ids (see buildings) or
  // 'hideout', 'streets', 'shops', 'boss', 'police'. Nothing here decides
  // anything: it only tells again what stepMonth did.
  function trips(d) {
    var m = d.last, list = [];
    if (!m) return list;
    var id = function (kind, n) { return slugOf(d) + '-' + kind + '-' + n; };
    var add = function (kind, from, to, vehicle, more) {
      var t = { kind: kind, flow: FLOW_OF[kind], from: from, to: to, vehicle: vehicle, violent: false };
      Object.keys(more || {}).forEach(function (k) { t[k] = more[k]; });
      list.push(t);
    };
    var i, bars = d.sites.speakeasy;
    if (m.sold > 0) {
      for (i = 1; i <= bars; i++) {
        add('liquor', d.sites.still ? id('still', (i - 1) % d.sites.still + 1) : 'hideout', id('speakeasy', i), 'truck', { crates: m.sold / bars });
      }
    }
    SITE_KEYS.forEach(function (k) {
      if (k !== 'speakeasy' && !SITES[k].income) return;
      var amount = k === 'speakeasy' ? m.sold * RULES.crate / bars : placeIncome(d, k);
      for (var n = 1; n <= d.sites[k]; n++) add('takings', id(k, n), 'hideout', 'car', { amount: amount });
    });
    if (m.washed > 0) {
      var laundry = d.sites.front ? id('front', 1) : d.sites.rented ? id('rented', 1) : 'boss'; // 'boss': the family's bookkeeper
      add('laundering', 'hideout', laundry, 'car', { amount: m.washed });
    }
    if (m.owed - m.skim > 0) add('tribute', 'hideout', 'boss', 'car', { amount: m.owed - m.skim });
    for (i = 0; i < d.crews; i++) add('streets', 'hideout', 'streets', 'car', { men: CREW.street.men, violent: true });
    for (i = 0; i < d.collectors; i++) add('collection', 'hideout', 'shops', 'car', { men: CREW.protection.men, violent: true, amount: RULES.protectionTake * d.share / 50 });
    if (SITES[m.decision] && d.sites[m.decision] > 0) add('works', 'hideout', id(m.decision, d.sites[m.decision]), 'truck');
    if (m.decision === 'seize' && d.sites.warehouse > 0) {
      add('seizure', 'hideout', id('warehouse', d.sites.warehouse), 'car', { men: SITES.warehouse.staff, violent: true });
    }
    if (m.raid) add('raid', 'police', SITES[m.raid] ? id(m.raid, d.sites[m.raid] + 1) : 'hideout', 'police', { violent: true });
    return list;
  }

  // What the map needs to draw the district: one entry per building.
  function buildings(d) {
    var list = [], slug = slugOf(d);
    SITE_KEYS.forEach(function (k) {
      for (var i = 1; i <= d.sites[k]; i++) {
        list.push({ id: slug + '-' + k + '-' + i, district: d.name, capo: d.capo, type: k, name: SITES[k].name, staff: SITES[k].staff, level: 1 });
      }
    });
    return list;
  }

  var api = { RULES: RULES, SITES: SITES, CAPOS: CAPOS, PROJECTS: PROJECTS, createDistrict: createDistrict,
              chooseProject: chooseProject, stepMonth: stepMonth, buildings: buildings, busyMen: busyMen, nerve: nerve, income: income, sideIncome: sideIncome, RACKETS: RACKETS,
              goodwillChange: goodwillChange, streetsChange: streetsChange, trips: trips, flows: flows, FLOWS: FLOWS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportDistrict = api;
})(typeof self !== 'undefined' ? self : this);
