// What just happened, lit where it happened: fire, gunfire, police lights, good news, a betrayal, and a plain mark for the rest.
// Money is seen too: a figure rises over the place where it comes in or leaves (pops, written by the page).
// makeFx(ctx) returns { fxList, pops, spawnFx, spawnPop, effects, animateFx }; ctx gives the scene, the camera and the cities.
import { midX, midY, rising } from './look.mjs';
export function makeFx({ THREE, scene, cam, CITIES, T, UNIT, GLOW_WARM, clamp }) {
  const fxList = []; let fxN = 0;
  const FXLOOK = { fire: [0xff6a1a, 30], gunfire: [0xfff2c0, 6], police: [0x4a7dff, 16], promotion: [0xffd76a, 12], news: [0xffe6b0, 10], betrayal: [0xff2a2a, 45],
                   won: [0xffd27a, 3.2], lost: [0xff4a3a, 3.2] };      // a street changes hands: a wave of light on the ground, with no badge
  // sights of their own: a place going up (a frame that climbs around it), a key place taken (a beam of light), a decision that paid or cost, a take under way (a ring on the ground)
  Object.assign(FXLOOK, { build: [0xffc46a, 7], key: [0xffd76a, 10], good: [0x7fe39a, 6], bad: [0xff5040, 6], siege: [0xff8a3a, 9] });
  const BODY = new THREE.BoxGeometry(1, 1, 1), FRAME = new THREE.EdgesGeometry(BODY);
  function spawnFx(kind, x, z, h = 1, say, type) {
    const look = FXLOOK[kind]; if (!look) return;
    const m = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ map: GLOW_WARM, color: look[0], blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    if (kind === 'siege') { const old = fxList.find(f => f.kind === 'siege' && f.x === x && f.z === z); if (old) { old.t = Math.min(old.t, 1); return; } }      // the same take, one more month: the ring stays
    const flat = kind === 'won' || kind === 'lost' || kind === 'siege';
    if (flat) { m.rotation.x = -Math.PI / 2; m.position.set(x, 0.16, z); } else { m.quaternion.copy(cam.quaternion); m.position.set(x, h + 0.6, z); } m.renderOrder = 6; scene.add(m);
    const f = { n: fxN++, kind, type, x, z, h, m, say, t: 0, life: look[1], quiet: flat };
    if (kind === 'build') { f.frame = new THREE.LineSegments(FRAME, new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, depthTest: false })); f.frame.renderOrder = 6; scene.add(f.frame); f.body = new THREE.Mesh(BODY, new THREE.MeshBasicMaterial({ color: 0xffb860, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); f.body.renderOrder = 5; scene.add(f.body); }
    if (kind === 'key') { f.beam = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ map: GLOW_WARM, color: look[0], blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); f.beam.renderOrder = 6; scene.add(f.beam); }
    fxList.push(f);
  }
  const pops = []; let popN = 0;
  function spawnPop(x, z, h, amount) { if (amount && pops.length < 12) pops.push({ n: popN++, x, z, h, amount, t: 0, life: 2.6 }); }
  function effects(list) {
    for (const e of list) {
      const C = CITIES.find(c => c.id === e.city); if (!C) continue;
      const l = typeof e.i === 'number' ? C.lots.find(l => l.i === e.i && l.j === e.j) : e.site && C.lots.find(l => l.site && l.site.id === e.site), d = C.d.find(d => d.id === e.district); if (!l && !d) continue;
      spawnFx(e.kind, l ? l.x : C.ox + midX(d) * 4 * T, l ? l.z : C.oz + midY(d) * 3 * T, l ? l.h : 1, e.say, e.type);
      if (e.spent && l) spawnPop(l.x, l.z, l.h, -e.spent);
    }
  }
  function animateFx(dt, now) {
    for (let k = pops.length - 1; k >= 0; k--) { pops[k].t += dt; if (pops[k].t > pops[k].life) pops.splice(k, 1); }
    for (let k = fxList.length - 1; k >= 0; k--) {
      const f = fxList[k]; f.t += dt;
      if (f.t > f.life) { f.m.removeFromParent(); f.m.material.dispose(); for (const x of [f.frame, f.beam, f.body]) if (x) { x.removeFromParent(); x.material.dispose(); } fxList.splice(k, 1); continue; }
      const far = clamp(4 / cam.zoom, 0.6, 4), fade = Math.min(1, (f.life - f.t) / 2); let s, o = 0.95;
      if (f.kind === 'siege') { const p = 0.5 + 0.5 * Math.sin(now * 0.006); s = 7 + 3 * p; f.m.scale.set(s, s, 1); f.m.material.opacity = (0.35 + 0.45 * p) * fade; continue; }
      if (f.kind === 'build') {      // the frame climbs around the place, a flash at the top when it is done
        const r = rising(f.t, f.life), top = Math.max(1.2, f.h) * r.up;
        f.frame.scale.set(1.8, Math.max(0.05, top), 1.8); f.frame.position.set(f.x, top / 2, f.z); f.frame.material.opacity = r.alpha; f.body.scale.copy(f.frame.scale); f.body.position.copy(f.frame.position); f.body.material.opacity = (0.16 + 0.3 * r.flash + 0.06 * Math.sin(now * 0.012)) * r.alpha;
        s = (2.5 + 7 * r.flash) * far; f.m.position.y = top + 0.4; f.m.scale.set(s, s, 1); f.m.material.opacity = (0.45 + 0.5 * r.flash) * r.alpha; continue;
      }
      if (f.kind === 'key') {      // a beam of light over the key place, and a wide glow at its foot
        const k = f.t / f.life, tall = 46 * Math.min(1, f.t / 0.8), pulse = 0.75 + 0.25 * Math.sin(now * 0.006);
        f.beam.quaternion.copy(cam.quaternion); f.beam.scale.set(Math.max(3.4, 3.2 * far) * pulse, tall, 1); f.beam.position.set(f.x, f.h + tall / 2, f.z); f.beam.material.opacity = 0.85 * fade;
        s = (8 + 3 * pulse) * far; f.m.scale.set(s, s, 1); f.m.material.opacity = 0.8 * fade * (1 - 0.3 * k); continue;
      }
      if (f.kind === 'good' || f.kind === 'bad') { const k = f.t / f.life; s = (4 + 6 * k) * far; f.m.position.y = f.h + 0.6 + (f.kind === 'good' ? 5 : -0.3) * k; f.m.scale.set(s, s, 1); f.m.material.opacity = 0.9 * (1 - k); continue; }
      if (f.quiet) { const k = f.t / f.life, grow = f.kind === 'won' ? k : 1 - k; s = 6 + 22 * grow; f.m.scale.set(s, s, 1); f.m.material.opacity = 0.75 * (1 - k); continue; }      // the wave spreads when a street is won, and draws back when one is lost
      if (f.kind === 'fire') s = (5 + 1.5 * Math.sin(now * 0.013 + f.n) + Math.sin(now * 0.031)) * far;
      else if (f.kind === 'promotion') { s = (6 + 2 * Math.sin(now * 0.004)) * far; o = 0.7; }
      else if (f.kind === 'gunfire') { o = Math.sin(now * 0.045 + f.n * 2) > 0.5 ? 1 : 0; s = 3.5 * far; }
      else if (f.kind === 'betrayal') { s = (7 + 2.5 * Math.sin(now * 0.003 + f.n)) * far; o = 0.8; }      // a man went over: a wide red light that stays a long while
      else if (f.kind === 'news') { s = (3.2 + 0.4 * Math.sin(now * 0.005 + f.n)) * far; o = 0.55; }      // a plain mark: a soft steady light
      else { f.m.material.color.setHex(Math.sin(now * 0.012) > 0 ? 0x3a6dff : 0xff2a2a); s = 4.5 * far; }
      f.m.scale.set(s, s, 1); f.m.material.opacity = o * fade;
    }
  }
  return { fxList, pops, spawnFx, spawnPop, effects, animateFx };
}
