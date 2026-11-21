// How a building reads from above. The boss must tell his own from the rest at a glance:
// the family's buildings carry its colour on the roof (its places brightest, then the streets it holds,
// brighter as the hold firms up), a rival's place carries his, and the rest of the town stays dark.
// From afar the same streets are lit: lamps in the windows, more of them as the hold firms up.
// lotLook(lot, r) -> { shade: what the walls are multiplied by, roof: 'family' | a colour | null, gain: strength of the roof colour,
//                      lamps: how many window lights show from afar,
//                      sign: the name over a shop of a street the family holds, or null (a place has its own sign already),
//                      parked: whether a car waits at its kerb }, r being a number in [0, 1) proper to the lot.
// A street the family holds comes alive: the firmer the hold, the more shops light a sign and the more cars at the kerb.
const LAMPS = [0, 0.3, 0.75, 1.3];      // lamps a building, on average, by how firmly the street is held
const SIGNED = [0, 0.2, 0.5, 0.8], PARKED = [0, 0.12, 0.3, 0.5];
const TRADES = ['DINER', 'TAILOR', 'BARBER', 'DRUGS', 'HOTEL', 'CIGARS', 'BAKERY', 'PAWN', 'LAUNDRY', 'BILLIARDS'];
const frac = (x) => x - Math.floor(x);
const QUIET = { sign: null, parked: false };
export function lotLook(l, r = 0.5) {
  const site = l.site;
  if (l.burnt && !site) return { shade: 0.24, roof: null, gain: 0, lamps: 0, burnt: true, ...QUIET };      // burnt out: a black shell until the street forgets
  if (site && site.owner === 'family') return { shade: 1.18, roof: 'family', gain: 1, lamps: 2, ...QUIET };
  if (site) return { shade: 0.8, roof: site.color || null, gain: 0.7, lamps: 1, ...QUIET };
  if (l.ours) {
    const lit = Math.max(1, Math.min(3, l.lit || 1)), want = LAMPS[lit];
    if (l.low) return { shade: 1 + 0.02 * lit, roof: 'family', gain: (0.4 + 0.13 * lit) * 0.8, lamps: Math.floor((Math.floor(want) + (r < want - Math.floor(want) ? 1 : 0)) / 2), ...QUIET };      // his capo is in trouble: the street goes quiet
    const up = l.boom ? 1 : 0;      // its street name grew over the year: it thrives, and it shows
    return { shade: 1 + 0.04 * lit + 0.05 * up, roof: 'family', gain: 0.4 + 0.13 * lit + 0.1 * up, lamps: Math.floor(want) + (r < want - Math.floor(want) ? 1 : 0) + up,
      sign: l.shop && frac(r * 7.31) < SIGNED[lit] + 0.4 * up ? TRADES[Math.floor(frac(r * 53.7) * TRADES.length)] : null, parked: frac(r * 3.17) < PARKED[lit] + 0.3 * up };
  }
  return { shade: 0.62, roof: null, gain: 0, lamps: 0, ...QUIET };
}
// turned(before, after) -> the blocks that changed hands between two plans of the same town: [{ x, y, won }],
// won when the family now holds the street, lost when it held it and no longer does.
export function turned(before, after) {
  if (!before || !after || before.length !== after.length) return [];
  const out = [];
  after.forEach((b, k) => { const was = before[k].grip === 'family', is = b.grip === 'family'; if (was !== is) out.push({ x: b.x, y: b.y, won: is }); });
  return out;
}
// front(blocks, w, h) -> the edges where the fight is: [{ x, y, dx, dy }] for each side of a street of the family that a rival
// presses on hard (press >= PRESS) and that faces a street the family does not hold. Water, rails and the edge of town are no front.
const PRESS = 0.6;
export function front(blocks, w, h) {
  const out = []; if (!blocks) return out;
  for (const b of blocks) {
    if (b.grip !== 'family' || !(b.press >= PRESS)) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = b.x + dx, y = b.y + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const n = blocks[y * w + x]; if (n && !n.void && n.grip && n.grip !== 'family') out.push({ x: b.x, y: b.y, dx, dy });
    }
  }
  return out;
}

// The middle of a street name, in blocks: where the page says it is (a name can be any shape), or the middle of its rectangle.
export const midX = d => typeof d.cx === 'number' ? d.cx : (d.c0 + d.c1) / 2;
export const midY = d => typeof d.cy === 'number' ? d.cy : (d.r0 + d.r1) / 2;

// A place going up, t seconds into a sight that lasts `life`: the frame climbs for the first half, a flash when the roof is on, then it lets go.
export function rising(t, life) {
  const half = life / 2;
  return { up: Math.max(0, Math.min(1, t / half)), flash: t >= half ? Math.max(0, 1 - (t - half)) : 0, alpha: Math.max(0, Math.min(1, (life - t) / 1.5)) };
}
