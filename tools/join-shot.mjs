// Rails mode on a save: the glow and label on a town that is not on the railway yet. Usage: node tools/join-shot.mjs [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.evaluate(() => window.railhaven.openCard(null));
await page.click('#bar [data-mode="rail"]'); await page.waitForTimeout(300);
const town = await page.evaluate(() => {
  const r = window.railhaven, g = r.game;
  // the first town found but not linked: take the rendered guide's own test by looking for a town with no track on or beside it
  const n = g.world.n, near = s => [-2, -1, 0, 1, 2].some(dx => [-2, -1, 0, 1, 2].some(dy => g.track.has((s.y + dy) * n + s.x + dx)));
  let t = g.s.sites.find(s => s.kind === 'town' && !near(s) && ((g.s.fog[(s.y * n + s.x) >> 3] >> ((s.y * n + s.x) & 7)) & 1));
  if (!t) { // none found yet on this save: uncover the nearest hidden town, as scouting would
    t = g.s.sites.filter(s => s.kind === 'town' && !near(s)).sort((a, b) => Math.hypot(a.x - n / 2, a.y - n / 2) - Math.hypot(b.x - n / 2, b.y - n / 2))[0];
    if (t) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const k = (t.y + dy) * n + t.x + dx; g.s.fog[k >> 3] |= 1 << (k & 7); }
    r.renderer?.terrain?.invalidate?.();
  }
  if (!t) return JSON.stringify(g.s.sites.filter(s => s.kind === 'town').map(s => [s.name, near(s), (g.s.fog[(s.y * n + s.x) >> 3] >> ((s.y * n + s.x) & 7)) & 1])); const c = g.s.camera; c.x = (t.x + 0.5) * 32; c.y = (t.y + 0.5) * 32; c.z = 1.5; return t.name;
});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/rails-join.png' });
console.log(town, errors.join('\n') || 'no page errors');
await browser.close();
