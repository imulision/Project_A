// The pictures of the screen, as SVG text: icons for places, stats, cargo and
// moves, a face for every capo, small curves and round gauges.
// Nothing here knows a rule: it only draws what it is asked by name, and an
// unknown name gets a plain mark so a new rule never breaks the screen.
(function (root) {
  'use strict';

  // ---- icons, drawn on a 24 x 24 grid in the colour of the text around them
  var P = {
    // stats of a man
    muscle: '<path d="M3 9h13l1-2h4v5h-3l-1 2h-4v2h-3l-1 4H6l1-6H3z"/>',
    business: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 4v1.6c1.7.3 2.9 1.3 3 2.9h-2.2c-.1-.7-.8-1.1-1.8-1.1-1.100 0-1.800.5-1.800 1.200 0 .700.600 1 2.200 1.400 2.400.500 3.900 1.300 3.900 3.300 0 1.600-1.300 2.700-3.300 3V20h-2v-1.700c-2-.300-3.300-1.500-3.400-3.300h2.200c.100.900.900 1.500 2.200 1.500 1.200 0 2-.500 2-1.300s-.600-1.100-2.400-1.500c-2.300-.500-3.700-1.300-3.700-3.200 0-1.500 1.200-2.600 3.100-2.900V6z"/>',
    cunning: '<path d="M12 5C6.500 5 2.700 9.500 1.500 12c1.200 2.500 5 7 10.500 7s9.300-4.500 10.500-7C21.300 9.500 17.500 5 12 5zm0 3.200a3.800 3.800 0 1 1 0 7.600 3.800 3.800 0 0 1 0-7.600zm0 2a1.800 1.800 0 1 0 0 3.600 1.800 1.800 0 0 0 0-3.600z"/>',
    charisma: '<path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-5.500 4.500V17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 4.500v2h10v-2zm0 4v2h7v-2z"/>',
    loyalty: '<path d="M12 2l8 3v6.500c0 5-3.400 8.700-8 10.500-4.600-1.800-8-5.500-8-10.500V5zm-1.200 12.800l5.700-5.700-1.500-1.500-4.200 4.200-1.800-1.800-1.500 1.500z"/>',
    ambition: '<path d="M2.500 7l4.500 4L12 4l5 7 4.500-4-1.800 11H4.300zM4.500 19.500h15V22h-15z"/>',
    // what the family counts
    clean: '<path d="M2 7h20v12H2zm2.500 2.500v7h15v-7zM12 10.500a2.500 2.500 0 1 1 0 5 2.500 2.500 0 0 1 0-5zM19 1l.9 2.100L22 4l-2.100.9L19 7l-.9-2.100L16 4l2.100-.9z"/>',
    men: '<path d="M12 2.500a4.500 4.500 0 1 1 0 9 4.500 4.500 0 0 1 0-9zM3.500 21.500c0-4.700 3.800-8 8.500-8s8.500 3.300 8.500 8z"/>',
    streets: '<path d="M9 2h6l4 20H5zm2.300 3l-.3 3h2l-.3-3zm-.5 5.500l-.4 4h3.200l-.4-4zm-.7 6.500l-.300 3h4.400l-.3-3z"/>',
    heat: '<path d="M11 1h2v3h-2zM3.200 4.600l1.400-1.400 2.200 2.200-1.400 1.400zM19.400 3.200l1.400 1.400-2.200 2.200-1.400-1.400zM12 6.500a6 6 0 0 1 6 6V18H6v-5.500a6 6 0 0 1 6-6zM3.500 19.500h17V22h-17z"/>',
    goodwill: '<path d="M12 21.500C6 17 2 13.500 2 9a5 5 0 0 1 10-1.500A5 5 0 0 1 22 9c0 4.500-4 8-10 12.500z"/>',
    profit: '<path d="M3 20.500V18l6-6.500 4 3.500 5.500-6.500H15V6h7v7h-2.500V10.300L13.300 18l-4.100-3.500L5 19v1.500z"/>',
    // what rolls
    truck: '<path d="M1 5h13v10H1zm14 3h4.500L23 12v5h-2a2.500 2.500 0 0 1-5 0h-1zm1.500 1.800v2.700h4.300l-1.900-2.700zM3 17h-2v-1h13v1H8a2.500 2.500 0 0 1-5 0zm2.500-1.300a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600zm13 0a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600z"/>',
    car: '<path d="M6.500 6h11l2.500 5 2 1v5h-2.500a2.500 2.500 0 0 1-5 0h-5a2.500 2.500 0 0 1-5 0H2v-5l2-1zm1.300 2l-1.500 3h4.700V8zm5.200 0v3h4.700l-1.500-3zM7 15.700a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600zm10 0a1.300 1.300 0 1 0 0 2.600 1.300 1.300 0 0 0 0-2.600z"/>',
    police: '<path d="M12 1.500l2.300 3.300 3.900-.700.300 4 3.500 1.900-1.900 3.500 1.900 3.500-3.500 1.900-.3 4-3.900-.700L12 22.500l-2.300-3.300-3.900.700-.3-4L2 14l1.900-3.500L2 7l3.500-1.900.3-4 3.900.700zm0 6.500a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
    // the places of the family
    still: '<path d="M9 2h6v2h-1v2.200c3 .900 5 3.700 5 6.800v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7c0-3.100 2-5.900 5-6.800V4H9zM7.500 13v3h9v-3z"/>',
    speakeasy: '<path d="M3 3h18l-8 9.500V19h4v2.500H7V19h4v-6.500zm4.500 2l1.700 2h5.600l1.700-2z"/>',
    gambling: '<path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm3.500 3.500a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-4.500 4.500a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm9 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
    loft: '<path d="M12 1.500c1.500 3 2 6 1.300 9.500 2-2.500 4.500-4 7.700-4.500-.800 3.300-2.800 5.700-5.800 7.200 2.300-.2 4.300.3 6.300 1.800-2.500 1.800-5.200 2.200-8 1.200L13 22.500h-2l-.5-5.800c-2.800 1-5.500.600-8-1.200 2-1.500 4-2 6.300-1.800-3-1.500-5-3.900-5.800-7.200 3.200.500 5.700 2 7.700 4.500C10 7.500 10.500 4.500 12 1.500z"/>',
    rented: '<path d="M8 2l4 2.500L16 2l6 4-2.500 4L17 8.500V22H7V8.500L4.500 10 2 6z"/>',
    front: '<path d="M2 3h20l-1 6a3 3 0 0 1-3 2 3 3 0 0 1-3-2 3 3 0 0 1-6 0 3 3 0 0 1-3 2 3 3 0 0 1-3-2zm1.500 10h17v9h-7v-6h-4v6h-6z"/>',
    warehouse: '<path d="M12 2l10 5v15h-3V10H5v12H2V7zM7 12h10v2.500H7zm0 4h10v2.500H7zm0 4h10V22H7z"/>',
    brothel: '<path d="M12 1.500l1.500 2.500h-3zM8 5h8l2 9c0 3.500-2.500 6-6 6s-6-2.500-6-6zm4 4c-1.500 2-2.200 3.500-2.200 5a2.200 2.200 0 0 0 4.400 0c0-1.500-.700-3-2.200-5zM10.500 20.500h3v2h-3z"/>',
    chopshop: '<path d="M21.500 6.500a5.500 5.500 0 0 1-7.300 5.200L6 20a2.100 2.100 0 0 1-3-3l8.300-8.200A5.500 5.500 0 0 1 17.500 2l-3 3 .5 3 3 .5 3-3c.300.600.500 1.300.500 2z"/>',
    fence: '<path d="M6 3h12l4 6-10 13L2 9zm1.200 2L5 8.300h4.200L10.500 5zm5.800 0l1.300 3.300H19L16.800 5zM5.500 10.300l5 7.200-1.800-7.200zm5.300 0l1.200 5 1.200-5zm4.500 0l-1.800 7.200 5-7.200z"/>',
    loans: '<path d="M7 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2.500a1.500 1.500 0 1 0 0 3 1.500 1.500 0 0 0 0-3zM18.500 2.500l2 1.500-15 17.500-2-1.500zM17 13a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2.500a1.500 1.500 0 1 0 0 3 1.500 1.500 0 0 0 0-3z"/>',
    union: '<path d="M10.300 1.500h3.400l.5 2.700 2 .800 2.300-1.600 2.400 2.400-1.600 2.300.8 2 2.700.5v3.400l-2.700.5-.8 2 1.600 2.300-2.400 2.400-2.300-1.600-2 .8-.5 2.700h-3.400l-.5-2.700-2-.8-2.300 1.600-2.400-2.400 1.600-2.300-.8-2-2.700-.5v-3.400l2.700-.5.8-2-1.600-2.300 2.400-2.400 2.300 1.600 2-.8zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
    hideout: '<path d="M12 2l10 8.500h-3V22h-5v-7h-4v7H5V10.500H2z"/>',
    // what a capo does
    protection: '<path d="M12 2l8 3v6.500c0 5-3.400 8.700-8 10.500-4.600-1.800-8-5.500-8-10.500V5zm0 2.700L6.500 6.700v4.800c0 3.600 2.300 6.300 5.500 7.800z"/>',
    seize: '<path d="M11 1h2v3.100A8 8 0 0 1 19.900 11H23v2h-3.100A8 8 0 0 1 13 19.900V23h-2v-3.100A8 8 0 0 1 4.100 13H1v-2h3.100A8 8 0 0 1 11 4.100zm1 5.500a5.500 5.500 0 1 0 0 11 5.500 5.500 0 0 0 0-11zm0 3.500a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
    push: '<path d="M12 1l4.500 5H13.500v4.500H18V7.500l5 4.500-5 4.500v-3h-4.500V18h3L12 23l-4.500-5h3v-4.500H6v3L1 12l5-4.500v3h4.500V6h-3z"/>',
    bribe: '<path d="M2 5h20v14H2zm3.200 2.500L12 12.300l6.800-4.800zM4.500 9.500v7h15v-7L12 15z"/>',
    // what moves, and why
    liquor: '<path d="M10 1.500h4V6l2.500 4v10.500a1.500 1.500 0 0 1-1.500 1.500H9a1.500 1.500 0 0 1-1.500-1.500V10L10 6zm-.5 10.500v5.500h5V12z"/>',
    takings: '<path d="M8.500 2h7l-1.700 3.500c3.500 1.500 6.200 5.500 6.200 9.800 0 4-3 6.700-8 6.700s-8-2.700-8-6.700c0-4.300 2.700-8.300 6.200-9.800zM11 9.500v1c-1.300.3-2.200 1.200-2.200 2.400 0 1.500 1.100 2.100 2.900 2.500 1.200.3 1.500.5 1.500 1 0 .500-.500.800-1.300.800-.9 0-1.400-.4-1.500-1.100H8.600c.100 1.400 1 2.300 2.400 2.600v1h2v-1c1.400-.3 2.300-1.200 2.300-2.500 0-1.600-1.200-2.200-3-2.600-1.100-.3-1.400-.5-1.400-.9s.4-.7 1.100-.7c.8 0 1.200.3 1.300.9h1.800c-.1-1.200-.9-2.100-2.100-2.400v-1z"/>',
    laundering: '<path d="M12 1.500C8 7 5 10.500 5 14.500a7 7 0 0 0 14 0c0-4-3-7.500-7-13zM8.500 14.500h2a2 2 0 0 0 2 2v2a4 4 0 0 1-4-4z"/>',
    tribute: '<path d="M12 1l6 6.500h-4V13h-4V7.500H6zM4 15h16v2.500H4zm0 4h16v2.500H4z"/>',
    works: '<path d="M3 4h10l3 3v2h-3l-1-1H9v2.500L20.500 21 18 23.500 7 12H5v-2H3z"/>',
    collection: '<path d="M4 6.500h16v2.500l-1.500 1 1.500 1v2.500l-1.500 1 1.500 1V18H4zM6.500 9v2h8V9zm0 4v2h5v-2zM9 2h6v3H9zM2 19.500h20V22H2z"/>',
    raid: '<path d="M11 1h2v3h-2zM3.200 4.600l1.400-1.400 2.200 2.200-1.400 1.400zM19.400 3.200l1.400 1.400-2.200 2.200-1.400-1.400zM12 6.500a6 6 0 0 1 6 6V18H6v-5.500a6 6 0 0 1 6-6zM3.500 19.500h17V22h-17z"/>',
    attack: '<path d="M12 1l2.200 5.500L19 3.500l-1.500 5.500 5.500.500-4.500 3.500 3.500 4.500-5.700-1 .2 6-4.500-4-4.500 4 .2-6-5.700 1 3.500-4.500L1 9.500 6.500 9 5 3.500l4.800 3z"/>',
    hit: '<path d="M12 2a8.500 8.500 0 0 1 8.500 8.500c0 3-1.500 5.300-3.500 6.700V21h-2.500v-2h-1.500v2h-2v-2H9.500v2H7v-3.800c-2-1.400-3.500-3.700-3.500-6.700A8.500 8.500 0 0 1 12 2zM8.500 9a2.200 2.200 0 1 0 0 4.400 2.200 2.200 0 0 0 0-4.400zm7 0a2.200 2.200 0 1 0 0 4.400 2.200 2.200 0 0 0 0-4.400zM12 13.500L10.800 16h2.400z"/>',
    kidnap: '<path d="M8 2h8l1 3.500-2 1.500c3.500 1.500 5.500 5 5.500 9 0 3.500-3 6-8.500 6s-8.500-2.500-8.500-6c0-4 2-7.500 5.500-9L7 5.500zm1.200 5.300L8.500 9h7l-.7-1.700zM8 13.500l3 1.500-3 1.500zm8 0v3l-3-1.500z"/>',
    time: '<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2.500a7.500 7.500 0 1 0 0 15 7.500 7.500 0 0 0 0-15zM11 7h2.200v4.600l3.300 2-1.100 1.900-4.400-2.600z"/>',
    yes: '<path d="M9.500 18.500L3 12l2.500-2.500 4 4 9-9L21 7z"/>',
    no: '<path d="M5.500 3L12 9.500 18.500 3 21 5.500 14.500 12l6.500 6.500-2.500 2.500-6.500-6.500L5.500 21 3 18.500 9.500 12 3 5.500z"/>',
    unknown: '<path d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z"/>'
  };
  P.streetsCrew = P.streets; P.seizure = P.seize;
  P.raid = P.heat;

  P.cars = P.car;
  // loyalty: a gift from the boss, word that gets around, a man who goes over
  P.gift = '<path d="M9 2a3 3 0 0 1 3 2 3 3 0 0 1 3-2 2.800 2.800 0 0 1 2.300 4.500H21V11H3V6.500h3.700A2.800 2.800 0 0 1 9 2zm0 2.200a.900.900 0 0 0 0 1.800h1.600C10.400 5 9.800 4.200 9 4.200zm6 0c-.800 0-1.400.800-1.600 1.800H15a.900.900 0 0 0 0-1.800zM4.500 12.500h6.300V22H4.500zm8.700 0h6.300V22h-6.300z"/>';
  P.whispers = P.charisma;
  // a capo asks the boss something: a speech bubble with a question mark (never a bare clock)
  P.ask = '<path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 2.500c-2 0-3.400 1.200-3.500 3h2c.100-.700.600-1.100 1.400-1.100.900 0 1.400.500 1.400 1.100 0 .600-.300.900-1.200 1.500-1 .600-1.600 1.300-1.600 2.500v.500h2v-.400c0-.600.300-.900 1.100-1.400 1-.600 1.800-1.400 1.800-2.600 0-1.800-1.500-3.100-3.400-3.100zM11 14h2v2h-2z"/>';
  P.betrayal = '<path d="M20.500 2l1.500 1.500-9.500 11-2-2zM8.500 12.500l3 3-1.700 1.700 1.200 1.200-1.500 1.500-1.200-1.200L5.500 21.500 2.500 18.500l2.800-2.800-1.200-1.200 1.500-1.500 1.200 1.200z"/>';
  P.dirty = P.takings;      // dirty cash has one picture everywhere: the bag, on the top bar, on the cars and in the sheets
  function has(name) { return Object.prototype.hasOwnProperty.call(P, name) && name !== 'unknown'; }
  function icon(name, title) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">' + (title ? '<title>' + title + '</title>' : '') + (has(name) ? P[name] : P.unknown) + '</svg>';
  }

  // ---- faces: a bust under a hard light, one for every capo
  var FACES = {
    sal:   { skin: '#c79872', tone: '#e8744f', hat: 'fedora', felt: '#2b2428', jaw: 17, moustache: true, cigar: true, tie: '#8a2a22' },
    mae:   { skin: '#e2b99b', tone: '#7fe08a', hat: 'cloche', felt: '#3a2c3f', jaw: 13.500, glasses: true, lips: true, hair: '#2a1c1a', pearls: true },
    dutch: { skin: '#d3a585', tone: '#ffb347', hat: 'cap', felt: '#4a4034', jaw: 16, beard: true, tie: null },
    tommy: { skin: '#dcb497', tone: '#6aa6ff', hat: null, jaw: 14.500, hair: '#b9b4ae', collar: true },
    vince: { skin: '#bf9478', tone: '#b98cff', hat: 'fedora', felt: '#1d2230', jaw: 13.500, scar: true, tilt: -7, tie: '#39304f' },
    danny: { skin: '#cf9d76', tone: '#ffe06a', hat: null, jaw: 14.500, hair: '#1c1614', bow: true, grin: true, quiff: true },
    // the men and women they bring up
    rocco: { skin: '#b98a66', tone: '#e8744f', hat: 'cap', felt: '#2f2a2a', jaw: 17.500, scar: true, tie: null },
    ida:   { skin: '#e6c2a6', tone: '#7fe08a', hat: 'cloche', felt: '#2d3a34', jaw: 13, lips: true, hair: '#6b4a2e', glasses: true },
    otto:  { skin: '#d9ad8c', tone: '#ffb347', hat: null, jaw: 16.500, hair: '#8a6a45', beard: true, moustache: true, tie: null },
    frank: { skin: '#e0b79a', tone: '#6aa6ff', hat: 'fedora', felt: '#4a4a52', jaw: 14, glasses: true, tie: '#2e4470' },
    lena:  { skin: '#e9c9b3', tone: '#b98cff', hat: 'cloche', felt: '#191a24', jaw: 13.500, lips: true, hair: '#d8c28a', scar: true },
    ray:   { skin: '#c4946c', tone: '#ffe06a', hat: 'fedora', felt: '#5a4a2c', jaw: 14.500, moustache: true, grin: true, bow: true, tilt: 6 },
    // those who hold a key place
    gus:    { skin: '#dcae90', tone: '#d9a05a', hat: 'cap', felt: '#5b4a3a', jaw: 17, moustache: true, beard: true, tie: null },
    vivian: { skin: '#edd0bb', tone: '#ff8fb0', hat: 'cloche', felt: '#5a1f33', jaw: 13, lips: true, hair: '#1a1416', pearls: true },
    jim:    { skin: '#b8875f', tone: '#ff6a5a', hat: 'cap', felt: '#1f2a36', jaw: 18, cigar: true, tie: null },
    walt:   { skin: '#cfa27e', tone: '#c8d0ff', hat: null, jaw: 16.500, hair: '#3a2f2a', moustache: true, tie: null },
    hugh:   { skin: '#e3bfa6', tone: '#e8c463', hat: null, jaw: 14, hair: '#d9d5cf', glasses: true, bow: true },
    mallory: { skin: '#d2a684', tone: '#5a8dff', hat: 'cap', felt: '#16203a', jaw: 16, moustache: true, tie: '#16203a' },
    // the lieutenants of the other families, each under his family's colour
    finn:   { skin: '#d8a988', tone: '#4fd07a', hat: 'cap', felt: '#26352b', jaw: 17.500, scar: true, tie: null },
    nora:   { skin: '#ecc9b0', tone: '#4fd07a', hat: 'cloche', felt: '#1f3a2a', jaw: 13, lips: true, hair: '#a6532a', glasses: true },
    sean:   { skin: '#e0b494', tone: '#4fd07a', hat: null, jaw: 15, hair: '#a6532a', grin: true, tie: '#1f5a36', quiff: true },
    declan: { skin: '#d6a784', tone: '#4fd07a', hat: 'fedora', felt: '#24382c', jaw: 15, beard: true, tie: '#1f5a36' },
    bridie: { skin: '#eccdb6', tone: '#4fd07a', hat: 'cloche', felt: '#3a2a1c', jaw: 13.500, lips: true, hair: '#1c1614', pearls: true },
    mick:   { skin: '#c99670', tone: '#4fd07a', hat: null, jaw: 18, hair: '#2a201c', moustache: true, cigar: true, tie: null },
    aidan:  { skin: '#e6c0a4', tone: '#4fd07a', hat: null, jaw: 14, hair: '#c9c4bc', collar: true, glasses: true },
    clara:  { skin: '#e9c6ac', tone: '#4fd07a', hat: 'cloche', felt: '#22242c', jaw: 12.500, lips: true, hair: '#8a6a45' },
    owen:   { skin: '#d2a17c', tone: '#4fd07a', hat: 'fedora', felt: '#3c3a2a', jaw: 14.500, grin: true, bow: true, tilt: -5 },
    aggie:  { skin: '#eac8b0', tone: '#5aa2ff', hat: 'cloche', felt: '#1c2a44', jaw: 13.500, lips: true, hair: '#c9c4bc', pearls: true },
    stan:   { skin: '#c9997a', tone: '#5aa2ff', hat: 'cap', felt: '#232b3a', jaw: 18, moustache: true, scar: true, tie: null },
    pete:   { skin: '#e8c4a8', tone: '#5aa2ff', hat: null, jaw: 15, hair: '#e0cf9a', beard: true, tie: null },
    karl:   { skin: '#dcb090', tone: '#b88cff', hat: 'fedora', felt: '#2a2238', jaw: 16, moustache: true, glasses: true, tie: '#4a3a70' },
    greta:  { skin: '#efd2bd', tone: '#b88cff', hat: 'cloche', felt: '#2e2440', jaw: 13, lips: true, hair: '#e0cf9a', glasses: true },
    lutz:   { skin: '#c79872', tone: '#b88cff', hat: null, jaw: 18, hair: '#141218', scar: true, tie: null },
    joe:    { skin: '#b98a66', tone: '#ff6a5a', hat: 'cap', felt: '#3a2622', jaw: 16.500, beard: true, cigar: true, tie: null },
    tess:   { skin: '#c99670', tone: '#ff6a5a', hat: 'cloche', felt: '#3a1c1c', jaw: 13.500, lips: true, hair: '#141218', scar: true },
    harry:  { skin: '#cfa27e', tone: '#ff6a5a', hat: null, jaw: 18.500, hair: '#5a3a22', moustache: true, beard: true, tie: null }
  };
  var ANON = { skin: '#8d8790', tone: '#a39fb0', hat: 'fedora', felt: '#26252d', jaw: 15 };

  function portrait(id) {
    var f = FACES[id] || ANON, u = 'f' + String(id).replace(/[^a-z0-9]/gi, ''), j = f.jaw, s = '';
    var shade = 'rgba(12,8,16,.48)';
    s += '<svg class="face" viewBox="0 0 80 96" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
      '<radialGradient id="' + u + 'g" cx=".25" cy=".25" r=".95"><stop offset="0" stop-color="' + f.tone + '" stop-opacity=".55"/><stop offset=".55" stop-color="#231d2b"/><stop offset="1" stop-color="#0c0b11"/></radialGradient>' +
      '<clipPath id="' + u + 'h"><path d="M' + (40 - j) + ' 38c0-22 ' + (2 * j) + '-22 ' + (2 * j) + ' 0v9c0 9-' + (j * 0.55) + ' 17-' + j + ' 17s-' + j + '-8-' + j + '-17z"/></clipPath></defs>' +
      '<rect width="80" height="96" fill="url(#' + u + 'g)"/>';
    // shoulders, shirt, neck
    s += '<path d="M2 96c0-18 10-24 26-27l12 6 12-6c16 3 26 9 26 27z" fill="#17161d"/>';
    if (f.collar) s += '<path d="M30 69l10 7 10-7v6l-10 6-10-6z" fill="#101016"/><rect x="35.500" y="71.500" width="9" height="4.500" rx="1" fill="#eee9df"/>';
    else s += '<path d="M31 68l9 12 9-12-9 4z" fill="#e9e3d6"/>' + (f.bow ? '<path d="M32 74l8 3 8-3v7l-8-3-8 3z" fill="#7a1f1f"/>' : f.tie ? '<path d="M38 73h4l2.500 23h-9z" fill="' + f.tie + '"/>' : '') +
      '<path d="M2 96c0-18 10-24 26-27l9 27zM78 96c0-18-10-24-26-27l-9 27z" fill="#1d1c25"/>';
    if (f.pearls) s += '<path d="M31 71q9 8 18 0" fill="none" stroke="#f2ead8" stroke-width="2.200" stroke-dasharray=".1 3.200" stroke-linecap="round"/>';
    s += '<path d="M33 56h14v14l-7 5-7-5z" fill="' + f.skin + '"/><path d="M33 60q7 6 14 0v-4H33z" fill="' + shade + '"/>';
    // long hair sits behind the head
    if (f.hat === 'cloche') s += '<path d="M' + (38 - j) + ' 36q-3 14 3 24h6V34zM' + (42 + j) + ' 36q3 14-3 24h-6V34z" fill="' + f.hair + '"/>';
    // the head, lit from the left
    s += '<g clip-path="url(#' + u + 'h)"><rect x="18" y="18" width="44" height="50" fill="' + f.skin + '"/>' +
      '<path d="M44 18h20v52H40q7-12 4-26z" fill="' + shade + '"/>' +
      (f.beard ? '<path d="M20 47q20 10 40 0v22H20z" fill="rgba(40,30,26,.55)"/>' : '') + '</g>';
    // ears, nose, eyes, mouth
    s += '<path d="M39 44l-3.500 8h5z" fill="rgba(0,0,0,.22)"/>';
    s += '<rect x="30" y="42.500" width="6.500" height="2" rx="1" fill="#141218"/><rect x="43.500" y="42.500" width="6.500" height="2" rx="1" fill="#141218"/>' +
      '<path d="M29 40.500l8-1M43 39.500l8 1" stroke="#141218" stroke-width="1.600" stroke-linecap="round"/>';
    if (f.glasses) s += '<circle cx="33.200" cy="43.500" r="5" fill="rgba(255,255,255,.12)" stroke="#e8c463" stroke-width="1.200"/><circle cx="46.800" cy="43.500" r="5" fill="rgba(255,255,255,.12)" stroke="#e8c463" stroke-width="1.200"/><path d="M38.200 43.500h3.600" stroke="#e8c463" stroke-width="1.200"/>';
    if (f.scar) s += '<path d="M48 36l4 14" stroke="#7a3b35" stroke-width="1.500" stroke-linecap="round"/><path d="M48.500 40l3-1M49.500 44l3-1" stroke="#7a3b35" stroke-width="1"/>';
    if (f.moustache) s += '<path d="M32 55q4-4 8-1 4-3 8 1-4 1-8-.5-4 1.500-8 .5z" fill="#1c1614"/>';
    s += f.lips ? '<path d="M35.500 57q4.500-2.500 9 0-4.500 3.500-9 0z" fill="#a32f3a"/>' : f.grin ? '<path d="M34 56q6 5 12 0-6 2-12 0z" fill="#f3ece0" stroke="#141218" stroke-width=".8"/>' : '<path d="M35 58q5 1.500 10 0" fill="none" stroke="#141218" stroke-width="1.500" stroke-linecap="round"/>';
    if (f.cigar) s += '<path d="M44 58.500l13 3.500-.8 2.800-13-3.500z" fill="#5a3a22"/><circle cx="57" cy="63.500" r="2" fill="#ff7a3a"/><path d="M58 60q3-4 0-8t1-8" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.500" stroke-linecap="round"/>';
    // hair or hat
    var top = '';
    if (f.hat === 'fedora') top = '<path d="M24 31q1-17 16-17t16 17z" fill="' + f.felt + '"/><path d="M33 16q7 4 14 0" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="2"/><path d="M24 27.500h32V32H24z" fill="#0d0c11"/><path d="M12 33q28-9 56 0-28 7-56 0z" fill="' + f.felt + '"/><path d="M12 33q28 7 56 0-28 11-56 0z" fill="rgba(0,0,0,.45)"/>';
    else if (f.hat === 'cap') top = '<path d="M22 33q0-16 19-16t19 14l-2 3z" fill="' + f.felt + '"/><path d="M22 32q14-4 40 2l6 4q-24-3-46-2z" fill="#2c261f"/><path d="M30 21l4 11M41 18v13M51 21l-3 11" stroke="rgba(0,0,0,.25)" stroke-width="1"/>';
    else if (f.hat === 'cloche') top = '<path d="M' + (37 - j) + ' 40q-2-25 19-25t19 25q-4-5-9-6H' + (46 - j) + 'q-5 1-9 6z" fill="' + f.felt + '"/><path d="M' + (39 - j) + ' 31q17-5 ' + (2 * j + 2) + ' 0v3.500q-17-5-' + (2 * j + 2) + ' 0z" fill="' + f.tone + '" fill-opacity=".8"/>';
    else top = f.quiff ? '<path d="M' + (40 - j) + ' 39q-3-22 14-23 16 0 ' + (j + 1) + ' 22-2-9-8-10-12 4-' + (j + 6) + ' 2-2 3-1 9z" fill="' + f.hair + '"/>'
                             : '<path d="M' + (40 - j) + ' 38q-2-20 15-20t15 20q-3-10-8-11-9 3-17 0-4 3-5 11z" fill="' + f.hair + '"/>';
    s += (f.tilt ? '<g transform="rotate(' + f.tilt + ' 40 32)">' + top + '</g>' : top);
    return s + '</svg>';
  }

  // ---- a small curve: the last months of one figure, and which way it goes
  function spark(values, opt) {
    var v = (values || []).filter(function (x) { return typeof x === 'number' && isFinite(x); }), o = opt || {}, W = 100, H = 28, pad = 3;
    var lo = Math.min.apply(null, v.concat(o.min == null ? [] : [o.min])), hi = Math.max.apply(null, v.concat(o.max == null ? [] : [o.max]));
    if (!v.length) return '<svg class="spark flat" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"></svg>';
    var span = hi - lo || 1, pts = v.map(function (y, i) {
      return (v.length > 1 ? pad + i * (W - 2 * pad) / (v.length - 1) : W / 2).toFixed(1) + ',' + (H - pad - (y - lo) * (H - 2 * pad) / span).toFixed(1); });
    // the trend compares the last three months with the three before
    var n = Math.min(3, Math.floor(v.length / 2)), mean = function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / (a.length || 1); };
    var d = n ? mean(v.slice(-n)) - mean(v.slice(-2 * n, -n)) : 0, flat = Math.abs(d) <= span * 0.04 || hi === lo;
    var up = o.lessIsBetter ? d < 0 : d > 0, last = pts[pts.length - 1].split(',');
    return '<svg class="spark ' + (flat ? 'flat' : up ? 'up' : 'down') + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.200" fill="currentColor"/></svg>';
  }

  // ---- a round gauge: the part of something that is done
  function ring(part, inner) {
    var r = 15, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, +part || 0));
    return '<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="' + r + '" fill="rgba(7,8,11,.82)" stroke="rgba(255,255,255,.16)" stroke-width="3.500"/>' +
      '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="currentColor" stroke-width="3.500" stroke-linecap="butt" stroke-dasharray="' + (p * c).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 18 18)"/>' +
      (inner ? '<g transform="translate(9 9) scale(.75)" fill="currentColor" fill-rule="evenodd">' + (has(inner) ? P[inner] : P.unknown) + '</g>' : '') + '</svg>';
  }

  // ---- a stat out of ten, as pips
  function pips(value, of) {
    var out = '<span class="pips">';
    for (var i = 0; i < (of || 10); i++) out += i < value ? '<i class="on"></i>' : '<i></i>';
    return out + '</span>';
  }

  var api = { icon: icon, has: has, portrait: portrait, spark: spark, ring: ring, pips: pips, FACES: FACES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AshportIcons = api;
})(typeof self !== 'undefined' ? self : this);
