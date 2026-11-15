// 🗺 Area maps on a save: the town card button, the circle in Map mode, then the ? marks after buying. Usage: node tools/map-shot.mjs [save]
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
// the linked town with the most fog around it
const town = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n; g.s.money = Math.max(g.s.money, 20000); g.s.maps = [];
  const fogAround = t => { let k = 0; for (let dy = -40; dy <= 40; dy += 4) for (let dx = -40; dx <= 40; dx += 4) { const x = t.x + dx, y = t.y + dy; if (x >= 0 && y >= 0 && x < n && y < n && !((g.s.fog[(y * n + x) >> 3] >> ((y * n + x) & 7)) & 1)) k++; } return k; };
  const ts = g.s.sites.filter(s => s.kind === 'town' && (s.pop ?? 0) > 0).sort((a, b) => fogAround(b) - fogAround(a));
  const t = ts[0]; r.openCard({ kind: 'town', id: t.id }); return t.name;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/map-card.png' });
await page.click('[data-act=areamap]'); await page.waitForTimeout(800);
const bar = await page.textContent('#ctext');
await page.screenshot({ path: 'shots/map-circle.png' });
await page.click('#ok'); await page.waitForTimeout(400);
const toast = await page.textContent('#toast');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/map-finds.png' });
console.log(town, '·', bar, '·', toast, '·', errors.join('\n') || 'no page errors');
await browser.close();
