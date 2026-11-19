// The screen: it shows what AshportGame says and passes the boss's orders back.
// No rule lives here. The map is drawn by render.js from the plan made by mapview.js.
(function () {
  'use strict';
  var G = AshportGame, M = AshportMapView, CAPOS = AshportDistrict.CAPOS;
  var SAVE = 'ashport-save-1', TICK_MS = 1000;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var capoName = function (id) { return id && CAPOS[id] ? CAPOS[id].name : 'Nobody'; };

  var g = null, map = null, labs = {};

  function stored() { try { var t = localStorage.getItem(SAVE); return t ? G.load(t) : null; } catch (e) { return null; } }
  function store() { try { localStorage.setItem(SAVE, G.save(g)); } catch (e) { /* no storage: the game still plays */ } }
  function forget() { try { localStorage.removeItem(SAVE); } catch (e) { /* nothing to forget */ } }

  // ---- the map
  // The map follows the game: buildings, then the cars on the road, then what just happened.
  function showMap(events) {
    if (!map || !g.started) return;
    var p = M.plan(G.view(g)); map.update(p); map.traffic(M.trips(p, G.trips(g))); map.effects(M.effects(events || [], p));
  }
  function previewPlan() { return M.plan(G.view(G.createGame({ capo: Object.keys(CAPOS)[0] }))); }

  // ---- the top of the screen
  function showHud() {
    var h = G.hud(g);
    $('date').textContent = h.date;
    $('dirty').textContent = money(h.dirty); $('clean').textContent = money(h.clean);
    $('named').textContent = h.named + ' / ' + h.maxNamed;
    $('pause').textContent = h.paused ? 'Play' : 'Pause'; $('pause').classList.toggle('on', h.paused);
    $('speed').textContent = h.speed + 'x';
    if (!g.started) return;
    var v = G.view(g), held = 0, total = 0;
    v.cities.forEach(function (c) { total += c.districts.length; held += c.held; });
    $('held').textContent = held + ' / ' + total;
    $('sub').textContent = h.paused ? 'Paused' : 'Your capos are at work';
    $('alerts').innerHTML = (h.pending ? '<div data-requests="1" style="border-color:var(--accent)">' + h.pending + (h.pending > 1 ? ' capos wait' : ' capo waits') + ' for your answer</div>' : '') + h.alerts.slice(0, 2).map(function (a) { return '<div data-district="' + esc(a.district) + '">' + esc(a.text) + '</div>'; }).join('');
  }
  function toast(text, bad) {
    var e = document.createElement('div'); e.textContent = text; if (bad) e.className = 'bad';
    $('toast').appendChild(e); while ($('toast').children.length > 3) $('toast').firstChild.remove();
    setTimeout(function () { e.remove(); }, 6000);
  }

  // ---- sheets
  function open(html) { $('sheet').innerHTML = html; $('veil').classList.add('on'); $('sheet').scrollTop = 0; }
  function close() { $('veil').classList.remove('on'); }
  function order(c) { var r = G.command(g, c); if (!r.ok) toast(r.error, true); else { showMap(); showHud(); store(); } return r.ok; }

  function card(c, action, label) {
    var s = c.stats;
    return '<div class="card"><h3>' + esc(c.name) + '</h3><div class="who">' + esc(c.specialty) + '</div>' +
      '<div class="st">Muscle ' + s.muscle + ' · Business ' + s.business + ' · Cunning ' + s.cunning + ' · Charisma ' + s.charisma + ' · Loyalty ' + s.loyalty + ' · Ambition ' + s.ambition + '</div>' +
      '<div class="st">Likes: ' + esc(c.likes.join(', ') || 'nothing in particular') + '<br>Refuses: ' + esc(c.refuses.join(', ') || 'nothing') + '</div>' +
      (c.firstMove ? '<div class="mv">First move: ' + esc(c.firstMove) + '</div>' : '') +
      '<button class="go" data-act="' + action + '" data-capo="' + esc(c.id) + '">' + esc(label) + '</button></div>';
  }
  // Before the game starts nobody is named yet, so the cards come from two throwaway games.
  function firstCandidates() {
    var ids = Object.keys(CAPOS), a = G.candidates(G.createGame({ capo: ids[0] }), 'ashport-hillside'), b = G.candidates(G.createGame({ capo: ids[1] }), 'ashport-hillside');
    return b.filter(function (c) { return c.id === ids[0]; }).concat(a);
  }
  function sheetStart() {
    open('<h2>Hillside needs a capo</h2><p>You are the boss. You never act yourself: you choose who runs your streets, and he runs them his way. Name the man who holds Hillside, in Ashport.</p>' +
      firstCandidates().map(function (c) { return card(c, 'start', 'Name ' + c.name.split(' ')[0]); }).join(''));
  }
  function find(id) {
    var out = null;
    G.view(g).cities.forEach(function (c) { c.districts.forEach(function (d) { if (d.id === id) out = { city: c, d: d }; }); });
    return out;
  }
  // Last month in figures: what was made, sold, earned, washed and sent up to the boss.
  function flowRows(id) {
    var f = G.flows(g, id); if (!f) return '';
    var cell = function (label, value) { return '<div><small>' + label + '</small><b>' + value + '</b></div>'; };
    return '<div class="rows">' + cell('CRATES MADE', Math.round(f.made)) + cell('CRATES SOLD', Math.round(f.sold)) + cell('INCOME', money(f.income)) + cell('COSTS', money(f.costs)) + '</div>' +
      '<div class="rows">' + cell('PROFIT', money(f.profit)) + cell('WASHED', money(f.washed)) + cell('TO YOU', money(f.tribute)) + cell('HELD BACK BY', f.limit ? esc(String(f.limit)) : 'nothing') + '</div>';
  }
  function sheetDistrict(id) {
    var x = find(id); if (!x) return;
    var d = x.d, html = '<h2>' + esc(d.name) + '</h2>';
    if (d.owner === 'family') {
      html += '<p>' + esc(x.city.name) + ' · held by your family · capo: ' + esc(capoName(d.capo)) + (d.appointedBy ? ' (named by ' + esc(capoName(d.appointedBy)) + ')' : '') + (d.watched ? ' · watched by the police' : '') + '</p>' +
        '<div class="rows"><div><small>STREETS</small><b>' + Math.round(d.share) + '%</b></div><div><small>HEAT</small><b>' + Math.round(d.heat) + '</b></div><div><small>GOODWILL</small><b>' + Math.round(d.goodwill) + '</b></div><div><small>MEN</small><b>' + d.men + '</b></div></div>' +
        flowRows(id) + '<ul class="list">' + (d.buildings.length ? d.buildings.map(function (b) { return '<li>' + esc(b.name) + '<small>' + b.staff + ' men · level ' + b.level + '</small></li>'; }).join('') : '<li>No place of ours yet</li>') + '</ul>' +
        '<div class="acts"><button data-act="pick" data-order="appoint" data-district="' + esc(id) + '">Replace the capo</button><button data-act="close">Close</button></div>';
    } else {
      var o = G.openings(g).filter(function (o) { return o.district === id; })[0];
      html += '<p>' + esc(x.city.name) + ' · held by the ' + esc(d.owner) + 's</p>' +
        (o ? '<p>Moving in costs ' + money(o.cost) + ' of dirty cash' + (o.affordable ? '.' : ', which you do not have yet.') + '</p>' : '<p>Out of reach for now: your family has no way in from the streets it holds.</p>') +
        '<div class="acts">' + (o ? '<button class="go" data-act="pick" data-order="claim" data-district="' + esc(id) + '"' + (o.affordable ? '' : ' disabled') + '>Move in</button>' : '') + '<button data-act="close">Close</button></div>';
    }
    open(html);
  }
  function sheetPick(orderType, id) {
    var x = find(id), list = G.candidates(g, id);
    open('<h2>' + (orderType === 'claim' ? 'Who moves into ' : 'Who takes ') + esc(x.d.name) + '?</h2>' +
      (list.length ? list.map(function (c) { return card(c, orderType + ':' + id, 'Name ' + c.name.split(' ')[0]); }).join('') : '<p>Every man you trust already has a post.</p>') +
      '<div class="acts"><button data-act="close">Cancel</button></div>');
  }
  // The capos propose, the boss decides: a killing or a kidnapping never happens without his word.
  function sheetProposals() {
    var list = G.proposals(g); if (!list.length) return close();
    open('<h2>Your word is needed</h2>' + list.map(function (p) {
      return '<div class="card"><h3>' + esc(p.capoName) + '</h3><div class="who">' + esc(p.place) + '</div><div class="mv">' + esc(p.label) + '</div>' +
        '<div class="st">Why: ' + esc(p.why) + '<br>Target: ' + esc(p.target) + '<br>He waits ' + p.monthsLeft + ' more month' + (p.monthsLeft > 1 ? 's' : '') + ' for an answer.</div>' +
        '<div class="acts"><button class="go" data-act="approve" data-id="' + esc(p.id) + '">Approve</button><button data-act="refuse" data-id="' + esc(p.id) + '">Refuse</button></div></div>'; }).join('') +
      '<div class="acts"><button data-act="close">Decide later</button></div>');
  }
  function sheetJournal() {
    open('<h2>Journal</h2><ul class="list">' + (g.journal.length ? g.journal.slice(0, 40).map(function (e) {
      return '<li>' + esc(e.label) + '<small>' + esc(e.date) + ' · ' + esc(e.place) + (e.why ? ' · ' + esc(e.why) : '') + '</small></li>'; }).join('') : '<li>Nothing has happened yet</li>') +
      '</ul><div class="acts"><button data-act="new">New game</button><button data-act="close">Close</button></div>');
  }

  $('sheet').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.dataset.act;
    if (act === 'close') close();
    else if (act === 'start') { if (order({ type: 'start', capo: b.dataset.capo })) { close(); map.focus('ashport'); toast(capoName(b.dataset.capo) + ' holds Hillside. Tap a district to see it.'); } }
    else if (act === 'pick') sheetPick(b.dataset.order, b.dataset.district);
    else if (act === 'new') { forget(); location.reload(); }
    else if (act === 'approve' || act === 'refuse') { if (order({ type: act, id: b.dataset.id })) sheetProposals(); }
    else { var parts = act.split(':'); if (order({ type: parts[0], district: parts[1], capo: b.dataset.capo })) { close(); toast(capoName(b.dataset.capo) + (parts[0] === 'claim' ? ' moves in.' : ' takes over.')); } }
  });
  $('veil').addEventListener('click', function (e) { if (e.target === $('veil') && g.started) close(); });
  $('alerts').addEventListener('click', function (e) { if (e.target.closest('[data-requests]')) return sheetProposals();
    var a = e.target.closest('[data-district]'); if (a) { map.focus(a.dataset.district.split('-')[0], a.dataset.district); sheetDistrict(a.dataset.district); } });
  $('map').onclick = function () { if (map) map.focus(null); };
  $('pause').onclick = function () { if (g.started) { G.command(g, { type: g.paused ? 'resume' : 'pause' }); showHud(); } };
  $('speed').onclick = function () { var s = G.SPEEDS; G.command(g, { type: 'speed', value: s[(s.indexOf(g.speed) + 1) % s.length] }); showHud(); };
  $('journal').onclick = function () { if (g.started) sheetJournal(); };

  // ---- labels over the map
  function tapLabel(l) { if (l.district) sheetDistrict(l.district); else if (l.city) map.focus(l.city); }
  function drawLabels() {
    if (map) {
      var seen = {};
      map.labels().forEach(function (l) {
        seen[l.id] = 1; var e = labs[l.id];
        if (!e) {
          e = labs[l.id] = document.createElement('div');
          if (l.fx) { e.className = 'lab fx ' + l.fx; e.textContent = { fire: 'FIRE', gunfire: 'GUNFIRE', police: 'POLICE RAID' }[l.fx]; }
          else { e.className = 'lab' + (l.small ? ' sm' : ''); e.innerHTML = '<b></b><span></span>'; e.onclick = function () { tapLabel(e.l); }; }
          $('labels').appendChild(e);
        }
        e.l = l; e.style.left = l.x + 'px'; e.style.top = (l.y - (l.fx ? { fire: 0, gunfire: 22, police: 44 }[l.fx] : 0)) + 'px';
        if (!l.fx) { e.style.setProperty('--c', l.color); e.firstChild.textContent = l.name; e.lastChild.textContent = l.sub; }
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
    events.forEach(function (e) { if (e.type === 'attack' || e.type === 'raid' || e.type === 'job') toast(e.label, e.type !== 'job' || e.outcome === 'failed'); });
    showMap(events); showHud(); store();
    if (events.some(function (e) { return e.type === 'proposal'; })) sheetProposals();      // time waits for the boss's word
  }

  // ---- start
  g = stored() || G.createGame();
  window.__ashport = { game: function () { return g; }, map: function () { return map; }, beat: beat };
  showHud();
  AshportRender.start(g.started ? M.plan(G.view(g)) : previewPlan(), {
    colors: M.COLORS,
    onTap: function (hit) { if (!hit || !g.started) return; if (hit.near && hit.district) sheetDistrict(hit.district); else map.focus(hit.city); }
  }).then(function (m) {
    map = m; $('load').remove(); drawLabels();
    if (g.started) { showMap(); map.focus('ashport'); } else sheetStart();
    if (!/[?&]manual\b/.test(location.search)) setInterval(beat, TICK_MS);       // tests beat time by hand
  });
})();
