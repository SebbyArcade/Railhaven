// Before/after for "spoiler in fog": his save with Starling Isle's iron and oil surveyed, around Gullhaven Haven in Rails mode.
// Usage: node tools/fog-spoiler-shot.mjs dist/index.html out.png [save]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [html = 'dist/index.html', out = 'shots/fog-spoiler.png', file = 'tests/saves/save-seb-2026-11-16i.json'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 700 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve(html));
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n; g.found = []; if (g.s.ms) g.s.ms.actNew = false; r.openCard(null);
  const t = g.s.sites.find(s => s.name === 'Gullhaven Haven'), k = g.world.islandOf[t.y * n + t.x];
  const deps = g.s.sites.filter(s => s.kind === 'dep' && (s.res === 'iron' || s.res === 'oil') && g.world.islandOf[s.y * n + s.x] === k);
  for (const d of deps) d.hidden = false; // as if the landing crew surveyed Starling Isle
  // his game had explored round Gullhaven Haven but not the island's far side: uncover a disc that stops short of the oil
  const far = Math.min(...deps.map(d => Math.hypot(d.x - t.x, d.y - t.y))), R = Math.max(4, Math.min(9, far - 4));
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R * R) { const i = (t.y + dy) * n + t.x + dx; g.s.fog[i >> 3] |= 1 << (i & 7); }
  g.terrainDirty?.();
  const d0 = deps[0]; g.s.camera.x = (d0.x - 4) * 32; g.s.camera.y = (d0.y - 2) * 32; g.s.camera.z = 0.75;
  return { isl: g.world.islands[k]?.name, deps: deps.map(d => [d.res, d.x - t.x, d.y - t.y]), R };
});
await page.getByRole('button', { name: /Rails/ }).first().click().catch(() => {});
await page.waitForTimeout(1000); await page.screenshot({ path: out });
console.log(JSON.stringify(info), errors.join('\n') || 'no page errors');
await browser.close();
