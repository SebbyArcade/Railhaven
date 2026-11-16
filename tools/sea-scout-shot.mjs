// Sea scouting on a real save: the sea a dock charts (OUT-sea.png), its Islands in reach page (OUT-isl.png), ⚓ Land
// glowing on that island's shore (OUT-land.png) and a boat route tapped into the fog (OUT-boat.png).
// Usage: npm run build && node tools/sea-scout-shot.mjs [save.json] [out-prefix] [dist/index.html]
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file = 'tests/saves/save-seb-2026-11-16g.json', out = 'shots/sea', dist = 'dist/index.html'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e.stack)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve(dist));
await page.waitForTimeout(1500);
const ev = (f, a) => page.evaluate(f, a);
// the home dock, zoomed out over its sea
const dock = await ev(() => {
  const r = window.railhaven, g = r.game, n = g.world.n; r.openCard(null);
  const d = g.s.buildings.filter(b => b.kind === 'dock')[0];
  g.s.camera.x = (d.x + 1) * 32; g.s.camera.y = (d.y + 1) * 32; g.s.camera.z = 0.55;
  return { id: d.id, x: d.x, y: d.y };
});
await page.waitForTimeout(600); await page.screenshot({ path: `${out}-sea.png` });
if (process.argv[5] === 'sea-only') { console.log(errors.join('\n') || 'no page errors'); await browser.close(); process.exit(0); }
await ev(d => { const r = window.railhaven; r.game.s.camera.z = 0.8; r.openCard({ kind: 'bld', id: d.id, page: 'isl' }); }, dock);
await page.waitForTimeout(600); await page.screenshot({ path: `${out}-isl.png` });
const land = page.locator('[data-act="landat"]').first();
console.log('land buttons', await page.locator('[data-act="landat"]').count());
if (await land.count()) { await land.click(); await page.waitForTimeout(800); console.log('bar:', await ev(() => window.railhaven.tools.bar()?.text)); await page.screenshot({ path: `${out}-land.png` }); }
// a boat route: tap the dock, then a sea square in the fog
const r = await ev(d => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n; R.openCard(null);
  T.setMode('scout');
  const st = g.s.buildings.find(b => b.id === d.id);
  const sq = (st.y + 1) * n + st.x + 1;
  // a far square in the fog that is water, 25-45 squares away
  let target = -1, best = 1e9;
  for (let i = 0; i < n * n; i++) { if (g.world.terr[i]) continue; const isRev = (g.s.fog[i >> 3] >> (i & 7)) & 1; if (isRev) continue; const dd = Math.hypot(i % n - st.x, (i / n | 0) - st.y); if (dd > 30 && dd < best) { best = dd; target = i; } }
  const starts = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) starts.push((st.y + dy) * n + st.x + dx);
  for (const s of starts) { if (g.world.terr[s]) continue; T.scout = null; T.tapSquare(s); if (T.scout?.boat) break; }
  if (!T.scout?.boat) return 'no start';
  T.tapSquare(target);
  const p = T.scout.path, mid = p[Math.floor(p.length / 2)];
  g.s.camera.x = (mid % n) * 32; g.s.camera.y = ((mid / n) | 0) * 32; g.s.camera.z = 0.75;
  return `${p.length - 1} squares · ${T.bar()?.text}`;
}, dock);
console.log('boat:', r);
await page.waitForTimeout(600); await page.screenshot({ path: `${out}-boat.png` });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
