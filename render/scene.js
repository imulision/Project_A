// The 3D map of the game. start(plan, options) builds the world once from a plan made by web/mapview.js
// and returns { update, effects, labels, focus, setLook, setFx }. It reads the game, it never decides anything.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { due } from './pace.mjs';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeEraBuildings } from './era.js';
import { MODELS, ATLAS } from './models.js';

export async function start(P, opt = {}) {

const Q = new URLSearchParams(location.search);
// the page shows a loading bar: say which stage begins, then let it paint before the heavy work
const stage = n => new Promise(done => { if (opt.onStage) opt.onStage(n); setTimeout(done, 0); });
const PLAIN = Q.has('plain');
// the region can be drawn larger than the first one: the new game has cities three times as wide. K stretches the land, the camera and the zoom steps together
const K = P.scale || 1;

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- renderer. Resolution is adaptive: it drops by itself when the device cannot hold the frame rate
let pr = Math.min(devicePixelRatio, 2);
const renderer = new THREE.WebGLRenderer({ antialias: Q.has('aa'),      // the picture goes through the effects, so smoothing the last buffer changes nothing that can be seen (measured: same as the grain's own noise)
   powerPreference: 'high-performance', preserveDrawingBuffer: Q.has('shot') });
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x191a22);
const world = new THREE.Group(), root = new THREE.Group(); scene.add(world, root);   // world: built once. root: rebuilt per year

// ---------- camera (true isometric, orthographic)
let aspect = innerWidth / innerHeight;
const VIEW = 195 * K, OFF = new THREE.Vector3(160, 200, 160).multiplyScalar(K), CENTER = new THREE.Vector3(105, 0, 105).multiplyScalar(K);
const cam = new THREE.OrthographicCamera(-VIEW * aspect, VIEW * aspect, VIEW, -VIEW, 0.1, 900 * K);
cam.zoom = +(Q.get('zoom') || 1) ; cam.updateProjectionMatrix();
cam.position.set(+(Q.get('tx') || CENTER.x), 0, +(Q.get('tz') || CENTER.z)).add(OFF);
cam.lookAt(cam.position.clone().sub(OFF));

// ---------- light: dusk, low sun, cool sky fill
const hemi = new THREE.HemisphereLight(0x8f9cf0, 0x4a3540, 2.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffa25e, 3.1);
const SUN_DIR = new THREE.Vector3(150, 85, 45).normalize().multiplyScalar(260);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.autoUpdate = false;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 620;
scene.add(sun, sun.target);
// shadows are computed once for the area being looked at, and again only when the view moves far enough
const shadowAt = new THREE.Vector3(1e9, 0, 0); let shadowHalf = 0, shadowDirty = true;
function updateShadow(target) {
  const half = clamp(VIEW / cam.zoom * 1.7, 45, 250);
  if (!shadowDirty && Math.abs(half - shadowHalf) < shadowHalf * 0.25 && shadowAt.distanceTo(target) < shadowHalf * 0.35) return;
  shadowDirty = false; shadowHalf = half; shadowAt.copy(target);
  const c = sun.shadow.camera; c.left = c.bottom = -half; c.right = c.top = half; c.updateProjectionMatrix();
  sun.shadow.bias = -0.0004 * half / 45; sun.shadow.normalBias = 0.03 * half / 45;
  sun.target.position.copy(target); sun.position.copy(target).add(SUN_DIR); sun.target.updateMatrixWorld();
  sun.shadow.needsUpdate = true;
}

// ---------- helpers: glows, light pools, signs. Everything is added to the group `cur`
let cur = world;
function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const GLOW_WARM = glowTexture('rgba(255,236,190,1)', 'rgba(255,170,70,0.55)');
const GLOW_SOFT = glowTexture('rgba(255,200,120,0.75)', 'rgba(255,150,60,0.28)');
const UNIT = new THREE.PlaneGeometry(1, 1), FX = {};
function fxMat(tex, color, op) {
  const c = new THREE.Color(color), k = (tex ? tex.id : 'x') + ':' + c.getHexString() + ':' + op;
  return FX[k] || (FX[k] = new THREE.MeshBasicMaterial({ map: tex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op }));
}
function glow(x, y, z, s, tex = GLOW_WARM, color = 0xffffff, op = 1) {
  const sp = new THREE.Mesh(UNIT, fxMat(tex, color, op)); sp.quaternion.copy(cam.quaternion);
  sp.position.set(x, y, z); sp.scale.set(s, s, 1); sp.renderOrder = 4; cur.add(sp); return sp;
}
function pool(x, z, s, color = 0xffb060, op = 0.5) {   // light pool on the ground
  const m = new THREE.Mesh(UNIT, fxMat(GLOW_SOFT, color, op));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.125, z); m.scale.set(s, s, 1); m.renderOrder = 2; cur.add(m); return m;
}
function strip(ax, az, bx, bz, wd, mat, y, order = 0) {
  const horiz = az === bz, len = Math.abs(bx - ax) + Math.abs(bz - az) + wd;
  const m = new THREE.Mesh(UNIT, mat); m.scale.set(horiz ? len : wd, horiz ? wd : len, 1);
  m.rotation.x = -Math.PI / 2; m.position.set((ax + bx) / 2, y, (az + bz) / 2); m.renderOrder = order; cur.add(m); return m;
}
const SIGNS = {}, SIGNGEO = new THREE.PlaneGeometry(1.5, 1.5 / 4);
function sign(text, color) {     // glowing shop sign
  const key = text + color;
  if (!SIGNS[key]) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#17110d'; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
    g.font = '700 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = color;
    g.fillText(text, 256, 68, 460); g.fillText(text, 256, 68, 460);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    SIGNS[key] = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); SIGNS[key].color.setScalar(1.6);
  }
  const m = new THREE.Mesh(SIGNGEO, SIGNS[key]); m.userData.keep = true;
  return m;
}
// merge every static mesh of a group into one mesh per material: a handful of draw calls instead of hundreds
function bake(group) {
  const groups = new Map(), dead = [];
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    const key = o.material.uuid + ':' + o.renderOrder + ':' + o.castShadow + ':' + o.receiveShadow;
    if (!groups.has(key)) groups.set(key, { o, geos: [] });
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    groups.get(key).geos.push(g); dead.push(o);
  });
  for (const o of dead) o.removeFromParent();
  for (const { o, geos } of groups.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), o.material);
    m.userData.merged = true; m.renderOrder = o.renderOrder; m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; group.add(m);
    geos.forEach(g => g.dispose());
  }
}
function dispose(group) {
  group.traverse(o => { if (o.userData.merged) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  group.removeFromParent();
}

await stage(0);
// ---------- load the kit
const NAMES = ['road_straight', 'road_junction', 'road_straight_crossing', 'streetlight', 'car_sedan', 'car_stationwagon', 'car_hatchback', 'watertower'];
const loader = new GLTFLoader();
const GEO = {};                                   // one geometry per model, shared by every copy on the map
const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
await Promise.all(NAMES.map(n => loader.parseAsync(b64(MODELS[n]), '').then(g => {
  g.scene.updateMatrixWorld(true); const gs = [];
  g.scene.traverse(o => { if (o.isMesh) { const q = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); gs.push(q); } });
  GEO[n] = gs.length === 1 ? gs[0] : mergeGeometries(gs);
})));
const atlas = await new THREE.TextureLoader().loadAsync(ATLAS);
atlas.flipY = false; atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;

// the kit's flat palette, regraded per building through instance colours. `lit` = share of windows with a lamp on
function kitMat(rough = 0.85, lit = -1, tint = 0xffffff) {
  const m = new THREE.MeshStandardMaterial({ map: atlas, roughness: rough, metalness: 0, color: tint });
  if (lit >= 0) {            // shader: each window pane decides on its own whether its lamp is on
    m.onBeforeCompile = sh => {
      sh.uniforms.uLit = { value: lit };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 wPos = vec4(transformed, 1.);
          #ifdef USE_INSTANCING
            wPos = instanceMatrix * wPos;
          #endif
          vWPos = (modelMatrix * wPos).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform float uLit;')
        .replace('#include <emissivemap_fragment>', `
          vec2 cell = floor(vMapUv * vec2(8., 4.));
          float glass = (cell.y == 1. && cell.x == 2.) ? 1. : 0.;
          vec3 wc = floor(vWPos * vec3(2.6, 3.3, 2.6) + 0.5);
          float rr = fract(sin(dot(wc, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float on = step(rr, uLit);
          vec3 lamp = mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.86, 0.55), fract(rr * 7.31));
          totalEmissiveRadiance += glass * on * lamp * (0.8 + 0.6 * fract(rr * 3.7));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.06, 0.09), glass * (1. - on));`);
    };
    m.customProgramCacheKey = () => 'lit' + lit;
  }
  return m;
}
// 1920s buildings generated by code (era.js): vertex colours, brick tint per building, each window lamp decided in the shader
const ERA = makeEraBuildings(THREE, mergeGeometries);
for (const n in ERA.models) GEO[n] = ERA.models[n].geo;
function eraMat(lit) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uLit = { value: lit };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWin; varying float vWin; varying float vSeed; varying float vFoot;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWin = aWin; vSeed = 0.; vFoot = transformed.y;
        #ifdef USE_INSTANCING
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
          vFoot = transformed.y * length(instanceMatrix[1].xyz);     // height above the pavement, in the units of the map
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWin; varying float vSeed; varying float vFoot; uniform float uLit;')
      .replace('#include <emissivemap_fragment>', `
        diffuseColor.rgb *= 0.5 + 0.5 * smoothstep(0., 0.7, vFoot);     // contact shading written into the wall: darker where it meets the street, at no extra draw
        float isWin = step(0.5, vWin), shopW = step(1.5, vWin);
        float rr = fract(sin(fract(vWin) * 91.7 + vSeed * 37.3) * 43758.5453);
        float on = step(rr, uLit + shopW * 0.4);
        vec3 lamp = mix(vec3(1.0, 0.58, 0.2), vec3(1.0, 0.84, 0.52), fract(rr * 7.31));
        totalEmissiveRadiance += isWin * on * lamp * (0.3 + 0.35 * fract(rr * 3.7) + shopW * 0.35);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.045, 0.07), isWin * (1. - on));`);
  };
  m.customProgramCacheKey = () => 'era' + lit;
  return m;
}
const ERAMATS = [0.07, 0.13, 0.2, 0.28].map(eraMat);
const PLAINMAT = kitMat(), LITS = [0.18, 0.3, 0.42, 0.58].map(l => kitMat(0.85, l));
const CARMATS = [0x3a3636, 0x3a3636, 0x7d3a34, 0x3f5a4a].map(c => kitMat(0.35, -1, c));
const TINTS = [0x9a4a38, 0x7e3b30, 0x8a8078, 0xa98458, 0x6f5a4c, 0x8c4038].map(c => new THREE.Color(c));
const FARCOL = [0x86463a, 0x6e3a31, 0x777069, 0x8f7350, 0x62524a, 0x7a3d36].map(c => new THREE.Color(c));   // the same buildings seen from afar
const ROADTINT = new THREE.Color(0xb9b2b6), PROPTINT = new THREE.Color(0xb8a890);

// ---------- the region: six cities around Lake Meridian, each split into districts. Tiles of 2 m, streets every 4th column and 3rd row
const T = 2;
const COLORS = opt.colors || {}, FAMILY = {}; for (const k in COLORS) FAMILY[k] = new THREE.Color(COLORS[k]).getHex();

// district = [name, first block column, end column, first block row, end row, owner in 1926, 1928, 1931]
const SMALL = (names, o) => [[names[0], 0, 2, 0, 2, ...o[0]], [names[1], 2, 4, 0, 3, ...o[1]], [names[2], 0, 2, 2, 5, ...o[2]], [names[3], 2, 4, 3, 5, ...o[3]]];
const n3 = k => [k, k, k];
const CITIES = P.cities.map(pc => ({ p: pc, d: pc.districts, id: pc.id, name: pc.name, u: pc.u, v: pc.v, bx: pc.bx, by: pc.by, home: pc.home, held: pc.held }));
for (const c of CITIES) {
  c.W = c.bx * 4 + 1; c.H = c.by * 3 + 1; c.cx = (c.v + c.u) / 2; c.cz = (c.v - c.u) / 2;
  c.ox = Math.round(c.cx - (c.W - 1)); c.oz = Math.round(c.cz - (c.H - 1));
  c.x1 = c.ox + (c.W - 1) * T; c.z1 = c.oz + (c.H - 1) * T; c.r = Math.hypot(c.W, c.H) * T / 2;
}
const LINKS = P.routes.filter(r => r.kind !== 'sea').map(r => [r.a, r.b]);

const cityDist = (x, z) => { let d = 1e9; for (const c of CITIES) d = Math.min(d, Math.hypot(Math.max(c.ox - x, 0, x - c.x1), Math.max(c.oz - z, 0, z - c.z1))); return d; };
const ROADS = LINKS.map(([a, b]) => { const A = CITIES[a], B = CITIES[b], p0 = [Math.round(A.cx), Math.round(A.cz)], p2 = [Math.round(B.cx), Math.round(B.cz)]; const c1 = [p2[0], p0[1]], c2 = [p0[0], p2[1]]; return { a, b, pts: [p0, cityDist(...c1) > cityDist(...c2) ? c1 : c2, p2] }; });
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const roadDist = (x, z) => { let d = 1e9; for (const r of ROADS) for (let k = 0; k < 2; k++) d = Math.min(d, segDist(x, z, ...r.pts[k], ...r.pts[k + 1])); return d; };


await stage(1);
// ---------- terrain: mountains to the east, the lake to the west, a river between, flat ground under cities and roads
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
{
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
  water.visible = false; scene.add(water); window.__water = water;   // no open water for now

  // forests: one merged mesh of small firs, on the slopes and along the valleys
  const cone = new THREE.ConeGeometry(1, 1, 5, 1); cone.translate(0, 0.5, 0);
  const trees = [], tc = [C(0x3d6144), C(0x4a6b4a), C(0x355543), C(0x587049)], mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  seed = 99;
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

  // roads between the cities, strung with lamps
  cur = world;
  const HIGHWAY = new THREE.MeshStandardMaterial({ color: 0x4b4650, roughness: 0.95 });
  for (const r of ROADS) for (let k = 0; k < 2; k++) {
    const p = r.pts[k], q2 = r.pts[k + 1];
    strip(p[0], p[1], q2[0], q2[1], 1.6, HIGHWAY, 0.03).receiveShadow = true;
    const L = Math.abs(q2[0] - p[0]) + Math.abs(q2[1] - p[1]);
    for (let d = 3; d < L; d += 7) {
      const x = p[0] + Math.sign(q2[0] - p[0]) * d, z = p[1] + Math.sign(q2[1] - p[1]) * d;
      if (cityDist(x, z) < 1) continue;
      glow(x, 0.9, z + 0.9, 0.55, GLOW_WARM, 0xffffff, 0.8); pool(x, z + 0.6, 2.8, 0xffb868, 0.3);
    }
  }
  bake(world);
}

await stage(2);
// ---------- cities
const borderMat = (k, wide) => fxMat(null, new THREE.Color(FAMILY[k]).multiplyScalar(wide ? 1 : 1.5), wide ? 0.2 : 1);
const lods = new THREE.Group(), details = new THREE.Group(); root.add(lods, details);
const trucks = [];
let nBuildings = 0;

// what stands on every lot of a city this year: decided once, shared by the far and the near versions
function plan(C) {
  C.lots = []; C.lamps = []; C.d = C.p.districts; C.held = C.p.held;
  for (let i = 0; i < C.W; i++) for (let j = 0; j < C.H; j++) {
    const x = C.ox + i * T, z = C.oz + j * T, ri = i % 4 === 0, rj = j % 3 === 0;
    if (ri && rj) continue;
    if (ri) C.lamps.push([x + 0.82, z, Math.PI]);
    else if (rj && i % 2) C.lamps.push([x, z + 0.82, Math.PI / 2]);
  }
  for (const l of C.p.lots) {
    const x = C.ox + l.i * T, z = C.oz + l.j * T, rot = (l.j % 3 === 2) ? 0 : (l.i % 4 === 3 ? Math.PI / 2 : 0), sy = 0.96 + hsh(l.i, l.j) * 0.1;
    C.lots.push({ i: l.i, j: l.j, x, z, name: l.model, rot, sy, tint: l.tint, h: ERA.models[l.model].h * sy, lit: l.lit, tower: l.tower && !l.site, tx: (l.turn - .5) * .5, tr: l.turn * 6, shop: l.shop, ours: l.ours, site: l.site, hideout: l.hideout && l.ours, di: l.district, bx: l.bx, by: l.by });
  }
  nBuildings += C.lots.length;
}
function borders(C) {       // district frontiers, drawn on the streets like on a strategy map
  for (const d of C.d) {
    const inset = d.owner === 'family' ? 0.6 : 0.78, x0 = C.ox + d.c0 * 4 * T + inset, x1 = C.ox + d.c1 * 4 * T - inset, z0 = C.oz + d.r0 * 3 * T + inset, z1 = C.oz + d.r1 * 3 * T - inset;
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) {
      strip(ax, az, bx, bz, 0.16, borderMat(d.owner, 0), 0.135, 3); strip(ax, az, bx, bz, 1.4, borderMat(d.owner, 1), 0.13, 3);
    }
  }
}
// the new game has no districts: who holds each block shows on its streets, and the family's frontier is one bright line.
// It is its own small group, redrawn alone when the streets change hands, so the buildings are not rebuilt for it.
const gripKey = p => p.blocks.map(b => (b.grip ? b.grip[0] : '-') + Math.round(b.hold * 2)).join('');
function turfGround(C) {
  if (C.turf) { lods.remove(C.turf); dispose(C.turf); }
  cur = new THREE.Group();
  const bw = 4 * T, bd = 3 * T, at = (x, y) => (x < 0 || y < 0 || x >= C.bx || y >= C.by) ? null : C.p.blocks[y * C.bx + x];
  for (const b of C.p.blocks) {
    if (!b.grip) continue;
    const ours = b.grip === 'family', x0 = C.ox + b.x * bw, z0 = C.oz + b.y * bd;
    const col = new THREE.Color(ours ? FAMILY.family : b.grip === 'contested' ? 0xffffff : FAMILY[C.p.rival] || FAMILY.other);
    const fill = new THREE.Mesh(UNIT, fxMat(null, col, ours ? 0.10 + 0.07 * Math.round(b.hold * 2) : b.grip === 'contested' ? 0.09 : 0.045));
    fill.rotation.x = -Math.PI / 2; fill.position.set(x0 + bw / 2, 0.128, z0 + bd / 2); fill.scale.set(bw, bd, 1); fill.renderOrder = 3; cur.add(fill);
    if (!ours) continue;
    for (const [dx, dy, ax, az, ex, ez] of [[0, -1, x0, z0, x0 + bw, z0], [1, 0, x0 + bw, z0, x0 + bw, z0 + bd], [0, 1, x0, z0 + bd, x0 + bw, z0 + bd], [-1, 0, x0, z0, x0, z0 + bd]]) {
      const n = at(b.x + dx, b.y + dy);
      if (!n || n.grip !== 'family') { strip(ax, az, ex, ez, 0.2, borderMat('family', 0), 0.135, 3); strip(ax, az, ex, ez, 1.3, borderMat('family', 1), 0.13, 3); }
    }
  }
  bake(cur); C.turf = cur; C.gripKey = gripKey(C.p); lods.add(cur);
}
// far version: plain coloured blocks and a few lights. A whole city is a few thousand triangles.
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.translate(0, 0.5, 0); BOX.deleteAttribute('uv');
const FARMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
function colored(g, c) { const a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function buildFar(C) {
  const G = new THREE.Group(), geos = [], m4 = new THREE.Matrix4(), box = (x, y, z, w, h, d, c) => geos.push(colored(BOX.clone().applyMatrix4(m4.makeScale(w, h, d).setPosition(x, y, z)), c));
  const street = new THREE.Color(0x4a454d), walk = new THREE.Color(0x77707a), tmp = new THREE.Color();
  box((C.ox + C.x1) / 2, 0, (C.oz + C.z1) / 2, C.x1 - C.ox + 2, 0.05, C.z1 - C.oz + 2, street);
  for (let bi = 0; bi < C.bx; bi++) for (let bj = 0; bj < C.by; bj++) box(C.ox + (bi * 4 + 2) * T, 0.04, C.oz + (bj * 3 + 1.5) * T, 3 * T, 0.08, 2 * T, walk);
  for (const l of C.lots) box(l.x, 0.1, l.z, 1.45, l.h, 1.45, tmp.copy(FARCOL[l.tint]).multiplyScalar(0.85 + 0.3 * hsh(l.i, l.j)));
  const far = new THREE.Mesh(mergeGeometries(geos), FARMAT); far.castShadow = far.receiveShadow = true; far.userData.merged = true; geos.forEach(g => g.dispose());
  cur = new THREE.Group();
  for (const l of C.lots) if (l.shop && hsh(l.j, l.i) < 0.6) pool(l.x, l.z + 0.9, 3.2, l.ours ? 0xffc46a : 0xffa860, l.ours ? 0.6 : 0.3);
  for (const l of C.lots) if (l.site) pool(l.x, l.z + 0.9, 4.5, new THREE.Color(l.site.color), 0.8);     // the family's places show from afar
  bake(cur); C.farBody = new THREE.Group(); C.farBody.add(far, cur);
  cur = new THREE.Group(); if (!C.p.turf) borders(C); bake(cur);
  G.add(C.farBody, cur); lods.add(G); C.far = G;
  if (C.p.turf) turfGround(C);
}
// near version: the real models, one instanced draw call per model and light level
function buildNear(C) {
  const G = new THREE.Group(), inst = new Map(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const add = (name, mat, x, y, z, rot, sy, color, shadow = true) => {
    const key = name + ':' + mat.uuid + ':' + Math.floor((x - C.ox) / 24) + ':' + Math.floor((z - C.oz) / 24); if (!inst.has(key)) inst.set(key, { name, mat, shadow, list: [] });
    e.set(0, rot, 0); inst.get(key).list.push([new THREE.Matrix4().compose(p.set(x, y, z), q.setFromEuler(e), s.set(1, sy, 1)), color]);
  };
  for (let i = 0; i < C.W; i++) for (let j = 0; j < C.H; j++) {
    const x = C.ox + i * T, z = C.oz + j * T, ri = i % 4 === 0, rj = j % 3 === 0;
    if (ri && rj) add('road_junction', PLAINMAT, x, 0, z, 0, 1, ROADTINT);
    else if (ri) add(j % 3 === 1 ? 'road_straight_crossing' : 'road_straight', PLAINMAT, x, 0, z, 0, 1, ROADTINT);
    else if (rj) add(i % 4 === 2 ? 'road_straight_crossing' : 'road_straight', PLAINMAT, x, 0, z, Math.PI / 2, 1, ROADTINT);
  }
  cur = new THREE.Group();
  for (const l of C.lots) {
    add(l.name, ERAMATS[l.lit], l.x, 0, l.z, l.rot, l.sy, TINTS[l.tint]);
    if (l.tower) add('watertower', PLAINMAT, l.x + l.tx * 0.6, l.h, l.z - 0.2, l.tr, 1, PROPTINT);
    if (l.shop) {      // warm light spilling from the ground floor onto the pavement
      const dx = l.rot ? 0.95 : 0, dz = l.rot ? 0 : 0.95;
      pool(l.x + dx, l.z + dz, 1.9, l.ours ? 0xffc46a : 0xffa860, l.ours ? 0.45 : 0.25);
      glow(l.x + dx * 0.78, 0.42, l.z + dz * 0.78, 0.8, GLOW_SOFT, 0xffd08a, 0.5);
    }
  }
  for (const [x, z, r] of C.lamps) {
    add('streetlight', PLAINMAT, x, 0, z, r, 1, PROPTINT, false);
    const hx = x - Math.cos(r) * 0.22, hz = z + Math.sin(r) * 0.22;
    glow(hx, 1.02, hz, 0.55, GLOW_WARM, 0xffffff, 0.85); pool(hx, hz, 2.4, 0xffb868, 0.38);
  }
  for (const l of C.lots) if (l.site || l.hideout) {     // the family's places carry a sign, and so does the capo's hideout
    if (!l.site) l.site0 = { sign: 'SOCIAL CLUB', color: '#ffc74a' };
    const fx = l.rot ? 1 : 0, fz = l.rot ? 0 : 1, look = l.site || l.site0, sg = sign(look.sign, look.color);
    sg.position.set(l.x + fx * 0.84, 0.95, l.z + fz * 0.84); if (l.rot) sg.rotation.y = Math.PI / 2; cur.add(sg);
    glow(l.x + fx, 0.9, l.z + fz, 2.2, GLOW_SOFT, new THREE.Color(look.color), 0.7); pool(l.x + fx * 1.3, l.z + fz * 1.3, 3, new THREE.Color(look.color), 0.5);
  }
  bake(cur); G.add(cur);
  for (const { name, mat, shadow, list } of inst.values()) {
    const im = new THREE.InstancedMesh(GEO[name], mat, list.length); im.userData.model = name;
    list.forEach(([m, c], k) => { im.setMatrixAt(k, m); im.setColorAt(k, c); });
    im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); G.add(im);
  }
  // traffic: only the city being looked at has moving cars
  C.cars = []; seed = 500 + C.W;
  const n = Math.round(C.lots.length / 14 * (0.6 + 0.25 * C.held));
  for (let k = 0; k < n; k++) {
    const alongX = rnd() < 0.5, dir = rnd() < 0.5 ? 1 : -1;
    const geo = GEO[pick(['car_sedan', 'car_stationwagon', 'car_sedan', 'car_hatchback'])], mat = pick(CARMATS);
    const line = alongX ? C.oz + 3 * Math.floor(rnd() * (C.by + 1)) * T : C.ox + 4 * Math.floor(rnd() * (C.bx + 1)) * T;
    const min = alongX ? C.ox : C.oz, max = alongX ? C.x1 : C.z1;
    C.cars.push({ geo, mat, y: 0.17, s: 1, hl: fxMat(GLOW_SOFT, 0xfff0c8, 0.7), hs: 1.7, alongX, dir, min, max, p: min + rnd() * (max - min), lane: line + (alongX ? -dir : dir) * 0.42, speed: 1.2 + rnd() });
  }
  details.add(G); C.near = G; C.nearAt = performance.now();
}
// Everything that moves is drawn in lots: one draw call per kind of car and one for all headlights,
// however many are on the road. Each frame empties the lots and fills them again.
const batches = new Map(), _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bs = new THREE.Vector3(), _bp = new THREE.Vector3();
const UPY = new THREE.Vector3(0, 1, 0), QFLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
function batch(geo, mat, order) {
  const k = geo.uuid + mat.uuid; let b = batches.get(k);
  if (!b) { b = new THREE.InstancedMesh(geo, mat, 384); b.count = 0; b.frustumCulled = false; b.castShadow = false; if (order) b.renderOrder = order; scene.add(b); batches.set(k, b); }
  return b;
}
// A car that is not on the screen is not drawn: a car is some 1,200 triangles, and most of a city's cars are out of sight.
const _cv = new THREE.Vector3();
function putCar(geo, mat, x, y, z, rot, scale) {
  _cv.set(x, y, z).project(cam); if (_cv.x < -1.15 || _cv.x > 1.15 || _cv.y < -1.15 || _cv.y > 1.15) return;
  const b = batch(geo, mat); if (b.count >= 384) return;
  _bm.compose(_bp.set(x, y, z), _bq.setFromAxisAngle(UPY, rot), _bs.set(scale, scale, scale)); b.setMatrixAt(b.count++, _bm);
}
function putLight(mat, x, z, size) {
  const b = batch(UNIT, mat, 2); if (b.count >= 384) return;
  _bm.compose(_bp.set(x, 0.125, z), QFLAT, _bs.set(size, size, 1)); b.setMatrixAt(b.count++, _bm);
}
function moveCars(list, dt) {
  for (const c of list) {
    let x, z, fx, fz;
    if (c.path) {                         // trucks between cities, back and forth along the road
      c.p += c.dir * c.speed * dt; if (c.p > c.len) { c.p = c.len; c.dir = -1; } if (c.p < 0) { c.p = 0; c.dir = 1; }
      const [a, b, d] = c.path, l1 = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      const [p, q, t] = c.p < l1 ? [a, b, c.p / (l1 || 1)] : [b, d, (c.p - l1) / ((c.len - l1) || 1)];
      fx = Math.sign(q[0] - p[0]) * c.dir; fz = Math.sign(q[1] - p[1]) * c.dir;
      x = p[0] + (q[0] - p[0]) * t - fz * 0.4; z = p[1] + (q[1] - p[1]) * t + fx * 0.4;
    } else {
      c.p += c.dir * c.speed * dt; if (c.p > c.max + 1) c.p = c.min - 1; if (c.p < c.min - 1) c.p = c.max + 1;
      x = c.alongX ? c.p : c.lane; z = c.alongX ? c.lane : c.p; fx = c.alongX ? c.dir : 0; fz = c.alongX ? 0 : c.dir;
    }
    putCar(c.geo, c.mat, x, c.y, z, Math.atan2(fx, fz), c.s); putLight(c.hl, x + fx * 1.2, z + fz * 1.2, c.hs);
  }
}
function buildYear() {
  for (const C of CITIES) { if (C.far) dispose(C.far); if (C.near) dispose(C.near); C.far = C.near = null; }
  trucks.length = 0;
  nBuildings = 0;
  CITIES.forEach(C => { plan(C); buildFar(C); });
  seed = 31;
  for (const r of ROADS) {         // more trucks on the roads we control
    const busy = Math.min(4, 1 + ((CITIES[r.a].held + CITIES[r.b].held) >> 1));
    const [p0, p1, p2] = r.pts, len = Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]) + Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]);
    for (let k = 0; k < busy; k++) {
      trucks.push({ geo: GEO.car_stationwagon, mat: pick(CARMATS), y: 0.2, s: 1.3, hl: fxMat(GLOW_SOFT, 0xfff0c8, 0.8), hs: 2.6, path: r.pts, len, p: rnd() * len, dir: rnd() < 0.5 ? 1 : -1, speed: 2 + rnd() * 1.5 });
    }
  }
  shadowDirty = true;
}
buildYear();

// near or far? Only the cities in view, and only when close, get the full models. At most two are kept in memory.
const NEAR_ZOOM = 3.6 * K, tgt = new THREE.Vector3();
function levelOfDetail(now) {
  tgt.copy(cam.position).sub(OFF);
  const reach = VIEW / cam.zoom * 1.7; let built = false;
  for (const C of CITIES) {
    const want = cam.zoom >= NEAR_ZOOM && Math.hypot(tgt.x - C.cx, tgt.z - C.cz) < reach + C.r;
    if (want && !C.near && !built) { buildNear(C); built = true; shadowDirty = true; }
    const near = want && !!C.near;
    if (C.near) { if (C.near.visible !== near) shadowDirty = true; C.near.visible = near; if (near) C.nearAt = now; }
    if (C.farBody.visible === near) shadowDirty = true;
    C.farBody.visible = !near;
  }
  const kept = CITIES.filter(C => C.near).sort((a, b) => b.nearAt - a.nearAt);
  for (const C of kept.slice(2)) if (!C.near.visible) { dispose(C.near); C.near = null; }
  updateShadow(tgt);
  return built;
}

await stage(3);
// ---------- post: bloom on the lights, then a film grade (split tone, vignette, tilt-shift, grain)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, cam));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.5, 0.9);
const Grade = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(innerWidth * pr, innerHeight * pr) }, t: { value: 0 }, sat: { value: 1 }, con: { value: 1 }, vig: { value: 0.9 }, grain: { value: 0.035 }, rain: { value: 0 },
    shT: { value: new THREE.Vector3(1, 1, 1) }, hiT: { value: new THREE.Vector3(1, 1, 1) }, sep: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float t, sat, con, vig, grain, rain; uniform vec3 shT, hiT, sep; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      float d = abs(vUv.y - 0.5);                       // tilt-shift: blur the top and bottom
      float r = smoothstep(0.30, 0.5, d) * 1.6 / res.y;
      vec3 c = vec3(0.);
      for (int i = -2; i <= 2; i++) c += texture2D(tDiffuse, vUv + vec2(0., float(i) * r * 1.5)).rgb;
      c /= 5.;
      float l = dot(c, vec3(.299,.587,.114));
      c = mix(c, c * shT, 1. - smoothstep(0., .45, l));                        // tinted shadows
      c = mix(c, c * hiT, smoothstep(.35, 1., l));                             // tinted highlights
      l = dot(c, vec3(.299,.587,.114));
      float warm = clamp((c.r - max(c.g, c.b)) * 3., 0., 1.);                  // lamps and reds keep their colour
      c = mix(vec3(l), c, mix(sat, max(sat, 1.05), warm));
      c = ((c - .5) * con + .5) * sep;
      vec2 q = vUv - .5; c *= 1. - dot(q, q) * vig;                            // vignette
      if (rain > 0.) { vec2 rp = vec2(vUv.x * res.x * 0.30 + vUv.y * res.y * 0.05, vUv.y * res.y * 0.018 + t * 11.); c += rain * 0.09 * step(0.975, h(floor(rp))) * fract(rp.y); }
      c += (h(vUv * res + t) - .5) * grain;                                    // grain
      gl_FragColor = vec4(c, 1.);
    }`
};
const grade = new ShaderPass(Grade);
composer.addPass(bloom); composer.addPass(new OutputPass()); composer.addPass(grade);
const V3 = (r, g, b) => new THREE.Vector3(r, g, b);
const LOOKS = {
  noir: { sky: 0x6f84c0, gnd: 0x20222c, hemi: 1.5, sun: 0xa9bdf0, sunI: 1.7, exp: 1.3, bg: 0x0b0d12, cA: V3(0.012, 0.02, 0.05), cB: V3(0.06, 0.08, 0.14), cG: V3(0.6, 0.7, 1.0),
    sat: 0.45, shT: V3(0.82, 0.93, 1.15), hiT: V3(1.05, 1.0, 0.94), con: 1.12, vig: 1.25, grain: 0.05, rain: 1, sep: V3(1, 1, 1) },
  gaslight: { sky: 0xc9b79a, gnd: 0x3a2c20, hemi: 1.7, sun: 0xffcf9a, sunI: 2.4, exp: 1.05, bg: 0x15110d, cA: V3(0.05, 0.045, 0.035), cB: V3(0.22, 0.17, 0.11), cG: V3(1.0, 0.8, 0.5),
    sat: 0.28, shT: V3(1.0, 0.96, 0.9), hiT: V3(1.08, 1.0, 0.86), con: 1.06, vig: 1.1, grain: 0.06, rain: 0, sep: V3(1.06, 0.98, 0.84) },
  dusk: { sky: 0x8f9cf0, gnd: 0x4a3540, hemi: 2.3, sun: 0xffa25e, sunI: 3.1, exp: 1.1, bg: 0x191a22, cA: V3(0.035, 0.05, 0.13), cB: V3(0.20, 0.10, 0.17), cG: V3(1.0, 0.62, 0.42),
    sat: 1.08, shT: V3(0.86, 0.94, 1.12), hiT: V3(1.10, 1.0, 0.86), con: 1, vig: 0.9, grain: 0.035, rain: 0, sep: V3(1, 1, 1) },
};
window.setLook = name => {
  const L = LOOKS[name] || LOOKS.dusk, u = grade.uniforms, w = window.__water.material.uniforms;
  hemi.color.set(L.sky); hemi.groundColor.set(L.gnd); hemi.intensity = L.hemi; sun.color.set(L.sun); sun.intensity = L.sunI;
  renderer.toneMappingExposure = L.exp; scene.background.set(L.bg);
  w.cA.value.copy(L.cA); w.cB.value.copy(L.cB); w.cG.value.copy(L.cG);
  u.sat.value = L.sat; u.con.value = L.con; u.vig.value = L.vig; u.grain.value = L.grain; u.rain.value = L.rain; u.shT.value.copy(L.shT); u.hiT.value.copy(L.hiT); u.sep.value.copy(L.sep);
};
window.setLook(opt.look || Q.get('look') || 'dusk');
let fxOn = !PLAIN;
window.setFx = on => { fxOn = on; bloom.enabled = grade.enabled = on; };
window.setFx(fxOn); if (Q.has('nobloom')) bloom.enabled = false; if (Q.has('nograde')) grade.enabled = false;

function setPr(v) { pr = v; stale = 3; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); grade.uniforms.res.value.set(innerWidth * pr, innerHeight * pr); }
window.__setPr = setPr;
renderer.info.autoReset = false;
let goal = null, last = performance.now(), frames = 0, fpsT = last, fpsN = 0, slow = 0, held = false, stale = 3, lastView = '';
const focus = (id, districtId) => {     // glide to the whole map, to a city, or to one of its districts
  const c = CITIES.find(c => c.id === id), d = c && districtId && c.d.find(d => d.id === districtId);
  goal = !c ? { p: CENTER.clone().add(OFF), z: 1 } : d ? { p: new THREE.Vector3(c.ox + (d.c0 + d.c1) * 2 * T, 0, c.oz + (d.r0 + d.r1) * 1.5 * T).add(OFF), z: 11 * K }
    : { p: new THREE.Vector3(c.cx, 0, c.cz).add(OFF), z: K > 1 ? 2.4 * K : c.home ? 5.4 : 6.2 };
};
const _v = new THREE.Vector3();
const scr = (x, z, y = 0) => { _v.set(x, y, z).project(cam); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; };
// what the page writes over the map: city names from afar, district names up close, and what is happening
const labels = () => {
  const out = [], near = cam.zoom >= NEAR_ZOOM;
  CITIES.forEach(c => {
    if (!near) { const [x, y] = scr(c.ox - 2, c.oz - 2), k = c.p.held ? 'family' : c.p.rival, d = c.d.find(d => d.owner === k);
      out.push({ id: 'c' + c.id, city: c.id, name: c.name, sub: c.p.turf ? (c.p.present ? c.p.held + '% of the streets' : c.p.rivalName) : c.p.held ? `you hold ${c.p.held} of ${c.p.total}` : (d ? d.ownerName : ''), color: COLORS[c.p.turf ? (c.p.present ? 'family' : c.p.rival) : k], x, y }); }
    else if (c.near && c.near.visible) for (const d of c.d) { const [x, y] = scr(c.ox + (d.c0 + d.c1) * 2 * T, c.oz + (d.r0 + d.r1) * 1.5 * T);
      out.push(c.p.turf ? { id: 'd' + d.id, small: true, ground: true, city: c.id, name: d.name, sub: '', color: '#ffffff', x, y }
        : { id: 'd' + d.id, small: true, city: c.id, district: d.id, name: d.name, sub: d.owner === 'family' ? Math.round(d.share) + '% of the streets' : d.ownerName, color: COLORS[d.owner], x, y }); }
    // the capo is seen where he sits: over the hideout of his district
    if (near && c.near && c.near.visible && c.p.turf) for (const k of c.p.capos) {      // each capo where he is this month, with what he is doing; while he drives there, his face rides his car
      let ride = null; for (const a of agents.values()) if (a.kind === 'capo' && a.tag.capo === k.id && a.C === c) ride = a;
      const at = k.at || k, l = ride ? null : c.lots.find(l => l.i === at.i && l.j === at.j) || c.lots.find(l => l.i === k.i && l.j === k.j); if (!ride && !l) continue;
      const [x, y] = ride ? scr(ride.x === undefined ? ride.pts[0][0] : ride.x, ride.z === undefined ? ride.pts[0][1] : ride.z, 2.2) : scr(l.x, l.z, l.h + 1.2); out.push({ id: 'k' + c.id + k.id, capo: k.id, city: c.id, move: k.move, kind: k.kind, way: k.way, progress: k.progress, waiting: k.waiting, riding: !!ride, where: at.why || 'home', x, y }); }
    else if (near && c.near && c.near.visible) c.d.forEach((d, di) => { if (!d.capo) return; const l = c.lots.find(l => l.hideout && l.di === di); if (!l) return;
      const [x, y] = scr(l.x, l.z, l.h + 1.2); out.push({ id: 'k' + d.id, capo: d.capo, city: c.id, district: d.id, x, y }); });
  });
  // a mark over each place of the family, so that its trade is read at a glance
  if (near) CITIES.forEach(c => { if (!c.near || !c.near.visible) return; for (const l of c.lots) if (l.site) {
    if (c.p.turf && l.site.owner !== 'family' && !l.site.key) continue;      // a rival's ordinary place is read by its sign alone; key places always carry a mark
    const [x, y] = scr(l.x, l.z, l.h + 0.5); if (c.p.turf && (x < -40 || y < -40 || x > innerWidth + 40 || y > innerHeight + 40)) continue;
    out.push({ id: 's' + (c.p.turf ? c.id : '') + l.site.id, site: l.site.type, role: l.site.role, name: l.site.name, level: l.site.level, owner: l.site.owner, key: l.site.key, capo: l.site.capo, city: c.id, bx: l.bx, by: l.by, x, y }); } });
  // what every car carries, when the cars themselves are drawn
  let shownCars = 0;
  for (const [id, a] of agents) { if (!a.seen || a.kind === 'capo' || shownCars >= MAXTAGS) continue; shownCars++;      // a capo's own car carries his face, not a tag
    const [x, y] = scr(a.x, a.z, 1.1); out.push({ id: 'v' + id, car: a.tag, back: a.dir < 0, x, y }); }
  const shown = new Set();      // one badge per kind and per block, however many shots are fired
  for (const f of fxList) { const k = f.kind + Math.round(f.x / 12) + ':' + Math.round(f.z / 12); if (shown.has(k)) continue; shown.add(k); const [x, y] = scr(f.x, f.z); out.push({ id: 'f' + k, fx: f.kind, part: Math.min(1, f.t / f.life), x, y }); }
  return out;
};
// the state of the game changed: rebuild only the cities that look different
function update(P2) {
  P2.cities.forEach((pc, ci) => {
    const C = CITIES[ci], changed = pc.key !== C.p.key; C.p = pc; C.d = pc.districts; C.held = pc.held;
    if (!changed) { if (pc.turf && gripKey(pc) !== C.gripKey) turfGround(C); return; }
    if (C.far) dispose(C.far); if (C.near) dispose(C.near); C.far = C.near = null;
    nBuildings -= C.lots.length; plan(C); buildFar(C); shadowDirty = true;
  });
}
// fire, gunfire and police lights where something just happened
const fxList = []; let fxN = 0;
const FXLOOK = { fire: [0xff6a1a, 30], gunfire: [0xfff2c0, 6], police: [0x4a7dff, 16], promotion: [0xffd76a, 12] };
function spawnFx(kind, x, z, h = 1) {
  const look = FXLOOK[kind]; if (!look) return;
  const m = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ map: GLOW_WARM, color: look[0], blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  m.quaternion.copy(cam.quaternion); m.position.set(x, h + 0.6, z); m.renderOrder = 6; scene.add(m);
  fxList.push({ n: fxN++, kind, x, z, m, t: 0, life: look[1] });
}
function effects(list) {
  for (const e of list) {
    const C = CITIES.find(c => c.id === e.city); if (!C) continue;
    const l = typeof e.i === 'number' ? C.lots.find(l => l.i === e.i && l.j === e.j) : e.site && C.lots.find(l => l.site && l.site.id === e.site), d = C.d.find(d => d.id === e.district); if (!l && !d) continue;
    spawnFx(e.kind, l ? l.x : C.ox + (d.c0 + d.c1) * 2 * T, l ? l.z : C.oz + (d.r0 + d.r1) * 1.5 * T, l ? l.h : 1);
  }
}
// the empire at work: every trip of the plan is a car on the streets, with a coloured light that shows from afar.
// Loops run as long as the plan lists them; one-way trips (a crew sent out, rivals, the police) end where they arrive.
const agents = new Map(), MAXDOTS = 400, MAXTAGS = 28;
const dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: GLOW_WARM, size: 10, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
dots.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXDOTS * 3), 3)); dots.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXDOTS * 3), 3));
dots.geometry.setDrawRange(0, 0); dots.frustumCulled = false; dots.renderOrder = 5; scene.add(dots);
const POLICEMAT = kitMat(0.35, -1, 0x27365f), MUSCLEMAT = kitMat(0.35, -1, 0x241f1f);
function agentFor(t) {
  const C = CITIES.find(c => c.id === t.city); if (!C) return null;
  const pts = t.path.map(([i, j]) => [C.ox + i * T, C.oz + j * T]), len = []; let L = 0;
  for (let k = 1; k < pts.length; k++) { L += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]); len.push(L); }
  if (!L) return null;
  // a new car leaves from where its trip starts, after a short wait of its own so that they do not all leave at once
  return { C, pts, len, L, p: 0, dir: 1, loop: t.loop, wait: (t.loop ? hsh(pts[0][0] + L, pts[0][1]) * 3 : 0) + (t.delay || 0), sig: t.path.join(';'), leaving: false,
           geo: GEO[t.vehicle === 'truck' ? 'car_stationwagon' : 'car_sedan'], mat: t.vehicle === 'police' ? POLICEMAT : t.violent ? MUSCLEMAT : t.vehicle === 'truck' ? CARMATS[3] : CARMATS[0],
           tag: { cargo: t.cargo, amount: t.amount || 0, capo: t.capo || null, load: t.load, from: t.from, to: t.to, vehicle: t.vehicle, kind: t.kind, district: t.district, by: t.by }, kind: t.kind, vehicle: t.vehicle, violent: t.violent, color: new THREE.Color(t.color), speed: t.loop ? 2.4 : 5, o: null };
}
function traffic(trips) {
  const seen = new Set();
  for (const t of trips) {
    if (t.loop) { seen.add(t.id); const old = agents.get(t.id);
      if (old && old.sig !== t.path.join(';')) { old.leaving = true; agents.delete(t.id); agents.set('old' + (fxN++), old); }      // the route changed: the old car finishes its run
      if (!agents.has(t.id)) { const a = agentFor(t); if (a) agents.set(t.id, a); } else Object.assign(agents.get(t.id).tag, { load: t.load, amount: t.amount || 0 }); }
    else { const a = agentFor(t); if (a) agents.set('once' + (fxN++), a); }
  }
  // a run that is no longer needed is not wiped off the street: the car drives to the end of its way and stops there
  for (const [id, a] of agents) if (a.loop && !a.leaving && !seen.has(id)) { a.leaving = true; agents.delete(id); agents.set('old' + (fxN++), a); }
}
function moveAgents(dt) {
  const pos = dots.geometry.attributes.position, col = dots.geometry.attributes.color; let n = 0;
  for (const [id, a] of agents) {
    if (a.wait > 0) a.wait -= dt;
    else {
      a.p += a.dir * a.speed * dt;
      if (a.p >= a.L) {
        if (!a.loop) { const e = a.pts[a.pts.length - 1]; if (['seizure', 'hit', 'kidnap'].includes(a.kind)) spawnFx('gunfire', e[0], e[1]); agents.delete(id); continue; }
        if (a.leaving) { agents.delete(id); continue; }
        a.p = a.L; a.dir = -1; a.wait = 1.5;
      } else if (a.p <= 0) { if (a.leaving) { agents.delete(id); continue; } a.p = 0; a.dir = 1; a.wait = 1.5; }
    }
    let k = 0; while (k < a.len.length - 1 && a.len[k] < a.p) k++;
    const p0 = a.pts[k], p1 = a.pts[k + 1], s0 = k ? a.len[k - 1] : 0, t = (a.p - s0) / ((a.len[k] - s0) || 1), x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
    a.seen = !!(a.C.near && a.C.near.visible); a.x = x; a.z = z;
    if (a.seen) {
      const fx = (p1[0] - p0[0]) * a.dir, fz = (p1[1] - p0[1]) * a.dir; if (fx || fz) a.rot = Math.atan2(fx, fz);
      putCar(a.geo, a.mat, x, 0.17, z, a.rot || 0, a.vehicle === 'truck' ? 1.2 : 1);
    }
    if (n < MAXDOTS) { pos.setXYZ(n, x, 0.9, z); col.setXYZ(n, a.color.r, a.color.g, a.color.b); n++; }
  }
  dots.geometry.setDrawRange(0, n); pos.needsUpdate = col.needsUpdate = true;
  dots.material.size = clamp(6 * Math.sqrt(cam.zoom), 7, 20) * (innerHeight / 844);
}
function animateFx(dt, now) {
  for (let k = fxList.length - 1; k >= 0; k--) {
    const f = fxList[k]; f.t += dt;
    if (f.t > f.life) { f.m.removeFromParent(); f.m.material.dispose(); fxList.splice(k, 1); continue; }
    const far = clamp(4 / cam.zoom, 0.6, 4), fade = Math.min(1, (f.life - f.t) / 2); let s, o = 0.95;
    if (f.kind === 'fire') s = (5 + 1.5 * Math.sin(now * 0.013 + f.n) + Math.sin(now * 0.031)) * far;
    else if (f.kind === 'promotion') { s = (6 + 2 * Math.sin(now * 0.004)) * far; o = 0.7; }
    else if (f.kind === 'gunfire') { o = Math.sin(now * 0.045 + f.n * 2) > 0.5 ? 1 : 0; s = 3.5 * far; }
    else { f.m.material.color.setHex(Math.sin(now * 0.012) > 0 ? 0x3a6dff : 0xff2a2a); s = 4.5 * far; }
    f.m.scale.set(s, s, 1); f.m.material.opacity = o * fade;
  }
}
// The blocks where something can be placed, lit on the ground while the boss chooses: spots('ashport', [{x, y}]), and spots() to put them out.
let spotG = null, nSpots = 0;
const spotMat = fxMat(null, new THREE.Color(0x8fe6ff), 0.5);
function spots(cityId, list) {
  if (spotG) { lods.remove(spotG); dispose(spotG); spotG = null; nSpots = 0; }
  const C = CITIES.find(c => c.id === cityId); if (!C || !list || !list.length) return;
  spotG = new THREE.Group();
  const bw = 4 * T, bd = 3 * T;
  for (const b of list) { const m = new THREE.Mesh(UNIT, spotMat); m.rotation.x = -Math.PI / 2; m.position.set(C.ox + b.x * bw + bw / 2, 0.14, C.oz + b.y * bd + bd / 2); m.scale.set(bw - 0.5, bd - 0.5, 1); m.renderOrder = 4; spotG.add(m); }
  nSpots = list.length; bake(spotG); lods.add(spotG);
}
// which city and district is under a point of the screen
function pickAt(cx, cy) {
  _v.set(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2, 0).unproject(cam);
  const dir = OFF.clone().normalize().negate(), t = -_v.y / dir.y, x = _v.x + dir.x * t, z = _v.z + dir.z * t;
  for (const C of CITIES) if (x >= C.ox - 1 && x <= C.x1 + 1 && z >= C.oz - 1 && z <= C.z1 + 1) {
    const bi = (x - C.ox) / (4 * T), bj = (z - C.oz) / (3 * T), d = C.d.find(d => bi >= d.c0 && bi < d.c1 && bj >= d.r0 && bj < d.r1);
    const bx = Math.floor(bi), by = Math.floor(bj), lot = C.p.turf ? C.lots.find(l => l.site && l.bx === bx && l.by === by) : null;
    return { city: C.id, district: d && !C.p.turf ? d.id : null, zone: d ? d.name : null, bx, by, site: lot ? lot.site : null, block: C.p.turf && C.p.blocks[by * C.bx + bx] || null, near: cam.zoom >= NEAR_ZOOM };
  }
  return null;
}
function frame(now) {
  if (!due(now, last)) { requestAnimationFrame(frame); return; }      // never more than 60 images a second (render/pace.mjs)
  const real = Math.min(1, (now - last) / 1000), dt = Math.min(0.05, real); last = now;      // cars never jump more than a twentieth of a second; a fire burns its real time, however slow the machine
  if (goal) { cam.position.lerp(goal.p, 0.12); cam.zoom += (goal.z - cam.zoom) * 0.12; cam.updateProjectionMatrix(); if (cam.position.distanceTo(goal.p) < 0.05 && Math.abs(goal.z - cam.zoom) < 0.01) goal = null; }
  // Nothing is drawn again while nothing changes: time stopped, camera still, no fire or gunfire, no street on offer.
  // Anything that changes the picture (the camera, an order to the map, the size of the window) asks for a few images more.
  const view = cam.position.x + ',' + cam.position.y + ',' + cam.position.z + ',' + cam.zoom;
  if (view !== lastView || goal || !held || fxList.length || spotG || frames < 4) stale = 3;
  lastView = view;
  if (stale > 0) {
    stale--;
    if (levelOfDetail(now)) stale = 3;      // a city still being built
    for (const b of batches.values()) b.count = 0;
    // while the game's time stands still nothing drives: every car waits where it is, and leaves again with the clock
    const drive = held ? 0 : dt;
    moveCars(trucks, drive); for (const C of CITIES) if (C.near && C.near.visible) moveCars(C.cars, drive);
    moveAgents(drive); animateFx(real, now);
    for (const b of batches.values()) b.instanceMatrix.needsUpdate = true;
    grade.uniforms.t.value = now * 0.001; window.__water.material.uniforms.t.value = now * 0.001;
    renderer.info.reset(); composer.render(); frames++;
    window.__stats = { cars: agents.size, buildings: nBuildings, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr };
  }
  fpsN++;
  if (now - fpsT > 1000) {
    const fps = Math.round(fpsN * 1000 / (now - fpsT)); window.__fps = fps; fpsT = now; fpsN = 0;
    // adaptive quality: below 40 images a second for two seconds, lower the resolution one step
    slow = fps < 40 ? slow + 1 : 0;
    if (slow >= 2 && pr > 1 && !Q.has('fixed')) { setPr(Math.max(1, pr - 0.25)); slow = 0; }
    const el = document.getElementById('fps'); if (el && !el.classList.contains('on')) el.textContent = fps + ' fps';     // the page writes the full reading itself when the meter is open
  }
  if (frames === 3) { window.__ready = true; if (opt.onStage) opt.onStage(4); }
  if (spotG) spotMat.opacity = 0.42 + 0.2 * Math.sin(performance.now() / 260);      // the streets on offer breathe
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- touch: drag to pan, pinch or wheel to zoom
const el = renderer.domElement, pts = new Map(); let pinch = 0;
const right = new THREE.Vector3(1, 0, -1).normalize(), fwd = new THREE.Vector3(-1, 0, -1).normalize();
function pan(dx, dy) {
  const k = (2 * VIEW / cam.zoom) / innerHeight;
  cam.position.add(right.clone().multiplyScalar(-dx * k)).add(fwd.clone().multiplyScalar(dy * k / 0.66));
}
function zoomBy(f) { cam.zoom = clamp(cam.zoom * f, 0.9, 24 * K); cam.updateProjectionMatrix(); }
el.style.touchAction = 'none';
let tap = null;
el.addEventListener('pointerdown', e => { goal = null; tap = pts.size ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; pts.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); pinch = 0; });
el.addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return;
  const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
  pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 1) pan(dx, dy);
  else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomBy(d / pinch); pinch = d; }
});
const up = e => { pts.delete(e.pointerId); pinch = 0;
  if (tap && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 9 && performance.now() - tap.t < 500 && opt.onTap) opt.onTap(pickAt(e.clientX, e.clientY), e.clientX, e.clientY);
  tap = null; };
el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
el.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
addEventListener('resize', () => {
  aspect = innerWidth / innerHeight; cam.left = -VIEW * aspect; cam.right = VIEW * aspect; cam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); setPr(pr); shadowDirty = true; stale = 3;
});

  // census(): the triangles in the scene by model, for the optimisation reviews (what is visible now, and everything built)
  const census = () => { const out = {};
    scene.traverse(o => { if (!o.isMesh && !o.isPoints) return; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      let seen = true; for (let q = o; q; q = q.parent) if (!q.visible) seen = false;
      const k = o.userData.model || (o.isInstancedMesh ? 'instances of ' + Math.round((g.index ? g.index.count : g.attributes.position.count) / 3) + ' triangles' : 'ground, streets and merged parts'), r = out[k] || (out[k] = { visible: 0, built: 0, meshes: 0 });
      r.built += n; r.meshes++; r.count = (r.count || 0) + (o.isInstancedMesh ? o.count : 1); if (seen) r.visible += n; });
    return out; };
  const waking = f => (...a) => { stale = 3; return f(...a); };      // an order to the map changes the picture
  return { update: waking(update), effects: waking(effects), traffic: waking(traffic), labels, census, focus: waking(focus), pickAt, spots: waking(spots), hold: waking((v) => { held = !!v; }), setLook: waking(window.setLook), setFx: waking(window.setFx),
           stats: () => ({ ...window.__stats, cars: agents.size, buildings: nBuildings, moving: !!goal, spots: nSpots, held, drawn: frames }) };     // counted now, not at the last frame drawn; moving while the camera glides
}
