// The build bar while a line is planned near a town: "🚉 links …" or "⚠ … loses its station".
// Usage: node tools/join-bar-shot.mjs save.json centreSquare out.png x,y x,y ...  (the planned path, railway square first)
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, sq, out, ...pts] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 2 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(500);
const bar = await page.evaluate(([sq, pts]) => {
  const R = window.railhaven, g = R.game, n = g.world.n, T = R.tools;
  g.s.camera.x = (sq % n + 0.5) * 32; g.s.camera.y = ((sq / n | 0) + 0.5) * 32; g.s.camera.z = 1.8;
  T.mode = 'rail'; T.plan = { path: pts.map(p => { const [x, y] = p.split(',').map(Number); return y * n + x; }) };
  return T.bar()?.text;
}, [+sq, pts]);
console.log(bar);
await page.waitForTimeout(1500); await page.screenshot({ path: out });
await browser.close();
