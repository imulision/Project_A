// The screen: it shows what AshportGame says and passes the boss's orders back.
// The sheets themselves are written by sheets.js; this file opens them, draws the labels over the map and keeps time.
// No rule lives here. The map is drawn by render.js from the plan made by mapview.js.
(function () {
  'use strict';
  var G = AshportGame, M = AshportMapView, I = AshportIcons, S = AshportSheets, CAPOS = AshportDistrict.CAPOS;
  var esc = S.esc, money = S.money, capoName = S.capoName, first = S.first, find = S.find, intentOf = S.intentOf, moveIcon = S.moveIcon, CARGO = S.CARGO, WAY = S.WAY, ROLE = S.ROLE;
  var SAVE = 'ashport-save-1', TICK_MS = 1000;
  var $ = function (id) { return document.getElementById(id); };

  var g = null, map = null, labs = {}, marks = {}, taking = {}, tills = {};

  function stored() { try { var t = localStorage.getItem(SAVE); return t ? G.load(t) : null; } catch (e) { return null; } }
  function store() { try { localStorage.setItem(SAVE, G.save(g)); } catch (e) { /* no storage: the game still plays */ } }
  function forget() { try { localStorage.removeItem(SAVE); } catch (e) { /* nothing to forget */ } }

  // ---- the map
  // The map follows the game: buildings, then the cars on the road, then what just happened.
  function showMap(events) {
    if (!map || !g.started) return;
    var p = M.plan(G.view(g)); map.update(p); map.traffic(M.trips(p, G.trips(g))); map.effects(M.effects(events || [], p));
    // what stands over each capo on the map: his face, a gauge of what he is after, and a mark when he waits for an answer
    var asks = {}; G.proposals(g).forEach(function (q) { asks[q.district] = q; }); marks = {}; taking = {};
    (G.takeovers ? G.takeovers(g) : []).forEach(function (t) { taking[t.district] = { sig: t.capo + ':' + t.monthsLeft, sub: first(t.capoName) + ': ' + t.monthsLeft + ' month' + (t.monthsLeft > 1 ? 's' : '') + ' left',
      html: '<span style="color:' + WAY[t.way].color + '">' + I.ring(t.progress, WAY[t.way].icon) + '</span>' }; });
    // the money view: what each place took in or washed last month, and what the capo keeps at his club
    tills = {};
    p.cities.forEach(function (c) { c.districts.forEach(function (d) { if (!d.capo) return;
      var held = { dirty: 0, clean: 0 };
      (G.cash ? G.cash(g, d.id) : []).forEach(function (x) { if (x.at === 'hideout') held[x.kind] = x.amount; else if (x.amount > 0 && (x.kind === 'washing' || !tills[x.at])) tills[x.at] = { kind: x.kind, text: money(x.amount) }; });
      var n = intentOf(d.id), q = asks[d.id];
      marks[d.id] = { ask: !!q, html: I.ring(q ? q.monthsLeft / (q.waits || q.monthsLeft) : n && n.progress != null ? n.progress : 0) + '<span class="pf">' + I.portrait(d.capo) + '</span><span class="do">' + I.icon(q ? q.kind : n ? moveIcon(n.kind) : 'time') + '</span>' +
                        '<span class="till"><b class="dirty">' + money(held.dirty) + '</b><b class="clean">' + money(held.clean) + '</b></span>',
                      tip: q ? q.capoName + ': ' + q.label : n ? capoName(d.capo) + ': ' + n.label : capoName(d.capo) }; }); });
  }
  function previewPlan() { return M.plan(G.view(G.createGame({ capo: Object.keys(CAPOS)[0] }))); }

  // ---- the top of the screen
  function showHud() {
    var h = G.hud(g);
    $('date').textContent = h.date;
    $('dirty').textContent = money(h.dirty); $('clean').textContent = money(h.clean);
    var lm = h.lastMonth, gain = function (n) { return n ? (n > 0 ? '+' : '−') + money(Math.abs(n)) : ''; };
    $('dirty-in').textContent = lm ? gain(lm.dirty) : ''; $('clean-in').textContent = lm ? gain(lm.clean) : '';
    $('named').textContent = h.named + ' / ' + h.maxNamed;
    $('pause').textContent = h.paused ? 'Play' : 'Pause'; $('pause').classList.toggle('on', h.paused);
    $('speed').textContent = h.speed + 'x';
    if (!g.started) return;
    var v = G.view(g), held = 0, total = 0;
    v.cities.forEach(function (c) { total += c.districts.length; held += c.held; });
    $('held').textContent = held + ' / ' + total;
    $('sub').textContent = h.paused ? 'Paused' : 'Your capos are at work';
    $('alerts').innerHTML = (h.promotions ? '<div data-rises="1" style="border-color:var(--accent)">' + I.icon('ambition') + h.promotions + (h.promotions > 1 ? ' men are' : ' man is') + ' up for a rank: choose what he brings</div>' : '') + (h.pending ? '<div data-requests="1" style="border-color:var(--accent)">' + h.pending + (h.pending > 1 ? ' capos wait' : ' capo waits') + ' for your answer</div>' : '') + h.alerts.slice(0, 2).map(function (a) { return '<div data-district="' + esc(a.district) + '">' + I.icon(/police|raid/i.test(a.text) ? 'heat' : /hit|attack/i.test(a.text) ? 'attack' : 'time') + esc(a.text) + '</div>'; }).join('');
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
  function order(c) { var r = G.command(g, c); if (!r.ok) toast(r.error, true); else { showMap(); showHud(); store(); } return r.ok; }

  function tip(el, html) {
    var t = $('tip'), r = el.getBoundingClientRect(); t.innerHTML = html || esc(el.dataset.tip); t.classList.add('on');
    var w = t.offsetWidth, x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - t.offsetHeight - 8;
    t.style.left = x + 'px'; t.style.top = (y < 8 ? r.bottom + 8 : y) + 'px';
    clearTimeout(tip.t); tip.t = setTimeout(function () { t.classList.remove('on'); }, 3200);
  }
  document.addEventListener('click', function (e) { var el = e.target.closest('[data-tip]'); if (el) tip(el); else $('tip').classList.remove('on'); }, true);

  // What the capo of a district is after, from the rules when they say it, else from his last move in the journal.
  $('sheet').addEventListener('click', function (e) {
    var seg = e.target.closest('[data-skill]');
    if (seg) { [].forEach.call($('sheet').querySelectorAll('.sel'), function (x) { x.classList.remove('sel'); }); seg.classList.add('sel'); $('skill').innerHTML = S.skill(seg.dataset.skill); return; }
    var know = e.target.closest('[data-know]');
    if (know) { [].forEach.call($('sheet').querySelectorAll('.know'), function (x) { x.classList.toggle('sel', x === know); }); $('know').innerHTML = S.know(know.dataset.know); return; }
    var face = e.target.closest('[data-face]');
    if (face) { [].forEach.call($('sheet').querySelectorAll('.facebtn'), function (x) { x.classList.toggle('on', x === face); });
      $('who').innerHTML = S.man(face.dataset.face); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.dataset.act;
    if (act === 'close') close();
    else if (act === 'start') { if (order({ type: 'start', capo: b.dataset.capo })) { close(); map.focus('ashport'); toast(capoName(b.dataset.capo) + ' holds Hillside. Tap a district to see it.'); } }
    else if (act === 'pick') show(S.pick(b.dataset.order, b.dataset.district, b.dataset.way));
    else if (act === 'research') { if (order({ type: 'research', ability: b.dataset.ability })) { show(S.family()); $('skill').innerHTML = S.skill(b.dataset.key); } }
    else if (act === 'learn') { var top = $('sheet').scrollTop; if (order({ type: 'research', building: b.dataset.building })) { show(S.family()); $('know').innerHTML = S.know(b.dataset.building); $('sheet').scrollTop = top; } }
    else if (act === 'promote') { if (order({ type: 'promote', capo: b.dataset.capo, ability: b.dataset.ability })) show(S.promotions()); }
    else if (act === 'new') { forget(); location.reload(); }
    else if (act === 'approve' || act === 'refuse') { if (order({ type: act, id: b.dataset.id })) show(S.proposals()); }
    else { var parts = act.split(':'); if (order({ type: parts[0], district: parts[1], way: parts[2], capo: b.dataset.capo })) { close(); toast(first(capoName(b.dataset.capo)) + (parts[0] === 'takeover' ? ' sets out to take ' + find(parts[1]).d.name + '.' : parts[0] === 'claim' ? ' moves in.' : ' takes over.')); } }
  });
  $('veil').addEventListener('click', function (e) { if (e.target === $('veil') && g.started) close(); });
  $('alerts').addEventListener('click', function (e) { if (e.target.closest('[data-requests]')) return show(S.proposals()); if (e.target.closest('[data-rises]')) return show(S.promotions());
    var a = e.target.closest('[data-district]'); if (a) { map.focus(a.dataset.district.split('-')[0], a.dataset.district); show(S.district(a.dataset.district)); } });
  $('map').onclick = function () { if (map) map.focus(null); };
  $('pause').onclick = function () { if (g.started) { G.command(g, { type: g.paused ? 'resume' : 'pause' }); showHud(); } };
  $('speed').onclick = function () { var s = G.SPEEDS; G.command(g, { type: 'speed', value: s[(s.indexOf(g.speed) + 1) % s.length] }); showHud(); };
  // the meter: touch the images-per-second figure for the full reading (draw calls, triangles, resolution, cars, labels, WebGPU on this device)
  function meter() { if (!map || !$('fps').classList.contains('on')) return; var s = map.stats();
    $('fps').textContent = (window.__fps || 0) + ' fps · ' + s.calls + ' draws · ' + (s.tris / 1000).toFixed(0) + 'k tris · x' + s.pr + ' · ' + s.cars + ' cars · ' + document.querySelectorAll('.lab').length + ' labels · webgpu ' + (navigator.gpu ? 'yes' : 'no'); }
  $('fps').onclick = function () { var on = $('fps').classList.toggle('on'); if (on) meter(); else $('fps').textContent = (window.__fps || 0) + ' fps'; };
  setInterval(meter, 1000);
  $('money').onclick = function () { var on = document.body.classList.toggle('money'); $('money').classList.toggle('on', on);
    if (on) toast('Money view: what each place took in last month, in blue what the laundries washed, and what each capo keeps at his club.'); };
  $('family').onclick = function () { if (g.started) show(S.family()); };
  $('journal').onclick = function () { if (g.started) show(S.journal()); };

  // ---- labels over the map: names, the capos where they sit, what each car carries, and a gauge where something happens
  var FX = { fire: ['attack', 'Fire: rivals burnt a place of yours'], gunfire: ['muscle', 'Gunfire'], police: ['heat', 'Police raid'], promotion: ['ambition', 'A man of yours rose in rank'] };
  function tapLabel(l, e) {
    if (l.car) tip(e, S.carTip(l.car));
    else if (l.site) return;
    else if (l.capo) { var m = marks[l.district]; if (m && m.ask) show(S.proposals()); else show(S.district(l.district)); }
    else if (l.district) show(S.district(l.district)); else if (l.city) map.focus(l.city);
  }
  var MOVE = 'translate' in document.documentElement.style;
  function drawLabels() {
    if (map) {
      var seen = {};
      map.labels().forEach(function (l) {
        seen[l.id] = 1; var e = labs[l.id];
        if (!e) {
          e = labs[l.id] = document.createElement('div');
          if (l.fx) { e.className = 'lab fx ' + l.fx; e.dataset.tip = (FX[l.fx] || ['time', l.fx])[1]; e.innerHTML = I.ring(1, (FX[l.fx] || ['time'])[0]); e.arc = e.querySelectorAll('circle')[1]; }
          else if (l.car) { var k = CARGO[l.car.cargo] || { icon: l.car.vehicle, color: '#e8c463' }; e.className = 'lab tag' + (/takings|laundering|tribute/.test(l.car.cargo) ? ' m' : ''); e.style.setProperty('--c', k.color); e.innerHTML = I.icon(k.icon); }
          else if (l.capo) e.className = 'lab capo';
          else if (l.site) { e.className = 'lab pin' + (l.role === 'laundering' ? ' wash' : ''); e.innerHTML = I.icon(l.site) + '<b></b>'; e.dataset.tip = l.name + ': ' + (ROLE[l.role] || '') + (l.level > 1 ? ', level ' + l.level : ''); }
          else { e.className = 'lab' + (l.small ? ' sm' : ''); e.innerHTML = '<i class="tkr"></i><b></b><span></span>'; e.r = e.firstChild; e.b = e.children[1]; e.s = e.lastChild; }
          if (!l.fx) e.onclick = function (ev) { ev.stopPropagation(); tapLabel(e.l, e); };
          $('labels').appendChild(e);
        }
        // a label is moved by the compositor alone, and only when it has moved by a whole pixel: no layout of the page per frame
        var px = Math.round(l.x), py = Math.round(l.y - (l.fx ? ({ fire: 0, gunfire: 40, police: 80, promotion: 120 }[l.fx] || 0) : 0));
        e.l = l; if (e.px !== px || e.py !== py) { e.px = px; e.py = py; if (MOVE) e.style.translate = px + 'px ' + py + 'px'; else { e.style.left = px + 'px'; e.style.top = py + 'px'; } }
        if (l.fx) { var left = (94.25 * (1 - (l.part || 0))).toFixed(0); if (e.left !== left) { e.left = left; e.arc.setAttribute('stroke-dasharray', left + ' 94.25'); } }
        else if (l.capo) { var m = marks[l.district]; if (m && e.mark !== m.html) { e.mark = m.html; e.innerHTML = m.html; e.classList.toggle('ask', m.ask); } }
        else if (l.site) { var c = tills[l.id.slice(1)], sig = c ? c.kind + c.text : ''; if (e.sig !== sig) { e.sig = sig; e.lastChild.textContent = c ? c.text : ''; e.classList.toggle('washing', !!c && c.kind === 'washing'); e.classList.toggle('dry', !c); } }
        else if (!l.car && !l.site) { var t = l.district && taking[l.district]; e.style.setProperty('--c', l.color); e.b.textContent = l.name; e.s.textContent = t ? t.sub : l.sub;
          if ((t ? t.sig : '') !== (e.tk || '')) { e.tk = t ? t.sig : ''; e.r.innerHTML = t ? t.html : ''; e.classList.toggle('tk', !!t); } }
      });
      for (var k in labs) if (!seen[k]) { labs[k].remove(); delete labs[k]; }
    }
    requestAnimationFrame(drawLabels);
  }

  // ---- time
  function beat() {
    if (!g.started || $('veil').classList.contains('on')) return;       // time waits while the boss reads a sheet
    var before = g.world.month, events = G.tick(g);
    if (g.world.month === before) return;
    events.forEach(function (e) { if (e.type === 'attack' || e.type === 'raid' || e.type === 'job' || e.type === 'promotion' || e.type === 'takeover' || e.type === 'unpaid-wage') toast(e.label + (e.effects && e.effects.length ? ' · ' + e.effects.join(' · ') : ''), e.type === 'attack' || e.type === 'raid' || e.type === 'unpaid-wage' || e.outcome === 'failed'); });
    showMap(events); showHud(); store();
    var rises = G.hud(g).promotions || 0;
    if (events.some(function (e) { return e.type === 'proposal'; })) show(S.proposals());      // time waits for the boss's word
    else if (rises > (beat.rises || 0)) show(S.promotions());
    beat.rises = rises;
  }

  // ---- start
  [].forEach.call(document.querySelectorAll('[data-ic]'), function (e) { e.innerHTML = I.icon(e.dataset.ic); });
  g = stored() || G.createGame(); S.use(g);
  window.__ashport = { game: function () { return g; }, map: function () { return map; }, beat: beat };
  showHud();
  AshportRender.start(g.started ? M.plan(G.view(g)) : previewPlan(), {
    colors: M.COLORS,
    onTap: function (hit) { if (!hit || !g.started) return; if (hit.near && hit.district) show(S.district(hit.district)); else map.focus(hit.city); }
  }).then(function (m) {
    map = m; $('load').remove(); drawLabels();
    if (g.started) { showMap(); map.focus('ashport'); } else show(S.start());
    if (!/[?&]manual\b/.test(location.search)) setInterval(beat, TICK_MS);       // tests beat time by hand
  });
})();
