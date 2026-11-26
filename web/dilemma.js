// Dilemmas: matters with no right answer. Each sets two of the boss's people, or two things he wants, against each
// other. Every choice says who gains and who loses, and what the boss chose comes back months later with a name on
// it: a loyal man lets it go, a sour one does not. A man can be read before the boss answers (his mood, his ambition,
// his Muscle are on the card), so a boss who knows his people chooses better than one who does not.
//
// No drawing and no browser here. audience.js brings a dilemma to the boss like any other matter (when, says), carries
// out his answer (done) and asks every day what comes back (due). Nothing is drawn by chance: the same men in the same
// state give the same story.
// To retune, change RULES. To add a dilemma: one entry in DECK (when, says, done) and, if it comes back, one in ECHO.
// The words name people by their first names and never say he or she: two people stand on every card.
(function (root) {
  'use strict';
  var node = typeof require === 'function';
  var T = node ? require('./turf.js') : root.AshportTurf;

  var RULES = {
    steady: 55,         // at this loyalty or above a man lets an old wrong go; under it, he does not
    // the gang next door: see RULES.nextdoor in turf-rules.js (what the guns cost, who loses face)
    // blood between two capos. `his` is the loyalty of the capo whose nephew fired, `hers` of the capo whose man was shot;
    // `grudge` what it leaves between the two; `after`: days before it comes back; `sulks`: cycles a sour man keeps his money;
    // `heat`: what a street settled gun in hand draws; `thanks`: loyalty a man owes for a nephew sent away
    blood: { give: { his: -10, hers: 6 }, send: { cost: 500, his: -2, hers: -4, grudge: 2 }, stand: { his: 6, hers: -10, grudge: 4 }, after: 150, sulks: 3, heat: 8, thanks: 4 },
    // a count said to be short. A man steals when he is ambitious (`climber` or more) and no longer steady, or when he is close to bitter (under `sour`).
    // `back`: dirty $ his books give back; `caught`: loyalty of a thief found out; `insulted`: of an honest man called a thief;
    // `proved` / `shamed`: of the one who spoke, right or wrong; `trusted` / `doubted`: of the two when the boss takes his word;
    // `eye`: what a man at his count costs, `watched` / `heard`: loyalty of the two then, `grudge` between them, `more`: what an honest count brings in with a thief watched;
    // `gone`: dirty $ a thief the boss trusted has taken by the day it comes out, `after` days later; `stood`: loyalty of an honest man the boss stood by
    skim: { climber: 60, sour: 35, back: 800, caught: -6, insulted: -12, proved: 4, shamed: -4, trusted: 4, doubted: -6, eye: 200, watched: -4, heard: 2, grudge: 3, more: 300, gone: 900, after: 120, stood: 4 },
    // a man held by the rivals for a debt at their tables. `cost`: what they want; `paid`: loyalty of his capo when the boss pays;
    // `hard`: the Muscle it takes to fetch him; `fetched` / `botched`: loyalty of the capo who did or did not; `heat`: what it draws either way;
    // `quiet`: cycles the rivals keep their heads down after a hard man came for his own; `left`: loyalty when the boss leaves him there;
    // `after`: days before a man left there has talked or not; `load`: dirty $ of the load the rivals take when he has; `works`: dirty $ a man bought back earns the boss
    debt: { cost: 700, paid: 5, hard: 6, fetched: 6, botched: -6, heat: 8, quiet: 3, left: -8, after: 130, load: 600, works: 250 }
  };

  var dollars = T.dollars, first = function (id) { return T.person(id).name.split(' ')[0]; };
  var days = function (n) { return n + ' days'; };
  function cityOf(g, id) { return g.cities.filter(function (c) { return c.id === id; })[0]; }
  function menOf(g, c) { return Object.keys(g.family.men).filter(function (id) { return T.clubOf(c, id); }); }
  function heldBy(g) { return g.cities.filter(function (c) { return menOf(g, c).length > 0; }); }
  function loyal(g, id) { return T.loyalty(g.family, id); }
  function by(fn) { return function (a, b) { return fn(b) - fn(a) || (a < b ? -1 : 1); }; }
  function signed(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
  function sways(id, n) { return 'Loyalty ' + signed(n) + ' for ' + first(id); }
  function later(g, e) { var a = g.audience; (a.echoes = a.echoes || []).push(e); }
  // The city with the most men where a dilemma between two can come up.
  function pairCity(g) { return heldBy(g).filter(function (c) { return menOf(g, c).length >= 2; }).sort(by(function (c) { return menOf(g, c).length; }))[0] || null; }
  // Does this man steal from the count: an ambitious man who is no longer steady, or anybody close to bitter.
  function steals(g, id) { var l = loyal(g, id); return (T.person(id).ambition >= RULES.skim.climber && T.mood(g.family, id) !== 'steady') || l < RULES.skim.sour; }

  var DECK = {
    // A hard man wants the rivals' place next door: a live hit, on the boss's word. A careful capo of the same city frets.
    nextdoor: {
      when: function (g) {
        var found = null;
        heldBy(g).forEach(function (c) {
          menOf(g, c).forEach(function (id) {
            var p = found ? null : T.prey(c, g.family, id);
            if (p && g.family.dirty >= p.cost) found = { c: c, capo: id, p: p };
          });
        });
        return found;
      },
      says: function (g, x) {
        var K = T.RULES.nextdoor, p = x.p, him = first(x.capo), proud = T.person(x.capo).ambition >= K.proud;
        var other = menOf(g, x.c).filter(function (id) { return id !== x.capo && T.person(id).cunning >= 6; })[0] || null;
        var m = { kind: 'nextdoor', capo: x.capo, city: x.c.id, x: p.x, y: p.y,
          title: him + ' wants the ' + p.owner + 's\' ' + p.name.toLowerCase() + ' next door',
          says: 'In ' + p.zone + ': ' + p.crew + ' men of ours against ' + p.guards + ' of theirs. You follow it live and call each step. Their chief will want blood for it.'
            + (other ? ' ' + first(other) + ' says it will bring the police down on every street of ' + T.town(x.c) + '.' : ''),
          choices: [{ id: 'go', label: 'Give the word', cost: p.cost, money: 'dirty', gives: 'A live hit: the place and its till if ' + him + ' wins', costs: 'Men, heat, and a vendetta' + (other ? ' · ' + sways(other, -K.frets) : '') },
                    { id: 'no', label: 'Not now', gives: 'No blood, no heat', costs: proud ? sways(x.capo, -K.face) + ': a proud man told to sit still' : him + ' waits a year before asking again' }] };
        if (other) m.against = other;
        return m;
      },
      done: function (g, m, ch) {
        var c = cityOf(g, m.city), K = T.RULES.nextdoor;
        if (ch.id !== 'go') { if (T.person(m.capo).ambition >= K.proud) T.sway(g.family, m.capo, -K.face); return { label: 'You tell ' + first(m.capo) + ' to leave the place next door alone' }; }
        g.family.dirty -= ch.cost;
        if (m.against) T.sway(g.family, m.against, -K.frets);
        return { events: [T.goFor(c, g.family, m.capo)] };
      }
    },
    // One capo's nephew shot another capo's man. Whoever the boss stands by, the other remembers.
    blood: {
      when: function (g) {
        var c = pairCity(g); if (!c) return null;
        var men = menOf(g, c), his = men.slice().sort(by(function (id) { return T.person(id).ambition; }))[0];
        var hers = men.filter(function (id) { return id !== his; }).sort(by(function (id) { return -loyal(g, id); }))[0];
        return { c: c, his: his, hers: hers };
      },
      says: function (g, x) {
        var K = RULES.blood, a = first(x.his), b = first(x.hers);
        return { kind: 'blood', capo: x.hers, against: x.his, city: x.c.id,
          title: a + '\'s nephew shot one of ' + b + '\'s men',
          says: 'Over a card game, in front of the whole street. ' + b + ' wants the boy. ' + a + ' says blood is blood. Whoever you stand by, the other will remember it.',
          choices: [{ id: 'give', label: 'Give ' + b + ' the boy', gives: sways(x.hers, K.give.hers), costs: sways(x.his, K.give.his) + ': ' + a + ' buries a nephew' },
                    { id: 'send', label: 'Send the boy away', cost: K.send.cost, money: 'dirty', gives: 'Nobody dies: a ticket west, and a word to both', costs: sways(x.his, K.send.his) + ' · ' + sways(x.hers, K.send.hers) + ' · bad blood between the two' },
                    { id: 'stand', label: 'Stand by ' + a, gives: sways(x.his, K.stand.his), costs: sways(x.hers, K.stand.hers) + ': no blood for ' + b + '\'s man' }] };
      },
      done: function (g, m, ch, today) {
        var K = RULES.blood, k = K[ch.id], c = cityOf(g, m.city), a = first(m.against), b = first(m.capo);
        if (k.cost) g.family.dirty -= k.cost;
        T.sway(g.family, m.against, k.his); T.sway(g.family, m.capo, k.hers);
        if (k.grudge) T.grudge(c, m.against, m.capo, k.grudge);
        later(g, { day: today + K.after, kind: 'blood', choice: ch.id, city: m.city, his: m.against, hers: m.capo });
        return { label: ch.id === 'give' ? 'You give ' + b + ' the boy: ' + a + ' buries a nephew'
                      : ch.id === 'send' ? 'You send ' + a + '\'s nephew west, and tell ' + b + ' it ends there' : 'You stand by ' + a + ': no blood for ' + b + '\'s man' };
      }
    },
    // One capo says another's count is short. True or not: the accused can be read (ambition, mood) before the boss answers.
    skim: {
      when: function (g) {
        var c = pairCity(g); if (!c) return null;
        var men = menOf(g, c), him = men.slice().sort(by(function (id) { return T.person(id).ambition; }))[0];
        var says = men.filter(function (id) { return id !== him; }).sort(by(function (id) { return T.person(id).business + T.person(id).cunning; }))[0];
        return { c: c, him: him, says: says };
      },
      says: function (g, x) {
        var K = RULES.skim, a = first(x.him), b = first(x.says), p = T.person(x.him), mood = T.mood(g.family, x.him);
        return { kind: 'skim', capo: x.says, against: x.him, city: x.c.id,
          title: b + ' says ' + a + '\'s count is short',
          says: b + ' has no proof, only a nose for numbers. ' + a + ' is ' + (p.ambition >= K.climber ? 'an ambitious man' : 'no climber') + ' (Ambition ' + p.ambition + '), and ' + mood + ' these days. ' + a + ' swears every dollar is there.',
          choices: [{ id: 'audit', label: 'Open ' + a + '\'s books', gives: 'If the count is short: ' + dollars(K.back) + ' back, and ' + b + ' was right', costs: 'If it is not: ' + sways(x.him, K.insulted) + ', called a thief for nothing' },
                    { id: 'watch', label: 'Put a man at the count', cost: K.eye, money: 'dirty', gives: 'Nothing can go missing from now on', costs: sways(x.him, K.watched) + ' · bad blood between the two' },
                    { id: 'trust', label: 'Take ' + a + '\'s word', gives: sways(x.him, K.trusted), costs: sways(x.says, K.doubted) + ' · if the count is short, it stays short' }] };
      },
      done: function (g, m, ch, today) {
        var K = RULES.skim, c = cityOf(g, m.city), a = first(m.against), b = first(m.capo), thief = steals(g, m.against);
        if (ch.id === 'audit') {
          if (thief) { g.family.dirty += K.back; T.sway(g.family, m.against, K.caught); T.sway(g.family, m.capo, K.proved); return { label: a + '\'s books are short: ' + dollars(K.back) + ' comes back to you, and ' + b + ' was right' }; }
          T.sway(g.family, m.against, K.insulted); T.sway(g.family, m.capo, K.shamed);
          return { label: a + '\'s books are right to the dollar: you called an honest man a thief' };
        }
        if (ch.id === 'watch') {
          g.family.dirty -= K.eye; T.sway(g.family, m.against, K.watched); T.sway(g.family, m.capo, K.heard); T.grudge(c, m.against, m.capo, K.grudge);
          if (thief) later(g, { day: today + K.after, kind: 'skim', choice: 'watch', city: m.city, him: m.against, says: m.capo });
          return { label: 'You put one of ' + b + '\'s people at ' + a + '\'s count' };
        }
        T.sway(g.family, m.against, K.trusted); T.sway(g.family, m.capo, K.doubted);
        later(g, { day: today + K.after, kind: 'skim', choice: 'trust', thief: thief, city: m.city, him: m.against, says: m.capo });
        return { label: 'You take ' + a + '\'s word over ' + b + '\'s' };
      }
    },
    // The rivals hold one of a capo's men for a debt at their tables: pay, fetch him gun in hand, or leave him.
    debt: {
      when: function (g) {
        var c = heldBy(g).filter(function (q) { return q.rival; })[0]; if (!c) return null; // (a boss who cannot pay still has to choose between the two other ways)
        return { c: c, capo: menOf(g, c).slice().sort(by(function (id) { return -loyal(g, id); }))[0] };
      },
      says: function (g, x) {
        var K = RULES.debt, a = first(x.capo), p = T.person(x.capo), r = x.c.rival;
        return { kind: 'debt', capo: x.capo, city: x.c.id,
          title: 'The ' + r + 's hold one of ' + a + '\'s men for a debt',
          says: dollars(K.cost) + ' lost at their tables. They want the money, or they keep the man. ' + a + ' (Muscle ' + p.muscle + ') wants to go and get him: it takes a hard capo, Muscle ' + K.hard + ' or more.',
          choices: [{ id: 'pay', label: 'Pay the debt', cost: K.cost, money: 'dirty', gives: sways(x.capo, K.paid) + ': the man comes home', costs: 'The ' + r + 's learn that you pay' },
                    { id: 'fetch', label: 'Send ' + a + ' for him', gives: 'A hard capo brings him back: ' + sways(x.capo, K.fetched) + ', and the ' + r + 's keep quiet for ' + days(K.quiet * T.RULES.days), costs: 'Heat +' + K.heat + ' · a soft capo leaves a man in the street: ' + sways(x.capo, K.botched) },
                    { id: 'leave', label: 'Leave him there', gives: 'You keep your money, and stay out of it', costs: sways(x.capo, K.left) + ' · a man left behind may talk' }] };
      },
      done: function (g, m, ch, today) {
        var K = RULES.debt, c = cityOf(g, m.city), a = first(m.capo), r = c.rival;
        if (ch.id === 'pay') { g.family.dirty -= K.cost; T.sway(g.family, m.capo, K.paid); later(g, { day: today + K.after, kind: 'debt', choice: 'pay', city: m.city, capo: m.capo }); return { label: 'You pay the ' + r + 's for ' + a + '\'s man' }; }
        if (ch.id === 'fetch') {
          c.heat = Math.min(99, (c.heat || 0) + K.heat);
          if (T.person(m.capo).muscle >= K.hard) { T.sway(g.family, m.capo, K.fetched); c.quiet = Math.max(c.quiet || 0, c.month + K.quiet); return { label: a + ' walks into the ' + r + 's\' rooms and brings him back' }; }
          T.sway(g.family, m.capo, K.botched);
          return { label: a + ' went for him and it went badly: one of ours is dead in the street' };
        }
        T.sway(g.family, m.capo, K.left);
        later(g, { day: today + K.after, kind: 'debt', choice: 'leave', city: m.city, capo: m.capo });
        return { label: 'You leave ' + a + '\'s man with the ' + r + 's' };
      }
    }
  };
  var KINDS = ['nextdoor', 'blood', 'skim', 'debt'];

  // What comes back. Each: (g, e) -> { capo, good, label, gives } with its effect done, or null when the people are gone.
  var ECHO = {
    blood: function (g, e) {
      var K = RULES.blood, c = cityOf(g, e.city), a = first(e.his), b = first(e.hers);
      if (!c || !T.clubOf(c, e.his) || !T.clubOf(c, e.hers)) return null;
      if (e.choice === 'give') {
        if (loyal(g, e.his) >= RULES.steady) return { capo: e.his, good: true, label: a + ' drank to the boy and says no more of it', gives: 'A steady man lets it go' };
        T.sulk(c, e.his, K.sulks);
        return { capo: e.his, good: false, label: a + ' has not forgotten the nephew you gave up', gives: a + ' keeps the money for ' + days(K.sulks * T.RULES.days) };
      }
      if (e.choice === 'send') { T.sway(g.family, e.his, K.thanks); return { capo: e.his, good: true, label: 'The boy writes from the west: ' + a + ' remembers who paid the ticket', gives: sways(e.his, K.thanks) }; }
      if (loyal(g, e.hers) >= RULES.steady) return { capo: e.hers, good: true, label: b + ' let the boy be: the family comes first', gives: 'A steady capo lets it go' };
      T.grudge(c, e.his, e.hers, T.RULES.feud); c.heat = Math.min(99, (c.heat || 0) + K.heat);
      return { capo: e.hers, good: false, label: b + '\'s men found the boy themselves: ' + a + ' wants blood for it', gives: 'The two are at each other\'s throat · Heat +' + K.heat };
    },
    skim: function (g, e) {
      var K = RULES.skim, a = first(e.him);
      if (!g.family.men[e.him]) return null;
      if (e.choice === 'watch') { g.family.dirty += K.more; return { capo: e.him, good: true, label: 'With a man at the count, ' + a + '\'s takings are up', gives: '+' + dollars(K.more) + ': the count was short after all' }; }
      if (!e.thief) { T.sway(g.family, e.him, K.stood); return { capo: e.him, good: true, label: a + '\'s count was right to the dollar all along', gives: sways(e.him, K.stood) + ': you stood by an honest man' }; }
      var gone = Math.min(K.gone, Math.max(0, Math.floor(g.family.dirty)));
      g.family.dirty -= gone; if (g.family.men[e.says]) T.sway(g.family, e.says, K.shamed);
      return { capo: e.him, good: false, label: a + '\'s count was short all along', gives: dollars(gone) + ' of dirty money is gone' + (g.family.men[e.says] ? ' · ' + first(e.says) + ' told you so' : '') };
    },
    debt: function (g, e) {
      var K = RULES.debt, a = first(e.capo), c = cityOf(g, e.city);
      if (!g.family.men[e.capo] || !c) return null;
      if (e.choice === 'pay') { g.family.dirty += K.works; return { capo: e.capo, good: true, label: 'The man you bought back works off his debt', gives: '+' + dollars(K.works) + ' from ' + a + '\'s street' }; }
      if (loyal(g, e.capo) >= RULES.steady) return { capo: e.capo, good: true, label: 'The man you left with the ' + c.rival + 's kept his mouth shut', gives: a + '\'s house is tight' };
      var load = Math.min(K.load, Math.max(0, Math.floor(g.family.dirty)));
      g.family.dirty -= load;
      return { capo: e.capo, good: false, label: 'The man you left with the ' + c.rival + 's talked', gives: 'They knew where ' + a + '\'s money would pass: ' + dollars(load) + ' is gone' };
    }
  };

  function when(g, kind) { return DECK[kind].when(g); }
  function says(g, kind, x) { var m = DECK[kind].says(g, x); m.dilemma = true; m.key = m.key || kind; m.deck = kind; return m; }
  function done(g, m, ch, today) { return DECK[m.kind].done(g, m, ch, today); }
  // What comes back today: the news of it, its effect already done.
  function due(g, today) {
    var a = g.audience, out = [];
    if (!a || !a.echoes || !a.echoes.length) return out;
    a.echoes = a.echoes.filter(function (e) {
      if (e.day > today) return true;
      var r = ECHO[e.kind] ? ECHO[e.kind](g, e) : null;
      if (r) out.push({ type: 'echo', kind: e.kind, choice: e.choice, city: e.city, capo: r.capo, good: r.good, label: r.label, gives: r.gives });
      return false;
    });
    return out;
  }

  var api = { RULES: RULES, KINDS: KINDS, when: when, says: says, done: done, due: due, steals: steals };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportDilemma = api;
})(typeof self !== 'undefined' ? self : this);
