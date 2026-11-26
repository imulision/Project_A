// The men of the family: who knocks at the door, sending a man to a city, the
// boss's table, the underboss of a city, and parting with a capo.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var S = typeof require === 'function' ? require('./turf-streets.js') : root.AshportTurfStreets;
  var B = typeof require === 'function' ? require('./turf-boss.js') : root.AshportTurfBoss;
  var RULES = R.RULES, NUMBER = R.NUMBER, key = R.key, inside = R.inside, at = R.at, far = R.far;
  var KEYS = P.KEYS, PEOPLE = P.PEOPLE, LURES = P.LURES, who = P.who, CHAIRS = P.CHAIRS, chairOf = P.chairOf, sits = P.sits, seated = P.seated,
      loyalty = P.loyalty, sway = P.sway, mood = P.mood;
  var lieutenantsOf = C.lieutenantsOf, zoneOf = C.zoneOf, changed = C.changed, memo = C.memo, everyPlace = C.everyPlace, places = C.places,
      run = C.run, clubOf = C.clubOf, settle = C.settle, grip = C.grip, share = C.share, price = C.price, others = C.others;
  var join = S.join, first = S.first, funds = S.funds, spend = S.spend;
  var called = function (id) { return who(id) ? first(id) : id; }; // a name for the player, even for somebody the rules do not know
  var swell = B.swell, town = C.town, dollars = R.dollars;

  // --- where capos come from ---
  // Who would join the family in this city today, and through which door.
  function doors(c, f) {
    var ours = everyPlace(c).filter(function (p) { return p.owner === 'family'; }), out = [];
    var gone = f.gone || {}, free = function (id) { return !f.men[id] && !gone[id] && !clubOf(c, id) && !seated(f, id); };
    var add = function (id, door, by, why, price) {
      var p = who(id), trade = C.tradeOf(id);
      out.push({ capo: id, name: p.name, specialty: p.specialty, muscle: p.muscle, business: p.business, cunning: p.cunning, charisma: p.charisma,
                 trade: trade && D.SITES[trade] ? D.SITES[trade].name : null, knows: !!(trade && f.tech && f.tech[trade] >= 1), door: door, by: by, why: why, cost: swell(RULES.doors[price || door], RULES.crowd, Object.keys(f.men).length - 1) });
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
      // (a man the boss is already paying for has given his word: he waits for the money even if his mentor loses a place meanwhile)
      if (p.mentor && f.men[p.mentor] && clubOf(c, p.mentor) && (run(c, p.mentor).length >= RULES.vouch || (f.promised || {})[id])) {
        add(id, 'rise', p.mentor, first(p.mentor) + ' runs ' + NUMBER[RULES.vouch] + ' places and vouches for him');
      }
      if (p.key && ours.some(function (q) { return q.key === p.key; })) add(id, 'figure', p.key, 'He ran the ' + KEYS[p.key].name + ' before it was ours');
    });
    // a rival's lieutenant listens once the family weighs enough in the city
    var his = function (id) { return everyPlace(c).filter(function (p) { return p.man === id; }); };
    // (a man the boss is already paying for has given his word: he waits for the money whatever the city does meanwhile)
    var heavy = share(c).family >= RULES.turn, promised = f.promised || {};
    if (c.rival) lieutenantsOf(c).forEach(function (id) {
      if ((heavy || promised[id]) && free(id) && his(id).length) add(id, 'poach', c.rival, 'He sees which way the city is going, and crosses with all he runs').places = his(id).length;
    });
    return out;
  }

  // Where a newcomer may plant his club: any free block the rivals do not hold.
  // In a city where the family has nothing yet, nobody knows him: any free block will do.
  function known(c) { return memo(c).places.some(function (p) { return p.owner === 'family'; }); }

  function spots(c) {
    var out = [], here = known(c);
    for (var y = 0; y < c.h; y++) for (var x = 0; x < c.w; x++) if (inside(c, x, y) && !at(c, x, y) && (!here || grip(c, x, y) !== 'rival')) out.push({ x: x, y: y });
    return out;
  }

  // Where a man plants his club when he is taken in: he chooses himself, the boss never does. A street made for his
  // trade first, then the one the rivals press on least. null when the city has no block for him.
  function clubSpot(c, capo) {
    var trade = C.tradeOf(capo), best = null;
    spots(c).forEach(function (s) {
      var w = trade ? C.worth(c, s.x, s.y, trade) : 1, r = C.hold(c, s.x, s.y).rival;
      if (!best || w > best.w || (w === best.w && r < best.r)) best = { x: s.x, y: s.y, w: w, r: r };
    });
    return best && { x: best.x, y: best.y };
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
    if (x === undefined || x === null) { var own = clubSpot(to, capo); if (own) { x = own.x; y = own.y; } }
    var d = doors(from, f).filter(function (q) { return q.capo === capo; })[0];
    if (!d) throw new Error(capo + ' is not at the door');
    var away = to !== from, cost = d.cost + (away ? RULES.doors.road : 0);
    if (away && d.door === 'poach') throw new Error(first(capo) + ' stays where his places are');
    var s = seats(to);
    if (s.taken >= s.total) throw new Error('no seat left in ' + town(to) + ': ' + s.total + ' capos is all the city carries until the family holds another key place');
    if (d.door === 'poach') {
      if (funds(f) < cost) throw new Error('the boss cannot pay the ' + dollars(cost) + ' ' + first(capo) + ' asks to cross');
      spend(f, cost);
      // he crosses with every place he ran: the best one becomes his club
      var mine = places(to).filter(function (p) { return p.man === capo; }).sort(function (a, b) { return b.level - a.level || a.y - b.y || a.x - b.x; });
      mine.forEach(function (p, i) {
        to.blocks[key(p.x, p.y)] = { owner: 'family', kind: i ? p.kind : 'club', level: i ? p.level : Math.max(p.level, RULES.clubLevel), capo: capo };
      });
      changed(to);
      join(f, capo);
      from.joined = from.month; to.joined = to.month;
      return;
    }
    if (x === undefined || x === null) throw new Error('no street left in ' + town(to) + ' for his club');
    if (!inside(to, x, y)) throw new Error(x + ',' + y + ' is outside ' + town(to));
    if (at(to, x, y)) throw new Error('there is already a place at ' + x + ',' + y);
    if (known(to) && grip(to, x, y) === 'rival') throw new Error('these are the ' + (to.rival || places(to).filter(function (q) { return q.owner !== 'family'; })[0].owner) + 's\' streets');
    if (funds(f) < cost) throw new Error('the boss cannot pay the ' + dollars(cost) + ' it takes to set ' + first(capo) + ' up');
    spend(f, cost);
    from.joined = from.month; to.joined = to.month; // the month the last man was taken in, here and where he goes
    if (away && !known(to)) to.quiet = to.month + RULES.respite;
    settle(to, capo, x, y);
    join(f, capo);
  }

  // --- the underboss ---
  // One capo the boss names to hold a city for him. He must still have his club there.
  function underOf(c) { return c.under && clubOf(c, c.under) ? c.under : null; }

  function underboss(c, f, capo) {
    if (!f.men[capo] || !clubOf(c, capo)) throw new Error(called(capo) + ' is not one of yours in ' + town(c));
    if (!others(c, f, capo).length) throw new Error('one capo holds ' + town(c) + ' alone: it needs no underboss yet');
    c.under = capo;
  }

  // --- parting with a capo ---
  var PARTINGS = {
    retire: { name: 'Pay him off', gives: 'He leaves in peace. The others take over what he ran.' },
    kill: { name: 'Have him killed', gives: 'Half of what he ran goes with him, the police look closer, and the less loyal keep their money for a while.' },
    jail: { name: 'Give him to the police', gives: 'The heat falls and his places are padlocked. One day he is out.' }
  };

  // The killings the family still remembers: one is forgotten every RULES.out.forgets months.
  function bloodOf(c, f) { return Math.max(0, (f.blood || 0) - Math.floor((c.month - (f.bloodAt || 0)) / RULES.out.forgets)); }

  // The ways the boss can part with a man, and what each costs him today.
  function partings(c, f, capo) {
    if (!f.men[capo] || !clubOf(c, capo) || !others(c, f, capo).length) return [];
    return Object.keys(PARTINGS).map(function (way) {
      var p = { way: way, name: PARTINGS[way].name, gives: PARTINGS[way].gives, cost: way === 'retire' ? RULES.out.retire[f.men[capo].rank] : 0 };
      if (way === 'kill') { // what it would cost today, in figures
        var n = bloodOf(c, f) + 1;
        p.price = { heat: RULES.out.blood, loyal: RULES.loyal.blood * n, months: RULES.out.shaken * n, blood: n,
                    shaken: others(c, f, capo).filter(function (id) { return loyalty(f, id) < RULES.out.steady; }).sort() };
      }
      return p;
    });
  }

  // A man is out of the family: his quarrels, his plans and his sulks go with him, and he never knocks again.
  function forget(c, f, capo, way) {
    c.ops = c.ops.filter(function (o) { return o.capo !== capo; });
    c.asks = c.asks.filter(function (a) { return a.capo !== capo; });
    c.feuds = (c.feuds || []).filter(function (q) { return q.a !== capo && q.b !== capo; });
    Object.keys(c.grudge || {}).forEach(function (k) { if (k.split('|').indexOf(capo) >= 0) delete c.grudge[k]; });
    if (c.sulk) delete c.sulk[capo];
    delete f.men[capo];
    f.gone = f.gone || {};
    f.gone[capo] = way;
  }

  function part(c, f, capo, way) {
    if (!f.men[capo] || !clubOf(c, capo)) throw new Error(called(capo) + ' is not one of yours in ' + town(c));
    if (!PARTINGS[way]) throw new Error('no such way to part with a man: ' + way);
    var left = others(c, f, capo), club = clubOf(c, capo), rank = f.men[capo].rank;
    if (!left.length) throw new Error(first(capo) + ' is the last capo you have in ' + town(c));
    if (way === 'retire') {
      var cost = RULES.out.retire[rank];
      if ((f.clean || 0) < cost) throw new Error('it takes ' + dollars(cost) + ' of clean money to pay ' + first(capo) + ' off');
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
    forget(c, f, capo, way);
    if (way === 'kill') {
      // blood calls blood: each killing the family still remembers makes the next one cost as much again
      var n = bloodOf(c, f) + 1, here = {};
      f.blood = n; f.bloodAt = c.month;
      out.blood = n; out.loyal = RULES.loyal.blood * n; out.months = RULES.out.shaken * n; out.shaken = [];
      c.heat = Math.min(100, (c.heat || 0) + RULES.out.blood);
      c.sulk = c.sulk || {};
      left.forEach(function (id) {
        here[id] = true;
        if (loyalty(f, id) < RULES.out.steady) { c.sulk[id] = Math.max(c.sulk[id] || 0, c.month + out.months); out.shaken.push(id); }
        sway(f, id, -out.loyal);
      });
      // the men of the other cities hear of it, half as hard
      Object.keys(f.men).forEach(function (id) { if (!here[id]) sway(f, id, -Math.round(out.loyal / 2)); });
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
      places(c).filter(function (p) { return p.owner === 'family' && p.kind !== 'club' && p.kind !== 'key' && p.kind !== 'hq'; }).sort(function (a, b) {
        return far(a.x, a.y, j.x, j.y) - far(b.x, b.y, j.x, j.y) || a.y - b.y || a.x - b.x;
      }).slice(0, j.n).forEach(function (p) {
        delete c.blocks[key(p.x, p.y)];
        c.burnt = (c.burnt || 0) + 1;
        events.push({ type: 'burnt', capo: p.capo, city: c.id, x: p.x, y: p.y, kind: p.kind, by: j.capo,
                      label: first(j.capo) + ' is out of jail, and burns ' + first(p.capo) + '\'s ' + D.SITES[p.kind].name.toLowerCase() + ' in ' + zoneOf(c, p.x, p.y).name });
      });
      changed(c);
      return false;
    });
  }

  // --- loyalty and betrayal ---
  // The family the men of a city would go over to.
  function rivalOf(c) {
    var theirs = everyPlace(c).filter(function (p) { return p.owner !== 'family'; })[0];
    return c.rival || (theirs && theirs.owner) || null;
  }

  // The boss makes a man a gift, in money that can be shown. Once a year at most.
  function gift(c, f, capo) {
    var m = f.men[capo], L = RULES.loyal;
    if (!m || !clubOf(c, capo)) throw new Error(called(capo) + ' is not one of yours in ' + town(c));
    if (giftWait(c, m) > 0) throw new Error(first(capo) + ' has had his gift not long ago');
    if ((f.clean || 0) < L.gift) throw new Error('it takes ' + dollars(L.gift) + ' of clean money to make ' + first(capo) + ' a gift');
    f.clean -= L.gift;
    sway(f, capo, L.warms);
    m.gifted = c.month;
  }
  function giftWait(c, m) { return m.gifted === undefined ? 0 : Math.max(0, RULES.loyal.again - (c.month - m.gifted)); }
  function gifts(c, f, capo) { return { cost: RULES.loyal.gift, wait: giftWait(c, f.men[capo]) }; }

  // The month's hearts. A quiet month brings a man back toward what he is. A bitter man is talked about the first
  // month, and after enough of them he goes over to the rivals with all he runs, unless he is the last capo in the city.
  function hearts(c, f, events) {
    Object.keys(f.men).forEach(function (capo) {
      var m = f.men[capo], club = clubOf(c, capo), L = RULES.loyal;
      if (!club) return;
      var is = loyalty(f, capo), born = Math.max(0, Math.min(100, who(capo).loyalty + RULES.cut[B.cutOf(c)].loyal + P.counsel(f))); // where he settles: his nature, and how hard the boss leans on this city
      if (m.moved) m.moved = false;
      else if (is !== born) m.loyal = is + (is < born ? 1 : -1) * Math.min(L.heals, Math.abs(born - is));
      if (mood(f, capo) !== 'bitter') { m.sour = 0; return; }
      m.sour = (m.sour || 0) + 1;
      var gang = rivalOf(c);
      if (m.sour === 1) {
        events.push({ type: 'whispers', capo: capo, city: c.id, x: club.x, y: club.y,
                      label: 'Word is that ' + first(capo) + (gang ? ' talks to the ' + gang + 's' : ' speaks against you') });
      }
      if (m.sour < L.turns || !gang || !others(c, f, capo).length) return;
      var his = places(c, capo).filter(function (p) { return p.kind !== 'club'; });
      his.forEach(function (p) { var b = c.blocks[key(p.x, p.y)]; b.owner = gang; delete b.capo; });
      delete c.blocks[key(club.x, club.y)];
      changed(c);
      forget(c, f, capo, 'turned');
      events.push({ type: 'betrayal', capo: capo, city: c.id, x: club.x, y: club.y, to: gang, places: his.length,
                    label: first(capo) + ' goes over to the ' + gang + 's and takes his ' + his.length + (his.length === 1 ? ' place' : ' places') + ' with him' });
    });
  }

  // --- the boss's table ---
  // A man at the door takes a chair instead of a street, for what he would have cost on one.
  function seat(c, f, capo, post) {
    var ch = chairOf(post);
    if (sits(f, post)) throw new Error('the ' + ch.name + '\'s chair is taken');
    var d = doors(c, f).filter(function (q) { return q.capo === capo; })[0];
    if (!d) throw new Error(capo + ' is not at the door');
    if (d.door === 'poach') throw new Error(first(capo) + ' stays where his places are');
    if (funds(f) < d.cost) throw new Error('the boss cannot pay the ' + dollars(d.cost) + ' ' + first(capo) + ' asks');
    spend(f, d.cost);
    f.table = f.table || {};
    f.table[post] = capo;
  }

  // The boss takes the chair back: the man leaves the family for good.
  function unseat(f, post) {
    var ch = chairOf(post), id = sits(f, post);
    if (!id) throw new Error('nobody sits there');
    f.table[post] = null;
    f.gone = f.gone || {}; f.gone[id] = 'left';
    return ch;
  }

  // The men of the table are paid like the others, dirty money first.
  function payTable(f, events) {
    var was = f.owed || {};
    f.owed = {};
    CHAIRS.forEach(function (ch) {
      var id = sits(f, ch.post);
      if (!id) return;
      if (funds(f) >= RULES.table.pay) spend(f, RULES.table.pay);
      else if (was[ch.post]) f.owed[ch.post] = true;   // still unpaid: it was said the first month
      else { f.owed[ch.post] = true; events.push({ type: 'unpaid', capo: id, post: ch.post, due: RULES.table.pay, label: first(id) + ' has not been paid' }); }
    });
  }

  var api = { gift: gift, gifts: gifts, hearts: hearts, seat: seat, unseat: unseat, payTable: payTable, doors: doors, spots: spots, clubSpot: clubSpot, seats: seats, welcome: welcome, send: send,
      underOf: underOf, underboss: underboss, partings: partings, part: part, revenge: revenge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfMen = api;
})(typeof self !== 'undefined' ? self : this);
