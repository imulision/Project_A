// The vehicles and street lamps of the 1920s, built by code: upright cabins, long bonnets, running boards. A few boxes and four wheels each, so that a street full of them costs a fraction of the models
// they replace (about 1,200 triangles a car, 1,000 a lamp).
// makePeriod(THREE, mergeGeometries) -> { sedan, coupe, truck, lamp }: one merged geometry each, with a colour a vertex.
// A vehicle is centred on the origin, its nose towards +z, its wheels touching y = -0.06 like the old ones.
// Pure white is the paint: the material replaces it with the colour of the car (see carMat in scene.js); every other
// colour is kept as it is. The lamp stands on y = 0 and hangs its lantern towards -x.
export function makePeriod(THREE, mergeGeometries) {
  const PAINT = [1, 1, 1], BLACK = [0.07, 0.07, 0.08], TYRE = [0.05, 0.05, 0.055], CHROME = [0.62, 0.62, 0.66],
    GLASS = [0.2, 0.25, 0.31], LAMP = [1, 0.9, 0.55], WOOD = [0.36, 0.26, 0.16], CANVAS = [0.6, 0.55, 0.43], SEAT = [0.28, 0.14, 0.1], IRON = [0.13, 0.13, 0.15];
  let parts;
  const push = (g, c) => {
    g.deleteAttribute('uv'); const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g.index ? g.toNonIndexed() : g);
  };
  const box = (x, y, z, w, h, d, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); push(g, c); };
  // a wheel on its axle (along x), or a spare lying against the back (along z)
  const wheel = (x, y, z, r, w, c, alongZ) => { const g = new THREE.CylinderGeometry(r, r, w, 8, 1); if (alongZ) g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2); g.translate(x, y, z); push(g, c); };
  const done = () => { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); g.computeVertexNormals(); return g; };
  // what every vehicle shares: four wheels, the frame, running boards, mudguards, the bonnet with its radiator and lamps
  const chassis = (front, rear, nose, bonnet) => {
    parts = [];
    for (const sx of [-1, 1]) for (const z of [front, rear]) { wheel(sx * 0.185, 0.025, z, 0.085, 0.05, TYRE); box(sx * 0.19, 0.125, z, 0.075, 0.02, 0.22, BLACK); }
    box(0, 0.045, (front + rear) / 2, 0.3, 0.03, front - rear + 0.2, BLACK);                       // the frame
    for (const sx of [-1, 1]) box(sx * 0.2, 0.05, (front + rear) / 2, 0.06, 0.015, front - rear - 0.2, BLACK);      // running boards
    box(0, 0.135, nose - bonnet / 2, 0.2, 0.13, bonnet, PAINT);                                    // the bonnet
    box(0, 0.145, nose + 0.01, 0.2, 0.16, 0.02, CHROME);                                           // the radiator
    for (const sx of [-1, 1]) box(sx * 0.14, 0.16, nose, 0.05, 0.05, 0.04, LAMP);                  // headlamps
    box(0, 0.05, nose + 0.035, 0.38, 0.02, 0.02, CHROME);                                          // bumper
  };
  // the family car: an upright cabin with windows all round, a black fabric roof, the spare at the back
  const sedan = () => {
    chassis(0.27, -0.27, 0.42, 0.28);
    box(0, 0.14, -0.1, 0.34, 0.14, 0.46, PAINT); box(0, 0.275, -0.1, 0.31, 0.13, 0.42, GLASS);
    for (const sx of [-1, 1]) for (const z of [0.115, -0.315]) box(sx * 0.158, 0.275, z, 0.02, 0.13, 0.03, PAINT);      // the posts between the windows
    box(0, 0.352, -0.1, 0.35, 0.025, 0.48, BLACK);
    wheel(0, 0.15, -0.36, 0.08, 0.04, TYRE, true); box(0, 0.05, -0.45, 0.38, 0.02, 0.02, CHROME);
    return done();
  };
  // the coupe: a long bonnet, two seats in the open behind a windscreen, a sloping back
  const coupe = () => {
    chassis(0.27, -0.27, 0.42, 0.36);
    box(0, 0.13, -0.08, 0.34, 0.12, 0.28, PAINT); box(0, 0.215, -0.08, 0.26, 0.05, 0.16, SEAT);
    box(0, 0.235, 0.055, 0.3, 0.09, 0.015, GLASS); box(0, 0.285, 0.055, 0.31, 0.012, 0.02, CHROME);
    box(0, 0.12, -0.33, 0.3, 0.1, 0.22, PAINT); box(0, 0.05, -0.45, 0.38, 0.02, 0.02, CHROME);
    return done();
  };
  // the delivery truck: a short bonnet, a square cab, a wooden bed under a canvas cover
  const truck = () => {
    chassis(0.29, -0.27, 0.45, 0.22);
    box(0, 0.19, 0.13, 0.34, 0.24, 0.2, PAINT); box(0, 0.27, 0.135, 0.345, 0.09, 0.15, GLASS); box(0, 0.32, 0.13, 0.36, 0.02, 0.24, BLACK);
    box(0, 0.09, -0.22, 0.4, 0.05, 0.5, WOOD); box(0, 0.25, -0.22, 0.38, 0.27, 0.48, CANVAS);
    for (const z of [-0.06, -0.22, -0.38]) box(0, 0.25, z, 0.385, 0.275, 0.015, WOOD);             // the hoops under the canvas
    return done();
  };
  // a street lamp: a cast iron post on a foot, an arm, a lantern
  const lamp = () => {
    parts = [];
    const post = new THREE.CylinderGeometry(0.014, 0.022, 0.92, 5, 1); post.translate(0, 0.46, 0); push(post, IRON);
    box(0, 0.04, 0, 0.07, 0.08, 0.07, IRON); box(-0.11, 0.93, 0, 0.24, 0.018, 0.018, IRON);
    box(-0.22, 0.885, 0, 0.06, 0.08, 0.06, LAMP); box(-0.22, 0.935, 0, 0.085, 0.02, 0.085, IRON);
    return done();
  };
  return { sedan: sedan(), coupe: coupe(), truck: truck(), lamp: lamp() };
}
