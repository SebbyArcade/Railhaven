// Faint red no-go squares in Rails and Build mode, on a save. Usage: node tools/nogo-shot.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
// a spot near Ashford with mountains, water and buildings in view
const at = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n, a = g.s.sites[0]; g.found = []; g.s.ms.actNew = false; r.openCard(null);
  let best = null, bs = -1;
  for (let y = a.y - 15; y <= a.y + 15; y += 2) for (let x = a.x - 15; x <= a.x + 15; x += 2) {
    let m = 0, w = 0, tr = 0;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (y + dy) * n + x + dx, t = g.world.terr[i]; if (t === 4) m++; if (t === 0) w++; if (g.track.has(i)) tr++; }
    const sc = Math.min(m, 15) + Math.min(w, 10) + Math.min(tr, 15); if (sc > bs) { bs = sc; best = { x, y }; }
  }
  g.s.camera.x = (best.x + 0.5) * 32; g.s.camera.y = (best.y + 0.5) * 32; g.s.camera.z = 1.5;
  r.tools.mode = 'rail'; r.tools.cancel(); return best;
});
await page.waitForTimeout(1300); await page.screenshot({ path: 'shots/nogo-rails.png' });
await page.evaluate(() => { const r = window.railhaven; r.tools.mode = 'pan'; r.tools.chooseBuild('farm'); });
await page.waitForTimeout(1300); await page.screenshot({ path: 'shots/nogo-build.png' });
console.log(at, errors.join('\n') || 'no page errors');
await browser.close();
