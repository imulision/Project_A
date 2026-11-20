// How a building reads from above. The boss must tell his own from the rest at a glance:
// the family's buildings carry its colour on the roof (its places brightest, then the streets it holds,
// brighter as the hold firms up), a rival's place carries his, and the rest of the town stays dark.
// lotLook(lot) -> { shade: what the walls are multiplied by, roof: 'family' | a colour | null, gain: strength of the roof colour }
export function lotLook(l) {
  const site = l.site;
  if (site && site.owner === 'family') return { shade: 1.18, roof: 'family', gain: 1 };
  if (site) return { shade: 0.8, roof: site.color || null, gain: 0.7 };
  if (l.ours) { const lit = Math.max(1, Math.min(3, l.lit || 1)); return { shade: 1 + 0.04 * lit, roof: 'family', gain: 0.4 + 0.13 * lit }; }
  return { shade: 0.62, roof: null, gain: 0 };
}
