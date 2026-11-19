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
        out += '<path data-skill="' + i + ':' + k + '" d="' + arc(a0, a1, 46 + k * 35, 78 + k * 35) + '" fill="' + c + '"' + (r.lit ? ' filter="url(#lit)"' : ' fill-opacity="' + (0.2 - k * 0.04) + '"') + '/>';
      });
      out += '<text x="' + (167 * Math.cos(t)).toFixed(1) + '" y="' + (167 * Math.sin(t) + 4).toFixed(1) + '" fill="' + c + '" style="fill:' + c + '">' + esc(s.name) + '</text>';
    });
    return out + '<circle r="38" fill="#0e0e15" stroke="#e8c463" stroke-width="2"/><text class="boss" y="-1">Boss</text><text class="count" y="15">' + w.lit + ' / ' + w.of + '</text></svg>';
  }
  function skillText(w, key) {
    var p = key.split(':'), s = w.sectors[+p[0]], r = s.rings[+p[1]];
    return '<b style="color:' + TRADE[s.id] + '">' + esc(s.name) + ' · ' + esc(r.name) + '</b>' + esc(r.text) + '<br><small style="color:var(--dim)">' +
      (r.lit ? 'Brought by ' + esc(r.by.map(capoName).join(', ')) : 'Not yet. A capo of yours has to rise in this trade.') + '</small>';
  }
  function men() {      // everyone the family counts on, each named once
    var ids = [], v = G.view(g), add = function (id) { if (id && ids.indexOf(id) < 0) ids.push(id); };
    v.cities.forEach(function (c) { c.districts.forEach(function (d) { if (d.owner === 'family') add(d.capo); }); });
    Object.keys(v.table || {}).forEach(function (k) { add(v.table[k]); }); Object.keys(v.underbosses || {}).forEach(function (k) { add(v.underbosses[k]); });
    return ids.map(function (id) { return G.person(g, id); }).filter(Boolean);
  }
  function sheetFamily() {
    var w = G.wheel(g);
    open('<h2>The family</h2><p>Six trades around you. Your men light them as they rise in rank, and what they bring serves the whole family.</p>' + wheelSvg(w) +
      '<div id="skill">Touch a part of the wheel to see what it brings.</div>' +
      men().map(function (m) {
        return '<div class="card"><h3>' + esc(m.name) + '</h3><div class="who">' + esc(m.rankName) + ' · ' + esc(m.specialty) + '</div>' +
          '<div class="bar"><i style="width:' + Math.min(100, Math.round(100 * m.total / (m.nextRankAt || m.total || 1))) + '%"></i></div>' +
          '<div class="st">' + (m.nextRankAt ? 'Next rank at ' + Math.round(m.nextRankAt) + ' (now ' + Math.round(m.total) + ')' : 'Highest rank') + '</div>' +
          (m.abilities.length ? m.abilities.map(function (a) { return '<div class="mv"><span style="color:' + TRADE[a.sector] + '">' + esc(a.name) + '</span>: ' + esc(a.text) + '</div>'; }).join('') : '<div class="st">Has brought nothing to the wheel yet.</div>') + '</div>'; }).join('') +
      '<div class="acts"><button data-act="close">Close</button></div>');
  }
  function sheetJournal() {
    open('<h2>Journal</h2><ul class="list">' + (g.journal.length ? g.journal.slice(0, 40).map(function (e) {
      return '<li>' + esc(e.label) + '<small>' + esc(e.date) + ' · ' + esc(e.place) + (e.why ? ' · ' + esc(e.why) : '') + '</small></li>'; }).join('') : '<li>Nothing has happened yet</li>') +
      '</ul><div class="acts"><button data-act="new">New game</button><button data-act="close">Close</button></div>');
  }

  $('sheet').addEventListener('click', function (e) {
    var seg = e.target.closest('[data-skill]');
    if (seg) { [].forEach.call($('sheet').querySelectorAll('.sel'), function (x) { x.classList.remove('sel'); }); seg.classList.add('sel'); $('skill').innerHTML = skillText(G.wheel(g), seg.dataset.skill); return; }
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
  $('family').onclick = function () { if (g.started) sheetFamily(); };
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
          if (l.fx) { e.className = 'lab fx ' + l.fx; e.textContent = { fire: 'FIRE', gunfire: 'GUNFIRE', police: 'POLICE RAID', promotion: 'PROMOTED' }[l.fx]; }
          else { e.className = 'lab' + (l.small ? ' sm' : ''); e.innerHTML = '<b></b><span></span>'; e.onclick = function () { tapLabel(e.l); }; }
          $('labels').appendChild(e);
        }
        e.l = l; e.style.left = l.x + 'px'; e.style.top = (l.y - (l.fx ? ({ fire: 0, gunfire: 22, police: 44, promotion: 66 }[l.fx] || 0) : 0)) + 'px';
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
    events.forEach(function (e) { if (e.type === 'attack' || e.type === 'raid' || e.type === 'job' || e.type === 'promotion') toast(e.label, e.type === 'attack' || e.type === 'raid' || e.outcome === 'failed'); });
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
