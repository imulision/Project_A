// The audience: the boss is never left long with nothing to decide. When nobody has needed his word for a while, one of
// his capos comes to him with a matter: a question with two to four choices, each with its price and its effect written.
// Every matter stands on something the rules already know (the line and the share of a city, a trade to learn, a place a
// capo is saving for, the police, the rivals, the loyalty of a man), so a choice only ever moves what the rules hold.
// A refusal is remembered; a matter left waiting goes away by itself and changes nothing.
//
// No drawing and no browser here. empire.js calls raise() once a day and decide() when the boss answers.
// To retune, change RULES. To add a matter: one entry in DECK (when it can come up, what it says) and one in DONE.
(function (root) {
  'use strict';
  var node = typeof require === 'function';
  var T = node ? require('./turf.js') : root.AshportTurf;
  var X = node ? require('./dilemma.js') : root.AshportDilemma;

  var RULES = {
    first: 10,          // days after the first club before the first capo asks the boss for his line
    every: 100,         // days with no word to give before somebody comes with a matter
    early: 45,          // the same while the family is still a street gang: the first act is short and full
    soon: 30,           // days after the boss's last word before a capo asks for a trade the family can pay to learn
    again: 288,         // days a capo does not ask again for what the boss refused him
    rest: 150,          // days before a matter of the same kind comes round again
    stale: 48,          // days a matter waits for the boss before it goes away by itself
    petty: 100,         // a capo does not go to the boss for less than this
    captain: { from: 20, base: 300, per: 15, cools: 25 }, // a captain who can be bought: the heat of the city he comes at, his price (and what each point of heat adds), the heat he takes away
    cargo: { gain: 600, heat: 12 },                       // a load with no owner: dirty $ it brings, heat it draws
    bail: { cost: 400, warms: 6, hurts: 4 },              // a man in a cell: what his bail costs, loyalty his capo gains, loyalty he loses if he is left there
    truce: { cost: 800, cycles: 6 },                      // peace bought from the rivals: its price, the cycles they leave the city alone
    feast: { cost: 250, warms: 5, hurts: 2 },             // the feast of a capo's street: what the boss's table costs, loyalty won, loyalty lost if he stays away
    banker: { from: 8000, part: 0.5, most: 200000, keeps: 0.6 }, // a banker who washes a lump: the dirty cash he comes at, the part of it he takes in, the most he handles, what comes back clean
    widow: { cost: 500, warms: 4 },                       // the widow of one of the family's men: her pension in clean money, loyalty every capo of the city gains
    favor: { warms: 3, heat: 6 }                          // a shopkeeper squeezed by the rivals: loyalty the capo gains if his men step in, heat it draws
  };

  var dollars = T.dollars, first = function (id) { return T.person(id).name.split(' ')[0]; };
  var days = function (n) { return n + ' days'; };
  function stateOf(g) { return g.audience || (g.audience = { last: 0, seen: {}, open: null }); }
  // A capo told no for his own ask waits a year; told no again, twice as long each time.
  function restOf(a, key) { return RULES.again * Math.pow(2, Math.min((a.snubs || {})[key] || 0, 4)); }
  function menOf(g, c) { return Object.keys(g.family.men).filter(function (id) { return T.clubOf(c, id); }); }
  function heldBy(g) { return g.cities.filter(function (c) { return menOf(g, c).length > 0; }); }
  // The man who speaks for a city: its underboss, or the first man the boss set up there.
  function voiceOf(g, c) { var men = menOf(g, c); return c.under && men.indexOf(c.under) >= 0 ? c.under : men[0]; }
  function sourest(g, c) { return menOf(g, c).sort(function (a, b) { return T.loyalty(g.family, a) - T.loyalty(g.family, b); })[0]; }
  var no = function (gives, costs) { return { id: 'no', label: 'No', gives: gives || 'You keep your money', costs: costs }; };

  // --- the matters a capo brings when it is his to ask ---
  function lineMatter(g, a, c) {
    var capo = voiceOf(g, c);
    return { key: 'line:' + c.id, kind: 'line', capo: capo, city: c.id, title: first(capo) + ' asks how you want ' + T.town(c) + ' run',
      says: 'Your capos lean the way you say, each according to his temper and his loyalty. You can change it any day on the sheet of the city.',
      choices: T.lines().map(function (l) { return { id: l.id, label: l.name, gives: l.gives, costs: l.costs }; }).concat([{ id: 'none', label: 'No line', gives: 'Each capo does as he sees fit' }]) };
  }
  function shareMatter(g, a, c) {
    var capo = voiceOf(g, c);
    return { key: 'share:' + c.id, kind: 'share', capo: capo, city: c.id, title: first(capo) + ' asks what share you take in ' + T.town(c),
      says: 'Your share of what every place makes. A light hand is loved, a heavy one is not: a man who turns bitter sends nothing, then leaves with his places.',
      choices: T.cuts().map(function (k) { return { id: k.id, label: k.id.charAt(0).toUpperCase() + k.id.slice(1) + ' · ' + Math.round(k.share * 100) + '%',
        gives: k.loyal > 0 ? 'Loyalty +' + k.loyal + ' for every capo of the city' : k.loyal < 0 ? 'More money up to you' : 'The share they expect', costs: k.loyal < 0 ? 'Loyalty −' + (-k.loyal) + ' for every capo of the city' : k.loyal > 0 ? 'Less money up to you' : undefined }; }) };
  }
  // A capo wants a trade the family can pay to learn today.
  function learnMatter(g, a, rested) {
    var f = g.family, found = null;
    if (f.study || (f.paying || []).some(function (p) { return p.order.type === 'research'; })) return null;
    heldBy(g).forEach(function (c) {
      T.wishes(c, f).forEach(function (w) {
        var t = T.tree(f).filter(function (q) { return q.kind === w.kind; })[0];
        if (found || !t || !t.next || (f.clean || 0) < t.next.cost || !rested('learn:' + w.kind, restOf(a, 'learn:' + w.kind) / 2)) return;
        found = { key: 'learn:' + w.kind, kind: 'learn', capo: w.capo, city: c.id, trade: w.kind, title: w.label,
          says: 'What the family learns, every capo can open. ' + first(w.capo) + ' likes this trade: it is learned twice as fast, and he will run it.',
          choices: [{ id: 'learn', label: t.tier ? 'Pay for it' : 'Learn it', cost: t.next.cost, money: 'clean', gives: t.next.gives + ' · ready in ' + days(Math.round(t.next.months * T.RULES.days)) },
                    no('You keep your clean money', first(w.capo) + ' does not ask again for ' + days(restOf(a, 'learn:' + w.kind)))] };
      });
    });
    return found;
  }
  // Clean money sleeps and something can be bought with it: the man who speaks for the home city says what.
  function investMatter(g, a, rested) {
    var f = g.family, c = heldBy(g)[0];
    if (!c || !rested('invest', restOf(a, 'invest') / 2) || (f.paying || []).some(function (p) { return p.order.type === 'buy'; })) return null;
    var can = T.holdings(f).filter(function (h) { return h.next && h.next.cost <= (f.clean || 0); }).sort(function (p, q) { return p.next.cost - q.next.cost; }).slice(0, 3);
    if (!can.length) return null;
    var who = voiceOf(g, c);
    return { key: 'invest', kind: 'invest', capo: who, city: c.id, title: dollars(f.clean) + ' of clean money sleeps',
      says: first(who) + ' says it should work for the family. What is bought is kept for good, and serves in every city.',
      choices: can.map(function (h) { return { id: h.id, label: (h.level ? 'More of the ' : 'Buy the ') + h.name, cost: h.next.cost, money: 'clean', gives: h.gives }; })
        .concat([no('You keep your clean money', first(who) + ' does not bring it up again for ' + days(restOf(a, 'invest')))]) };
  }
  // A capo saving for his next place, whom the boss could put there today with his dirty cash.
  function advanceMatter(g, a, rested) {
    var f = g.family, best = null;
    heldBy(g).forEach(function (c) {
      menOf(g, c).forEach(function (id) {
        var p = T.plan(c, f, id);
        if (!p || !rested('advance:' + id, restOf(a, 'advance:' + id) / 2)) return;
        var short = T.short(p);
        if (short < RULES.petty || f.dirty < short || (best && best.short <= short)) return;
        best = { c: c, id: id, p: p, short: short };
      });
    });
    if (!best) return null;
    var p = best.p, name = String(p.name || 'place').toLowerCase(), where = T.zoneOf(best.c, p.x, p.y).name;
    var what = p.move === 'enlarge' ? 'a bigger ' + name : p.move === 'convert' ? 'turning a place into ' + T.a(name) : T.a(name);
    return { key: 'advance:' + best.id, kind: 'advance', capo: best.id, city: best.c.id, x: p.x, y: p.y, trade: p.kind, short: best.short,
      title: first(best.id) + ' is ' + dollars(best.short) + ' short of ' + what,
      says: 'In ' + where + ': he has saved ' + dollars(p.saved) + ' of the ' + dollars(p.cost) + ' it takes. Put in the rest and he does it now; otherwise he saves alone.',
      choices: [{ id: 'pay', label: 'Put in the rest', cost: best.short, money: 'dirty', gives: 'He has the price today: the place sends money up that much sooner' },
                no('You keep your money', 'He saves alone, and does not ask again for ' + days(restOf(a, 'advance:' + best.id)))] };
  }

  // --- what the chief across the street has to say: brought at once ---
  function chiefMatter(g, a) {
    var found = null;
    heldBy(g).forEach(function (c) {
      var k = T.chief(c, g.family), w = k && k.word;
      if (found || !w || a.seen['chief:' + c.id + ':' + w.kind + ':' + w.since] !== undefined) return;
      var who = first(w.capo), him = k.name, short = him.split(' ')[0], said = function (text) { return T.voice(w.capo, text); }, temper = k.temper ? ' (' + k.temper.name.toLowerCase() + ')' : '', within = days(Math.max(1, w.months) * T.RULES.days);
      var m = { key: 'chief:' + c.id + ':' + w.kind + ':' + w.since, kind: w.kind, chief: k.id, capo: w.capo, city: c.id, x: w.x, y: w.y };
      if (w.kind === 'ultimatum') {
        var place = w.place.toLowerCase();
        m.title = him + ' wants ' + who + '\'s ' + place + ' back';
        m.says = him + temper + ' holds it against ' + who + ', who took it from the ' + c.rival + 's. Give it back and ' + short + ' lets ' + who + ' be; refuse and ' + short + ' puts a price on ' + who + '\'s head.';
        m.choices = [{ id: 'yes', label: 'Give it back', gives: short + ' drops the grudge against ' + who, costs: 'The ' + place + ' is the ' + c.rival + 's\' again' },
                     { id: 'no', label: 'Refuse', gives: said(who + ' keeps his ' + place), costs: said('A price on ' + who + '\'s head: men will come for him') }];
      } else {
        var odds = k.contract ? k.contract.odds : 50;
        m.title = 'A price on ' + who + '\'s head';
        m.says = him + temper + ' has paid men to shoot ' + who + ' within ' + within + '. ' + who + ' lives ' + odds + ' times in 100: Muscle counts. Pay, and ' + short + ' calls it off.';
        m.choices = [{ id: 'yes', label: 'Pay ' + short, cost: w.price, money: 'dirty', gives: 'The contract is called off, and the grudge with it' },
                     { id: 'no', label: 'Refuse', gives: 'You keep your money', costs: said(who + ' is shot at: he dies ' + (100 - odds) + ' times in 100, and half of what he runs goes with him') }];
      }
      found = m;
    });
    return found;
  }

  // --- the matters of the street, when nothing else has needed the boss for a while ---
  // Each: when(g) gives what it is about (a city, a man, a price) or null; says(x) writes the matter.
  var DECK = {
    share: {
      when: function (g, a) { var c = heldBy(g).filter(function (q) { return a.seen['share:' + q.id] === undefined && q.flow && q.flow.up > 0; })[0]; return c ? { c: c } : null; },
      says: function (g, a, x) { return shareMatter(g, a, x.c); }
    },
    captain: {
      when: function (g) {
        var r = RULES.captain, c = heldBy(g).filter(function (q) { return (q.heat || 0) >= r.from; }).sort(function (p, q) { return q.heat - p.heat; })[0];
        var cost = c ? Math.round((r.base + r.per * c.heat) / 50) * 50 : 0;
        return c && g.family.dirty >= cost ? { c: c, cost: cost } : null;
      },
      says: function (g, a, x) {
        return { kind: 'captain', capo: voiceOf(g, x.c), city: x.c.id, title: 'A captain of the police in ' + T.town(x.c) + ' has a price',
          says: 'The heat stands at ' + Math.round(x.c.heat) + ' out of 100. At 100 the police raid, and seize half of your dirty cash.',
          choices: [{ id: 'pay', label: 'Pay him', cost: x.cost, money: 'dirty', gives: 'The heat falls by ' + Math.min(RULES.captain.cools, Math.round(x.c.heat)) + ' at once' }, no('You keep your money', 'The heat stays where it is')] };
      }
    },
    truce: { // a hothead never sells his peace; a businessman sells it cheaper and for longer
      when: function (g) {
        var c = heldBy(g).filter(function (q) { return q.rival && T.chiefOf(q) !== null && T.temperOf(q).id !== 'hothead' && q.month > (q.quiet || 0); })[0];
        var t = c && T.temperOf(c), cost = c ? Math.round(RULES.truce.cost * t.peace.cost / 50) * 50 : 0;
        return c && g.family.dirty >= cost ? { c: c, cost: cost, cycles: Math.round(RULES.truce.cycles * t.peace.long) } : null;
      },
      says: function (g, a, x) {
        var k = T.chief(x.c, g.family), him = k ? k.name : 'The ' + x.c.rival + 's';
        return { kind: 'truce', capo: voiceOf(g, x.c), chief: k ? k.id : undefined, city: x.c.id, cycles: x.cycles, title: him + ' offers peace in ' + T.town(x.c) + ', for a price',
          says: 'The ' + x.c.rival + 's would stop raiding your places for a while. Your capos stay free to do as they like.' + (k && k.temper ? ' ' + k.temper.name + ': ' + k.temper.does.charAt(0).toLowerCase() + k.temper.does.slice(1) + '.' : ''),
          choices: [{ id: 'pay', label: 'Buy the peace', cost: x.cost, money: 'dirty', gives: 'No raid on your places in ' + T.town(x.c) + ' for ' + days(x.cycles * T.RULES.days) }, no('You keep your money', 'They come when they please')] };
      }
    },
    bail: {
      when: function (g) { var c = heldBy(g)[0]; return c && g.family.dirty >= RULES.bail.cost ? { c: c, capo: sourest(g, c) } : null; },
      says: function (g, a, x) {
        return { kind: 'bail', capo: x.capo, city: x.c.id, title: 'One of ' + first(x.capo) + '\'s men is in a cell',
          says: first(x.capo) + ' asks you to stand his bail. A boss who pays for his men is a boss they stay with.',
          choices: [{ id: 'pay', label: 'Stand his bail', cost: RULES.bail.cost, money: 'dirty', gives: 'Loyalty +' + RULES.bail.warms + ' for ' + first(x.capo) },
                    no('You keep your money', 'Loyalty −' + RULES.bail.hurts + ' for ' + first(x.capo))] };
      }
    },
    feast: {
      when: function (g) { var c = heldBy(g)[0]; return c && g.family.dirty >= RULES.feast.cost ? { c: c, capo: sourest(g, c) } : null; },
      says: function (g, a, x) {
        var club = T.clubOf(x.c, x.capo), where = T.zoneOf(x.c, club.x, club.y).name;
        return { kind: 'feast', capo: x.capo, city: x.c.id, title: first(x.capo) + ' invites you to the feast of ' + where,
          says: 'The whole street will be there. The boss\'s table is the boss\'s to pay.',
          choices: [{ id: 'pay', label: 'Pay for the table', cost: RULES.feast.cost, money: 'dirty', gives: 'Loyalty +' + RULES.feast.warms + ' for ' + first(x.capo) },
                    no('You keep your money', 'Loyalty −' + RULES.feast.hurts + ' for ' + first(x.capo) + ': you stayed away')] };
      }
    },
    cargo: {
      when: function (g) { var c = heldBy(g)[0]; return c ? { c: c } : null; },
      says: function (g, a, x) {
        return { kind: 'cargo', capo: voiceOf(g, x.c), city: x.c.id, title: 'A load with no owner sits in a yard in ' + T.town(x.c),
          says: first(voiceOf(g, x.c)) + '\'s men can have it out tonight. It will be missed, and the police will ask around.',
          choices: [{ id: 'take', label: 'Take it', gives: '+' + dollars(RULES.cargo.gain) + ' of dirty cash', costs: 'Heat +' + RULES.cargo.heat + ' in ' + T.town(x.c) }, { id: 'no', label: 'Leave it', gives: 'Nothing changes' }] };
      }
    },
    banker: {
      when: function (g) {
        var r = RULES.banker, c = heldBy(g)[0], lump = Math.min(r.most, Math.floor(g.family.dirty * r.part / 1000) * 1000);
        return c && g.family.dirty >= r.from ? { c: c, lump: lump } : null;
      },
      says: function (g, a, x) {
        return { kind: 'banker', capo: voiceOf(g, x.c), city: x.c.id, title: 'A banker offers to wash ' + dollars(x.lump) + ' of your dirty cash',
          says: 'Dirty cash pays your men and their places; only clean money buys what lasts. He keeps his cut, and asks no questions.',
          choices: [{ id: 'wash', label: 'Hand it over', cost: x.lump, money: 'dirty', gives: dollars(Math.round(x.lump * RULES.banker.keeps)) + ' of clean money, today' }, { id: 'no', label: 'Keep it dirty', gives: 'Nothing changes' }] };
      }
    },
    widow: {
      when: function (g) { var c = heldBy(g)[0]; return c && (g.family.clean || 0) >= RULES.widow.cost ? { c: c } : null; },
      says: function (g, a, x) {
        return { kind: 'widow', capo: voiceOf(g, x.c), city: x.c.id, title: 'The widow of one of your men in ' + T.town(x.c) + ' has nothing left',
          says: 'A pension has to be clean money: it is paid in the open. The men watch what the family does for its own.',
          choices: [{ id: 'pay', label: 'See to her', cost: RULES.widow.cost, money: 'clean', gives: 'Loyalty +' + RULES.widow.warms + ' for every capo in ' + T.town(x.c) }, { id: 'no', label: 'Not your affair', gives: 'Nothing changes' }] };
      }
    },
    favor: {
      when: function (g) { var c = heldBy(g).filter(function (q) { return q.rival; })[0]; return c ? { c: c, capo: sourest(g, c) } : null; },
      says: function (g, a, x) {
        return { kind: 'favor', capo: x.capo, city: x.c.id, title: 'A shopkeeper asks ' + first(x.capo) + ' for help against the ' + x.c.rival + 's',
          says: 'Their men squeeze him every week. ' + first(x.capo) + ' wants to send his own, and asks for your word.',
          choices: [{ id: 'help', label: 'Let him', gives: 'Loyalty +' + RULES.favor.warms + ' for ' + first(x.capo), costs: 'Heat +' + RULES.favor.heat + ' in ' + T.town(x.c) + ': it will be loud' }, { id: 'no', label: 'Stay out of it', gives: 'Nothing changes' }] };
      }
    }
  };
  var ORDER = ['share', 'captain', 'truce', 'bail', 'feast', 'cargo', 'banker', 'favor', 'widow'];
  var STREET = { captain: 1, truce: 1, bail: 1, feast: 1 }; // what the boss pays the street for: counted on the cards

  // What a choice does. `command` is empire's: what the boss pays to learn travels like the rest of his money.
  var DONE = {
    line: function (g, m, ch) { var c = cityOf(g, m.city); T.line(c, ch.id === 'none' ? null : ch.id); return ch.id === 'none' ? 'You give ' + T.town(c) + ' no line' : 'Your line for ' + T.town(c) + ': ' + ch.label; },
    share: function (g, m, ch) { var c = cityOf(g, m.city); T.cut(c, ch.id); return 'Your share in ' + T.town(c) + ': ' + ch.label; },
    learn: function (g, m, ch, command) { if (ch.id !== 'learn') return 'You tell ' + first(m.capo) + ' his trade will wait'; command(g, { type: 'research', building: m.trade }); return null; },
    invest: function (g, m, ch, command) { if (ch.id === 'no') return 'You let the clean money sleep'; command(g, { type: 'buy', holding: ch.id }); return null; },
    banker: function (g, m, ch) { if (ch.id !== 'wash') return 'You send the banker away'; var back = Math.round(ch.cost * RULES.banker.keeps); g.family.dirty -= ch.cost; g.family.clean = (g.family.clean || 0) + back; return 'The banker washes ' + dollars(ch.cost) + ': ' + dollars(back) + ' comes back clean'; },
    widow: function (g, m, ch) { if (ch.id !== 'pay') return 'You leave the widow to her street'; var c = cityOf(g, m.city); g.family.clean -= ch.cost; menOf(g, c).forEach(function (id) { T.sway(g.family, id, RULES.widow.warms); }); return 'You see to the widow: the men in ' + T.town(c) + ' take note'; },
    advance: function (g, m, ch) {
      if (ch.id !== 'pay') return 'You let ' + first(m.capo) + ' save alone';
      var r = T.advance(cityOf(g, m.city), g.family, m.capo);
      return 'You put ' + dollars(r.cost) + ' into ' + first(m.capo) + '\'s next place';
    },
    captain: function (g, m, ch) { var c = cityOf(g, m.city); if (ch.id !== 'pay') return 'You send the captain away'; g.family.dirty -= ch.cost; c.heat = Math.max(0, (c.heat || 0) - RULES.captain.cools); return 'You pay the captain ' + dollars(ch.cost) + ': the heat falls in ' + T.town(c); },
    ultimatum: function (g, m, ch) { return T.reply(cityOf(g, m.city), g.family, ch.id === 'yes').label; },
    price: function (g, m, ch) { return T.reply(cityOf(g, m.city), g.family, ch.id === 'yes').label; },
    truce: function (g, m, ch) { var c = cityOf(g, m.city); if (ch.id !== 'pay') return 'You refuse the ' + c.rival + 's\' peace'; g.family.dirty -= ch.cost; c.quiet = Math.max(c.quiet || 0, c.month + (m.cycles || RULES.truce.cycles)); return 'You buy peace from the ' + c.rival + 's in ' + T.town(c); },
    bail: function (g, m, ch) { var yes = ch.id === 'pay'; if (yes) g.family.dirty -= ch.cost; T.sway(g.family, m.capo, yes ? RULES.bail.warms : -RULES.bail.hurts); return yes ? 'You stand bail for ' + first(m.capo) + '\'s man' : 'You leave ' + first(m.capo) + '\'s man in his cell'; },
    feast: function (g, m, ch) { var yes = ch.id === 'pay'; if (yes) g.family.dirty -= ch.cost; T.sway(g.family, m.capo, yes ? RULES.feast.warms : -RULES.feast.hurts); return yes ? 'You pay for the table at ' + first(m.capo) + '\'s feast' : 'You stay away from ' + first(m.capo) + '\'s feast'; },
    cargo: function (g, m, ch) { var c = cityOf(g, m.city); if (ch.id !== 'take') return 'You leave the load where it is'; g.family.dirty += RULES.cargo.gain; c.heat = Math.min(99, (c.heat || 0) + RULES.cargo.heat); return 'Your men take the load: ' + dollars(RULES.cargo.gain) + ' for the family'; },
    favor: function (g, m, ch) { var c = cityOf(g, m.city); if (ch.id !== 'help') return 'You tell ' + first(m.capo) + ' to stay out of it'; T.sway(g.family, m.capo, RULES.favor.warms); c.heat = Math.min(99, (c.heat || 0) + RULES.favor.heat); return first(m.capo) + '\'s men see the ' + c.rival + 's off the shopkeeper\'s street'; }
  };
  function cityOf(g, id) { return g.cities.filter(function (c) { return c.id === id; })[0]; }

  // Whom to send to the boss today, or nobody.
  function pick(g, a, today) {
    var gap = today - a.last, never = !Object.keys(a.seen).length;
    var rested = function (key, n) { return a.seen[key] === undefined || today - a.seen[key] >= n; };
    var held = heldBy(g);
    if (!held.length) return null;
    var word = chiefMatter(g, a); // the man across the street does not wait his turn
    if (word) return word;
    // a city the boss has given no line yet: its first man asks, once
    if (today >= RULES.first && (never || gap >= RULES.soon)) {
      var c = held.filter(function (q) { return !q.line && a.seen['line:' + q.id] === undefined; })[0];
      if (c) return lineMatter(g, a, c);
    }
    if (gap >= RULES.soon) { var l = learnMatter(g, a, rested) || investMatter(g, a, rested); if (l) return l; }
    var every = g.reign && g.reign.act > 0 ? RULES.every : RULES.early;
    if (gap < every) return null;
    // one time in two, a dilemma: two of his people, or two things he wants, set against each other
    var hard = a.dil ? null : dilemma(g, a, rested);
    if (hard) return hard;
    // (not twice running: the street has its say in between)
    var adv = rested('advance', 2 * every - 10) ? advanceMatter(g, a, rested) : null;
    if (adv) { adv.deck = 'advance'; return adv; }
    // of the street: the one seen longest ago that can come up today
    var best = null;
    ORDER.forEach(function (ignored, k) {
      var kind = ORDER[(k + (g.seed || 0)) % ORDER.length]; // (another game starts the round at another matter)
      if (!rested(kind, RULES.rest * Math.pow(2, Math.min((a.snubs || {})[kind] || 0, 4)))) return;
      var x = DECK[kind].when(g, a); if (!x) return;
      var seen = a.seen[kind] === undefined ? -1 : a.seen[kind];
      if (!best || seen < best.seen) best = { kind: kind, x: x, seen: seen };
    });
    if (!best) return dilemma(g, a, rested);
    var m = DECK[best.kind].says(g, a, best.x);
    m.key = m.key || best.kind; m.deck = best.kind;
    return m;
  }
  // The dilemma seen longest ago that can come up today, and never the one he has just had.
  function dilemma(g, a, rested) {
    var best = null;
    X.KINDS.forEach(function (kind) {
      if (kind === a.hard || !rested(kind, RULES.rest * Math.pow(2, Math.min((a.snubs || {})[kind] || 0, 4)))) return;
      var x = X.when(g, kind); if (!x) return;
      var seen = a.seen[kind] === undefined ? -1 : a.seen[kind];
      if (!best || seen < best.seen) best = { kind: kind, x: x, seen: seen };
    });
    return best ? X.says(g, best.kind, best.x) : null;
  }
  function open(g, a, m, today) {
    m.id = m.kind + ':' + m.city + ':' + today; m.since = today;
    a.paid = (a.paid || []).filter(function (p) { return today - p.day < RULES.again; });
    m.spent = a.paid.reduce(function (n, p) { return n + p.n; }, 0);
    if (m.deck) a.dil = !!m.dilemma;
    if (m.dilemma) a.hard = m.kind;
    a.open = m; a.last = today;
    return { type: 'matter', id: m.id, kind: m.kind, capo: m.capo, city: m.city, x: m.x, y: m.y, label: m.title };
  }
  // A dilemma brought to the boss today whatever the calendar says (the tests, and whoever directs the story). null when it cannot come up.
  function bring(g, kind, today) {
    var a = stateOf(g), x = a.open ? null : X.when(g, kind);
    return x ? open(g, a, X.says(g, kind, x), today) : null;
  }
  // What an old choice of the boss brings back today.
  function echoes(g, today) { return X.due(g, today); }

  // Once a day. `stopped`: the clock has just stopped for something else, and the count of quiet days starts again.
  // Returns the piece of news of a matter brought to him, or null.
  function raise(g, today, stopped) {
    var a = stateOf(g);
    if (a.off) return null;
    if (a.open) {
      if (today - a.open.since >= RULES.stale) { a.seen[a.open.key] = today; if (a.open.deck) a.seen[a.open.deck] = today; a.open = null; a.last = today; } // left waiting: it goes away
      return null;
    }
    if (stopped) { a.last = today; return null; }
    var m = pick(g, a, today);
    if (!m) return null;
    return open(g, a, m, today);
  }
  function matters(g) { var a = g.audience; return a && a.open ? [a.open] : []; }

  // The boss answers. Returns what there is to tell: his answer in words for the journal, and what it set off at once.
  function decide(g, id, choice, today, command) {
    var a = stateOf(g), m = a.open;
    if (!m || m.id !== id) throw new Error('nobody is asking that any more');
    var ch = m.choices.filter(function (q) { return q.id === choice; })[0];
    if (!ch) throw new Error('no such answer: ' + choice);
    if (ch.cost > 0) {
      var clean = ch.money === 'clean', has = clean ? g.family.clean || 0 : g.family.dirty;
      if (has < ch.cost) throw new Error('it takes ' + dollars(ch.cost) + (clean ? ' of clean money' : ' of dirty cash'));
    }
    var set = m.dilemma ? X.done(g, m, ch, today) : { label: DONE[m.kind](g, m, ch, command) }, label = set.label;
    // a yes to a capo's own ask lets him come back sooner than a no
    var yes = ch.id !== 'no' && ch.id !== 'none';
    var own = m.kind === 'advance' || m.kind === 'learn' || m.kind === 'invest', kept = own ? m.key : m.deck && m.deck !== 'share' ? m.deck : null;
    if (kept) { a.snubs = a.snubs || {}; if (yes) delete a.snubs[kept]; else a.snubs[kept] = (a.snubs[kept] || 0) + 1; }
    if ((STREET[m.kind] || m.dilemma) && ch.cost > 0) (a.paid = a.paid || []).push({ day: today, n: ch.cost });
    a.seen[m.key] = own && yes ? today - RULES.again + RULES.every : today;
    if (m.deck) a.seen[m.deck] = today;
    a.open = null; a.last = today;
    return (label ? [{ type: 'decided', kind: m.kind, capo: m.capo, city: m.city, choice: ch.id, label: label }] : []).concat(set.events || []);
  }

  // A matter of the street as it would be brought today, or null (for the tests).
  function offer(g, kind) { var a = stateOf(g), x = DECK[kind].when(g, a); return x ? DECK[kind].says(g, a, x) : null; }

  var api = { RULES: RULES, raise: raise, decide: decide, matters: matters, offer: offer, bring: bring, echoes: echoes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportAudience = api;
})(typeof self !== 'undefined' ? self : this);
