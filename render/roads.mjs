// roadWay(ROADS, a, b): the points of the way from city a to city b by the fewest roads, through the cities in between.
// null when no road leads there.
export function roadWay(ROADS, a, b) {
  const from = { [a]: null }, line = [a];
  while (line.length && !(b in from)) {
    const c = line.shift();
    for (const r of ROADS) { const n = r.a === c ? r.b : r.b === c ? r.a : null; if (n !== null && !(n in from)) { from[n] = { c, r }; line.push(n); } }
  }
  if (!(b in from) || a === b) return null;
  const legs = [];
  for (let c = b; from[c]; c = from[c].c) legs.unshift(from[c].r.a === from[c].c ? from[c].r.pts : from[c].r.pts.slice().reverse());
  const out = [];
  for (const pts of legs) for (const p of pts) { const q = out[out.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p); }
  return out;
}
