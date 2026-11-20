// How a building reads from above. The boss must tell his own from the rest at a glance:
// the family's buildings carry its colour on the roof (its places brightest, then the streets it holds,
// brighter as the hold firms up), a rival's place carries his, and the rest of the town stays dark.
// From afar the same streets are lit: lamps in the windows, more of them as the hold firms up.
// lotLook(lot, r) -> { shade: what the walls are multiplied by, roof: 'family' | a colour | null, gain: strength of the roof colour,
//                      lamps: how many window lights show from afar }, r being a number in [0, 1) proper to the lot.
const LAMPS = [0, 0.3, 0.75, 1.3];      // lamps a building, on average, by how firmly the street is held
export function lotLook(l, r = 0.5) {
  const site = l.site;
  if (site && site.owner === 'family') return { shade: 1.18, roof: 'family', gain: 1, lamps: 2 };
  if (site) return { shade: 0.8, roof: site.color || null, gain: 0.7, lamps: 1 };
  if (l.ours) {
    const lit = Math.max(1, Math.min(3, l.lit || 1)), want = LAMPS[lit];
    return { shade: 1 + 0.04 * lit, roof: 'family', gain: 0.4 + 0.13 * lit, lamps: Math.floor(want) + (r < want - Math.floor(want) ? 1 : 0) };
  }
  return { shade: 0.62, roof: null, gain: 0, lamps: 0 };
}
