// The man across the street: the chief of a city's old family. His temper (turf-rules.js, RULES.chief.tempers) decides
// how his men fight; here is what he does once a month besides: he forgets a little, feeds the police and whispers if
// he is a schemer, sends the boss an ultimatum about the capo he hates, puts a price on that man's head and has him shot,
// and falls when the family has beaten him, leaving his place to a lieutenant or his family gone from the city.
//
// His words reach the boss through audience.js; the boss answers with reply(). No drawing and no browser here.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var P = typeof require === 'function' ? require('./turf-people.js') : root.AshportTurfPeople;
  var C = typeof require === 'function' ? require('./turf-city.js') : root.AshportTurfCity;
  var S = typeof require === 'function' ? require('./turf-streets.js') : root.AshportTurfStreets;
  var M = typeof require === 'function' ? require('./turf-men.js') : root.AshportTurfMen;
  var RULES = R.RULES, key = R.key, at = R.at, far = R.far;
  var K = RULES.chief, who = P.who, first = S.first;

  var name = function (id) { return who(id).name; };
  var site = function (p) { return p.kind === 'key' ? P.KEYS[p.key].name : D.SITES[p.kind].name; };

  // The odds in a hundred a man lives through the shot.
  function odds(c, capo) {
    var s = K.survive, n = s.base + s.muscle * who(capo).muscle + (P.can(c, capo, 'hard') ? s.hard : 0);
    return Math.max(1, Math.min(s.most, Math.round(n)));
  }
  function rankOf(f, capo) { return (f.men[capo] && f.men[capo].rank) || 0; }

  // The place he wants back from a capo: the last one the man took from him if it is still his, otherwise none.
  function wanted(c, s, capo) {
    var t = s.took[capo], p = t && at(c, t.x, t.y);
    return p && p.owner === 'family' && p.capo === capo && p.kind !== 'club' && p.kind !== 'hq' ? { x: t.x, y: t.y, kind: p.kind, key: p.key, name: site(p) } : null;
  }

  function month(c, f, events) {
    var s = P.chiefState(c);
    if (!s) return;
    var t = P.temperOf(c), ours = C.everyPlace(c).some(function (p) { return p.owner === 'family'; });
    // a schemer feeds the police against the family and whispers to its least loyal man
    if (ours && t.tips) c.heat = Math.min(99, (c.heat || 0) + t.tips);
    var men = Object.keys(f.men).filter(function (id) { return C.clubOf(c, id); });
    var soft = men.sort(function (a, b) { return P.loyalty(f, a) - P.loyalty(f, b); })[0];
    if (t.whispers && soft && P.loyalty(f, soft) < RULES.loyal.restless) P.sway(f, soft, -t.whispers); // a loyal man does not listen
    // a man no longer in the city is out of his reach
    Object.keys(s.hate).forEach(function (id) { if (!f.men[id] || !C.clubOf(c, id)) { delete s.hate[id]; delete s.took[id]; } });
    if (s.contract && (!f.men[s.contract.capo] || !C.clubOf(c, s.contract.capo))) { s.contract = null; s.word = null; }
    if (s.word && (!f.men[s.word.capo] || !C.clubOf(c, s.word.capo))) s.word = null;
    if (c.month % K.forgets === 0) Object.keys(s.hate).forEach(function (id) { if (--s.hate[id] <= 0) delete s.hate[id]; });
    if (fall(c, f, s, events)) return;
    // an ultimatum the boss let lapse is an ultimatum refused
    if (s.word && s.word.kind === 'ultimatum' && s.word.until <= c.month) refuse(s);
    if (s.contract && s.contract.at <= c.month) return shoot(c, f, s, events);
    if (s.contract || s.word) return;
    var worst = Object.keys(s.hate).sort(function (a, b) { return s.hate[b] - s.hate[a] || (a < b ? -1 : 1); })[0];
    if (!worst) return;
    if (s.hate[worst] >= K.contract) return sign(c, f, s, worst, events);
    var back = s.hate[worst] >= K.warn && wanted(c, s, worst);
    if (!back) return;
    s.word = { kind: 'ultimatum', capo: worst, x: back.x, y: back.y, place: back.name, since: c.month, until: c.month + K.wait };
    events.push({ type: 'ultimatum', city: c.id, chief: s.id, capo: worst, x: back.x, y: back.y, months: K.wait,
                  label: name(s.id) + ' wants ' + first(worst) + '\'s ' + back.name.toLowerCase() + ' in ' + C.zoneOf(c, back.x, back.y).name + ' back, or ' + first(worst) + ' answers for it' });
  }
  function refuse(s) { s.hate[s.word.capo] = Math.max(s.hate[s.word.capo] || 0, K.contract); s.word = null; }

  // A price on a man's head: he is shot at in so many months, unless the boss pays.
  function sign(c, f, s, capo, events) {
    var price = K.price[rankOf(f, capo)], club = C.clubOf(c, capo);
    s.contract = { capo: capo, since: c.month, at: c.month + K.months, price: price };
    s.word = { kind: 'price', capo: capo, since: c.month, until: s.contract.at, price: price, x: club.x, y: club.y };
    events.push({ type: 'contract', city: c.id, chief: s.id, capo: capo, x: club.x, y: club.y, months: K.months, price: price, odds: odds(c, capo),
                  label: name(s.id) + ' puts a price on ' + first(capo) + '\'s head' });
  }
  function shoot(c, f, s, events) {
    var capo = s.contract.capo, club = C.clubOf(c, capo), live = C.roll(c, 100) < odds(c, capo);
    s.contract = null; s.word = null; delete s.hate[capo]; delete s.took[capo];
    var e = { city: c.id, chief: s.id, capo: capo, x: club.x, y: club.y };
    if (live) { e.type = 'survived'; e.label = name(s.id) + '\'s men shoot at ' + first(capo) + ': he lives, and his men hunt the shooters down'; }
    else if (!C.others(c, f, capo).length) { e.type = 'wounded'; e.label = name(s.id) + '\'s men shoot ' + first(capo) + ': he pulls through, the last of the family in the city'; }
    else {
      var out = M.shot(c, f, capo);
      e.type = 'murdered'; e.kept = out.kept; e.closed = out.closed;
      e.label = name(s.id) + '\'s men shoot ' + first(capo) + ' dead in ' + C.zoneOf(c, club.x, club.y).name + ': ' + out.kept + ' of his places go to the others, ' + out.closed + ' close';
    }
    events.push(e);
  }

  // He falls: beaten (enough places taken from him and his family down to a few streets), or left alone by his lieutenants.
  function fall(c, f, s, events) {
    var men = C.lieutenantsOf(c).filter(function (id) { return id !== s.id; });
    var crossed = men.length > 0 && men.every(function (id) { return f.men[id] || (f.gone && f.gone[id]); });
    var beaten = s.lost >= K.beaten && C.share(c).rival < K.falls;
    if (!crossed && !beaten) return false;
    var hq = C.hqOf(c, 'rival') || {}, heir = men.filter(function (id) { return !f.men[id] && !(f.gone && f.gone[id]) && (s.fallen || []).indexOf(id) < 0; })
      .sort(function (a, b) { return who(b).ambition - who(a).ambition || (a < b ? -1 : 1); })[0];
    events.push({ type: 'fallen', city: c.id, chief: s.id, family: c.rival, x: hq.x, y: hq.y, how: crossed ? 'alone' : 'beaten',
                  label: name(s.id) + ' is finished: ' + (crossed ? (who(s.id).woman ? 'her' : 'his') + ' lieutenants have all crossed to the family' : 'the ' + c.rival + 's are down to a few streets') });
    c.vendetta = 0;
    if (heir) {
      c.chief = { id: heir, temper: temperFor(heir, s.temper), since: c.month, fallen: (s.fallen || []).concat(s.id) };
      P.chiefState(c);
      events.push({ type: 'succeeds', city: c.id, chief: heir, family: c.rival, temper: c.chief.temper, x: hq.x, y: hq.y,
                    label: name(heir) + ' takes ' + (who(s.id).woman ? 'her' : 'his') + ' place at the head of the ' + c.rival + 's: a ' + K.tempers[c.chief.temper].name.toLowerCase() });
      return true;
    }
    C.everyPlace(c).forEach(function (p) { if (p.owner === c.rival && p.kind !== 'key') delete c.blocks[key(p.x, p.y)]; });
    C.changed(c);
    c.chief = { id: s.id, gone: true, since: c.month };
    events.push({ type: 'dissolved', city: c.id, chief: s.id, family: c.rival, x: hq.x, y: hq.y,
                  label: 'Nobody is left to lead the ' + c.rival + 's: their places close, and the city is open' });
    return true;
  }
  // A lieutenant leads the way he is made: Muscle a hothead, Cunning a schemer, Business a businessman, otherwise the old
  // guard. Never the way of the man before him.
  function temperFor(id, was) {
    var p = who(id), score = { hothead: p.muscle, schemer: p.cunning, businessman: p.business, oldguard: (p.loyalty || 0) / 6 };
    return Object.keys(score).filter(function (k) { return k !== was; }).sort(function (a, b) { return score[b] - score[a]; })[0];
  }

  // The boss answers the chief's word: yes gives the place back or pays the price, no lets it come.
  function reply(c, f, yes) {
    var s = P.chiefState(c), w = s && s.word;
    if (!w) throw new Error('nobody across the street is waiting for an answer in ' + C.town(c));
    var capo = w.capo, out = { type: 'answered', city: c.id, chief: s.id, capo: capo, word: w.kind, yes: !!yes };
    if (w.kind === 'ultimatum') {
      if (!yes) { refuse(s); out.label = 'You tell ' + name(s.id) + ' no: ' + first(capo) + ' keeps his ' + w.place.toLowerCase(); return out; }
      var p = at(c, w.x, w.y);
      if (p && p.owner === 'family') { c.blocks[key(w.x, w.y)] = { owner: c.rival, kind: p.kind, key: p.key, level: p.level }; if (!p.key) delete c.blocks[key(w.x, w.y)].key; C.changed(c); }
      delete s.hate[capo]; delete s.took[capo]; s.word = null;
      out.label = first(capo) + ' hands his ' + w.place.toLowerCase() + ' back to the ' + c.rival + 's: ' + name(s.id) + ' lets him be';
      return out;
    }
    if (!yes) { s.word = null; out.label = 'You will not pay ' + name(s.id) + ': ' + first(capo) + ' watches his back'; return out; }
    if (S.funds(f) < w.price) throw new Error('it takes ' + R.dollars(w.price));
    S.spend(f, w.price);
    s.contract = null; s.word = null; delete s.hate[capo]; delete s.took[capo];
    out.label = 'You pay ' + name(s.id) + ' ' + R.dollars(w.price) + ': the price on ' + first(capo) + '\'s head is called off';
    return out;
  }

  // The chief as the boss reads him: who, how strong, his temper and what to do against it, whom he hates and how much,
  // the price on a man's head and the odds that man lives, his word waiting for an answer, the months to his next raid.
  function view(c, f) {
    var base = S.chief(c);
    if (!base) return null;
    var s = P.chiefState(c), t = P.temperOf(c);
    base.temper = t.id ? { id: t.id, name: t.name, does: P.voice(s.id, t.does.replace(/\{(\w+)\}/g, function (m, k) { return R.days(t[k]); })), answer: P.voice(s.id, t.answer) } : null; // (a woman who leads is told as one)
    base.hates = Object.keys(s.hate).filter(function (id) { return s.hate[id] > 0; }).sort(function (a, b) { return s.hate[b] - s.hate[a]; })
      .map(function (id) { return { capo: id, level: s.hate[id], warn: K.warn, contract: K.contract }; });
    base.contract = s.contract ? { capo: s.contract.capo, months: Math.max(0, s.contract.at - c.month), odds: odds(c, s.contract.capo), price: s.contract.price } : null;
    base.word = s.word ? { kind: s.word.kind, capo: s.word.capo, x: s.word.x, y: s.word.y, place: s.word.place, price: s.word.price, since: s.word.since,
                           months: Math.max(0, s.word.until - c.month) } : null;
    var from = Math.max(c.month, c.quiet || 0, (s.rest || 0) - 1), next = from + 1;
    while (next % t.every !== 0) next += 1;
    base.next = next - c.month;
    return base;
  }

  var api = { month: month, reply: reply, view: view, odds: odds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfChief = api;
})(typeof self !== 'undefined' ? self : this);
