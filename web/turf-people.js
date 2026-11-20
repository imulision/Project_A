// The people of the game: the capos, the men behind the key places, the rival
// lieutenants, what each learns as he rises, and the three chairs at the boss's
// table. To add or change a person, change PEOPLE.
(function (root) {
  'use strict';
  var D = typeof require === 'function' ? require('./district.js') : root.AshportDistrict;
  var R = typeof require === 'function' ? require('./turf-rules.js') : root.AshportTurfRules;
  var RULES = R.RULES;

  // The few buildings a whole city turns on. Whoever holds one changes the
  // rules for every place of his family in that city:
  //   street  = the kind of street it stands on
  //   pours   = stills' worth of liquor it adds
  //   lifts   = the streets whose places earn more, and by how much
  //   cheaper = share taken off the price of every new place
  //   shield  = what it adds to a capo's stand against a raid (0.1 = one point of Muscle)
  var KEYS = {
    brewery:  { street: 'industry', name: 'Brewery', pours: 4, gives: 'Pours for eight speakeasies' },
    hotel:    { street: 'nightlife', name: 'Grand Hotel', lifts: { street: 'nightlife', by: 0.25 }, gives: 'Night places earn a quarter more' },
    port:     { street: 'port', name: 'The Port', lifts: { street: 'port', by: 0.5 }, gives: 'Port places earn half as much again' },
    depot:    { street: 'industry', name: 'Freight Depot', lifts: { street: 'industry', by: 0.25 }, gives: 'Workshops and stills earn a quarter more' },
    cityhall: { street: 'wealth', name: 'City Hall', cheaper: 0.2, gives: 'Every new place costs a fifth less' },
    precinct: { street: 'wealth', name: 'Central Precinct', shield: 0.4, gives: 'Raids on the family break far more often' }
  };

  // The people beyond the six big names of district.js. A second has a
  // `mentor` and comes forward when his mentor runs all he can; the man of a
  // key place has a `key` and comes with it. Each is a full capo.
  var PEOPLE = {
    rocco: { mentor: 'sal', name: 'Rocco Bellini', specialty: 'Enforcer', muscle: 7, business: 3, cunning: 3, charisma: 4, loyalty: 70, ambition: 50, likes: ['loans', 'chopshop'], refuses: ['front'] },
    ida:   { mentor: 'mae', name: 'Ida Brandt', specialty: 'Bookkeeper', muscle: 1, business: 7, cunning: 7, charisma: 5, loyalty: 75, ambition: 35, likes: ['front', 'rented', 'loans'], refuses: ['brothel', 'loft'] },
    otto:  { mentor: 'dutch', name: 'Otto Brenner', specialty: 'Bootlegger', muscle: 5, business: 6, cunning: 4, charisma: 3, loyalty: 65, ambition: 40, likes: ['still', 'warehouse', 'speakeasy'], refuses: [] },
    frank: { mentor: 'tommy', name: 'Frank Doyle', specialty: 'Politician', muscle: 3, business: 4, cunning: 5, charisma: 7, loyalty: 75, ambition: 45, likes: ['speakeasy', 'union', 'gambling'], refuses: ['brothel'] },
    lena:  { mentor: 'vince', name: 'Lena Sokolova', specialty: 'Pusher', muscle: 6, business: 4, cunning: 6, charisma: 2, loyalty: 55, ambition: 70, likes: ['loft', 'chopshop'], refuses: [] },
    ray:   { mentor: 'danny', name: 'Ray Castellano', specialty: 'Gambler', muscle: 4, business: 5, cunning: 5, charisma: 5, loyalty: 60, ambition: 65, likes: ['gambling', 'brothel'], refuses: [] },
    gus:     { key: 'brewery', name: 'Gus Hartmann', specialty: 'Brewmaster', muscle: 3, business: 7, cunning: 6, charisma: 4, loyalty: 50, ambition: 30, likes: ['still', 'speakeasy', 'warehouse'], refuses: [] },
    vivian:  { key: 'hotel', name: 'Vivian Lacroix', specialty: 'Hostess', muscle: 2, business: 6, cunning: 7, charisma: 8, loyalty: 45, ambition: 60, likes: ['gambling', 'brothel', 'speakeasy'], refuses: [] },
    jim:     { key: 'port', name: 'Jim Kovacs', specialty: 'Dock boss', muscle: 8, business: 4, cunning: 4, charisma: 5, loyalty: 50, ambition: 55, likes: ['warehouse', 'fence', 'union'], refuses: [] },
    walt:    { key: 'depot', name: 'Walt Gorski', specialty: 'Union man', muscle: 6, business: 4, cunning: 4, charisma: 7, loyalty: 55, ambition: 45, likes: ['union', 'chopshop', 'loft'], refuses: [] },
    hugh:    { key: 'cityhall', name: 'Hugh Pryce', specialty: 'Alderman', muscle: 1, business: 6, cunning: 8, charisma: 8, loyalty: 40, ambition: 75, likes: ['front', 'rented', 'union'], refuses: ['brothel', 'loft', 'chopshop'] },
    // the lieutenants of the family in place: each runs a part of its places, and can be turned
    finn:  { lieutenant: 'Callahan', home: 'ashport', name: 'Finn O\'Rourke', specialty: 'Enforcer', muscle: 7, business: 4, cunning: 4, charisma: 4, loyalty: 35, ambition: 75, likes: ['loans', 'speakeasy'], refuses: ['front'] },
    nora:  { lieutenant: 'Callahan', home: 'ashport', name: 'Nora Callahan', specialty: 'Bookkeeper', muscle: 2, business: 8, cunning: 8, charisma: 5, loyalty: 30, ambition: 85, likes: ['front', 'gambling', 'rented'], refuses: ['brothel'] },
    sean:  { lieutenant: 'Callahan', home: 'ashport', name: 'Sean Brady', specialty: 'Bootlegger', muscle: 5, business: 6, cunning: 5, charisma: 7, loyalty: 40, ambition: 60, likes: ['still', 'speakeasy', 'warehouse'], refuses: [] },
    // Calder Falls, the Northside: mills, foundries and union halls
    aggie: { lieutenant: 'Northside', home: 'calder', name: 'Aggie Novak', specialty: 'Politician', muscle: 3, business: 5, cunning: 6, charisma: 8, loyalty: 40, ambition: 65, likes: ['union', 'speakeasy'], refuses: ['brothel'] },
    stan:  { lieutenant: 'Northside', home: 'calder', name: 'Stan Wozniak', specialty: 'Enforcer', muscle: 8, business: 3, cunning: 3, charisma: 4, loyalty: 45, ambition: 60, likes: ['chopshop', 'loans'], refuses: ['front'] },
    pete:  { lieutenant: 'Northside', home: 'calder', name: 'Pete Lindqvist', specialty: 'Bootlegger', muscle: 4, business: 7, cunning: 5, charisma: 4, loyalty: 35, ambition: 70, likes: ['still', 'warehouse'], refuses: ['loft'] },
    // Marrow Bay, the Callahans' cousins: canneries, shipyards and night boats
    declan: { lieutenant: 'Callahan', home: 'marrow', name: 'Declan Foley', specialty: 'Bootlegger', muscle: 5, business: 6, cunning: 6, charisma: 5, loyalty: 35, ambition: 70, likes: ['warehouse', 'still', 'fence'], refuses: [] },
    bridie: { lieutenant: 'Callahan', home: 'marrow', name: 'Bridie Nolan', specialty: 'Gambler', muscle: 3, business: 7, cunning: 6, charisma: 7, loyalty: 30, ambition: 80, likes: ['gambling', 'speakeasy'], refuses: ['chopshop'] },
    mick:   { lieutenant: 'Callahan', home: 'marrow', name: 'Mick Tierney', specialty: 'Enforcer', muscle: 8, business: 3, cunning: 4, charisma: 3, loyalty: 45, ambition: 55, likes: ['loans', 'fence'], refuses: ['front'] },
    // Dunmore, the Kesslers: coal, rail and breweries
    karl:  { lieutenant: 'Kessler', home: 'dunmore', name: 'Karl Kessler', specialty: 'Bootlegger', muscle: 5, business: 8, cunning: 5, charisma: 4, loyalty: 30, ambition: 85, likes: ['still', 'speakeasy', 'warehouse'], refuses: ['brothel'] },
    greta: { lieutenant: 'Kessler', home: 'dunmore', name: 'Greta Voss', specialty: 'Bookkeeper', muscle: 2, business: 8, cunning: 7, charisma: 5, loyalty: 40, ambition: 60, likes: ['front', 'rented', 'loans'], refuses: ['chopshop'] },
    lutz:  { lieutenant: 'Kessler', home: 'dunmore', name: 'Lutz Brauer', specialty: 'Enforcer', muscle: 8, business: 4, cunning: 3, charisma: 3, loyalty: 50, ambition: 50, likes: ['union', 'chopshop'], refuses: ['gambling'] },
    // Port Lorne, the Dockers: the sea port at the border
    joe:   { lieutenant: 'Dockers', home: 'lorne', name: 'Joe Macready', specialty: 'Bootlegger', muscle: 6, business: 6, cunning: 5, charisma: 5, loyalty: 40, ambition: 65, likes: ['warehouse', 'fence', 'speakeasy'], refuses: [] },
    tess:  { lieutenant: 'Dockers', home: 'lorne', name: 'Tess Ferreira', specialty: 'Pusher', muscle: 4, business: 6, cunning: 8, charisma: 5, loyalty: 30, ambition: 80, likes: ['loft', 'fence'], refuses: ['union'] },
    harry: { lieutenant: 'Dockers', home: 'lorne', name: 'Harry Doak', specialty: 'Enforcer', muscle: 9, business: 3, cunning: 3, charisma: 4, loyalty: 45, ambition: 55, likes: ['union', 'loans'], refuses: ['front'] },
    // Saint Vesper, the Callahans' old money: judges, bishops and private rooms
    aidan: { lieutenant: 'Callahan', home: 'vesper', name: 'Aidan Roche', specialty: 'Politician', muscle: 2, business: 6, cunning: 7, charisma: 9, loyalty: 35, ambition: 75, likes: ['front', 'gambling', 'rented'], refuses: ['chopshop'] },
    clara: { lieutenant: 'Callahan', home: 'vesper', name: 'Clara Devlin', specialty: 'Bookkeeper', muscle: 2, business: 9, cunning: 7, charisma: 5, loyalty: 40, ambition: 60, likes: ['loans', 'front'], refuses: ['brothel'] },
    owen:  { lieutenant: 'Callahan', home: 'vesper', name: 'Owen Gallagher', specialty: 'Gambler', muscle: 5, business: 6, cunning: 5, charisma: 6, loyalty: 45, ambition: 65, likes: ['gambling', 'brothel', 'speakeasy'], refuses: ['union'] },
    mallory: { key: 'precinct', name: 'Ed Mallory', specialty: 'Police captain', muscle: 6, business: 4, cunning: 7, charisma: 4, loyalty: 40, ambition: 60, likes: ['loans', 'gambling', 'fence'], refuses: ['loft'] }
  };

  // The chief of the old family in each city. The boss never hires him: he reads his name on the other side of the street.
  var CHIEFS = {
    seamus:  { chief: 'Callahan', home: 'ashport', name: 'Seamus Callahan' },
    viktor:  { chief: 'Northside', home: 'calder', name: 'Viktor Novak' },
    eamon:   { chief: 'Callahan', home: 'marrow', name: 'Eamon Callahan' },
    ernst:   { chief: 'Kessler', home: 'dunmore', name: 'Ernst Kessler' },
    red:     { chief: 'Dockers', home: 'lorne', name: 'Red Macready' },
    brendan: { chief: 'Callahan', home: 'vesper', name: 'Brendan Callahan' }
  };

  // What draws each big name to a family: places of a kind it runs, a key place it holds, or raids it has thrown back.
  var LURES = {
    sal:   { repelled: 1, burnt: 2, why: 'The family threw a raid back: Sal respects that', need: 'The family keeps getting burnt out: Sal smells work' },
    mae:   { runs: 'front', n: 1, why: 'A real front to keep books for' },
    dutch: { runs: 'speakeasy', n: 2, why: 'Bars that need a steady supply' },
    tommy: { key: 'cityhall', why: 'City Hall is his natural home' },
    vince: { runs: 'loft', n: 1, why: 'A loft already at work' },
    danny: { runs: 'gambling', n: 1, why: 'A room with tables to run' }
  };

  function who(id) { return D.CAPOS[id] || PEOPLE[id] || CHIEFS[id]; }

  // A man learns his trade. Every specialty belongs to a school, and at each rank after Soldier a capo gains the next
  // ability of his school. Each changes one rule for his own places, his own trucks or his own money.
  var SCHOOL = { Enforcer: 'Muscle', 'Dock boss': 'Muscle', 'Police captain': 'Muscle', 'Union man': 'Muscle', Bootlegger: 'Liquor', Brewmaster: 'Liquor',
                 Bookkeeper: 'Money', Politician: 'Law', Alderman: 'Law', Pusher: 'Vice', Hostess: 'Vice', Gambler: 'Games' };

  var SCHOOLS = {
    Muscle: [{ id: 'escorts', name: 'Escorts', gives: 'Nobody holds up his cars or his trucks' },
             { id: 'hard', name: 'Hard streets', gives: 'Two points of Muscle more against a raid' },
             { id: 'feared', name: 'Feared', gives: 'The rivals no longer raid the places he runs' }],
    Liquor: [{ id: 'nightruns', name: 'Night runs', gives: 'Each of his trucks makes two more runs a month' },
             { id: 'deep', name: 'Deep cellars', gives: 'His stills and stores keep twice as much' },
             { id: 'label', name: 'House label', gives: 'His bars earn 15% more' }],
    Money:  [{ id: 'tight', name: 'Tight books', gives: 'His men cost 15% less' },
             { id: 'ledgers', name: 'Double ledgers', gives: 'His laundries wash 25% more' },
             { id: 'silent', name: 'Silent partner', gives: 'He keeps half as much for himself' }],
    Law:    [{ id: 'friends', name: 'Friends downtown', gives: 'The police never stop his trucks' },
             { id: 'envelopes', name: 'Envelopes', gives: 'Taking a rival\'s place costs him 25% less' },
             { id: 'judge', name: 'The judge', gives: 'His city cools one point more a month' }],
    Vice:   [{ id: 'regulars', name: 'Regulars', gives: 'His brothels and lofts earn 15% more' },
             { id: 'dealers', name: 'House dealers', gives: 'Weed brings his places twice the bonus' },
             { id: 'harvest', name: 'Big harvest', gives: 'His lofts grow twice the weed' }],
    Games:  [{ id: 'edge', name: 'House edge', gives: 'His gambling rooms earn 15% more' },
             { id: 'markers', name: 'Markers', gives: 'His loans earn 25% more' },
             { id: 'backroom', name: 'Back room', gives: 'Hides $2,000 more of dirty money from the police' }]
  };

  // The abilities that make one kind of place earn more for the man who has them.
  var TRADE = { speakeasy: ['label', 1.15], brothel: ['regulars', 1.15], loft: ['regulars', 1.15], gambling: ['edge', 1.15], loans: ['markers', 1.25] };

  function schoolOf(capo) { return SCHOOL[who(capo).specialty]; }

  // What a capo has learned and what he still may, for his card.
  function abilities(f, capo) {
    var school = schoolOf(capo), rank = (f.men[capo] || {}).rank || 0;
    return SCHOOLS[school].map(function (a, i) { return { id: a.id, name: a.name, gives: a.gives, school: school, rank: i + 1, has: rank >= i + 1 }; });
  }

  // --- the boss's table ---
  // Three chairs for the whole family, for men who run no street. Each serves every city by what the man is good at.
  var CHAIRS = [{ post: 'bookkeeper', name: 'Bookkeeper', gives: function (p) { return 'Every laundry of the family washes ' + Math.round(100 * RULES.table.wash * p.business) + '% more'; } },
                { post: 'routes', name: 'Routes', gives: function (p) { return Math.floor(p.cunning / RULES.table.cunning) + ' more loads go down every road each month'; } },
                { post: 'fixer', name: 'Fixer', gives: function (p) { return 'Every city cools ' + Math.floor(p.charisma / RULES.table.charisma) + ' more a month'; } }];

  function chairOf(post) {
    var ch = CHAIRS.filter(function (q) { return q.post === post; })[0];
    if (!ch) throw new Error('no such chair: ' + post);
    return ch;
  }

  function sits(f, post) { return (f.table && f.table[post]) || null; }

  function table(f) {
    return CHAIRS.map(function (ch) {
      var id = sits(f, ch.post);
      return { post: ch.post, name: ch.name, capo: id, who: id ? who(id).name : null, specialty: id ? who(id).specialty : null, pay: RULES.table.pay,
               paid: id ? !(f.owed && f.owed[ch.post]) : null, gives: id ? ch.gives(who(id)) : null };
    });
  }

  function seated(f, id) { return CHAIRS.some(function (ch) { return sits(f, ch.post) === id; }); }

  // --- loyalty ---
  // What a man feels for the boss today, out of 100. He comes with what he is known for, and the boss's gestures move it.
  function loyalty(f, capo) {
    var m = f.men[capo];
    return m && m.loyal !== undefined ? m.loyal : who(capo).loyalty;
  }
  // A gesture he will remember. The month it happens, time does not pull him back.
  function sway(f, capo, by) {
    var m = f.men[capo];
    if (!m) return;
    m.loyal = Math.max(0, Math.min(100, loyalty(f, capo) + by));
    m.moved = true;
  }
  // What the boss can read of it: the number stays in the man's head.
  function mood(f, capo) {
    var l = loyalty(f, capo);
    return l < RULES.loyal.bitter ? 'bitter' : l < RULES.loyal.restless ? 'restless' : 'steady';
  }

  function can(c, capo, id) { var k = c.skills && c.skills[capo]; return !!(k && k[id]); }

  // The chief of the old family in this city, if it has one.
  function chiefOf(c) {
    if (!c.rival) return null;
    return Object.keys(CHIEFS).filter(function (id) { return CHIEFS[id].chief === c.rival && CHIEFS[id].home === c.id; })[0] || null;
  }

  function person(id) {
    if (!who(id)) throw new Error('unknown capo: ' + id);
    return who(id);
  }

  var api = { KEYS: KEYS, PEOPLE: PEOPLE, LURES: LURES, who: who, SCHOOLS: SCHOOLS, TRADE: TRADE, schoolOf: schoolOf, abilities: abilities,
      CHAIRS: CHAIRS, chairOf: chairOf, sits: sits, table: table, seated: seated, can: can, person: person, chiefOf: chiefOf, CHIEFS: CHIEFS, loyalty: loyalty, sway: sway, mood: mood };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportTurfPeople = api;
})(typeof self !== 'undefined' ? self : this);
