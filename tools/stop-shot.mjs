// Screenshot yards and halls where trains are loading or unloading on a save (camera on the building). Usage: [PH=loading|unloading] [K=6] node tools/stop-shot.mjs distDir save.json outDir
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const [dist, file, out, secs = '60'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 420, height: 320 }, deviceScaleFactor: 2 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + dist + '/index.html#' + (process.env.CARS ?? '')); await page.waitForTimeout(1200);
await page.addStyleTag({ content: '#mission, #hint, #toast, #hud, #bar { display: none !important; }' });
const shots = [];
for (let k = 0; k < +(process.env.K ?? 6); k++) {
  const got = await page.evaluate(([secs, k, ph]) => {
    const r = window.railhaven, g = r.game; if (g.s.ms) g.s.ms.actNew = false; r.openCard(null);
    if (secs) r.step(secs);
    const ts = g.s.trains.filter(t => ((ph ? t.job?.phase === ph : (t.job?.phase === 'loading' || t.job?.phase === 'unloading'))) && t.v === 0 && t.cars <= (+(new URL(location.href).hash.slice(1)) || 9)); const t = ts[k % Math.max(1, ts.length)];
    if (!t) return null;
    const b = t.job.phase === 'loading' ? g.s.buildings.find(x => x.id === t.job.src) : null, h = ((b && b.len) ?? 4) / 2; const p = !b ? r.trainAt(t.id) : b.horizontal ? { x: (b.x + h) * 32, y: (b.y + 0.5 - b.side * 0.6) * 32 } : { x: (b.x + 0.5 - b.side * 0.6) * 32, y: (b.y + h) * 32 };
    Object.assign(g.s.camera, { x: p.x, y: p.y, z: 1.9 });
    return { id: t.id, ph: t.job.phase };
  }, [k === 0 ? 30 : 12, k, process.env.PH ?? '']);
  await page.waitForTimeout(500);
  if (got) await page.screenshot({ path: `${out}/${k}-t${got.id}-${got.ph}.png` });
  await page.waitForTimeout(4000);
}
await browser.close();
