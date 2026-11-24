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
// goOn(pts, len, p, at, next): the points of a new way for a car that is at `at`, `p` along its old way `pts` (`len` the
// distance to each point after the first): what is left of the old way, then the new one, joined round a corner.
export function goOn(pts, len, p, at, next) {
  const out = [[at[0], at[1]]], add = (q) => { const r = out[out.length - 1]; if (r[0] !== q[0] || r[1] !== q[1]) out.push([q[0], q[1]]); };
  for (let k = 0; k < len.length; k++) if (len[k] > p) add(pts[k + 1]);
  const end = out[out.length - 1], s = next[0];
  if (end[0] !== s[0] && end[1] !== s[1]) add([end[0], s[1]]);
  next.forEach(add);
  return out;
}
