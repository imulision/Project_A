import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.resolve(here, '../web/index.html') + '?fixed&manual';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.goto(url);
await page.waitForSelector('.facebtn', { timeout: 120000 });
await page.click('[data-face=sal]'); await page.click('#who [data-act=start]');
await page.waitForSelector('#veil:not(.on)', { state: 'attached' });
await page.evaluate(() => window.__ashport.home());
await page.waitForFunction(() => !window.__ashport.map().stats().moving, null, { timeout: 60000 });
const step = () => page.evaluate(() => { const A = window.__ashport, m = A.map(), q = (s) => document.querySelector('#veil.on ' + s);
  const face = () => m.labels().find((l) => l.id[0] === 'k' && l.capo === 'sal'); const hn = document.querySelector('#hint [data-hint]'); if (hn) hn.click(); A.game().paused = false;
  const a = face(); A.beat(); for (let k = 0; k < 8 && document.querySelector('#veil.on'); k++) { const b = q('[data-act=answer][data-yes="1"]') || q('[data-act=later]') || q('[data-act=close]') || q('button'); if (b) b.click(); else break; }
  let max = 0, prev = a; for (let s = 0; s < 4; s++) { m.run(0.25); const f = face(); if (prev && f && !m.stats().moving) max = Math.max(max, Math.hypot(f.x - prev.x, f.y - prev.y)); prev = f; }
  const k = A.view().cities[0].capos.find((c) => c.id === 'sal'); return { dbg: prev ? '' : JSON.stringify({ moving: m.stats().moving, caps: m.cars().filter((c) => c.kind === 'capo'), ks: m.labels().map((l) => l.id).slice(0, 12), n: m.labels().length, caps2: A.view().cities[0].capos.map((k) => k.id + JSON.stringify(k.at)) }), e: k.errand ? k.errand.step : null, max: Math.round(max), riding: prev && prev.riding, why: k.at && k.at.why }; });
let seen = [], shot = 0, last = null;
for (let i = 0; i < 400; i++) { const r = await step(); const key = r.e + '/' + r.why; if (key !== last) { seen.push(i + ':' + key + ' riding ' + r.riding + ' ' + r.dbg); last = key; }
  if (r.max > 60) seen.push('JUMP ' + i + ' ' + JSON.stringify(r));
  if (r.e === 'works' && !shot) { shot = 1; await page.screenshot({ path: '/mnt/project-files/mockups/capo-works.png' }); }
  if (seen.filter((x) => x.includes('null/')).length > 3 && shot) break; }
console.log(seen.join('\n'));
await browser.close();
