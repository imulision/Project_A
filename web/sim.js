// Game rules for Ashport. No drawing and no browser here: this file only
// knows about months, districts, lieutenants and money, so it can be tested
// on its own. The page (index.html) reads the state and draws it.
(function (root) {
  'use strict';

  var TICKS_PER_MONTH = 4;
  var WAGE_PER_MAN = 15;
  var LEVEL_NAMES = ['I', 'II', 'III'];
  var HEAT_COOLING = 2;          // heat lost every month on its own
  var VACANT_EARN = 0.5;         // a district nobody runs earns half
  var BOOST_FACTOR = 1.6;        // extra men make a lieutenant take blocks faster
  var PUSHBACK_EXPAND = 9;       // lieutenants this forceful drive the Callahans out
  var PUSHBACK_PER_TICK = 0.012;
  var RAID_HEAT = 100;
  var BROKE_CASH = -1500;
  var BETRAYAL_LOYALTY = 45;
  var YEAR_MONTHS = 12;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // Districts held by rival families from the start. size: number of blocks.
  var RIVAL_TURF = { northside: 54, callahan: 27 };

  // expand: influence points gained per month. build: level gained per month.
  // earn: income multiplier. heat: heat added per month. skim: share of the
  // take kept by the lieutenant. cost: dollars per month. loyalty: 0 to 100.
  var LIEUTENANTS = {
    sal: { name: 'Sal', quality: 'Iron fist', flaw: 'Hot-headed', plan: 'Give me the street. I take every block by spring, and everyone will know it.', expand: 9, build: 0.04, earn: 1, heat: 5, skim: 0, cost: 0, loyalty: 65 },
    rosa: { name: 'Rosa', quality: 'Charmer', flaw: 'Big spender', plan: 'I open clubs. People come to us and nobody gets hurt. It costs money.', expand: 4, build: 0.11, earn: 1.1, heat: 0, skim: 0, cost: 180, loyalty: 70 },
    frankie: { name: 'Frankie', quality: 'Smuggler', flaw: 'Skims the take', plan: 'More boats, more whisky. Do not count the crates too closely.', expand: 2, build: 0.05, earn: 1.5, heat: 1, skim: 0.25, cost: 0, loyalty: 55 },
    vito: { name: 'Vito', quality: 'Loyal', flaw: 'Slow', plan: 'I hold what we have. No surprises, boss.', expand: 3, build: 0.04, earn: 1, heat: 0, skim: 0, cost: 0, loyalty: 90 },
    mae: { name: 'Mae', quality: 'Bookkeeper', flaw: 'Timid', plan: 'I make it pay and I keep it quiet. I do not pick fights.', expand: 0, build: 0.06, earn: 1.4, heat: -2, skim: 0, cost: 0, loyalty: 70 },
    dutch: { name: 'Dutch', quality: 'Enforcer', flaw: 'Ambitious', plan: 'Point me at Callahan. Then we talk about my cut.', expand: 12, build: 0.03, earn: 1, heat: 6, skim: 0, cost: 0, loyalty: 45, ambitious: true },
    nora: { name: 'Nora', quality: 'Fixer', flaw: 'Greedy', plan: 'I pay the right people. The law looks elsewhere.', expand: 2, build: 0.05, earn: 1, heat: -5, skim: 0, cost: 250, loyalty: 60 }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function wholeLevel(level) { return Math.floor(level + 1e-6); }

  function createGame() {
    var g = {
      month: 0, tick: 0, over: null, pending: null,
      cash: 1500, men: 34, idle: 6, heat: 40, respect: 30,
      delta: { cash: 0, heat: 0, respect: 0 },
      bench: ['sal', 'vito', 'mae'],
      lieutenants: clone(LIEUTENANTS),
      // share: your influence, 0 to 100. rival: Callahan presence, 0 to 1.
      // contested: Callahan moves in when nobody runs the district.
      // size: number of blocks. boost: months of extra men left.
      // last: what the district paid into the last envelope.
      districts: {
        hillside: { name: 'Hillside', size: 27, share: 35, level: 1, lieutenant: null, income: 170, rival: 0, contested: false, boost: 0, last: 0 },
        market: { name: 'Market Street', size: 36, share: 60, level: 1.6, lieutenant: 'rosa', income: 280, rival: 0, contested: false, boost: 0, last: 0 },
        union: { name: 'Union Station', size: 24, share: 8, level: 1, lieutenant: null, income: 250, rival: 0.25, contested: true, boost: 0, last: 0 },
        docks: { name: 'The Docks', size: 46, share: 85, level: 2, lieutenant: 'frankie', income: 330, rival: 0, contested: false, boost: 0, last: 0 },
        canal: { name: 'Canal Street', size: 24, share: 0, level: 1, lieutenant: null, income: 220, rival: 0.3, contested: true, boost: 0, last: 0 }
      }
    };
    g.lastControl = control(g).you;
    g.pending = assignDecision('hillside', 'Hillside has no lieutenant', 'Three people want the job. Whoever you pick will run the district their own way.', false);
    return g;
  }

  function money(n) { return (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US'); }
  function news(text) { return { type: 'news', text: text }; }
  function districtIds(g) { return Object.keys(g.districts); }
  function districtOf(g, who) {
    return districtIds(g).filter(function (id) { return g.districts[id].lieutenant === who; })[0] || null;
  }
  function leastLoyalInPost(g) {
    var worst = null;
    districtIds(g).forEach(function (id) {
      var k = g.districts[id].lieutenant;
      if (k && (!worst || g.lieutenants[k].loyalty < g.lieutenants[worst].loyalty)) worst = k;
    });
    return worst;
  }

  // Share of the whole city held by each side, as fractions that add up to 1.
  function control(g) {
    var you = 0, callahan = RIVAL_TURF.callahan, total = RIVAL_TURF.northside + RIVAL_TURF.callahan;
    districtIds(g).forEach(function (id) {
      var d = g.districts[id];
      you += d.size * d.share / 100;
      callahan += d.size * d.rival;
      total += d.size;
    });
    return { you: you / total, callahan: callahan / total, northside: RIVAL_TURF.northside / total, free: (total - you - callahan - RIVAL_TURF.northside) / total };
  }

  // ---- Decisions put in front of the player ----

  function assignDecision(district, title, text, canSkip, event) {
    return { kind: 'assign', district: district, title: title, text: text, canSkip: canSkip, event: event || null };
  }
  function choiceDecision(event, title, text, options) {
    return { kind: 'choice', event: event, title: title, text: text, options: options };
  }

  function requestAssign(g, district) {
    if (g.pending || g.over) return;
    g.pending = assignDecision(district, 'Who runs ' + g.districts[district].name + '?', 'The one you replace goes back to the bench, and will remember it.', true);
  }

  function assign(g, district, who) {
    var d = g.districts[district], old = d.lieutenant, out = [];
    g.bench = g.bench.filter(function (k) { return k !== who; });
    if (old) {
      g.bench.push(old);
      g.lieutenants[old].loyalty -= 15;
      out.push(news(g.lieutenants[old].name + ' was pulled out of ' + d.name + ' and is not happy.'));
    }
    d.lieutenant = who;
    g.lieutenants[who].loyalty += 5;
    out.push(news(g.lieutenants[who].name + ' now runs ' + d.name + '.'));
    return out;
  }

  // The scripted events of 1926, by month. Each may return a decision.
  // `options` here must stay in step with the answers in ANSWERS below.
  var EVENTS = {
    2: function (g) {
      var k = g.districts.hillside.lieutenant;
      if (!k) return null;
      var n = g.lieutenants[k].name;
      return choiceDecision('fiveMen', n + ' asks for five men', '"Hillside is slow going. Give me five of the idle men and I double the pace for three months."', [
        { label: 'Give five men', effect: 'Men idle -5. Faster in Hillside for 3 months. ' + n + ' is grateful.' },
        { label: 'Refuse', effect: 'Nothing changes on the map. ' + n + ' takes it personally.' }]);
    },
    3: function (g, out) {
      g.bench.push('dutch', 'nora');
      out.push(news('Two new faces in town: Dutch and Nora want in.'));
      return assignDecision('union', 'Union Station is up for grabs', 'The rail yard moves everything in this city. The Callahans are already circling it.', true);
    },
    5: function (g) {
      if (g.districts.canal.lieutenant || !g.bench.length) return null;
      return assignDecision('canal', 'Callahan men are moving into Canal Street', 'Red roofs are spreading along the canal. Send someone, or let them have it.', true, 'canal');
    },
    6: function (g) {
      if (!districtOf(g, 'frankie')) return null;
      return choiceDecision('frankie', "Frankie's envelope is thin", 'Your bookkeeping says a quarter of the Docks money never reaches you. Frankie smiles and says the lake was rough.', [
        { label: 'Make an example', effect: 'Frankie stops skimming. His loyalty drops hard. Respect +3.' },
        { label: 'Look away', effect: 'He keeps skimming. He likes you for it. Respect -3.' }]);
    },
    8: function (g) {
      if (g.heat < 55) return null;
      return choiceDecision('captain', 'The police captain names his price', '"Eight hundred dollars and my boys find other streets to walk." Heat is at ' + Math.round(g.heat) + '.', [
        { label: 'Pay $800', effect: 'Cash -$800. Heat -25.' },
        { label: 'Refuse', effect: 'Heat +8. He will remember.' }]);
    },
    10: function (g, out) {
      var k = leastLoyalInPost(g);
      if (!k || g.lieutenants[k].loyalty >= BETRAYAL_LOYALTY) {
        out.push(news('Your lieutenants are holding the line. Nobody is for sale this month.'));
        return null;
      }
      var id = districtOf(g, k), d = g.districts[id], n = g.lieutenants[k].name;
      d.lieutenant = null;
      d.share = Math.min(d.share, 12);
      d.rival = 0.7;
      d.level = Math.max(1, d.level - 0.8);
      g.respect = clamp(g.respect - 6, 0, 100);
      out.push({ type: 'betrayal', district: id, lieutenant: k });
      out.push(news(n + ' went over to the Callahans and took ' + d.name + ' with him.'));
      return choiceDecision('betrayal', n + ' has betrayed you', n + "'s loyalty had been falling for months. Last night his men opened " + d.name + ' to the Callahans. The roofs are turning red.', [
        { label: 'Understood', effect: 'You can send someone to take it back.' }]);
    }
  };

  // What each answer does. Indexed like the options of the decision.
  var ANSWERS = {
    fiveMen: [
      function (g, out) {
        var k = g.districts.hillside.lieutenant;
        g.idle = Math.max(0, g.idle - 5);
        g.districts.hillside.boost = 3;
        if (k) { g.lieutenants[k].loyalty += 10; out.push(news(g.lieutenants[k].name + ' got five more men for Hillside.')); }
      },
      function (g, out) {
        var k = g.districts.hillside.lieutenant;
        if (k) { g.lieutenants[k].loyalty -= 15; out.push(news('You refused ' + g.lieutenants[k].name + ' the men for Hillside.')); }
      }],
    frankie: [
      function (g, out) {
        g.lieutenants.frankie.skim = 0;
        g.lieutenants.frankie.loyalty -= 25;
        g.respect = clamp(g.respect + 3, 0, 100);
        out.push(news('Frankie was reminded whose money it is.'));
      },
      function (g, out) {
        g.lieutenants.frankie.loyalty += 8;
        g.respect = clamp(g.respect - 3, 0, 100);
        out.push(news('You let Frankie keep his cut.'));
      }],
    captain: [
      function (g, out) {
        g.cash -= 800;
        g.heat = clamp(g.heat - 25, 0, 100);
        out.push(news('The captain was paid. The patrols thinned out.'));
      },
      function (g, out) {
        g.heat = clamp(g.heat + 8, 0, 100);
        out.push(news('You sent the captain away empty-handed.'));
      }],
    betrayal: [function () {}]
  };
  var SKIPS = {
    canal: function (g, out) {
      g.respect = clamp(g.respect - 4, 0, 100);
      out.push(news('You let Canal Street go. People noticed.'));
    }
  };

  // Answers the waiting decision. answer is { pick: who }, { skip: true } or
  // { option: index }. Returns the events it caused. An answer that does not
  // fit the decision is ignored and the decision keeps waiting.
  function resolve(g, answer) {
    var p = g.pending, out = [];
    if (!p || !answer) return out;
    if (p.kind === 'assign') {
      if (answer.pick && g.bench.indexOf(answer.pick) >= 0) {
        g.pending = null;
        return assign(g, p.district, answer.pick);
      }
      if (answer.skip && (p.canSkip || !g.bench.length)) {
        g.pending = null;
        if (p.event && SKIPS[p.event]) SKIPS[p.event](g, out);
      }
      return out;
    }
    var act = ANSWERS[p.event] && ANSWERS[p.event][answer.option];
    if (act) { g.pending = null; act(g, out); }
    return out;
  }

  // ---- Time ----

  function advanceDistrict(g, id, events) {
    var d = g.districts[id];
    var l = d.lieutenant && g.lieutenants[d.lieutenant];
    var before = wholeLevel(d.level);
    if (l) {
      d.share = Math.min(100, d.share + l.expand * (d.boost > 0 ? BOOST_FACTOR : 1) / TICKS_PER_MONTH);
      d.level = Math.min(3, d.level + (l.build / TICKS_PER_MONTH) * (0.4 + 0.6 * d.share / 100) * 2.2);
      if (l.expand >= PUSHBACK_EXPAND) d.rival -= PUSHBACK_PER_TICK;
    } else {
      d.share = Math.max(0, d.share - 0.5);
      if (d.contested) d.rival = Math.min(0.85, d.rival + 0.012);
    }
    d.rival = clamp(d.rival, 0, 1 - d.share / 100);
    var after = wholeLevel(d.level);
    if (after > before) {
      g.respect = clamp(g.respect + 3, 0, 100);
      events.push({ type: 'level', district: id, level: after });
    }
  }

  function districtIncome(g, id) {
    var d = g.districts[id];
    var l = d.lieutenant && g.lieutenants[d.lieutenant];
    return d.income * d.share / 100 * (0.6 + 0.4 * d.level) * (l ? l.earn : VACANT_EARN);
  }

  function finish(g, events, result, title, text) {
    g.over = { result: result, title: title, text: text };
    events.push({ type: 'end', result: result });
  }

  function endOfMonth(g, events) {
    var gross = 0, skim = 0, costs = 0, heat = -HEAT_COOLING, parts = [];
    var start = { cash: g.cash, heat: g.heat, respect: g.respect };
    districtIds(g).forEach(function (id) {
      var d = g.districts[id], l = d.lieutenant && g.lieutenants[d.lieutenant];
      var take = districtIncome(g, id), kept = l ? take * l.skim : 0;
      d.last = take - kept;
      gross += take;
      skim += kept;
      if (d.boost > 0) d.boost -= 1;
      if (l) {
        costs += l.cost;
        heat += l.heat;
        l.loyalty = Math.min(100, l.loyalty + 1);
        if (l.ambitious) l.loyalty -= 3;
      }
      parts.push({ district: id, amount: d.last });
    });
    g.bench.forEach(function (k) { g.lieutenants[k].loyalty = Math.max(0, g.lieutenants[k].loyalty - 1); });
    var wages = g.men * WAGE_PER_MAN, net = gross - skim - costs - wages;
    g.cash += net;
    g.heat = clamp(g.heat + heat, 0, 100);
    var held = control(g).you;
    if (held > g.lastControl + 0.005) g.respect += 1;
    else if (held < g.lastControl - 0.005) g.respect -= 2;
    g.lastControl = held;
    g.respect = clamp(g.respect, 0, 100);
    g.delta = { cash: g.cash - start.cash, heat: g.heat - start.heat, respect: g.respect - start.respect };
    events.push({ type: 'envelope', gross: gross, skim: skim, costs: costs, wages: wages, net: net, parts: parts });
    g.month += 1;

    if (g.heat >= RAID_HEAT) return finish(g, events, 'raid', 'Federal raid', 'Heat reached 100. Agents hit every address in one night, and one of your men talked.');
    if (g.cash < BROKE_CASH) return finish(g, events, 'broke', 'Broke', 'The men have not been paid in weeks. They walk away, and the Callahans hire them.');
    if (EVENTS[g.month]) g.pending = EVENTS[g.month](g, events) || null;
    if (g.month >= YEAR_MONTHS && !g.pending) {
      var pct = Math.round(control(g).you * 100);
      finish(g, events, 'year', pct >= 55 ? 'Ashport answers to you' : pct >= 38 ? 'A family to reckon with' : 'Still a small-time outfit',
        'End of 1926. You hold ' + pct + '% of the city, with ' + money(g.cash) + ' in the safe, heat at ' + Math.round(g.heat) + ' and respect at ' + Math.round(g.respect) + '.');
    }
  }

  // Advances time by one tick and returns what happened, for the page to show.
  // Nothing moves while a decision is waiting or once the game is over.
  function tick(g) {
    var events = [];
    if (g.pending || g.over) return events;
    districtIds(g).forEach(function (id) { advanceDistrict(g, id, events); });
    g.tick += 1;
    if (g.tick >= TICKS_PER_MONTH) { g.tick = 0; endOfMonth(g, events); }
    return events;
  }

  var api = {
    TICKS_PER_MONTH: TICKS_PER_MONTH, WAGE_PER_MAN: WAGE_PER_MAN, LEVEL_NAMES: LEVEL_NAMES, MONTHS: MONTHS, LIEUTENANTS: LIEUTENANTS,
    createGame: createGame, tick: tick, resolve: resolve, requestAssign: requestAssign,
    districtIncome: districtIncome, control: control, money: money
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportSim = api;
})(typeof self !== 'undefined' ? self : this);
