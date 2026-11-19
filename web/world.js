// The map of the game: six cities, their districts, the routes between
// them, and the family's posts. No drawing and no browser here.
//
// A capo runs a district (district.js does the work). Three seats at the
// boss's table serve the whole family. The boss names people; this file
// only keeps track of who holds what and runs every district each month.
//
// To change the map, edit CITIES and ROUTES. Nothing else needs to change.
(function (root) {
  'use strict';

  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;

  function place(id, name, nightlife, industry, port, wealth) {
    return { id: id, name: name, traits: { nightlife: nightlife, industry: industry, port: port, wealth: wealth } };
  }

  // x, y and terrain are for the map (the same list is read by the 3D view);
  // character says what the city is good for;
  // rival is the family that holds it at the start.
  var CITIES = [
    { id: 'ashport', name: 'Ashport', x: -70, y: 95, terrain: 'plain', character: 'The big city. Everything passes through it.', rival: 'Callahan',
      districts: [
        place('ashport-uptown', 'Uptown', 1.2, 0, 0, 1.5),
        place('ashport-hillside', 'Hillside', 1, 0.4, 0, 1.2),
        place('ashport-market', 'Market Street', 1.5, 0.5, 0, 1),
        place('ashport-station', 'Union Station', 0.8, 1, 0.8, 0.8),
        place('ashport-calabria', 'Little Calabria', 1.2, 0.5, 0, 0.5),
        place('ashport-canal', 'Canal Street', 1, 1, 0.8, 0.5),
        place('ashport-stockyards', 'Stockyards', 0.5, 1.5, 0.5, 0.5),
        place('ashport-docks', 'The Docks', 0.8, 1.2, 1.5, 0.5)
      ] },
    { id: 'calder', name: 'Calder Falls', x: 30, y: 20, terrain: 'mountains', character: 'A mill town in the hills. Foundries, quarries and unions.', rival: 'Northside',
      districts: [
        place('calder-millrace', 'Millrace', 0.5, 1.5, 0, 0.5),
        place('calder-highstreet', 'High Street', 1.2, 0.5, 0, 1.2),
        place('calder-landing', 'The Landing', 1, 0.8, 0.8, 0.5),
        place('calder-quarry', 'Quarry Row', 0.5, 1.2, 0, 0.5),
        place('calder-foundry', 'Foundry', 0.5, 1.5, 0, 0.5),
        place('calder-northgate', 'Northgate', 0.8, 0.5, 0, 1.2),
        place('calder-ironbridge', 'Iron Bridge', 1, 1, 0.5, 0.8)
      ] },
    { id: 'marrow', name: 'Marrow Bay', x: 75, y: 150, terrain: 'coast', character: 'A bay of canneries, shipyards and night boats.', rival: 'Callahan',
      districts: [
        place('marrow-oldtown', 'Old Town', 1.5, 0.5, 0, 1),
        place('marrow-cannery', 'Cannery Row', 0.5, 1.5, 1, 0.5),
        place('marrow-bayside', 'Bayside', 1.2, 0, 0.5, 1.5),
        place('marrow-flats', 'The Flats', 0.8, 1, 0, 0.5),
        place('marrow-lantern', 'Lantern Row', 1.5, 0, 0, 0.8),
        place('marrow-shipwrights', 'Shipwrights', 0.5, 1.2, 1.5, 0.5)
      ] },
    { id: 'dunmore', name: 'Dunmore', x: -15, y: 235, terrain: 'hills', character: 'Coal, rail and breweries. Hard men and company stores.', rival: 'Kessler',
      districts: [
        place('dunmore-depot', 'Depot', 0.8, 1.2, 0.8, 0.5),
        place('dunmore-coalhill', 'Coal Hill', 0.5, 1.5, 0, 0.5),
        place('dunmore-main', 'Main Street', 1.2, 0.5, 0, 1.2),
        place('dunmore-brewers', 'Brewers Yard', 1, 1.2, 0, 0.8),
        place('dunmore-pitrow', 'Pit Row', 0.5, 1.5, 0, 0.5),
        place('dunmore-gallows', 'Gallows Corner', 1.5, 0.5, 0, 0.5)
      ] },
    { id: 'lorne', name: 'Port Lorne', x: 50, y: 370, terrain: 'coast', character: 'The sea port at the border. Whisky comes in here.', rival: 'Dockers',
      districts: [
        place('lorne-harbour', 'Harbour', 1, 0.8, 1.5, 0.5),
        place('lorne-saltworks', 'Saltworks', 0.5, 1.5, 0.5, 0.5),
        place('lorne-chapel', 'Chapel Hill', 0.5, 0, 0, 1.5),
        place('lorne-netmakers', 'Netmakers', 0.8, 1, 1, 0.5),
        place('lorne-customs', 'Customs House', 0.5, 0.5, 1.5, 1.2),
        place('lorne-ropewalk', 'Rope Walk', 1.5, 0.5, 0.8, 0.5),
        place('lorne-breakwater', 'Breakwater', 0.8, 0.5, 1.2, 0.5)
      ] },
    { id: 'vesper', name: 'Saint Vesper', x: -85, y: 300, terrain: 'plain', character: 'The cathedral city. Judges, bishops and old money.', rival: 'Callahan',
      districts: [
        place('vesper-cathedral', 'Cathedral', 0.5, 0, 0, 1.5),
        place('vesper-tannery', 'Tannery', 0.5, 1.5, 0, 0.5),
        place('vesper-hill', 'Vesper Hill', 0.8, 0, 0, 1.5),
        place('vesper-lowgate', 'Lowgate', 1.5, 0.5, 0, 0.5),
        place('vesper-bishops', 'Bishops Court', 1, 0, 0, 1.5),
        place('vesper-slaughter', 'Slaughter Lane', 1, 1.2, 0, 0.5),
        place('vesper-paupers', 'Paupers Field', 0.8, 0.8, 0, 0.5)
      ] }
  ];
  var ROUTES = [
    { from: 'ashport', to: 'calder', kind: 'rail' },
    { from: 'ashport', to: 'marrow', kind: 'road' },
    { from: 'ashport', to: 'dunmore', kind: 'rail' },
    { from: 'calder', to: 'marrow', kind: 'road' },
    { from: 'marrow', to: 'dunmore', kind: 'road' },
    { from: 'dunmore', to: 'vesper', kind: 'road' },
    { from: 'dunmore', to: 'lorne', kind: 'rail' },
    { from: 'vesper', to: 'lorne', kind: 'road' },
    { from: 'marrow', to: 'lorne', kind: 'sea' }
  ];
  var SEATS = ['bookkeeper', 'routes', 'fixer'];
  var RULES = {
    startCash: 2500,     // dirty $ the boss starts with
    moveInCost: 1000,    // dirty $ the boss pays to set a capo up in a new district
    foothold: { share: 15, men: 11, crews: 1, trucks: 1, cars: 1, dirty: 500, clean: 0, heat: 20, goodwill: 40, sites: { still: 1, speakeasy: 1 } },
    attackEvery: 6,      // months before a rival family moves, and before it comes back after drawing blood
    attackAfterDefeat: 12, // months it takes to try again after being thrown back
    rivalCap: 6,         // the boldest a rival family ever gets
    rivalNerve: 0.5,     // what a rival family gains by drawing blood, and loses by being thrown back
    rivalMood: 2,        // how far those gains and losses can add up
    rivalStrength: 3,    // what a district must put up to throw the rivals back
    rivalGrowth: 0.5,    // how much bolder the rivals get every year
    hitStreets: 8,       // streets lost to a successful attack
    hitLoot: 0.2,        // share of the stash the rivals carry off
    alarm: 6,            // months a capo stays on his guard after a hit
    grace: 12,           // months the rivals leave a new foothold alone
    // Teaching the whole family what one man knows: clean $ and months, by ring of the wheel.
    research: { cost: [3000, 8000, 20000], months: [6, 9, 12] },
    // The building tree: the trades a new family knows, and what each tier of a
    // trade costs in clean money and months. `taught`: the share of the time it
    // takes when a capo in post likes the trade.
    tree: { open: ['still', 'speakeasy', 'rented', 'warehouse'], cost: [1000, 3500, 10000], months: [4, 6, 9], taught: 0.5 },
    promotionWait: 3,    // months a man waits for the boss's word before he takes his rank himself
    // Places at each rank: so many to start with, and one more for every so many districts held.
    places: { 1: { base: 2, every: 3 }, 2: { base: 1, every: 6 }, 3: { base: 0, every: 8 } },
    // The three ways into a district. None is cheap, quick or sure.
    takeover: {
      step: 0.25,        // every district the family holds makes the next one this much dearer
      force: { cur: 'dirty', cost: 1500, months: 6, edge: 6, dead: 4, start: { share: 20, heat: 35 } },
      bribe: { cur: 'dirty', cost: 3000, months: 4, skill: 12, fixer: 4, heat: 10, start: {} },
      buy:   { cur: 'clean', cost: 6000, months: 3, start: { heat: 10, goodwill: 50 } }
    },
    // The violent jobs a capo will not do without the boss's leave.
    jobs: {
      every: 12,         // months a capo waits before asking again
      expires: 3,        // months a question stays on the boss's desk
      hit: { muscle: 5, edge: 3, heat: 12, weakens: 3, lasts: 12, dead: 3, botchedHeat: 6 },
      kidnap: { ambition: 70, wealth: 1, poor: 300, skill: 10, ransom: 1500, heat: 15, goodwill: 8, botchedHeat: 20, arrested: 2 }
    }
  };
  var HOME = 'ashport-hillside';
  // The men a rival family leans on. Each killing the boss allows takes one of them.
  var LIEUTENANTS = {
    Callahan: ['Red Doyle', 'Mickey Flynn', 'Old Brennan'],
    Northside: ['Stan Wojcik', 'Karl Nowak', 'Leo "the Pole" Baran'],
    Kessler: ['Otto Kessler', 'Hans Voss', 'Emil Brandt'],
    Dockers: ['Big Jim Tully', 'Pat Shaughnessy', 'Ned Garrity']
  };
  var HISTORY = 24; // months of figures kept for each district

  // --- local men: every district has one the boss can raise to capo there ---
  var FIRST = ['Frank', 'Joe', 'Pete', 'Lou', 'Eddie', 'Mike', 'Nick', 'Ray', 'Sam', 'Walt', 'Gus', 'Benny', 'Carl', 'Jack', 'Tony', 'Al'];
  var LAST = ['Russo', 'Malone', 'Novak', 'Ferraro', 'Quinn', 'Schmidt', 'Marino', 'Dolan', 'Kovac', 'Barone', 'Hayes', 'Weiss', 'Conti', 'Brody', 'Lang', 'Greco', 'Walsh', 'Sorel', 'Dunn'];
  var TASTES = { nightlife: ['speakeasy', 'gambling'], industry: ['still', 'union'], port: ['warehouse', 'fence'], wealth: ['gambling', 'loans'] };
  function hash(text) {
    var h = 7;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 104729;
    return h;
  }
  function localId(districtId) { return 'local-' + districtId; }
  // He knows his streets and nothing else: middling at everything, loyal enough.
  function makeLocal(p, n) {
    var h = hash(p.id), top = 'nightlife';
    Object.keys(p.traits).forEach(function (k) { if (p.traits[k] > p.traits[top]) top = k; });
    var roll = function (shift, low, span) { return low + Math.floor(h / shift) % span; };
    return D.addCapo(localId(p.id), {
      id: localId(p.id), local: p.id, name: FIRST[(h + n) % FIRST.length] + ' ' + LAST[(h * 7 + n) % LAST.length], specialty: 'Local man',
      muscle: roll(1, 3, 3), business: roll(3, 3, 3), cunning: roll(9, 2, 4), charisma: roll(27, 3, 3),
      loyalty: roll(81, 55, 20), ambition: roll(243, 30, 30), likes: TASTES[top], refuses: []
    });
  }
  function local(districtId) {
    if (!placeOf(districtId)) throw new Error('no such district: ' + districtId);
    return D.CAPOS[localId(districtId)];
  }

  function cityOf(id) {
    for (var i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i];
    throw new Error('no such city: ' + id);
  }
  function district(w, id) {
    if (!w.districts[id]) throw new Error('no such district: ' + id);
    return w.districts[id];
  }
  function districts(w) {
    var list = [];
    CITIES.forEach(function (c) { c.districts.forEach(function (p) { list.push(w.districts[p.id]); }); });
    return list;
  }
  function familyDistricts(w) { return districts(w).filter(function (x) { return x.owner === 'family'; }); }
  function placeOf(id) {
    var found = null;
    CITIES.forEach(function (c) { c.districts.forEach(function (p) { if (p.id === id) found = p; }); });
    return found;
  }

  // Everyone who holds a post in the family.
  function posts(w) {
    var list = [];
    SEATS.forEach(function (s) { if (w.table[s]) list.push({ capo: w.table[s], post: s, by: 'boss' }); });
    Object.keys(w.underbosses).forEach(function (c) { list.push({ capo: w.underbosses[c], post: 'underboss:' + c, by: 'boss' }); });
    familyDistricts(w).forEach(function (x) { list.push({ capo: x.state.capo, post: x.id, by: x.appointedBy || 'boss' }); });
    (w.takeovers || []).forEach(function (t) { list.push({ capo: t.capo, post: 'takeover:' + t.district, by: t.by }); });
    return list;
  }
  // Only the people the boss named himself: the table, the underbosses, and
  // the capos of the districts no underboss looks after.
  function named(w) {
    return posts(w).filter(function (n) { return n.by === 'boss'; }).map(function (n) { return { capo: n.capo, post: n.post }; });
  }
  function mustBeFree(w, capo, districtId) {
    if (!D.CAPOS[capo]) throw new Error('unknown capo: ' + capo);
    var home = D.CAPOS[capo].local;
    if (home && home !== districtId) throw new Error(D.CAPOS[capo].name + ' only knows ' + placeOf(home).name);
    posts(w).forEach(function (n) { if (n.capo === capo) throw new Error(capo + ' already holds ' + n.post); });
  }
  // The underboss's choice: the free capo whose tastes suit the district
  // best, with a leaning toward men who think like him.
  function pickCapo(w, id, underboss) {
    var traits = placeOf(id).traits, taken = {}, best = null, bestScore = -1;
    posts(w).forEach(function (n) { taken[n.capo] = true; });
    Object.keys(D.CAPOS).forEach(function (key) {
      if (taken[key]) return;
      var c = D.CAPOS[key], score = 0;
      c.likes.forEach(function (k) {
        if (D.RACKETS.indexOf(k) >= 0) score = Math.max(score, traits[D.SITES[k].trait]);
        if (D.CAPOS[underboss].likes.indexOf(k) >= 0) score += 0.25;
      });
      if (score > bestScore) { best = key; bestScore = score; }
    });
    return best || localId(id); // no big name left: he raises the local man
  }
  function tableSupport(w) {
    return { bookkeeper: !!w.table.bookkeeper, routes: !!w.table.routes, fixer: !!w.table.fixer };
  }
  function shareSupport(w) {
    var s = tableSupport(w);
    familyDistricts(w).forEach(function (x) { x.state.support = { bookkeeper: s.bookkeeper, routes: s.routes, fixer: s.fixer }; });
  }

  function reachable(w, id) {
    var target = w.districts[id].city, cities = {};
    familyDistricts(w).forEach(function (x) { cities[x.city] = true; });
    if (cities[target]) return true;
    return ROUTES.some(function (r) { return (r.from === target && cities[r.to]) || (r.to === target && cities[r.from]); });
  }

  // The family moves into a district and the boss names who runs it.
  // (How a district is taken from a rival is a later step: for now it is given.)
  function claim(w, id, capo) {
    var x = district(w, id), p = placeOf(id), underboss = w.underbosses[x.city], by = 'boss';
    if (x.owner === 'family') throw new Error(id + ' is already the family\'s');
    if (capo) mustBeFree(w, capo, id);
    else if (!underboss) throw new Error('name a capo for ' + id + ': the family has no underboss in that city');
    if (!reachable(w, id)) throw new Error(id + ' is out of reach: the family holds nothing next to it');
    if (w.treasury.dirty + w.treasury.clean < RULES.moveInCost) throw new Error('the boss cannot afford to move into ' + id);
    if (!capo) { capo = pickCapo(w, id, underboss); by = underboss; }
    // street money first; clean money is good anywhere and covers the rest
    var street = Math.min(w.treasury.dirty, RULES.moveInCost);
    w.treasury.dirty -= street;
    w.treasury.clean -= RULES.moveInCost - street;
    install(w, id, capo, by, {});
  }
  // The capo walks in with a first crew, a still and a back room.
  function install(w, id, capo, by, more) {
    var x = district(w, id), p = placeOf(id);
    var start = { capo: capo, name: p.name, traits: p.traits, support: tableSupport(w), tech: known(w) };
    Object.keys(RULES.foothold).forEach(function (k) { start[k] = RULES.foothold[k]; });
    Object.keys(more).forEach(function (k) { start[k] = more[k]; });
    x.owner = 'family';
    x.state = D.createDistrict(start);
    x.appointedBy = by === 'boss' ? null : by;
  }

  // --- taking a district: by force, by bribery, or by buying it ---
  var WAYS = ['force', 'bribe', 'buy'];
  function wayOf(way) {
    if (WAYS.indexOf(way) < 0) throw new Error('no such way into a district: ' + way);
    return RULES.takeover[way];
  }
  function price(w, id, way) {
    var t = wayOf(way), held = familyDistricts(w).length;
    var worth = way === 'buy' ? Math.max(0.5, placeOf(id).traits.wealth) : 1;
    return Math.round(t.cost * worth * Math.pow(1 + RULES.takeover.step, Math.max(0, held - 1)));
  }
  function canPay(w, cur, cost) { return (cur === 'clean' ? w.treasury.clean : w.treasury.dirty + w.treasury.clean) >= cost; }
  function pay(w, cur, cost) {
    var street = cur === 'clean' ? 0 : Math.min(w.treasury.dirty, cost);
    w.treasury.dirty -= street;
    w.treasury.clean -= cost - street;
  }
  // The district the men set out from: the family's best-armed one in that city, or next to it.
  function baseFor(w, cityId) {
    var mine = familyDistricts(w), near = mine.filter(function (x) { return x.city === cityId; });
    if (!near.length) near = mine.filter(function (x) {
      return ROUTES.some(function (r) { return (r.from === cityId && r.to === x.city) || (r.to === cityId && r.from === x.city); });
    });
    return near.length ? near.reduce(function (a, b) { return b.state.crews > a.state.crews ? b : a; }) : null;
  }
  // How it looks for this man, this way, today.
  function odds(w, id, way, capo) {
    var x = district(w, id), t = wayOf(way), c = D.CAPOS[capo], base = baseFor(w, x.city), power, needed, why;
    if (!c) throw new Error('unknown capo: ' + capo);
    if (way === 'force') {
      power = c.muscle + 2 * (base ? base.state.crews : 0);
      needed = rivalStrength(w, x.city) + t.edge;
      why = 'his muscle and the street crews of ' + (base ? base.state.name : 'nobody') + ' against the ' + cityOf(x.city).rival + 's';
    } else if (way === 'bribe') {
      power = c.cunning + c.charisma + (w.table.fixer ? t.fixer : 0);
      needed = t.skill;
      why = 'his head and his tongue' + (w.table.fixer ? ', with the fixer behind him' : '; a fixer at the table would help');
    } else {
      power = needed = 1;
      why = 'money on the table: the deeds change hands';
    }
    return { odds: power >= needed ? 'good' : 'poor', power: power, needed: needed, why: why };
  }
  function takeover(w, id, way, capo) {
    var x = district(w, id), t = wayOf(way), underboss = w.underbosses[x.city], by = 'boss';
    if (x.owner === 'family') throw new Error(id + ' is already the family\'s');
    if ((w.takeovers || []).some(function (o) { return o.district === id; })) throw new Error('a takeover of ' + id + ' is already under way');
    if (!reachable(w, id)) throw new Error(id + ' is out of reach: the family holds nothing next to it');
    if (capo) mustBeFree(w, capo, id);
    else if (!underboss) throw new Error('name a capo for ' + id + ': the family has no underboss in that city');
    else { capo = pickCapo(w, id, underboss); by = underboss; }
    var cost = price(w, id, way);
    if (!canPay(w, t.cur, cost)) throw new Error('the boss cannot afford to ' + way + ' his way into ' + id);
    pay(w, t.cur, cost);
    var op = { district: id, city: x.city, way: way, capo: capo, by: by, month: w.month, months: t.months, cost: cost,
               odds: odds(w, id, way, capo).odds }; // settled on what the boss was shown, whatever happens meanwhile
    (w.takeovers = w.takeovers || []).push(op);
    return { district: id, way: way, capo: capo, months: t.months, cost: cost };
  }
  function takeovers(w) {
    return (w.takeovers || []).map(function (o) {
      var base = baseFor(w, o.city);
      return { district: o.district, city: o.city, way: o.way, capo: o.capo, months: o.months, cost: o.cost, odds: o.odds || odds(w, o.district, o.way, o.capo).odds,
               monthsLeft: Math.max(0, o.months - (w.month - o.month)), from: base ? base.id : null };
    });
  }
  function settle(w, o) {
    var t = RULES.takeover[o.way], p = placeOf(o.district), c = D.CAPOS[o.capo], rival = cityOf(o.city).rival;
    var who = c.name.split(' ')[0], base = baseFor(w, o.city);
    var e = { type: 'takeover', way: o.way, district: o.district, city: o.city, capo: o.capo };
    if ((o.odds || odds(w, o.district, o.way, o.capo).odds) === 'good') {
      install(w, o.district, o.capo, o.by, t.start);
      e.outcome = 'done';
      e.label = o.way === 'force' ? who + '\'s men take ' + p.name + ' from the ' + rival + 's, gun in hand'
              : o.way === 'bribe' ? 'The ' + rival + 's\' man in ' + p.name + ' takes the envelope: ' + who + ' walks in'
              : 'The deeds are signed: ' + p.name + ' is bought, and ' + who + ' moves in';
      e.effects = [p.name + ' is the family\'s', who + ' starts with ' + Math.round(w.districts[o.district].state.share) + '% of the streets'];
      if (o.way === 'force') e.effects.push('The police are watching: Heat ' + t.start.heat);
      return e;
    }
    e.outcome = 'failed';
    if (o.way === 'force') {
      e.dead = base ? Math.min(t.dead, base.state.men) : 0;
      if (base) { base.state.men -= e.dead; base.state.attacked = RULES.alarm; }
      w.nextAttack[o.city] = w.month; // the rivals answer at once
      e.label = who + '\'s men are thrown out of ' + p.name + ': ' + e.dead + ' dead, the ' + rival + 's are coming';
      e.effects = [e.dead + ' men dead', '$' + o.cost + ' lost', 'The ' + rival + 's strike back'];
    } else {
      if (base) base.state.heat = Math.min(100, base.state.heat + t.heat);
      e.label = 'The ' + rival + 's\' man in ' + p.name + ' keeps the money and talks: ' + who + ' comes back with nothing';
      e.effects = ['$' + o.cost + ' lost', 'Heat +' + t.heat + (base ? ' in ' + base.state.name : '')];
    }
    return e;
  }
  function runTakeovers(w, events) {
    w.takeovers = (w.takeovers || []).filter(function (o) {
      if (w.month - o.month < o.months) return true;
      events.push(settle(w, o));
      return false;
    });
  }

  // The boss puts a city in the hands of an underboss, who then names its capos.
  function setUnderboss(w, cityId, capo) {
    cityOf(cityId);
    var mine = familyDistricts(w).filter(function (x) { return x.city === cityId; });
    if (mine.length < 2) throw new Error('an underboss needs a city where the family holds two districts');
    mustBeFree(w, capo);
    w.underbosses[cityId] = capo;
  }

  function defence(s) { return D.defence(s); }
  function rivalStrength(w, cityId) {
    cityOf(cityId);
    var base = Math.min(RULES.rivalCap, RULES.rivalStrength + RULES.rivalGrowth * w.month / 12 + ((w.rivalMood || {})[cityId] || 0));
    var broken = !nextLieutenant(w, cityOf(cityId).rival); // a family with no lieutenant left never recovers
    return base - (broken || (w.weakened || {})[cityId] > 0 ? RULES.jobs.hit.weakens : 0);
  }

  // --- capos who grow: what they practise, their rank, what they unlock ---
  // pay is what the boss owes a man of that rank every month.
  var RANKS = [{ name: 'Soldier', xp: 0, pay: 0 }, { name: 'Capo', xp: 60, pay: 100 }, { name: 'Veteran', xp: 220, pay: 250 }, { name: 'Legend', xp: 600, pay: 500 }];

  function record(w, id) {
    if (!D.CAPOS[id]) throw new Error('unknown capo: ' + id);
    w.people = w.people || {};
    if (!w.people[id]) {
      w.people[id] = { xp: {}, rank: 0, abilities: [] };
      D.SECTORS.forEach(function (k) { w.people[id].xp[k] = 0; });
    }
    return w.people[id];
  }
  // What a man has learned so far. Reading it changes nothing.
  function person(w, id) {
    var r = (w.people || {})[id] || { xp: {}, rank: 0, abilities: [] }, xp = {}, total = 0;
    if (!D.CAPOS[id]) throw new Error('unknown capo: ' + id);
    D.SECTORS.forEach(function (k) { xp[k] = r.xp[k] || 0; total += xp[k]; });
    return { id: id, xp: xp, total: total, rank: r.rank, rankName: RANKS[r.rank].name, abilities: r.abilities.slice() };
  }
  // His district works with what he knows, and with the pride of his rank.
  function brief(w, x) {
    var r = record(w, x.state.capo);
    x.state.skills = r.abilities.slice();
    (w.shared || []).forEach(function (a) { if (x.state.skills.indexOf(a) < 0) x.state.skills.push(a); });
    x.state.rank = r.rank;
    x.state.tech = known(w);
  }
  // A month in post: he learns what his district did. Once he has earned the
  // next rank and a place is free, he waits for the boss to choose his ability.
  function learn(w, x, events) {
    var id = x.state.capo, r = record(w, id), did = D.practice(x.state);
    D.SECTORS.forEach(function (k) { r.xp[k] += did[k]; });
    w.offers = w.offers || {};
    var offer = w.offers[id];
    if (offer) {
      if (w.month - offer.month >= RULES.promotionWait) events.push(promote(w, id, offer.options[0]));
      return;
    }
    if (!earned(r) || placesLeft(w, r.rank + 1) <= 0) return;
    // the next ability of the two sectors he has practised most, among those he has not finished
    var open = D.SECTORS.filter(function (k) { return nextRing(r, k) < D.WHEEL[k].length; });
    open.sort(function (a, b) { return r.xp[b] - r.xp[a] || D.SECTORS.indexOf(a) - D.SECTORS.indexOf(b); });
    w.offers[id] = { capo: id, rank: r.rank + 1, month: w.month, district: x.id,
                     options: open.slice(0, 2).map(function (k) { return D.WHEEL[k][nextRing(r, k)].id; }) };
    events.push({ type: 'ready', capo: id, rank: r.rank + 1, rankName: RANKS[r.rank + 1].name, district: x.id, city: x.city,
                  label: D.CAPOS[id].name + ' has earned the rank of ' + RANKS[r.rank + 1].name + ' and waits for your word' });
  }
  function earned(r) {
    var total = 0;
    D.SECTORS.forEach(function (k) { total += r.xp[k] || 0; });
    return r.rank < RANKS.length - 1 && total >= RANKS[r.rank + 1].xp;
  }
  function placesAt(w, rank) {
    var p = RULES.places[rank];
    return p ? p.base + Math.floor(familyDistricts(w).length / p.every) : null;
  }
  function holders(w, rank) {
    var seen = {}, list = [];
    posts(w).forEach(function (n) {
      if (seen[n.capo]) return;
      seen[n.capo] = true;
      if (person(w, n.capo).rank === rank) list.push(n.capo);
    });
    return list;
  }
  function placesLeft(w, rank) {
    var promised = Object.keys(w.offers || {}).filter(function (id) { return w.offers[id].rank === rank; }).length;
    return placesAt(w, rank) - holders(w, rank).length - promised;
  }
  // The men who wait for the boss's word, each with the two abilities he can be given.
  function promotions(w) {
    return Object.keys(w.offers || {}).map(function (id) {
      var o = w.offers[id];
      return { capo: id, rank: o.rank, rankName: RANKS[o.rank].name, pay: RANKS[o.rank].pay, district: o.district,
               monthsLeft: Math.max(0, RULES.promotionWait - (w.month - o.month)),
               options: o.options.map(function (a) {
                 var x = D.ABILITIES[a];
                 return { id: a, sector: x.sector, name: x.ability.name, text: x.ability.text };
               }) };
    });
  }
  // The boss's word: the man rises and takes the ability chosen for him.
  function promote(w, id, abilityId) {
    var o = (w.offers || {})[id];
    if (!o) throw new Error(id + ' is not waiting for a promotion');
    if (o.options.indexOf(abilityId) < 0) throw new Error(abilityId + ' is not on offer to ' + id);
    var r = record(w, id), ability = D.ABILITIES[abilityId].ability, c = D.CAPOS[id];
    r.rank = o.rank;
    r.abilities.push(abilityId);
    delete w.offers[id];
    var x = familyDistricts(w).filter(function (d) { return d.state.capo === id; })[0];
    if (x) brief(w, x);
    return { type: 'promotion', capo: id, rank: r.rank, rankName: RANKS[r.rank].name, ability: abilityId, sector: D.ABILITIES[abilityId].sector,
             district: x ? x.id : o.district, city: w.districts[x ? x.id : o.district].city,
             label: c.name + ' is now a ' + RANKS[r.rank].name + ': ' + ability.name + ' (' + ability.text.toLowerCase() + ')' };
  }
  // The family rank by rank: its pay, its places, who holds it and who waits for one.
  function ranks(w) {
    return RANKS.map(function (k, rank) {
      var waiting = [];
      if (rank > 0) posts(w).forEach(function (n) {
        var r = (w.people || {})[n.capo];
        if (r && r.rank === rank - 1 && earned(r) && !(w.offers || {})[n.capo] && waiting.indexOf(n.capo) < 0) waiting.push(n.capo);
      });
      return { rank: rank, name: k.name, pay: k.pay, places: placesAt(w, rank), men: holders(w, rank), waiting: waiting };
    });
  }
  // Every man with a rank is owed his pay. One the boss cannot pay holds it against him.
  function payWages(w, events) {
    var seen = {};
    posts(w).forEach(function (n) {
      if (seen[n.capo]) return;
      seen[n.capo] = true;
      var pay = RANKS[person(w, n.capo).rank].pay, x = w.districts[n.post];
      var paid = pay === 0 || canPay(w, 'dirty', pay);
      if (pay > 0 && paid) {
        var street = Math.min(w.treasury.dirty, pay);
        pay2(w, street, pay - street);
      }
      if (x && x.state) x.state.paid = paid;
      if (!paid && x) events.push({ type: 'unpaid-wage', capo: n.capo, district: x.id, city: x.city,
                                    label: D.CAPOS[n.capo].name + ' has not been paid: he will take it out of your share' });
    });
  }
  function pay2(w, street, clean) {
    w.treasury.dirty -= street;
    w.treasury.clean -= clean;
    w.lastMonth.wages += street + clean;
    w.lastMonth.wagesFrom.dirty += street;
    w.lastMonth.wagesFrom.clean += clean;
  }
  function nextRing(r, sector) {
    return r.abilities.filter(function (id) { return D.ABILITIES[id].sector === sector; }).length;
  }

  // --- research: the boss pays for the whole family to learn what one man knows ---
  function ringOf(abilityId) {
    var x = D.ABILITIES[abilityId];
    if (!x) throw new Error('no such ability: ' + abilityId);
    return D.WHEEL[x.sector].map(function (a) { return a.id; }).indexOf(abilityId);
  }
  function knownBy(w, abilityId) {
    return posts(w).filter(function (n) { return person(w, n.capo).abilities.indexOf(abilityId) >= 0; }).map(function (n) { return n.capo; });
  }
  function researching(w) {
    var r = w.research;
    return r ? { id: r.id, building: !!r.tier, tier: r.tier || null, months: r.months, monthsLeft: Math.max(0, r.months - (w.month - r.month)), cost: r.cost } : null;
  }
  function research(w, abilityId) {
    if (D.SITES[abilityId]) return learnTrade(w, abilityId);
    if (!D.ABILITIES[abilityId]) throw new Error('no such ability or trade: ' + abilityId);
    var ring = ringOf(abilityId), cost = RULES.research.cost[ring];
    if (w.research) throw new Error('the family is already learning ' + w.research.id);
    if ((w.shared || []).indexOf(abilityId) >= 0) throw new Error('the family already knows ' + abilityId);
    if (!knownBy(w, abilityId).length) throw new Error('nobody in the family knows ' + abilityId + ' yet');
    if (w.treasury.clean < cost) throw new Error('research is paid in clean money: $' + cost + ' needed');
    w.treasury.clean -= cost;
    w.research = { id: abilityId, month: w.month, months: RULES.research.months[ring], cost: cost };
  }
  function runResearch(w, events) {
    var r = w.research;
    if (!r || w.month - r.month < r.months) return;
    if (r.tier) {
      w.tree = known(w);
      w.tree[r.id] = r.tier;
      w.research = null;
      familyDistricts(w).forEach(function (x) { x.state.tech = known(w); });
      events.push({ type: 'research', building: r.id, tier: r.tier, district: HOME, city: w.districts[HOME].city,
                    label: r.tier === 1 ? 'The family has learned a new trade: ' + D.SITES[r.id].name + '. The capos can open one where it pays'
                                        : D.SITES[r.id].name + ' reaches tier ' + TIERS[r.tier] + ': the capos can make theirs bigger' });
      return;
    }
    w.shared = w.shared || [];
    w.shared.push(r.id);
    w.research = null;
    var a = D.ABILITIES[r.id].ability;
    events.push({ type: 'research', ability: r.id, sector: D.ABILITIES[r.id].sector, district: HOME, city: w.districts[HOME].city,
                  label: 'The whole family now knows ' + a.name + ': ' + a.text.toLowerCase() + ', in every district' });
  }

  // --- the building tree: the trades the family knows, and the tier of each ---
  var TIERS = ['', 'I', 'II', 'III'];
  function startTree() {
    var t = {};
    Object.keys(D.SITES).forEach(function (k) { t[k] = RULES.tree.open.indexOf(k) >= 0 ? 1 : 0; });
    return t;
  }
  // A copy of what the family knows. A game saved before the tree existed knows everything.
  function known(w) {
    var t = {};
    Object.keys(D.SITES).forEach(function (k) { t[k] = w.tree ? w.tree[k] || 0 : D.RULES.maxLevel; });
    return t;
  }
  function likedBy(w, kind) {
    return posts(w).filter(function (n) { return D.CAPOS[n.capo].likes.indexOf(kind) >= 0; }).map(function (n) { return n.capo; });
  }
  // The next tier of a trade: its price and how long it takes. A capo who likes the trade teaches it faster.
  function nextTier(w, kind) {
    var tier = known(w)[kind] + 1;
    if (tier > D.RULES.maxLevel) return null;
    var months = RULES.tree.months[tier - 1];
    if (likedBy(w, kind).length) months = Math.ceil(months * RULES.tree.taught);
    return { tier: tier, cost: RULES.tree.cost[tier - 1], months: months };
  }
  function learnTrade(w, kind) {
    var next = nextTier(w, kind);
    if (w.research) throw new Error('the family is already learning ' + w.research.id);
    if (!next) throw new Error(D.SITES[kind].name + ' is as far as it goes');
    if (w.treasury.clean < next.cost) throw new Error('research is paid in clean money: $' + next.cost + ' needed');
    w.treasury.clean -= next.cost;
    w.research = { id: kind, tier: next.tier, month: w.month, months: next.months, cost: next.cost };
  }
  // The tree for the screen: every trade, its tier, the next step and who asks for it.
  function tree(w) {
    var t = known(w), asking = {}, now = researching(w);
    familyDistricts(w).forEach(function (x) {
      var wish = D.wish(x.state);
      if (wish) (asking[wish.site] = asking[wish.site] || []).push(x.state.capo);
    });
    return Object.keys(D.SITES).map(function (k) {
      return { id: k, name: D.SITES[k].name, role: D.roleOf(k), tier: t[k], of: D.RULES.maxLevel, next: nextTier(w, k),
               likedBy: likedBy(w, k), wantedBy: asking[k] || [], monthsLeft: now && now.id === k ? now.monthsLeft : null };
    });
  }

  // The family's wheel: every ability, lit when a man in post holds it.
  function wheel(w) {
    var holders = {}, lit = 0;
    posts(w).forEach(function (n) {
      person(w, n.capo).abilities.forEach(function (id) { (holders[id] = holders[id] || []).push(n.capo); });
    });
    var sectors = D.SECTORS.map(function (k) {
      return { id: k, name: k.charAt(0).toUpperCase() + k.slice(1), rings: D.WHEEL[k].map(function (a, ring) {
        var by = holders[a.id] || [];
        if (by.length) lit += 1;
        var shared = (w.shared || []).indexOf(a.id) >= 0, now = w.research && w.research.id === a.id ? researching(w) : null;
        if (shared && !by.length) lit += 1;
        return { id: a.id, name: a.name, text: a.text, lit: by.length > 0 || shared, by: by, shared: shared,
                 research: { cost: RULES.research.cost[ring], months: RULES.research.months[ring],
                             open: by.length > 0 && !shared && !w.research, monthsLeft: now ? now.monthsLeft : null } };
      }) };
    });
    return { sectors: sectors, lit: lit, of: D.SECTORS.length * 3 };
  }

  // --- the violent jobs: a capo proposes, the boss rules ---
  function proposals(w) { return (w.proposals || []).filter(function (p) { return !p.approved; }); }

  function dead(w, family) { return (w.rivalDead || {})[family] || 0; }
  function nextLieutenant(w, family) { return LIEUTENANTS[family][dead(w, family)] || null; }
  // What the capo of that district would ask leave for this month, if anything.
  function wants(w, x) {
    var s = x.state, c = D.CAPOS[s.capo], J = RULES.jobs, rival = cityOf(x.city).rival, man = nextLieutenant(w, rival);
    if (man && c.muscle >= J.hit.muscle && (s.attacked > 0 || s.share >= D.RULES.rivalWall)) {
      var left = LIEUTENANTS[rival].length - dead(w, rival);
      return { kind: 'hit', target: man, family: rival, label: 'Wants ' + man + ' killed, a lieutenant of the ' + rival + 's',
               why: s.attacked > 0 ? 'they hit ' + s.name + ' and must answer for it' : 'they hold the streets he wants',
               gain: 'The ' + rival + 's are weaker for ' + J.hit.lasts + ' months' + (left === 1 ? ', and with their last lieutenant gone they never recover' : '; ' + (left - 1) + ' lieutenants left after him'),
               risk: 'Heat +' + J.hit.heat + ' in ' + s.name + '. If it fails: ' + J.hit.dead + ' of his men dead and the ' + rival + 's strike back',
               odds: c.muscle + 2 * s.crews >= rivalStrength(w, x.city) + J.hit.edge ? 'good' : 'poor' };
    }
    if (c.ambition >= J.kidnap.ambition && s.traits.wealth >= J.kidnap.wealth && s.profit < J.kidnap.poor) {
      return { kind: 'kidnap', target: 'a rich family of ' + s.name, label: 'Wants to kidnap a rich man\'s son for ransom',
               why: s.name + ' pays too little and there is money on the hill',
               gain: 'A ransom of $' + Math.round(J.kidnap.ransom * s.traits.wealth) + ' in dirty money',
               risk: 'Heat +' + J.kidnap.heat + ' and Goodwill -' + J.kidnap.goodwill + ' in ' + s.name + '. If it fails: ' + J.kidnap.arrested + ' men arrested and Heat +' + J.kidnap.botchedHeat,
               odds: c.cunning + c.muscle >= J.kidnap.skill ? 'good' : 'poor' };
    }
    return null;
  }

  function propose(w, events) {
    familyDistricts(w).forEach(function (x) {
      if (w.month < (x.quietUntil || 0)) return;
      if (w.proposals.some(function (p) { return p.district === x.id; })) return;
      var ask = wants(w, x);
      if (!ask) return;
      w.nextProposal = (w.nextProposal || 0) + 1;
      var p = { id: 'p' + w.nextProposal, kind: ask.kind, district: x.id, city: x.city, capo: x.state.capo, target: ask.target,
                family: ask.family, label: ask.label, why: ask.why,
                gain: ask.gain, risk: ask.risk, odds: ask.odds, month: w.month, approved: false };
      w.proposals.push(p);
      events.push({ type: 'proposal', id: p.id, kind: p.kind, district: p.district, city: p.city, capo: p.capo, label: p.label, why: p.why });
    });
  }

  // The boss's answer. A yes is carried out the month after; a no is remembered.
  function rule(w, id, yes) {
    var p = proposals(w).filter(function (q) { return q.id === id; })[0];
    if (!p) throw new Error('no such proposal: ' + id);
    var x = w.districts[p.district];
    x.quietUntil = w.month + RULES.jobs.every;
    if (yes) { p.approved = true; return; }
    w.proposals.splice(w.proposals.indexOf(p), 1);
    if (x.state && x.state.capo === p.capo) x.state.grudge += 1;
  }

  function carryOut(w, p) {
    var x = w.districts[p.district], s = x.state, J = RULES.jobs[p.kind];
    if (!s || x.owner !== 'family') return null;
    var c = D.CAPOS[s.capo], who = c.name.split(' ')[0] + '\'s men';
    var e = { type: 'job', kind: p.kind, district: p.district, city: p.city, capo: s.capo, target: p.target };
    if (p.kind === 'hit') {
      if (c.muscle + 2 * s.crews >= rivalStrength(w, p.city) + J.edge) {
        e.outcome = 'done';
        w.weakened[p.city] = J.lasts;
        w.rivalDead = w.rivalDead || {};
        w.rivalDead[p.family] = dead(w, p.family) + 1;
        s.heat = Math.min(100, s.heat + J.heat);
        e.label = who + ' gun down ' + p.target;
        e.effects = [nextLieutenant(w, p.family) ? 'The ' + p.family + 's are weaker for ' + J.lasts + ' months' : 'The ' + p.family + 's have no lieutenant left: they are broken for good',
                     'Heat +' + J.heat + ' in ' + s.name];
      } else {
        e.outcome = 'failed';
        e.dead = Math.min(J.dead, s.men);
        s.men -= e.dead;
        s.heat = Math.min(100, s.heat + J.botchedHeat);
        s.attacked = RULES.alarm;
        e.label = who + ' walk into a trap set by ' + p.target + ': ' + e.dead + ' dead, and the ' + p.family + 's are coming';
        e.effects = [e.dead + ' men dead', 'Heat +' + J.botchedHeat + ' in ' + s.name, 'The ' + p.family + 's strike back'];
      }
    } else {
      if (c.cunning + c.muscle >= J.skill) {
        e.outcome = 'done';
        e.ransom = J.ransom * s.traits.wealth;
        s.dirty += e.ransom;
        s.heat = Math.min(100, s.heat + J.heat);
        s.goodwill = Math.max(0, s.goodwill - J.goodwill);
        e.label = who + ' take a rich man\'s son: $' + Math.round(e.ransom) + ' paid for his return';
        e.effects = ['$' + Math.round(e.ransom) + ' of dirty money for ' + s.name, 'Heat +' + J.heat, 'Goodwill -' + J.goodwill];
      } else {
        e.outcome = 'failed';
        e.arrested = Math.min(J.arrested, s.men);
        s.men -= e.arrested;
        s.heat = Math.min(100, s.heat + J.botchedHeat);
        e.label = who + ' bungle a kidnapping: ' + e.arrested + ' arrested, the papers are full of it';
        e.effects = [e.arrested + ' men arrested', 'Heat +' + J.botchedHeat + ' in ' + s.name];
      }
    }
    return e;
  }

  function runJobs(w, events) {
    w.proposals = w.proposals || [];
    w.weakened = w.weakened || {};
    w.jobs = [];
    Object.keys(w.weakened).forEach(function (city) { if (w.weakened[city] > 0) w.weakened[city] -= 1; });
    w.proposals = w.proposals.filter(function (p) {
      if (p.approved) {
        var e = carryOut(w, p);
        if (e) { events.push(e); w.jobs.push({ kind: e.kind, outcome: e.outcome, district: e.district, city: e.city }); }
        return false;
      }
      if (w.month - p.month < RULES.jobs.expires) return true;
      w.districts[p.district].quietUntil = w.month + RULES.jobs.every; // left unanswered, it drops
      return false;
    });
    propose(w, events);
  }
  // The rival family of a city goes for the family's weakest district there.
  function attack(w, c) {
    var mine = familyDistricts(w).filter(function (x) { return x.city === c.id && (x.id === HOME || x.state.month > RULES.grace); });
    if (!mine.length) return null;
    var target = mine.reduce(function (a, b) { return defence(b.state) < defence(a.state) ? b : a; });
    var s = target.state, e = { type: 'attack', by: c.rival, district: target.id, city: c.id };
    if (defence(s) >= rivalStrength(w, c.id)) {
      e.outcome = 'repelled'; e.streets = 0; e.stolen = 0; e.site = null;
      e.label = 'The ' + c.rival + 's come for ' + s.name + ' and are thrown back';
      return e;
    }
    var site = null;
    Object.keys(s.sites).forEach(function (k) {
      if (k !== 'warehouse' && s.sites[k] > (site ? s.sites[site] : 0)) site = k;
    });
    e.outcome = 'hit';
    e.streets = Math.min(s.share, RULES.hitStreets);
    e.stolen = s.dirty * RULES.hitLoot;
    e.site = site;
    s.share -= e.streets;
    s.dirty -= e.stolen;
    s.lost += e.stolen;
    if (site) s.sites[site] -= 1;
    s.attacked = RULES.alarm;
    s.threat = rivalStrength(w, c.id);
    e.label = 'The ' + c.rival + 's hit ' + s.name + ': ' + (site ? 'a ' + D.SITES[site].name.toLowerCase() + ' burns, ' : '') + '$' + Math.round(e.stolen) + ' gone';
    return e;
  }

  // The boss replaces the capo of a district. The district stays as it is.
  function appoint(w, id, capo) {
    var x = district(w, id);
    if (x.owner !== 'family') throw new Error(id + ' is not the family\'s');
    mustBeFree(w, capo, id);
    x.state.capo = capo;
  }

  function seat(w, name, capo) {
    if (SEATS.indexOf(name) < 0) throw new Error('no such seat: ' + name);
    mustBeFree(w, capo);
    w.table[name] = capo;
    shareSupport(w);
  }
  function unseat(w, name) {
    if (SEATS.indexOf(name) < 0) throw new Error('no such seat: ' + name);
    w.table[name] = null;
    shareSupport(w);
  }

  // The figures of the month, kept for the curves of the screen.
  function remember(w, x, toBoss) {
    var s = x.state, m = s.last;
    x.history = x.history || [];
    x.history.push({ month: w.month, share: s.share, heat: s.heat, goodwill: s.goodwill, men: s.men,
                     income: m.income, profit: m.profit, toBoss: toBoss });
    if (x.history.length > HISTORY) x.history.shift();
  }
  function history(w, id) { return (district(w, id).history || []).slice(); }

  // One month everywhere. Returns what happened, tagged with its place.
  function stepMonth(w) {
    var events = [];
    w.lastMonth = { dirty: 0, clean: 0, wages: 0, wagesFrom: { dirty: 0, clean: 0 } };
    payWages(w, events);
    familyDistricts(w).forEach(function (x) {
      var before = { dirty: x.state.boss.dirty, clean: x.state.boss.clean };
      brief(w, x);
      D.stepMonth(x.state).forEach(function (e) {
        e.district = x.id;
        e.city = x.city;
        events.push(e);
      });
      w.treasury.dirty += x.state.boss.dirty - before.dirty;
      w.treasury.clean += x.state.boss.clean - before.clean;
      w.lastMonth.dirty += x.state.boss.dirty - before.dirty;
      w.lastMonth.clean += x.state.boss.clean - before.clean;
      remember(w, x, x.state.boss.dirty - before.dirty + x.state.boss.clean - before.clean);
      learn(w, x, events);
    });
    w.month += 1;
    runJobs(w, events);
    w.attacks = [];
    w.rivalMood = w.rivalMood || {};
    w.nextAttack = w.nextAttack || {};
    runTakeovers(w, events);
    runResearch(w, events);
    CITIES.forEach(function (c) {
      if (w.month < (w.nextAttack[c.id] || RULES.attackEvery)) return;
      var e = attack(w, c);
      w.nextAttack[c.id] = w.month + (e && e.outcome === 'repelled' ? RULES.attackAfterDefeat : RULES.attackEvery);
      if (!e) return;
      var mood = (w.rivalMood[c.id] || 0) + (e.outcome === 'hit' ? RULES.rivalNerve : -RULES.rivalNerve);
      w.rivalMood[c.id] = Math.max(-RULES.rivalMood, Math.min(RULES.rivalMood, mood));
      events.push(e);
      w.attacks.push({ by: e.by, district: e.district, city: e.city, outcome: e.outcome, site: e.site });
    });
    return events;
  }

  // What moved on the map last month: the trips of every district the family
  // holds, each with its district and city, and the cars of the rivals who came.
  function trips(w) {
    var list = [];
    familyDistricts(w).forEach(function (x) {
      D.trips(x.state).forEach(function (t) { t.district = x.id; t.city = x.city; list.push(t); });
    });
    (w.attacks || []).forEach(function (a) {
      list.push({ kind: 'attack', flow: 'violence', from: 'rivals', to: a.outcome === 'hit' && a.site ? a.site : 'streets', vehicle: 'car', violent: true,
                  by: a.by, outcome: a.outcome, district: a.district, city: a.city });
    });
    takeovers(w).forEach(function (t) {
      if (!t.from) return;
      list.push({ kind: 'takeover', flow: t.way === 'force' ? 'violence' : 'money', from: 'hideout', to: 'rivals', vehicle: 'car',
                  violent: t.way === 'force', cargo: t.way === 'force' ? 'men' : t.way === 'bribe' ? 'dirty-cash' : 'cash',
                  way: t.way, target: t.district, district: t.from, city: w.districts[t.from].city });
    });
    (w.jobs || []).forEach(function (j) {
      list.push({ kind: j.kind, flow: 'violence', from: 'hideout', to: j.kind === 'hit' ? 'rivals' : 'streets', vehicle: 'car', violent: true,
                  outcome: j.outcome, district: j.district, city: j.city });
    });
    return list;
  }

  function cityReport(w, cityId) {
    var c = cityOf(cityId), mine = [];
    c.districts.forEach(function (p) { if (w.districts[p.id].owner === 'family') mine.push(w.districts[p.id].state); });
    var sum = function (k) { return mine.reduce(function (n, s) { return n + s[k]; }, 0); };
    return { id: c.id, name: c.name, districts: c.districts.length, held: mine.length,
             share: sum('share') / c.districts.length, heat: mine.length ? sum('heat') / mine.length : 0,
             men: sum('men') };
  }

  // Everything the map needs, as one plain object.
  function view(w) {
    return {
      month: w.month,
      treasury: { dirty: w.treasury.dirty, clean: w.treasury.clean },
      table: { bookkeeper: w.table.bookkeeper, routes: w.table.routes, fixer: w.table.fixer },
      underbosses: JSON.parse(JSON.stringify(w.underbosses)),
      routes: ROUTES.map(function (r) { return { from: r.from, to: r.to, kind: r.kind }; }),
      cities: CITIES.map(function (c) {
        var report = cityReport(w, c.id);
        return {
          id: c.id, name: c.name, x: c.x, y: c.y, terrain: c.terrain, character: c.character, held: report.held, share: report.share, heat: report.heat,
          districts: c.districts.map(function (p) {
            var x = w.districts[p.id], s = x.state;
            return { id: p.id, name: p.name, traits: p.traits, owner: x.owner, capo: s ? s.capo : null, appointedBy: x.appointedBy,
                     share: s ? s.share : 0, heat: s ? s.heat : 0, goodwill: s ? s.goodwill : 0, men: s ? s.men : 0,
                     crews: s ? s.crews : 0, watched: s ? s.watched > 0 : false,
                     buildings: s ? D.buildings(s) : [] };
          })
        };
      })
    };
  }

  function createWorld(options) {
    var o = options || {};
    var w = { month: 0, treasury: { dirty: RULES.startCash, clean: 0 }, table: { bookkeeper: null, routes: null, fixer: null },
              underbosses: {}, districts: {} };
    CITIES.forEach(function (c) {
      c.districts.forEach(function (p) { w.districts[p.id] = { id: p.id, city: c.id, owner: c.rival, state: null, appointedBy: null }; });
    });
    var home = placeOf(HOME);
    w.rivalDead = {};
    w.tree = startTree();
    w.districts[HOME].owner = 'family';
    w.districts[HOME].state = D.createDistrict({ capo: o.capo, name: home.name, traits: home.traits, tech: known(w) });
    return w;
  }

  CITIES.forEach(function (c) { c.districts.forEach(makeLocal); });

  var api = { HOME: HOME, LIEUTENANTS: LIEUTENANTS, HISTORY: HISTORY, local: local, history: history, research: research, researching: researching, tree: tree, promotions: promotions, promote: promote, ranks: ranks, WAYS: WAYS, price: price, odds: odds, takeover: takeover, takeovers: takeovers, CITIES: CITIES, ROUTES: ROUTES, SEATS: SEATS, RULES: RULES, setUnderboss: setUnderboss, defence: defence,
              rivalStrength: rivalStrength, posts: posts, reachable: reachable, cityOf: cityOf, placeOf: placeOf, createWorld: createWorld, district: district, districts: districts,
              claim: claim, appoint: appoint, seat: seat, unseat: unseat, named: named, stepMonth: stepMonth,
              cityReport: cityReport, view: view, trips: trips, proposals: proposals, rule: rule,
              RANKS: RANKS, person: person, wheel: wheel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportWorld = api;
})(typeof self !== 'undefined' ? self : this);
