// The places a capo can run and the six men a boss can start with.
// Tables only: the rules that read them are in the turf-*.js files.
//
// To retune, change SITES (what a place costs to open; what a front washes
// a month and the share it keeps) and CAPOS (stats from 1 to 10, loyalty
// and ambition out of 100, the places he likes and the ones he refuses).
(function (root) {
  'use strict';

  var RULES = { maxLevel: 3 };   // a place grows up to this level

  var SITES = {
    still:     { name: 'Cellar still',   cost: 400 },
    speakeasy: { name: 'Speakeasy',      cost: 600 },
    gambling:  { name: 'Gambling room',  cost: 500 },
    loft:      { name: 'Cannabis loft',  cost: 700 },
    rented:    { name: 'Rented laundry', cost: 300, wash: 300, loss: 0.25 },
    front:     { name: 'Owned front',    cost: 1000, wash: 500, loss: 0.15 },
    warehouse: { name: 'Warehouse',      cost: 1200 },
    brothel:   { name: 'Brothel',        cost: 800 },
    chopshop:  { name: 'Chop shop',      cost: 700 },
    fence:     { name: 'Fence',          cost: 500 },
    loans:     { name: 'Loan office',    cost: 600 },
    union:     { name: 'Union local',    cost: 900 }
  };

  var CAPOS = {
    sal:   { name: 'Sal "the Hammer" Moretti', specialty: 'Enforcer', muscle: 8, business: 4, cunning: 3, charisma: 6, loyalty: 65, ambition: 70,
             likes: ['protection', 'seize', 'push', 'loans'], refuses: ['bribe'] },
    mae:   { name: 'Mae "the Ledger" Whitlock', specialty: 'Bookkeeper', muscle: 2, business: 8, cunning: 8, charisma: 4, loyalty: 70, ambition: 40,
             likes: ['front', 'rented', 'bribe'], refuses: ['protection', 'seize', 'loft', 'brothel'] },
    dutch: { name: 'Dutch Keller', specialty: 'Bootlegger', muscle: 5, business: 7, cunning: 5, charisma: 3, loyalty: 55, ambition: 50,
             likes: ['still', 'speakeasy', 'warehouse', 'fence'], refuses: ['protection'] },
    tommy: { name: 'Tommy "the Priest" Byrne', specialty: 'Politician', muscle: 3, business: 5, cunning: 6, charisma: 9, loyalty: 80, ambition: 30,
             likes: ['speakeasy', 'gambling', 'bribe', 'union'], refuses: ['loft', 'seize', 'brothel'] },
    vince: { name: 'Vince "Three-Fingers" Kowalski', specialty: 'Pusher', muscle: 7, business: 3, cunning: 6, charisma: 3, loyalty: 45, ambition: 80,
             likes: ['loft', 'push', 'seize', 'chopshop'], refuses: ['front'] },
    danny: { name: 'Danny "the Kid" Reyes', specialty: 'Gambler', muscle: 5, business: 6, cunning: 4, charisma: 6, loyalty: 60, ambition: 90,
             likes: ['gambling', 'push', 'loft', 'brothel'], refuses: [] }
  };

  var api = { RULES: RULES, SITES: SITES, CAPOS: CAPOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportDistrict = api;
})(typeof self !== 'undefined' ? self : this);
