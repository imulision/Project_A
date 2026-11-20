// The numbers of the city game, and nothing else. No drawing and no browser here.
//
// To retune the game, change RULES, TERRAIN and WORTH. The places themselves
// (cost, who refuses what) come from district.js.
(function (root) {
  'use strict';

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
    tribute: 0.15,      // share of everything a capo's cars bring in that goes up to the boss, before he pays his men
    bigger: 0.5,        // what each level above the first adds to what a place earns
    dry: 1 / 3,         // what a speakeasy earns with nothing to pour
    pours: 2,           // speakeasies one still of level 1 keeps wet
    xp: [0, 150, 500, 1200], // months of places run before a man is worth each rank
    rivalGrows: 9,      // months between two places a rival family opens
    rivalMost: 25,      // share of the city's blocks a rival family never goes beyond
    rivalEvery: 6,      // months between two raids on the family's places
    rivalReach: 10,     // a rival only raids a block it presses on at least this hard
    anger: 12,          // every this many places the family runs in the city, the rivals hit twice as hard again
    cover: 3,           // a capo's men answer for any family place within this many blocks of his club
    keyLevel: 3,        // a key place presses on the streets like a place of this level
    siege: 3,           // family places within `near` of a key place before a capo dares ask for it
    keyCost: 4000,      // dirty $ the boss pays for a key place, times the capo's way of taking it
    keyMonths: 2,       // a key place takes this many times longer than a rival's bar
    sulk: 24,           // months a capo lets a key place rest after the boss said no
    soap: 4,            // how much more a capo wants a laundry while dirty money piles up in the boss's safe
    pay: [0, 100, 250, 500], // $ a month the boss owes a Soldier, a Capo, a Veteran and a Legend
    stash: 3000,        // dirty $ the boss can keep without anybody noticing
    hot: 4,             // heat a month while more than that sleeps in his safe
    loud: 10,           // heat for every place burnt, raid thrown back or place taken by force
    cools: 2,           // heat the city loses a month; twice that with the precinct
    bust: 0.5,          // share of the dirty money the police seize when the heat reaches 100
    afterBust: 40,      // where the heat falls back to after that
    // the building tree: the trades a new family knows, what each tier costs in clean $ and months,
    // and the share of the time it takes when a man of the family likes the trade
    learn: { open: ['still', 'speakeasy', 'rented', 'warehouse'], cost: [1000, 3500, 10000], months: [4, 6, 9], taught: 0.5 },
    feud: 8,            // grudges between two capos before a feud breaks out
    cool: 6,            // months for one grudge to be forgotten
    sulks: 12,          // months the man the boss ruled against keeps his money to himself
    seats: 3,           // capos a city carries; every key place the family holds there adds one
    doors: { rise: 1000, figure: 1500, name: 2500, need: 1000, poach: 6000, road: 2000 }, // road: what it costs on top to send the man to another city
    // parting with a capo: clean $ to pay him off by rank; heat a killing brings, months the less loyal keep their money
    // and the loyalty that keeps a man steady; heat the police forget for a man handed over, months before he is out,
    // and the places he burns then (one more for each rank he had)
    out: { retire: [1500, 4000, 9000, 20000], blood: 30, shaken: 6, steady: 70, tip: 40, term: 24, revenge: 2 },
    keeps: [0, 0.5, 0.75, 0.9], // share of the money he cannot use that a Soldier, a Capo, a Veteran and a Legend keeps for himself
    respite: 24,        // months the rivals leave the family alone in a city where it has just planted its first club
    // a car leaves a place only with a full load of takings; what a car carries, the runs it makes in a month, its price and its upkeep (the car a man arrives with costs him nothing)
    // loads: what a car carries once the family has learned cars of tier 1, 2 and 3
    car: { load: 150, loads: [150, 150, 250, 400], runs: 8, cost: 400, upkeep: 20 },
    // a capo has a car of his own: with nothing else on his hands he goes where his business chokes. The runs he makes
    // himself when his cars left full tills behind, and what a place makes more the month he stands over it
    own: { runs: 2, boost: 0.15 },
    // liquor is carried too. A truck leaves a cellar only with a full load: the crates in a load, the runs a truck makes
    // in a month, its price and upkeep (the truck that comes with a man's first still costs nothing), the months of its
    // own making a cellar holds, and the loads a bar keeps on its shelf. A bar pours one load a month.
    truck: { load: 20, runs: 4, cost: 500, upkeep: 25, cellar: 2, shelf: 2 },
    // other goods ride the same trucks, after the liquor: the loads a warehouse and a chop shop make in a month, what
    // is in a load, and the share a fence earns the month it has nothing to sell
    goods: { makes: { warehouse: 2, chopshop: 1 }, load: { goods: 20, cars: 4 }, short: 0.6 },
    // weed is a bonus: a loft sells on the spot, and the loads it grows besides go to the bars and the brothels with
    // the truck runs nothing else needs. The bags in a load, and what a place with weed to sell earns more that month
    weed: { makes: 1, load: 10, bonus: 0.2 },
    // the road is not safe. Once they have struck the rivals lie low for so many months, then hold up one load that leaves the street they press on
    // hardest, unless its capo is hard enough to hold it (they wait there until one passes); and from this heat on the police stop one truck a month
    // `hold` and `muscle`: the share of the family's grip on a street the rivals must pass to dare, for a capo of no
    // Muscle, and what each point of his Muscle adds
    road: { every: 6, heat: 30, hold: 0.1, muscle: 0.08 },
    // between two cities joined by a road: the loads one city makes and cannot sell that go, each way and each month,
    // to the family's sellers that went without in the other
    convoy: { loads: 2 },
    // the boss's table: what a man who sits there is paid a month, what each point of the Bookkeeper's Business adds
    // to every laundry, the points of Cunning Routes needs for one more load down every road, and the points of
    // Charisma the Fixer needs to cool every city by one more
    table: { pay: 300, wash: 0.05, cunning: 2, charisma: 4 },
    crowd: 0.12,        // every man the family already counts makes the next one this much dearer
    greed: 0.2,         // and every key place it holds, in any city, the next key place
    turn: 25,           // share of the city the family must hold before a rival's lieutenant will listen // dirty $ the boss pays to set a man up, by the door he came through
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

  var api = { RULES: RULES, RANKS: RANKS, TERRAIN: TERRAIN, WORTH: WORTH, KINDS: KINDS, key: key, inside: inside, at: at, far: far };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfRules = api;
})(typeof self !== 'undefined' ? self : this);
