// The sheets of the screen, as text. A sheet is worked out from the state of the
// game alone and returned as HTML: nothing here touches the page, so every
// sheet is tested without a browser (tests/sheets.test.js). ui.js shows them
// and passes the boss's touches back.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./game.js'), require('./icons.js'), require('./district.js'));
  else root.AshportSheets = factory(root.AshportGame, root.AshportIcons, root.AshportDistrict);
})(typeof self !== 'undefined' ? self : this, function (G, I, D) {
  'use strict';
  var CAPOS = D.CAPOS, SITES = D.SITES, g = null;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var capoName = function (id) { return id && CAPOS[id] ? CAPOS[id].name : 'Nobody'; };

  // ---- pictures first: a tap on any of them says in a few words what it is
  var STATS = [['muscle', 'Muscle: takes and holds streets, wins fights'], ['business', 'Business: makes every place pay more'], ['cunning', 'Cunning: hides the money, sees traps'], ['charisma', 'Charisma: keeps the neighbourhood and his men on his side']];
  var WORD = { protection: 'Protection', seize: 'Taking by force', push: 'Taking streets', bribe: 'Paying the police', still: 'Stills', speakeasy: 'Speakeasies', gambling: 'Gambling', loft: 'Cannabis',
               warehouse: 'Warehouses', front: 'Fronts', rented: 'Rented laundries', brothel: 'Brothels', chopshop: 'Stolen cars', fence: 'Fencing', loans: 'Loan sharking', union: 'Unions' };
  var CARGO = {
    liquor: { icon: 'liquor', color: '#ffb347', word: 'Liquor' }, takings: { icon: 'takings', color: '#e8c463', word: 'Takings, dirty cash' },
    laundering: { icon: 'laundering', color: '#6ad0e0', word: 'Dirty cash on its way to be washed' }, tribute: { icon: 'clean', color: '#8fbf97', word: 'Your share, washed' },
    works: { icon: 'works', color: '#c8d0ff', word: 'Men and tools for a new place' }, streets: { icon: 'muscle', color: '#ff5a3a', word: 'A crew taking streets' },
    collection: { icon: 'protection', color: '#ff5a3a', word: 'Collecting protection money' }, seizure: { icon: 'seize', color: '#ff5a3a', word: 'A crew seizing a place' },
    raid: { icon: 'heat', color: '#5a8dff', word: 'Police raid' }, attack: { icon: 'attack', color: '#ff5a3a', word: 'Rivals attacking' },
    takeover: { icon: 'seize', color: '#ff5a3a', word: 'Men sent to take a district' },
    hit: { icon: 'hit', color: '#ff5a3a', word: 'A killing' }, kidnap: { icon: 'kidnap', color: '#ff5a3a', word: 'A kidnapping' } };
  var WAY = { force: { icon: 'muscle', color: '#ff5a3a', word: 'By force', tip: 'His men go in gun in hand. Cheap, slow, bloody, and the police take notice' },
              bribe: { icon: 'bribe', color: '#e8c463', word: 'Bribe', tip: 'He pays the rival\'s man in the district to change sides' },
              buy: { icon: 'clean', color: '#8fbf97', word: 'Buy it', tip: 'Clean money buys the district outright. Dear, quick and quiet' } };
  var SECTOR = { liquor: 'liquor', vice: 'brothel', money: 'laundering', law: 'bribe', muscle: 'muscle', routes: 'truck' };
  var ROLE = { laundering: 'washes dirty cash', production: 'makes the goods', sales: 'sells', storage: 'stores', business: 'brings in cash' };
  var PLACE = { hideout: 'the social club', boss: 'you', streets: 'the streets', shops: 'the shops', police: 'the precinct', rivals: 'the rivals' };
  var ic = function (name, tip, cls) { return '<span class="i' + (cls ? ' ' + cls : '') + '"' + (tip ? ' data-tip="' + esc(tip) + '"' : '') + '>' + I.icon(name) + '</span>'; };
  var first = function (name) { return String(name).split(' ')[0]; };
  var washes = function (type) { return !!(SITES[type] && SITES[type].wash); };

  function intentOf(id) {
    if (G.intent) { var n = G.intent(g, id); if (n) return n; }
    var e = g.journal.filter(function (e) { return e.type === 'decision' && e.district === id; })[0];
    return e ? { kind: e.kind, label: e.label, why: e.why, progress: null, waiting: null } : null;
  }
  function moveIcon(kind) { var k = String(kind || '').replace(/^enlarge-/, ''); return I.has(k) ? k : { guard: 'loyalty', standdown: 'men', ease: 'men', recall: 'men', hire: 'men', restart: 'still', hold: 'time', save: 'dirty' }[k] || 'time'; }
  function historyOf(id) { return G.history ? G.history(g, id) || [] : []; }

  // ---- choosing a man: a row of faces, and the one being looked at in full
  var picking = null;
  function oddsHtml(c) {
    var way = picking && picking.way; if (!way || !c.odds) return '';
    var good = c.odds[way] === 'good';
    return '<div class="move ' + (good ? 'yes' : 'no') + '">' + I.icon(WAY[way].icon) + '<span>' + (good ? 'Good odds this way: it suits him' : 'Poor odds this way: not his kind of work') + '</span></div>';
  }
  function manHtml(c, action, label) {
    var s = c.stats, raw = CAPOS[c.id] || { likes: [], refuses: [] }, tone = (I.FACES[c.id] || {}).tone || '#e8c463';
    var dial = function (name, v, tipText) { return '<div class="dial" style="color:' + (name === 'loyalty' ? 'var(--good)' : 'var(--accent)') + '" data-tip="' + tipText + '">' + I.ring(v / 100, name) + '<b>' + v + '</b></div>'; };
    return '<div class="man" style="--tone:' + tone + '"><div class="big">' + I.portrait(c.id) + '</div><div class="about"><h3>' + esc(c.name) + '</h3>' +
      '<div class="chip">' + esc(c.specialty) + (c.rankName ? ' · ' + esc(c.rankName) : '') + (c.local ? ' · local man' : '') + '</div>' +
      STATS.map(function (x) { return '<div class="stat" data-tip="' + x[1] + '">' + I.icon(x[0]) + I.pips(s[x[0]], 10) + '<b>' + s[x[0]] + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="traits">' + dial('loyalty', s.loyalty, 'Loyalty: how much of your share he really sends up') + dial('ambition', s.ambition, 'Ambition: how hard he pushes, and how much he wants your chair') +
      '<div class="tags">' + raw.likes.map(function (k) { return ic(k, 'Likes: ' + (WORD[k] || k), 'yes'); }).join('') + raw.refuses.map(function (k) { return ic(k, 'Refuses: ' + (WORD[k] || k), 'no'); }).join('') + '</div></div>' +
      oddsHtml(c) + (c.firstMove ? '<div class="move">' + I.icon('time') + '<span>' + esc(c.firstMove) + '</span></div>' : '') +
      '<button class="go" data-act="' + action + '" data-capo="' + esc(c.id) + '">' + esc(label + ' ' + first(c.name)) + '</button>';
  }
  function sheetMen(title, intro, list, action, cancel, way) {
    picking = { list: list, action: action, way: way || null, label: way ? 'Send' : 'Name' };
    return ('<h2>' + esc(title) + '</h2>' + (intro ? '<p>' + esc(intro) + '</p>' : '') +
      (list.length ? '<div class="faces">' + list.map(function (c, i) { return '<button class="facebtn' + (i ? '' : ' on') + (way && c.odds ? ' ' + c.odds[way] : '') + '" data-face="' + esc(c.id) + '">' + I.portrait(c.id) + '<small>' + esc(first(c.name)) + '</small></button>'; }).join('') + '</div>' +
        '<div id="who">' + manHtml(list[0], action, picking.label) + '</div>' : '<p>Every man you trust already has a post.</p>') +
      (cancel ? '<div class="acts"><button data-act="close">Cancel</button></div>' : ''));
  }
  // Before the game starts nobody is named yet, so the cards come from two throwaway games.
  function firstCandidates() {
    var ids = Object.keys(CAPOS), a = G.candidates(G.createGame({ capo: ids[0] }), 'ashport-hillside'), b = G.candidates(G.createGame({ capo: ids[1] }), 'ashport-hillside');
    return b.filter(function (c) { return c.id === ids[0]; }).concat(a);
  }
  function sheetStart() { return sheetMen('Hillside needs a capo', 'You are the boss. You name the man, he runs the streets his way.', firstCandidates(), 'start', false); }
  function find(id) {
    var out = null;
    G.view(g).cities.forEach(function (c) { c.districts.forEach(function (d) { if (d.id === id) out = { city: c, d: d }; }); });
    return out;
  }
  // ---- a district: who runs it, what he is after, how it is doing, what stands there
  function tile(icon, label, value, series, tipText, opt) {
    return '<div class="tile" data-tip="' + esc(tipText) + '"><small>' + I.icon(icon) + label + '</small><b>' + value + '</b>' + (series && series.length > 1 ? I.spark(series, opt) : '') + '</div>';
  }
  function intentHtml(id) {
    var n = intentOf(id); if (!n) return '';
    var wait = { money: 'saving for it', men: 'short of men', heat: 'waiting for the police to look away', research: 'waiting for the family to learn it' }[n.waiting];
    return '<div class="intent">' + '<span class="gauge">' + I.ring(n.progress == null ? 1 : n.progress, moveIcon(n.kind)) + '</span><div><b>' + esc(n.label) + '</b><small>' +
      esc([n.why, wait, n.cost ? money(n.saved || 0) + ' of ' + money(n.cost) : ''].filter(Boolean).join(' · ')) + '</small></div></div>' +
      (n.wish ? '<div class="intent wish"><span class="gauge">' + I.ring(0, moveIcon(n.wish.site)) + '</span><div><b>He asks for: ' + esc(WORD[n.wish.site] || n.wish.site) + '</b><small>' + esc(n.wish.why) + ' · the family does not know this trade yet (Family sheet)</small></div></div>' : '');
  }
  function chainHtml(f) {
    var node = function (icon, value, tipText, bad) { return '<div class="node' + (bad ? ' bad' : '') + '" data-tip="' + esc(tipText + (bad ? '. This is what holds sales back' : '')) + '">' + I.icon(icon) + '<b>' + value + '</b></div>'; };
    var arrow = '<i class="arr"></i>', r = Math.round;
    return '<div class="chain">' + node('still', r(f.made), 'Crates made last month', f.limit === 'stills') + arrow +
      (f.trucks == null ? '' : node('truck', f.trucks + '<em>×' + r(f.hauling) + '</em>', 'Trucks, and the crates they can haul in a month', f.limit === 'trucks') + arrow) +
      node('speakeasy', r(f.seats), 'Crates the speakeasies can pour', f.limit === 'seats') + arrow + node('men', r(f.drinkers), 'Crates the drinkers of his streets ask for', f.limit === 'drinkers') + arrow +
      node('liquor', r(f.sold), 'Crates sold last month') + '</div>' +
      '<div class="chain">' + node('takings', money(f.income), 'Dirty cash taken in last month') + arrow + node('men', money(f.costs), 'Wages, places and bribes') + arrow +
      node('laundering', money(f.washed), f.washed > 0 ? 'Dirty cash he washed in his laundries' : 'Nothing washed: he has no laundry that works', !(f.washed > 0)) + arrow +
      node('clean', money(f.tribute), 'Your share, sent to you already washed') + '</div>';
  }
  function placesHtml(d, f) {
    var groups = {}, order = [];
    d.buildings.forEach(function (b) { var k = b.type + ':' + b.level; if (!groups[k]) { groups[k] = { b: b, n: 0 }; order.push(k); } groups[k].n++; });
    var cell = function (icon, name, n, level, wash) { return '<div class="place' + (wash ? ' wash' : '') + '" data-tip="' + esc(name + (wash ? ': washes dirty cash' : '') + (level ? ', level ' + level : '')) + '">' + I.icon(icon) +
      '<b>×' + n + '</b>' + (level ? '<span class="lv">' + '<i></i>'.repeat(level) + '</span>' : '') + (wash ? '<em>LAUNDERING</em>' : '') + '</div>'; };
    return '<div class="places">' + order.map(function (k) { var x = groups[k]; return cell(x.b.type, x.b.name, x.n, x.b.level, washes(x.b.type)); }).join('') +
      (f && f.trucks ? cell('truck', 'Trucks that haul the liquor', f.trucks) : '') + (f && f.cars ? cell('car', 'Cars that carry the money', f.cars) : '') +
      (d.buildings.length ? '' : '<p>No place of ours yet</p>') + '</div>';
  }
  function sheetDistrict(id) {
    var x = find(id); if (!x) return;
    var d = x.d, html;
    if (d.owner === 'family') {
      var f = G.flows(g, id), h = historyOf(id), who = d.capo && CAPOS[d.capo] ? G.person(g, d.capo) : null, col = function (k) { return h.map(function (m) { return m[k]; }); };
      html = '<div class="head"><div class="mini">' + I.portrait(d.capo) + '</div><div><h2>' + esc(d.name) + '</h2><p>' + esc(x.city.name) + ' · ' + esc(capoName(d.capo)) + (who ? ' · ' + esc(who.rankName) : '') +
        (d.watched ? ' ' + ic('heat', 'Watched by the police after a raid', 'no') : '') + '</p></div></div>' + intentHtml(id) +
        '<div class="tiles">' + tile('streets', 'STREETS', Math.round(d.share) + '%', col('share'), 'Streets: the part of the district his men hold', { min: 0 }) +
        tile('heat', 'HEAT', Math.round(d.heat), col('heat'), 'Heat: how closely the police watch. Too much brings raids', { lessIsBetter: true, min: 0 }) +
        tile('goodwill', 'GOODWILL', Math.round(d.goodwill), col('goodwill'), 'Goodwill: what the neighbourhood thinks of you') +
        tile('men', 'MEN', d.men, col('men'), 'Men on his payroll', { min: 0 }) +
        (f ? tile('profit', 'PROFIT', money(f.profit), col('profit'), 'What the district made last month after costs') + tile('clean', 'TO YOU', money(f.tribute), col('toBoss'), 'Your share, sent to you already washed', { min: 0 }) : '') + '</div>' +
        (f ? chainHtml(f) : '') + placesHtml(d, f) +
        '<div class="acts"><button data-act="pick" data-order="appoint" data-district="' + esc(id) + '">Replace the capo</button><button data-act="close">Close</button></div>';
    } else {
      var o = G.openings(g).filter(function (o) { return o.district === id; })[0], traits = d.traits || {};
      var under = (G.takeovers ? G.takeovers(g) : []).filter(function (t) { return t.district === id; })[0];
      html = '<div class="head"><div class="mini">' + I.portrait('rival-' + d.owner) + '</div><div><h2>' + esc(d.name) + '</h2><p>' + esc(x.city.name) + ' · held by the ' + esc(d.owner) + 's</p></div></div>' +
        '<div class="places">' + [['nightlife', 'speakeasy', 'Nightlife'], ['industry', 'union', 'Industry'], ['port', 'warehouse', 'Port'], ['wealth', 'fence', 'Wealth']].filter(function (t) { return traits[t[0]] > 0; })
          .map(function (t) { return '<div class="place" data-tip="' + t[2] + ': ' + (traits[t[0]] >= 1.2 ? 'strong' : 'some') + ' here">' + I.icon(t[1]) + '<b>' + t[2] + '</b></div>'; }).join('') + '</div>' +
        (under ? '<div class="intent"><span class="gauge" style="color:' + WAY[under.way].color + '">' + I.ring(under.progress, WAY[under.way].icon) + '</span><div><b>' + esc(first(under.capoName)) + ' is taking it: ' + esc(WAY[under.way].word.toLowerCase()) + '</b><small>' + under.monthsLeft + ' month' + (under.monthsLeft > 1 ? 's' : '') + ' left</small></div><div class="mini">' + I.portrait(under.capo) + '</div></div>'
         : o && o.ways ? '<div class="ways">' + o.ways.map(function (w) { return '<button class="way" data-act="pick" data-order="takeover" data-way="' + w.way + '" data-district="' + esc(id) + '"' + (w.affordable ? '' : ' disabled') + ' style="--c:' + WAY[w.way].color + '" data-tip="' + esc(WAY[w.way].tip) + '">' +
             I.icon(WAY[w.way].icon) + '<b>' + WAY[w.way].word + '</b><span>' + I.icon(w.cur === 'clean' ? 'clean' : 'dirty') + money(w.cost) + '</span><span>' + I.icon('time') + w.months + ' mo</span></button>'; }).join('') + '</div>'
         : o ? '<div class="acts"><button class="go" data-act="pick" data-order="claim" data-district="' + esc(id) + '"' + (o.affordable ? '' : ' disabled') + '>Move in · ' + money(o.cost) + '</button></div>'
         : '<div class="intent"><span class="gauge" style="color:var(--bad)">' + I.ring(0, 'no') + '</span><div><b>Out of reach for now</b><small>your family has no way in from the streets it holds</small></div></div>') +
        '<div class="acts"><button data-act="close">Close</button></div>';
    }
    return (html);
  }
  function sheetPick(orderType, id, way) {
    var x = find(id);
    return sheetMen(orderType === 'takeover' ? 'Who takes ' + x.d.name + '? ' + WAY[way].word : (orderType === 'claim' ? 'Who moves into ' : 'Who takes ') + x.d.name + '?', '', G.candidates(g, id), orderType + ':' + id + (way ? ':' + way : ''), true, way);
  }
  // A man has earned his rank: the boss chooses which of two things he brings to the family.
  function sheetPromotions() {
    var list = G.promotions ? G.promotions(g) : []; if (!list.length) return null;
    return ('<h2>A man rises</h2>' + list.map(function (p) {
      return '<div class="card ask"><div class="head"><div class="mini">' + I.portrait(p.capo) + '</div><div><h3>' + esc(p.capoName) + '</h3><div class="who">' + esc(p.rankName) + ' · ' + esc(p.place) + (p.pay ? ' · ' + money(p.pay) + ' a month' : '') + '</div></div>' +
        '<span class="gauge" data-tip="He chooses by himself in ' + p.monthsLeft + ' month' + (p.monthsLeft > 1 ? 's' : '') + '">' + I.ring(p.monthsLeft / 3, 'time') + '</span></div>' +
        '<div class="choose">' + p.options.map(function (o) { return '<button data-act="promote" data-capo="' + esc(p.capo) + '" data-ability="' + esc(o.id) + '" style="--c:' + TRADE[o.sector] + '">' + I.icon(SECTOR[o.sector] || 'ambition') + '<b>' + esc(o.name) + '</b><span>' + esc(o.text) + '</span></button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="acts"><button data-act="close">Decide later</button></div>');
  }
  // What the family knows how to run: every kind of place, closed, open, or grown to its second and third size.
  function treeHtml() {
    if (!G.tree) return '';
    return '<h2 class="sub2">Places the family can run</h2><div class="tree">' + G.tree(g).map(function (t) {
      var busy = t.monthsLeft != null;
      return '<button class="know' + (t.tier ? '' : ' shut') + (busy ? ' busy' : '') + (t.role === 'laundering' ? ' wash' : '') + '" data-know="' + esc(t.id) + '">' +
        (busy ? '<span class="gauge">' + I.ring(t.progress || 0, t.id) + '</span>' : I.icon(t.id)) +
        '<span class="lv">' + [1, 2, 3].map(function (k) { return '<i' + (k <= t.tier ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' +
        (t.wantedBy.length ? '<span class="want">' + I.portrait(t.wantedBy[0].id) + '</span>' : '') + '</button>'; }).join('') + '</div><div id="know">Touch a place to see what opening or enlarging it takes.</div>';
  }
  function knowText(id) {
    var t = G.tree(g).filter(function (x) { return x.id === id; })[0], n = t.next, faces = function (list) { return list.map(function (m) { return '<span class="slot sm" data-tip="' + esc(m.name) + '">' + I.portrait(m.id) + '</span>'; }).join(''); };
    return '<b>' + esc(t.name) + ' · ' + (t.tier ? 'size ' + 'I'.repeat(t.tier) : 'not known yet') + '</b>' + esc(ROLE[t.role] ? 'A place that ' + ROLE[t.role] : '') +
      (t.wantedBy.length ? '<div class="move">' + faces(t.wantedBy) + '<span>' + esc(t.wantedBy.map(function (m) { return first(m.name); }).join(', ')) + (t.wantedBy.length > 1 ? ' ask' : ' asks') + ' for it</span></div>' : '') +
      (t.likedBy.length ? '<div class="move yes">' + faces(t.likedBy) + '<span>His trade: learnt in half the time</span></div>' : '') +
      (t.monthsLeft != null ? '<div class="move"><span class="gauge">' + I.ring(t.progress || 0, 'time') + '</span><span>Being learnt: ' + t.monthsLeft + ' month' + (t.monthsLeft > 1 ? 's' : '') + ' left</span></div>'
        : n ? '<button class="go" data-act="learn" data-building="' + esc(t.id) + '"' + (n.affordable ? '' : ' disabled') + '>' + I.icon('clean') + ' ' + (t.tier ? 'Enlarge to size ' + 'I'.repeat(n.tier) : 'Open this trade') + ' · ' + money(n.cost) + ' · ' + n.months + ' months</button>' : '<div class="move yes">' + I.icon('yes') + '<span>As large as it gets</span></div>');
  }
  // The family as a pyramid: few places at the top, and a man waits when the rank above is full.
  function pyramidHtml() {
    if (!G.ranks) return '';
    return '<div class="pyr">' + G.ranks(g).slice().reverse().map(function (r) {
      var cells = r.men.map(function (m) { return '<span class="slot" data-tip="' + esc(m.name) + '">' + I.portrait(m.id) + '</span>'; });
      for (var i = r.men.length; r.places != null && i < r.places; i++) cells.push('<span class="slot empty" data-tip="A free place at this rank">' + I.portrait('nobody') + '</span>');
      r.waiting.forEach(function (m) { cells.push('<span class="slot wait" data-tip="' + esc(m.name) + ' has earned this rank and waits for a place">' + I.portrait(m.id) + '</span>'); });
      return '<div class="tier"><small>' + esc(r.name) + (r.pay ? ' · ' + money(r.pay) : '') + '</small><div>' + (cells.join('') || '<span class="slot none"></span>') + '</div></div>'; }).join('') + '</div>';
  }
  // The capos propose, the boss decides: a killing or a kidnapping never happens without his word.
  function sheetProposals() {
    var list = G.proposals(g); if (!list.length) return null;
    return ('<h2>Your word is needed</h2>' + list.map(function (p) {
      var total = p.waits || p.monthsLeft, odds = p.odds ? ic(p.odds === 'good' ? 'yes' : 'no', p.odds === 'good' ? 'He should pull it off' : 'It may well go wrong', p.odds === 'good' ? 'yes' : 'no') : '';
      return '<div class="card ask"><div class="head"><div class="mini">' + I.portrait(p.capo) + '</div><div><h3>' + esc(p.capoName) + '</h3><div class="who">' + esc(p.place) + '</div></div>' +
        '<span class="gauge" data-tip="He waits ' + p.monthsLeft + ' more month' + (p.monthsLeft > 1 ? 's' : '') + ' for an answer">' + I.ring(p.monthsLeft / total, 'time') + '</span></div>' +
        '<div class="intent"><span class="gauge" style="color:var(--bad)">' + I.ring(1, p.kind) + '</span><div><b>' + esc(p.label) + '</b><small>' + esc('Target: ' + p.target + ' · ' + p.why) + '</small></div>' + odds + '</div>' +
        (p.gain || p.risk ? '<div class="st">' + (p.gain ? ic('yes', 'What it brings', 'yes') + ' ' + esc(p.gain) + '<br>' : '') + (p.risk ? ic('no', 'What it risks', 'no') + ' ' + esc(p.risk) : '') + '</div>' : '') +
        '<div class="acts"><button class="go" data-act="approve" data-id="' + esc(p.id) + '">Approve</button><button data-act="refuse" data-id="' + esc(p.id) + '">Refuse</button></div></div>'; }).join('') +
      '<div class="acts"><button data-act="close">Decide later</button></div>');
  }
  // ---- the wheel: six trades around the boss, three rings each, lit by capos who rise in rank
  var TRADE = { liquor: '#ffb347', vice: '#e86aa6', money: '#7fe08a', law: '#6aa6ff', muscle: '#ff5a3a', routes: '#d8c48a' };
  function arc(a0, a1, r0, r1) {      // a slice of ring between two angles (degrees, 0 at the top, clockwise)
    var pt = function (a, r) { var t = (a - 90) * Math.PI / 180; return (r * Math.cos(t)).toFixed(1) + ' ' + (r * Math.sin(t)).toFixed(1); };
    return 'M' + pt(a0, r0) + 'L' + pt(a0, r1) + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + pt(a1, r1) + 'L' + pt(a1, r0) + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + pt(a0, r0) + 'Z';
  }
  function wheelSvg(w) {
    var step = 360 / w.sectors.length, out = '<svg class="wheel" viewBox="-205 -182 410 364"><defs><filter id="lit" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    w.sectors.forEach(function (s, i) {
      var a0 = i * step + 2, a1 = (i + 1) * step - 2, mid = (a0 + a1) / 2, t = (mid - 90) * Math.PI / 180, c = TRADE[s.id] || '#e8c463';
      s.rings.forEach(function (r, k) {
        out += '<path data-skill="' + i + ':' + k + '" d="' + arc(a0, a1, 46 + k * 35, 78 + k * 35) + '" fill="' + c + '"' + (r.lit ? ' filter="url(#lit)"' : ' fill-opacity="' + (0.2 - k * 0.04) + '"') + (r.shared ? ' class="shared"' : r.research && r.research.monthsLeft != null ? ' class="learning"' : '') + '/>';
      });
      out += '<text x="' + (167 * Math.cos(t)).toFixed(1) + '" y="' + (167 * Math.sin(t) + 4).toFixed(1) + '" fill="' + c + '" style="fill:' + c + '">' + esc(s.name) + '</text>';
    });
    return out + '<circle r="38" fill="#0e0e15" stroke="#e8c463" stroke-width="2"/><text class="boss" y="-1">Boss</text><text class="count" y="15">' + w.lit + ' / ' + w.of + '</text></svg>';
  }
  function skillText(w, key) {
    var p = key.split(':'), s = w.sectors[+p[0]], r = s.rings[+p[1]], rs = r.research;
    return '<b style="color:' + TRADE[s.id] + '">' + esc(s.name) + ' · ' + esc(r.name) + '</b>' + esc(r.text) + '<br><small style="color:var(--dim)">' +
      (r.shared ? 'Known to the whole family' : r.lit ? 'Brought by ' + esc(r.by.map(capoName).join(', ')) + ': only his district has it' : 'Not yet. A capo of yours has to rise in this trade.') + '</small>' +
      (rs && rs.monthsLeft != null ? '<div class="move"><span class="gauge">' + I.ring(1 - rs.monthsLeft / rs.months, 'time') + '</span><span>The family is learning it: ' + rs.monthsLeft + ' month' + (rs.monthsLeft > 1 ? 's' : '') + ' left</span></div>'
        : rs && rs.open && !r.shared ? '<button class="go" data-act="research" data-ability="' + esc(r.id) + '" data-key="' + key + '"' + (G.hud(g).clean >= rs.cost ? '' : ' disabled') + '>' + I.icon('clean') + ' Teach the whole family · ' + money(rs.cost) + ' · ' + rs.months + ' months</button>' : '');
  }
  function men() {      // everyone the family counts on, each named once
    var ids = [], v = G.view(g), add = function (id) { if (id && ids.indexOf(id) < 0) ids.push(id); };
    v.cities.forEach(function (c) { c.districts.forEach(function (d) { if (d.owner === 'family') add(d.capo); }); });
    Object.keys(v.table || {}).forEach(function (k) { add(v.table[k]); }); Object.keys(v.underbosses || {}).forEach(function (k) { add(v.underbosses[k]); });
    return ids.map(function (id) { return G.person(g, id); }).filter(Boolean);
  }
  function sheetFamily() {
    var w = G.wheel(g);
    return ('<h2>The family</h2><p>Six trades around you. Your men light them as they rise in rank, and what they bring serves the whole family.</p>' + wheelSvg(w) +
      '<div id="skill">Touch a part of the wheel to see what it brings.</div>' + pyramidHtml() + treeHtml() +
      men().map(function (m) {
        return '<div class="card"><div class="head"><div class="mini">' + I.portrait(m.id) + '</div><div><h3>' + esc(m.name) + '</h3><div class="who">' + esc(m.rankName) + ' · ' + esc(m.specialty) + '</div></div></div>' +
          '<div class="bar"><i style="width:' + Math.min(100, Math.round(100 * m.total / (m.nextRankAt || m.total || 1))) + '%"></i></div>' +
          '<div class="st">' + (m.nextRankAt ? 'Next rank at ' + Math.round(m.nextRankAt) + ' (now ' + Math.round(m.total) + ')' : 'Highest rank') + '</div>' +
          (m.abilities.length ? m.abilities.map(function (a) { return '<div class="mv"><span style="color:' + TRADE[a.sector] + '">' + esc(a.name) + '</span>: ' + esc(a.text) + '</div>'; }).join('') : '<div class="st">Has brought nothing to the wheel yet.</div>') + '</div>'; }).join('') +
      '<div class="acts"><button data-act="close">Close</button></div>');
  }
  function sheetJournal() {
    return ('<h2>Journal</h2><ul class="list">' + (g.journal.length ? g.journal.slice(0, 40).map(function (e) {
      return '<li class="ev">' + ic(e.type === 'decision' ? moveIcon(e.kind) : e.type === 'attack' ? 'attack' : e.type === 'raid' ? 'heat' : e.type === 'promotion' ? 'ambition' : I.has(e.kind) ? e.kind : 'time', '', e.type === 'attack' || e.type === 'raid' || e.outcome === 'failed' ? 'no' : '') + '<div>' + esc(e.label) + '<small>' + esc(e.date) + ' · ' + esc(e.place) + (e.why ? ' · ' + esc(e.why) : '') + '</small></div></li>'; }).join('') : '<li>Nothing has happened yet</li>') +
      '</ul><div class="acts"><button data-act="new">New game</button><button data-act="close">Close</button></div>');
  }


  function carTip(c) {
    var k = CARGO[c.cargo] || { icon: c.vehicle, word: c.kind }, l = c.load || {}, x = find(c.district), end = function (e) { return I.has(e) ? I.icon(e) : esc(PLACE[e] || e); };
    return '<span class="i" style="color:' + k.color + '">' + I.icon(k.icon) + '</span> <b>' + esc(k.word) + '</b><br>' +
      [l.crates ? Math.round(l.crates) + ' crates' : '', l.amount ? money(l.amount) : '', l.men ? l.men + ' men' : ''].filter(Boolean).join(' · ') +
      '<br><span class="way">' + end(c.from) + ' <i class="arr"></i> ' + end(c.to) + '</span>' + (x ? ' · ' + esc(x.d.name) + (x.d.capo ? ', sent by ' + esc(first(capoName(x.d.capo))) : '') : '');
  }

  return {
    use: function (game) { g = game; },
    start: sheetStart, district: sheetDistrict, pick: sheetPick, proposals: sheetProposals, promotions: sheetPromotions, family: sheetFamily, journal: sheetJournal,
    man: function (id) { return manHtml(picking.list.filter(function (c) { return c.id === id; })[0], picking.action, picking.label); },
    skill: function (key) { return skillText(G.wheel(g), key); }, know: knowText, carTip: carTip, find: find, intentOf: intentOf, moveIcon: moveIcon,
    esc: esc, money: money, capoName: capoName, first: first, CARGO: CARGO, WAY: WAY, ROLE: ROLE
  };
});
