// The sheets of the new screen, as text. Each one is worked out from what
// AshportEmpire shows (its view, its hud, its journal) and returned as HTML:
// nothing here touches the page or changes the game, so every sheet is tested
// without a browser (tests/cards.test.js). city.js shows them and passes the
// boss's touches back. A button says what it does with data-act and the rest
// of the order in its other data- attributes.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./icons.js'), require('./turf.js'));
  else root.AshportCards = factory(root.AshportIcons, root.AshportTurf);
})(typeof self !== 'undefined' ? self : this, function (I, T) {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var first = function (name) { return String(name).split(' ')[0]; };
  var months = function (n) { return n + ' month' + (n > 1 ? 's' : ''); };
  var funds = function (hud) { return Math.max(0, hud.dirty || 0) + Math.max(0, hud.clean || 0); };
  // T.person throws on a name it does not know, and a sheet must never fail to open: what is not a person here is a key place or a rival family.
  var known = function (id) { try { return T.person(id); } catch (e) { return null; } };
  var nameOf = function (id) { var p = known(id); return p ? p.name : 'Nobody'; };
  var icon = function (k) { return I.icon(I.has(k) ? k : KEYICON[k] || 'unknown'); };
  var iconName = function (k) { return I.has(k) ? k : KEYICON[k] || 'unknown'; };
  var data = function (o) { return Object.keys(o).map(function (k) { return ' data-' + k + '="' + esc(o[k]) + '"'; }).join(''); };
  var button = function (act, o, label, opt) { return '<button' + (opt && opt.cls ? ' class="' + opt.cls + '"' : '') + ' data-act="' + act + '"' + data(o || {}) + (opt && opt.off ? ' disabled' : '') + '>' + label + '</button>'; };
  var cityOf = function (view, id) { return view.cities.filter(function (c) { return c.id === id; })[0] || null; };
  // The street name a block is on. The block says it itself (a name can be any shape); a city of an old save only has rectangles.
  var zoneOf = function (c, x, y) { var b = c.blocks && c.blocks[y * c.w + x];
    if (b && typeof b.zone === 'number' && c.zones[b.zone]) return c.zones[b.zone];
    return c.zones.filter(function (z) { return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1; })[0] || { name: c.name }; };

  // ---- words and pictures shared by the sheets
  var STATS = [['muscle', 'Muscle: takes and holds streets, wins fights'], ['business', 'Business: makes every place pay more'], ['cunning', 'Cunning: hides the money, sees traps'], ['charisma', 'Charisma: keeps the neighbourhood and his men on his side']];
  var WAY = { force: { icon: 'muscle', color: '#ff5a3a', word: 'By force', tip: 'His men go in gun in hand' }, bribe: { icon: 'bribe', color: '#e8c463', word: 'With an envelope', tip: 'He pays the other side\'s man to change sides' },
              buy: { icon: 'clean', color: '#8fbf97', word: 'By buying', tip: 'He buys the place outright' } };
  var HAUL = { liquor: ['liquor', '#ffb347', 'Liquor on its way to the bars'], takings: ['takings', '#e8c463', 'Takings, dirty cash, on their way to the club'], wash: ['dirty', '#6ad0e0', 'Dirty cash on its way to be washed'], crew: ['muscle', '#ff5a3a', 'A crew on its way to take a place'],
               patrol: ['heat', '#4a7dff', 'Police patrol: the hotter the city, the more of them'] };
  var GOODS = { goods: ['warehouse', '#c9a26b', 'Crates on their way to the fences', 'crates'], cars: ['chopshop', '#9fb4c8', 'Stolen cars on their way to the fences', 'cars'], weed: ['loft', '#8fce7a', 'Weed on its way to the bars and the houses', 'bags'] };
  // What a vehicle hauls: its picture, its colour, the words for it, and what its load is counted in.
  function haul(car) { return (car.kind === 'convoy' ? (car.cargo === 'liquor' ? HAUL.liquor : GOODS[car.cargo] || GOODS.goods) : car.kind === 'goods' ? GOODS[car.cargo] || GOODS.goods : HAUL[car.kind]) || HAUL.takings; }
  var EVENT = { opened: 'works', enlarged: 'works', taken: 'seize', moving: 'muscle', burnt: 'attack', repelled: 'muscle', rank: 'ambition', asks: 'time', knocks: 'men', unpaid: 'dirty', bust: 'heat', learned: 'yes', feud: 'attack', car: 'car',
                granted: 'yes', line: 'loyalty', promise: 'yes', vendetta: 'attack', cut: 'dirty', bought: 'clean', denied: 'no', welcomed: 'men', ruled: 'loyalty', parted: 'no', studying: 'time', hijack: 'attack', seizure: 'heat', truck: 'truck', seated: 'men', unseated: 'no', underboss: 'ambition', whispers: 'whispers', betrayal: 'betrayal', gift: 'gift', outcome: 'yes' };
  var BAD = { vendetta: 1, hijack: 1, seizure: 1, burnt: 1, unpaid: 1, bust: 1, feud: 1, parted: 1, whispers: 1, betrayal: 1 };
  var bad = function (e) { return !!BAD[e.type] || (e.type === 'promise' && e.kept === false) || (e.type === 'outcome' && e.good === false); };      // a broken promise is bad news, a kept one is not
  var WAIT = { money: 'saving for it', rank: 'waiting for his next rank', time: 'under way' };
  var GRIP = { family: 'Your family holds this street', rival: 'The rivals hold this street', contested: 'Both sides claim this street' };
  var KEYICON = { brewery: 'still', hotel: 'speakeasy', port: 'truck', depot: 'warehouse', cityhall: 'bribe', precinct: 'police', club: 'hideout' };
  var DOOR = { name: 'asks for a place in the family', rise: 'has earned a club of his own', poach: 'would leave the other side for you' };

  function planWord(p) {
    if (!p) return 'Nothing in hand';
    if (p.move === 'take') return 'Taking a place' + (p.name ? ': ' + p.name : '');
    if (p.move === 'open') return 'Opening: ' + p.name;
    if (p.move === 'enlarge') return 'Enlarging: ' + p.name;
    return 'Holding what he has';
  }
  function planIcon(p) { return !p ? 'time' : p.move === 'take' ? (WAY[p.way] || WAY.force).icon : p.kind && I.has(p.kind) ? p.kind : 'time'; }
  // what stands over a capo on the map: his face, a gauge of what he is after, and what it is
  function mark(l, h, d) {
    return I.ring(l.progress == null ? 0 : l.progress) + '<span class="pf">' + I.portrait(l.capo) + '</span><span class="do">' + icon(planIcon(l)) + '</span>' +
      (h ? '<span class="hp" data-tip="' + esc(h.say) + '"><i class="' + h.money + '"></i><i class="' + h.men + '"></i><i class="' + h.threat + '"></i></span>' : '') +
      (d ? '<span class="say ' + d.tone + '">' + esc(d.word) + (d.power ? '<b class="pw ' + d.power.tone + '">' + (ARROW[d.power.tone] || '') + ' ' + d.power.now + '</b>' : '<b>' + esc(d.earns) + '</b>') + '</span>' : '');
  }
  // The health of a capo's streets, read at a glance: money (do they earn), men (how he stands with the boss), threat (rivals and police).
  // health(city, capo) -> { money, men, threat: 'good' | 'warn' | 'bad', worst, say: the one line that matters }.
  var HEALTH = { good: 0, warn: 1, bad: 2 }, HOT = 60;
  function health(c, k) {
    var mine = (c.places || []).filter(function (p) { return p.owner === 'family' && p.capo === k.id; }), choke = null, who = first(k.name || nameOf(k.id));
    mine.forEach(function (p) { if (!choke && p.strains && p.strains.length) choke = p.strains[0].label; });
    var o = { money: 'good', men: 'good', threat: 'good' }, why = {};
    if (k.income != null && k.income <= 0) { o.money = k.places ? 'bad' : 'warn'; why.money = k.places ? 'His places earn nothing' : 'Nothing to earn from yet'; }
    else if (choke) { o.money = 'warn'; why.money = choke; }
    if (k.mood === 'bitter') { o.men = 'bad'; why.men = who + ' is bitter: he may turn on you'; } else if (k.mood === 'restless') { o.men = 'warn'; why.men = who + ' is restless'; }
    var ch = c.chief;
    if (ch && ch.vendetta > 0) { o.threat = 'bad'; why.threat = ch.name + ' wants blood: ' + ch.vendetta + ' month' + (ch.vendetta > 1 ? 's' : '') + ' of vendetta'; }
    else if (k.at && k.at.why === 'raid') { o.threat = 'warn'; why.threat = k.at.label || 'The rivals press on his streets'; }
    else if ((c.heat || 0) >= HOT) { o.threat = 'warn'; why.threat = 'The police watch this city closely'; }
    var worst = 'good', say = 'His streets are doing well';
    ['money', 'men', 'threat'].forEach(function (key) { if (HEALTH[o[key]] > HEALTH[worst]) { worst = o[key]; say = why[key]; } });
    o.worst = worst; o.say = say; return o;
  }
  function healths(view) { var out = {}; view.cities.forEach(function (c) { (c.capos || []).forEach(function (k) { out[c.id + k.id] = health(c, k); }); }); return out; }
  function healthLine(h) {
    var chip = function (key, label) { return '<span class="chip ' + h[key] + '"><i></i>' + label + '</span>'; };
    return '<div class="move health ' + h.worst + '"><span><span class="chips">' + chip('money', 'MONEY') + chip('men', 'MEN') + chip('threat', 'THREAT') + '</span>' + esc(h.say) + '</span></div>';
  }
  // The laundries of the whole family: what they can wash a month, what they washed and kept last month,
  // and whether the dirty cash has grown past what the boss can keep unnoticed.
  function wash(view, hud) {
    var o = { washes: 0, washed: 0, cut: 0 };
    view.cities.forEach(function (c) { var m = c.money || {}; o.washes += m.washes || 0; o.washed += m.washed || 0; o.cut += m.cut || 0; });
    o.washes = Math.round(o.washes); o.washed = Math.round(o.washed); o.cut = Math.round(o.cut);
    o.hot = hud.dirty > T.RULES.stash;
    o.line = o.washes > 0 ? 'washes ' + money(o.washes) + '/mo' : 'no laundry yet';
    return o;
  }
  // Time that stands still: the word for it and the reason, or null while it runs.
  function clock(hud, picking) {
    if (picking) return { word: 'TIME STOPPED', why: 'Choose a street' };
    if (!hud.paused) return null;
    return { word: 'TIME STOPPED', why: hud.pending ? hud.pending + (hud.pending > 1 ? ' wait' : ' waits') + ' for your word' : 'Tap Play to go on' };
  }
  // What last month did to a total, written beside it: "+$52", or nothing when it did not move.
  function change(n) { n = Math.round(n || 0); return n > 0 ? '+' + money(n) : n < 0 ? '\u2212' + money(-n) : ''; }
  // The dollars a car carries: a month of takings from one place, or a month of cash sent to one laundry.
  // Money seen on the map, over the place where it comes in or leaves.
  function pop(n) { return !n ? null : { text: (n > 0 ? '+' : '\u2212') + money(Math.abs(n)), cls: n > 0 ? 'in' : 'out' }; }
  // The places burnt out these last months, city by city: the map keeps them black for a while.
  var SCAR = 6;
  function scars(journal, month) {
    var out = {};
    (journal || []).forEach(function (e) { if (e.type === 'burnt' && typeof e.x === 'number' && month - e.month < SCAR) (out[e.city] = out[e.city] || []).push({ x: e.x, y: e.y }); });
    return out;
  }
  function carLoad(car) { return (car.kind === 'takings' || car.kind === 'wash') && car.amount > 0 ? money(car.amount) : ''; }
  function carTip(car, empty) {
    var h = haul(car), unit = h[3] || (h === HAUL.liquor ? 'cases' : ''), n = car.amount > 0 ? (carLoad(car) || (unit ? car.amount + ' ' + unit : '')) : '', road = car.kind === 'convoy';
    return '<b style="color:' + h[1] + '">' + icon(h[0]) + ' ' + esc(road ? 'On the road to the next city' : h[2]) + '</b>' + (road && car.way ? '<br>' + esc(car.way) : '') + (empty ? '<br>Empty, on its way to load' : n ? '<br>' + n + ' on board' : '') + (car.capo ? '<br>' + esc(nameOf(car.capo)) + (car.kind === 'crew' && WAY[car.cargo] ? ' · ' + WAY[car.cargo].word.toLowerCase() : '') : '');
  }
  // The badges that light up over the map when something happens, and what a touch on one says.
  var FX = { fire: ['attack', 'Fire: a place burns'], gunfire: ['muscle', 'Gunfire'], police: ['heat', 'Police'], promotion: ['ambition', 'Good news for the family'], betrayal: ['betrayal', 'Betrayal'] };
  function fxTip(kind, say, type) {
    if (kind === 'news') return icon(EVENT[type] || 'time') + ' ' + esc(say || '');
    var f = FX[kind] || ['time', kind]; return '<b>' + icon(f[0]) + ' ' + esc(f[1]) + '</b>' + (say ? '<br>' + esc(say) : '');
  }
  // An event as a small tile on the edge of the screen: its picture and its words. A touch goes where it happened, when it has a place.
  function news(e) {
    var there = typeof e.x === 'number' && e.city;
    return '<button class="news' + (bad(e) ? ' bad' : e.type === 'outcome' && e.good === true ? ' good' : '') + '"' + (there ? data({ city: e.city, x: e.x, y: e.y }) : '') + '>' + icon(EVENT[e.type] || 'time') + '<span>' + esc(e.label || e.type) + '</span></button>';
  }
  // The same thing told month after month is noise: an event is news the first month, and again only once a month has passed without it.
  function untold(events, seen, month) {
    return (events || []).filter(function (e) {
      var k = [e.type, e.city || '', e.capo || '', e.label || ''].join('|'), last = seen[k];
      seen[k] = month;
      return last === undefined || last < month - 1;
    });
  }
  function head(capo, title, sub) {
    return '<div class="head"><div class="mini">' + I.portrait(capo) + '</div><div><h2>' + esc(title) + '</h2><p>' + sub + '</p></div></div>';
  }
  function intent(p) {
    var bits = [p.why, WAIT[p.waiting], p.cost ? money(p.saved || 0) + ' of ' + money(p.cost) : ''].filter(Boolean);
    return '<div class="intent"><span class="gauge">' + I.ring(p.progress == null ? 1 : p.progress, planIcon(p)) + '</span><div><b>' + esc(planWord(p)) + '</b><small>' + esc(bits.join(' · ')) + '</small></div></div>';
  }
  function tile(ic, label, value, tip) { return '<div class="tile" data-tip="' + esc(tip) + '"><small>' + icon(ic) + label + '</small><b>' + value + '</b></div>'; }

  // ---- choosing the first man: a row of faces, and the one being looked at in full
  function man(c, action, label) {
    var tone = (I.FACES[c.id] || {}).tone || '#e8c463';
    var dial = function (name, v, tip) { return '<div class="dial" style="color:' + (name === 'loyalty' ? 'var(--good)' : 'var(--accent)') + '" data-tip="' + tip + '">' + I.ring(v / 100, name) + '<b>' + v + '</b></div>'; };
    var w = WAY[c.way] || WAY.force;
    return '<div class="man" style="--tone:' + tone + '"><div class="big">' + I.portrait(c.id) + '</div><div class="about"><h3>' + esc(c.name) + '</h3><div class="chip">' + esc(c.specialty) + '</div>' +
      STATS.map(function (x) { return '<div class="stat" data-tip="' + x[1] + '">' + I.icon(x[0]) + I.pips(c[x[0]], 10) + '<b>' + c[x[0]] + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="traits">' + dial('loyalty', c.loyalty, 'Loyalty: how much of your share he really sends up') + dial('ambition', c.ambition, 'Ambition: how hard he pushes, and how much he wants your chair') +
      '<div class="words"><span data-tip="' + esc(w.tip) + '" style="color:' + w.color + '">' + I.icon(w.icon) + ' ' + w.word + '</span>' +
      (c.likes || []).map(function (k) { return '<span class="yes">' + esc(k) + '</span>'; }).join('') + (c.refuses || []).map(function (k) { return '<span class="no">' + esc(k) + '</span>'; }).join('') + '</div></div>' +
      (c.trade ? '<div class="move">' + I.icon('time') + '<span>He will start with: ' + esc(c.trade.toLowerCase()) + '</span></div>' : '') +
      button(action, { capo: c.id }, esc(label + ' ' + first(c.name)), { cls: 'go' });
  }
  function start(list) {
    return '<h2>Who runs your first streets?</h2><p>You are the boss. You pick the man, he opens his club in Ashport and runs his streets his own way.</p>' +
      '<div class="faces">' + list.map(function (c, i) { return '<button class="facebtn' + (i ? '' : ' on') + '" data-face="' + esc(c.id) + '">' + I.portrait(c.id) + '<small>' + esc(first(c.name)) + '</small></button>'; }).join('') + '</div>' +
      '<div id="who">' + man(list[0], 'start', 'Start with') + '</div>';
  }

  // ---- what waits for the boss's word: quarrels, key places asked for, men at the door
  function price(cost, purse) { return cost > purse ? '<small class="short">Short by ' + money(cost - purse) + '</small>' : ''; }
  function feudCard(c, f) {
    var side = function (id) { return '<div><span class="slot">' + I.portrait(id) + '</span>' + button('rule', { city: c.id, id: f.id, winner: id }, 'Rule for ' + esc(first(nameOf(id)))) + '</div>'; };
    return '<div class="card ask"><h3>' + icon('attack') + ' ' + esc(f.label) + '</h3><p>Rule for one of them. The other will not forget it.</p><div class="versus">' + side(f.a) + side(f.b) + '</div></div>';
  }
  function askCard(c, a, purse) {
    var w = WAY[a.way] || WAY.force, o = { city: c.id, id: a.id };
    return '<div class="card ask">' + head(a.capo, first(nameOf(a.capo)) + ' wants the ' + a.name, esc(zoneOf(c, a.x, a.y).name) + ' · ' + esc(c.name)) +
      '<div class="move">' + icon(a.key) + '<span>' + esc(a.gives || '') + '</span></div>' +
      '<div class="move" style="--c:' + w.color + '">' + icon(w.icon) + '<span>' + w.word + ' · ' + money(a.cost) + ' from you · ' + months(a.months) + (a.why ? ' · ' + esc(a.why) : '') + '</span></div>' + price(a.cost, purse) +
      '<div class="sides"><div class="side yes"><small>IF YOU SAY YES</small><b class="out">\u2212' + money(a.cost) + '</b>' +
        (a.expects ? '<b class="in">+' + money(a.expects.gain) + ' a month, promised</b><span>You will see in ' + months(a.expects.months) + ' whether he kept his word</span>' : a.expects === null ? '<span>No money promised: it serves the family another way</span>' : '') +
        button('answer', { city: c.id, id: a.id, yes: 1 }, 'Yes, take it', { cls: 'go', off: a.cost > purse }) + '</div>' +
      '<div class="side no"><small>IF YOU SAY NO</small><b>You keep your money</b><span>' + esc(first(nameOf(a.capo))) + ' will not forget a place refused: it weighs on him</span>' +
        button('answer', { city: o.city, id: o.id, yes: 0 }, 'No') + '</div></div></div>';
  }
  // an answer the boss cannot pay says how far he is from it
  function short(cost, purse) { return cost > purse ? '<small>Not enough money: ' + money(purse) + ' of ' + money(cost) + '</small>' : ''; }
  function doorCard(c, d, purse) {
    var poach = d.door === 'poach', full = c.seats && c.seats.taken >= c.seats.total;
    if (d.handled && !poach)      // the city has an underboss: he takes the man in himself, the boss has nothing to decide
      return '<div class="card ask">' + head(d.capo, d.name, esc(d.specialty) + ' · ' + (DOOR[d.door] || DOOR.name)) +
        '<div class="move yes">' + icon('men') + '<span>' + esc(first(nameOf(d.handled))) + ' takes him in himself: he is your underboss in ' + esc(c.name) + '</span></div>' +
        ((d.chairs || []).length ? '<div class="acts col">' + button('chairs', { city: c.id, capo: d.capo }, 'A chair at the table') + '</div>' : '') + '</div>';
    return '<div class="card ask">' + head(d.capo, d.name, esc(d.specialty) + ' · ' + (DOOR[d.door] || DOOR.name) + (d.by && known(d.by) ? ' · spoken for by ' + esc(first(nameOf(d.by))) : '')) +
      (d.why ? '<div class="move">' + icon('time') + '<span>' + esc(d.why) + '</span></div>' : '') + price(d.cost, purse) +
      (full ? '<small class="short">No seat left in ' + esc(c.name) + ': ' + c.seats.total + ' capos is all the city carries until the family holds another key place</small>' : '') +
      '<div class="acts col">' + (poach ? button('welcome', { from: c.id, city: c.id, capo: d.capo }, 'Take him in · ' + money(d.cost) + (full ? '' : short(d.cost, purse)), { cls: 'go', off: full || d.cost > purse })
        : button('seat', { city: c.id, capo: d.capo }, 'A club in ' + esc(c.name) + ' · ' + money(d.cost) + (full ? '' : short(d.cost, purse)), { cls: 'go', off: full || d.cost > purse })) +
      ((d.chairs || []).length ? button('chairs', { city: c.id, capo: d.capo }, 'A chair at the table') : '') +
      (d.roads || []).map(function (r) { return button('road', { from: c.id, city: r.city, capo: d.capo }, 'Send him to ' + esc(r.name) + ' · ' + money(r.cost) + short(r.cost, purse), { off: r.cost > purse }); }).join('') + '</div></div>';
  }
  // ---- the table: three chairs for the whole family, each for one man who runs no street
  var POST = { bookkeeper: ['clean', 'Every laundry of the family washes more. His Business counts.'], routes: ['truck', 'More loads go down the roads between cities. His Cunning counts.'], fixer: ['heat', 'Every city cools faster. His Charisma counts.'] };
  function table(view) {
    if (!view.table || !view.table.length) return '';
    return '<h3 class="sub2">The table</h3><div class="tier"><div>' + view.table.map(function (t) { var p = POST[t.post] || ['men', ''];
      return t.capo ? '<button class="slot chair" data-act="chair"' + data({ post: t.post }) + ' data-tip="' + esc(t.name + ': ' + t.who + '. ' + (t.gives || '')) + '">' + I.portrait(t.capo) + '<i>' + icon(p[0]) + '</i></button>'
        : '<span class="slot chair empty" data-tip="' + esc(t.name + ': empty. ' + p[1] + ' A man at your door can take it.') + '">' + icon(p[0]) + '</span>'; }).join('') + '</div></div>';
  }
  function chairs(view, cityId, id) {
    var c = cityOf(view, cityId), d = c && c.doors.filter(function (q) { return q.capo === id; })[0]; if (!d) return null;
    var free = d.chairs || [];
    return head(d.capo, 'A chair at the table', esc(d.name) + ' · ' + esc(d.specialty)) + '<p>He runs no street: he sits with you and works for the whole family.</p>' +
      (view.table || []).map(function (t) { var p = POST[t.post] || ['men', ''], open = free.indexOf(t.post) >= 0;
        return '<div class="move">' + icon(p[0]) + '<span><b>' + esc(t.name) + '</b>' + (t.capo ? ' · ' + esc(t.who) + ' sits there' : ' · ' + money(t.pay) + ' a month') + '<br><small>' + esc(p[1]) + '</small></span></div>' +
          (open ? '<div class="acts col">' + button('sit', { city: c.id, capo: d.capo, post: t.post }, 'Seat him as ' + esc(t.name), { cls: 'go' }) + '</div>' : ''); }).join('') +
      '<div class="acts">' + button('requests', {}, 'Back') + '</div>';
  }
  function chair(view, post) {
    var t = (view.table || []).filter(function (q) { return q.post === post; })[0]; if (!t || !t.capo) return null;
    return head(t.capo, t.who, esc(t.name) + ' at the table · ' + esc(t.specialty || '')) +
      (t.gives ? '<div class="move yes">' + icon((POST[t.post] || ['yes'])[0]) + '<span>' + esc(t.gives) + '</span></div>' : '') +
      '<div class="move' + (t.paid === false ? ' no' : '') + '">' + icon('clean') + '<span>' + money(t.pay) + ' a month' + (t.paid === false ? ' · not paid last month: he gave nothing' : '') + '</span></div>' +
      '<h3 class="sub2">Part with him</h3><p>He leaves the table, and the family. This cannot be taken back.</p>' +
      '<div class="acts">' + button('unseat', { post: t.post }, 'Send him away', { cls: 'go bad' }) + button('family', {}, 'Keep him') + '</div>';
  }
  function requests(view, hud) {
    var purse = funds(hud), cards = [];
    view.cities.forEach(function (c) {
      c.feuds.forEach(function (f) { cards.push(feudCard(c, f)); });
      c.asks.forEach(function (a) { cards.push(askCard(c, a, purse)); });
      c.doors.forEach(function (d) { cards.push(doorCard(c, d, purse)); });
    });
    return '<h2>Your word is needed</h2>' + (cards.length ? '<p>The clock is stopped while they wait. Answer them, or leave them waiting and time goes on.</p>' + cards.join('') : '<p>Nobody waits for you.</p>') +
      '<div class="acts">' + (cards.length ? button('later', {}, 'Leave them waiting') : button('close', {}, 'Close')) + '</div>';
  }

  // ---- a capo
  // What a capo has learned, rank after rank: a lit mark for what he has, a dim one for what waits. The words are a touch away.
  var SCHOOL = { Muscle: 'muscle', Liquor: 'liquor', Money: 'clean', Law: 'heat', Vice: 'brothel', Games: 'gambling' };
  function skills(k) {
    var a = k.abilities || []; if (!a.length) return '';
    return '<div class="skills">' + a.map(function (s) { return '<span class="skill' + (s.has ? ' on' : '') + '" data-tip="' + esc((s.has ? '' : 'At rank ' + s.rank + ' · ') + s.name + ': ' + s.gives) + '">' + icon(SCHOOL[s.school] || 'ambition') + '</span>'; }).join('') + '</div>';
  }
  // Loyalty reaches the screen as a mood, never as a number.
  var MOOD = { steady: ['loyalty', 'Steady', 'He is with you.'], restless: ['time', 'Restless', 'Something weighs on him: a ruling against him, a place refused. A gesture would settle him.'],
               bitter: ['betrayal', 'Bitter', 'He sends nothing up. Left bitter for six months, he goes over to the rivals with every place he runs.'] };
  function mood(k) {
    var m = MOOD[k.mood]; if (!m) return '';
    return '<div class="move mood ' + k.mood + '" data-tip="' + esc(m[2]) + '">' + icon(m[0]) + '<span><b>' + m[1] + '.</b> ' + (k.mood === 'bitter' ? 'He sends nothing up.' : m[2].split(':')[0].replace(/\.$/, '') + '.') + '</span></div>';
  }
  // ---- the first minutes. A new boss is told what to look at: one thing at a time, when it happens, each only once.
  // hint(view, hud, seen) gives the one to show now, or null; `seen` holds the ids the boss has put away.
  var HINTS = [
    { id: 'capo', icon: 'men', when: function (v, h, c) { return !!c.capos.length; },
      text: function (v, h, c) { return first(c.capos[0].name) + ' runs these streets for you. He decides what to open; you watch, and answer when he asks.'; } },
    { id: 'asks', icon: 'time', when: function (v, h, c) { return h.pending > 0 && (c.asks.length || c.feuds.length); },
      text: function () { return 'A capo waits for your word, and time has stopped. Tap the banner to answer him.'; } },
    { id: 'money', icon: 'tribute', when: function (v, h, c) { return c.capos.some(function (k) { return k.sent > 0; }); },
      text: function () { return 'Money comes up to you: a share of what each place made. The cars on the map carry it.'; } },
    { id: 'wash', icon: 'laundering', when: function (v, h) { return h.dirty > T.RULES.stash; },
      text: function () { return 'Too much dirty cash draws the police. Only clean money pays for gifts and learning: it needs a laundry.'; } },
    { id: 'door', icon: 'hideout', when: function (v, h, c) { return c.doors.length > 0; },
      text: function () { return 'A man knocks at your door. Take him in and he opens a club of his own on a street you choose.'; } }
  ];
  function hint(view, hud, seen) {
    if (!hud || !hud.started) return null;
    var c = view.cities.filter(function (q) { return q.held; })[0] || view.cities[0]; if (!c) return null;
    for (var n = 0; n < HINTS.length; n++) { var t = HINTS[n]; if (!seen[t.id] && t.when(view, hud, c)) return { id: t.id, icon: t.icon, text: t.text(view, hud, c) }; }
    return null;
  }
  function hintStrip(h) { return h ? '<div class="hint">' + icon(h.icon) + '<span>' + esc(h.text) + '</span><button data-hint="' + h.id + '">Got it</button></div>' : ''; }
  // moods(view): the men whose mood must show on their face over the map, by city id + capo id
  function moods(view) {
    var out = {};
    view.cities.forEach(function (c) { (c.capos || []).forEach(function (k) { if (k.mood === 'restless' || k.mood === 'bitter') out[c.id + k.id] = k.mood; }); });
    return out;
  }
  function gift(c, k, hud) {
    var t = k.gift; if (!t) return '';
    var short = !hud || (hud.clean || 0) < t.cost, why = t.wait > 0 ? 'He had one this year: again in ' + t.wait + ' month' + (t.wait > 1 ? 's' : '') : short ? 'It takes ' + money(t.cost) + ' of clean money' : 'A gesture he will remember';
    return '<div class="acts col">' + button('gift', { city: c.id, capo: k.id }, icon('gift') + ' Make him a gift · ' + money(t.cost) + '<small style="color:var(--dim)">' + why + '</small>', { off: t.wait > 0 || short }) + '</div>';
  }
  function capo(view, cityId, id, hud, pw, rows) {
    var c = cityOf(view, cityId), k = c && c.capos.filter(function (q) { return q.id === id; })[0]; if (!k) return null;
    var w = WAY[k.way] || WAY.force;
    var boss = c.under === k.id || k.under === true;
    return head(k.id, k.name, esc(k.specialty) + ' · ' + esc(k.rankName) + ' · ' + (boss ? '<b>Underboss of ' + esc(c.name) + '</b>' : esc(c.name)) + (k.sulks ? ' · <span class="i no" data-tip="He holds a grudge and keeps more of the money for himself">sulking</span>' : '')) +
      healthLine(health(c, k)) + powerLine(pw, rows) + nextRank(k) + mood(k) + follows(k) + intent(k.plan) + skills(k) +
      '<div class="tiles">' + tile('hideout', 'PLACES', k.places + ' / ' + k.reach, 'Places he runs, out of what his rank lets him run') + tile('takings', 'A MONTH', money(k.income), 'What reached his club last month') +
      tile('tribute', 'SENT UP', money(k.sent || 0), 'What he sent up to you last month: your share of what his places made') +
      tile('dirty', 'HIS CASH', money(k.cash), 'What he keeps at his club for his next move') +
      tile('car', 'CARS', (k.cars || 1) + '', 'His cars fetch the takings of his places, one full load of cash at a time') + '</div>' +
      (k.waiting > 0 ? '<div class="move">' + icon('time') + '<span>' + money(k.waiting) + ' waits in his tills for a car</span></div>' : '') +
      (k.at && k.at.label ? '<div class="move" data-tip="Where he is this month. He has a car of his own and goes where he is needed.">' + icon('car') + '<span>' + esc(k.at.label) + '</span></div>' : '') +
      '<div class="move" style="--c:' + w.color + '" data-tip="' + esc(w.tip) + '">' + icon(w.icon) + '<span>His way of taking a place: ' + w.word.toLowerCase() + '</span></div>' +
      (!boss && c.capos.length > 1 ? '<div class="acts col">' + button('underboss', { city: c.id, capo: k.id }, 'Make him underboss of ' + esc(c.name) + '<small style="color:var(--dim)">He takes in the men at the door himself</small>') + '</div>' : '') +
      gift(c, k, hud) +
      '<h3 class="sub2">Part with him</h3>' + ((k.partings || []).length ? '<div class="acts col">' + k.partings.map(function (p) { return button('parting', { city: c.id, capo: k.id, way: p.way }, esc(p.name) + (p.cost ? ' · ' + money(p.cost) : '')); }).join('') + '</div>'
        : '<p>He is your only capo: the family cannot do without him.</p>') +
      '<div class="acts">' + button('show', { city: c.id, x: k.x, y: k.y }, 'Show his club') + button('close', {}, 'Close') + '</div>';
  }
  function parting(view, cityId, id, way) {
    var c = cityOf(view, cityId), k = c && c.capos.filter(function (q) { return q.id === id; })[0], p = k && (k.partings || []).filter(function (q) { return q.way === way; })[0]; if (!p) return null;
    return head(k.id, p.name, esc(k.name)) + '<p>' + esc(p.gives) + '</p>' + (p.cost ? '<div class="move">' + icon('dirty') + '<span>It costs you ' + money(p.cost) + '</span></div>' : '') +
      '<p>This cannot be taken back.</p><div class="acts">' + button('part', { city: c.id, capo: k.id, way: way }, esc(p.name), { cls: 'go bad' }) + button('capo', { city: c.id, capo: k.id }, 'No, keep him') + '</div>';
  }

  // ---- a street block, a city
  function block(view, cityId, x, y) {
    var c = cityOf(view, cityId); if (!c) return null;
    var b = c.blocks[y * c.w + x] || {}, p = c.places.filter(function (q) { return q.x === x && q.y === y; })[0], key = p && p.key && c.keys.filter(function (q) { return q.key === p.key; })[0];
    var ours = p && p.owner === 'family';
    return '<h2>' + esc(zoneOf(c, x, y).name) + '</h2><p>' + esc(c.name) + ' · ' + (GRIP[b.grip] || 'Nobody holds this street yet') + '</p>' +
      (p ? '<div class="intent' + (ours ? '' : ' wish') + '"><span class="gauge">' + I.ring(1, iconName(p.key || p.kind)) + '</span><div><b>' + esc(p.name) + (p.level > 1 ? ' · level ' + p.level : '') + '</b><small>' +
          esc([ours ? (p.capo ? first(nameOf(p.capo)) + ' runs it' : 'Yours') : 'The ' + p.owner + ' family' + (p.man ? ' · ' + nameOf(p.man) : ''), key ? key.gives : ''].filter(Boolean).join(' · ')) + '</small></div></div>'
         : '<p>Nothing of note stands here.</p>') +
      (p && p.till > 0 ? '<div class="move">' + icon('dirty') + '<span>' + money(p.till) + ' in the till, waiting for a car</span></div>' : '') +
      (p ? storeLines(p) + strainLines(p) : '') +
      '<div class="acts">' + (ours && p.capo ? button('capo', { city: c.id, capo: p.capo }, 'See ' + esc(first(nameOf(p.capo)))) : '') + button('city', { city: c.id }, esc(c.name)) + button('close', {}, 'Close') + '</div>';
  }
  // What a place has in store: the cellar of a still, the shelf of a bar, the yard of a chop shop.
  var STORE = { liquor: 'cases of liquor', goods: 'crates', cars: 'stolen cars', weed: 'bags of weed' };
  function store(p) {
    var out = [];
    if (p.stock >= 1) out.push([p.holds === 'liquor' || !p.holds ? 'liquor' : (GOODS[p.holds] || GOODS.goods)[0], Math.floor(p.stock) + ' ' + (STORE[p.holds] || STORE.liquor) + ' in store']);
    if (p.weed >= 1) out.push(['loft', Math.floor(p.weed) + ' bags of weed to sell']);
    return out;
  }
  function storeLines(p, sep) { return store(p).map(function (s) { return sep ? '<br>' + icon(s[0]) + ' ' + s[1] : '<div class="move">' + icon(s[0]) + '<span>' + s[1] + '</span></div>'; }).join(''); }
  // A place of the family that chokes: what the map marks on it, and the words for it.
  var STRAIN = { cash: 'dirty', dry: 'liquor', surplus: 'still', swamped: 'clean' };
  function strains(view) {
    var out = {};
    view.cities.forEach(function (c) { c.places.forEach(function (p) { if (p.strains && p.strains.length) out[c.id + ':' + p.x + ',' + p.y] = p.strains.map(function (s) { return s.kind; }); }); });
    return out;
  }
  function strainBadge(kinds) { return (kinds || []).map(function (k) { return '<i>' + icon(STRAIN[k] || 'attack') + '</i>'; }).join(''); }
  function strainLines(p, sep) { return (p.strains || []).map(function (s) { return sep ? '<br><span class="bad">' + icon(STRAIN[s.kind] || 'attack') + ' ' + esc(s.label) + '</span>' : '<div class="move no">' + icon(STRAIN[s.kind] || 'attack') + '<span>' + esc(s.label) + '</span></div>'; }).join(''); }
  // The same in a few words, for the bubble beside the finger: the place and who runs it, or the street and who holds it.
  function blockTip(view, cityId, x, y) {
    var c = cityOf(view, cityId); if (!c) return null;
    var b = c.blocks[y * c.w + x] || {}, p = c.places.filter(function (q) { return q.x === x && q.y === y; })[0], ours = p && p.owner === 'family';
    if (!p) return '<b>' + esc(zoneOf(c, x, y).name) + '</b><br>' + (GRIP[b.grip] || 'Nobody holds this street yet');
    return '<b>' + icon(iconName(p.key || p.kind)) + ' ' + esc(p.name) + (p.level > 1 ? ' · level ' + p.level : '') + '</b><br>' +
      esc(ours ? (p.capo ? first(nameOf(p.capo)) + ' runs it' : 'Yours') : 'The ' + p.owner + ' family') + (p.till > 0 ? '<br>' + icon('dirty') + ' ' + money(p.till) + ' in the till' : '') + storeLines(p, true) + strainLines(p, true);
  }
  function shares(s) {
    var part = function (k, color) { return s[k] > 0 ? '<i style="flex:' + s[k].toFixed(1) + ';background:' + color + '" data-tip="' + { family: 'Yours', rival: 'The rivals', contested: 'Fought over', free: 'Held by nobody' }[k] + ': ' + Math.round(s[k]) + '%"></i>' : ''; };
    return '<div class="shares">' + part('family', 'var(--accent)') + part('contested', '#ff5a3a') + part('rival', '#6b6f86') + part('free', '#ffffff1f') + '</div>';
  }
  function faces(c, list, act) {
    return '<div class="tier"><div>' + list.map(function (m) { return act ? '<button class="slot' + (c.under === m.id ? ' under' : '') + (m.mood === 'restless' || m.mood === 'bitter' ? ' ' + m.mood : '') + '" data-act="capo"' + data({ city: c.id, capo: m.id }) + ' data-tip="' + esc(m.name + (c.under === m.id ? ', underboss' : '') + (m.mood === 'restless' || m.mood === 'bitter' ? ', ' + m.mood : '')) + '">' + I.portrait(m.id) + '</button>'
      : '<span class="slot wait" data-tip="' + esc(m.name + ', ' + m.specialty + ': ' + m.places + ' places') + '">' + I.portrait(m.id) + '</span>'; }).join('') + '</div></div>';
  }
  // The share the boss takes of what a city makes: three sizes, the one in force marked. A light hand is loved, a heavy one is not.
  function cut(c) {
    if (!c || !c.held || !c.cuts || !c.cuts.length) return '';
    return '<h3 class="sub2">Your share</h3><div class="acts cuts">' + c.cuts.map(function (k) { var on = k.id === c.cut;
      return button('cut', { city: c.id, cut: k.id }, esc(k.id) + ' · ' + Math.round(k.share * 100) + '%' + (k.loyal ? '<small class="' + (k.loyal > 0 ? 'up' : 'down') + '">loyalty ' + (k.loyal > 0 ? '+' : '\u2212') + Math.abs(k.loyal) + '</small>' : ''), { cls: on ? 'on' : '', off: on }); }).join('') + '</div>';
  }
  // What clean money buys for good: each holding has three sizes; the button says the price, or why it cannot be paid.
  function holdings(view, hud) {
    var list = view.holdings; if (!list || !list.length) return '';
    return '<h3 class="sub2">What clean money buys</h3><ul class="list">' + list.map(function (h) { var n = h.next, short = n && (!hud || (hud.clean || 0) < n.cost);
      return '<li class="ev hold"><div><b>' + esc(h.name) + '</b> · ' + h.level + ' / ' + h.most + '<small>' + esc(h.gives) + '</small></div>' +
        (n ? button('buy', { holding: h.id }, money(n.cost) + (short ? '<small>It takes ' + money(n.cost) + ' of clean money</small>' : ''), { off: short }) : '') + '</li>'; }).join('') + '</ul>';
  }
  // The rival of the city has a face: who he is, how much of the town is his, what he last did, and whether he is out for blood.
  function chief(c) {
    var h = c && c.chief; if (!h) return '';
    return '<h3 class="sub2">The ' + esc(h.family || c.rival || 'rival') + ' family</h3><div class="chief"><span class="slot">' + I.portrait(h.id) + '</span><div><b>' + esc(h.name) + '</b><small>Head of the ' + esc(h.family || c.rival || 'rival') + ' family · ' + Math.round(h.strength || 0) + '% of the streets</small>' +
      '<span class="bar"><i style="width:' + Math.round(h.strength || 0) + '%"></i></span></div></div>' +
      (h.vendetta > 0 ? '<div class="move no">' + icon('attack') + '<span><b>Vendetta: ' + months(h.vendetta) + '.</b> You took one of his places by force: his men hit twice as hard</span></div>' : '') +
      (h.last && h.last.label ? '<div class="acts col">' + button('show', { city: c.id, x: h.last.x, y: h.last.y }, icon(EVENT[h.last.type] || 'time') + ' ' + esc(h.last.label) + '<small style="color:var(--dim)">His last move. Touch to see where</small>') + '</div>' : '');
  }
  // What the capos promised when the boss said yes, until the day it is judged.
  function promises(c) {
    var list = c && c.promises; if (!list || !list.length) return '';
    return '<h3 class="sub2">Promises</h3>' + list.map(function (p) { return '<div class="move">' + icon('time') + '<span><b>' + esc(first(nameOf(p.capo))) + '</b> · +' + money(p.expected) + ' a month from the ' + esc(p.name) + '<small style="display:block;color:var(--dim)">judged in ' + months(p.months) + '</small></span></div>'; }).join('');
  }
  // The line the boss gives a city: grow, earn or lie low. His capos lean that way, each according to his temper and his loyalty.
  function line(c) {
    if (!c || !c.held || !c.lines || !c.lines.length) return '';
    return '<h3 class="sub2">Your line for the city</h3><div class="acts col lines">' + c.lines.map(function (l) { var on = l.id === c.line;
      return button('line', { city: c.id, line: on ? '' : l.id }, '<b>' + esc(l.name) + '</b><small style="color:var(--dim)">' + esc(l.gives) + '</small>', { cls: on ? 'on' : '' }); }).join('') + '</div>' +
      (c.lineHeld ? '<div class="move">' + icon('loyalty') + '<span>' + esc(c.lineHeld.label) + '</span><span class="bar"><i style="width:' + Math.round((c.lineHeld.share || 0) * 100) + '%"></i></span></div>' : '');
  }
  function follows(k) {
    if (k.follows !== true && k.follows !== false) return '';
    return '<div class="move ' + (k.follows ? 'yes' : 'no') + '">' + icon(k.follows ? 'yes' : 'no') + '<span><b>' + (k.follows ? 'Follows your line.' : 'Does not follow your line.') + '</b> ' + esc(k.followsWhy || '') + '</span></div>';
  }
  function city(view, id) {
    var c = cityOf(view, id); if (!c) return null;
    var s = c.share;
    return '<h2>' + esc(c.name) + '</h2><p>' + (c.held ? 'You hold ' + Math.round(s.family) + '% of its streets' : 'No man of yours here yet') + ' · the ' + esc(c.rival) + ' family holds ' + Math.round(s.rival) + '%</p>' + shares(s) +
      '<div class="tiles">' + tile('men', 'SEATS', c.seats.taken + ' / ' + c.seats.total, 'Capos you have here, out of those the city can carry. Each key place you hold adds a seat') +
      tile('heat', 'HEAT', Math.round(c.heat || 0), 'How closely the police watch this city') + tile('clean', 'WASHED', money(c.money ? c.money.washed : 0), 'Dirty cash washed here last month') + '</div>' +
      curves(view, c.id) + stallsOf(c) + line(c) + cut(c) +
      (c.capos.length ? '<h3 class="sub2">Your capos</h3>' + faces(c, c.capos, true) : '') +
      '<h3 class="sub2">Key places</h3><ul class="list">' + c.keys.map(function (k) { var ours = k.owner === 'family';
        return '<li class="ev"><span class="' + (ours ? 'i yes' : 'i') + '">' + icon(k.key) + '</span><div><b>' + esc(k.name) + '</b> · ' + (ours ? 'yours' + (k.capo ? ', ' + esc(first(nameOf(k.capo))) : '') : esc(k.owner)) + '<small>' + esc(k.gives) + '</small></div></li>'; }).join('') + '</ul>' +
      promises(c) + chief(c) + (c.lieutenants && c.lieutenants.length ? (c.chief ? '' : '<h3 class="sub2">The ' + esc(c.rival) + ' family</h3>') + faces(c, c.lieutenants, false) : '') +
      '<div class="acts">' + button('focus', { city: c.id }, 'Go there') + button('close', {}, 'Close') + '</div>';
  }

  // ---- the family: every capo, and the trades it knows
  function knowBtn(t, on) {
    var tiers = 3, lv = '<span class="lv">'; for (var i = 1; i <= tiers; i++) lv += '<i' + (i <= t.tier ? ' class="on"' : '') + '></i>'; lv += '</span>';
    return '<button class="know' + (t.tier ? '' : ' shut') + (on ? ' sel' : '') + '" data-know="' + esc(t.kind) + '">' + (t.studying ? '<span class="gauge">' + I.ring(t.next ? 1 - t.studying / t.next.months : 1, I.has(t.kind) ? t.kind : 'unknown') + '</span>' : icon(t.kind)) + lv +
      (t.wanted && t.wanted.length ? '<span class="want">' + I.portrait(t.wanted[0]) + '</span>' : '') + '</button>';
  }
  function know(view, kind, hud) {
    var t = view.tree.filter(function (q) { return q.kind === kind; })[0]; if (!t) return '';
    var busy = view.tree.filter(function (q) { return q.studying; })[0], wanted = (t.wanted || []).map(function (id) { return first(nameOf(id)); });
    var html = '<b>' + esc(t.name) + (t.tier ? ' · tier ' + t.tier : ' · not known yet') + '</b>' + (wanted.length ? '<small>Asked for by ' + esc(wanted.join(', ')) + '</small>' : '') +
      (t.gives ? '<p class="gives">' + esc(t.gives) + '</p>' : '') +
      (t.next && t.next.gives ? '<div class="move next">' + I.icon('yes') + '<span><b>' + (t.tier ? 'Tier ' + t.next.tier + ' brings' : 'Learning it brings') + '</b> ' + esc(t.next.gives) + '</span></div>' : '');
    if (t.studying) return html + '<div class="move">' + I.icon('time') + '<span>Learning: ' + months(t.studying) + ' left</span></div>';
    if (!t.next) return html + '<div class="move yes">' + I.icon('yes') + '<span>Nothing more to learn</span></div>';
    var what = (t.tier ? 'Tier ' + t.next.tier : 'Learn it') + ' · ' + money(t.next.cost) + ' clean · ready in ' + months(t.next.months);
    if (busy) return html + '<div class="move">' + I.icon('time') + '<span>' + what + '. One thing at a time: the family is learning ' + esc(busy.name.toLowerCase()) + '</span></div>';
    var short = t.next.cost > (hud.clean || 0);
    return html + (short ? '<small class="short">Short by ' + money(t.next.cost - (hud.clean || 0)) + ' of clean money</small>' : '') + button('research', { building: t.kind }, what, { cls: 'go', off: short });
  }
  // ---- is the family getting anywhere?
  // What the family holds of the whole map, month after month, and what its cities send up: read in the history the rules keep.
  var mapShare = function (m) { var s = 0, n = 0; for (var k in m.cities || {}) { s += m.cities[k].share || 0; n++; } return n ? s / n : 0; };
  var sentUp = function (m) { var s = 0; for (var k in m.cities || {}) s += m.cities[k].income || 0; return s; };
  var round1 = function (x) { return Math.round(x * 10) / 10; }, signed = function (x, show) { return (x < 0 ? '−' : '+') + show(Math.abs(x)); };
  // trend(view): the verdict over the last year (or since the start, if the game is younger). null in the first months.
  function trend(view) {
    var h = view.history || []; if (h.length < 3) return null;
    var now = h[h.length - 1], was = h[Math.max(0, h.length - 13)], months = Math.min(12, h.length - 1), over = months === 12 ? 'in a year' : 'in ' + months + ' months';
    var o = { months: months, streets: { now: round1(mapShare(now)), diff: round1(mapShare(now) - mapShare(was)) }, sent: { now: Math.round(sentUp(now)), diff: Math.round(sentUp(now) - sentUp(was)) } };
    var big = Math.max(20, 0.1 * sentUp(was));
    if (o.streets.diff >= 0.2) { o.tone = 'good'; o.word = 'GROWING'; o.say = signed(o.streets.diff, String) + '% of the streets ' + over; }
    else if (o.streets.diff <= -0.2) { o.tone = 'bad'; o.word = 'LOSING GROUND'; o.say = signed(o.streets.diff, String) + '% of the streets ' + over; }
    else if (o.sent.diff >= big) { o.tone = 'good'; o.word = 'EARNING MORE'; o.say = signed(o.sent.diff, money) + ' a month sent up, ' + over; }
    else if (o.sent.diff <= -big) { o.tone = 'bad'; o.word = 'EARNING LESS'; o.say = signed(o.sent.diff, money) + ' a month sent up, ' + over; }
    else { o.tone = 'warn'; o.word = 'STANDING STILL'; o.say = 'No street won ' + over; }
    return o;
  }
  var ARROW = { good: '▲', bad: '▼', warn: '■' };
  function trendLine(t) { return t ? '<span class="trend ' + t.tone + '">' + ARROW[t.tone] + ' ' + t.word + '</span> ' + esc(t.say) : 'Your capos are at work'; }
  // beside the streets: how many points of the map were won or lost
  function trendMark(t) { return t && t.streets.diff ? '<span class="' + (t.streets.diff > 0 ? 'good' : 'bad') + '">' + ARROW[t.streets.diff > 0 ? 'good' : 'bad'] + ' ' + signed(t.streets.diff, String) + '</span>' : ''; }
  // The rank of the family: what it holds of the whole map. rank(view) -> { n, name, next, from, to, at, part: how far towards the next
  // rank, was: where it stood a year ago on the same bar, moved: 'up' | 'down' | null if its rank changed since }.
  var FAMILYRANKS = [['Street gang', 0], ['Crew', 3], ['Family', 10], ['Syndicate', 25], ['Commission', 50]];
  function rankOf(share) { var n = 0; FAMILYRANKS.forEach(function (r, i) { if (share >= r[1]) n = i; }); return n; }
  function rank(view) {
    var h = view.history || [], at = h.length ? mapShare(h[h.length - 1]) : 0, old = h.length ? mapShare(h[Math.max(0, h.length - 13)]) : 0, n = rankOf(at), m = rankOf(old), nx = FAMILYRANKS[n + 1];
    var from = FAMILYRANKS[n][1], to = nx ? nx[1] : null, on = function (x) { return to == null ? 1 : Math.max(0, Math.min(1, (x - from) / (to - from))); };
    return { n: n, name: FAMILYRANKS[n][0], next: nx ? nx[0] : null, from: from, to: to, at: round1(at), part: on(at), was: on(old), moved: n > m ? 'up' : n < m ? 'down' : null };
  }
  function rankLine(r) {
    var pc = function (x) { return Math.round(x * 100) + '%'; };
    return '<span class="rk' + (r.moved ? ' ' + r.moved : '') + '" data-tip="' + esc('The rank of your family: the share of the whole map it holds (' + r.at + '%). The mark on the bar is where you stood a year ago.') + '"><b>' + (r.moved === 'up' ? '▲ ' : r.moved === 'down' ? '▼ ' : '') + esc(r.name) + '</b>' +
      (r.next ? '<span class="bar"><i style="width:' + pc(r.part) + '"></i><u class="was" style="left:' + pc(r.was) + '"></u></span><small>' + esc(r.next) + ' at ' + r.to + '%</small>' : '') + '</span>';
  }
  // What a capo is doing and whether it works, in one word: doing(city, capo) -> { word, tone: 'good' | 'idle' | 'warn' | 'bad', earns }.
  function doing(c, k, pw) {
    var h = health(c, k), p = k.plan || {}, o = { word: 'HOLDING', tone: 'idle', earns: money(Math.round(k.income || 0)) };
    if (pw) o.power = pw;
    var set = function (word, tone) { o.word = word; o.tone = tone; return o; };
    if (h.men === 'bad') return set('BITTER', 'bad');
    if (h.threat === 'bad') return set('VENDETTA', 'bad');
    if (h.money === 'bad') return set('EARNS NOTHING', 'bad');
    if (k.at && k.at.why === 'raid') return set('UNDER ATTACK', 'warn');
    if (p.waiting === 'money') return set('SAVING ' + Math.round((p.cost ? (p.saved || 0) / p.cost : p.progress || 0) * 100) + '%', (k.income || 0) > 0 ? 'good' : 'bad');
    if (p.move === 'take') return set('TAKING', 'good');
    if (p.move === 'open') return set('OPENING', 'good');
    if (p.move === 'enlarge') return set('ENLARGING', 'good');
    if (!k.places && !(k.income > 0)) return set('SETTLING IN', 'idle');
    return o;
  }
  // The power of a capo, one figure: ten a place he runs, one for every ten dollars his streets bring in a month.
  function power(k) { return (k.places || 0) * 10 + Math.round((k.income || 0) / 10); }
  // The page remembers it month by month (the rules keep no history of each man): powerLog(log, view) -> the log with this month
  // written, a year deep. A month earlier than the last one written is a new game: the memory starts again.
  function powerLog(log, view) {
    var out = {}, same = true;
    view.cities.forEach(function (c) { (c.capos || []).forEach(function (k) {
      var key = c.id + k.id, was = (log[key] || []).filter(function (r) { return r[0] <= view.month; }), last = was[was.length - 1];
      if ((log[key] || []).length !== was.length) was = [];
      if (!last || last[0] !== view.month || !was.length) { was = was.concat([[view.month, power(k)]]).slice(-13); same = false; }
      out[key] = was;
    }); });
    return same && Object.keys(out).length === Object.keys(log).length ? log : out;
  }
  function powerTrend(log, key) {
    var rows = log[key]; if (!rows || !rows.length) return null;
    var now = rows[rows.length - 1][1], diff = now - rows[0][1];
    return { now: now, diff: diff, tone: rows.length < 2 ? 'idle' : diff > 0 ? 'good' : diff < 0 ? 'bad' : 'idle', months: rows.length - 1 };
  }
  function powerLine(t, rows) {
    if (!t) return '';
    var over = t.months >= 12 ? 'in a year' : 'in ' + t.months + ' month' + (t.months === 1 ? '' : 's');
    return '<div class="move power ' + t.tone + '" data-tip="His power: ten a place he runs, one for every ten dollars his streets bring in a month.">' + icon('muscle') + '<span><b>POWER ' + t.now + '</b> ' +
      (t.months ? (t.diff ? ARROW[t.tone] + ' ' + signed(t.diff, String) + ' ' + over : 'unchanged ' + over) : '') + '</span>' +
      (rows && rows.length > 2 ? I.spark(rows.map(function (r) { return r[1]; }), { min: 0 }) : '') + '</div>';
  }
  // ---- the same reading at every level
  // A city: what the family holds of it, and the points won or lost in a year.
  var yearAgo = function (h) { return h[Math.max(0, h.length - 13)]; };
  function cityTrend(view, cityId) {
    var h = view.history || []; if (h.length < 2) return null;
    var of = function (m) { return ((m.cities || {})[cityId] || {}).share || 0; }, now = round1(of(h[h.length - 1])), diff = round1(now - of(yearAgo(h)));
    return { now: now, diff: diff, tone: diff >= 0.5 ? 'good' : diff <= -0.5 ? 'bad' : 'idle' };
  }
  function cityMark(t) { return t && t.tone !== 'idle' ? ' ' + ARROW[t.tone] + ' ' + signed(t.diff, String) : ''; }
  // A street name: the share of its blocks the family holds, and its arrow when the rules keep the history of it.
  function zoneShares(view) {
    var out = {}, h = view.history || [], was = h.length > 1 ? yearAgo(h) : null;
    view.cities.forEach(function (c) {
      var all = [], ours = [];
      (c.blocks || []).forEach(function (b) { if (b.void || typeof b.zone !== 'number') return; all[b.zone] = (all[b.zone] || 0) + 1; if (b.grip === 'family') ours[b.zone] = (ours[b.zone] || 0) + 1; });
      var old = was && ((was.cities || {})[c.id] || {}).zones;
      (c.zones || []).forEach(function (z, n) {
        if (!all[n]) return;
        var share = Math.round(100 * (ours[n] || 0) / all[n]), diff = old && typeof old[n] === 'number' ? share - old[n] : null;
        out[c.id + '-' + n] = { name: z.name, share: share, diff: diff, tone: diff == null ? 'idle' : diff >= 5 ? 'good' : diff <= -5 ? 'bad' : 'idle' };
      });
    });
    return out;
  }
  function zoneMark(z) { return z && z.share > 0 ? z.share + '%' + (z.tone !== 'idle' ? ' ' + ARROW[z.tone] : '') : ''; }
  // The power of every man, month by month: read in the history of the rules when its rows name the men, else in the page's own memory.
  function powerRows(view, log) {
    var h = (view.history || []).slice(-13), out = {}, found = false;
    h.forEach(function (m) { for (var id in m.cities || {}) { var men = m.cities[id].capos; if (!men) continue; found = true;
      for (var k in men) (out[id + k] = out[id + k] || []).push([m.month, power(men[k])]); } });
    if (!found) return log || {};
    // the month in hand is not in the history yet: the man as he stands closes his line
    (view.cities || []).forEach(function (c) { (c.capos || []).forEach(function (k) { var r = out[c.id + k.id] = out[c.id + k.id] || [], last = r[r.length - 1];
      if (!last || last[0] < view.month) r.push([view.month, power(k)]); out[c.id + k.id] = r.slice(-13); }); });
    return out;
  }
  // The men side by side, the strongest first: who rises, who falls.
  function ranking(view, rows) {
    var men = [];
    view.cities.forEach(function (c) { (c.capos || []).forEach(function (k) { men.push({ c: c, k: k, t: powerTrend(rows, c.id + k.id) || { now: power(k), diff: 0, tone: 'idle', months: 0 } }); }); });
    if (men.length < 2) return '';
    men.sort(function (a, b) { return b.t.now - a.t.now; });
    return '<h3 class="sub2">Who weighs what</h3><div class="ranks">' + men.map(function (m, n) {
      return '<button class="rankrow ' + m.t.tone + '" data-act="capo"' + data({ city: m.c.id, capo: m.k.id }) + '><i>' + (n + 1) + '</i><span class="pf">' + I.portrait(m.k.id) + '</span><span>' + esc(first(m.k.name || nameOf(m.k.id))) + '</span><b>' + m.t.now + '</b><em>' +
        (m.t.diff ? ARROW[m.t.tone] + ' ' + signed(m.t.diff, String) : '') + '</em></button>'; }).join('') + '</div>';
  }
  // A step won or lost is a moment. moments(before, after): each is { rank: rank(view), zones: zoneShares(view) }; nothing on the first look.
  var A = function (name) { return (/^[aeiou]/i.test(name) ? 'AN ' : 'A ') + name.toUpperCase(); };
  function moments(before, after) {
    var out = [];
    if (!before) return out;
    if (after.rank.n > before.rank.n) out.push({ kind: 'rank-up', tone: 'good', title: 'YOUR FAMILY IS NOW ' + A(after.rank.name), sub: 'It holds enough of the map to be counted.' });
    else if (after.rank.n < before.rank.n) out.push({ kind: 'rank-down', tone: 'bad', title: 'YOUR FAMILY FALLS BACK TO ' + A(after.rank.name), sub: 'It has lost too many streets.' });
    for (var id in after.zones) {
      var was = before.zones[id], now = after.zones[id]; if (!was) continue;
      if (now.share >= 100 && was.share < 100) out.push({ kind: 'zone-won', tone: 'good', title: now.name.toUpperCase() + ' IS YOURS', sub: 'Every street of it answers to the family.' });
      else if (was.share >= 100 && now.share < 100) out.push({ kind: 'zone-broken', tone: 'bad', title: now.name.toUpperCase() + ' IS NO LONGER ALL YOURS', sub: 'A street of it has slipped away.' });
      else if (was.share > 0 && now.share <= 0) out.push({ kind: 'zone-lost', tone: 'bad', title: 'DRIVEN OUT OF ' + now.name.toUpperCase(), sub: 'The family holds nothing there any more.' });
    }
    return out;
  }
  function moment(m) { return '<div class="moment ' + m.tone + '"><b>' + esc(m.title) + '</b><span>' + esc(m.sub) + '</span></div>'; }
  // How far a man is from his next rank (the rules count what he has learnt by doing): a bar, like the family's own.
  function nextRank(k) {
    var n = k.next; if (!n || !n.of) return '';
    return '<div class="move next" data-tip="What he learns by running his places takes him to his next rank.">' + icon('muscle') + '<span class="rk"><b>' + esc(n.name) + '</b><span class="bar"><i style="width:' + Math.round(100 * Math.min(1, n.xp / n.of)) + '%"></i></span><small>' + Math.round(n.xp) + ' / ' + n.of + '</small></span></div>';
  }
  // What holds the family back, as the rules tell it (view.stalls, cities[].stalls): what, since when, why, and the lever the boss has.
  var span = function (months) { var y = Math.floor(months / 12); return y >= 1 ? 'for ' + y + ' year' + (y > 1 ? 's' : '') : 'for ' + months + ' month' + (months === 1 ? '' : 's'); };
  function stall(q, cityId) {
    var city = q.city || cityId, go = city && typeof q.x === 'number' ? button('show', { city: city, x: q.x, y: q.y }, 'Show') : city && q.capo ? button('capo', { city: city, capo: q.capo }, 'See him') : '';
    return '<div class="stall"><b>' + esc(q.what) + '</b><small>' + span(q.since || 0) + '</small><p>' + esc(q.why || '') + '</p>' +
      (q.lever ? '<p class="lever">' + icon('time') + esc(q.lever) + '</p>' : '<p class="nolever">Nothing you can do about it yet.</p>') + go + '</div>';
  }
  function stallLine(view) {
    var l = view.stalls || []; if (!l.length) return '';
    return '<div class="stallline" data-stalls="1">' + icon('time') + '<span>' + esc(l[0].what) + '</span>' + (l.length > 1 ? '<i>+' + (l.length - 1) + '</i>' : '') + '<i class="more">\u203a</i></div>';
  }
  function stallsCard(view) {
    return '<h2>What holds you back</h2><p>The worst first. Each says why, and what you can do about it.</p>' + (view.stalls || []).map(function (q) { return stall(q); }).join('') + '<div class="acts">' + button('close', {}, 'Close') + '</div>';
  }
  function stallsOf(c) { var l = c.stalls || []; return l.length ? '<h3 class="sub2">What holds this city back</h3>' + l.map(function (q) { return stall(q, c.id); }).join('') : ''; }
  // The month's account. Dirty cash and clean money are told the same way: what came in, what went out, line by line.
  function account(view, hud) {
    var m = { up: 0, pay: 0, washed: 0, washes: 0, cut: 0, seized: 0 }, ch = hud.change || {};
    view.cities.forEach(function (c) { for (var k in m) m[k] += (c.money || {})[k] || 0; });
    var back = Math.round(m.washed - m.cut), line = function (key, label, amount) { return { key: key, label: label, amount: Math.round(amount) }; };
    var dirty = [line('up', 'Sent up by your capos', m.up), line('pay', 'Wages of your capos', -m.pay), line('wash', 'Sent to the laundries', -m.washed), line('seized', 'Seized by the police', -m.seized)];
    var known = dirty.reduce(function (s, l) { return s + l.amount; }, 0), rest = Math.round((ch.dirty || 0) - known);
    dirty.push(line('other', rest < 0 ? 'Paid out: clubs, key places, cars' : 'Other takings', rest));
    var clean = [line('back', 'Back from the laundries', back)], rest2 = Math.round((ch.clean || 0) - back);
    clean.push(line('other', rest2 < 0 ? 'Spent: what the family learns, gifts, purchases' : 'Other income', rest2));
    var some = function (l) { return l.amount !== 0; }, sum = function (list, sign) { return list.reduce(function (s, l) { return s + (l.amount * sign > 0 ? Math.abs(l.amount) : 0); }, 0); };
    var o = { dirty: dirty.filter(some), clean: clean.filter(some), dirtyNet: Math.round(ch.dirty || 0), cleanNet: Math.round(ch.clean || 0), cut: Math.round(m.cut) };
    o.dirtyIn = sum(o.dirty, 1); o.dirtyOut = sum(o.dirty, -1); o.cleanIn = sum(o.clean, 1); o.cleanOut = sum(o.clean, -1);
    var io = function (i, out) { return '+' + money(i) + ' \u2212' + money(out); };      // (short: it has to fit under the figure on a phone)
    o.dirtyLine = io(o.dirtyIn, o.dirtyOut); o.cleanLine = m.washes > 0 || o.clean.length ? io(o.cleanIn, o.cleanOut) : 'no laundry yet';
    o.room = m.washes > 0 ? 'Your laundries can wash ' + money(Math.round(m.washes)) + ' a month' + (m.washed < m.washes - 1 ? ': only ' + money(Math.round(m.washed)) + ' of dirty cash was there to wash' : ', and they are full') + '.'
      : 'No laundry yet: dirty cash stays dirty until a capo opens one.';
    return o;
  }
  function accountCard(view, hud) {
    var a = account(view, hud), row = function (l) { return '<div class="row ' + (l.amount < 0 ? 'out' : 'in') + '"><span>' + esc(l.label) + '</span><b>' + signed(l.amount, money) + '</b></div>'; };
    var part = function (ic, title, have, lines, net) { return '<h3 class="sub2">' + icon(ic) + title + ' · ' + money(have) + '</h3><div class="ledger">' + (lines.length ? lines.map(row).join('') : '<div class="row"><span>Nothing moved</span><b></b></div>') +
      '<div class="row net"><span>This month</span><b>' + (net ? signed(net, money) : money(0)) + '</b></div></div>'; };
    return '<h2>Where the money goes</h2><p>Last month, line by line.</p>' + part('dirty', 'DIRTY CASH', hud.dirty || 0, a.dirty, a.dirtyNet) + part('clean', 'CLEAN MONEY', hud.clean || 0, a.clean, a.cleanNet) +
      '<p>' + esc(a.room) + (a.cut > 0 ? ' They kept ' + money(a.cut) + ' as their cut.' : '') + '</p>' + curves(view) + '<div class="acts">' + button('close', {}, 'Close') + '</div>';
  }
  // ---- curves: the last months, so that the boss sees whether a decision paid. One small curve a figure, its last value beside its name.
  // curves(view) is the family (dirty, clean, what the cities sent up); curves(view, cityId) is one city (streets held, what it sent up).
  function curve(ic, label, values, show, tip, opt) {
    return '<div class="tile curve" data-tip="' + esc(tip) + '"><small>' + icon(ic) + label + '</small><b>' + show(values[values.length - 1]) + '</b>' + I.spark(values, opt) + '</div>';
  }
  function curves(view, cityId) {
    var h = view.history || []; if (h.length < 2) return '';
    var since = 'over the last ' + h.length + ' months', pct = function (x) { return (Math.round(x * 10) / 10) + '%'; };
    if (cityId) {
      var of = function (k) { return h.map(function (m) { return ((m.cities || {})[cityId] || {})[k] || 0; }); }, share = of('share'), income = of('income');
      if (!share.some(function (x) { return x > 0; })) return '';
      return '<div class="tiles two">' + curve('streets', 'STREETS', share, pct, 'Share of the streets of this city your family holds, ' + since, { min: 0 }) +
        curve('tribute', 'SENT UP', income, money, 'What this city sent up to you each month, ' + since, { min: 0 }) + '</div>';
    }
    var sent = h.map(function (m) { var s = 0; for (var k in m.cities || {}) s += m.cities[k].income || 0; return s; });
    return '<div class="tiles">' + curve('dirty', 'DIRTY', h.map(function (m) { return m.dirty; }), money, 'Dirty cash at the end of each month, ' + since, { min: 0 }) +
      curve('clean', 'CLEAN', h.map(function (m) { return m.clean; }), money, 'Clean money at the end of each month, ' + since, { min: 0 }) +
      curve('tribute', 'SENT UP', sent, money, 'What all your cities sent up each month, ' + since, { min: 0 }) + '</div>';
  }
  function family(view, hud, rows) {
    var men = '';
    view.cities.forEach(function (c) { if (c.capos.length) men += '<div class="tier"><small>' + esc(c.name) + ' · ' + c.seats.taken + ' / ' + c.seats.total + ' seats</small><div>' +
      c.capos.map(function (m) { return '<button class="slot" data-act="capo"' + data({ city: c.id, capo: m.id }) + ' data-tip="' + esc(m.name + ', ' + m.rankName) + '">' + I.portrait(m.id) + '</button>'; }).join('') + '</div></div>'; });
    var pick = view.tree.filter(function (t) { return t.studying; })[0] || view.tree.filter(function (t) { return t.wanted && t.wanted.length && t.next; })[0] || view.tree[0];
    return '<h2>The family</h2><p>' + (hud.men || 0) + (hud.men === 1 ? ' capo' : ' capos') + ' · ' + (hud.cities ? hud.cities.held + ' of ' + hud.cities.total + ' cities' : '') + '</p>' + curves(view) + (rows ? ranking(view, rows) : '') + '<div class="pyr">' + men + '</div>' + table(view) + holdings(view, hud) +
      '<h3 class="sub2">What the family knows</h3><p>Paid in clean money. A face marks what a capo is asking for.</p><div class="tree">' + view.tree.map(function (t) { return knowBtn(t, pick && t.kind === pick.kind); }).join('') + '</div>' +
      '<div id="know">' + (pick ? know(view, pick.kind, hud) : '') + '</div><div class="acts">' + button('close', {}, 'Close') + '</div>';
  }

  // ---- labels over the map that would sit on one another
  // crowded(boxes): each box is { id, rank, x, y, w, h } with x, y its top left corner on the screen. The lower the rank,
  // the more it matters. Returns the ids to hide: a box gives way to any more important one it touches.
  // was (optional): the ids hidden at the last image. With it a label at the edge of another does not blink while the
  // camera moves: one that was shown leaves only when covered by more than SLACK pixels, one that was hidden comes back
  // only when it clears the others by SLACK pixels.
  var SLACK = 6;
  function crowded(boxes, was) {
    var kept = [], hidden = {};
    boxes.slice().sort(function (a, b) { return a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }).forEach(function (b) {
      var m = !was ? 0 : was[b.id] ? SLACK : -SLACK;
      for (var i = 0; i < kept.length; i++) { var k = kept[i]; if (b.x < k.x + k.w + m && k.x < b.x + b.w + m && b.y < k.y + k.h + m && k.y < b.y + b.h + m) { hidden[b.id] = true; return; } }
      kept.push(b);
    });
    return hidden;
  }

  // ---- the journal, newest first
  function journal(lines) {
    var last = lines.slice(-60).reverse();
    return '<h2>Journal</h2>' + (last.length ? '<ul class="list">' + last.map(function (e) {
      return '<li class="ev"><span class="i' + (bad(e) ? ' no' : e.type === 'outcome' && e.good === true ? ' ok' : '') + '">' + icon(e.type === 'outcome' && e.good === false ? 'no' : EVENT[e.type] || 'time') + '</span><div>' + esc(e.label || e.type) + '<small>' + esc(e.date || '') + '</small></div></li>'; }).join('') + '</ul>' : '<p>Nothing yet.</p>') +
      '<div class="acts">' + button('decisions', {}, 'Your decisions') + button('new', {}, 'New game') + button('close', {}, 'Close') + '</div>';
  }
  // What became of the boss's decisions (view.decisions, kept by the rules): each one, and a year on what it gave.
  function decisions(view) {
    var l = view.decisions || [];
    return '<h2>Your decisions</h2><p>What you decided, and what it gave a year on.</p>' + (l.length ? '<ul class="list">' + l.map(function (d) {
      var r = d.result, left = Math.max(1, (d.due || 0) - (view.month || 0));
      var then = r ? '<span class="then ' + (r.good === true ? 'good' : r.good === false ? 'bad' : 'idle') + '">' + esc(r.label) + '</span>' : '<span class="then wait">Its result in ' + left + ' month' + (left === 1 ? '' : 's') + '</span>';
      return '<li class="ev"><span class="i' + (r && r.good === false ? ' no' : r && r.good === true ? ' ok' : '') + '">' + icon(EVENT[d.type] || 'time') + '</span><div>' + esc(d.label) + '<small>' + esc(d.date || '') + '</small>' + then + '</div></li>'; }).join('') + '</ul>' : '<p>Nothing decided yet.</p>') +
      '<div class="acts">' + button('close', {}, 'Close') + '</div>';
  }

  // A sheet that cannot be drawn must never freeze the game: it says so, and its only button lets time go on.
  function safe(fn) {
    return function () {
      try { return fn.apply(null, arguments); }
      catch (e) { if (typeof console !== 'undefined') console.error(e);
        return '<h2>This page could not be drawn</h2><p>The game goes on. ' + esc(String(e && e.message || e).slice(0, 160)) + '</p><div class="acts">' + button('later', {}, 'Go on') + '</div>'; }
    };
  }
  var api = { bad: bad, decisions: decisions, stall: stall, stallLine: stallLine, stallsCard: stallsCard, stallsOf: stallsOf, nextRank: nextRank, cityTrend: cityTrend, cityMark: cityMark, zoneShares: zoneShares, zoneMark: zoneMark, powerRows: powerRows, ranking: ranking, moments: moments, moment: moment, power: power, powerLog: powerLog, powerTrend: powerTrend, powerLine: powerLine, trend: trend, trendLine: trendLine, trendMark: trendMark, rank: rank, rankLine: rankLine, doing: doing, account: account, accountCard: accountCard, line: line, follows: follows, scars: scars, chief: chief, promises: promises, health: health, healths: healths, healthLine: healthLine, pop: pop, cut: cut, holdings: holdings, esc: esc, money: money, first: first, nameOf: nameOf, funds: funds, WAY: WAY, HAUL: HAUL, EVENT: EVENT, BAD: BAD, untold: untold, curves: curves, hint: hint, hintStrip: hintStrip, moods: moods,
           start: start, man: man, requests: requests, chairs: chairs, chair: chair, capo: capo, parting: parting, block: block, blockTip: blockTip, strains: strains, strainBadge: strainBadge, city: city, family: family, know: know, journal: journal, mark: mark, carTip: carTip, haul: haul, FX: FX, fxTip: fxTip, news: news, carLoad: carLoad, change: change, wash: wash, clock: clock, crowded: crowded, iconName: iconName, planWord: planWord };
  ['start', 'requests', 'chairs', 'chair', 'capo', 'parting', 'block', 'city', 'family', 'journal'].forEach(function (k) { api[k] = safe(api[k]); });
  return api;
});
