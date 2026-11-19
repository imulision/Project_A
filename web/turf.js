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
    doors: { rise: 1000, figure: 1500, name: 2500, need: 1000 }, // dirty $ the boss pays to set a man up, by the door he came through
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
    }), blocks: {}, month: 0, rival: null, dice: 1, ops: [], asks: [], refused: {}, repelled: 0, burnt: 0, knocked: {}, grudge: {}, feuds: [], sulk: {}, heat: 0, washed: 0 };
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
      var out = { x: Number(xy[0]), y: Number(xy[1]), owner: p.owner, kind: p.kind, level: p.level, capo: p.capo };
      if (p.key) out.key = p.key;
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
  // Every place of the city, or only those a capo runs.
  function places(c, capo) {
    return memo(c).places.filter(function (p) { return capo === undefined || p.capo === capo; }).map(function (p) {
      var out = { x: p.x, y: p.y, owner: p.owner, kind: p.kind, level: p.level, capo: p.capo };
      if (p.key) out.key = p.key;
      return out;
    });
  }
  function run(c, capo) { return places(c, capo).filter(function (p) { return p.kind !== 'club' && p.kind !== 'key'; }); }
  // The key places of the city, and who holds each.
  function keys(c) {
    return places(c).filter(function (p) { return p.kind === 'key'; }).map(function (p) {
      return { key: p.key, name: KEYS[p.key].name, x: p.x, y: p.y, owner: p.owner, capo: p.capo, gives: KEYS[p.key].gives };
    });
  }
  // What the family's key places add up to, for one line of KEYS.
  function held(c, what) {
    return keys(c).reduce(function (n, k) { return n + (k.owner === 'family' && KEYS[k.key][what] || 0); }, 0);
  }
  function lift(c, kind) {
    return keys(c).reduce(function (n, k) {
      var l = k.owner === 'family' && KEYS[k.key].lifts;
      return n + (l && l.street === TERRAIN[kind] ? l.by : 0);
    }, 1);
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
    var club = places(c, capo).filter(function (p) { return p.kind === 'club'; })[0];
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
    return WORTH[p.kind] * RULES.yield * worth(c, p.x, p.y, p.kind) * (1 + RULES.bigger * (p.level - 1)) * (h.family / (h.family + h.rival)) * lift(c, p.kind)
      * (p.kind === 'speakeasy' ? RULES.dry + (1 - RULES.dry) * wet : 1);
  }
  function income(c, capo) {
    var wet = liquor(c).wet;
    return run(c, capo).reduce(function (n, p) { return n + earns(c, p, wet); }, clubOf(c, capo) ? RULES.club : 0);
  }
  function wages(c, capo) { return RULES.wage * run(c, capo).length; }

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
    if (!who(capo)) throw new Error('unknown capo: ' + capo);
    if (!f.men[capo]) f.men[capo] = { cash: RULES.purse, xp: 0, rank: 0, income: 0 };
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
  // Who answers when a family place is hit: the hardest capo with a club close by, or its own.
  function cover(c, x, y) {
    var p = at(c, x, y), best = { capo: p.capo, muscle: who(p.capo).muscle };
    places(c).forEach(function (q) {
      if (q.owner !== 'family' || q.kind !== 'club' || far(x, y, q.x, q.y) > RULES.cover) return;
      if (who(q.capo).muscle > best.muscle) best = { capo: q.capo, muscle: who(q.capo).muscle };
    });
    return best;
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
    var guard = cover(c, p.x, p.y);
    var e = { capo: p.capo, city: c.id, x: p.x, y: p.y, kind: p.kind, by: by, heldBy: guard.capo };
    var fury = 1 + places(c).filter(function (q) { return q.owner === 'family'; }).length / RULES.anger; // the bigger the family, the harder they come
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
    events.push(e);
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
      var around = places(c).filter(function (p) { return p.owner === 'family' && far(k.x, k.y, p.x, p.y) <= RULES.near; }).length;
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
    return places(c).filter(function (p) { return p.owner === 'family' && D.SITES[p.kind] && D.SITES[p.kind].wash; }).map(function (p) {
      return { most: D.SITES[p.kind].wash * worth(c, p.x, p.y, p.kind) * (1 + (p.level - 1) * 1.5), loss: D.SITES[p.kind].loss };
    }).sort(function (a, b) { return a.loss - b.loss; });
  }
  function money(c, f, events) {
    f.clean = f.clean || 0;
    // every man in the city is paid by his rank
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var due = RULES.pay[f.men[capo].rank], dirty = Math.min(due, Math.max(0, f.dirty)), clean = Math.min(due - dirty, Math.max(0, f.clean));
      f.dirty -= dirty; f.clean -= clean;
      if (dirty + clean < due) events.push({ type: 'unpaid', capo: capo, city: c.id, due: due, label: first(capo) + ' has not been paid this month' });
    });
    // the fronts wash what they can of what is left
    c.washed = 0;
    laundries(c).forEach(function (l) {
      var n = Math.max(0, Math.min(f.dirty, l.most));
      f.dirty -= n; f.clean += n * (1 - l.loss); c.washed += n;
    });
    // money that sleeps and blood in the streets draw the police
    var loud = events.filter(function (e) { return e.type === 'burnt' || e.type === 'repelled' || (e.type === 'taken' && e.way === 'force'); }).length;
    c.heat = (c.heat || 0) + (f.dirty > RULES.stash ? RULES.hot : 0) + loud * RULES.loud - RULES.cools * (held(c, 'shield') ? 2 : 1);
    c.heat = Math.max(0, Math.min(100, c.heat));
    if (c.heat >= 100) {
      var seized = Math.round(Math.max(0, f.dirty) * RULES.bust);
      f.dirty -= seized;
      c.heat = RULES.afterBust;
      events.push({ type: 'bust', city: c.id, seized: seized, label: 'The police raid the family\'s counting rooms and seize $' + seized });
    }
  }

  // --- capos who share a city ---
  function pair(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  // A capo who opens or takes a place within reach of another capo's leaves a grudge between them.
  function rub(c, capo, x, y) {
    var seen = {};
    places(c).forEach(function (p) {
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

  // --- where capos come from ---
  // Who would join the family in this city today, and through which door.
  function doors(c, f) {
    var ours = places(c).filter(function (p) { return p.owner === 'family'; }), out = [];
    var free = function (id) { return !f.men[id] && !clubOf(c, id); };
    var add = function (id, door, by, why, price) {
      out.push({ capo: id, name: who(id).name, specialty: who(id).specialty, door: door, by: by, why: why, cost: RULES.doors[price || door] });
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
      if (p.mentor && f.men[p.mentor] && clubOf(c, p.mentor) && run(c, p.mentor).length >= RULES.reach[f.men[p.mentor].rank]) {
        add(id, 'rise', p.mentor, first(p.mentor) + ' runs all he can and vouches for him');
      }
      if (p.key && ours.some(function (q) { return q.key === p.key; })) add(id, 'figure', p.key, 'He ran the ' + KEYS[p.key].name + ' before it was ours');
    });
    return out;
  }
  // Where a newcomer may plant his club: any free block the rivals do not hold.
  function spots(c) {
    var out = [];
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) if (!at(c, x, y) && grip(c, x, y) !== 'rival') out.push({ x: x, y: y });
    return out;
  }
  // How many capos the city carries, and how many are there.
  function seats(c) {
    var ours = places(c).filter(function (p) { return p.owner === 'family'; });
    return { taken: ours.filter(function (p) { return p.kind === 'club'; }).length,
             total: RULES.seats + ours.filter(function (p) { return p.kind === 'key'; }).length };
  }
  // The boss says yes and picks the street where the man plants his club.
  function welcome(c, f, capo, x, y) {
    var d = doors(c, f).filter(function (q) { return q.capo === capo; })[0];
    if (!d) throw new Error(capo + ' is not at the door');
    var s = seats(c);
    if (s.taken >= s.total) throw new Error('no seat left in ' + c.id + ': ' + s.total + ' capos is all the city carries until the family holds another key place');
    if (!inside(c, x, y)) throw new Error(x + ',' + y + ' is outside ' + c.id);
    if (at(c, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (grip(c, x, y) === 'rival') throw new Error('these are the ' + (c.rival || places(c).filter(function (q) { return q.owner !== 'family'; })[0].owner) + 's\' streets');
    if (funds(f) < d.cost) throw new Error('the boss cannot pay the $' + d.cost + ' it takes to set ' + first(capo) + ' up');
    spend(f, d.cost);
    settle(c, capo, x, y);
    join(f, capo);
  }
  // --- the family, and the building tree it carries from city to city ---
  function createFamily() {
    var tech = {};
    KINDS.forEach(function (k) { tech[k] = RULES.learn.open.indexOf(k) >= 0 ? 1 : 0; });
    return { tech: tech, men: {}, dirty: 0, clean: 0, study: null };
  }
  function likedBy(f, kind) {
    return Object.keys(f.men).filter(function (id) { return who(id).likes.indexOf(kind) >= 0; });
  }
  // Every trade: the tier the family knows, what the next one costs, and who in the family likes it.
  function tree(f) {
    return KINDS.map(function (kind) {
      var tier = f.tech[kind] || 0, wanted = likedBy(f, kind);
      return { kind: kind, name: D.SITES[kind].name, street: TERRAIN[kind], tier: tier, wanted: wanted,
               studying: f.study && f.study.kind === kind ? f.study.monthsLeft : 0,
               next: tier >= RULES.learn.cost.length ? null
                 : { tier: tier + 1, cost: RULES.learn.cost[tier], months: RULES.learn.months[tier] * (wanted.length ? RULES.learn.taught : 1) } };
    });
  }
  function research(f, kind) {
    if (!TERRAIN[kind]) throw new Error('unknown kind of place: ' + kind);
    if (f.study) throw new Error('the family is already learning ' + D.SITES[f.study.kind].name);
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
    });
    return out;
  }
  // One month for the whole family: every city, then what it is learning.
  function month(f, cities) {
    var events = [];
    cities.forEach(function (c) { events = events.concat(stepMonth(c, f)); });
    if (f.study && --f.study.monthsLeft <= 0) {
      f.tech[f.study.kind] = f.study.tier;
      events.push({ type: 'learned', kind: f.study.kind, tier: f.study.tier, label: 'The family can now run a ' + D.SITES[f.study.kind].name.toLowerCase() + ' of tier ' + f.study.tier });
      f.study = null;
    }
    return events;
  }

  // --- what moves in the streets ---
  // The trips of the month, for the map: liquor from the nearest still to each
  // bar, every place's takings to its capo's club, the boss's dirty money from
  // the clubs to the laundries, and the crews on their way to what they take.
  function trips(c, f) {
    var ours = places(c).filter(function (p) { return p.owner === 'family'; }), out = [];
    var at2 = function (p) { return { x: p.x, y: p.y }; };
    var stills = ours.filter(function (p) { return p.kind === 'still'; });
    var washes = ours.filter(function (p) { return D.SITES[p.kind] && D.SITES[p.kind].wash; });
    ours.forEach(function (p) {
      var club = p.capo && clubOf(c, p.capo);
      if (p.kind === 'speakeasy' && stills.length) {
        var s = stills.reduce(function (a, b) { return far(p.x, p.y, b.x, b.y) < far(p.x, p.y, a.x, a.y) ? b : a; });
        out.push({ kind: 'liquor', cargo: 'liquor', capo: s.capo, from: at2(s), to: at2(p) });
      }
      if (club && p.kind !== 'club' && p.kind !== 'key') out.push({ kind: 'takings', cargo: 'cash', capo: p.capo, from: at2(p), to: club });
    });
    if (f.dirty > 0) washes.forEach(function (p) {
      var club = clubOf(c, p.capo);
      if (club) out.push({ kind: 'wash', cargo: 'cash', capo: p.capo, from: club, to: at2(p) });
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
  function view(c, f) {
    var m = memo(c), blocks = [];
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) {
      blocks.push({ x: x, y: y, grip: grip(c, x, y), family: m.family[y * c.w + x], rival: m.rival[y * c.w + x] });
    }
    return {
      id: c.id, w: c.w, h: c.h, month: c.month, heat: c.heat || 0,
      rival: c.rival || (places(c).filter(function (p) { return p.owner !== 'family'; })[0] || {}).owner || null,
      zones: c.zones.map(function (z) { return { name: z.name, x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1 }; }),
      blocks: blocks,
      places: places(c).map(function (p) {
        p.name = p.kind === 'club' ? 'Social Club' : p.kind === 'key' ? KEYS[p.key].name : D.SITES[p.kind].name;
        return { x: p.x, y: p.y, owner: p.owner, kind: p.kind, key: p.key, name: p.name, level: p.level, capo: p.capo };
      }).map(function (p) { if (!p.key) delete p.key; return p; }),
      keys: keys(c), share: share(c), seats: seats(c), takes: takes(c), asks: asks(c), doors: doors(c, f), grudges: grudges(c), feuds: feuds(c), trips: trips(c, f), tree: tree(f), wishes: wishes(c, f),
      money: { dirty: f.dirty, clean: f.clean || 0, washed: c.washed || 0, washes: washing(c).most },
      capos: Object.keys(f.men).filter(function (id) { return clubOf(c, id); }).map(function (id) {
        var man = f.men[id], club = clubOf(c, id);
        return { id: id, name: who(id).name, specialty: who(id).specialty, rank: man.rank, rankName: RANKS[man.rank], x: club.x, y: club.y,
                 places: run(c, id).length, reach: RULES.reach[man.rank], sulks: Math.max(0, ((c.sulk || {})[id] || 0) - c.month), income: man.income, cash: man.cash, way: wayOf(id), plan: plan(c, f, id) };
      })
    };
  }
  function stepMonth(c, f) {
    var events = [];
    c.month += 1;
    settleTakes(c, events);
    Object.keys(f.men).forEach(function (capo) {
      var k = clubOf(c, capo) && !c.asks.some(function (a) { return a.capo === capo; }) && eyes(c, capo);
      if (!k) return;
      var way = wayOf(capo);
      var a = { id: c.id + ':' + k.key, capo: capo, key: k.key, x: k.x, y: k.y, way: way,
                cost: Math.round(RULES.keyCost * RULES.take[way].cost), months: RULES.take[way].months * RULES.keyMonths,
                why: 'his places stand all around it' };
      c.asks.push(a);
      events.push({ type: 'asks', capo: capo, city: c.id, x: k.x, y: k.y, key: k.key, way: way, cost: a.cost, months: a.months,
                    label: first(capo) + ' wants the ' + KEYS[k.key].name + ' and asks for your word' });
    });
    Object.keys(f.men).forEach(function (capo) {
      if (!clubOf(c, capo)) return;
      var m = f.men[capo], inc = income(c, capo), pay = wages(c, capo), profit = inc - pay;
      m.income = inc;
      var due = RULES.tribute * willing(c, capo);
      if (profit > 0) { f.dirty += profit * due; m.cash += profit * (1 - due); } else m.cash += profit;
      m.xp += run(c, capo).length;
      if (m.rank < RANKS.length - 1 && m.xp >= RULES.xp[m.rank + 1]) {
        m.rank += 1;
        events.push({ type: 'rank', capo: capo, city: c.id, rank: m.rank,
                      label: first(capo) + ' rises to ' + RANKS[m.rank] + ': he can now run ' + RULES.reach[m.rank] + ' places' });
      }
      var p = plan(c, f, capo);
      // what he cannot use goes up to the boss rather than sleep in his club
      var spare = m.cash - (p.cost || 0) - pay - RULES.pocket;
      if (spare > 0 && willing(c, capo) === 1 && (p.move === 'hold' || p.waiting !== 'money')) { m.cash -= spare; f.dirty += spare; }
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
    tempers(c, events);
    money(c, f, events);
    doors(c, f).forEach(function (d) {
      if (c.knocked[d.capo]) return;
      c.knocked[d.capo] = true;
      events.push({ type: 'knocks', capo: d.capo, city: c.id, door: d.door, by: d.by, cost: d.cost, label: d.name + ' would join the family. ' + d.why });
    });
    return events;
  }

  var api = { trips: trips, grudges: grudges, feuds: feuds, rule: rule, funds: funds, createFamily: createFamily, tree: tree, research: research, wishes: wishes, month: month, view: view, washing: washing, seats: seats, spots: spots, PEOPLE: PEOPLE, person: person, doors: doors, welcome: welcome, crown: crown, KEYS: KEYS, keys: keys, asks: asks, answer: answer, cover: cover, seed: seed, landing: landing, wayOf: wayOf, takes: takes, RANKS: RANKS, liquor: liquor, income: income, join: join, plan: plan, stepMonth: stepMonth, RULES: RULES, TERRAIN: TERRAIN, WORTH: WORTH, createCity: createCity, zoneOf: zoneOf, at: at, open: open, settle: settle, clubOf: clubOf,
              places: places, hold: hold, grip: grip, share: share, frontier: frontier, price: price, tradeOf: tradeOf, wants: wants };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurf = api;
})(typeof self !== 'undefined' ? self : this);
