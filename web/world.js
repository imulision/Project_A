// The map of the game: six cities, their street names, and the routes
// between them. No drawing, no browser and no rules here.
//
// To change the map, edit CITIES and ROUTES. Nothing else needs to change.
(function (root) {
  'use strict';

  function place(id, name, nightlife, industry, port, wealth) {
    return { id: id, name: name, traits: { nightlife: nightlife, industry: industry, port: port, wealth: wealth } };
  }

  // x, y and terrain are for the map (the same list is read by the 3D view);
  // character says what the city is good for;
  // rival is the family that holds it at the start.
  var CITIES = [
    { id: 'ashport', name: 'Ashport', x: -70, y: 95, terrain: 'plain', character: 'The big city. Everything passes through it.', rival: 'Callahan',
      districts: [
        place('ashport-uptown', 'Uptown', 1.2, 0, 0, 1.5),
        place('ashport-hillside', 'Hillside', 1, 0.4, 0, 1.2),
        place('ashport-market', 'Market Street', 1.5, 0.5, 0, 1),
        place('ashport-station', 'Union Station', 0.8, 1, 0.8, 0.8),
        place('ashport-calabria', 'Little Calabria', 1.2, 0.5, 0, 0.5),
        place('ashport-canal', 'Canal Street', 1, 1, 0.8, 0.5),
        place('ashport-stockyards', 'Stockyards', 0.5, 1.5, 0.5, 0.5),
        place('ashport-docks', 'The Docks', 0.8, 1.2, 1.5, 0.5)
      ] },
    { id: 'calder', name: 'Calder Falls', x: 30, y: 20, terrain: 'mountains', character: 'A mill town in the hills. Foundries, quarries and unions.', rival: 'Northside',
      districts: [
        place('calder-millrace', 'Millrace', 0.5, 1.5, 0, 0.5),
        place('calder-highstreet', 'High Street', 1.2, 0.5, 0, 1.2),
        place('calder-landing', 'The Landing', 1, 0.8, 0.8, 0.5),
        place('calder-quarry', 'Quarry Row', 0.5, 1.2, 0, 0.5),
        place('calder-foundry', 'Foundry', 0.5, 1.5, 0, 0.5),
        place('calder-northgate', 'Northgate', 0.8, 0.5, 0, 1.2),
        place('calder-ironbridge', 'Iron Bridge', 1, 1, 0.5, 0.8)
      ] },
    { id: 'marrow', name: 'Marrow Bay', x: 75, y: 150, terrain: 'coast', character: 'A bay of canneries, shipyards and night boats.', rival: 'Callahan',
      districts: [
        place('marrow-oldtown', 'Old Town', 1.5, 0.5, 0, 1),
        place('marrow-cannery', 'Cannery Row', 0.5, 1.5, 1, 0.5),
        place('marrow-bayside', 'Bayside', 1.2, 0, 0.5, 1.5),
        place('marrow-flats', 'The Flats', 0.8, 1, 0, 0.5),
        place('marrow-lantern', 'Lantern Row', 1.5, 0, 0, 0.8),
        place('marrow-shipwrights', 'Shipwrights', 0.5, 1.2, 1.5, 0.5)
      ] },
    { id: 'dunmore', name: 'Dunmore', x: -15, y: 235, terrain: 'hills', character: 'Coal, rail and breweries. Hard men and company stores.', rival: 'Kessler',
      districts: [
        place('dunmore-depot', 'Depot', 0.8, 1.2, 0.8, 0.5),
        place('dunmore-coalhill', 'Coal Hill', 0.5, 1.5, 0, 0.5),
        place('dunmore-main', 'Main Street', 1.2, 0.5, 0, 1.2),
        place('dunmore-brewers', 'Brewers Yard', 1, 1.2, 0, 0.8),
        place('dunmore-pitrow', 'Pit Row', 0.5, 1.5, 0, 0.5),
        place('dunmore-gallows', 'Gallows Corner', 1.5, 0.5, 0, 0.5)
      ] },
    { id: 'lorne', name: 'Port Lorne', x: 50, y: 370, terrain: 'coast', character: 'The sea port at the border. Whisky comes in here.', rival: 'Dockers',
      districts: [
        place('lorne-harbour', 'Harbour', 1, 0.8, 1.5, 0.5),
        place('lorne-saltworks', 'Saltworks', 0.5, 1.5, 0.5, 0.5),
        place('lorne-chapel', 'Chapel Hill', 0.5, 0, 0, 1.5),
        place('lorne-netmakers', 'Netmakers', 0.8, 1, 1, 0.5),
        place('lorne-customs', 'Customs House', 0.5, 0.5, 1.5, 1.2),
        place('lorne-ropewalk', 'Rope Walk', 1.5, 0.5, 0.8, 0.5),
        place('lorne-breakwater', 'Breakwater', 0.8, 0.5, 1.2, 0.5)
      ] },
    { id: 'vesper', name: 'Saint Vesper', x: -85, y: 300, terrain: 'plain', character: 'The cathedral city. Judges, bishops and old money.', rival: 'Callahan',
      districts: [
        place('vesper-cathedral', 'Cathedral', 0.5, 0, 0, 1.5),
        place('vesper-tannery', 'Tannery', 0.5, 1.5, 0, 0.5),
        place('vesper-hill', 'Vesper Hill', 0.8, 0, 0, 1.5),
        place('vesper-lowgate', 'Lowgate', 1.5, 0.5, 0, 0.5),
        place('vesper-bishops', 'Bishops Court', 1, 0, 0, 1.5),
        place('vesper-slaughter', 'Slaughter Lane', 1, 1.2, 0, 0.5),
        place('vesper-paupers', 'Paupers Field', 0.8, 0.8, 0, 0.5)
      ] }
  ];
  var ROUTES = [
    { from: 'ashport', to: 'calder', kind: 'rail' },
    { from: 'ashport', to: 'marrow', kind: 'road' },
    { from: 'ashport', to: 'dunmore', kind: 'rail' },
    { from: 'calder', to: 'marrow', kind: 'road' },
    { from: 'marrow', to: 'dunmore', kind: 'road' },
    { from: 'dunmore', to: 'vesper', kind: 'road' },
    { from: 'dunmore', to: 'lorne', kind: 'rail' },
    { from: 'vesper', to: 'lorne', kind: 'road' },
    { from: 'marrow', to: 'lorne', kind: 'sea' }
  ];

  var api = { CITIES: CITIES, ROUTES: ROUTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportWorld = api;
})(typeof self !== 'undefined' ? self : this);
