// 1920s buildings built by code: brick walls, stone trim, sash windows, cornices, fire escapes, shopfronts with awnings.
// Each building is one merged geometry with two extra attributes:
//   color : base colour, multiplied at draw time by the per-building tint (the brick)
//   aWin  : 0 for walls, 1.xx for a window, 2.xx for a shop window (xx = a random id deciding whether its lamp is on)
// Footprint is centred on the origin, the ground is y = 0 and the front (shop, fire escape) faces +z.
export function makeEraBuildings(THREE, mergeGeometries) {
  const BODY = [0.82, 0.8, 0.78], TRIM = [1.2, 1.14, 1.02], BASE = [0.5, 0.48, 0.47], TAR = [0.2, 0.2, 0.23], IRON = [0.1, 0.1, 0.11], GLASS = [0.3, 0.33, 0.4],
    DOOR = [0.18, 0.13, 0.1], AWNS = [[1.25, 0.3, 0.26], [0.35, 0.8, 0.55], [1.2, 1.05, 0.7], [0.3, 0.45, 0.9]];
  let parts, wid, sd;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const push = (g, c, win = 0) => {
    g.deleteAttribute('uv'); const n = g.attributes.position.count, col = new Float32Array(n * 3), w = new Float32Array(n).fill(win);
    for (let k = 0; k < n; k++) { col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aWin', new THREE.BufferAttribute(w, 1)); parts.push(g);
  };
  const box = (x, y, z, w, h, d, c, rx = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); push(g, c); return g; };
  // a flat panel on face f (0: +z front, 1: +x, 2: -z, 3: -x) of a W x D block, u along the face, proud of the wall by `off`
  const panel = (W, D, f, u, y, w, h, off, c, win = 0, x0 = 0, z0 = 0) => {
    const g = new THREE.PlaneGeometry(w, h); g.translate(u, y, (f % 2 ? W : D) / 2 + off); g.rotateY(f * Math.PI / 2); g.translate(x0, 0, z0); push(g, c, win);
  };
  const faceBox = (W, D, f, u, y, w, h, d, off, c, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(u, y, (f % 2 ? W : D) / 2 + off); g.rotateY(f * Math.PI / 2); push(g, c);
  };
  const windowId = () => 1 + ((wid = (wid * 37 + 11) % 97) / 100);
  // upper floors: a grid of tall sash windows with a stone surround on the four faces
  const floors = (W, D, y0, n, fh, pitch, x0 = 0, z0 = 0, wide = 1) => {
    for (let f = 0; f < 4; f++) {
      const fw = f % 2 ? D : W, cols = Math.max(2, Math.round(fw / pitch));
      for (let k = 0; k < n; k++) for (let c = 0; c < cols; c++) {
        const u = ((c + 0.5) / cols - 0.5) * fw * 0.9, y = y0 + (k + 0.52) * fh, ww = Math.min(0.13, fw * 0.9 / cols * 0.5) * wide;
        panel(W, D, f, u, y + fh * 0.33, ww + 0.05, fh * 0.1, 0.004, TRIM, 0, x0, z0); panel(W, D, f, u, y - fh * 0.32, ww + 0.04, fh * 0.05, 0.004, TRIM, 0, x0, z0);
        panel(W, D, f, u, y, ww, fh * 0.6, 0.008, GLASS, windowId(), x0, z0);
      }
    }
  };
  const block = (W, D, y0, h, x0 = 0, z0 = 0, c = BODY) => { const g = new THREE.BoxGeometry(W, h, D); g.translate(x0, y0 + h / 2, z0); push(g, c); };
  const cornice = (W, D, y, x0 = 0, z0 = 0, big = 1) => { block(W + 0.12 * big, D + 0.12 * big, y - 0.075, 0.075, x0, z0, TRIM); block(W + 0.05, D + 0.05, y - 0.13, 0.04, x0, z0, TRIM); block(W - 0.1, D - 0.1, y, 0.03, x0, z0, TAR); };
  const shopfront = (W, D, gh, f, awn) => {
    const fw = f % 2 ? D : W;
    panel(W, D, f, 0, gh * 0.5, fw * 0.16, gh * 0.78, 0.012, DOOR);
    for (const s of [-1, 1]) panel(W, D, f, s * fw * 0.29, gh * 0.5, fw * 0.3, gh * 0.6, 0.012, GLASS, 1 + windowId());
    panel(W, D, f, 0, gh * 0.9, fw * 0.92, gh * 0.14, 0.014, IRON);       // sign board over the windows
    if (awn) faceBox(W, D, f, 0, gh * 0.72, fw * 0.94, 0.02, 0.26, 0.13, awn, 0.5);
  };
  const fireEscape = (W, D, gh, n, fh) => {
    const u = W * 0.22;
    for (let k = 1; k < n; k++) {
      const y = gh + k * fh + 0.05;
      faceBox(W, D, 0, u, y, 0.5, 0.02, 0.13, 0.065, IRON); faceBox(W, D, 0, u, y + 0.09, 0.5, 0.012, 0.012, 0.125, IRON);
      for (const s of [-0.24, 0.24]) faceBox(W, D, 0, u + s, y + 0.045, 0.012, 0.09, 0.012, 0.125, IRON);
      if (k > 1) { const g = new THREE.BoxGeometry(0.035, Math.hypot(fh, 0.3), 0.02); g.rotateZ((k % 2 ? 1 : -1) * Math.atan2(0.3, fh)); g.translate(u, y - fh / 2, D / 2 + 0.08); push(g, IRON); }
    }
    const g = new THREE.BoxGeometry(0.03, fh * 0.8, 0.02); g.translate(u - 0.15, gh + fh * 0.65, D / 2 + 0.09); push(g, IRON);     // the drop ladder
  };
  const roofBits = (W, D, y, x0 = 0, z0 = 0) => {
    block(0.34, 0.3, y, 0.26, x0 - W * 0.2, z0 - D * 0.22);                                  // stair bulkhead
    block(0.1, 0.1, y, 0.3 + rnd() * 0.15, x0 + W * 0.3, z0 - D * 0.3, BASE);                // chimneys
    if (rnd() < 0.6) block(0.1, 0.1, y, 0.25, x0 + W * 0.3, z0 + D * 0.15, BASE);
    if (rnd() < 0.5) block(0.26, 0.18, y, 0.06, x0 - W * 0.05, z0 + D * 0.2, GLASS);         // skylight
  };
  function make(seed, p) {
    parts = []; wid = seed; sd = seed * 7919 + 13;
    const { W, D, n, fh = 0.4, gh = 0.5, pitch = 0.3 } = p, H = gh + n * fh;
    block(W, D, 0, H);
    block(W + 0.03, D + 0.03, 0, gh, 0, 0, p.stone ? TRIM : BASE);
    block(W + 0.06, D + 0.06, gh - 0.02, 0.04, 0, 0, TRIM);                                   // belt course over the ground floor
    floors(W, D, gh, n, fh, pitch, 0, 0, p.wide || 1);
    if (p.shop) { shopfront(W, D, gh, 0, p.awn === undefined ? AWNS[seed % AWNS.length] : p.awn); if (p.corner) shopfront(W, D, gh, 1, null); }
    else { panel(W, D, 0, 0, gh * 0.42, 0.16, gh * 0.72, 0.02, DOOR); for (const s of [-1, 1]) { panel(W, D, 0, s * W * 0.3, gh * 0.55, 0.2, gh * 0.5, 0.02, TRIM); panel(W, D, 0, s * W * 0.3, gh * 0.55, 0.15, gh * 0.4, 0.024, GLASS, windowId()); }
      if (p.stoop) { faceBox(W, D, 0, 0, 0.05, 0.3, 0.1, 0.2, 0.1, TRIM); faceBox(W, D, 0, 0, 0.025, 0.3, 0.05, 0.12, 0.26, TRIM); } }
    if (p.piers) for (let f = 0; f < 4; f++) { const fw = f % 2 ? D : W; for (const s of [-1, 1]) faceBox(W, D, f, s * (fw / 2 - 0.05), gh + n * fh / 2, 0.1, n * fh, 0.03, 0.015, TRIM); }
    if (p.escape) fireEscape(W, D, gh, n, fh);
    let top = H, tw = W, td = D;
    cornice(W, D, H, 0, 0, p.plainTop ? 0.4 : 1);
    for (const [k, m] of p.setbacks || []) {                                                 // stepped tower, Art Deco fashion
      tw -= k; td -= k; block(tw, td, top, m * fh); floors(tw, td, top, m, fh, pitch); top += m * fh; cornice(tw, td, top);
    }
    if (p.crown) { block(tw * 0.45, td * 0.45, top, 0.35, 0, 0, TRIM); block(0.04, 0.04, top + 0.35, 0.5, 0, 0, IRON); }
    else roofBits(tw, td, top + 0.03);
    if (p.stack) { block(0.2, 0.2, H, 1.3, W * 0.25, -D * 0.25, BASE); block(0.24, 0.24, H + 1.3, 0.06, W * 0.25, -D * 0.25, TRIM); }
    const geo = mergeGeometries(parts); parts.forEach(g => g.dispose()); geo.computeBoundingSphere();
    return { geo, h: top };
  }
  return {
    low: ['era_row3', 'era_shop2', 'era_tenement4', 'era_tenement4b', 'era_warehouse', 'era_works'],
    mid: ['era_tenement5', 'era_tenement6', 'era_hotel6', 'era_corner5'],
    high: ['era_office8', 'era_hotel9', 'era_deco11'],
    models: {
      era_row3: make(3, { W: 1.5, D: 1.4, n: 3, stoop: true }),
      era_shop2: make(5, { W: 1.6, D: 1.45, n: 2, shop: true, gh: 0.55 }),
      era_tenement4: make(7, { W: 1.5, D: 1.5, n: 4, shop: true, escape: true }),
      era_tenement4b: make(11, { W: 1.45, D: 1.5, n: 4, stoop: true, escape: true }),
      era_warehouse: make(13, { W: 1.6, D: 1.6, n: 3, fh: 0.46, pitch: 0.52, wide: 1.5, plainTop: true, gh: 0.55 }),
      era_works: make(17, { W: 1.6, D: 1.55, n: 2, fh: 0.5, pitch: 0.5, wide: 1.6, plainTop: true, stack: true, gh: 0.6 }),
      era_tenement5: make(19, { W: 1.5, D: 1.5, n: 5, shop: true, escape: true }),
      era_tenement6: make(23, { W: 1.45, D: 1.5, n: 6, stoop: true, escape: true }),
      era_hotel6: make(29, { W: 1.55, D: 1.5, n: 6, shop: true, corner: true, stone: true, piers: true, awn: [1.25, 0.3, 0.26] }),
      era_corner5: make(31, { W: 1.6, D: 1.55, n: 5, shop: true, corner: true }),
      era_office8: make(37, { W: 1.5, D: 1.5, n: 6, stone: true, piers: true, shop: true, awn: null, setbacks: [[0.3, 2]] }),
      era_hotel9: make(41, { W: 1.55, D: 1.5, n: 7, stone: true, shop: true, corner: true, setbacks: [[0.35, 2]] }),
      era_deco11: make(43, { W: 1.55, D: 1.55, n: 6, stone: true, piers: true, shop: true, awn: null, setbacks: [[0.3, 3], [0.3, 2]], crown: true }),
    },
  };
}
