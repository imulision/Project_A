// What just happened, lit where it happened: fire, gunfire, police lights, good news, a betrayal, and a plain mark for the rest.
// Money is seen too: a figure rises over the place where it comes in or leaves (pops, written by the page).
// makeFx(ctx) returns { fxList, pops, spawnFx, spawnPop, effects, animateFx }; ctx gives the scene, the camera and the cities.
export function makeFx({ THREE, scene, cam, CITIES, T, UNIT, GLOW_WARM, clamp }) {
  const fxList = []; let fxN = 0;
  const FXLOOK = { fire: [0xff6a1a, 30], gunfire: [0xfff2c0, 6], police: [0x4a7dff, 16], promotion: [0xffd76a, 12], news: [0xffe6b0, 10], betrayal: [0xff2a2a, 45] };
  function spawnFx(kind, x, z, h = 1, say, type) {
    const look = FXLOOK[kind]; if (!look) return;
    const m = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ map: GLOW_WARM, color: look[0], blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    m.quaternion.copy(cam.quaternion); m.position.set(x, h + 0.6, z); m.renderOrder = 6; scene.add(m);
    fxList.push({ n: fxN++, kind, type, x, z, m, say, t: 0, life: look[1] });
  }
  const pops = []; let popN = 0;
  function spawnPop(x, z, h, amount) { if (amount && pops.length < 12) pops.push({ n: popN++, x, z, h, amount, t: 0, life: 2.6 }); }
  function effects(list) {
    for (const e of list) {
      const C = CITIES.find(c => c.id === e.city); if (!C) continue;
      const l = typeof e.i === 'number' ? C.lots.find(l => l.i === e.i && l.j === e.j) : e.site && C.lots.find(l => l.site && l.site.id === e.site), d = C.d.find(d => d.id === e.district); if (!l && !d) continue;
      spawnFx(e.kind, l ? l.x : C.ox + (d.c0 + d.c1) * 2 * T, l ? l.z : C.oz + (d.r0 + d.r1) * 1.5 * T, l ? l.h : 1, e.say, e.type);
      if (e.spent && l) spawnPop(l.x, l.z, l.h, -e.spent);
    }
  }
  function animateFx(dt, now) {
    for (let k = pops.length - 1; k >= 0; k--) { pops[k].t += dt; if (pops[k].t > pops[k].life) pops.splice(k, 1); }
    for (let k = fxList.length - 1; k >= 0; k--) {
      const f = fxList[k]; f.t += dt;
      if (f.t > f.life) { f.m.removeFromParent(); f.m.material.dispose(); fxList.splice(k, 1); continue; }
      const far = clamp(4 / cam.zoom, 0.6, 4), fade = Math.min(1, (f.life - f.t) / 2); let s, o = 0.95;
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
