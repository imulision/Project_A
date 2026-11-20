// The land around the cities: mountains ringing the plain, lone hills, forests on the slopes, flat ground under cities and roads.
// makeTerrain(ctx) builds it once into the scene and returns { height, hsh, water }.
export function makeTerrain({ THREE, mergeGeometries, scene, K, lerp, sstep, cityDist, roadDist, rnd, reseed }) {
  const hsh = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
  function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, a = fx * fx * (3 - 2 * fx), b = fz * fz * (3 - 2 * fz); return lerp(lerp(hsh(i, j), hsh(i + 1, j), a), lerp(hsh(i, j + 1), hsh(i + 1, j + 1), a), b); }
  function fbm(x, z) { let s = 0, a = 0.5; for (let o = 0; o < 4; o++) { s += a * vnoise(x, z); x *= 2.03; z *= 2.03; a *= 0.5; } return s / 0.9375; }
  const WATER_Y = -0.45;
  function height(X, Z) {
    const x = X / K, z = Z / K, u = x - z, v = x + z;
    let h = 0.35 + 2.6 * Math.max(0, fbm(x * 0.045, z * 0.045) - 0.42) * 2;                          // rolling ground
    const em = Math.hypot(u / 68, (v - 195) / 138) + 0.55 * (fbm(x * 0.012 + 9, z * 0.012) - 0.5);
    const m = sstep(2.0, 2.9, em);                                                                    // mountains ring the plain
    const ridge = 1 - Math.abs(2 * fbm(x * 0.021 + 3, z * 0.021) - 1);
    h += m * (5 + 34 * ridge * ridge) + m * 3 * fbm(x * 0.12, z * 0.12);
    h += 9 * sstep(0.6, 0.8, fbm(x * 0.016 + 11, z * 0.016 + 4));                                    // lone hills between the cities
    h = lerp(0, h, sstep(1.5, 16, cityDist(X, Z)));
    h = lerp(0, h, sstep(1.2, 8, roadDist(X, Z)));
    return h;
  }
  const U0 = -260 * K, U1 = 260 * K, V0 = -230 * K, V1 = 640 * K, S = 3 * K, nu = Math.round((U1 - U0) / S), nv = Math.round((V1 - V0) / S);
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), col = new Float32Array(pos.length), idx = [];
  const C = (hex) => new THREE.Color(hex), sand = C(0x9a8566), grass = C(0x6f8454), grass2 = C(0x85905a), wood = C(0x4d6645), rock = C(0x8a7876), snow = C(0xd9c4c8), bed = C(0x2a2740), tmp = new THREE.Color();
  const hs = new Float32Array((nu + 1) * (nv + 1));
  for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) {
    const u = U0 + i * S, v = V0 + j * S, x = (v + u) / 2, z = (v - u) / 2, h = height(x, z); hs[k] = h;
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
  }
  for (let j = 0, k = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) {
    const h = hs[k], slope = i > 0 && j > 0 ? Math.abs(h - hs[k - 1]) + Math.abs(h - hs[k - nu - 1]) : 0, n = hsh(i, j);
    if (h < WATER_Y) tmp.copy(bed); else if (h < 0.12) tmp.copy(sand).lerp(grass, sstep(-0.2, 0.12, h));
    else if (h < 3) tmp.copy(grass).lerp(grass2, n); else if (h < 13) tmp.copy(wood).lerp(grass, n * 0.35);
    else if (h < 24) tmp.copy(rock).lerp(wood, sstep(17, 13, h) * 0.6); else tmp.copy(rock).lerp(snow, sstep(24, 30, h));
    if (slope > 2.6 && h > 3) tmp.lerp(rock, 0.7);
    tmp.multiplyScalar(0.9 + 0.2 * n); col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    if (i < nu && j < nv) idx.push(k, k + nu + 1, k + 1, k + 1, k + nu + 1, k + nu + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  land.position.y = -0.04; land.receiveShadow = true; land.castShadow = true; scene.add(land);

  // water: one quad, a small shader for the evening light and the moving glints
  const wg = new THREE.BufferGeometry(), P = (u, v) => [(v + u) / 2, WATER_Y, (v - u) / 2];
  wg.setAttribute('position', new THREE.Float32BufferAttribute([...P(U0, V0), ...P(U0, V1), ...P(U1, V1), ...P(U1, V0)], 3)); wg.setIndex([0, 1, 2, 0, 2, 3]);
  const water = new THREE.Mesh(wg, new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, cA: { value: new THREE.Vector3() }, cB: { value: new THREE.Vector3() }, cG: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec3 w; void main(){ w = (modelMatrix * vec4(position, 1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }',
    fragmentShader: `varying vec3 w; uniform float t; uniform vec3 cA, cB, cG;
      void main(){
        float far = clamp((w.z - w.x + 70.) / 110., 0., 1.);
        vec3 c = mix(cA, cB, far * far);
        float a = w.x + w.z, b = w.x - w.z;
        float s = sin(a * 1.7 + sin(b * 0.23 + t * 0.3) * 2.2 + t * 0.7) * sin(b * 0.19 + sin(a * 0.11) * 3. + t * 0.2);
        c += cG * smoothstep(0.72, 1.0, s) * 0.10 + cG * 0.035 * sin(a * 0.31 + b * 0.05 + t * 0.25);
        gl_FragColor = vec4(c, 1.);
      }` }));
  water.visible = false; scene.add(water);   // no open water for now

  // forests: one merged mesh of small firs, on the slopes and along the valleys
  const cone = new THREE.ConeGeometry(1, 1, 5, 1); cone.translate(0, 0.5, 0);
  const trees = [], tc = [C(0x3d6144), C(0x4a6b4a), C(0x355543), C(0x587049)], mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  reseed(99);
  for (let k = 0; k < 14000 * K && trees.length < 4200 * K; k++) {
    const u = U0 + 40 * K + rnd() * (U1 - U0 - 80 * K), v = V0 + 60 * K + rnd() * (V1 - V0 - 120 * K), x = (v + u) / 2, z = (v - u) / 2, h = height(x, z);
    if (h < 0.3 || h > 15 || cityDist(x, z) < 3 || roadDist(x, z) < 2) continue;
    if (rnd() > 0.25 + 0.75 * sstep(0.45, 0.62, fbm(x * 0.05 + 7, z * 0.05)) + (h > 3 ? 0.3 : 0)) continue;
    const s = 0.7 + rnd() * 0.7, g2 = cone.clone(); e.set(0, rnd() * 6, 0); q.setFromEuler(e);
    g2.applyMatrix4(mtx.compose(new THREE.Vector3(x, h - 0.1, z), q, new THREE.Vector3(s, s * (2.2 + rnd() * 1.6), s)));
    const cc = tc[Math.floor(rnd() * 4)], ca = new Float32Array(g2.attributes.position.count * 3); for (let a = 0; a < ca.length; a += 3) { ca[a] = cc.r; ca[a + 1] = cc.g; ca[a + 2] = cc.b; }
    g2.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g2.deleteAttribute('uv'); trees.push(g2);
  }
  const forest = new THREE.Mesh(mergeGeometries(trees), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  forest.castShadow = true; forest.receiveShadow = true; scene.add(forest); trees.forEach(t => t.dispose());
  return { height, hsh, water };
}
