// Close-ups of a rebuild save's buildings, as a player would see them. Usage: node tools/save-tour.mjs save.json [count] [zoom]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file, count = 4, z = 2.2] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 600 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
// the busiest spots: buildings with the most other buildings near them
const spots = await page.evaluate(n => {
  const g = window.railhaven.game, bs = g.s.buildings ?? [];
  const score = b => bs.filter(o => Math.hypot(o.x - b.x, o.y - b.y) < 9).length;
  const out = []; for (const b of [...bs].sort((a, c) => score(c) - score(a))) { if (out.every(o => Math.hypot(o.x - b.x, o.y - b.y) > 14)) out.push(b); if (out.length >= n) break; }
  return out.map(b => [b.x + 1.5, b.y + 1.5]);
}, +count);
for (const [k, [x, y]] of spots.entries()) {
  await page.evaluate(([x, y, z]) => { const g = window.railhaven.game; window.railhaven.openCard(null); g.s.camera.x = x * 32; g.s.camera.y = y * 32; g.s.camera.z = z; }, [x, y, +z]);
  await page.waitForTimeout(600); await page.screenshot({ path: `shots/tour-${k}.png` });
}
console.log(spots.length, 'spots ·', errors.join('\n') || 'no page errors');
await browser.close();
