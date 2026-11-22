// 1920s buildings built by code: brick walls, stone trim, sash windows, cornices, fire escapes, shopfronts with awnings.
// Each building is one merged geometry with two extra attributes:
//   color : base colour, multiplied at draw time by the per-building tint (the brick)
//   aWin  : 0 for walls, 1.xx for a window, 2.xx for a shop window (xx = a random id deciding whether its lamp is on)
// Footprint is centred on the origin, the ground is y = 0 and the front (shop, fire escape) faces +z.
export function makeEraBuildings(THREE, mergeGeometries) {
  const GOLD = [1.5, 1.12, 0.4], BODY = [0.82, 0.8, 0.78], TRIM = [1.2, 1.14, 1.02], BASE = [0.5, 0.48, 0.47], TAR = [0.2, 0.2, 0.23], IRON = [0.1, 0.1, 0.11], GLASS = [0.3, 0.33, 0.4],
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
    // ---- what only a headquarters carries: signs that never go out (aWin 3.xx), a canopy over its door, its flags
    if (p.stripes) for (let k = 0; k < 8; k++) faceBox(W, D, 0, ((k + 0.5) / 8 - 0.5) * W * 0.94, gh * 0.72, W * 0.94 / 8, 0.022, 0.27, 0.13, k % 2 ? [1.3, 1.25, 1.15] : [1.25, 0.22, 0.2], 0.5);
    if (p.pole) { for (let k = 0; k < 5; k++) faceBox(W, D, 0, W * 0.4, 0.12 + k * 0.07, 0.07, 0.07, 0.07, 0.06, k % 2 ? [1.3, 1.25, 1.15] : [1.25, 0.22, 0.2]); faceBox(W, D, 0, W * 0.4, 0.5, 0.09, 0.05, 0.09, 0.06, GOLD); }
    if (p.lanterns) for (const s of [-1, 1]) { faceBox(W, D, 0, s * W * 0.14, gh * 0.78, 0.06, 0.1, 0.06, 0.05, IRON); panel(W, D, 0, s * W * 0.14, gh * 0.78, 0.045, 0.075, 0.082, GOLD, 3.2 + (s + 1) * 0.1); }
    if (p.marquee) {
      const mw = W * 0.62, md = 0.34, my = gh * 0.82;
      faceBox(W, D, 0, 0, my, mw, 0.07, md, md / 2, IRON); faceBox(W, D, 0, 0, my + 0.045, mw + 0.03, 0.03, md + 0.03, md / 2, GOLD);
      panel(W, D, 0, 0, my, mw * 0.94, 0.05, md + 0.004, GOLD, 3.11);                                           // the lit edge of the canopy, front and sides
      for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(md * 0.9, 0.05); g.rotateY(s * Math.PI / 2); g.translate(s * (mw / 2 + 0.004), my, D / 2 + md / 2); push(g, GOLD, 3.31); }
      { const g = new THREE.PlaneGeometry(mw * 0.9, md * 0.8); g.rotateX(Math.PI / 2); g.translate(0, my - 0.038, D / 2 + md / 2); push(g, GOLD, 3.51); }      // the lamps under it
      for (const s of [-1, 1]) faceBox(W, D, 0, s * mw * 0.46, my / 2, 0.035, my, 0.035, md - 0.03, IRON);
    }
    if (p.blade) {
      const bh = n * fh * 0.55, by = gh + n * fh * 0.5, bx = W / 2 - 0.02;
      block(0.05, 0.3, by - bh / 2, bh, bx, D / 2 + 0.17, IRON);
      for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(0.26, bh * 0.94); g.rotateY(s * Math.PI / 2); g.translate(bx + s * 0.027, by, D / 2 + 0.17); push(g, GOLD, 3.71); }
    }
    if (p.roofSign) {
      const sw = tw * p.roofSign, sy = top + 0.34, sz = td / 2 - 0.12;
      for (const s of [-1, 1]) block(0.03, 0.03, top, 0.5, s * sw * 0.42, sz - 0.03, IRON);
      for (const f of [0, Math.PI]) { const g = new THREE.PlaneGeometry(sw, 0.3); g.rotateY(f); g.translate(0, sy, sz + (f ? -0.012 : 0.012)); push(g, GOLD, 3.91); }
      block(sw + 0.04, 0.012, sy - 0.17, 0.34, 0, sz, IRON);
    }
    if (p.crownLit) for (let f = 0; f < 4; f++) panel(tw * 0.45, td * 0.45, f, 0, top + 0.19, tw * 0.3, 0.24, 0.004, GOLD, 3.13 + f * 0.2);
    if (p.flags) for (const s of [-1, 1]) { const fx = s * (W / 2 - 0.1), fz = D / 2 - 0.1; block(0.022, 0.022, H, 0.75, fx, fz, IRON); block(0.24, 0.012, H + 0.56, 0.16, fx + 0.13, fz, GOLD); }
    if (p.stack) { block(0.2, 0.2, H, 1.3, W * 0.25, -D * 0.25, BASE); block(0.24, 0.24, H + 1.3, 0.06, W * 0.25, -D * 0.25, TRIM); }
    const geo = mergeGeometries(parts); parts.forEach(g => g.dispose()); geo.computeBoundingSphere();
    return { geo, h: top };
  }
  // ---- a headquarters from the club on: not a box with windows. Pale stone, a portico of round columns under a pediment, copper
  // roofs gone green, lamps that never go out; then wings on each side (one wide building over three lots), then a dome.
  const STONE = [1.5, 1.46, 1.38], COPPER = [0.6, 1.16, 1.0];
  const round = (r0, r1, h, x, y, z, c, seg = 8, win = 0) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y + h / 2, z); push(g, c, win); };
  // a pitched copper roof over a W x D wing, its ridge along x, closed by stepped stone gables
  const pitched = (W, D, y, x0, h) => {
    const run = Math.hypot(D / 2 + 0.06, h), a = Math.atan2(h, D / 2 + 0.06);
    for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(W + 0.1, 0.04, run); g.rotateX(s * a); g.translate(x0, y + h / 2, s * (D / 4 + 0.02)); push(g, COPPER); }
    for (const e of [-1, 1]) for (let k = 0; k < 4; k++) block(0.06, D * (1 - (k + 0.5) / 4), y + k * h / 4, h / 4, x0 + e * (W / 2 - 0.03), 0, STONE);
    block(W + 0.12, 0.06, y + h - 0.02, 0.05, x0, 0, COPPER);
  };
  function palace(seed, p) {
    parts = []; wid = seed; sd = seed * 7919 + 13;
    const D = 1.5, fh = 0.42, gh = 0.62, cw = p.cw, H = gh + p.n * fh, pz = D / 2 + 0.3, ch = gh + fh * Math.min(2, p.n) - 0.1;
    block(cw, D, 0, H, 0, 0, STONE); block(cw + 0.05, D + 0.05, 0, 0.16, 0, 0, TRIM); block(cw + 0.06, D + 0.06, gh - 0.02, 0.04, 0, 0, TRIM);
    floors(cw, D, gh, p.n, fh, 0.3);
    for (const s of [-1, 1]) for (let c = 0; c < 2; c++) panel(cw, D, 0, s * (p.pw / 2 + 0.12 + c * 0.24), gh * 0.56, 0.13, gh * 0.5, 0.008, GLASS, windowId());
    cornice(cw, D, H, 0, 0, 1.2);
    let top = H;
    if (p.wings) for (const s of [-1, 1]) {
      const ww = p.wings.w, wd = D - 0.16, x0 = s * (cw / 2 + ww / 2), Hw = gh + p.wings.n * fh;
      block(ww, wd, 0, Hw, x0, 0, STONE); block(ww + 0.05, wd + 0.05, 0, 0.16, x0, 0, TRIM); block(ww + 0.06, wd + 0.06, gh - 0.02, 0.04, x0, 0, TRIM);
      floors(ww, wd, gh, p.wings.n, fh, 0.3, x0, 0); for (let c = 0; c < 4; c++) panel(ww, wd, 0, ((c + 0.5) / 4 - 0.5) * ww * 0.9, gh * 0.56, 0.13, gh * 0.5, 0.008, GLASS, windowId(), x0, 0);
      cornice(ww, wd, Hw, x0, 0); pitched(ww, wd, Hw, x0, 0.42);
      panel(ww, wd, 0, 0, gh + p.wings.n * fh * 0.5, 0.05, 0.3, 0.03, GOLD, 3.2 + s * 0.1, x0, 0);       // a lamp on each wing
    }
    // the portico: steps, round columns, an entablature and a stepped pediment, with the door alight behind
    for (let k = 0; k < 3; k++) block(p.pw + 0.5 - k * 0.12, 0.7 - k * 0.14, k * 0.05, 0.05, 0, D / 2 + 0.3 - k * 0.07 + 0.05, TRIM);
    for (let c = 0; c < p.cols; c++) { const u = ((c + 0.5) / p.cols - 0.5) * p.pw; round(0.05, 0.062, ch, u, 0.15, pz, STONE); block(0.15, 0.15, 0.15 + ch, 0.04, u, pz, TRIM); block(0.15, 0.15, 0.13, 0.04, u, pz, TRIM); }
    block(p.pw + 0.14, 0.5, 0.19 + ch, 0.12, 0, D / 2 + 0.16, TRIM);
    for (let k = 0; k < 5; k++) block((p.pw + 0.2) * (1 - k / 5), 0.52, 0.31 + ch + k * 0.07, 0.07, 0, D / 2 + 0.16, k ? STONE : COPPER);
    panel(cw, D, 0, 0, gh * 0.55, 0.34, gh * 0.9, 0.008, GOLD, 3.31);
    for (const s of [-1, 1]) { faceBox(cw, D, 0, s * 0.3, gh * 0.8, 0.06, 0.1, 0.06, 0.04, IRON); panel(cw, D, 0, s * 0.3, gh * 0.8, 0.045, 0.075, 0.072, GOLD, 3.5 + s * 0.1); }
    panel(cw, D, 0, 0, 0.25 + ch, p.pw * 0.8, 0.07, 0.42, GOLD, 3.7);                                           // the name over the columns, always lit
    if (p.dome) {
      const r = 0.72;
      block(cw - 0.3, D - 0.3, top, 0.3, 0, 0, STONE); top += 0.3; round(r, r + 0.03, 0.55, 0, top, 0, STONE, 14);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, g = new THREE.PlaneGeometry(0.2, 0.34); g.translate(0, top + 0.3, r + 0.022); g.rotateY(a); push(g, GOLD, 3.1 + k * 0.1); }
      top += 0.55; { const g = new THREE.SphereGeometry(r + 0.02, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, top, 0); push(g, COPPER); }
      top += r; round(0.12, 0.14, 0.22, 0, top - 0.04, 0, STONE, 8); round(0.1, 0.1, 0.12, 0, top + 0.02, 0, GOLD, 8, 3.9); round(0.02, 0.1, 0.2, 0, top + 0.18, 0, COPPER, 8); top += 0.4;
    } else {      // a mansard roof in copper, with lit dormers
      block(cw - 0.12, D - 0.12, top, 0.34, 0, 0, COPPER); for (let c = 0; c < 3; c++) { const u = ((c + 0.5) / 3 - 0.5) * cw * 0.7; faceBox(cw - 0.12, D - 0.12, 0, u, top + 0.17, 0.16, 0.2, 0.06, 0.02, STONE); panel(cw - 0.12, D - 0.12, 0, u, top + 0.17, 0.1, 0.13, 0.052, GOLD, 3.3 + c * 0.1); }
      block(cw - 0.4, D - 0.4, top + 0.34, 0.05, 0, 0, COPPER); top += 0.39;
    }
    if (p.flags) for (const s of [-1, 1]) { const fx = s * (cw / 2 - 0.12), fz = D / 2 - 0.12; block(0.024, 0.024, H, 0.9, fx, fz, IRON); block(0.28, 0.012, H + 0.68, 0.18, fx + 0.15, fz, GOLD); }
    const geo = mergeGeometries(parts); parts.forEach(g => g.dispose()); geo.computeBoundingSphere();
    return { geo, h: top };
  }
  return {
    low: ['era_row3', 'era_shop2', 'era_tenement4', 'era_tenement4b', 'era_warehouse', 'era_works'],
    mid: ['era_tenement5', 'era_tenement6', 'era_hotel6', 'era_corner5'],
    high: ['era_office8', 'era_hotel9', 'era_deco11'],
    hq: ['hq_backroom', 'hq_club', 'hq_hotel', 'hq_seat'],      // the headquarters, one an act: nobody else's buildings
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
      hq_backroom: make(47, { W: 1.6, D: 1.45, n: 2, shop: true, gh: 0.58, awn: null, stripes: true, pole: true, lanterns: true, roofSign: 0.5 }),
      hq_club: palace(53, { cw: 1.7, n: 2, cols: 4, pw: 1.25 }),
      hq_hotel: palace(59, { cw: 2.3, n: 4, wings: { w: 1.5, n: 3 }, cols: 6, pw: 1.9, flags: true }),
      hq_seat: palace(61, { cw: 2.5, n: 4, wings: { w: 1.45, n: 3 }, cols: 8, pw: 2.2, dome: true, flags: true }),
    },
  };
}
