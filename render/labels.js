// What the page writes over the map, and where on the screen: names, capos, places, cars, and what just happened.
// makeLabels(ctx) returns labels(), the list read by the page at each image drawn.
export function makeLabels({ cam, scr, CITIES, COLORS, T, NEAR_ZOOM, agents, fxList, MAXTAGS }) {
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
    for (const [id, a] of agents) { if (!a.seen || a.kind === 'capo' || a.parked || shownCars >= MAXTAGS) continue; shownCars++;      // a capo's own car carries his face, not a tag
      const [x, y] = scr(a.x, a.z, 1.1); out.push({ id: 'v' + id, car: a.tag, round: a.round, back: a.round ? !a.loaded : a.dir < 0, x, y }); }
    const shown = new Set();      // one badge per kind and per block, however many shots are fired
    for (const f of fxList) { const k = f.kind + (f.kind === 'news' ? f.type : '') + Math.round(f.x / 12) + ':' + Math.round(f.z / 12); if (shown.has(k)) continue; shown.add(k); const [x, y] = scr(f.x, f.z); out.push({ id: 'f' + k, fx: f.kind, type: f.type, say: f.say, part: Math.min(1, f.t / f.life), x, y }); }
    return out;
  };
  return labels;
}
