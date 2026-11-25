// The new screen: the cities block by block. It shows what AshportEmpire says and passes the boss's orders back.
// The sheets are written by cards.js; this file opens them, draws the labels over the map and keeps time.
// No rule lives here. The map is drawn by render.js from the plan made by mapview.js (planEmpire).
(function () {
  'use strict';
  var E = AshportEmpire, M = AshportMapView, I = AshportIcons, C = AshportCards, T = AshportTurf, W = AshportWorld;
  var SAVE = 'ashport-city-3', TICK_MS = 1000;
  var $ = function (id) { return document.getElementById(id); };
  var say = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };

  var g = null, map = null, view = null, labs = {}, waits = {}, moods = {}, healths = {}, doings = {}, powers = {}, rows = {}, zshares = {}, ctrends = {}, lastStep = null, lastMonth = -1, stopped = false, live = null, watched = {};

  // A saved game is kept only if today's rules and today's screen can read all of it: otherwise it is set aside
  // (kept under another name) and the player is told. Never a dead screen at the door.
  var setAside = false;
  function stored() {
    var t = null;
    try { t = localStorage.getItem(SAVE); if (!t) return null; var s = E.load(t), v = E.view(s), h = E.hud(s); M.planEmpire(v, W.CITIES); C.requests(v, h); C.family(v, h); C.journal(s.journal); C.decisions(v);
      v.cities.forEach(function (c) { C.city(v, c.id); c.capos.forEach(function (k) { C.capo(v, c.id, k.id); }); }); return s; }
    catch (e) { if (t) { setAside = true; try { localStorage.setItem(SAVE + '-unreadable', t); localStorage.removeItem(SAVE); } catch (x) { /* no storage */ } } return null; }
  }
  // The first version of the game (by districts) saved under another key: that game is not continued. It is kept aside, and the player is told once.
  var OLD = 'ashport-save-1';
  function retire() { try { var t = localStorage.getItem(OLD); if (!t) return; localStorage.setItem(OLD + '-unreadable', t); localStorage.removeItem(OLD); setAside = true; } catch (e) { /* no storage */ } }
  var kept = null;      // the text this page last saved
  function store() { try { kept = E.save(g); localStorage.setItem(SAVE, kept); } catch (e) { /* no storage: the game still plays */ } }
  function forget() { try { localStorage.removeItem(SAVE); } catch (e) { /* nothing to forget */ } }

  // ---- the map follows the game: buildings and streets, then the cars, then what just happened
  function planOf(game) { return M.planEmpire(E.view(game), W.CITIES); }
  var lastPlan = null, POWER = 'ashport-power', wonZones = {};      // (the street names already told as won: see C.moments)
  var claims = [], nextI = 0, nextSeen = '';      // the claims in progress, and the one the line at the top shows
  function showNext() { var h = g.started ? C.nextLine(claims, nextI) : ''; if ($('next').html !== h) { $('next').html = h; $('next').innerHTML = h; } }
  var fillAt = {};      /* how full each place of the family is, by city and block: the small gauge beside its mark */
  var strainAt = {};      // the family's places that choke, by city and block: the map marks them
  function refresh(events, turned) {
    view = E.view(g);
    if (!g.started) return;
    waits = {};
    var scars = C.scars(g.journal, g.month); view.cities.forEach(function (c) { c.scars = scars[c.id] || []; });      // what was burnt out stays black on the map for a while
    healths = C.healths(view); view.cities.forEach(function (c) { c.capos.forEach(function (k) { k.trouble = healths[c.id + k.id].worst === 'bad'; }); });      // how his streets fare: three lights under his face
    // what each man is doing and whether he rises or falls: his power, remembered a year deep by the page (outside the save)
    try { powers = JSON.parse(localStorage.getItem(POWER) || '{}') || {}; } catch (e) { powers = {}; }
    var logged = C.powerLog(powers, view); if (logged !== powers) { powers = logged; try { localStorage.setItem(POWER, JSON.stringify(powers)); } catch (e) { /* no room: the arrows start again next time */ } }
    rows = C.powerRows(view, powers);      // (the rules' own history of each man, when the save has it)
    doings = {}; view.cities.forEach(function (c) { c.capos.forEach(function (k) { doings[c.id + k.id] = C.doing(c, k, C.powerTrend(rows, c.id + k.id)); }); });
    // every city and every street name: what the family holds of it and which way it went; a step won or lost is told in large, once
    zshares = C.zoneShares(view); ctrends = {}; view.cities.forEach(function (c) { ctrends[c.id] = C.cityMark(C.cityTrend(view, c.id)); });
    var step = { rank: C.rank(view), zones: zshares };
    if (view.month < lastMonth) { lastStep = null; wonZones = {}; }      // another game: nothing to compare with
    C.moments(lastStep, step, wonZones).slice(0, 2).forEach(announce); lastStep = step; lastMonth = view.month;
    moods = C.moods(view);      // a restless or bitter man shows it on his face over the map
    view.cities.forEach(function (c) { c.asks.forEach(function (a) { waits[c.id + a.capo] = 1; }); c.feuds.forEach(function (f) { waits[c.id + f.a] = waits[c.id + f.b] = 1; }); });
    strainAt = C.strains(view); fillAt = C.fills(view); retip(); drawLinks();
    if (!map) return;
    var p = M.planEmpire(view, W.CITIES); map.update(p); map.traffic(M.tripsTurf(p, view, true).concat(M.movesTurf(lastPlan, p), M.errandsTurf(events || [], p, lastPlan), M.arrivalsTurf(events || [], p), M.departuresTurf(events || [], p), M.paymentsTurf(events || [], p), M.leavingTurf(events || [], p, g.month * E.TICKS_PER_MONTH + g.ticks)));      // (what takes the road to the next city is seen the day it leaves)
    claims = M.claimsTurf(view); map.claims(claims); showNext();      // the streets about to be won: lit on the map, and told in one line at the top
    map.effects(M.effectsTurf(events || [], p));
    lastPlan = p;      // a capo who is not where he was last month drives there, once
  }
  function zoneId(cityId, x, y) { var c = view.cities.filter(function (q) { return q.id === cityId; })[0], n = 0;
    var b = c && c.blocks && c.blocks[y * c.w + x];
    if (b && typeof b.zone === 'number' && b.zone >= 0) n = b.zone;
    else if (c) c.zones.forEach(function (z, i) { if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) n = i; });
    return cityId + '-' + n; }
  function home() { var c = view.cities.filter(function (q) { return q.held; })[0], k = c && c.capos[0]; if (k) map.focus(c.id, zoneId(c.id, k.x, k.y), { x: k.x, y: k.y }); else map.focus(null); }

  // ---- the top of the screen
  // what last month did to a total, beside it: green when it grew, red when it shrank
  function bump(id) { var e = $(id); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
  function showHud() {
    var h = E.hud(g);
    $('date').textContent = g.started ? C.day(g.month, g.ticks) : 'Ashport';
    $('pause').textContent = h.paused ? 'Play' : 'Pause'; $('pause').classList.toggle('on', !!h.paused);
    $('speed').textContent = h.speed + 'x';
    if (!h.started) return;
    $('dirty').textContent = C.money(h.dirty); $('clean').textContent = C.money(h.clean);

    $('share').textContent = h.share + '%'; $('cities').textContent = h.cities.held + ' / ' + h.cities.total;
    $('men').textContent = h.men + ' / ' + h.seats.total;
    $('heat').innerHTML = I.icon('heat') + Math.round(h.heat);
    showHint(h);
    var w = C.wash(view, h), k = C.clock(h, view);
    // the two moneys are totals alone; under the dirty one, what waits in the tills (a touch opens the account, line by line)
    var acc = C.account(view, h); var dt = C.moneyTile(acc, 'dirty', view), ct = C.moneyTile(acc, 'clean', view); if ($('wash').tile !== dt) { $('wash').innerHTML = dt; $('wash').tile = dt; } if ($('kept').tile !== ct) { $('kept').innerHTML = ct; $('kept').tile = ct; }
    // is the family getting anywhere: its rank, the bar towards the next one, and the verdict of the last year
    var tr = C.trend(view), best = view.cities.slice().sort(function (a, b) { return b.share.family - a.share.family; })[0];
    var gl = C.goalLine(view); if ($('rank').dataset.was !== gl) { $('rank').dataset.was = gl; $('rank').innerHTML = gl; }      // the goal: a touch opens the whole road
    var sl = C.stallLine(view); if ($('stall').dataset.was !== sl) { $('stall').dataset.was = sl; $('stall').innerHTML = sl; }      // what holds him back, the worst first: a touch tells why
    $('shared').innerHTML = (best && best.share.family > 0 ? C.esc(best.name) + ' ' + Math.round(best.share.family) + '%' : '');
    $('dirty').parentNode.classList.toggle('hot', w.hot);
    // time that stands still is said in large, with the reason, and framed all around the screen
    document.body.classList.toggle('stopped', !!k); if (map) { map.hold(!!k); map.pace(g.speed || 1); }      // a car with days to drive keeps to them at the speed the boss chose
    $('sub').innerHTML = k ? '' : C.trendLine(tr);
    $('clock').innerHTML = k ? '<b>' + I.icon(h.pending ? 'ask' : 'time') + k.word + '</b><span>' + C.esc(k.why) + '</span>' : '';
    $('clock').dataset.go = h.pending ? 'requests' : 'play';
    $('alerts').innerHTML = (h.pending && !h.paused ? '<div data-requests="1" style="border-color:var(--accent)">' + I.icon('ask') + C.esc(C.waitsFor(view) ? C.waitsFor(view) + (h.pending > 1 ? ', and ' + (h.pending - 1) + ' more' : '') : h.pending + (h.pending > 1 ? ' wait' : ' waits') + ' for your word') + ': tap to answer</div>' : '') +
        (w.hot ? '<div>' + I.icon('heat') + 'Over ' + C.money(C.vault(view, h)) + ' of dirty cash: the police take notice. It needs washing.</div>' : '');
  }
  // ---- the live hit: when a capo goes for a guarded place, the screen goes to the street and the boss may call each step
  // The usual figures step aside; the band says who hits what, the sheet gives the three calls. If the boss looks away the capo decides alone.
  function hitOf(l) { var c = view && view.cities.filter(function (q) { return q.id === l.city; })[0]; if (!c) return null;
    var h = (c.hits || []).filter(function (q) { return q.id === l.id; })[0]; return h ? { hit: h } : c.hitLast && c.hitLast.id === l.id ? { last: c.hitLast } : null; }
  function watch(city, h) {
    if (live) return; watched[h.id] = true; close();
    live = { city: city, id: h.id, speed: g.speed };
    if (g.speed !== E.SPEEDS[0]) E.command(g, { type: 'speed', speed: E.SPEEDS[0] });      // a hit is watched at the slowest pace: nobody is asked for a reflex
    if (map) { map.spots(city, [{ x: h.x, y: h.y }]); map.focus(city, zoneId(city, h.x, h.y), { x: h.x - 0.6, y: h.y - 0.6 }); }
    showLive();
  }
  function unwatch() {
    if (!live) return; var was = live; live = null;
    if (was.speed && was.speed !== g.speed) E.command(g, { type: 'speed', speed: was.speed });
    if (map) map.spots(); showLive(); showHud();
  }
  function showLive() {
    var s = live && hitOf(live); if (live && !s) { live = null; if (map) map.spots(); }
    document.body.classList.toggle('live', !!live);
    var band = !live ? '' : s.hit ? C.hitBand(s.hit) : (live.band || ''), sheet = !live ? '' : s.hit ? C.hitCall(s.hit, live.city) : C.hitEnd(s.last);
    if (live && s.hit) live.band = band;
    if ($('live').innerHTML !== band) $('live').innerHTML = band;
    $('live').classList.toggle('over', !!live && !s.hit);      // once it is over the count of men and the steps give way to the result
    if ($('call').innerHTML !== sheet) $('call').innerHTML = sheet;
  }
  // A hit that begins is watched at once, unless the boss is reading a sheet; each hit is opened once, he can come back to it by its news.
  function hits() { if (!view || live || $('veil').classList.contains('on')) return;
    view.cities.some(function (c) { return (c.hits || []).some(function (h) { if (watched[h.id] || !(h.calls && h.calls.length)) return false; watch(c.id, h); return true; }); }); }
  $('call').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !live) return;
    if (b.dataset.act === 'unlive') return unwatch();
    if (b.dataset.act === 'call' && order({ type: 'call', city: b.dataset.city, hit: b.dataset.hit, call: b.dataset.call })) showLive();
  });

  // The first minutes: one thing to look at at a time, put away with a touch and never said again (kept apart from the saved game).
  var HINTS = 'ashport-hints', known = {}; try { known = JSON.parse(localStorage.getItem(HINTS) || '{}') || {}; } catch (e) { known = {}; }
  function showHint(h) { var t = C.hintStrip($('veil').classList.contains('on') ? null : C.hint(view, h, known)); if ($('hint').innerHTML !== t) $('hint').innerHTML = t; }
  $('hint').addEventListener('click', function (e) { var b = e.target.closest('[data-hint]'); if (!b) return;
    known[b.dataset.hint] = 1; try { localStorage.setItem(HINTS, JSON.stringify(known)); } catch (x) { /* no storage: said again next time */ } showHud(); });
  function announce(m) {
    var box = $('moment'), e = document.createElement('div'); e.innerHTML = C.moment(m); e = e.firstChild;
    box.appendChild(e); while (box.children.length > 2) box.firstChild.remove();
    setTimeout(function () { e.remove(); }, 5200);
  }
  function toast(text, bad) {
    var e = document.createElement('div'); e.textContent = text; if (bad) e.className = 'bad';
    $('toast').appendChild(e); while ($('toast').children.length > 3) $('toast').firstChild.remove();
    setTimeout(function () { e.remove(); }, 6000);
  }

  // What happens is told by small tiles on the right edge: they slide in, stay a few seconds, and go. A touch on one goes where it happened.
  var told = {};
  function tell(e) {
    var f = $('feed'); f.insertAdjacentHTML('beforeend', C.news(e)); var t = f.lastChild;
    while (f.children.length > 4) f.firstChild.remove();
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, 6500);
  }
  $('feed').addEventListener('click', function (e) {
    var t = e.target.closest('.news'); if (!t) return; var d = t.dataset; t.remove();
    if (d.city && map) map.focus(d.city, zoneId(d.city, +d.x, +d.y), { x: +d.x, y: +d.y });
    var c = d.city && view.cities.filter(function (q) { return q.id === d.city; })[0], h = c && (c.hits || []).filter(function (q) { return q.x === +d.x && q.y === +d.y; })[0];
    if (h) watch(c.id, h);      // the news of a hit under way leads back to it
  });

  // ---- sheets
  function open(html) { $('sheet').innerHTML = html; $('veil').classList.add('on'); $('sheet').scrollTop = 0; if (g && view) showHint(E.hud(g)); }
  function close() { $('veil').classList.remove('on'); if (g && view) showHint(E.hud(g)); }
  function show(html) { if (html == null) close(); else open(html); }      // a sheet with nothing to say closes
  // An order goes to the rules, which refuse in plain words what cannot be done.
  function order(o) {
    try { E.command(g, o); } catch (e) { toast(say(e.message), true); return false; }
    refresh(); showHud(); store(); return true;
  }
  // Once the boss has answered everything, the clock he did not stop himself starts again.
  function answered() {
    if (E.hud(g).pending) return show(C.requests(view, E.hud(g)));
    close(); if (stopped && g.paused) { stopped = false; E.command(g, { type: 'resume' }); } showHud();
  }
  function requests() { show(C.requests(view, E.hud(g))); }

  /* why(el): the words of what was touched on a page, written under it; a second touch puts them away. */
  function html0(el) { return el.classList.contains('lab'); }
  function why(el) {
    var host = el.closest('.move, .tile, .intent, .skill, .dial, .stat, .chip, span, div') || el, next = host.nextElementSibling;
    if (next && next.classList.contains('why')) { next.remove(); return; }
    [].forEach.call($('sheet').querySelectorAll('.why'), function (n) { n.remove(); });
    var p = document.createElement('p'); p.className = 'why'; p.textContent = el.dataset.tip; host.parentNode.insertBefore(p, host.nextSibling);
  }
  // A bubble beside what was touched. With `more`, a touch on the bubble itself opens the whole page.
  function tip(el, html, more) {
    var t = $('tip'), r = el.getBoundingClientRect(); t.innerHTML = (html || C.esc(el.dataset.tip)) + (more ? '<i class="more">\u203a</i>' : ''); t.classList.add('on'); t.classList.toggle('more', !!more); tip.more = more || null;
    var w = t.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - t.offsetHeight - 8;
    t.style.left = x + 'px'; t.style.top = (y < 8 ? r.bottom + 8 : y) + 'px';
    tip.at = Date.now(); clearTimeout(tip.t); tip.live = null; tip.place = null; tip.t = setTimeout(untip, more ? 6000 : 3200);
  }
  /* The bubble of a place stays open until something else is touched, and follows the place: each day its figures are
     read again, and the ones that moved say by how much. */
  function figures(t) { var out = {}; [].forEach.call(t.querySelectorAll('[data-k]'), function (n) { out[n.dataset.k] = +n.dataset.v; }); return out; }
  function retip() {
    var t = $('tip'); if (!tip.live || !t.classList.contains('on')) return;
    var html = tip.live(); if (!html) return untip();
    var was = figures(t); t.innerHTML = html + '<i class="more">\u203a</i>';
    var d = C.moved(was, figures(t));
    Object.keys(d).forEach(function (k) { var n = t.querySelector('[data-k="' + k + '"]'), chip = document.createElement('em'); n.classList.add(d[k] > 0 ? 'up' : 'down'); chip.textContent = C.delta(k, d[k]); n.appendChild(chip); });
  }
  function untip() { $('tip').classList.remove('on', 'more'); tip.more = null; tip.live = null; tip.place = null; drawLinks(); }
  function at(x, y) { return { getBoundingClientRect: function () { return { left: x, top: y - 16, width: 0, height: 32, bottom: y + 16 }; } }; }
  function fresh() { return Date.now() - (tip.at || 0) <= 450; }      // the click a phone sends after a touch does not close what that touch opened
  document.addEventListener('click', function (e) {
    if (e.target.closest('#tip')) { var m = tip.more; untip(); if (m) m(); return; }
    if (e.target.closest('[data-goal]') && g && g.started) { untip(); show(C.reign(view)); return; }
    if (e.target.closest('[data-stalls]') && g && g.started) { untip(); show(C.stallsCard(view)); return; }
    var nx = e.target.closest('#next .nx');
    if (nx && map && claims.length) {      // a touch shows where it is; another one passes to the next claim
      if (nextSeen === nx.dataset.id && claims.length > 1) { nextI = (claims.map(function (c) { return c.id; }).indexOf(nextSeen) + 1) % claims.length; showNext(); }
      var cl = claims[((nextI % claims.length) + claims.length) % claims.length]; nextSeen = cl.id; untip();
      map.focus(cl.city, zoneId(cl.city, cl.x, cl.y), { x: cl.x, y: cl.y }); return;
    }
    if (e.target.closest('[data-account]') && g && g.started) { untip(); show(C.accountCard(view, E.hud(g), e.target.closest('[data-account]').dataset.account)); return; }
    var el = e.target.closest('[data-tip]');
    if (el && el.closest('#sheet') && !html0(el)) { why(el); return; }      /* on a page, the explanation opens in the page under what was touched: no bubble over the rest */
    if (el) tip(el); else if (!fresh()) untip();
  }, true);
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('#tip') && !fresh()) untip(); }, true);

  // A man taken in opens his club where he sees fit: the boss is never asked for a street. The camera goes to see where he settled.
  function settle(from, city, capo) {
    if (!order({ type: 'welcome', city: city, from: from, capo: capo })) return;
    var c = view.cities.filter(function (q) { return q.id === city; })[0], k = c && c.capos.filter(function (m) { return m.id === capo; })[0];
    close(); toast(C.onItsWay(view, 'welcome', city, capo) || g.journal[g.journal.length - 1].label + '.'); answered();      // (his club is paid for by loads from the headquarters: he settles when the last one is there)
    if (k && typeof k.x === 'number') map.focus(city, zoneId(city, k.x, k.y), { x: k.x, y: k.y });
  }
  $('sheet').addEventListener('click', function (e) {
    var face = e.target.closest('[data-face]');
    if (face) { [].forEach.call($('sheet').querySelectorAll('.facebtn'), function (x) { x.classList.toggle('on', x === face); });
      $('who').innerHTML = C.man(E.candidates().filter(function (c) { return c.id === face.dataset.face; })[0], 'start', 'Start with'); return; }
    var know = e.target.closest('[data-know]');
    if (know) { [].forEach.call($('sheet').querySelectorAll('.know'), function (x) { x.classList.toggle('sel', x.dataset.know === know.dataset.know); });      /* the advice opens its branch on the wheel */ $('know').innerHTML = C.know(view, know.dataset.know, E.hud(g)); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.dataset.act, d = b.dataset;
    if (act === 'close') close();
    else if (act === 'later') { close(); stopped = false; if (g.paused) E.command(g, { type: 'resume' }); showHud(); }      // he leaves them waiting: time goes on
    else if (act === 'start') { if (order({ type: 'start', capo: d.capo, seed: /[?&]fixed\b/.test(location.search) ? 0 : 1 + Math.floor(Math.random() * 9999) })) { close(); home(); toast(C.first(C.nameOf(d.capo)) + ' opens his club in Ashport. Tap a street to see it.'); } }
    else if (act === 'answer') { if (order({ type: 'answer', city: d.city, id: d.id, yes: d.yes === '1' })) { var way = d.yes === '1' ? C.onItsWay(view, 'answer', d.city) : ''; if (way) toast(way); answered(); } }
    else if (act === 'decide') { if (order({ type: 'decide', id: d.id, choice: d.choice })) { toast(((d.choice === 'learn' && C.onItsWay(view, 'research')) || g.journal[g.journal.length - 1].label + '.')); answered(); } }
    else if (act === 'rule') { if (order({ type: 'rule', city: d.city, id: d.id, winner: d.winner })) answered(); }
    else if (act === 'welcome') { if (order({ type: 'welcome', city: d.city, from: d.from, capo: d.capo })) { toast(C.onItsWay(view, 'welcome', d.city, d.capo) || C.first(C.nameOf(d.capo)) + ' is one of yours now.'); answered(); } }
    else if (act === 'seat') settle(d.city, d.city, d.capo);
    else if (act === 'underboss') { if (order({ type: 'underboss', city: d.city, capo: d.capo })) { toast(g.journal[g.journal.length - 1].label + '.'); show(C.capo(view, d.city, d.capo, E.hud(g), C.powerTrend(rows, d.city + d.capo), rows[d.city + d.capo])); } }
    else if (act === 'advance') { if (order({ type: 'advance', city: d.city, capo: d.capo })) { toast(g.journal[g.journal.length - 1].label + '.'); show(C.capo(view, d.city, d.capo, E.hud(g), C.powerTrend(rows, d.city + d.capo), rows[d.city + d.capo])); } }
    else if (act === 'gift') { if (order({ type: 'gift', city: d.city, capo: d.capo })) { toast(C.onItsWay(view, 'gift', d.city, d.capo) || g.journal[g.journal.length - 1].label + '.'); show(C.capo(view, d.city, d.capo, E.hud(g), C.powerTrend(rows, d.city + d.capo), rows[d.city + d.capo])); } }
    else if (act === 'line') { if (order({ type: 'line', city: d.city, line: d.line || null })) { toast(g.journal[g.journal.length - 1].label + '.'); show(C.city(view, d.city)); } }
    else if (act === 'cut') { if (order({ type: 'cut', city: d.city, cut: d.cut })) { toast(g.journal[g.journal.length - 1].label + '.'); show(C.city(view, d.city)); } }
    else if (act === 'buy') { var at = $('sheet').scrollTop; if (order({ type: 'buy', holding: d.holding })) { toast(C.onItsWay(view, 'buy') || g.journal[g.journal.length - 1].label + '.'); show(C.family(view, E.hud(g), rows)); $('sheet').scrollTop = at; } }
    else if (act === 'chairs') show(C.chairs(view, d.city, d.capo, E.hud(g)));
    else if (act === 'sit') { if (order({ type: 'seat', city: d.city, capo: d.capo, post: d.post })) { toast(g.journal[g.journal.length - 1].label + '.'); answered(); } }
    else if (act === 'chair') show(C.chair(view, d.post));
    else if (act === 'unseat') { if (order({ type: 'unseat', post: d.post })) { toast(g.journal[g.journal.length - 1].label, true); show(C.family(view, E.hud(g), rows)); } }
    else if (act === 'requests') requests();
    else if (act === 'family') { show(C.family(view, E.hud(g), rows)); if (d.know && $('know')) { $('know').innerHTML = C.know(view, d.know, E.hud(g)); [].forEach.call($('sheet').querySelectorAll('.know'), function (x) { x.classList.toggle('sel', x.dataset.know === d.know); }); $('know').scrollIntoView({ block: 'center' }); } }
    else if (act === 'decisions') show(C.decisions(view));
    else if (act === 'road') settle(d.from, d.city, d.capo);
    else if (act === 'capo') show(C.capo(view, d.city, d.capo, E.hud(g), C.powerTrend(rows, d.city + d.capo), rows[d.city + d.capo]));
    else if (act === 'parting') show(C.parting(view, d.city, d.capo, d.way));
    else if (act === 'part') { if (order({ type: 'part', city: d.city, capo: d.capo, way: d.way })) { close(); toast(g.journal[g.journal.length - 1].label, true); } }
    else if (act === 'city') show(C.city(view, d.city));
    else if (act === 'focus') { close(); map.focus(d.city); }
    else if (act === 'show') { close(); map.focus(d.city, zoneId(d.city, +d.x, +d.y), { x: +d.x, y: +d.y }); }
    else if (act === 'research') { var top = $('sheet').scrollTop; if (order({ type: 'research', building: d.building })) { var sent = C.onItsWay(view, 'research'); if (sent) toast(sent); show(C.family(view, E.hud(g), rows)); $('know').innerHTML = C.know(view, d.building, E.hud(g)); $('sheet').scrollTop = top; } }
    else if (act === 'account') show(C.accountCard(view, E.hud(g), d.which, +d.span || 6));
    else if (act === 'books') show(C.booksCard(view, d.city, d.capo, +d.span || 6));
    else if (act === 'restart') show(C.restart({ month: g.month, day: g.ticks }));
    else if (act === 'new') { forget(); location.reload(); }
  });
  // A touch beside the sheet closes it, but only a touch that began there: the click a phone sends after the touch
  // that opened the sheet lands on the veil too, and must not close what it has just opened.
  var veilDown = false;
  $('veil').addEventListener('pointerdown', function (e) { veilDown = e.target === $('veil'); });
  $('veil').addEventListener('click', function (e) { var mine = veilDown; veilDown = false; if (mine && e.target === $('veil') && g.started) close(); });
  $('alerts').addEventListener('click', function (e) { if (e.target.closest('[data-requests]')) requests(); });
  $('map').onclick = function () { if (map) map.focus(null); };
  $('clock').onclick = function () { var go = $('clock').dataset.go; if (go === 'requests') requests(); else if (go === 'play') $('pause').click(); };
  $('pause').onclick = function () { if (!g.started) return; stopped = false; E.command(g, { type: g.paused ? 'resume' : 'pause' }); showHud(); };
  $('speed').onclick = function () { if (!g.started) return; var s = E.SPEEDS; E.command(g, { type: 'speed', speed: s[(s.indexOf(g.speed) + 1) % s.length] }); showHud(); };
  $('family').onclick = function () { if (g.started) show(C.family(view, E.hud(g), rows)); };
  $('journal').onclick = function () { if (g.started) show(C.journal(g.journal)); };
  // the meter: touch the images-per-second figure for the full reading (draw calls, triangles, resolution, cars, labels, WebGPU on this device)
  function meter() { if (!map || !$('fps').classList.contains('on')) return; var s = map.stats();
    $('fps').textContent = (window.__fps || 0) + ' fps · ' + s.calls + ' draws · ' + (s.tris / 1000).toFixed(0) + 'k tris · x' + s.pr + ' · ' + s.cars + ' cars · ' + document.querySelectorAll('.lab').length + ' labels · webgpu ' + (navigator.gpu ? 'yes' : 'no') + loaded(); }
  function loaded() { var st = (window.AshportLoad || {}).steps || [], worst = null; if (!st.length) return '';
    st.forEach(function (x, i) { var d = x.ms - (i ? st[i - 1].ms : 0); if (!worst || d > worst.d) worst = { d: d, label: (st[i - 1] || x).label }; });
    return ' · start ' + (st[st.length - 1].ms / 1000).toFixed(1) + 's (' + worst.label + ' ' + (worst.d / 1000).toFixed(1) + 's)'; }
  $('fps').onclick = function () { var on = $('fps').classList.toggle('on'); if (on) meter(); else $('fps').textContent = (window.__fps || 0) + ' fps'; };
  setInterval(meter, 1000);

  // ---- a touch on the map: from afar it goes to the city, up close it names the street; while a club is being placed, it places it
  // Labels never take the finger themselves, so a drag that starts on one still moves the map. A short touch is sorted here:
  // the label under the finger first (the most important one if several), then the street.
  var shown = [], REACH = 8;
  function labelAt(x, y) {
    var best = null;
    shown.forEach(function (b) { if (x >= b.x - REACH && x <= b.x + b.w + REACH && y >= b.y - REACH && y <= b.y + b.h + REACH && (!best || b.rank < best.rank)) best = b; });
    return best && labs[best.id];
  }
  function tap(hit, x, y) {
    if (!g.started) return;
    var e = x == null ? null : labelAt(x, y);
    if (e) return tapLabel(e.l, e);
    if (!hit) return;
    var c = view.cities.filter(function (q) { return q.id === hit.city; })[0], inside = c && hit.bx >= 0 && hit.by >= 0 && hit.bx < c.w && hit.by < c.h;
    if (!hit.near || !inside) return map.focus(hit.city, inside ? zoneId(hit.city, hit.bx, hit.by) : undefined);
    said(hit.city, hit.bx, hit.by, at(x == null ? innerWidth / 2 : x, y == null ? innerHeight / 2 : y));
  }
  // a touched street or place answers with a bubble; the bubble leads to its page
  function said(city, bx, by, el) {
    var h = C.blockTip(view, city, bx, by); if (!h) return;
    tip(el, h, function () { show(C.block(view, city, bx, by)); });
    clearTimeout(tip.t); tip.live = function () { return C.blockTip(view, city, bx, by); };
    tip.place = { city: city, bx: bx, by: by }; drawLinks();
  }

  // ---- labels over the map: names, the capos over their clubs, a mark on the places that count, what each car carries
  var FX = C.FX;
  function tapLabel(l, e) {
    if (l.fx) tip(e, C.fxTip(l.fx, l.say, l.type));
    else if (l.car) tip(e, C.carTip(l.car, l.round && l.back));
    else if (l.claim) { var q = claims.map(function (c) { return c.id; }).indexOf(l.claim); if (q >= 0) { nextI = q; nextSeen = l.claim; showNext(); } }
    else if (l.site) said(l.city, l.bx, l.by, e);
    else if (l.capo) { if (waits[l.city + l.capo]) requests(); else show(C.capo(view, l.city, l.capo, E.hud(g), C.powerTrend(rows, l.city + l.capo), rows[l.city + l.capo])); }
    else if (l.city && !l.ground) { if (map.stats().moving) return; map.focus(l.city); }
  }
  var MOVE = 'translate' in document.documentElement.style;
  var hiddenLabs = {};      // the labels that had stepped aside at the last image: none blinks at the edge of another
  var drawnAt = -1;
  /* A touched building is tied by blue lines to the vehicles that work for it, curving up from its roof to each car. */
  function drawLinks() {
    var p = tip.place, svg = $('links'); if (!p && !svg) return;      /* nothing touched: no layer over the map at all, nothing written to the page */
    var from = p && map && map.spot(p.city, p.bx, p.by), cars = from ? map.where(C.linked(view, p.city, p.bx, p.by)) : [];
    if (!cars.length) { if (svg) svg.remove(); return; }
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.id = 'links'; document.body.appendChild(svg); }
    svg.innerHTML = cars.map(function (q) { var d = Math.hypot(q.x - from.x, q.y - from.y), mx = (from.x + q.x) / 2, my = Math.min(from.y, q.y) - Math.max(24, d * 0.35);
      return '<path d="M' + from.x.toFixed(1) + ' ' + from.y.toFixed(1) + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + '"/><circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="4"/>'; }).join('');
    svg.dataset.n = cars.length;
  }
  function drawLabels() { try { drawLabelsNow(); } catch (e) { console.error(e); } requestAnimationFrame(drawLabels); }      // one bad label never stops the others from following the map
  function drawLabelsNow() {
    // the labels follow the map: while it draws nothing new (time stopped, camera still), they stay as they are
    var drawn = map ? map.stats().drawn : -1;
    if (map && drawn !== drawnAt) { drawnAt = drawn; drawLinks();
      var seen = {}, boxes = [], all = map.labels(), empty = C.emptyClubs(all);
      all.forEach(function (l) {
        seen[l.id] = 1; var e = labs[l.id];
        if (!e) {
          e = labs[l.id] = document.createElement('div');
          if (l.fx) { e.className = 'lab fx ' + l.fx; e.dataset.tip = (FX[l.fx] || ['time', l.fx])[1]; e.innerHTML = I.ring(1, l.fx === 'news' ? C.EVENT[l.type] || 'time' : (FX[l.fx] || ['time'])[0]); e.arc = e.querySelectorAll('circle')[1]; }
          else if (l.pop) { var pp = C.pop(l.pop); e.className = 'lab pop ' + pp.cls; e.textContent = pp.text; if (l.pop > 0 && l.what !== 'payment') bump(l.what === 'clean' ? 'clean' : 'dirty'); }      // money seen coming in: the figure at the top of the screen answers
          else if (l.claim) { e.className = 'lab claim'; }
          else if (l.car) { e.className = 'lab tag'; e.innerHTML = '<span></span><b></b>'; e.pic = e.firstChild; e.b = e.lastChild; }
          else if (l.site) { e.className = 'lab pin' + (l.role === 'club' ? ' club' : l.owner !== 'family' ? ' theirs' : l.role === 'laundering' ? ' wash' : ''); e.innerHTML = C.pin(l); e.lv = l.level; }
          else if (l.capo) e.className = 'lab capo';
          else { e.className = 'lab' + (l.small ? ' sm' : ''); e.innerHTML = '<b></b><span></span>'; e.b = e.firstChild; e.s = e.lastChild; }
          $('labels').appendChild(e);
        }
        // a label is moved by the compositor alone, and only when it has moved by a whole pixel: no layout of the page per frame
        var px = Math.round(l.x), py = Math.round(l.y - (l.fx ? ({ fire: 0, gunfire: 40, police: 80, promotion: 120, news: 0 }[l.fx] || 0) : 0));
        e.l = l; if (e.px !== px || e.py !== py) { e.px = px; e.py = py; if (MOVE) e.style.translate = px + 'px ' + py + 'px'; else { e.style.left = px + 'px'; e.style.top = py + 'px'; } }
        if (l.pop) { var up = Math.round((l.part || 0) * 10); if (e.up !== up) { e.up = up; e.style.setProperty('--up', up / 10); } }
        else if (l.claim) { var cs = l.streets + ':' + Math.round(l.advance * 40) + l.stuck; if (e.cs !== cs) { e.cs = cs; e.innerHTML = C.claim(l); e.classList.toggle('stuck', !!l.stuck); e.w = 0; } if (!e.w) e.w = e.offsetWidth; }
        else if (l.fx) { var left = (94.25 * (1 - (l.part || 0))).toFixed(0); if (e.left !== left) { e.left = left; e.arc.setAttribute('stroke-dasharray', left + ' 94.25'); } }
        else if (l.site) { if (e.lv !== l.level) { e.lv = l.level; e.innerHTML = C.pin(l); e.warn = null; e.st = ''; e.fill = null; e.fl = ''; }      // enlarged: its level shows under the mark
          var st = strainAt[l.city + ':' + l.bx + ',' + l.by], ss = st ? st.join() : ''; if ((e.st || '') !== ss) { e.st = ss; e.classList.toggle('strain', !!ss); if (!e.warn) { e.warn = document.createElement('span'); e.warn.className = 'warn'; e.appendChild(e.warn); } e.warn.innerHTML = C.strainBadge(st); }
          var fl = fillAt[l.city + ':' + l.bx + ',' + l.by], fs = fl === undefined ? '' : String(Math.round(fl * 20) * 5);
          if ((e.fl || '') !== fs) { e.fl = fs; if (!e.fill) { e.fill = document.createElement('span'); e.fill.className = 'fill'; e.fill.appendChild(document.createElement('i')); e.appendChild(e.fill); } e.fill.style.display = fs ? '' : 'none'; e.fill.firstChild.style.height = (fs || 0) + '%'; e.fill.classList.toggle('full', fs === '100'); } }
        else if (l.capo && !l.site) { var ask = !!waits[l.city + l.capo], mood = moods[l.city + l.capo] || '', hp = healths[l.city + l.capo], dg = doings[l.city + l.capo], sig = [l.move, l.kind, l.way, Math.round((l.progress || 0) * 20), ask, mood, hp ? hp.money + hp.men + hp.threat : '', dg ? dg.word + dg.tone + (dg.power ? dg.power.now + dg.power.tone : '') : ''].join();
          if (e.sig !== sig) { e.sig = sig; e.innerHTML = C.mark(l, hp, dg); e.classList.toggle('ask', ask); e.classList.toggle('restless', mood === 'restless'); e.classList.toggle('bitter', mood === 'bitter'); } }
        else if (l.car) { var h = C.haul(l.car); if (e.what !== h[0]) { e.what = h[0]; e.style.setProperty('--c', h[1]); e.pic.innerHTML = I.icon(h[0]); }      // a truck may haul liquor on one leg and crates on the next
          var cash = C.carLoad(l.car), load = l.back ? '' : cash; if (e.load !== load || e.back !== l.back) { e.load = load; e.back = l.back; e.b.textContent = load; e.classList.toggle('amt', !!load); e.classList.toggle('empty', !!l.back && (!!cash || !!l.round)); e.w = load ? 30 + 7 * load.length : 22; } }
        else if (!l.car && !l.site && !l.claim) { var zs = l.ground ? zshares[l.id.slice(1)] : null, more = l.ground ? C.zoneMark(zs) : l.sub + (ctrends[l.city] || ''); if (e.name !== l.name + more) { e.name = l.name + more; e.style.setProperty('--c', l.color); e.b.textContent = l.name; e.s.textContent = more; e.classList.toggle('good', !!zs && zs.tone === 'good'); e.classList.toggle('bad', !!zs && zs.tone === 'bad'); e.classList.toggle('held', !!zs && zs.share >= 100); e.w = e.offsetWidth; e.h = e.offsetHeight; } }
        // where it stands on the screen and how much it matters: capos first, then names, key places, the family's places, cars
        if (l.role === 'club') { var gone = !!empty[l.city + l.capo]; if (e.gone !== gone) { e.gone = gone; e.classList.toggle('empty', gone); } if (!gone) return; }      // a club is marked by its capo's face, and by its own mark while he is away
        if (l.pop) return;
        if (l.fx) { boxes.push({ id: l.id, rank: 1.5, x: px - 18, y: py - 18, w: 36, h: 36 }); return; }       // a mark of news steps aside for a face, a claim or a street name (the news is also told at the edge of the screen)
        if (l.claim) { boxes.push({ id: l.id, rank: 0.8 + (1 - l.advance) * 0.1, x: px - (e.w || 110) / 2, y: py - 40, w: e.w || 110, h: 40 }); return; }      // of two marks that meet, the one further along stays
        var name = !l.car && !l.site && !l.capo, w = name ? e.w : l.car ? e.w || 22 : l.site ? 22 : 46, h = name ? e.h : l.car ? 22 : w;
        boxes.push({ id: l.id, rank: l.site ? (l.key ? 2 : 3) : l.car ? 4 : l.capo ? 0 : 1, x: px - w / 2, y: py - (name && l.small ? h / 2 : h), w: w, h: h });
      });
      // a label that would sit on a more important one steps aside
      var off = C.crowded(boxes, hiddenLabs); hiddenLabs = off;
      boxes.forEach(function (b) { var e = labs[b.id], o = !!off[b.id]; if (e.off !== o) { e.off = o; e.classList.toggle('off', o); } });
      shown = boxes.filter(function (b) { return !off[b.id]; });
      for (var k in labs) if (!seen[k]) { labs[k].remove(); delete labs[k]; }
    }
  }

  // ---- time
  var CARRIED = { tribute: 1, wash: 1, clean: 1, loot: 1, convoy: 1, arrived: 1, payment: 1, errand: 1 };
  var standing = {};      // where each truck was left after its last delivery: it leaves from there the next time
  function beat() {
    if (!g.started || $('veil').classList.contains('on')) return;       // time waits while the boss reads a sheet
    var before = g.month, events = E.tick(g), turned = g.month !== before;
    showHud();      // the money comes up car by car: the figures at the top follow every day
    if (map && lastPlan) { var pays = M.paysTurf(events, lastPlan); if (pays.length) map.effects(pays); }      // a pay packet rises over its place the day it is paid
    // a car sent for takings leaves the day the rules send it, and its money is counted at the club the day it is home: both are seen
    // on the map at once, with nothing else redrawn
    var home = function (e) { return e.type === 'arrived' && (e.kind === 'takings' || e.kind === 'haul'); };
    if (map && lastPlan) { var runs = M.runsTurf(events, lastPlan).concat(M.haulsTurf(events, lastPlan, standing)); if (runs.length) map.send(runs);
      events.forEach(function (e) { if (e.type === 'arrived' && e.kind === 'haul') standing[e.city + ':' + e.vehicle] = { x: e.x, y: e.y }; }); var got = M.effectsTurf(events.filter(home), lastPlan); if (got.length) map.effects(got); }
    var news = events.filter(function (e) { return e.type !== 'run' && e.type !== 'haul' && e.type !== 'pay' && !home(e); });      // a car that leaves, a pay packet: seen on the map, never news
    events.forEach(function (e) { if (e.type === 'payment' && e.step === 'back') toast('The money comes back to your headquarters: ' + say(e.why || 'nobody is there to take it') + '.', true); });
    var told0 = news.filter(function (e) { return !CARRIED[e.type]; });      // money driven to or from the headquarters: its car is drawn that day, and nothing is said
    var fresh = !live && g.cities.some(function (c) { return (c.hits || []).some(function (h) { return !watched[h.id]; }); });
    if (!turned && !news.length && !live && !fresh) return events;      // a day when nothing happened on the map (a hit that is watched is followed day by day)
    if (!live) C.untold(told0.filter(C.newsworthy), told, g.month).forEach(tell);      // the same alert is not told again month after month
    refresh(events, turned); showHud(); store(); hits(); showLive();      // what a man does is seen the day he does it; the money and the loads change when the month closes
    if (events.some(function (e) { return e.type === 'won'; })) { unwatch(); show(C.won(view, E.hud(g))); return events; }      // the day the game is won is said in full
    if (g.paused && E.hud(g).pending) { stopped = true; requests(); }       // the rules stopped the clock: somebody waits for the boss's word
    return events;
  }

  // ---- start
  if (window.AshportLoad) AshportLoad.file();      // this file is the last one
  [].forEach.call(document.querySelectorAll('[data-ic]'), function (e) { e.innerHTML = I.icon(e.dataset.ic); });
  retire(); g = stored() || E.createGame(); refresh();
  window.__ashport = { game: function () { return g; }, map: function () { return map; }, beat: beat, home: home, view: function () { return view; }, tap: tap, live: function () { return live; } };
  showHud();
  AshportRender.start(g.started ? planOf(g) : planOf(E.createGame({ capo: E.NAMES[0] })), { colors: M.COLORS, onStage: window.AshportLoad && AshportLoad.stage, onTap: tap }).then(function (m) {
    map = m; $('load').remove(); drawLabels();
    if (g.started) { refresh(); map.send(M.ridesTurf(view, lastPlan)); home(); /* the cars that were on their way when the game was left are on their way again */  if (E.hud(g).pending) { stopped = !!g.paused; requests(); } } else show(C.start(E.candidates()));
    if (setAside) toast('Your saved game came from an older version and could not be opened. A new game starts.', true);
    // the game is saved the moment the boss leaves, not only on the days something happens (unless the save is no longer
    // the one this page wrote: a new game was asked for, or another page plays)
    var leaving = function () { var there = null; try { there = localStorage.getItem(SAVE); } catch (e) { /* no storage */ } if (g.started && kept !== null && there === kept) store(); };
    addEventListener('pagehide', leaving); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leaving(); });
    if (!/[?&]manual\b/.test(location.search)) setInterval(beat, TICK_MS);       // tests beat time by hand
  });
})();
