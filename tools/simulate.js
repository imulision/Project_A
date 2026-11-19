// Plays many years of one district under every capo and prints a report.
// Usage: node tools/simulate.js [years]
const D = require('../web/district.js');

const years = Number(process.argv[2] || 5);
const STARTS = {
  'Quiet start': {},
  'Contested streets': { share: 15, heat: 20 },
  'Police already close': { heat: 55, goodwill: 30 },
  'Broke': { dirty: 100, clean: 0, men: 12 },
};
const $ = (n) => '$' + Math.round(n).toLocaleString('en-US');

function play(capo, start) {
  const d = D.createDistrict({ capo, ...start });
  const tally = {};
  let idle = 0, unpaid = 0;
  for (let i = 0; i < years * 12; i++) {
    for (const e of D.stepMonth(d)) {
      if (e.type === 'decision') { tally[e.kind] = (tally[e.kind] || 0) + 1; if (e.kind === 'hold') idle++; }
      if (e.type === 'unpaid') unpaid += e.left;
    }
  }
  return { d, tally, idle, unpaid };
}

for (const [title, start] of Object.entries(STARTS)) {
  console.log(`\n### ${title} (${years} years)\n`);
  console.log('| Capo | Streets | Men | Heat | Goodwill | Raids | Boss, dirty | Boss, clean | Lost | Idle months | Favourite moves |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const capo of Object.keys(D.CAPOS)) {
    const { d, tally, idle } = play(capo, start);
    const moves = Object.entries(tally).filter(([k]) => k !== 'hold').sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ×${n}`).join(', ');
    console.log(`| ${D.CAPOS[capo].name} | ${Math.round(d.share)}% | ${d.men} | ${Math.round(d.heat)} | ${Math.round(d.goodwill)} | ${d.raids} | ${$(d.boss.dirty)} | ${$(d.boss.clean)} | ${$(d.lost)} | ${idle}/${years * 12} | ${moves} |`);
  }
}
