// The new screen: the cities block by block. It shows what AshportEmpire says and passes the boss's orders back.
// The sheets are written by cards.js; this file opens them, draws the labels over the map and keeps time.
// No rule lives here. The map is drawn by render.js from the plan made by mapview.js (planEmpire).
(function () {
  'use strict';
  var E = AshportEmpire, M = AshportMapView, I = AshportIcons, C = AshportCards, T = AshportTurf, W = AshportWorld;
  var SAVE = 'ashport-city-3', TICK_MS = 1000;
  var $ = function (id) { return document.getElementById(id); };
  var say = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };

  var g = null, map = null, view = null, labs = {}, waits = {}, picking = null, stopped = false;

  // A saved game is kept only if today's rules and today's screen can read all of it: otherwise it is set aside
  // (kept under another name) and the player is told. Never a dead screen at the door.
  var setAside = false;
  function stored() {
    var t = null;
    try { t = localStorage.getItem(SAVE); if (!t) return null; var s = E.load(t), v = E.view(s), h = E.hud(s); M.planEmpire(v, W.CITIES); C.requests(v, h); C.family(v, h); C.journal(s.journal);
      v.cities.forEach(function (c) { C.city(v, c.id); c.capos.forEach(function (k) { C.capo(v, c.id, k.id); }); }); return s; }
    catch (e) { if (t) { setAside = true; try { localStorage.setItem(SAVE + '-unreadable', t); localStorage.removeItem(SAVE); } catch (x) { /* no storage */ } } return null; }
  }
  // The first version of the game (by districts) saved under another key: that game is not continued. It is kept aside, and the player is told once.
  var OLD = 'ashport-save-1';
  function retire() { try { var t = localStorage.getItem(OLD); if (!t) return; localStorage.setItem(OLD + '-unreadable', t); localStorage.removeItem(OLD); setAside = true; } catch (e) { /* no storage */ } }
  function store() { try { localStorage.setItem(SAVE, E.save(g)); } catch (e) { /* no storage: the game still plays */ } }
  function forget() { try { localStorage.removeItem(SAVE); } catch (e) { /* nothing to forget */ } }

  // ---- the map follows the game: buildings and streets, then the cars, then what just happened
  function planOf(game) { return M.planEmpire(E.view(game), W.CITIES); }
  var lastPlan = null;
  var strainAt = {};      // the family's places that choke, by city and block: the map marks them
  function refresh(events) {
    view = E.view(g);
    if (!g.started) return;
    waits = {};
    view.cities.forEach(function (c) { c.asks.forEach(function (a) { waits[c.id + a.capo] = 1; }); c.feuds.forEach(function (f) { waits[c.id + f.a] = waits[c.id + f.b] = 1; }); });
    strainAt = C.strains(view);
    if (!map) return;
    var p = M.planEmpire(view, W.CITIES); map.update(p); map.traffic(M.tripsTurf(p, view).concat(M.movesTurf(lastPlan, p), events ? M.convoysTurf(p, T.convoys(g.family)) : []));      // (what left for the next city last month is seen once, when the month turns) map.effects(M.effectsTurf(events || [], p));
    lastPlan = p;      // a capo who is not where he was last month drives there, once
  }
  function zoneId(cityId, x, y) { var c = view.cities.filter(function (q) { return q.id === cityId; })[0], n = 0;
    if (c) c.zones.forEach(function (z, i) { if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) n = i; }); return cityId + '-' + n; }
  function home() { var c = view.cities.filter(function (q) { return q.held; })[0], k = c && c.capos[0]; if (k) map.focus(c.id, zoneId(c.id, k.x, k.y)); else map.focus(null); }

  // ---- the top of the screen
  // what last month did to a total, beside it: green when it grew, red when it shrank
  function delta(id, n) { var e = $(id), t = C.change(n); if (e.textContent !== t) { e.textContent = t; e.classList.toggle('bad', n < 0); } }
  function showHud() {
    var h = E.hud(g);
    $('date').textContent = h.date;
    $('pause').textContent = h.paused ? 'Play' : 'Pause'; $('pause').classList.toggle('on', !!h.paused);
    $('speed').textContent = h.speed + 'x';
    if (!h.started) return;
    $('dirty').textContent = C.money(h.dirty); $('clean').textContent = C.money(h.clean);
    delta('dirtyd', (h.change || {}).dirty); delta('cleand', (h.change || {}).clean);
    $('share').textContent = h.share + '%'; $('cities').textContent = h.cities.held + ' / ' + h.cities.total;
    $('men').textContent = h.men + ' / ' + h.seats.total;
    $('heat').innerHTML = I.icon('heat') + Math.round(h.heat);
    var w = C.wash(view, h), k = C.clock(h, !!picking);
    $('wash').textContent = w.line; $('kept').textContent = w.washed > 0 ? 'washed ' + C.money(w.washed) : '';
    $('dirty').parentNode.classList.toggle('hot', w.hot);
    // time that stands still is said in large, with the reason, and framed all around the screen
    document.body.classList.toggle('stopped', !!k); if (map) map.hold(!!k);
    $('sub').textContent = k ? '' : 'Your capos are at work';
    $('clock').innerHTML = k ? '<b>' + I.icon('time') + k.word + '</b><span>' + C.esc(k.why) + '</span>' : '';
    $('clock').dataset.go = picking ? '' : h.pending ? 'requests' : 'play';
    $('alerts').innerHTML = picking ? '<div class="pick">' + I.icon('hideout') + '<span>Tap the street where ' + C.esc(C.first(C.nameOf(picking.capo))) + ' opens his club: one of the lit streets.</span><button data-unpick="1">Cancel</button></div>'
      : (h.pending && !h.paused ? '<div data-requests="1" style="border-color:var(--accent)">' + I.icon('time') + h.pending + (h.pending > 1 ? ' wait' : ' waits') + ' for your word: tap to answer</div>' : '') +
        (w.hot ? '<div>' + I.icon('heat') + 'Over ' + C.money(T.RULES.stash) + ' of dirty cash: the police take notice. It needs washing.</div>' : '');
  }
  function toast(text, bad) {
    var e = document.createElement('div'); e.textContent = text; if (bad) e.className = 'bad';
    $('toast').appendChild(e); while ($('toast').children.length > 3) $('toast').firstChild.remove();
    setTimeout(function () { e.remove(); }, 6000);
  }

  // ---- sheets
  function open(html) { $('sheet').innerHTML = html; $('veil').classList.add('on'); $('sheet').scrollTop = 0; }
  function close() { $('veil').classList.remove('on'); }
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

  // A bubble beside what was touched. With `more`, a touch on the bubble itself opens the whole page.
  function tip(el, html, more) {
    var t = $('tip'), r = el.getBoundingClientRect(); t.innerHTML = (html || C.esc(el.dataset.tip)) + (more ? '<i class="more">\u203a</i>' : ''); t.classList.add('on'); t.classList.toggle('more', !!more); tip.more = more || null;
    var w = t.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - t.offsetHeight - 8;
    t.style.left = x + 'px'; t.style.top = (y < 8 ? r.bottom + 8 : y) + 'px';
    tip.at = Date.now(); clearTimeout(tip.t); tip.t = setTimeout(untip, more ? 6000 : 3200);
  }
  function untip() { $('tip').classList.remove('on', 'more'); tip.more = null; }
  function at(x, y) { return { getBoundingClientRect: function () { return { left: x, top: y - 16, width: 0, height: 32, bottom: y + 16 }; } }; }
  function fresh() { return Date.now() - (tip.at || 0) <= 450; }      // the click a phone sends after a touch does not close what that touch opened
  document.addEventListener('click', function (e) {
    if (e.target.closest('#tip')) { var m = tip.more; untip(); if (m) m(); return; }
    var el = e.target.closest('[data-tip]'); if (el) tip(el); else if (!fresh()) untip();
  }, true);
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('#tip') && !fresh()) untip(); }, true);

  // While a club is being placed, the streets where it can open are lit on the ground.
  function spotsOf(city) { var raw = g.cities.filter(function (q) { return q.id === city; })[0]; return raw ? T.spots(raw) : []; }
  function pick(from, city, capo) { picking = { from: from, city: city, capo: capo }; close();
    var list = spotsOf(city), c = view.cities.filter(function (q) { return q.id === city; })[0], k = c && c.capos[0], best = null;
    // the camera goes to the lit streets nearest the family's first club; in a city where it has nobody, to the whole city
    if (k) list.forEach(function (s) { var d = Math.abs(s.x - k.x) + Math.abs(s.y - k.y); if (!best || d < best.d) best = { d: d, s: s }; });
    map.spots(city, list); if (best) map.focus(city, zoneId(city, best.s.x, best.s.y)); else map.focus(city); showHud(); }
  function unpick() { picking = null; map.spots(); }
  $('sheet').addEventListener('click', function (e) {
    var face = e.target.closest('[data-face]');
    if (face) { [].forEach.call($('sheet').querySelectorAll('.facebtn'), function (x) { x.classList.toggle('on', x === face); });
      $('who').innerHTML = C.man(E.candidates().filter(function (c) { return c.id === face.dataset.face; })[0], 'start', 'Start with'); return; }
    var know = e.target.closest('[data-know]');
    if (know) { [].forEach.call($('sheet').querySelectorAll('.know'), function (x) { x.classList.toggle('sel', x === know); }); $('know').innerHTML = C.know(view, know.dataset.know, E.hud(g)); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.dataset.act, d = b.dataset;
    if (act === 'close') close();
    else if (act === 'later') { close(); stopped = false; if (g.paused) E.command(g, { type: 'resume' }); showHud(); }      // he leaves them waiting: time goes on
    else if (act === 'start') { if (order({ type: 'start', capo: d.capo })) { close(); home(); toast(C.first(C.nameOf(d.capo)) + ' opens his club in Ashport. Tap a street to see it.'); } }
    else if (act === 'answer') { if (order({ type: 'answer', city: d.city, id: d.id, yes: d.yes === '1' })) answered(); }
    else if (act === 'rule') { if (order({ type: 'rule', city: d.city, id: d.id, winner: d.winner })) answered(); }
    else if (act === 'welcome') { if (order({ type: 'welcome', city: d.city, from: d.from, capo: d.capo })) { toast(C.first(C.nameOf(d.capo)) + ' is one of yours now.'); answered(); } }
    else if (act === 'seat') pick(d.city, d.city, d.capo);
    else if (act === 'road') pick(d.from, d.city, d.capo);
    else if (act === 'capo') show(C.capo(view, d.city, d.capo));
    else if (act === 'parting') show(C.parting(view, d.city, d.capo, d.way));
    else if (act === 'part') { if (order({ type: 'part', city: d.city, capo: d.capo, way: d.way })) { close(); toast(g.journal[g.journal.length - 1].label, true); } }
    else if (act === 'city') show(C.city(view, d.city));
    else if (act === 'focus') { close(); map.focus(d.city); }
    else if (act === 'show') { close(); map.focus(d.city, zoneId(d.city, +d.x, +d.y)); }
    else if (act === 'research') { var top = $('sheet').scrollTop; if (order({ type: 'research', building: d.building })) { show(C.family(view, E.hud(g))); $('know').innerHTML = C.know(view, d.building, E.hud(g)); $('sheet').scrollTop = top; } }
    else if (act === 'new') { forget(); location.reload(); }
  });
  // A touch beside the sheet closes it, but only a touch that began there: the click a phone sends after the touch
  // that opened the sheet lands on the veil too, and must not close what it has just opened.
  var veilDown = false;
  $('veil').addEventListener('pointerdown', function (e) { veilDown = e.target === $('veil'); });
  $('veil').addEventListener('click', function (e) { var mine = veilDown; veilDown = false; if (mine && e.target === $('veil') && g.started) close(); });
  $('alerts').addEventListener('click', function (e) { if (e.target.closest('[data-unpick]')) { unpick(); showHud(); requests(); } else if (e.target.closest('[data-requests]')) requests(); });
  $('map').onclick = function () { if (map) map.focus(null); };
  $('clock').onclick = function () { var go = $('clock').dataset.go; if (go === 'requests') requests(); else if (go === 'play') $('pause').click(); };
  $('pause').onclick = function () { if (!g.started) return; stopped = false; E.command(g, { type: g.paused ? 'resume' : 'pause' }); showHud(); };
  $('speed').onclick = function () { if (!g.started) return; var s = E.SPEEDS; E.command(g, { type: 'speed', speed: s[(s.indexOf(g.speed) + 1) % s.length] }); showHud(); };
  $('family').onclick = function () { if (g.started) show(C.family(view, E.hud(g))); };
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
    if (e && !(picking && !e.l.car && !e.l.fx)) return tapLabel(e.l, e);
    if (!hit) return;
    var c = view.cities.filter(function (q) { return q.id === hit.city; })[0], inside = c && hit.bx >= 0 && hit.by >= 0 && hit.bx < c.w && hit.by < c.h;
    if (picking) {
      if (hit.city !== picking.city || !hit.near || !inside) return map.focus(picking.city, inside && hit.city === picking.city ? zoneId(hit.city, hit.bx, hit.by) : undefined);
      if (!spotsOf(picking.city).some(function (s) { return s.x === hit.bx && s.y === hit.by; })) return toast('He cannot open there: pick one of the lit streets.', true);
      var who = picking.capo;
      if (order({ type: 'welcome', city: picking.city, from: picking.from, capo: who, x: hit.bx, y: hit.by })) { unpick(); toast(g.journal[g.journal.length - 1].label + '.'); answered(); }
      return;
    }
    if (!hit.near || !inside) return map.focus(hit.city, inside ? zoneId(hit.city, hit.bx, hit.by) : undefined);
    said(hit.city, hit.bx, hit.by, at(x == null ? innerWidth / 2 : x, y == null ? innerHeight / 2 : y));
  }
  // a touched street or place answers with a bubble; the bubble leads to its page
  function said(city, bx, by, el) { var h = C.blockTip(view, city, bx, by); if (h) tip(el, h, function () { show(C.block(view, city, bx, by)); }); }

  // ---- labels over the map: names, the capos over their clubs, a mark on the places that count, what each car carries
  var FX = C.FX;
  function tapLabel(l, e) {
    if (l.fx) tip(e, C.fxTip(l.fx, l.say));
    else if (l.car) tip(e, C.carTip(l.car, l.round && l.back));
    else if (picking) return;
    else if (l.site) said(l.city, l.bx, l.by, e);
    else if (l.capo) { if (waits[l.city + l.capo]) requests(); else show(C.capo(view, l.city, l.capo)); }
    else if (l.city && !l.ground) { if (map.stats().moving) return; map.focus(l.city); }
  }
  var MOVE = 'translate' in document.documentElement.style;
  var hiddenLabs = {};      // the labels that had stepped aside at the last image: none blinks at the edge of another
  var drawnAt = -1;
  function drawLabels() {
    // the labels follow the map: while it draws nothing new (time stopped, camera still), they stay as they are
    var drawn = map ? map.stats().drawn : -1;
    if (map && drawn !== drawnAt) { drawnAt = drawn;
      var seen = {}, boxes = [], badges = [];
      map.labels().forEach(function (l) {
        seen[l.id] = 1; var e = labs[l.id];
        if (!e) {
          e = labs[l.id] = document.createElement('div');
          if (l.fx) { e.className = 'lab fx ' + l.fx; e.dataset.tip = (FX[l.fx] || ['time', l.fx])[1]; e.innerHTML = I.ring(1, (FX[l.fx] || ['time'])[0]); e.arc = e.querySelectorAll('circle')[1]; }
          else if (l.car) { e.className = 'lab tag'; e.innerHTML = '<span></span><b></b>'; e.pic = e.firstChild; e.b = e.lastChild; }
          else if (l.site) { e.className = 'lab pin' + (l.role === 'club' ? ' club' : l.owner !== 'family' ? ' theirs' : l.role === 'laundering' ? ' wash' : ''); e.innerHTML = I.icon(C.iconName(l.key || l.site)); }
          else if (l.capo) e.className = 'lab capo';
          else { e.className = 'lab' + (l.small ? ' sm' : ''); e.innerHTML = '<b></b><span></span>'; e.b = e.firstChild; e.s = e.lastChild; }
          $('labels').appendChild(e);
        }
        // a label is moved by the compositor alone, and only when it has moved by a whole pixel: no layout of the page per frame
        var px = Math.round(l.x), py = Math.round(l.y - (l.fx ? ({ fire: 0, gunfire: 40, police: 80, promotion: 120 }[l.fx] || 0) : 0));
        e.l = l; if (e.px !== px || e.py !== py) { e.px = px; e.py = py; if (MOVE) e.style.translate = px + 'px ' + py + 'px'; else { e.style.left = px + 'px'; e.style.top = py + 'px'; } }
        if (l.fx) { var left = (94.25 * (1 - (l.part || 0))).toFixed(0); if (e.left !== left) { e.left = left; e.arc.setAttribute('stroke-dasharray', left + ' 94.25'); } }
        else if (l.site) { var st = strainAt[l.city + ':' + l.bx + ',' + l.by], ss = st ? st.join() : ''; if ((e.st || '') !== ss) { e.st = ss; e.classList.toggle('strain', !!ss); if (!e.warn) { e.warn = document.createElement('span'); e.warn.className = 'warn'; e.appendChild(e.warn); } e.warn.innerHTML = C.strainBadge(st); } }
        else if (l.capo && !l.site) { var ask = !!waits[l.city + l.capo], sig = [l.move, l.kind, l.way, Math.round((l.progress || 0) * 20), ask].join();
          if (e.sig !== sig) { e.sig = sig; e.innerHTML = C.mark(l); e.classList.toggle('ask', ask); } }
        else if (l.car) { var h = C.haul(l.car); if (e.what !== h[0]) { e.what = h[0]; e.style.setProperty('--c', h[1]); e.pic.innerHTML = I.icon(h[0]); }      // a truck may haul liquor on one leg and crates on the next
          var cash = C.carLoad(l.car), load = l.back ? '' : cash; if (e.load !== load || e.back !== l.back) { e.load = load; e.back = l.back; e.b.textContent = load; e.classList.toggle('amt', !!load); e.classList.toggle('empty', !!l.back && (!!cash || !!l.round)); e.w = load ? 30 + 7 * load.length : 22; } }
        else if (!l.car && !l.site) { if (e.name !== l.name + l.sub) { e.name = l.name + l.sub; e.style.setProperty('--c', l.color); e.b.textContent = l.name; e.s.textContent = l.sub; e.w = e.offsetWidth; e.h = e.offsetHeight; } }
        // where it stands on the screen and how much it matters: capos first, then names, key places, the family's places, cars
        if (l.role === 'club') return;
        if (l.fx) { badges.push({ id: l.id, rank: 0.5, x: px - 18, y: py - 18, w: 36, h: 36 }); return; }       // a badge never steps aside, and it answers the finger
        var name = !l.car && !l.site && !l.capo, w = name ? e.w : l.car ? e.w || 22 : l.site ? 22 : 46, h = name ? e.h : l.car ? 22 : w;
        boxes.push({ id: l.id, rank: l.site ? (l.key ? 2 : 3) : l.car ? 4 : l.capo ? 0 : 1, x: px - w / 2, y: py - (name && l.small ? h / 2 : h), w: w, h: h });
      });
      // a label that would sit on a more important one steps aside
      var off = C.crowded(boxes, hiddenLabs); hiddenLabs = off;
      boxes.forEach(function (b) { var e = labs[b.id], o = !!off[b.id]; if (e.off !== o) { e.off = o; e.classList.toggle('off', o); } });
      shown = boxes.filter(function (b) { return !off[b.id]; }).concat(badges);
      for (var k in labs) if (!seen[k]) { labs[k].remove(); delete labs[k]; }
    }
    requestAnimationFrame(drawLabels);
  }

  // ---- time
  var LOUD = { hijack: 1, seizure: 1, truck: 0, burnt: 1, bust: 1, unpaid: 1, taken: 0, rank: 0, learned: 0, repelled: 0, car: 0 };
  function beat() {
    if (!g.started || picking || $('veil').classList.contains('on')) return;       // time waits while the boss reads a sheet or chooses a street
    var before = g.month, events = E.tick(g);
    if (g.month === before) return;
    events.forEach(function (e) { if (e.type in LOUD) toast(e.label, !!LOUD[e.type]); });
    refresh(events); showHud(); store();
    if (g.paused && E.hud(g).pending) { stopped = true; requests(); }       // the rules stopped the clock: somebody waits for the boss's word
  }

  // ---- start
  if (window.AshportLoad) AshportLoad.file();      // this file is the last one
  [].forEach.call(document.querySelectorAll('[data-ic]'), function (e) { e.innerHTML = I.icon(e.dataset.ic); });
  retire(); g = stored() || E.createGame(); refresh();
  window.__ashport = { game: function () { return g; }, map: function () { return map; }, beat: beat, home: home, view: function () { return view; }, tap: tap, picking: function () { return picking; } };
  showHud();
  AshportRender.start(g.started ? planOf(g) : planOf(E.createGame({ capo: E.NAMES[0] })), { colors: M.COLORS, onStage: window.AshportLoad && AshportLoad.stage, onTap: tap }).then(function (m) {
    map = m; $('load').remove(); drawLabels();
    if (g.started) { refresh(); home(); if (E.hud(g).pending) { stopped = !!g.paused; requests(); } } else show(C.start(E.candidates()));
    if (setAside) toast('Your saved game came from an older version and could not be opened. A new game starts.', true);
    if (!/[?&]manual\b/.test(location.search)) setInterval(beat, TICK_MS);       // tests beat time by hand
  });
})();
