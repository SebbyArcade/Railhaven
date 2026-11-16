// On a real save: run until a cargo ship is at sea with goods aboard, then shoot it close (OUT-close.png) and further out (OUT-mid.png).
// Usage: npm run build && node tools/ship-cargo-save.mjs [save.json] [out-prefix]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file = 'tests/saves/save-seb-2026-11-16g.json', out = 'shots/ship-save'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e.stack)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const look = z => page.evaluate(z => {
  const r = window.railhaven, g = r.game, n = g.world.n; r.openCard(null);
  for (let k = 0; k < 2400; k++) { const s = (g.s.ships ?? []).find(s => s.to !== undefined && s.hold.length && s.path && s.pos > 3 && s.pos < s.path.length - 4); if (s) { const i = s.path[Math.floor(s.pos)]; g.s.camera.x = (i % n + 0.5) * 32; g.s.camera.y = (((i / n) | 0) + 0.5) * 32; g.s.camera.z = z; return `ship ${s.id} at sea with ${s.hold.map(q => q.good + ' ' + Math.round(q.n)).join(', ')} after ${k / 2}s`; } r.step(0.5); }
  return 'no ship at sea with cargo';
}, z);
console.log(await look(2.6)); await page.waitForTimeout(600); await page.screenshot({ path: `${out}-close.png` });
await page.evaluate(() => { window.railhaven.game.s.camera.z = 1.3; }); await page.waitForTimeout(400); await page.screenshot({ path: `${out}-mid.png` });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
