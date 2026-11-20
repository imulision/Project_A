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
  // The few buildings a whole city turns on. Whoever holds one changes the
  // rules for every place of his family in that city:
  //   street  = the kind of street it stands on
  //   pours   = stills' worth of liquor it adds
  //   lifts   = the streets whose places earn more, and by how much
  //   cheaper = share taken off the price of every new place
  //   shield  = what it adds to a capo's stand against a raid (0.1 = one point of Muscle)
  var KEYS = {
    brewery:  { street: 'industry', name: 'Brewery', pours: 4, gives: 'Pours for eight speakeasies' },
    hotel:    { street: 'nightlife', name: 'Grand Hotel', lifts: { street: 'nightlife', by: 0.25 }, gives: 'Night places earn a quarter more' },
    port:     { street: 'port', name: 'The Port', lifts: { street: 'port', by: 0.5 }, gives: 'Port places earn half as much again' },
    depot:    { street: 'industry', name: 'Freight Depot', lifts: { street: 'industry', by: 0.25 }, gives: 'Workshops and stills earn a quarter more' },
    cityhall: { street: 'wealth', name: 'City Hall', cheaper: 0.2, gives: 'Every new place costs a fifth less' },
    precinct: { street: 'wealth', name: 'Central Precinct', shield: 0.4, gives: 'Raids on the family break far more often' }
  };

  // The people beyond the six big names of district.js. A second has a
  // `mentor` and comes forward when his mentor runs all he can; the man of a
  // key place has a `key` and comes with it. Each is a full capo.
  var PEOPLE = {
    rocco: { mentor: 'sal', name: 'Rocco Bellini', specialty: 'Enforcer', muscle: 7, business: 3, cunning: 3, charisma: 4, loyalty: 70, ambition: 50, likes: ['loans', 'chopshop'], refuses: ['front'] },
    ida:   { mentor: 'mae', name: 'Ida Brandt', specialty: 'Bookkeeper', muscle: 1, business: 7, cunning: 7, charisma: 5, loyalty: 75, ambition: 35, likes: ['front', 'rented', 'loans'], refuses: ['brothel', 'loft'] },
    otto:  { mentor: 'dutch', name: 'Otto Brenner', specialty: 'Bootlegger', muscle: 5, business: 6, cunning: 4, charisma: 3, loyalty: 65, ambition: 40, likes: ['still', 'warehouse', 'speakeasy'], refuses: [] },
    frank: { mentor: 'tommy', name: 'Frank Doyle', specialty: 'Politician', muscle: 3, business: 4, cunning: 5, charisma: 7, loyalty: 75, ambition: 45, likes: ['speakeasy', 'union', 'gambling'], refuses: ['brothel'] },
    lena:  { mentor: 'vince', name: 'Lena Sokolova', specialty: 'Pusher', muscle: 6, business: 4, cunning: 6, charisma: 2, loyalty: 55, ambition: 70, likes: ['loft', 'chopshop'], refuses: [] },
    ray:   { mentor: 'danny', name: 'Ray Castellano', specialty: 'Gambler', muscle: 4, business: 5, cunning: 5, charisma: 5, loyalty: 60, ambition: 65, likes: ['gambling', 'brothel'], refuses: [] },
    gus:     { key: 'brewery', name: 'Gus Hartmann', specialty: 'Brewmaster', muscle: 3, business: 7, cunning: 6, charisma: 4, loyalty: 50, ambition: 30, likes: ['still', 'speakeasy', 'warehouse'], refuses: [] },
    vivian:  { key: 'hotel', name: 'Vivian Lacroix', specialty: 'Hostess', muscle: 2, business: 6, cunning: 7, charisma: 8, loyalty: 45, ambition: 60, likes: ['gambling', 'brothel', 'speakeasy'], refuses: [] },
    jim:     { key: 'port', name: 'Jim Kovacs', specialty: 'Dock boss', muscle: 8, business: 4, cunning: 4, charisma: 5, loyalty: 50, ambition: 55, likes: ['warehouse', 'fence', 'union'], refuses: [] },
    walt:    { key: 'depot', name: 'Walt Gorski', specialty: 'Union man', muscle: 6, business: 4, cunning: 4, charisma: 7, loyalty: 55, ambition: 45, likes: ['union', 'chopshop', 'loft'], refuses: [] },
    hugh:    { key: 'cityhall', name: 'Hugh Pryce', specialty: 'Alderman', muscle: 1, business: 6, cunning: 8, charisma: 8, loyalty: 40, ambition: 75, likes: ['front', 'rented', 'union'], refuses: ['brothel', 'loft', 'chopshop'] },
    // the lieutenants of the family in place: each runs a part of its places, and can be turned
    finn:  { lieutenant: 'Callahan', home: 'ashport', name: 'Finn O\'Rourke', specialty: 'Enforcer', muscle: 7, business: 4, cunning: 4, charisma: 4, loyalty: 35, ambition: 75, likes: ['loans', 'speakeasy'], refuses: ['front'] },
    nora:  { lieutenant: 'Callahan', home: 'ashport', name: 'Nora Callahan', specialty: 'Bookkeeper', muscle: 2, business: 8, cunning: 8, charisma: 5, loyalty: 30, ambition: 85, likes: ['front', 'gambling', 'rented'], refuses: ['brothel'] },
    sean:  { lieutenant: 'Callahan', home: 'ashport', name: 'Sean Brady', specialty: 'Bootlegger', muscle: 5, business: 6, cunning: 5, charisma: 7, loyalty: 40, ambition: 60, likes: ['still', 'speakeasy', 'warehouse'], refuses: [] },
    // Calder Falls, the Northside: mills, foundries and union halls
    aggie: { lieutenant: 'Northside', home: 'calder', name: 'Aggie Novak', specialty: 'Politician', muscle: 3, business: 5, cunning: 6, charisma: 8, loyalty: 40, ambition: 65, likes: ['union', 'speakeasy'], refuses: ['brothel'] },
    stan:  { lieutenant: 'Northside', home: 'calder', name: 'Stan Wozniak', specialty: 'Enforcer', muscle: 8, business: 3, cunning: 3, charisma: 4, loyalty: 45, ambition: 60, likes: ['chopshop', 'loans'], refuses: ['front'] },
    pete:  { lieutenant: 'Northside', home: 'calder', name: 'Pete Lindqvist', specialty: 'Bootlegger', muscle: 4, business: 7, cunning: 5, charisma: 4, loyalty: 35, ambition: 70, likes: ['still', 'warehouse'], refuses: ['loft'] },
    // Marrow Bay, the Callahans' cousins: canneries, shipyards and night boats
    declan: { lieutenant: 'Callahan', home: 'marrow', name: 'Declan Foley', specialty: 'Bootlegger', muscle: 5, business: 6, cunning: 6, charisma: 5, loyalty: 35, ambition: 70, likes: ['warehouse', 'still', 'fence'], refuses: [] },
    bridie: { lieutenant: 'Callahan', home: 'marrow', name: 'Bridie Nolan', specialty: 'Gambler', muscle: 3, business: 7, cunning: 6, charisma: 7, loyalty: 30, ambition: 80, likes: ['gambling', 'speakeasy'], refuses: ['chopshop'] },
    mick:   { lieutenant: 'Callahan', home: 'marrow', name: 'Mick Tierney', specialty: 'Enforcer', muscle: 8, business: 3, cunning: 4, charisma: 3, loyalty: 45, ambition: 55, likes: ['loans', 'fence'], refuses: ['front'] },
    // Dunmore, the Kesslers: coal, rail and breweries
    karl:  { lieutenant: 'Kessler', home: 'dunmore', name: 'Karl Kessler', specialty: 'Bootlegger', muscle: 5, business: 8, cunning: 5, charisma: 4, loyalty: 30, ambition: 85, likes: ['still', 'speakeasy', 'warehouse'], refuses: ['brothel'] },
    greta: { lieutenant: 'Kessler', home: 'dunmore', name: 'Greta Voss', specialty: 'Bookkeeper', muscle: 2, business: 8, cunning: 7, charisma: 5, loyalty: 40, ambition: 60, likes: ['front', 'rented', 'loans'], refuses: ['chopshop'] },
    lutz:  { lieutenant: 'Kessler', home: 'dunmore', name: 'Lutz Brauer', specialty: 'Enforcer', muscle: 8, business: 4, cunning: 3, charisma: 3, loyalty: 50, ambition: 50, likes: ['union', 'chopshop'], refuses: ['gambling'] },
    // Port Lorne, the Dockers: the sea port at the border
    joe:   { lieutenant: 'Dockers', home: 'lorne', name: 'Joe Macready', specialty: 'Bootlegger', muscle: 6, business: 6, cunning: 5, charisma: 5, loyalty: 40, ambition: 65, likes: ['warehouse', 'fence', 'speakeasy'], refuses: [] },
    tess:  { lieutenant: 'Dockers', home: 'lorne', name: 'Tess Ferreira', specialty: 'Pusher', muscle: 4, business: 6, cunning: 8, charisma: 5, loyalty: 30, ambition: 80, likes: ['loft', 'fence'], refuses: ['union'] },
    harry: { lieutenant: 'Dockers', home: 'lorne', name: 'Harry Doak', specialty: 'Enforcer', muscle: 9, business: 3, cunning: 3, charisma: 4, loyalty: 45, ambition: 55, likes: ['union', 'loans'], refuses: ['front'] },
    // Saint Vesper, the Callahans' old money: judges, bishops and private rooms
    aidan: { lieutenant: 'Callahan', home: 'vesper', name: 'Aidan Roche', specialty: 'Politician', muscle: 2, business: 6, cunning: 7, charisma: 9, loyalty: 35, ambition: 75, likes: ['front', 'gambling', 'rented'], refuses: ['chopshop'] },
    clara: { lieutenant: 'Callahan', home: 'vesper', name: 'Clara Devlin', specialty: 'Bookkeeper', muscle: 2, business: 9, cunning: 7, charisma: 5, loyalty: 40, ambition: 60, likes: ['loans', 'front'], refuses: ['brothel'] },
    owen:  { lieutenant: 'Callahan', home: 'vesper', name: 'Owen Gallagher', specialty: 'Gambler', muscle: 5, business: 6, cunning: 5, charisma: 6, loyalty: 45, ambition: 65, likes: ['gambling', 'brothel', 'speakeasy'], refuses: ['union'] },
    mallory: { key: 'precinct', name: 'Ed Mallory', specialty: 'Police captain', muscle: 6, business: 4, cunning: 7, charisma: 4, loyalty: 40, ambition: 60, likes: ['loans', 'gambling', 'fence'], refuses: ['loft'] }
  };
  // What draws each big name to a family: places of a kind it runs, a key place it holds, or raids it has thrown back.
  var LURES = {
    sal:   { repelled: 1, burnt: 2, why: 'The family threw a raid back: Sal respects that', need: 'The family keeps getting burnt out: Sal smells work' },
    mae:   { runs: 'front', n: 1, why: 'A real front to keep books for' },
    dutch: { runs: 'speakeasy', n: 2, why: 'Bars that need a steady supply' },
    tommy: { key: 'cityhall', why: 'City Hall is his natural home' },
    vince: { runs: 'loft', n: 1, why: 'A loft already at work' },
    danny: { runs: 'gambling', n: 1, why: 'A room with tables to run' }
  };
  function who(id) { return D.CAPOS[id] || PEOPLE[id]; }
  function person(id) {
    if (!who(id)) throw new Error('unknown capo: ' + id);
    return who(id);
  }

  function key(x, y) { return x + ',' + y; }
  function inside(c, x, y) { return x >= 0 && y >= 0 && x < c.w && y < c.h; }
  function at(c, x, y) { return c.blocks[key(x, y)] || null; }
  function far(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

  function createCity(spec) {
    return { id: spec.id, w: spec.w, h: spec.h, zones: spec.zones.map(function (z) {
      return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, traits: z.traits };
    }), blocks: {}, month: 0, rival: null, dice: 1, ops: [], asks: [], refused: {}, repelled: 0, burnt: 0, knocked: {}, grudge: {}, feuds: [], sulk: {}, jailed: [], quiet: 0, heat: 0, washed: 0, flow: null };
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
    // its lieutenants share the places, from the west of the city to the east
    var men = lieutenantsOf(c), theirs = everyPlace(c).filter(function (p) { return p.owner === name && p.kind !== 'key'; });
    if (!men.length) return;
    theirs.sort(function (a, b) { return a.x - b.x || a.y - b.y; }).forEach(function (p, i) {
      at(c, p.x, p.y).man = men[Math.min(men.length - 1, Math.floor(i * men.length / theirs.length))];
    });
    changed(c);
  }
  // The lieutenants of the family in place in this city. A city nobody was written for borrows the family's first three.
  function lieutenantsOf(c) {
    var all = Object.keys(PEOPLE).filter(function (id) { return PEOPLE[id].lieutenant === c.rival; });
    var here = all.filter(function (id) { return PEOPLE[id].home === c.id; });
    return here.length ? here : all.filter(function (id) { return PEOPLE[id].home === PEOPLE[all[0]].home; });
  }
  // The key places go to whoever was there first: each on the street that suits it best, well apart from the others.
  function crown(c, name) {
    c.rival = name;
    Object.keys(KEYS).forEach(function (id) {
      var best = null, others = keys(c);
      for (var y = 1; y < c.h - 1; y++) for (var x = 1; x < c.w - 1; x++) {
        if (at(c, x, y) || others.some(function (k) { return far(x, y, k.x, k.y) < 3; })) continue;
        var z = zoneOf(c, x, y), t = z.traits[KEYS[id].street];
        // the middle of the best street for it
        var mid = far(2 * x, 2 * y, z.x0 + z.x1, z.y0 + z.y1);
        if (!best || t > best.t || (t === best.t && mid < best.mid)) best = { x: x, y: y, t: t, mid: mid };
      }
      open(c, best.x, best.y, { owner: name, kind: 'key', key: id });
    });
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
  // What is worked out once and kept until a place changes: the list of
  // places and how hard each side presses on every block. It lives beside the
  // city, never in it, so a saved game carries none of it. Whatever changes
  // c.blocks must call changed(c).
  var kept = new WeakMap();
  function changed(c) { kept.delete(c); }
  function memo(c) {
    var m = kept.get(c);
    if (m) return m;
    m = { family: new Float64Array(c.w * c.h), rival: new Float64Array(c.w * c.h) };
    m.places = Object.keys(c.blocks).map(function (k) {
      var p = c.blocks[k], xy = k.split(',');
      var out = { x: Number(xy[0]), y: Number(xy[1]), owner: p.owner, kind: p.kind, level: p.level, capo: p.capo, at: k };
      if (p.key) out.key = p.key;
      if (p.man) out.man = p.man;
      return out;
    });
    m.places.forEach(function (p) {
      var r = p.level + 1, side = p.owner === 'family' ? m.family : m.rival, press = RULES.press * p.level;
      for (var y = Math.max(0, p.y - r); y <= Math.min(c.h - 1, p.y + r); y++) {
        for (var x = Math.max(0, p.x - r); x <= Math.min(c.w - 1, p.x + r); x++) {
          side[y * c.w + x] += press / (1 + far(x, y, p.x, p.y));
        }
      }
    });
    kept.set(c, m);
    return m;
  }
  // The same list for the rules' own reading: no copies, never to be written to, and without the tills.
  function everyPlace(c) { return memo(c).places; }
  // Every place of the city, or only those a capo runs.
  function places(c, capo) {
    return memo(c).places.filter(function (p) { return capo === undefined || p.capo === capo; }).map(function (p) {
      var out = { x: p.x, y: p.y, owner: p.owner, kind: p.kind, level: p.level, capo: p.capo };
      var till = c.blocks[p.at].till;
      if (till) out.till = till;
      if (p.key) out.key = p.key;
      if (p.man) out.man = p.man;
      return out;
    });
  }
  // The businesses a capo runs. Kept until a place changes, and never to be written to.
  function run(c, capo) {
    var k = crowns(c);
    if (!k.run[capo]) k.run[capo] = memo(c).places.filter(function (p) { return p.capo === capo && p.kind !== 'club' && p.kind !== 'key'; });
    return k.run[capo];
  }
  // The key places of the city, and who holds each.
  function keys(c) {
    return everyPlace(c).filter(function (p) { return p.kind === 'key'; }).map(function (p) {
      return { key: p.key, name: KEYS[p.key].name, x: p.x, y: p.y, owner: p.owner, capo: p.capo, gives: KEYS[p.key].gives };
    });
  }
  // What the family's key places add up to, for one line of KEYS.
  // Both are asked for every place every month, so they are worked out once and kept with the rest of memo(c).
  function crowns(c) {
    var m = memo(c);
    if (!m.crowns) m.crowns = { list: m.places.filter(function (p) { return p.kind === 'key' && p.owner === 'family'; }), held: {}, lift: {}, club: {}, run: {} };
    return m.crowns;
  }
  function held(c, what) {
    var k = crowns(c);
    if (k.held[what] === undefined) k.held[what] = k.list.reduce(function (n, p) { return n + (KEYS[p.key][what] || 0); }, 0);
    return k.held[what];
  }
  function lift(c, kind) {
    var k = crowns(c);
    if (k.lift[kind] === undefined) {
      k.lift[kind] = k.list.reduce(function (n, p) { var l = KEYS[p.key].lifts; return n + (l && l.street === TERRAIN[kind] ? l.by : 0); }, 1);
    }
    return k.lift[kind];
  }

  function open(c, x, y, p) {
    if (!inside(c, x, y)) throw new Error(x + ',' + y + ' is outside ' + c.id);
    if (at(c, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (p.kind !== 'club' && p.kind !== 'key' && !TERRAIN[p.kind]) throw new Error('unknown kind of place: ' + p.kind);
    if (p.owner === 'family' && !who(p.capo)) throw new Error('a place of the family needs a capo');
    var b = { owner: p.owner, kind: p.kind, level: p.level || 1, capo: p.owner === 'family' ? p.capo : null };
    if (p.kind === 'key') {
      if (!KEYS[p.key]) throw new Error('unknown key place: ' + p.key);
      if (keys(c).some(function (k) { return k.key === p.key; })) throw new Error(c.id + ' already has its ' + KEYS[p.key].name);
      b.key = p.key;
      b.level = RULES.keyLevel;
    }
    c.blocks[key(x, y)] = b;
    changed(c);
  }
  // A capo arrives: his social club is his base, and where he is found.
  function clubOf(c, capo) {
    var k = crowns(c);
    if (k.club[capo] === undefined) k.club[capo] = memo(c).places.filter(function (p) { return p.kind === 'club' && p.capo === capo; })[0] || null;
    var club = k.club[capo];
    return club ? { x: club.x, y: club.y } : null;
  }
  function settle(c, capo, x, y) {
    if (clubOf(c, capo)) throw new Error(capo + ' already has a club in ' + c.id);
    open(c, x, y, { owner: 'family', kind: 'club', capo: capo, level: RULES.clubLevel });
  }

  // How hard the family and its rivals press on one block.
  function hold(c, x, y) {
    var m = memo(c), i = y * c.w + x;
    return inside(c, x, y) ? { family: m.family[i], rival: m.rival[i] } : { family: 0, rival: 0 };
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
    var mine = everyPlace(c).filter(function (p) { return p.capo === capo; }), out = [];
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
    return Math.round(D.SITES[kind].cost * Math.pow(1 + RULES.dearer, run(c, capo).length) * (1 - held(c, 'cheaper')));
  }
  // The place a capo's whole trade is built on: the first kind of place he likes.
  function tradeOf(capo) {
    return who(capo).likes.filter(function (k) { return TERRAIN[k]; })[0] || null;
  }
  function worth(c, x, y, kind) { return 0.4 + 0.6 * zoneOf(c, x, y).traits[TERRAIN[kind]]; }
  function taste(capo, kind) {
    return kind === tradeOf(capo) ? RULES.trade : who(capo).likes.indexOf(kind) >= 0 ? RULES.likes : 1;
  }

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
      else if (p.kind === 'loft') out.push({ p: p, b: b, chain: 'weed', cargo: 'weed', makes: RULES.weed.makes * size * pushed(c, p) });
    });
    return out;
  }
  // One month of goods: every cellar and store fills with what was made, the trucks of the men who make it drive full
  // loads to the family's emptiest sellers, liquor first, and every seller sells what it has.
  function distil(c, f) {
    var all = cellars(c), left = {}, made = {}, out = { dry: false, idle: {}, waits: {} };
    all.forEach(function (s) {
      s.b.stock = Math.min(RULES.truck.cellar * s.makes, (s.b.stock || 0) + s.makes);
      var m = f.men[s.p.capo];
      if (m && left[s.p.capo] === undefined) { m.trucks = m.trucks || 1; left[s.p.capo] = m.trucks * RULES.truck.runs; }
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
        from.b.stock -= 1; to.b[chain.shelf] = (to.b[chain.shelf] || 0) + 1; left[from.p.capo] -= 1;
        var who2 = from.p.capo, n = made[who2] || 0, trucks = f.men[who2].trucks;
        made[who2] = n + 1;
        c.flow.hauls.push({ capo: who2, cargo: from.cargo, from: { x: from.p.x, y: from.p.y }, to: { x: to.p.x, y: to.p.y }, amount: loadOfCargo(from.cargo), truck: n % trucks + 1, leg: Math.floor(n / trucks) });
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
      * (SELLS[p.kind] ? SELLS[p.kind].short + (1 - SELLS[p.kind].short) * poured(c, p, wet) : 1) * (p.kind === 'speakeasy' || p.kind === 'brothel' ? 1 + RULES.weed.bonus * ((c.blocks[p.x + ',' + p.y] || {}).high || 0) : 1) * (p.kind === 'still' ? 1 : pushed(c, p));
  }
  function income(c, capo) {
    var wet = liquor(c).wet;
    return run(c, capo).reduce(function (n, p) { return n + earns(c, p, wet); }, clubOf(c, capo) ? RULES.club : 0);
  }
  function wages(c, capo) { return RULES.wage * run(c, capo).length; }
  // What a place made goes into its till. The capo's cars fetch it one full load at a time, the fullest till first.
  function collect(c, capo, cars, own, load) {
    var wet = liquor(c).wet, got = 0, left = cars * RULES.car.runs, mine = own || 0, waiting = 0, full = 0, went = null, done = 0, drove = 0;
    var tills = run(c, capo).map(function (p) { var b = at(c, p.x, p.y); b.till = (b.till || 0) + earns(c, p, wet); return { p: p, b: b }; });
    while (left + mine > 0) {
      var best = null;
      for (var i = 0; i < tills.length; i++) if (tills[i].b.till >= load && (!best || tills[i].b.till > best.b.till)) best = tills[i];
      if (!best) break;
      best.b.till -= load; got += load;
      var r = { capo: capo, x: best.p.x, y: best.p.y, amount: load };
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
      if (kind === 'still') return drink.bars > RULES.pours * drink.stills ? 1.5 : 1;
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
    if (!who(capo)) throw new Error('unknown capo: ' + capo);
    if (!f.men[capo]) f.men[capo] = { cash: RULES.purse, xp: 0, rank: 0, income: 0, cars: 1 };
    return f.men[capo];
  }
  function first(capo) { return who(capo).name.split(' ')[0]; }
  // What he is after and how far his money is from it, for the screen.
  function plan(c, f, capo) {
    var m = f.men[capo], busy = c.ops.filter(function (o) { return o.capo === capo && !o.key; })[0]; // a key place is the boss's affair: the capo goes on with his own
    if (busy) return { move: 'take', way: busy.way, x: busy.x, y: busy.y, cost: busy.cost, saved: busy.cost, progress: 1, waiting: 'time', why: 'his men are on their way' };
    var w = wants(c, capo, { rank: m.rank, tech: f.tech, wash: f.dirty - washing(c).most > RULES.stash });
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
      if (o.key) {
        was.owner = 'family'; was.capo = o.capo;
        changed(c);
        events.push({ type: 'taken', capo: o.capo, city: c.id, x: o.x, y: o.y, kind: 'key', key: o.key, way: o.way, from: c.rival,
                      label: 'The ' + KEYS[o.key].name + ' is ours: ' + first(o.capo) + ' holds it now' });
        return false;
      }
      c.blocks[key(o.x, o.y)] = { owner: 'family', kind: o.kind, level: 1, capo: o.capo };
      changed(c);
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
    var theirs = everyPlace(c).filter(function (p) { return p.owner !== 'family'; }), ours = everyPlace(c).filter(function (p) { return p.owner === 'family'; });
    if (theirs.length >= RULES.rivalMost * c.w * c.h / 100) return;
    var best = null;
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      if (at(c, x, y) || grip(c, x, y) !== 'rival') continue;
      var d = ours.reduce(function (n, p) { return Math.min(n, far(x, y, p.x, p.y)); }, 99);
      if (!best || d < best.d) best = { x: x, y: y, d: d };
    }
    if (!best) return;
    open(c, best.x, best.y, { owner: c.rival, kind: bestKind(c, best.x, best.y) });
    // it answers to the lieutenant next door
    var near = theirs.filter(function (p) { return p.man; }).sort(function (a, b) { return far(best.x, best.y, a.x, a.y) - far(best.x, best.y, b.x, b.y); })[0];
    if (near) { at(c, best.x, best.y).man = near.man; changed(c); }
  }
  // Who answers when a family place is hit: the hardest capo with a club close by, or its own.
  function cover(c, x, y) {
    var p = at(c, x, y), best = { capo: p.capo, muscle: who(p.capo).muscle };
    everyPlace(c).forEach(function (q) {
      if (q.owner !== 'family' || q.kind !== 'club' || far(x, y, q.x, q.y) > RULES.cover) return;
      if (who(q.capo).muscle > best.muscle) best = { capo: q.capo, muscle: who(q.capo).muscle };
    });
    return best;
  }
  // Now and then they come for the family's place they press on hardest. A capo's Muscle decides if it stands.
  function rivalRaids(c, events) {
    if (c.month % RULES.rivalEvery !== 0 || c.month <= (c.quiet || 0)) return;
    var target = null;
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family' || p.kind === 'club' || p.kind === 'key') return;
      var h = hold(c, p.x, p.y);
      if (h.rival < RULES.rivalReach) return;
      if (!target || h.rival - h.family > target.margin) target = { margin: h.rival - h.family, p: p, h: h };
    });
    if (!target) return;
    var p = target.p, by = c.rival || everyPlace(c).filter(function (q) { return q.owner !== 'family'; })[0].owner, where = zoneOf(c, p.x, p.y).name;
    var guard = cover(c, p.x, p.y);
    var e = { capo: p.capo, city: c.id, x: p.x, y: p.y, kind: p.kind, by: by, heldBy: guard.capo };
    var fury = 1 + everyPlace(c).filter(function (q) { return q.owner === 'family'; }).length / RULES.anger; // the bigger the family, the harder they come
    if (target.h.family * (RULES.stand + guard.muscle / 10 + held(c, 'shield')) >= target.h.rival * fury) {
      e.type = 'repelled';
      c.repelled += 1;
      e.label = 'The ' + by + 's come for ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where
        + (guard.capo === p.capo ? ' and are thrown back' : ': ' + first(guard.capo) + '\'s men throw them back');
    } else {
      delete c.blocks[key(p.x, p.y)];
      changed(c);
      e.type = 'burnt';
      c.burnt = (c.burnt || 0) + 1;
      e.label = 'The ' + by + 's burn out ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + where;
    }
    c.raid = { month: c.month, x: p.x, y: p.y, capo: guard.capo || p.capo, by: by, kind: p.kind };
    events.push(e);
  }
  // Where a capo is this month, and what took him there: the place he is taking, the street the rivals
  // struck, the door of the man he quarrels with, the key place he asks for. Otherwise his club.
  function whereabouts(c, f, capo) {
    var club = clubOf(c, capo), op = c.ops.filter(function (o) { return o.capo === capo; })[0];
    var site = function (kind, key) { return (kind === 'key' ? KEYS[key].name : D.SITES[kind].name).toLowerCase(); };
    if (op) {
      var b = at(c, op.x, op.y), whose = b && b.owner !== 'family' ? 'the ' + b.owner + 's\' ' : 'the ';
      return { x: op.x, y: op.y, why: 'take', label: 'Taking ' + whose + site(op.kind, op.key) + ' in ' + zoneOf(c, op.x, op.y).name };
    }
    if (c.raid && c.raid.month === c.month && c.raid.capo === capo) {
      return { x: c.raid.x, y: c.raid.y, why: 'raid', label: 'Facing the ' + c.raid.by + 's in ' + zoneOf(c, c.raid.x, c.raid.y).name };
    }
    var feud = (c.feuds || []).filter(function (q) { return q.a === capo && clubOf(c, q.b); })[0];
    if (feud) { var other = clubOf(c, feud.b); return { x: other.x, y: other.y, why: 'feud', label: 'Having it out with ' + first(feud.b) }; }
    var ask = c.asks.filter(function (a) { return a.capo === capo; })[0];
    if (ask) return { x: ask.x, y: ask.y, why: 'asks', label: 'Waiting for your word in front of the ' + KEYS[ask.key].name };
    var h = f.men && f.men[capo] && f.men[capo].help;
    if (h && at(c, h.x, h.y)) {
      return { x: h.x, y: h.y, why: h.why, label: h.why === 'carry' ? 'Driving the takings of his ' + site(h.kind) + ' home himself'
        : 'Standing over his ' + site(h.kind) + ' in ' + zoneOf(c, h.x, h.y).name };
    }
    return { x: club.x, y: club.y, why: 'home', label: 'At his club' };
  }
  // What the boss can spend: his dirty money, and his clean money once the dirty runs out.
  function funds(f) { return Math.max(0, f.dirty) + Math.max(0, f.clean || 0); }
  function spend(f, cost) {
    var dirty = Math.min(cost, Math.max(0, f.dirty));
    f.dirty -= dirty;
    f.clean = (f.clean || 0) - (cost - dirty);
  }
  // --- key places: the capo asks, the boss decides ---
  // A capo asks for a key place once the family has it surrounded, and never twice at once.
  function eyes(c, capo) {
    var mine = places(c, capo), out = null;
    keys(c).forEach(function (k) {
      if (out || k.owner === 'family') return;
      if (c.month < (c.refused[k.key] || 0)) return;
      if (c.asks.concat(c.ops).some(function (o) { return o.key === k.key; })) return;
      if (!mine.some(function (p) { return far(k.x, k.y, p.x, p.y) <= RULES.near; })) return;
      var around = everyPlace(c).filter(function (p) { return p.owner === 'family' && far(k.x, k.y, p.x, p.y) <= RULES.near; }).length;
      if (around >= RULES.siege) out = k;
    });
    return out;
  }
  function asks(c) {
    return c.asks.map(function (a) {
      return { id: a.id, capo: a.capo, key: a.key, name: KEYS[a.key].name, gives: KEYS[a.key].gives, x: a.x, y: a.y, way: a.way, cost: a.cost, months: a.months, why: a.why };
    });
  }
  function answer(c, f, id, yes) {
    var a = c.asks.filter(function (q) { return q.id === id; })[0];
    if (!a) throw new Error('nobody is asking for ' + id);
    if (yes) {
      if (funds(f) < a.cost) throw new Error('the boss cannot pay the $' + a.cost + ' the ' + KEYS[a.key].name + ' takes');
      spend(f, a.cost);
      c.ops.push({ capo: a.capo, x: a.x, y: a.y, way: a.way, key: a.key, kind: 'key', cost: a.cost, month: c.month, months: a.months });
    } else c.refused[a.key] = c.month + RULES.sulk;
    c.asks = c.asks.filter(function (q) { return q !== a; });
  }
  // --- two kinds of money ---
  // What the family's fronts in the city can wash a month, and what they washed last month.
  function washing(c) {
    return { washed: c.washed || 0, most: Math.round(laundries(c).reduce(function (n, l) { return n + l.most; }, 0)) };
  }
  // Every place of the family that washes (what it can wash and what it keeps come from district.js), the cheapest first.
  function laundries(c) {
    return everyPlace(c).filter(function (p) { return p.owner === 'family' && D.SITES[p.kind] && D.SITES[p.kind].wash; }).map(function (p) {
      return { x: p.x, y: p.y, most: D.SITES[p.kind].wash * worth(c, p.x, p.y, p.kind) * (1 + (p.level - 1) * 1.5), loss: D.SITES[p.kind].loss };
    }).sort(function (a, b) { return a.loss - b.loss; });
  }
  function money(c, f, events) {
    f.clean = f.clean || 0;
    var flow = c.flow || (c.flow = { up: 0, sent: {} });
    flow.pay = 0; flow.cut = 0; flow.seized = 0; flow.wash = {};
    // every man in the city is paid by his rank
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var due = RULES.pay[f.men[capo].rank], dirty = Math.min(due, Math.max(0, f.dirty)), clean = Math.min(due - dirty, Math.max(0, f.clean));
      f.dirty -= dirty; f.clean -= clean; flow.pay += dirty + clean;
      if (dirty + clean < due) events.push({ type: 'unpaid', capo: capo, city: c.id, due: due, label: first(capo) + ' has not been paid this month' });
    });
    // the fronts wash what they can of what is left
    c.washed = 0;
    laundries(c).forEach(function (l) {
      var n = Math.max(0, Math.min(f.dirty, l.most));
      f.dirty -= n; f.clean += n * (1 - l.loss); c.washed += n; flow.cut += n * l.loss; flow.wash[key(l.x, l.y)] = n;
    });
    // money that sleeps and blood in the streets draw the police
    var loud = events.filter(function (e) { return e.type === 'burnt' || e.type === 'repelled' || (e.type === 'taken' && e.way === 'force'); }).length;
    c.heat = (c.heat || 0) + (f.dirty > RULES.stash ? RULES.hot : 0) + loud * RULES.loud - RULES.cools * (held(c, 'shield') ? 2 : 1);
    c.heat = Math.max(0, Math.min(100, c.heat));
    if (c.heat >= 100) {
      var seized = Math.round(Math.max(0, f.dirty) * RULES.bust);
      f.dirty -= seized; flow.seized = seized;
      c.heat = RULES.afterBust;
      events.push({ type: 'bust', city: c.id, seized: seized, label: 'The police raid the family\'s counting rooms and seize $' + seized });
    }
  }

  // --- capos who share a city ---
  function pair(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  // A capo who opens or takes a place within reach of another capo's leaves a grudge between them.
  function rub(c, capo, x, y) {
    var seen = {};
    everyPlace(c).forEach(function (p) {
      if (p.owner !== 'family' || p.capo === capo || seen[p.capo] || far(x, y, p.x, p.y) > RULES.near) return;
      seen[p.capo] = true;
      c.grudge = c.grudge || {};
      c.grudge[pair(capo, p.capo)] = (c.grudge[pair(capo, p.capo)] || 0) + 1;
    });
  }
  function grudges(c) {
    return Object.keys(c.grudge || {}).filter(function (k) { return c.grudge[k] > 0; }).map(function (k) {
      return { a: k.split('|')[0], b: k.split('|')[1], level: c.grudge[k], feud: RULES.feud };
    });
  }
  function feuds(c) {
    return (c.feuds || []).map(function (q) { return { id: q.id, a: q.a, b: q.b, since: q.month, label: q.label }; });
  }
  function feuding(c, capo) { return (c.feuds || []).some(function (q) { return q.a === capo || q.b === capo; }); }
  // What share of his due a capo sends up: nothing while he sulks, half while he feuds.
  function willing(c, capo) {
    return (c.sulk && c.sulk[capo] > c.month) ? 0 : feuding(c, capo) ? 0.5 : 1;
  }
  // Grudges cool, and those that have piled up break out.
  function tempers(c, events) {
    c.grudge = c.grudge || {}; c.feuds = c.feuds || [];
    Object.keys(c.grudge).forEach(function (k) {
      var a = k.split('|')[0], b = k.split('|')[1];
      if (c.grudge[k] >= RULES.feud && !c.feuds.some(function (q) { return q.id === k; })) {
        var label = first(a) + ' and ' + first(b) + ' are at each other\'s throats over the same streets';
        c.feuds.push({ id: k, a: a, b: b, month: c.month, label: label });
        events.push({ type: 'feud', id: k, a: a, b: b, city: c.id, label: label });
      } else if (c.month % RULES.cool === 0 && c.grudge[k] > 0 && c.grudge[k] < RULES.feud) c.grudge[k] -= 1;
      if (!c.grudge[k]) delete c.grudge[k];
    });
  }
  // The boss rules for one of the two: the feud is over, and the other sulks.
  function rule(c, f, id, winner) {
    var q = (c.feuds || []).filter(function (x) { return x.id === id; })[0];
    if (!q) throw new Error('no such feud: ' + id);
    if (winner !== q.a && winner !== q.b) throw new Error(winner + ' is not part of this feud');
    var loser = winner === q.a ? q.b : q.a;
    c.feuds = c.feuds.filter(function (x) { return x !== q; });
    delete c.grudge[id];
    c.sulk = c.sulk || {};
    c.sulk[loser] = c.month + RULES.sulks;
    return { winner: winner, loser: loser };
  }

  // A price that grows with the family, rounded to the nearest $50.
  function swell(base, rate, n) { return Math.round(base * Math.pow(1 + rate, Math.max(0, n)) / 50) * 50; }
  // --- where capos come from ---
  // Who would join the family in this city today, and through which door.
  function doors(c, f) {
    var ours = everyPlace(c).filter(function (p) { return p.owner === 'family'; }), out = [];
    var gone = f.gone || {}, free = function (id) { return !f.men[id] && !gone[id] && !clubOf(c, id); };
    var add = function (id, door, by, why, price) {
      out.push({ capo: id, name: who(id).name, specialty: who(id).specialty, door: door, by: by, why: why, cost: swell(RULES.doors[price || door], RULES.crowd, Object.keys(f.men).length - 1) });
      return out[out.length - 1];
    };
    Object.keys(LURES).forEach(function (id) {
      var l = LURES[id];
      if (!free(id)) return;
      var needed = l.burnt && (c.burnt || 0) >= l.burnt;
      var ok = needed ? true : l.repelled ? c.repelled >= l.repelled
        : l.key ? ours.some(function (p) { return p.key === l.key; })
        : ours.filter(function (p) { return p.kind === l.runs; }).length >= l.n;
      if (ok) add(id, 'name', null, needed ? l.need : l.why, needed ? 'need' : 'name');
    });
    Object.keys(PEOPLE).forEach(function (id) {
      var p = PEOPLE[id];
      if (!free(id)) return;
      if (gone[p.mentor] === 'kill') return;
      if (p.mentor && f.men[p.mentor] && clubOf(c, p.mentor) && run(c, p.mentor).length >= RULES.reach[f.men[p.mentor].rank]) {
        add(id, 'rise', p.mentor, first(p.mentor) + ' runs all he can and vouches for him');
      }
      if (p.key && ours.some(function (q) { return q.key === p.key; })) add(id, 'figure', p.key, 'He ran the ' + KEYS[p.key].name + ' before it was ours');
    });
    // a rival's lieutenant listens once the family weighs enough in the city
    var his = function (id) { return everyPlace(c).filter(function (p) { return p.man === id; }); };
    if (c.rival && share(c).family >= RULES.turn) lieutenantsOf(c).forEach(function (id) {
      if (free(id) && his(id).length) add(id, 'poach', c.rival, 'He sees which way the city is going, and crosses with all he runs').places = his(id).length;
    });
    return out;
  }
  // Where a newcomer may plant his club: any free block the rivals do not hold.
  // In a city where the family has nothing yet, nobody knows him: any free block will do.
  function known(c) { return memo(c).places.some(function (p) { return p.owner === 'family'; }); }
  function spots(c) {
    var out = [], here = known(c);
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) if (!at(c, x, y) && (!here || grip(c, x, y) !== 'rival')) out.push({ x: x, y: y });
    return out;
  }
  // How many capos the city carries, and how many are there.
  function seats(c) {
    var ours = everyPlace(c).filter(function (p) { return p.owner === 'family'; });
    return { taken: ours.filter(function (p) { return p.kind === 'club'; }).length,
             total: RULES.seats + ours.filter(function (p) { return p.kind === 'key'; }).length };
  }
  // The boss says yes and picks the street where the man plants his club.
  function welcome(c, f, capo, x, y) { send(c, c, f, capo, x, y); }
  // Or he sends him to plant it in another city: the man knocked in `from`, and opens `to`. The road has its price.
  function send(from, to, f, capo, x, y) {
    var d = doors(from, f).filter(function (q) { return q.capo === capo; })[0];
    if (!d) throw new Error(capo + ' is not at the door');
    var away = to !== from, cost = d.cost + (away ? RULES.doors.road : 0);
    if (away && d.door === 'poach') throw new Error(first(capo) + ' stays where his places are');
    var s = seats(to);
    if (s.taken >= s.total) throw new Error('no seat left in ' + to.id + ': ' + s.total + ' capos is all the city carries until the family holds another key place');
    if (d.door === 'poach') {
      if (funds(f) < cost) throw new Error('the boss cannot pay the $' + cost + ' ' + first(capo) + ' asks to cross');
      spend(f, cost);
      // he crosses with every place he ran: the best one becomes his club
      var mine = places(to).filter(function (p) { return p.man === capo; }).sort(function (a, b) { return b.level - a.level || a.y - b.y || a.x - b.x; });
      mine.forEach(function (p, i) {
        to.blocks[key(p.x, p.y)] = { owner: 'family', kind: i ? p.kind : 'club', level: i ? p.level : Math.max(p.level, RULES.clubLevel), capo: capo };
      });
      changed(to);
      join(f, capo);
      return;
    }
    if (!inside(to, x, y)) throw new Error(x + ',' + y + ' is outside ' + to.id);
    if (at(to, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (known(to) && grip(to, x, y) === 'rival') throw new Error('these are the ' + (to.rival || places(to).filter(function (q) { return q.owner !== 'family'; })[0].owner) + 's\' streets');
    if (funds(f) < cost) throw new Error('the boss cannot pay the $' + cost + ' it takes to set ' + first(capo) + ' up');
    spend(f, cost);
    if (away && !known(to)) to.quiet = to.month + RULES.respite;
    settle(to, capo, x, y);
    join(f, capo);
  }
  // --- parting with a capo ---
  var PARTINGS = {
    retire: { name: 'Pay him off', gives: 'He leaves in peace. The others take over what he ran.' },
    kill: { name: 'Have him killed', gives: 'Half of what he ran goes with him, the police look closer, and the less loyal keep their money for a while.' },
    jail: { name: 'Give him to the police', gives: 'The heat falls and his places are padlocked. One day he is out.' }
  };
  function others(c, f, capo) { return Object.keys(f.men).filter(function (id) { return id !== capo && clubOf(c, id); }); }
  // The ways the boss can part with a man, and what each costs him today.
  function partings(c, f, capo) {
    if (!f.men[capo] || !clubOf(c, capo) || !others(c, f, capo).length) return [];
    return Object.keys(PARTINGS).map(function (way) {
      return { way: way, name: PARTINGS[way].name, gives: PARTINGS[way].gives, cost: way === 'retire' ? RULES.out.retire[f.men[capo].rank] : 0 };
    });
  }
  function part(c, f, capo, way) {
    if (!f.men[capo] || !clubOf(c, capo)) throw new Error(capo + ' is not one of yours in ' + c.id);
    if (!PARTINGS[way]) throw new Error('no such way to part with a man: ' + way);
    var left = others(c, f, capo), club = clubOf(c, capo), rank = f.men[capo].rank;
    if (!left.length) throw new Error(first(capo) + ' is the last capo you have in ' + c.id);
    if (way === 'retire') {
      var cost = RULES.out.retire[rank];
      if ((f.clean || 0) < cost) throw new Error('it takes $' + cost + ' of clean money to pay ' + first(capo) + ' off');
      f.clean -= cost;
    }
    // what he ran, the biggest first: the nearest capo with room takes each over, the rest close
    var his = places(c, capo).filter(function (p) { return p.kind !== 'club'; }).sort(function (a, b) { return b.level - a.level || a.y - b.y || a.x - b.x; });
    var runs = his.filter(function (p) { return p.kind !== 'key'; }).length, keep = way === 'retire' ? runs : way === 'kill' ? Math.ceil(runs / 2) : 0;
    var room = {}, out = { way: way, kept: 0, closed: 0 };
    left.forEach(function (id) { room[id] = RULES.reach[f.men[id].rank] - run(c, id).length; });
    var nearest = function (p, need) {
      return left.filter(function (id) { return !need || room[id] > 0; }).sort(function (a, b) {
        var ca = clubOf(c, a), cb = clubOf(c, b);
        return far(p.x, p.y, ca.x, ca.y) - far(p.x, p.y, cb.x, cb.y) || (a < b ? -1 : 1);
      })[0];
    };
    his.forEach(function (p) {
      var heir = p.kind === 'key' ? nearest(p, false) : keep > 0 ? nearest(p, true) : null;
      if (p.kind !== 'key') keep -= 1;
      if (heir) {
        c.blocks[key(p.x, p.y)].capo = heir;
        if (p.kind !== 'key') { room[heir] -= 1; out.kept += 1; }
      } else { delete c.blocks[key(p.x, p.y)]; out.closed += 1; }
    });
    delete c.blocks[key(club.x, club.y)];
    changed(c);
    // his quarrels, his plans and his sulks go with him
    c.ops = c.ops.filter(function (o) { return o.capo !== capo; });
    c.asks = c.asks.filter(function (a) { return a.capo !== capo; });
    c.feuds = (c.feuds || []).filter(function (q) { return q.a !== capo && q.b !== capo; });
    Object.keys(c.grudge || {}).forEach(function (k) { if (k.split('|').indexOf(capo) >= 0) delete c.grudge[k]; });
    if (c.sulk) delete c.sulk[capo];
    delete f.men[capo];
    f.gone = f.gone || {};
    f.gone[capo] = way;
    if (way === 'kill') {
      c.heat = Math.min(100, (c.heat || 0) + RULES.out.blood);
      c.sulk = c.sulk || {};
      left.forEach(function (id) {
        if (who(id).loyalty < RULES.out.steady) c.sulk[id] = Math.max(c.sulk[id] || 0, c.month + RULES.out.shaken);
      });
    }
    if (way === 'jail') {
      c.heat = Math.max(0, (c.heat || 0) - RULES.out.tip);
      c.jailed = c.jailed || [];
      c.jailed.push({ capo: capo, out: c.month + RULES.out.term, x: club.x, y: club.y, n: RULES.out.revenge + rank });
    }
    return out;
  }
  // A man the boss gave to the police is out: he burns what stands nearest to where his club was.
  function revenge(c, events) {
    c.jailed = (c.jailed || []).filter(function (j) {
      if (j.out > c.month) return true;
      places(c).filter(function (p) { return p.owner === 'family' && p.kind !== 'club' && p.kind !== 'key'; }).sort(function (a, b) {
        return far(a.x, a.y, j.x, j.y) - far(b.x, b.y, j.x, j.y) || a.y - b.y || a.x - b.x;
      }).slice(0, j.n).forEach(function (p) {
        delete c.blocks[key(p.x, p.y)];
        c.burnt = (c.burnt || 0) + 1;
        events.push({ type: 'burnt', capo: p.capo, city: c.id, x: p.x, y: p.y, kind: p.kind, by: j.capo,
                      label: first(j.capo) + ' is out, and burns ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + zoneOf(c, p.x, p.y).name });
      });
      changed(c);
      return false;
    });
  }
  // --- the family, and the building tree it carries from city to city ---
  // What one car of the family carries in a run.
  function loadOf(f) { return RULES.car.loads[Math.max(1, Math.min(3, (f.tech && f.tech.cars) || 1))]; }
  function carries(tier) { return 'A car carries $' + RULES.car.loads[tier] + ' a run'; }
  function nameOf(kind) { return kind === 'cars' ? 'Cars' : D.SITES[kind].name; }
  function createFamily() {
    var tech = {};
    KINDS.forEach(function (k) { tech[k] = RULES.learn.open.indexOf(k) >= 0 ? 1 : 0; });
    tech.cars = 1;
    return { tech: tech, men: {}, dirty: 0, clean: 0, study: null };
  }
  function likedBy(f, kind) {
    return Object.keys(f.men).filter(function (id) { return who(id).likes.indexOf(kind) >= 0; });
  }
  // Every trade: the tier the family knows, what the next one costs, and who in the family likes it.
  function tree(f) {
    var out = KINDS.map(function (kind) {
      var tier = f.tech[kind] || 0, wanted = likedBy(f, kind);
      return { kind: kind, name: D.SITES[kind].name, street: TERRAIN[kind], tier: tier, wanted: wanted,
               studying: f.study && f.study.kind === kind ? f.study.monthsLeft : 0,
               next: tier >= RULES.learn.cost.length ? null
                 : { tier: tier + 1, cost: RULES.learn.cost[tier], months: RULES.learn.months[tier] * (wanted.length ? RULES.learn.taught : 1) } };
    });
    // the cars: not a place, but learned the same way; asked for by the men whose tills were left full
    var cars = Math.max(1, f.tech.cars || 1), stuck = Object.keys(f.men).filter(function (id) { return f.men[id].stuck; });
    out.push({ kind: 'cars', name: 'Cars', street: null, tier: cars, wanted: cars < 3 ? stuck : [], gives: carries(cars),
               studying: f.study && f.study.kind === 'cars' ? f.study.monthsLeft : 0,
               next: cars >= 3 ? null : { tier: cars + 1, cost: RULES.learn.cost[cars], months: RULES.learn.months[cars] * (stuck.length ? RULES.learn.taught : 1), gives: carries(cars + 1) } });
    return out;
  }
  function research(f, kind) {
    if (!TERRAIN[kind] && kind !== 'cars') throw new Error('unknown kind of place: ' + kind);
    if (f.study) throw new Error('the family is already learning ' + nameOf(f.study.kind));
    var t = tree(f).filter(function (q) { return q.kind === kind; })[0];
    if (!t.next) throw new Error('there is nothing more to learn about ' + t.name);
    if ((f.clean || 0) < t.next.cost) throw new Error('it takes $' + t.next.cost + ' of clean money');
    f.clean -= t.next.cost;
    f.study = { kind: kind, tier: t.next.tier, monthsLeft: t.next.months };
  }
  // The closed trade each capo of the city would open first.
  function wishes(c, f) {
    var out = [];
    Object.keys(f.men).forEach(function (id) {
      if (!clubOf(c, id)) return;
      var kind = who(id).likes.filter(function (k) { return TERRAIN[k] && !(f.tech[k] >= 1) && who(id).refuses.indexOf(k) < 0; })[0];
      if (kind) out.push({ capo: id, kind: kind, name: D.SITES[kind].name, label: first(id) + ' wants to open a ' + D.SITES[kind].name.toLowerCase() });
      if (f.men[id].stuck && (f.tech.cars || 1) < 3) out.push({ capo: id, kind: 'cars', name: 'Cars', label: first(id) + ' wants bigger cars: his tills are piling up' });
    });
    return out;
  }
  // One month for the whole family: every city, then what it is learning.
  function month(f, cities) {
    var events = [];
    f.crowns = cities.reduce(function (n, c) { return n + keys(c).filter(function (k) { return k.owner === 'family'; }).length; }, 0);
    cities.forEach(function (c) { events = events.concat(stepMonth(c, f)); });
    if (f.study && --f.study.monthsLeft <= 0) {
      f.tech[f.study.kind] = f.study.tier;
      events.push({ type: 'learned', kind: f.study.kind, tier: f.study.tier, label: f.study.kind === 'cars' ? 'The family now drives cars that carry $' + RULES.car.loads[f.study.tier] + ' a run'
        : 'The family can now run a ' + D.SITES[f.study.kind].name.toLowerCase() + ' of tier ' + f.study.tier });
      f.study = null;
    }
    return events;
  }

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
      }
    });
    ((c.flow && c.flow.runs) || []).forEach(function (r) {
      var club = clubOf(c, r.capo);
      if (!club || !at(c, r.x, r.y)) return;
      var t = { kind: 'takings', cargo: 'cash', capo: r.capo, from: { x: r.x, y: r.y }, to: club, amount: r.amount,
                vehicle: r.capo + (r.own ? ':own' : ':car:' + (r.car || 1)), leg: r.leg || 0, home: { x: club.x, y: club.y } };
      if (r.own) t.own = true; // the capo drove this one himself
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
      blocks.push({ x: x, y: y, grip: grip(c, x, y), family: m.family[y * c.w + x], rival: m.rival[y * c.w + x] });
    }
    var choke = { load: loadOf(f), drink: liquor(c), goods: supplied(c), washed: flow.wash || {}, most: {}, cellar: {} };
    choke.smokers = everyPlace(c).filter(function (p) { return p.owner === 'family' && CHAINS[2].sells.indexOf(p.kind) >= 0; }).length;
    cellars(c).forEach(function (s) { choke.cellar[key(s.p.x, s.p.y)] = { most: RULES.truck.cellar * s.makes, cargo: s.cargo }; });
    laundries(c).forEach(function (l) { choke.most[key(l.x, l.y)] = l.most; });
    return {
      id: c.id, w: c.w, h: c.h, month: c.month, heat: c.heat || 0,
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
      keys: keys(c), share: share(c), seats: seats(c), takes: takes(c), asks: asks(c), doors: doors(c, f), grudges: grudges(c), feuds: feuds(c), trips: trips(c, f), tree: tree(f), wishes: wishes(c, f),
      money: { dirty: f.dirty, clean: f.clean || 0, washed: c.washed || 0, washes: washing(c).most, up: flow.up || 0, pay: flow.pay || 0, cut: flow.cut || 0, seized: flow.seized || 0 },
      capos: Object.keys(f.men).filter(function (id) { return clubOf(c, id); }).map(function (id) {
        var man = f.men[id], club = clubOf(c, id);
        return { id: id, name: who(id).name, specialty: who(id).specialty, rank: man.rank, rankName: RANKS[man.rank], x: club.x, y: club.y,
                 places: run(c, id).length, reach: RULES.reach[man.rank], sulks: Math.max(0, ((c.sulk || {})[id] || 0) - c.month), sent: (flow.sent || {})[id] || 0, at: whereabouts(c, f, id), cars: man.cars || 1, trucks: cellars(c).some(function (s) { return s.p.capo === id; }) ? man.trucks || 1 : 0, waiting: Math.round(man.waiting || 0), income: man.income, cash: man.cash, way: wayOf(id), plan: plan(c, f, id), partings: partings(c, f, id) };
      })
    };
  }
  function stepMonth(c, f) {
    var events = [];
    c.month += 1;
    c.flow = { up: 0, sent: {}, pay: 0, cut: 0, seized: 0, wash: {}, runs: [] }; // last month's money, for the screen
    settleTakes(c, events);
    Object.keys(f.men).forEach(function (capo) {
      var k = clubOf(c, capo) && !c.asks.some(function (a) { return a.capo === capo; }) && eyes(c, capo);
      if (!k) return;
      var way = wayOf(capo);
      var a = { id: c.id + ':' + k.key, capo: capo, key: k.key, x: k.x, y: k.y, way: way,
                cost: swell(RULES.keyCost * RULES.take[way].cost, RULES.greed, Math.max(f.crowns || 0, keys(c).filter(function (q) { return q.owner === 'family'; }).length)), months: RULES.take[way].months * RULES.keyMonths,
                why: 'his places stand all around it' };
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
    var drink = distil(c, f);
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var m = f.men[capo];
      m.cars = m.cars || 1;
      var load = loadOf(f), haul = collect(c, capo, m.cars, drives[capo], load);
      m.stuck = haul.full > 0;
      if (haul.went) m.help = { x: haul.went.x, y: haul.went.y, why: 'carry', kind: at(c, haul.went.x, haul.went.y).kind };
      var inc = haul.got + RULES.club, makes = drink.idle[capo] !== undefined,
          pay = wages(c, capo) + RULES.car.upkeep * (m.cars - 1) + (makes ? RULES.truck.upkeep * (m.trucks - 1) : 0), profit = inc - pay;
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
      var due = RULES.tribute * willing(c, capo);
      var sent = profit > 0 ? profit * due : 0;
      if (profit > 0) { f.dirty += sent; m.cash += profit * (1 - due); } else m.cash += profit;
      m.xp += run(c, capo).length;
      if (m.rank < RANKS.length - 1 && m.xp >= RULES.xp[m.rank + 1]) {
        m.rank += 1;
        events.push({ type: 'rank', capo: capo, city: c.id, rank: m.rank,
                      label: first(capo) + ' rises to ' + RANKS[m.rank] + ': he can now run ' + RULES.reach[m.rank] + ' places' });
      }
      var p = plan(c, f, capo);
      // what he cannot use goes up to the boss rather than sleep in his club; the bigger the man, the more of it he spends on himself
      var spare = m.cash - (p.cost || 0) - pay - RULES.pocket;
      if (spare > 0 && willing(c, capo) === 1 && (p.move === 'hold' || p.waiting !== 'money')) { m.cash -= spare; f.dirty += spare * (1 - RULES.keeps[m.rank]); sent += spare * (1 - RULES.keeps[m.rank]); }
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
    rivalGrows(c);
    rivalRaids(c, events);
    revenge(c, events);
    tempers(c, events);
    money(c, f, events);
    doors(c, f).forEach(function (d) {
      if (c.knocked[d.capo]) return;
      c.knocked[d.capo] = true;
      events.push({ type: 'knocks', capo: d.capo, city: c.id, door: d.door, by: d.by, cost: d.cost, label: d.name + ' would join the family. ' + d.why });
    });
    return events;
  }

  var api = { earns: earns, send: send, partings: partings, part: part, trips: trips, grudges: grudges, feuds: feuds, rule: rule, funds: funds, createFamily: createFamily, tree: tree, research: research, wishes: wishes, month: month, view: view, washing: washing, seats: seats, spots: spots, PEOPLE: PEOPLE, person: person, doors: doors, welcome: welcome, crown: crown, KEYS: KEYS, keys: keys, asks: asks, answer: answer, cover: cover, seed: seed, landing: landing, wayOf: wayOf, takes: takes, RANKS: RANKS, liquor: liquor, income: income, join: join, plan: plan, stepMonth: stepMonth, RULES: RULES, TERRAIN: TERRAIN, WORTH: WORTH, createCity: createCity, zoneOf: zoneOf, at: at, open: open, settle: settle, clubOf: clubOf,
              places: places, hold: hold, grip: grip, share: share, frontier: frontier, price: price, tradeOf: tradeOf, wants: wants };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurf = api;
})(typeof self !== 'undefined' ? self : this);
