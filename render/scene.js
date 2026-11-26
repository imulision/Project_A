// The 3D map of the game. start(plan, options) builds the world once from a plan made by web/mapview.js
// and returns { update, effects, labels, focus, setLook, setFx }. It reads the game, it never decides anything.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { pacer, quality } from './pace.mjs';
import { makeFx } from './fx.js';
import { makeTraffic } from './traffic.js';
import { makeLabels } from './labels.js';
import { makeTerrain } from './terrain.js';
import { makeTouch } from './touch.js';
import { lotLook, turned, front, midX, midY } from './look.mjs';
import { makePeriod } from './period.mjs';
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
function sign(text, color, keep = true) {     // glowing shop sign; the ones not kept apart are merged, one draw call a name
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
  const m = new THREE.Mesh(SIGNGEO, SIGNS[key]); m.userData.keep = keep;
  return m;
}
const ADDMATS = new Map(), _lit = new THREE.Color();
const addMat = (map) => { const k = map ? map.id : 'x'; if (!ADDMATS.has(k)) ADDMATS.set(k, new THREE.MeshBasicMaterial({ map, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); return ADDMATS.get(k); };
// merge every static mesh of a group into one mesh per material: a handful of draw calls instead of hundreds
function bake(group) {
  const groups = new Map(), dead = [];
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    // An added light (a glow, a pool, a border) of any colour and strength is the same light with its colour times its
    // strength in the vertices: all of them on one texture share one material, so one draw call, not one a colour.
    const lit = o.material.blending === THREE.AdditiveBlending && !o.material.vertexColors, mat = lit ? addMat(o.material.map) : o.material;
    const key = mat.uuid + ':' + o.renderOrder + ':' + o.castShadow + ':' + o.receiveShadow;
    if (!groups.has(key)) groups.set(key, { o, mat, geos: [] });
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
    if (lit) colored(g, _lit.copy(o.material.color).multiplyScalar(o.material.opacity));
    groups.get(key).geos.push(g); dead.push(o);
  });
  for (const o of dead) o.removeFromParent();
  for (const { o, mat, geos } of groups.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
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
const NAMES = ['road_straight', 'road_junction', 'road_straight_crossing', 'watertower'];
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
{ const cap = new THREE.BoxGeometry(1.42, 0.07, 1.42); cap.translate(0, 0.035, 0); cap.deleteAttribute('uv'); GEO.roofcap = cap;
  const slab = new THREE.BoxGeometry(1, 1, 1); slab.translate(0, 0.5, 0); slab.deleteAttribute('uv'); GEO.slab = slab;
  const fir = new THREE.ConeGeometry(0.75, 1, 6, 1); fir.translate(0, 0.5, 0); fir.deleteAttribute('uv'); GEO.fir = fir; }      // the coloured roof of a building the family, or a rival, holds
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
        float sign = step(2.5, vWin);      // the signs of a headquarters never go out
        float on = max(step(rr, uLit + shopW * 0.4), sign);
        vec3 lamp = mix(vec3(1.0, 0.58, 0.2), vec3(1.0, 0.84, 0.52), fract(rr * 7.31));
        lamp = mix(lamp, vec3(1.0, 0.8, 0.36), sign);
        totalEmissiveRadiance += isWin * on * lamp * (0.3 + 0.35 * fract(rr * 3.7) + shopW * 0.35 + sign * 0.9);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.045, 0.07), isWin * (1. - on));`);
  };
  m.customProgramCacheKey = () => 'era' + lit;
  return m;
}
const ERAMATS = [0.07, 0.13, 0.2, 0.28].map(eraMat);
const PLAINMAT = kitMat(), LITS = [0.18, 0.3, 0.42, 0.58].map(l => kitMat(0.85, l));
// The vehicles and street lamps of the period are built by code (period.mjs) and carry their own colours. Pure white is the
// paint: carMat(colour) replaces it with the colour of that car and leaves tyres, glass, chrome, wood and canvas as they are.
{ const P = makePeriod(THREE, mergeGeometries); GEO.car_sedan = P.sedan; GEO.car_hatchback = P.coupe; GEO.car_stationwagon = P.truck; GEO.streetlight = P.lamp; }
function carMat(paint) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uPaint = { value: new THREE.Color(paint) };
    sh.fragmentShader = 'uniform vec3 uPaint;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= all(greaterThan(vColor.rgb, vec3(0.99))) ? uPaint : vColor.rgb;');
  };
  m.customProgramCacheKey = () => 'car';
  return m;
}
const CARMATS = [0x3a3636, 0x2c3038, 0x7d3a34, 0x3f5a4a].map(carMat), LAMPMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), WHITE = new THREE.Color(1, 1, 1);
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
// ---------- terrain: built once by terrain.js (mountains, hills, forests); the roads between the cities are laid here
const { height, hsh, water } = makeTerrain({ THREE, mergeGeometries, scene, K, lerp, sstep, cityDist, roadDist, rnd, reseed: (n) => { seed = n; } });
window.__water = water;
{
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
  C.shut = new Set((C.p.shut || []).map(q => q.x + ',' + q.y));      // where two blocks stand as one: no street there, two buildings instead
  for (let i = 0; i < C.W; i++) for (let j = 0; j < C.H; j++) {
    const x = C.ox + i * T, z = C.oz + j * T, ri = i % 4 === 0, rj = j % 3 === 0;
    if (ri && rj) continue;
    if ((ri || rj) && !streetAt(C, i, j)) continue;
    if (ri) C.lamps.push([x + 0.82, z, Math.PI]);
    else if (rj && i % 2) C.lamps.push([x, z + 0.82, Math.PI / 2]);
  }
  for (const l of C.p.lots.concat(C.p.infill || [])) {
    const x = C.ox + l.i * T, z = C.oz + l.j * T, rot = (l.j % 3 === 2) ? 0 : (l.i % 4 === 3 ? Math.PI / 2 : 0), sy = 0.96 + hsh(l.i, l.j) * 0.1;
    C.lots.push({ i: l.i, j: l.j, x, z, name: l.model, rot, sy, tint: l.tint, h: l.open ? 0.1 : ERA.models[l.model].h * sy, open: l.open || null, lit: l.lit, tower: l.tower && !l.site && !l.open, tx: (l.turn - .5) * .5, tr: l.turn * 6, shop: l.shop && !l.open, ours: l.ours, infill: !!l.infill, boom: !!l.boom, low: !!l.low, burnt: !!l.burnt, works: !!l.works, men: l.men || 0, site: l.site, hideout: l.hideout && l.ours, di: l.district, bx: l.bx, by: l.by });
  }
  nBuildings += C.lots.length; C.chunks = chunks(C);
  C.baseKey = (C.p.blocks || []).map(b => b.void ? b.void[0] : '-').join('') + '|' + [...C.shut].join(' ');      // what the base of the near version is made of
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
const gripKey = p => p.blocks.map(b => (b.grip ? b.grip[0] : '-') + Math.round(b.hold * 2) + (b.press >= 0.6 ? 'p' : '')).join('');
// the front line: one material for every pressed edge, its light beats with the frame (see the loop)
const FRONTMAT = new THREE.MeshBasicMaterial({ color: 0xff2e1f, transparent: true, depthWrite: false, opacity: 0.7, toneMapped: false });
function turfGround(C) {
  if (C.turf) { lods.remove(C.turf); dispose(C.turf); }
  cur = new THREE.Group();
  const bw = 4 * T, bd = 3 * T, at = (x, y) => (x < 0 || y < 0 || x >= C.bx || y >= C.by) ? null : C.p.blocks[y * C.bx + x];
  for (const b of C.p.blocks) {
    if (!b.grip) continue;
    if (b.void) continue;      // nobody holds water, rails or waste ground
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
  for (const f of front(C.p.blocks, C.bx, C.by)) {      // where a rival presses hard on a street of the family, the edge beats red
    const x0 = C.ox + f.x * bw, z0 = C.oz + f.y * bd, ax = f.dx > 0 ? x0 + bw : x0, az = f.dy > 0 ? z0 + bd : z0;
    strip(ax, az, f.dx ? ax : x0 + bw, f.dy ? az : z0 + bd, 0.5, FRONTMAT, 0.145, 5);
  }
  bake(cur); C.turf = cur; C.gripKey = gripKey(C.p); lods.add(cur);
}
// Open ground, far and near alike: a park is a lawn with a few trees, an empty lot is bare earth. put(x, y, z, w, h, d, colour) draws one box.
const LAWN = 0x4f6b45, EARTH = 0x4d4a3c, LEAF = [0x3d6144, 0x4a6b4a, 0x355543];
// What the rules leave out of a town gives it its outline: water, a rail yard, waste ground. No street, no pavement, nothing built.
const VOIDS = { water: 1, rail: 1, waste: 1 }, WATER = 0x223a4e, BALLAST = 0x4a4540, RAIL = 0x9a97a0;
const isVoid = (C, bx, by) => bx < 0 || by < 0 || bx >= C.bx || by >= C.by || !!C.p.blocks[by * C.bx + bx].void;
// a street tile is drawn when at least one block of the town touches it
function streetAt(C, i, j) {
  if (!C.p.blocks) return true;
  if (i % 4 === 0 && j % 3 !== 0 && C.shut && C.shut.has((i / 4) + ',' + Math.floor(j / 3))) return false;
  const bxs = i % 4 === 0 ? [i / 4 - 1, i / 4] : [Math.floor(i / 4)], bys = j % 3 === 0 ? [j / 3 - 1, j / 3] : [Math.floor(j / 3)];
  for (const bx of bxs) for (const by of bys) if (!isVoid(C, bx, by)) return true;
  return false;
}
function voidGround(C, put) {
  if (!C.p.blocks) return;
  for (const b of C.p.blocks) {
    if (!b.void) continue;
    const x = C.ox + (b.x * 4 + 2) * T, z = C.oz + (b.y * 3 + 1.5) * T, w = 4 * T, d = 3 * T;
    if (b.void === 'water') {      // on the rim of the town the water runs on past it: a river or a bay, not a pool
      const wx0 = b.x === 0 ? 9 : 0, wx1 = b.x === C.bx - 1 ? 9 : 0, wz0 = b.y === 0 ? 9 : 0, wz1 = b.y === C.by - 1 ? 9 : 0;
      put(x + (wx1 - wx0) / 2, 0.02, z + (wz1 - wz0) / 2, w + wx0 + wx1 + 0.4, 0.05, d + wz0 + wz1 + 0.4, WATER);
    }
    else if (b.void === 'rail') { put(x, 0.02, z, w, 0.07, d, BALLAST); for (const o of [-1.9, -1.3, 0.9, 1.5]) put(x, 0.09, z + o, w, 0.05, 0.1, RAIL); }
    else for (let k = 0; k < 3; k++) { const a = hsh(b.x * 5 + k, b.y), c = hsh(b.y * 3 + k, b.x); if (a > 0.55) put(x + (a - 0.5) * w * 0.8, 0.02, z + (c - 0.5) * d * 0.8, 0.5, 0.35 + c * 0.4, 0.5, LEAF[k]); }      // waste ground: the land shows, with a few bushes
  }
}
const COURT = '#8f8a80';
function openGround(l, put) {
  if (VOIDS[l.open]) return;      // not part of the town: drawn block by block (voidGround)
  put(l.x, 0.1, l.z, l.open === 'court' ? 2 : 1.9, 0.05, l.open === 'court' ? 2 : 1.9, l.open === 'park' ? LAWN : l.open === 'court' ? COURT : EARTH);      // the court of a headquarters is paved, and runs under its wide front
  if (l.open !== 'park') return;
  for (let k = 0; k < 3; k++) { const a = hsh(l.i + k * 7, l.j), b = hsh(l.j, l.i + k * 5); if (a < 0.25) continue;
    put(l.x + (a - 0.5) * 1.4, 0.15, l.z + (b - 0.5) * 1.4, 0.42, 0.7 + b * 0.7, 0.42, LEAF[k]); }
}
const roofColor = (k, into) => into.set(k.roof === 'family' ? FAMILY.family : k.roof).multiplyScalar(k.gain);
const ROOFMAT = new THREE.MeshStandardMaterial({ roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0 });
// far version: plain coloured blocks and a few lights. A whole city is a few thousand triangles.
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.translate(0, 0.5, 0); BOX.deleteAttribute('uv');
const FARMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
function colored(g, c) { const a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = c.r; a[k + 1] = c.g; a[k + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function buildFar(C) {
  const G = new THREE.Group(), geos = [], m4 = new THREE.Matrix4(), box = (x, y, z, w, h, d, c) => geos.push(colored(BOX.clone().applyMatrix4(m4.makeScale(w, h, d).setPosition(x, y, z)), c));
  const street = new THREE.Color(0x4a454d), walk = new THREE.Color(0x77707a), tmp = new THREE.Color();
  const whole = !C.p.blocks || !C.p.blocks.some(b => b.void);
  if (whole) box((C.ox + C.x1) / 2, 0, (C.oz + C.z1) / 2, C.x1 - C.ox + 2, 0.05, C.z1 - C.oz + 2, street);
  for (let bi = 0; bi < C.bx; bi++) for (let bj = 0; bj < C.by; bj++) {
    if (!whole && isVoid(C, bi, bj)) continue;      // the town stops where the rules leave a gap: its streets and pavements too
    if (!whole) box(C.ox + (bi * 4 + 2) * T, 0, C.oz + (bj * 3 + 1.5) * T, 5.2 * T, 0.05, 4.2 * T, street);
    box(C.ox + (bi * 4 + 2) * T, 0.04, C.oz + (bj * 3 + 1.5) * T, 3 * T, 0.08, 2 * T, walk);
  }
  voidGround(C, (x, y, z, w, h, d, c) => box(x, y, z, w, h, d, tmp.set(c)));
  for (const l of C.lots) {      // the family's roofs carry its colour, the rest of the town stays dark (look.mjs)
    if (l.open) { openGround(l, (x, y, z, w, h, d, c) => box(x, y, z, w, h, d, tmp.set(c))); continue; }      // a park or an empty lot: no building
    const k = lotLook(l);
    box(l.x, 0.1, l.z, 1.45, l.h, 1.45, tmp.copy(FARCOL[l.tint]).multiplyScalar((0.85 + 0.3 * hsh(l.i, l.j)) * k.shade));
    if (k.roof) box(l.x, 0.1 + l.h, l.z, 1.5, 0.09, 1.5, roofColor(k, tmp));
  }
  const far = new THREE.Mesh(mergeGeometries(geos), FARMAT); far.castShadow = far.receiveShadow = true; far.userData.merged = true; geos.forEach(g => g.dispose());
  cur = new THREE.Group();
  for (const l of C.lots) if (l.shop && hsh(l.j, l.i) < 0.6) pool(l.x, l.z + 0.9, 3.2, l.ours ? 0xffc46a : 0xffa860, l.ours ? 0.6 : 0.3);
  for (const l of C.lots) if (l.site) pool(l.x, l.z + 0.9, 4.5, new THREE.Color(l.site.color), 0.8);     // the family's places show from afar
  for (const l of C.lots) if (!l.open) {      // lamps in the windows of what the family holds: the firmer the hold, the more of them (look.mjs)
    const n = lotLook(l, hsh(l.i + 3, l.j + 5)).lamps;
    for (let k = 0; k < n; k++) { const a = hsh(l.i + k * 11, l.j + 1), b = hsh(l.j + k * 13, l.i + 2), front = a < 0.5;
      glow(l.x + (front ? (b - 0.5) * 1.1 : 0.76), 0.25 + l.h * (0.25 + 0.6 * a), l.z + (front ? 0.76 : (b - 0.5) * 1.1), 0.55, GLOW_WARM, 0xffd9a0, 0.9); }
  }
  bake(cur); C.farBody = new THREE.Group(); C.farBody.add(far, cur);
  cur = new THREE.Group(); if (!C.p.turf) borders(C); bake(cur);
  G.add(C.farBody, cur); lods.add(G); C.far = G;
  if (C.p.turf) turfGround(C);
}
// near version: the real models, one instanced draw call per model and light level
const COAT = new THREE.Color(0x1c1a1e), SKIN = new THREE.Color(0xd9a98a), SCAFFOLD = new THREE.Color(0xd9b077), SMOKE = new THREE.MeshBasicMaterial({ map: GLOW_SOFT, color: 0x77726c, transparent: true, depthWrite: false, opacity: 0.5 });
function smoke(x, y, z, s, op) { const m = new THREE.Mesh(UNIT, SMOKEMATS[op > 0.4 ? 0 : op > 0.3 ? 1 : 2]); m.quaternion.copy(cam.quaternion); m.position.set(x, y, z); m.scale.set(s, s, 1); m.renderOrder = 5; cur.add(m); }
const SMOKEMATS = [0.5, 0.37, 0.24].map((o) => { const m = SMOKE.clone(); m.opacity = o; return m; });
const SHOPSIGNS = ['#ffb347', '#ff6b5e', '#7fe0a8', '#ffd9a0', '#7fc8ff', '#ff8fc0'], PARKED = ['car_sedan', 'car_hatchback', 'car_sedan', 'car_stationwagon'], KERB = 1.25;      // a parked car, this far from the middle of its building
// The near version is a base that never changes in a game (streets, lamps, water, the cars of the town) and the buildings,
// cut in squares of CHUNK units. When the game changes a building, only its square is built again (nearChunk), not the town.
const CHUNK = 48, chunkOf = (C, x, z, n = CHUNK) => Math.floor((x - C.ox) / n) + ':' + Math.floor((z - C.oz) / n);      // a square is 6 by 8 blocks: few of them in view, so few more draw calls
// one instanced draw call per model, material and square: add() gathers, instances() makes the meshes
function gatherer(C) {
  const inst = new Map(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const add = (name, mat, x, y, z, rot, sy, color, shadow = true, size = null) => {
    const key = name + ':' + mat.uuid + ':' + chunkOf(C, x, z, 24); if (!inst.has(key)) inst.set(key, { name, mat, shadow, list: [] });
    e.set(0, rot, 0); inst.get(key).list.push([new THREE.Matrix4().compose(p.set(x, y, z), q.setFromEuler(e), size ? s.set(size[0], size[1], size[2]) : s.set(1, sy, 1)), color]);
  };
  const instances = (G) => {
    for (const { name, mat, shadow, list } of inst.values()) {
      const im = new THREE.InstancedMesh(GEO[name], mat, list.length); im.userData.model = name;
      list.forEach(([m, c], k) => { im.setMatrixAt(k, m); im.setColorAt(k, c); });
      im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); G.add(im);
    }
  };
  return { add, instances };
}
function nearBase(C) {
  const G = new THREE.Group(), { add, instances } = gatherer(C);
  for (let i = 0; i < C.W; i++) for (let j = 0; j < C.H; j++) {
    const x = C.ox + i * T, z = C.oz + j * T, ri = i % 4 === 0, rj = j % 3 === 0;
    if ((ri || rj) && !streetAt(C, i, j)) continue;
    if (ri && rj) add('road_junction', PLAINMAT, x, 0, z, 0, 1, ROADTINT, false);      // flat on the ground: it casts no shadow
    else if (ri) add(j % 3 === 1 ? 'road_straight_crossing' : 'road_straight', PLAINMAT, x, 0, z, 0, 1, ROADTINT, false);
    else if (rj) add(i % 4 === 2 ? 'road_straight_crossing' : 'road_straight', PLAINMAT, x, 0, z, Math.PI / 2, 1, ROADTINT, false);
  }
  voidGround(C, (x, y, z, w, h, d, c) => add(h > 0.1 ? 'fir' : 'slab', ROOFMAT, x, y, z, 0, 1, new THREE.Color(c), false, [w, h, d]));
  cur = new THREE.Group();
  for (const [x, z, r] of C.lamps) {
    add('streetlight', LAMPMAT, x, 0, z, r, 1, WHITE, false);
    const hx = x - Math.cos(r) * 0.22, hz = z + Math.sin(r) * 0.22;
    glow(hx, 1.02, hz, 0.55, GLOW_WARM, 0xffffff, 0.85); pool(hx, hz, 2.4, 0xffb868, 0.38);
  }
  bake(cur); G.add(cur); instances(G);
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
  return G;
}
function nearChunk(C, lots) {
  const G = new THREE.Group(), { add, instances } = gatherer(C);
  cur = new THREE.Group();
  for (const l of lots) {
    if (l.open) { openGround(l, (x, y, z, w, h, d, c) => add(h > 0.1 ? 'fir' : 'slab', ROOFMAT, x, y, z, 0, 1, new THREE.Color(c), h > 0.1, [w, h, d])); continue; }
    const k = lotLook(l);
    add(l.name, ERAMATS[k.burnt ? 0 : l.lit], l.x, 0, l.z, l.rot, l.sy, TINTS[l.tint].clone().multiplyScalar(k.shade));
    if (k.burnt) for (let n = 0; n < 3; n++) smoke(l.x + 0.25 * n, l.h + 0.5 + 0.8 * n, l.z - 0.2 * n, 1.3 + 0.7 * n, 0.5 - 0.13 * n);      // it still smokes
    for (let n = 0; n < l.men; n++) {      // the family's men at the door: a dark coat, a face, a hat
      const side = (n - (l.men - 1) / 2) * 0.42, mx = l.x + (l.rot ? 1.02 : side), mz = l.z + (l.rot ? side : 1.02);
      add('slab', ROOFMAT, mx, 0.12, mz, 0, 1, COAT, false, [0.2, 0.42, 0.15]); add('slab', ROOFMAT, mx, 0.54, mz, 0, 1, SKIN, false, [0.13, 0.12, 0.13]); add('slab', ROOFMAT, mx, 0.66, mz, 0, 1, COAT, false, [0.24, 0.05, 0.24]);
    }
    if (l.works) {      // works under way: a scaffold of poles and planks around the building
      const r = 0.98, top = Math.max(0.9, l.h * 0.8);
      for (const [sx, sz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) add('slab', ROOFMAT, l.x + sx, top / 2, l.z + sz, 0, 1, SCAFFOLD, false, [0.12, top, 0.12]);
      for (let y = 0.45; y < top; y += 0.5) for (const [sx, sz, w, d] of [[0, r, 2 * r, 0.22], [r, 0, 0.22, 2 * r], [0, -r, 2 * r, 0.22], [-r, 0, 0.22, 2 * r]]) add('slab', ROOFMAT, l.x + sx, y, l.z + sz, 0, 1, SCAFFOLD, false, [w, 0.06, d]);
    }
    if (k.roof && l.name.indexOf('hq_') !== 0) add('roofcap', ROOFMAT, l.x, l.h, l.z, l.rot, 1, roofColor(k, new THREE.Color()));
    if (l.tower) add('watertower', PLAINMAT, l.x + l.tx * 0.6, l.h, l.z - 0.2, l.tr, 1, PROPTINT);
    if (l.shop) {      // warm light spilling from the ground floor onto the pavement
      const dx = l.rot ? 0.95 : 0, dz = l.rot ? 0 : 0.95;
      pool(l.x + dx, l.z + dz, 1.9, l.ours ? 0xffc46a : 0xffa860, l.ours ? 0.45 : 0.25);
      glow(l.x + dx * 0.78, 0.42, l.z + dz * 0.78, 0.8, GLOW_SOFT, 0xffd08a, 0.5);
    }
    const life = lotLook(l, hsh(l.i + 7, l.j + 11)), fx = l.rot ? 1 : 0, fz = l.rot ? 0 : 1;      // a street the family holds comes alive
    if (life.sign) {
      const col = SHOPSIGNS[life.sign.length % SHOPSIGNS.length], sg = sign(life.sign, col, false);      // one colour a trade, so one draw call a trade
      sg.scale.setScalar(0.8); sg.position.set(l.x + fx * 0.84, 0.72, l.z + fz * 0.84); if (l.rot) sg.rotation.y = Math.PI / 2; cur.add(sg);
      pool(l.x + fx * 1.2, l.z + fz * 1.2, 2, new THREE.Color(col), 0.32);
    }
    if (life.parked && !l.infill) add(PARKED[(l.i + l.j) % PARKED.length], CARMATS[(l.i * 3 + l.j) % CARMATS.length], l.x + fx * KERB, 0.17, l.z + fz * KERB, l.rot ? 0 : Math.PI / 2, 1, WHITE, false);
  }
  for (const l of lots) if (l.site || l.hideout) {     // the family's places carry a sign, and so does the capo's hideout
    if (!l.site) l.site0 = { sign: 'SOCIAL CLUB', color: '#ffc74a' };
    const fx = l.rot ? 1 : 0, fz = l.rot ? 0 : 1, look = l.site || l.site0, sg = sign(look.sign, look.color);
    sg.position.set(l.x + fx * 0.84, 0.95, l.z + fz * 0.84); if (l.rot) sg.rotation.y = Math.PI / 2; cur.add(sg);
    glow(l.x + fx, 0.9, l.z + fz, 2.2, GLOW_SOFT, new THREE.Color(look.color), 0.7); pool(l.x + fx * 1.3, l.z + fz * 1.3, 3, new THREE.Color(look.color), 0.5);
  }
  bake(cur); G.add(cur); instances(G);
  return G;
}
function buildNear(C) {
  const G = new THREE.Group(); G.add(nearBase(C)); C.nearChunks = new Map();
  for (const [key, ch] of C.chunks) { const g = nearChunk(C, ch.lots); C.nearChunks.set(key, g); G.add(g); }
  details.add(G); C.near = G; C.nearAt = performance.now();
}
// the buildings of a town, square by square, with what makes each square look as it does: a square whose look is unchanged is not built again
function chunks(C) {
  const out = new Map();
  for (const l of C.lots) { const k = chunkOf(C, l.x, l.z); let ch = out.get(k); if (!ch) out.set(k, ch = { lots: [], sig: '' }); ch.lots.push(l); }
  for (const ch of out.values()) ch.sig = JSON.stringify(ch.lots);
  return out;
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
let nearMs = 0, nNear = 0;
function levelOfDetail(now) {
  tgt.copy(cam.position).sub(OFF);
  const reach = VIEW / cam.zoom * 1.7; let built = false;
  for (const C of CITIES) {
    const want = cam.zoom >= NEAR_ZOOM && Math.hypot(tgt.x - C.cx, tgt.z - C.cz) < reach + C.r;
    if (want && !C.near && !built) { const t0 = performance.now(); buildNear(C); built = true; shadowDirty = true; nearMs = performance.now() - t0; nNear++; }
    const near = want && !!C.near;
    if (C.near) { if (C.near.visible !== near) shadowDirty = true; C.near.visible = near; if (near) C.nearAt = now; }
    if (!near && C.farStale) { const vis = C.farBody.visible; dispose(C.far); buildFar(C); C.farStale = false; C.farBody.visible = vis; }      // left behind while the town was seen up close
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
      vec3 c;
      if (r > 0.) { c = vec3(0.); for (int i = -2; i <= 2; i++) c += texture2D(tDiffuse, vUv + vec2(0., float(i) * r * 1.5)).rgb; c /= 5.; }
      else c = texture2D(tDiffuse, vUv).rgb;                                   // the sharp middle of the screen reads one texel, not five
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
{ const size = bloom.setSize.bind(bloom); bloom.setSize = (w, h) => size(Math.round(w / pr), Math.round(h / pr)); }      // the glow is drawn at screen pixels, not at the phone's 2x: it is blurred anyway, and its cost grows as the square of the resolution
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
let goal = null, last = performance.now(), frames = 0, fpsT = last, fpsN = 0, sharp = quality.start(pr), due = pacer(), held = false, stale = 3, lastView = '';
const WIDE = 0.62;      // the six cities fit across a screen at least this wide for its height; on a narrower one (a phone held upright) the whole map is seen from further away
const focus = (id, districtId, at) => {     // glide to the whole map, to a city, to one of its districts, or to one block of it (at: { x, y })
  const c = CITIES.find(c => c.id === id), d = c && districtId && c.d.find(d => d.id === districtId);
  goal = !c ? { p: CENTER.clone().add(OFF), z: Math.min(1, innerWidth / innerHeight / WIDE) } : at ? { p: new THREE.Vector3(c.ox + (at.x * 4 + 2) * T, 0, c.oz + (at.y * 3 + 1.5) * T).add(OFF), z: 11 * K } : d ? { p: new THREE.Vector3(c.ox + midX(d) * 4 * T, 0, c.oz + midY(d) * 3 * T).add(OFF), z: 11 * K }
    : { p: new THREE.Vector3(c.cx, 0, c.cz).add(OFF), z: K > 1 ? 2.4 * K : c.home ? 5.4 : 6.2 };
};
const _v = new THREE.Vector3();
const scr = (x, z, y = 0) => { _v.set(x, y, z).project(cam); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; };
// the state of the game changed: rebuild only the cities that look different
let nWaves = 0, nRebuilt = 0, rebuildMs = 0, nChunks = 0;      // how often a city is built again, and what the last one cost (the fps meter shows it)
function update(P2) {
  P2.cities.forEach((pc, ci) => {
    const C = CITIES[ci], changed = pc.key !== C.p.key, flips = pc.turf && C.p.turf ? turned(C.p.blocks, pc.blocks).slice(0, 8) : []; C.p = pc; C.d = pc.districts; C.held = pc.held;
    nWaves += flips.length; for (const b of flips) spawnFx(b.won ? 'won' : 'lost', C.ox + (b.x * 4 + 2) * T, C.oz + (b.y * 3 + 1.5) * T);      // a street changes hands: it is seen
    if (!changed) { if (pc.turf && gripKey(pc) !== C.gripKey) turfGround(C); return; }
    const t0 = performance.now(), was = C.chunks, base = C.baseKey; nBuildings -= C.lots.length; plan(C);
    if (C.near && C.baseKey === base) {      // the town is seen up close: only the squares whose buildings look different are built again
      for (const [key, ch] of C.chunks) { const old = was.get(key); if (old && old.sig === ch.sig) continue; const g0 = C.nearChunks.get(key); if (g0) dispose(g0); const g = nearChunk(C, ch.lots); C.nearChunks.set(key, g); C.near.add(g); nChunks++; }
      for (const key of was.keys()) if (!C.chunks.has(key) && C.nearChunks.has(key)) { dispose(C.nearChunks.get(key)); C.nearChunks.delete(key); }
    } else if (C.near) { dispose(C.near); C.near = null; }
    // the plain far version is hidden while the town is seen up close: it is built again only when it is needed (levelOfDetail)
    if (C.near && C.near.visible) { C.farStale = true; if (pc.turf && gripKey(pc) !== C.gripKey) turfGround(C); } else { dispose(C.far); buildFar(C); C.farStale = false; }
    shadowDirty = true; nRebuilt++; rebuildMs = performance.now() - t0;
  });
}
// what just happened, lit on the map (render/fx.js), and the vehicles in the streets (render/traffic.js)
const { fxList, pops, spawnFx, spawnPop, effects, animateFx } = makeFx({ THREE, scene, cam, CITIES, T, UNIT, GLOW_WARM, clamp });
const { agents, traffic, moveAgents, MAXTAGS, setPace, setDay } = makeTraffic({ THREE, scene, cam, CITIES, ROADS, T, GEO, CARMATS, GLOW_WARM, kitMat: (rough, lit, paint) => carMat(paint), putCar: (...a) => putCar(...a), hsh, clamp, spawnFx, spawnPop });
// what the page writes over the map (render/labels.js)
const claimList = [];
// where(ids): the place on the screen of each vehicle named ('city:capo:car:1', or 'capo:city:capo' for a capo's own car), and
// spot(city, bx, by) the top of a block: the ends of the blue lines drawn from a touched building to its vehicles.
const where = (ids) => (ids || []).map((id) => {
  let best = null;
  if (id.startsWith('capo:')) { const [, city, capo] = id.split(':'); for (const a of agents.values()) if (a.kind === 'capo' && a.tag.capo === capo && a.C && a.C.id === city) best = a; }
  else for (const [k, a] of agents) if ((a.veh === id || k === id) && (!best || best.parked)) best = a;
  if (!best) return null;
  const x = best.x === undefined ? best.pts[0][0] : best.x, z = best.z === undefined ? best.pts[0][1] : best.z, [sx, sy] = scr(x, z, 1);
  return { id, x: sx, y: sy };
}).filter(Boolean);
const spot = (city, bx, by) => { const c = CITIES.find((q) => q.id === city), l = c && c.lots.find((q) => q.bx === bx && q.by === by); if (!l) return null; const [x, y] = scr(l.x, l.z, l.h + 0.5); return { x, y }; };
const labels = makeLabels({ cam, scr, CITIES, COLORS, T, NEAR_ZOOM, agents, fxList, pops, MAXTAGS, claimList });
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
// The streets a capo is about to win, lit on the ground in the family's colour: claims([{ id, city, x, y, gains: [{ x, y }], ... }]). The page writes the mark over each.
let claimG = null, claimSig = '';
const claimMat = fxMat(null, new THREE.Color(0xe8c463), 0.5);
function claims(list) {
  const sig = JSON.stringify((list || []).map(c => [c.city, c.gains])), same = sig === claimSig; claimSig = sig;      // the same streets, a little further along: only the marks change
  if (!same && claimG) { lods.remove(claimG); dispose(claimG); claimG = null; }
  claimList.length = 0;
  const bw = 4 * T, bd = 3 * T; let g = null;
  for (const c of list || []) {
    const C = CITIES.find(q => q.id === c.city); if (!C) continue;
    claimList.push({ ...c, wx: C.ox + c.x * bw + bw / 2, wz: C.oz + c.y * bd + bd / 2 });
    if (!same) for (const b of c.gains || []) { const m = new THREE.Mesh(UNIT, claimMat); m.rotation.x = -Math.PI / 2; m.position.set(C.ox + b.x * bw + bw / 2, 0.13, C.oz + b.y * bd + bd / 2); m.scale.set(bw - 0.5, bd - 0.5, 1); m.renderOrder = 4; (g = g || new THREE.Group()).add(m); }
  }
  if (g) { claimG = g; bake(claimG); lods.add(claimG); }
}
// which city and district is under a point of the screen
function pickAt(cx, cy) {
  _v.set(cx / innerWidth * 2 - 1, 1 - cy / innerHeight * 2, 0).unproject(cam);
  const dir = OFF.clone().normalize().negate(), t = -_v.y / dir.y, x = _v.x + dir.x * t, z = _v.z + dir.z * t;
  for (const C of CITIES) if (x >= C.ox - 1 && x <= C.x1 + 1 && z >= C.oz - 1 && z <= C.z1 + 1) {
    const bi = (x - C.ox) / (4 * T), bj = (z - C.oz) / (3 * T), bx = Math.floor(bi), by = Math.floor(bj), q = C.p.turf && C.p.blocks[by * C.bx + bx];
    const d = q && C.d[q.zone] || C.d.find(d => bi >= d.c0 && bi < d.c1 && bj >= d.r0 && bj < d.r1), lot = C.p.turf ? C.lots.find(l => l.site && l.bx === bx && l.by === by) : null;
    return { city: C.id, district: d && !C.p.turf ? d.id : null, zone: d ? d.name : null, bx, by, site: lot ? lot.site : null, block: C.p.turf && C.p.blocks[by * C.bx + bx] || null, near: cam.zoom >= NEAR_ZOOM };
  }
  return null;
}
function frame(now) {
  if (!due(now)) { requestAnimationFrame(frame); return; }      // never more than 60 images a second, on a 90 Hz screen too (render/pace.mjs)
  const real = Math.min(1, (now - last) / 1000), dt = Math.min(0.05, real); last = now;      // cars never jump more than a twentieth of a second; a fire burns its real time, however slow the machine
  if (goal) { const k = 1 - Math.pow(0.88, real * 60); cam.position.lerp(goal.p, k); cam.zoom += (goal.z - cam.zoom) * k;      // the glide takes the same time on a slow machine: it is counted in seconds, not in images
    cam.updateProjectionMatrix(); if (cam.position.distanceTo(goal.p) < 0.05 && Math.abs(goal.z - cam.zoom) < 0.01) goal = null; }
  // Nothing is drawn again while nothing changes: time stopped, camera still, no fire or gunfire, no street on offer.
  // Anything that changes the picture (the camera, an order to the map, the size of the window) asks for a few images more.
  const view = cam.position.x + ',' + cam.position.y + ',' + cam.position.z + ',' + cam.zoom;
  if (view !== lastView || goal || !held || fxList.length || pops.length || spotG || frames < 4) stale = 3;
  lastView = view;
  if (stale > 0) {
    stale--;
    if (levelOfDetail(now)) stale = 3;      // a city still being built
    for (const b of batches.values()) b.count = 0;
    // while the game's time stands still nothing drives: every car waits where it is, and leaves again with the clock
    const drive = held ? 0 : dt;
    moveCars(trucks, drive); for (const C of CITIES) if (C.near && C.near.visible) moveCars(C.cars, drive);
    moveAgents(drive, false, held ? 0 : real); animateFx(real, now); FRONTMAT.opacity = 0.55 + 0.4 * Math.sin(now * 0.005);
    for (const b of batches.values()) b.instanceMatrix.needsUpdate = true;
    grade.uniforms.t.value = now * 0.001; window.__water.material.uniforms.t.value = now * 0.001;
    renderer.info.reset(); composer.render(); frames++;
    window.__stats = { cars: agents.size, buildings: nBuildings, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, pr };
  }
  fpsN++;
  if (now - fpsT > 1000) {
    const fps = Math.round(fpsN * 1000 / (now - fpsT)); window.__fps = fps; fpsT = now; fpsN = 0;
    // adaptive quality: the resolution goes down a step when the phone is slow for a while, and back up when it is at ease (render/pace.mjs)
    if (!Q.has('fixed')) { sharp = quality.tick(sharp, fps, now); if (sharp.pr !== pr) setPr(sharp.pr); }
    const el = document.getElementById('fps'); if (el && !el.classList.contains('on')) el.textContent = fps + ' fps';     // the page writes the full reading itself when the meter is open
  }
  if (frames === 3) { window.__ready = true; if (opt.onStage) opt.onStage(4); }
  if (spotG) spotMat.opacity = 0.42 + 0.2 * Math.sin(performance.now() / 260);      // the streets on offer breathe
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- touch: drag to pan, pinch or wheel to zoom, a short touch is a tap (touch.js)
makeTouch({ THREE, el: renderer.domElement, cam, VIEW, K, clamp, pickAt, onTap: opt.onTap, stop: () => { goal = null; } });
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
  // run(seconds): the streets a few seconds later, at once (the tests do not wait for a car to cross the town)
  // the vehicles that live by a club: where each is, parked or out, loaded or not (one that is out on a trip of its own is told by that trip)
  const fleet = () => { const away = new Map(); for (const a of agents.values()) if (a.veh) away.set(a.veh, a);
    return [...agents].filter(([, a]) => a.round).map(([id, a]) => { const o = away.get(id); return { id, parked: o ? false : !!a.parked, loaded: o ? !!o.loaded : a.loaded, x: (o || a).x, z: (o || a).z }; }); };
  const run = waking((sec) => { for (let t = 0; t < sec; t += 0.05) moveAgents(0.05, true); });      /* a test drives the streets by hand: they run free of the beats */
  return { update: waking(update), effects: waking(effects), traffic: waking(traffic), send: waking((trips) => traffic(trips, true)), labels, where, spot, census, run, focus: waking(focus), pickAt, spots: waking(spots), claims: waking(claims), hold: waking((v) => { held = !!v; }), pace: setPace, day: setDay, setLook: waking(window.setLook), setFx: waking(window.setFx),
           stats: () => ({ ...window.__stats, cars: agents.size, buildings: nBuildings, moving: !!goal, spots: nSpots, waves: nWaves, held, drawn: frames, rebuilt: nRebuilt, rebuildMs: Math.round(rebuildMs), chunks: nChunks, near: nNear, nearMs: Math.round(nearMs), fleet: fleet(), timed: [...agents.values()].filter(a => a.days && !a.done).length, moving: !!goal }),
           cars: () => [...agents].map(([id, a]) => ({ id, kind: a.kind, vehicle: a.vehicle, x: a.x, z: a.z, capo: a.tag.capo, there: !!a.plan && a.p >= a.L, timed: !!a.days, round: !!a.round, loop: !!a.loop, parked: !!a.parked }))  };     // counted now, not at the last frame drawn; moving while the camera glides
}
