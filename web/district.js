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
    levelGain: 0.5,         // what each level above the first adds to what a still makes or a speakeasy seats
    maxLevel: 3,
    enlargeFrom: 3,         // with this many places of a kind, a capo enlarges them rather than open another
    enlargeCost: 200,       // dirty $ per place and per level already reached
    truckLoad: 30,          // crates one truck hauls from the stills to the speakeasies in a month
    truckCost: 300,
    carLoad: 1500,          // dirty $ one car brings back from the tills in a month
    carCost: 200,
    vehicleUpkeep: 20,      // dirty $ per truck or car per month
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
    idleMen: 1,             // more idle men than this are sent home when the district barely pays
    grudge: 15,             // points of Loyalty a capo forgets for every time the boss told him no
    rankPride: 3,           // points of Loyalty a capo forgets for every rank he has risen
    hated: 15,              // below this Goodwill, a capo eases off the shops
    shopsWorth: 30,         // below this share, there are too few shops to make collectors pay
    maxGuards: 14,          // no capo turns his district into a barracks beyond this
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

  // The wheel of what a family can learn: six sectors of three abilities.
  // A capo unlocks them as he rises in rank (see world.js); `effect` is what
  // an ability changes in the district of the man who holds it.
  var SECTORS = ['liquor', 'vice', 'money', 'law', 'muscle', 'routes'];
  var WHEEL = {
    liquor: [{ id: 'bonded-trucks',   name: 'Bonded trucks',    text: 'Liquor sells 10% dearer',                  effect: { crate: 0.1 } },
             { id: 'distillery',      name: 'Distillery',       text: 'Stills make 40% more',                     effect: { stills: 0.4 } },
             { id: 'import-whisky',   name: 'Imported whisky',  text: 'Liquor sells 25% dearer',                  effect: { crate: 0.25 } }],
    vice:   [{ id: 'house-odds',      name: 'House odds',       text: 'Gambling, cannabis and brothels pay 20% more', effect: { vice: 0.2 } },
             { id: 'high-rollers',    name: 'High rollers',     text: 'Vice pays 30% more',                       effect: { vice: 0.3 } },
             { id: 'private-clubs',   name: 'Private clubs',    text: 'Vice pays 40% more',                       effect: { vice: 0.4 } }],
    money:  [{ id: 'double-books',    name: 'Double books',     text: 'Laundries wash 30% more',                  effect: { wash: 0.3 } },
             { id: 'shell-companies', name: 'Shell companies',  text: 'Laundering loses 5 points less',           effect: { washLoss: -0.05 } },
             { id: 'friendly-bank',   name: 'A friendly bank',  text: 'Laundries wash 60% more',                  effect: { wash: 0.6 } }],
    law:    [{ id: 'beat-cops',       name: 'Beat cops paid',   text: 'Heat falls 1 point faster every month',    effect: { cooling: 1 } },
             { id: 'bought-judge',    name: 'A bought judge',   text: 'Raids seize half as much',                 effect: { seizure: -0.5 } },
             { id: 'city-hall',       name: 'City Hall',        text: 'Heat falls 2 points faster every month',   effect: { cooling: 2 } }],
    muscle: [{ id: 'armed-crews',     name: 'Armed crews',      text: 'Street crews take 25% more streets',       effect: { reach: 0.25 } },
             { id: 'hired-guns',      name: 'Hired guns',       text: 'Guards hold 50% more streets',             effect: { hold: 0.5 } },
             { id: 'death-squad',     name: 'Death squad',      text: 'Street crews take 50% more streets',       effect: { reach: 0.5 } }],
    routes: [{ id: 'night-convoys',   name: 'Night convoys',    text: 'Chop shops and fences pay 30% more',       effect: { exports: 0.3 } },
             { id: 'armoured-trucks', name: 'Armoured trucks',  text: 'The stash holds 50% more dirty money',     effect: { stash: 0.5 } },
             { id: 'rail-contacts',   name: 'Rail contacts',    text: 'Chop shops and fences pay 50% more',       effect: { exports: 0.5 } }]
  };
  var ABILITIES = {};
  SECTORS.forEach(function (sector) { WHEEL[sector].forEach(function (a, ring) { ABILITIES[a.id] = { sector: sector, ring: ring, ability: a }; }); });
  var VICE = ['gambling', 'loft', 'brothel'];

  // The sum of what the capo's abilities add to one thing (0 if none).
  function gain(d, key) {
    return (d.skills || []).reduce(function (n, id) { return n + (ABILITIES[id].ability.effect[key] || 0); }, 0);
  }
  function price(d) { return RULES.crate * (1 + gain(d, 'crate')); }

  function capoOf(d) { return CAPOS[d.capo]; }
  // A lesser man joins the table of capos without joining the list of big names.
  function addCapo(id, card) {
    if (!CAPOS[id]) Object.defineProperty(CAPOS, id, { value: card, enumerable: false });
    return CAPOS[id];
  }
  // The Heat at which a capo stops making noise. The ambitious go past the raid line.
  function nerve(c) { return 30 + c.ambition / 2; }
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function trade(c) { return 0.8 + 0.04 * c.business; }
  function craft(c) { return 0.6 + 0.05 * c.cunning; }
  function payroll(d) { return d.men * RULES.wage; }
  function stashRoom(d) { return (RULES.stash + RULES.stashPerWarehouse * d.sites.warehouse) * (1 + gain(d, 'stash')); }
  function sizeOf(d, k) { return 1 + RULES.levelGain * ((d.levels[k] || 1) - 1); }
  function made(d) { return d.sites.still * SITES.still.crates * sizeOf(d, 'still') * trade(capoOf(d)) * (1 + gain(d, 'stills')); }
  function hauling(d) { return d.trucks * RULES.truckLoad; }
  function carrying(d) { return d.cars * RULES.carLoad; }
  function seats(d) { return d.sites.speakeasy * SITES.speakeasy.seats * sizeOf(d, 'speakeasy'); }
  function thirst(d) { return RULES.demand * d.share / 100; }
  function washing(d) {
    return (d.sites.rented * SITES.rented.wash * sizeOf(d, 'rented') + d.sites.front * SITES.front.wash * sizeOf(d, 'front')) * craft(capoOf(d)) * (1 + gain(d, 'wash'))
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
    return s.income * sizeOf(d, k) * (s.trait ? d.traits[s.trait] : 1) * skillOf(capoOf(d), s) * (s.exports && d.support.routes ? 1 + RULES.exportBonus : 1)
      * (1 + (VICE.indexOf(k) >= 0 ? gain(d, 'vice') : 0) + (s.exports ? gain(d, 'exports') : 0));
  }
  // What the district would bring in this month, liquor included, without changing it.
  function income(d) {
    return Math.min(Math.min(d.stock + made(d), seats(d), thirst(d), hauling(d)) * price(d) + sideIncome(d), carrying(d));
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

  // The still or the speakeasy a district cannot do without, if it has none.
  function missing(d) { return d.sites.still === 0 ? 'still' : d.sites.speakeasy === 0 ? 'speakeasy' : null; }
  function open(kind) {
    return function (d) { d.sites[kind] += 1; };
  }
  function build(kind, label, why, need) {
    return { kind: kind, site: kind, label: label, why: why, cost: SITES[kind].cost, cur: SITES[kind].cur, men: SITES[kind].staff, hot: SITES[kind].heat > 0, need: need, apply: open(kind),
             saves: kind === 'still' || kind === 'speakeasy' };
  }
  function wantsLiquor(d) { return made(d) < Math.min(thirst(d), seats(d) + 10) - 8; }
  function wantsSeats(d) { return seats(d) < Math.min(thirst(d), made(d) + 10) - 8; }
  // The family's building tree, as this district knows it: 0 = the trade is
  // closed to it, 1 to 3 = the tier its places of that kind can reach.
  function tier(d, kind) { return d.tech[kind] === undefined ? RULES.maxLevel : d.tech[kind]; }
  function locked(d, p) { return !!p.site && tier(d, p.site) < 1; }
  function canEnlarge(d, kind, from) {
    return d.sites[kind] >= (from || RULES.enlargeFrom) && d.levels[kind] < Math.min(RULES.maxLevel, tier(d, kind));
  }
  // Once a capo has as many rooms of a kind as his district can fill, the only way up is bigger rooms.
  function fullOf(d, kind) {
    if (kind === 'gambling') return d.sites.gambling >= d.sites.speakeasy;
    if (kind === 'loft') return d.sites.loft >= 2;
    return d.sites[kind] >= Math.round(2 * d.traits[SITES[kind].trait]);
  }
  function grow(kind, label, why) {
    return { kind: 'enlarge-' + kind, like: kind, site: kind, label: label, why: why, cur: 'dirty', men: 0, hot: false,
             price: function (d) { return RULES.enlargeCost * d.sites[kind] * d.levels[kind]; },
             need: function (d) {
               return canEnlarge(d, kind, 1) && fullOf(d, kind) && liquorSettled(d) && d.profit >= RULES.thinProfit ? 3 : 0; // a new racket comes first
             },
             apply: function (d) { d.levels[kind] += 1; } };
  }
  // Every place of that kind grows one level: no new men, no new address.
  function enlarge(kind, label, why, wants) {
    return { kind: 'enlarge-' + kind, like: kind, site: kind, label: label, why: why, cur: 'dirty', men: 0, hot: false, saves: true,
             price: function (d) { return RULES.enlargeCost * d.sites[kind] * d.levels[kind]; },
             need: function (d) { return canEnlarge(d, kind) && wants(d) ? 6 : 0; },
             apply: function (d) { d.levels[kind] += 1; } };
  }
  function costOf(p, d) { return p.price ? p.price(d) : p.cost; }
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
      need: function (d) { return d.share >= RULES.shopsWorth && d.collectors < Math.min(3, d.crews + 1) ? 5 : 0; },
      apply: function (d) { d.collectors += 1; } },
    { kind: 'truck', label: 'Buys a truck', why: 'liquor sits in the cellar for want of a truck', cost: RULES.truckCost, cur: 'dirty', men: 0,
      need: function (d) { return hauling(d) < Math.min(d.stock + made(d), seats(d), thirst(d)) - 4 ? 10 : 0; },
      apply: function (d) { d.trucks += 1; } },
    { kind: 'car', label: 'Buys a car', why: 'money is left in the tills for want of a car', cost: RULES.carCost, cur: 'dirty', men: 0,
      need: function (d) {
        var earned = Math.min(d.stock + made(d), seats(d), thirst(d), hauling(d)) * price(d) + sideIncome(d);
        return earned > carrying(d) + 100 ? 10 : 0;
      },
      apply: function (d) { d.cars += 1; } },
    build('still', 'Sets up a cellar still', 'the speakeasies run dry',
      function (d) { return wantsLiquor(d) && !canEnlarge(d, 'still') ? 6 : 0; }),
    build('speakeasy', 'Turns a shop into a speakeasy', 'more drinkers than seats',
      function (d) { return wantsSeats(d) && !canEnlarge(d, 'speakeasy') ? 6 : 0; }),
    enlarge('still', 'Enlarges his stills', 'bigger stills rather than one more cellar', wantsLiquor),
    enlarge('speakeasy', 'Enlarges his speakeasies', 'bigger rooms rather than one more door', wantsSeats),
    build('gambling', 'Opens a gambling room', 'a back room sits empty',
      function (d, c) { return d.sites.gambling < d.sites.speakeasy ? 3 + c.business / 4 : 0; }),
    build('loft', 'Installs a cannabis loft', 'easy margin while the street is quiet',
      function (d) { return d.heat < 45 && d.sites.loft < 2 ? 3 : 0; }),
    racket('brothel', 'Opens a brothel', 'the night trade is there for the taking'),
    racket('chopshop', 'Sets up a chop shop', 'cars are easy money in a district of garages'),
    racket('fence', 'Sets up a fence for hijacked goods', 'too much comes off the ships to ignore'),
    racket('loans', 'Opens a loan office', 'people here have something to lose'),
    racket('union', 'Takes over a union local', 'the factories can be made to pay'),
    grow('gambling', 'Enlarges his gambling rooms', 'every back room is taken: bigger tables'),
    grow('loft', 'Enlarges his cannabis lofts', 'no more roofs to use: bigger lofts'),
    grow('brothel', 'Enlarges his brothels', 'the night trade wants bigger houses'),
    grow('chopshop', 'Enlarges his chop shops', 'more cars than his garages can strip'),
    grow('fence', 'Enlarges his fences', 'more goods off the ships than his fences can move'),
    grow('loans', 'Enlarges his loan offices', 'more borrowers than his offices can carry'),
    grow('union', 'Tightens his grip on the union locals', 'the factories can pay more'),
    enlarge('front', 'Enlarges his fronts', 'bigger fronts wash more than one more shop', washShort),
    { kind: 'seize', label: 'Takes a warehouse by force', why: 'the stash is full, and he takes room rather than pay for it', cost: 0, cur: 'dirty', men: SITES.warehouse.staff, hot: true,
      need: function (d) { return stashFull(d) ? 6 : 0; },
      apply: function (d) { d.sites.warehouse += 1; d.goodwill -= RULES.seizeGoodwill; d.heat += RULES.seizeHeat; } },
    build('warehouse', 'Buys a warehouse', 'the stash is full',
      function (d) { return stashFull(d) ? 4 : 0; }),
    build('front', 'Buys a laundry as a front', 'clean money buys a better laundry',
      function (d) { return !washShort(d) || canEnlarge(d, 'front') ? 0 : cashPiling(d) ? 6 : 3; }),
    build('rented', 'Rents a laundry under another name', 'dirty money outruns the laundering',
      function (d) { return washShort(d) && cashPiling(d) && d.clean < 1000 ? 5 : 0; }),
    { kind: 'bribe', label: 'Puts the precinct on the payroll', why: 'the police are getting close', cost: RULES.bribe, cur: 'dirty', men: 0,
      need: function (d) { return d.heat > 40 && !d.bribing ? 6 : 0; },
      apply: function (d) { d.bribing = true; } },
    { kind: 'guard', label: 'Posts 2 more guards', why: 'the rivals are at his door', cost: 0, cur: 'dirty', men: 2,
      need: function (d) {
        if (d.attacked > 0 && d.guards < RULES.maxGuards && (d.guards < 6 || defence(d) < d.threat)) return 9; // he has just been hit
        return d.share < RULES.lastStand && streetsChange(d) < 0 && d.guards < 8 ? 5 : 0;
      },
      apply: function (d) { d.guards += 2; } },
    { kind: 'lielow', label: 'Pulls men off the street', why: 'the police are watching', cost: 0, cur: 'dirty', men: 0,
      need: function (d, c) { return (d.watched > 0 || d.heat > nerve(c)) && d.heat > 45 && d.crews + d.collectors > 0 ? 6 : 0; },
      apply: function (d) { if (d.collectors > 0) d.collectors -= 1; else d.crews -= 1; d.pulledBack = RULES.pullBack; } },
    { kind: 'recall', label: 'Calls a street crew back', why: 'the district does not pay for conquest', cost: 0, cur: 'dirty', men: 0,
      need: function (d) { return d.crews === 0 ? 0 : d.profit < 0 ? 7 : d.profit < RULES.thinProfit ? 4 : 0; },
      apply: function (d) { d.crews -= 1; d.pulledBack = RULES.pullBack; } },
    { kind: 'standdown', label: 'Sends 2 guards home', why: 'the district cannot pay for men who stand at doors', cost: 0, cur: 'dirty', men: 0,
      need: function (d) { return d.profit < 0 && d.guards > 2 && d.attacked === 0 ? 7 : 0; },
      apply: function (d) { d.guards -= 2; } },
    { kind: 'ease', label: 'Takes a collector off the shops', why: 'the street has turned against him', cost: 0, cur: 'dirty', men: 0,
      need: function (d) { return d.goodwill < RULES.hated && d.collectors > 0 && d.profit >= RULES.thinProfit ? 5 : 0; },
      apply: function (d) { d.collectors -= 1; d.pulledBack = RULES.pullBack; } },
    { kind: 'restart', label: 'Starts again with his own money', why: 'the district has nothing left to sell', cost: 0, cur: 'dirty', men: 0,
      need: function (d) {
        var k = missing(d);
        return k && d.dirty < SITES[k].cost ? 11 : 0;
      },
      apply: function (d) {
        var k = missing(d);
        d.sites[k] += 1;
        d.men = Math.max(d.men, busyMen(d)); // he brings the men it takes
      } },
    { kind: 'trim', label: 'Lets idle men go', why: 'the district loses money', cost: 0, cur: 'dirty', men: 0,
      need: function (d) {
        var idle = d.men - busyMen(d);
        return idle > 0 && d.profit < 0 ? 8 : idle > RULES.idleMen && d.profit < RULES.thinProfit ? 3 : 0;
      },
      apply: function (d) { var idle = d.men - busyMen(d); d.men -= d.profit < 0 ? idle : Math.ceil(idle / 2); } }
  ];

  function canHire(d, p, n, wages) {
    var spent = (p.cur === 'dirty' ? costOf(p, d) : 0) + n * RULES.hireFee;
    if (p.saves && d.profit < RULES.thinProfit) return n <= p.men && d.dirty - spent >= 0 ? n : 0; // just the men it takes to save the district
    return d.profit > n * RULES.wage && d.dirty - spent >= wages ? n : 0;
  }

  function hold(why) { return { kind: 'hold', label: 'Holds steady', why: why, cost: 0, cur: 'dirty', men: 0, hire: 0 }; }

  // The capo's choice for the month. Pure: it reads the district and returns
  // what he would do and why, without changing anything.
  function chooseProject(d) {
    var c = capoOf(d), wages = payroll(d), free = d.men - busyMen(d), wanted = [], shortOfMen = false;
    PROJECTS.forEach(function (p, order) {
      if (c.refuses.indexOf(p.like || p.kind) >= 0 || locked(d, p)) return;
      if (p.hot && (d.watched > 0 || d.heat > nerve(c))) return;
      var weight = p.need(d, c) * (c.likes.indexOf(p.like || p.kind) >= 0 ? RULES.likes : 1);
      // the payroll is never spent on a project, except to save a district that barely pays
      var reserve = p.cur !== 'dirty' || (p.saves && d.profit < RULES.thinProfit) ? 0 : wages;
      var cost = costOf(p, d);
      var affordable = cost === 0 || d[p.cur] - cost >= reserve;
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
      return { kind: p.kind, label: p.label, why: p.why, cost: costOf(p, d), cur: p.cur, men: p.men, hire: hire };
    }
    return hold(shortOfMen ? 'wants more men but cannot pay them' : 'nothing worth the money this month');
  }

  // What the capo is after, for the screen: this month's move if he can make
  // one, otherwise the thing he wants most and how far his money is from it.
  function plan(d) {
    var pick = chooseProject(d), c = capoOf(d), wages = payroll(d), best = null;
    if (pick.kind !== 'hold') return { kind: pick.kind, label: pick.label, why: pick.why, cost: pick.cost, saved: pick.cost, progress: 1, waiting: null };
    PROJECTS.forEach(function (p) {
      if (c.refuses.indexOf(p.like || p.kind) >= 0) return;
      var weight = p.need(d, c) * (c.likes.indexOf(p.like || p.kind) >= 0 ? RULES.likes : 1);
      if (weight >= RULES.minNeed && (!best || weight > best.weight)) best = { p: p, weight: weight };
    });
    if (!best) return { kind: 'hold', label: pick.label, why: pick.why, cost: 0, saved: 0, progress: 1, waiting: null };
    if (locked(d, best.p)) {
      return { kind: best.p.kind, site: best.p.site, label: best.p.label, why: 'the family has not learned this trade', cost: costOf(best.p, d), saved: 0, progress: 0, waiting: 'research' };
    }
    var p = best.p, cost = costOf(p, d), hot = !!p.hot && (d.watched > 0 || d.heat > nerve(c));
    var reserve = p.cur !== 'dirty' || (p.saves && d.profit < RULES.thinProfit) ? 0 : wages;
    var saved = Math.max(0, Math.min(cost, d[p.cur] - reserve));
    var short = cost > 0 && saved < cost;
    return { kind: p.kind, label: p.label, why: p.why, cost: cost, saved: saved, progress: short ? saved / cost : 1,
             waiting: hot ? 'heat' : short ? 'money' : 'men' };
  }

  // The closed trade he would open first if the family knew how, or null.
  function wish(d) {
    var c = capoOf(d), best = null;
    PROJECTS.forEach(function (p) {
      if (!locked(d, p) || c.refuses.indexOf(p.like || p.kind) >= 0) return;
      var liked = c.likes.indexOf(p.like || p.kind) >= 0, weight = p.need(d, c) * (liked ? RULES.likes : 1);
      if (weight >= RULES.minNeed && (!best || weight > best.weight)) best = { site: p.site, label: p.label, why: p.why, weight: weight, liked: liked };
    });
    return best;
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
    var sold = Math.min(d.stock, seats(d), thirst(d), hauling(d)); // what no truck carries stays in the cellar
    d.stock = Math.min(d.stock - sold, RULES.cellar + RULES.cellarPerWarehouse * d.sites.warehouse);
    var earned = sold * price(d) + sideIncome(d);
    var income = Math.min(earned, carrying(d)); // what no car comes for is left in the tills
    var costs = payroll(d) + siteCount(d) * RULES.upkeep + (d.trucks + d.cars) * RULES.vehicleUpkeep + d.sites.rented * RULES.rent + (d.bribing ? RULES.bribe : 0);
    return { sold: sold, income: income, uncollected: earned - income, costs: costs, profit: income - costs };
  }

  function launder(d, c) {
    var washed = Math.max(0, Math.min(washing(d), d.dirty - payroll(d) - RULES.washReserve));
    var loss = Math.max(0, (d.sites.front > 0 || d.support.bookkeeper ? SITES.front.loss : SITES.rented.loss) + gain(d, 'washLoss'));
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
    var seized = Math.min(d.dirty, RULES.raidSeizure * (1 + gain(d, 'seizure')));
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

  // What the district can put up when a rival family comes: its guards, worth more under a hard man, and its street crews.
  function defence(d) {
    return d.guards * (0.5 + capoOf(d).muscle / 10) * (1 + gain(d, 'hold')) + d.crews;
  }

  // Streets gained or lost this month, in points of the district.
  function streetsChange(d) {
    var c = capoOf(d);
    return d.crews * Math.max(c.muscle, RULES.crewMuscle) * RULES.crewReach * (1 + gain(d, 'reach')) + (d.goodwill - 50) / 30 - rivalPush(d)
      + d.guards * RULES.guardHold * (1 + gain(d, 'hold')) * (0.5 + c.muscle / 10);
  }

  // One month of the district. Changes `d` and returns what happened.
  function stepMonth(d) {
    var c = capoOf(d), events = [decide(d)];
    var m = sell(d, c);
    d.profit = m.profit;

    // the boss's cut, less what the capo keeps for himself
    var owed = Math.max(0, m.profit) * RULES.tribute;
    var skim = owed * Math.min(100, 100 - c.loyalty + RULES.grudge * d.grudge + (d.paid ? 0 : RULES.rankPride * d.rank)) / 250; // a rank the boss pays for is not held against him
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
    d.lost += spilled + skim + w.washLoss + m.uncollected;

    // men who are not paid walk away
    if (d.dirty < 0) {
      var idle = d.men - busyMen(d);
      if (idle > 0) { d.men -= idle; events.push({ type: 'unpaid', left: idle, label: idle + ' unpaid men walk away' }); }
      d.dirty = 0;
    }

    // the police
    var heat = -RULES.cooling - gain(d, 'cooling') - (d.support.fixer ? RULES.fixerCooling : 0) + overflow / RULES.spillHeat + d.crews * CREW.street.heat + d.collectors * CREW.protection.heat;
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

    // what is rebuilt after the last place of a kind is lost starts small again
    Object.keys(d.levels).forEach(function (k) { if (d.sites[k] === 0) d.levels[k] = 1; });
    if (d.pulledBack > 0) d.pulledBack -= 1;
    if (d.attacked > 0) d.attacked -= 1;
    if (d.watched > 0) d.watched -= 1;
    d.month += 1;
    d.last = { sold: m.sold, uncollected: m.uncollected, income: m.income, costs: m.costs, profit: m.profit, owed: owed, skim: skim,
               washed: w.washed, washLoss: w.washLoss, overflow: overflow, spilled: spilled,
               decision: events[0].kind, raid: raided ? raided.site || 'none' : null };
    return events;
  }

  function createDistrict(options) {
    var o = options || {};
    if (!CAPOS[o.capo]) throw new Error('unknown capo: ' + o.capo);
    var d = {
      name: 'Hillside', capo: o.capo, month: 0,
      men: 14, guards: 2, crews: 0, collectors: 0, trucks: 2, cars: 2,
      sites: {}, levels: {}, tech: {},
      traits: { nightlife: 1, industry: 0.4, port: 0, wealth: 1.2 }, // a hill of houses above the city
      support: { bookkeeper: false, routes: false, fixer: false },   // what the family's table does for him
      dirty: 800, clean: 300, profit: 800, stock: 0, secrets: 0,
      heat: 30, goodwill: 50, share: 35, bribing: false,
      boss: { dirty: 0, clean: 0 }, lost: 0, raids: 0, watched: 0, pulledBack: 0, attacked: 0, threat: 0, grudge: 0, rank: 0, paid: false, skills: [], last: null
    };
    SITE_KEYS.forEach(function (k) { d.sites[k] = 0; d.levels[k] = 1; d.tech[k] = RULES.maxLevel; });
    d.sites.still = 2; d.sites.speakeasy = 2;
    Object.keys(o).forEach(function (k) {
      if (k === 'sites' || k === 'traits' || k === 'support' || k === 'levels' || k === 'tech') Object.keys(o[k]).forEach(function (s) { d[k][s] = o[k][s]; });
      else if (k === 'skills') d.skills = o.skills.slice();
      else if (k in d) d[k] = o[k];
    });
    d.skills.forEach(function (id) { if (!ABILITIES[id]) throw new Error('unknown ability: ' + id); });
    return d;
  }

  // The flows the map can show, and the flow each kind of trip belongs to.
  var FLOWS = ['logistics', 'sales', 'money', 'building', 'violence'];
  var FLOW_OF = { liquor: 'logistics', takings: 'sales', laundering: 'money', tribute: 'money', works: 'building',
                  streets: 'violence', collection: 'violence', seizure: 'violence', raid: 'violence', attack: 'violence' };

  // Last month's chain in figures: what was made, what waits in the cellar,
  // what was sold and what held sales back, then where the money went.
  function flows(d) {
    var m = d.last || { sold: 0, uncollected: 0, income: 0, costs: 0, profit: 0, washed: 0, owed: 0, skim: 0, spilled: 0 };
    var limit = thirst(d) <= seats(d) && thirst(d) <= d.stock + made(d) ? 'drinkers' : seats(d) <= d.stock + made(d) ? 'seats' : 'stills';
    if (hauling(d) < Math.min(thirst(d), seats(d), d.stock + made(d))) limit = 'trucks';
    return { made: d.last ? made(d) : 0, stock: d.stock, sold: m.sold, seats: seats(d), drinkers: thirst(d), limit: limit,
             trucks: d.trucks, hauling: hauling(d), cars: d.cars, carrying: carrying(d), uncollected: m.uncollected || 0,
             income: m.income, costs: m.costs, profit: m.profit, washed: m.washed, tribute: m.owed - m.skim, kept: m.skim, spilled: m.spilled };
  }

  // What the capo practised last month, sector by sector: he learns what his district does.
  function practice(d) {
    var m = d.last, p = {};
    SECTORS.forEach(function (k) { p[k] = 0; });
    if (!m) return p;
    p.liquor = m.sold / 25;
    VICE.forEach(function (k) { p.vice += d.sites[k]; });
    p.money = m.washed / 150 + d.sites.loans * 0.5;
    p.law = (d.bribing ? 1.5 : 0) + d.sites.union;
    p.muscle = d.crews + d.collectors;
    p.routes = d.sites.chopshop + d.sites.fence + d.sites.warehouse * 0.5;
    return p;
  }

  function slugOf(d) { return d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  // What moved in the district last month, for the map to show: one entry per
  // trip, from a place to a place. Ends are building ids (see buildings) or
  // 'hideout', 'streets', 'shops', 'boss', 'police'. Nothing here decides
  // anything: it only tells again what stepMonth did.
  // What each kind of trip carries, for the icon on the vehicle.
  var CARGO = { liquor: 'liquor', takings: 'dirty-cash', laundering: 'dirty-cash', tribute: 'cash', works: 'materials',
                streets: 'men', collection: 'men', seizure: 'men', raid: 'police' };
  function roleOf(k) {
    return SITES[k].wash ? 'laundering' : k === 'still' || k === 'loft' ? 'production' : k === 'warehouse' ? 'storage' : k === 'speakeasy' ? 'sales' : 'business';
  }
  function trips(d) {
    var m = d.last, list = [];
    if (!m) return list;
    var id = function (kind, n) { return slugOf(d) + '-' + kind + '-' + n; };
    var add = function (kind, from, to, vehicle, more) {
      var t = { kind: kind, flow: FLOW_OF[kind], from: from, to: to, vehicle: vehicle, violent: false, cargo: CARGO[kind] };
      Object.keys(more || {}).forEach(function (k) { t[k] = more[k]; });
      list.push(t);
    };
    var i, bars = d.sites.speakeasy;
    // one run per truck on the road, each with what a truck holds
    for (i = 0; bars > 0 && i * RULES.truckLoad < m.sold - 0.001; i++) {
      add('liquor', d.sites.still ? id('still', i % d.sites.still + 1) : 'hideout', id('speakeasy', i % bars + 1), 'truck',
          { crates: Math.min(RULES.truckLoad, m.sold - i * RULES.truckLoad) });
    }
    SITE_KEYS.forEach(function (k) {
      if (k !== 'speakeasy' && !SITES[k].income) return;
      var amount = k === 'speakeasy' ? m.sold * price(d) / bars : placeIncome(d, k);
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

  // Where the money of the district sits, place by place, for the money view
  // of the map: what the capo holds at the hideout, what each place took last
  // month, and what each laundry washed.
  function cash(d) {
    var m = d.last, slug = slugOf(d), list = [];
    list.push({ at: 'hideout', kind: 'dirty', amount: d.dirty });
    list.push({ at: 'hideout', kind: 'clean', amount: d.clean });
    if (!m) return list;
    trips(d).forEach(function (t) { if (t.kind === 'takings') list.push({ at: t.from, kind: 'takings', amount: t.amount }); });
    var power = d.sites.rented * SITES.rented.wash + d.sites.front * SITES.front.wash;
    ['rented', 'front'].forEach(function (k) {
      for (var n = 1; n <= d.sites[k]; n++) {
        list.push({ at: slug + '-' + k + '-' + n, kind: 'washing', amount: power ? m.washed * SITES[k].wash / power : 0 });
      }
    });
    return list;
  }

  // What the map needs to draw the district: one entry per building.
  function buildings(d) {
    var list = [], slug = slugOf(d);
    SITE_KEYS.forEach(function (k) {
      for (var i = 1; i <= d.sites[k]; i++) {
        list.push({ id: slug + '-' + k + '-' + i, district: d.name, capo: d.capo, type: k, name: SITES[k].name, role: roleOf(k), staff: SITES[k].staff, level: d.levels[k] || 1 });
      }
    });
    return list;
  }

  var api = { RULES: RULES, SITES: SITES, CAPOS: CAPOS, PROJECTS: PROJECTS, createDistrict: createDistrict,
              chooseProject: chooseProject, plan: plan, wish: wish, roleOf: roleOf, addCapo: addCapo, stepMonth: stepMonth, buildings: buildings, cash: cash, busyMen: busyMen, nerve: nerve, income: income, sideIncome: sideIncome, RACKETS: RACKETS,
              goodwillChange: goodwillChange, streetsChange: streetsChange, trips: trips, flows: flows, FLOWS: FLOWS,
              defence: defence, SECTORS: SECTORS, WHEEL: WHEEL, ABILITIES: ABILITIES, practice: practice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportDistrict = api;
})(typeof self !== 'undefined' ? self : this);
