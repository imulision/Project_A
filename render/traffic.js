// The streets at work: every trip of the plan is a vehicle. Loops come and go, rounds leave the club and come home, convoys take the road between two cities.
// makeTraffic(ctx) returns { agents, traffic, moveAgents, MAXTAGS }; ctx gives the scene, the cities, the car models and what draws a car.
export function makeTraffic({ THREE, scene, cam, CITIES, ROADS, T, GEO, CARMATS, GLOW_WARM, kitMat, putCar, hsh, clamp, spawnFx, spawnPop }) {
  let n0 = 0, pace = 1;      // pace: days of the game in a second (the speed the boss chose)
  // the empire at work: every trip of the plan is a car on the streets, with a coloured light that shows from afar.
  // Loops run as long as the plan lists them; one-way trips (a crew sent out, rivals, the police) end where they arrive.
  const agents = new Map(), out = new Set(), MAXDOTS = 400, MAXTAGS = 28;
  const dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: GLOW_WARM, size: 10, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  dots.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXDOTS * 3), 3)); dots.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXDOTS * 3), 3));
  dots.geometry.setDrawRange(0, 0); dots.frustumCulled = false; dots.renderOrder = 5; scene.add(dots);
  const POLICEMAT = kitMat(0.35, -1, 0x27365f), MUSCLEMAT = kitMat(0.35, -1, 0x241f1f);
  // Between two cities there is no street plan: the truck follows the road drawn on the land (or the straight line, by sea).
  const OPEN = { near: { visible: true } };
  function roadBetween(a, b) {
    const r = ROADS.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)), A = CITIES[a], B = CITIES[b]; if (!A || !B) return null;
    return r ? (r.a === a ? r.pts : r.pts.slice().reverse()) : [[A.cx, A.cz], [B.cx, B.cz]];
  }
  function agentFor(t) {
    const road = t.kind === 'convoy' ? roadBetween(t.a, t.b) : null, C = road ? OPEN : CITIES.find(c => c.id === t.city); if (!C) return null;
    const pts = road || t.path.map(([i, j]) => [C.ox + i * T, C.oz + j * T]), len = []; let L = 0;
    for (let k = 1; k < pts.length; k++) { L += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]); len.push(L); }
    if (!L && !t.round) return null;
    // a new car leaves from where its trip starts, after a short wait of its own so that they do not all leave at once
    return { C, pts, len, L, p: 0, dir: 1, loop: t.loop, wait: (t.loop ? hsh(pts[0][0] + L, pts[0][1]) * 3 : 0) + (t.delay || 0), sig: (t.path || []).join(';'), leaving: false,
             geo: GEO[t.vehicle === 'truck' ? 'car_stationwagon' : 'car_sedan'], mat: t.vehicle === 'police' ? POLICEMAT : t.violent ? MUSCLEMAT : t.vehicle === 'truck' ? CARMATS[3] : CARMATS[0],
             tag: { way: t.way, cargo: t.cargo, amount: t.amount || 0, capo: t.capo || null, load: t.load, from: t.from, to: t.to, vehicle: t.vehicle, kind: t.kind, district: t.district, by: t.by }, kind: t.kind, vehicle: t.vehicle, violent: t.violent, color: new THREE.Color(t.color), speed: t.days ? L / t.days : road ? L / 14 : t.loop ? 2.4 : 5, days: t.days || 0, idle: t.days ? t.wait || 0 : 0, veh: t.veh || null,
             plan: t.days && t.stages ? t.stages.map(q => ({ d: q.k ? len[q.k - 1] : 0, days: q.days })) : null,      // legs that each take their own days (out empty, home loaded)
             o: null,
             // a round: the stops along the way (where it loads and unloads), counted in distance, and whether it carries something now
             round: !!t.round, stops: (t.stops || []).map(s => ({ d: s.k ? len[s.k - 1] : 0, load: s.load, lost: s.lost, amount: s.amount, kind: s.kind, cargo: s.cargo })), si: 0, loaded: false, next: null, rot: t.round ? Math.PI / 2 : undefined };
  }
  // A vehicle on its round takes the way of the new month once it is back by the club; parked, it takes it at once.
  function reroute(id, a, t) {
    if (a.sig === t.path.join(';')) { a.next = null; a.stops.forEach((s, i) => { if (t.stops[i]) s.amount = t.stops[i].amount; }); return; }      // same way, this month's loads
    if (a.L && (a.p > 0 || a.wait <= 0) && a.p < a.L) { a.next = t; return; }
    const b = agentFor(t); if (!b) return; b.wait = a.L ? Math.max(0, a.wait) : hsh(b.pts[0][0], b.L) * 2; b.rot = a.rot; agents.set(id, b);
  }
  // `add`: only send out what is given (cars that leave today), and leave the rest of the streets as they are
  function traffic(trips, add) {
    const seen = new Set();
    for (const t of trips) {
      if (t.loop) { seen.add(t.id); const old = agents.get(t.id);
        if (old && old.round && t.round) { reroute(t.id, old, t); continue; }
        if (old && old.sig !== t.path.join(';')) { old.leaving = true; agents.delete(t.id); agents.set('old' + (n0++), old); }      // the route changed: the old car finishes its run
        if (!agents.has(t.id)) { const a = agentFor(t); if (a) agents.set(t.id, a); } else Object.assign(agents.get(t.id).tag, { load: t.load, amount: t.amount || 0 }); }
      else { const a = agentFor(t); if (a) agents.set('once' + (n0++), a); }
    }
    // a run that is no longer needed is not wiped off the street: the car drives to the end of its way and stops there
    if (!add) for (const [id, a] of agents) if (a.loop && !a.leaving && !seen.has(id)) { a.leaving = true; agents.delete(id); agents.set('old' + (n0++), a); }
  }
  function moveAgents(dt) {
    const pos = dots.geometry.attributes.position, col = dots.geometry.attributes.color; let n = 0;
    out.clear(); for (const a of agents.values()) if (a.veh) out.add(a.veh);      // the cars that are out on a trip of their own are not also parked by their club
    for (const [id, a] of agents) {
      if (a.wait > 0) a.wait -= dt;
      else if (a.round) {
        if (!a.L) { if (a.leaving) { agents.delete(id); continue; } }
        else {
          a.p += a.speed * dt; const s = a.stops[a.si];
          if (s && a.p >= s.d) { a.p = s.d; a.si++; a.wait = 1.2; a.loaded = s.load; if (s.lost) a.got = 0; else if (s.load && (s.kind === 'takings' || s.kind === 'wash')) a.got = (a.got || 0) + (s.amount || 0); if (s.lost) { a.wait = 3; spawnFx(s.lost === 'seizure' ? 'police' : 'gunfire', a.x === undefined ? a.pts[0][0] : a.x, a.z === undefined ? a.pts[0][1] : a.z, 1, s.lost === 'seizure' ? 'The police stop it: the load is seized' : 'Held up: the load is gone'); } if (s.load) Object.assign(a.tag, { amount: s.amount, kind: s.kind, cargo: s.cargo }); }
          else if (a.p >= a.L) {      // home again: it rests by the club, then goes out again, by the new way if the month changed it
            if (a.leaving) { agents.delete(id); continue; }
            if (a.next) { const b = agentFor(a.next); if (b) { b.wait = 3; b.rot = a.rot; agents.set(id, b); continue; } a.next = null; }
            if (a.got > 0 && a.seen) spawnPop(a.x, a.z, 1.2, a.got);      // the money it brings home is seen coming in
            a.got = 0;
            a.p = 0; a.si = 0; a.loaded = false; a.wait = 3;
          }
        }
      } else {
        // a trip the rules gave a length in days keeps to it at any speed of the game: it waits its days by the door, then drives
        if (a.days) { const d = dt * pace;
          if (a.idle > 0) a.idle -= d;
          else if (a.plan) { let n = 0; while (n < a.plan.length - 1 && a.p >= a.plan[n].d) n++; const from = n ? a.plan[n - 1].d : 0; a.p += (a.plan[n].d - from) / a.plan[n].days * d; a.loaded = a.p >= a.plan[0].d; }
          else a.p += a.speed * d; }
        else a.p += a.dir * a.speed * dt;
        if (a.p >= a.L) {
          if (!a.loop) { const e = a.pts[a.pts.length - 1]; if (['seizure', 'hit', 'kidnap'].includes(a.kind)) spawnFx('gunfire', e[0], e[1]); agents.delete(id); continue; }
          if (a.leaving) { agents.delete(id); continue; }
          a.p = a.L; a.dir = -1; a.wait = 1.5;
        } else if (a.p <= 0) { if (a.leaving) { agents.delete(id); continue; } a.p = 0; a.dir = 1; a.wait = 1.5; }
      }
      let k = 0; while (k < a.len.length - 1 && a.len[k] < a.p) k++;
      const p0 = a.pts[k], p1 = a.pts[k + 1] || p0, s0 = k ? a.len[k - 1] : 0, t = (a.p - s0) / ((a.len[k] - s0) || 1), x = p0[0] + (p1[0] - p0[0]) * t, z = p0[1] + (p1[1] - p0[1]) * t;
      a.seen = !!(a.C.near && a.C.near.visible); a.x = x; a.z = z;
      if (a.seen && !(a.round && !a.L && out.has(id))) {
        const fx = (p1[0] - p0[0]) * a.dir, fz = (p1[1] - p0[1]) * a.dir; if (fx || fz) a.rot = Math.atan2(fx, fz);
        putCar(a.geo, a.mat, x, 0.17, z, a.rot || 0, a.kind === 'convoy' ? 3 : a.vehicle === 'truck' ? 1.2 : 1);      // seen from far above, a truck between two cities is drawn large
      }
      a.parked = (a.round && (!a.L || (a.p === 0 && a.wait > 0))) || a.idle > 0;
      if (n < MAXDOTS && !a.parked) { pos.setXYZ(n, x, 0.9, z); col.setXYZ(n, a.color.r, a.color.g, a.color.b); n++; }
    }
    dots.geometry.setDrawRange(0, n); pos.needsUpdate = col.needsUpdate = true;
    dots.material.size = clamp(6 * Math.sqrt(cam.zoom), 7, 20) * (innerHeight / 844);
  }
  return { agents, traffic, moveAgents, MAXTAGS, setPace: (v) => { pace = Math.max(0, +v || 0); } };
}
