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
  var nameOf = function (id) { var p = T.person(id); return p ? p.name : 'Nobody'; };
  var icon = function (k) { return I.icon(I.has(k) ? k : KEYICON[k] || 'unknown'); };
  var iconName = function (k) { return I.has(k) ? k : KEYICON[k] || 'unknown'; };
  var data = function (o) { return Object.keys(o).map(function (k) { return ' data-' + k + '="' + esc(o[k]) + '"'; }).join(''); };
  var button = function (act, o, label, opt) { return '<button' + (opt && opt.cls ? ' class="' + opt.cls + '"' : '') + ' data-act="' + act + '"' + data(o || {}) + (opt && opt.off ? ' disabled' : '') + '>' + label + '</button>'; };
  var cityOf = function (view, id) { return view.cities.filter(function (c) { return c.id === id; })[0] || null; };
  var zoneOf = function (c, x, y) { return c.zones.filter(function (z) { return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1; })[0] || { name: c.name }; };

  // ---- words and pictures shared by the sheets
  var STATS = [['muscle', 'Muscle: takes and holds streets, wins fights'], ['business', 'Business: makes every place pay more'], ['cunning', 'Cunning: hides the money, sees traps'], ['charisma', 'Charisma: keeps the neighbourhood and his men on his side']];
  var WAY = { force: { icon: 'muscle', color: '#ff5a3a', word: 'By force', tip: 'His men go in gun in hand' }, bribe: { icon: 'bribe', color: '#e8c463', word: 'With an envelope', tip: 'He pays the other side\'s man to change sides' },
              buy: { icon: 'clean', color: '#8fbf97', word: 'By buying', tip: 'He buys the place outright' } };
  var HAUL = { liquor: ['liquor', '#ffb347', 'Liquor on its way to the bars'], takings: ['takings', '#e8c463', 'Takings, dirty cash, on their way to the club'], wash: ['laundering', '#6ad0e0', 'Dirty cash on its way to be washed'], crew: ['muscle', '#ff5a3a', 'A crew on its way to take a place'] };
  var EVENT = { opened: 'works', enlarged: 'works', taken: 'seize', moving: 'muscle', burnt: 'attack', repelled: 'muscle', rank: 'ambition', asks: 'time', knocks: 'men', unpaid: 'dirty', bust: 'heat', learned: 'yes', feud: 'attack',
                granted: 'yes', denied: 'no', welcomed: 'men', ruled: 'loyalty', parted: 'no', studying: 'time' };
  var BAD = { burnt: 1, unpaid: 1, bust: 1, feud: 1, parted: 1 };
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
  function mark(l) {
    return I.ring(l.progress == null ? 0 : l.progress) + '<span class="pf">' + I.portrait(l.capo) + '</span><span class="do">' + icon(planIcon(l)) + '</span>';
  }
  function carTip(car) {
    var h = HAUL[car.kind] || HAUL.takings;
    return '<b style="color:' + h[1] + '">' + icon(h[0]) + ' ' + esc(h[2]) + '</b>' + (car.capo ? '<br>' + esc(nameOf(car.capo)) + (car.kind === 'crew' && WAY[car.cargo] ? ' · ' + WAY[car.cargo].word.toLowerCase() : '') : '');
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
      '<div class="acts">' + button('answer', { city: c.id, id: a.id, yes: 1 }, 'Yes, take it', { cls: 'go', off: a.cost > purse }) + button('answer', { city: o.city, id: o.id, yes: 0 }, 'No') + '</div></div>';
  }
  function doorCard(c, d, purse) {
    var poach = d.door === 'poach', full = c.seats && c.seats.taken >= c.seats.total;
    return '<div class="card ask">' + head(d.capo, d.name, esc(d.specialty) + ' · ' + (DOOR[d.door] || DOOR.name) + (d.by ? ' · spoken for by ' + esc(first(nameOf(d.by))) : '')) +
      (d.why ? '<div class="move">' + icon('time') + '<span>' + esc(d.why) + '</span></div>' : '') + price(d.cost, purse) +
      (full ? '<small class="short">No seat left in ' + esc(c.name) + ': ' + c.seats.total + ' capos is all the city carries until the family holds another key place</small>' : '') +
      '<div class="acts col">' + (poach ? button('welcome', { from: c.id, city: c.id, capo: d.capo }, 'Take him in · ' + money(d.cost), { cls: 'go', off: full || d.cost > purse })
        : button('seat', { city: c.id, capo: d.capo }, 'A club in ' + esc(c.name) + ' · ' + money(d.cost), { cls: 'go', off: full || d.cost > purse })) +
      (d.roads || []).map(function (r) { return button('road', { from: c.id, city: r.city, capo: d.capo }, 'Send him to ' + esc(r.name) + ' · ' + money(r.cost), { off: r.cost > purse }); }).join('') + '</div></div>';
  }
  function requests(view, hud) {
    var purse = funds(hud), cards = [];
    view.cities.forEach(function (c) {
      c.feuds.forEach(function (f) { cards.push(feudCard(c, f)); });
      c.asks.forEach(function (a) { cards.push(askCard(c, a, purse)); });
      c.doors.forEach(function (d) { cards.push(doorCard(c, d, purse)); });
    });
    return '<h2>Your word is needed</h2>' + (cards.length ? '<p>The clock is stopped. You can also leave them waiting and close this sheet.</p>' + cards.join('') : '<p>Nobody waits for you.</p>') +
      '<div class="acts">' + button('close', {}, 'Close') + '</div>';
  }

  // ---- a capo
  function capo(view, cityId, id) {
    var c = cityOf(view, cityId), k = c && c.capos.filter(function (q) { return q.id === id; })[0]; if (!k) return null;
    var w = WAY[k.way] || WAY.force;
    return head(k.id, k.name, esc(k.specialty) + ' · ' + esc(k.rankName) + ' · ' + esc(c.name) + (k.sulks ? ' · <span class="i no" data-tip="He holds a grudge and keeps more of the money for himself">sulking</span>' : '')) +
      intent(k.plan) +
      '<div class="tiles">' + tile('hideout', 'PLACES', k.places + ' / ' + k.reach, 'Places he runs, out of what his rank lets him run') + tile('takings', 'A MONTH', money(k.income), 'What his places bring in a month') +
      tile('dirty', 'HIS CASH', money(k.cash), 'What he keeps at his club for his next move') + '</div>' +
      '<div class="move" style="--c:' + w.color + '" data-tip="' + esc(w.tip) + '">' + icon(w.icon) + '<span>His way of taking a place: ' + w.word.toLowerCase() + '</span></div>' +
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
      '<div class="acts">' + (ours && p.capo ? button('capo', { city: c.id, capo: p.capo }, 'See ' + esc(first(nameOf(p.capo)))) : '') + button('city', { city: c.id }, esc(c.name)) + button('close', {}, 'Close') + '</div>';
  }
  function shares(s) {
    var part = function (k, color) { return s[k] > 0 ? '<i style="flex:' + s[k].toFixed(1) + ';background:' + color + '" data-tip="' + { family: 'Yours', rival: 'The rivals', contested: 'Fought over', free: 'Held by nobody' }[k] + ': ' + Math.round(s[k]) + '%"></i>' : ''; };
    return '<div class="shares">' + part('family', 'var(--accent)') + part('contested', '#ff5a3a') + part('rival', '#6b6f86') + part('free', '#ffffff1f') + '</div>';
  }
  function faces(c, list, act) {
    return '<div class="tier"><div>' + list.map(function (m) { return act ? '<button class="slot" data-act="capo"' + data({ city: c.id, capo: m.id }) + ' data-tip="' + esc(m.name) + '">' + I.portrait(m.id) + '</button>'
      : '<span class="slot wait" data-tip="' + esc(m.name + ', ' + m.specialty + ': ' + m.places + ' places') + '">' + I.portrait(m.id) + '</span>'; }).join('') + '</div></div>';
  }
  function city(view, id) {
    var c = cityOf(view, id); if (!c) return null;
    var s = c.share;
    return '<h2>' + esc(c.name) + '</h2><p>' + (c.held ? 'You hold ' + Math.round(s.family) + '% of its streets' : 'No man of yours here yet') + ' · the ' + esc(c.rival) + ' family holds ' + Math.round(s.rival) + '%</p>' + shares(s) +
      '<div class="tiles">' + tile('men', 'SEATS', c.seats.taken + ' / ' + c.seats.total, 'Capos you have here, out of those the city can carry. Each key place you hold adds a seat') +
      tile('heat', 'HEAT', Math.round(c.heat || 0), 'How closely the police watch this city') + tile('clean', 'WASHED', money(c.money ? c.money.washed : 0), 'Dirty cash washed here last month') + '</div>' +
      (c.capos.length ? '<h3 class="sub2">Your capos</h3>' + faces(c, c.capos, true) : '') +
      '<h3 class="sub2">Key places</h3><ul class="list">' + c.keys.map(function (k) { var ours = k.owner === 'family';
        return '<li class="ev"><span class="' + (ours ? 'i yes' : 'i') + '">' + icon(k.key) + '</span><div><b>' + esc(k.name) + '</b> · ' + (ours ? 'yours' + (k.capo ? ', ' + esc(first(nameOf(k.capo))) : '') : esc(k.owner)) + '<small>' + esc(k.gives) + '</small></div></li>'; }).join('') + '</ul>' +
      (c.lieutenants && c.lieutenants.length ? '<h3 class="sub2">The ' + esc(c.rival) + ' family</h3>' + faces(c, c.lieutenants, false) : '') +
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
    var html = '<b>' + esc(t.name) + (t.tier ? ' · tier ' + t.tier : ' · not known yet') + '</b>' + (wanted.length ? '<small>Asked for by ' + esc(wanted.join(', ')) + '</small>' : '');
    if (t.studying) return html + '<div class="move">' + I.icon('time') + '<span>Learning: ' + months(t.studying) + ' left</span></div>';
    if (!t.next) return html + '<div class="move yes">' + I.icon('yes') + '<span>Nothing more to learn</span></div>';
    var what = (t.tier ? 'Tier ' + t.next.tier : 'Learn it') + ' · ' + money(t.next.cost) + ' clean · ' + months(t.next.months);
    if (busy) return html + '<div class="move">' + I.icon('time') + '<span>' + what + '. One thing at a time: the family is learning ' + esc(busy.name.toLowerCase()) + '</span></div>';
    var short = t.next.cost > (hud.clean || 0);
    return html + (short ? '<small class="short">Short by ' + money(t.next.cost - (hud.clean || 0)) + ' of clean money</small>' : '') + button('research', { building: t.kind }, what, { cls: 'go', off: short });
  }
  function family(view, hud) {
    var men = '';
    view.cities.forEach(function (c) { if (c.capos.length) men += '<div class="tier"><small>' + esc(c.name) + ' · ' + c.seats.taken + ' / ' + c.seats.total + ' seats</small><div>' +
      c.capos.map(function (m) { return '<button class="slot" data-act="capo"' + data({ city: c.id, capo: m.id }) + ' data-tip="' + esc(m.name + ', ' + m.rankName) + '">' + I.portrait(m.id) + '</button>'; }).join('') + '</div></div>'; });
    var pick = view.tree.filter(function (t) { return t.studying; })[0] || view.tree.filter(function (t) { return t.wanted && t.wanted.length && t.next; })[0] || view.tree[0];
    return '<h2>The family</h2><p>' + (hud.men || 0) + (hud.men === 1 ? ' capo' : ' capos') + ' · ' + (hud.cities ? hud.cities.held + ' of ' + hud.cities.total + ' cities' : '') + '</p><div class="pyr">' + men + '</div>' +
      '<h3 class="sub2">What the family knows</h3><p>Paid in clean money. A face marks what a capo is asking for.</p><div class="tree">' + view.tree.map(function (t) { return knowBtn(t, pick && t.kind === pick.kind); }).join('') + '</div>' +
      '<div id="know">' + (pick ? know(view, pick.kind, hud) : '') + '</div><div class="acts">' + button('close', {}, 'Close') + '</div>';
  }

  // ---- the journal, newest first
  function journal(lines) {
    var last = lines.slice(-60).reverse();
    return '<h2>Journal</h2>' + (last.length ? '<ul class="list">' + last.map(function (e) {
      return '<li class="ev"><span class="i' + (BAD[e.type] ? ' no' : '') + '">' + icon(EVENT[e.type] || 'time') + '</span><div>' + esc(e.label || e.type) + '<small>' + esc(e.date || '') + '</small></div></li>'; }).join('') + '</ul>' : '<p>Nothing yet.</p>') +
      '<div class="acts">' + button('new', {}, 'New game') + button('close', {}, 'Close') + '</div>';
  }

  return { esc: esc, money: money, first: first, nameOf: nameOf, funds: funds, WAY: WAY, HAUL: HAUL, EVENT: EVENT, BAD: BAD,
           start: start, man: man, requests: requests, capo: capo, parting: parting, block: block, city: city, family: family, know: know, journal: journal, mark: mark, carTip: carTip, planWord: planWord };
});
