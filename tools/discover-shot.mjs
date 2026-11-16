// Island discoveries on a save: a scout sent toward a hidden town comes back with its 🧭 report, an island's 🏝 arrival
// card, a frontier landmark close up, and the Scout reports page. Usage: node tools/discover-shot.mjs [save] [outdir]
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'tests/saves/save-seb-2026-11-16b.json', out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const quiet = () => page.evaluate(() => { const r = window.railhaven, g = r.game; r.openCard(null); if (g.s.ms) g.s.ms.actNew = false; g.found = []; g.news = []; });
await quiet();
const shot = async (name, wait = 1300) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); };

// 1. a scout from the town on the railway nearest a hidden town, walking toward it
const sent = await page.evaluate(() => {
  const r = window.railhaven, g = r.game, n = g.world.n, seen = i => (g.s.fog[i >> 3] >> (i & 7)) & 1;
  const near = s => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (g.linked?.has((s.y + dy) * n + s.x + dx)) return true; return false; };
  const starts = g.s.sites.filter(s => s.kind === 'town' && near(s));
  let best = null;
  const targets = [...g.s.sites.filter(s => s.kind !== 'dep'), ...(g.s.pois ?? []).filter(p => p.kind !== 'wreck')];
  for (const t of targets) if (!seen(t.y * n + t.x)) for (const a of starts) {
    if (g.world.islandOf[a.y * n + a.x] !== g.world.islandOf[t.y * n + t.x]) continue;
    const d = Math.abs(a.x - t.x) + Math.abs(a.y - t.y); if (d < 34 && (!best || d < best.d)) best = { a, t, d };
  }
  if (!best) for (let i = 0; i < n * n; i++) if (g.world.terr[i] && !seen(i)) for (const a of starts) { // else the nearest land still in the fog
    if (g.world.islandOf[a.y * n + a.x] !== g.world.islandOf[i]) continue;
    const t = { x: i % n, y: (i / n) | 0 }, d = Math.abs(a.x - t.x) + Math.abs(a.y - t.y); if (!best || d < best.d) best = { a, t, d };
  }
  if (best) { const dx = Math.sign(best.t.x - best.a.x), dy = Math.sign(best.t.y - best.a.y); best.t = { x: best.t.x + dx * 10, y: best.t.y + dy * 10 }; } // and on past it
  if (!best) return { starts: starts.length };
  const { a, t } = best, path = [a.y * n + a.x]; console.log('from', a.name, 'to', t.kind ?? t.name, best.d); let x = a.x, y = a.y;
  while ((x !== t.x || y !== t.y) && path.length < 36) {
    const land = i => g.world.terr[i] !== 0 || !seen(i);
    const nx = x + Math.sign(t.x - x), ny = y + Math.sign(t.y - y);
    if (nx !== x && land(y * n + nx) && (Math.abs(t.x - x) >= Math.abs(t.y - y) || ny === y || !land(ny * n + x))) x = nx; else if (ny !== y && land(ny * n + x)) y = ny; else break;
    path.push(y * n + x);
  }
  g.s.money = Math.max(g.s.money, 50000);
  r.tools.mode = 'scout'; r.tools.scout = { path, boat: false, name: a.name };
  g.s.camera.x = ((a.x + t.x) / 2 + 0.5) * 32; g.s.camera.y = ((a.y + t.y) / 2 + 0.5) * 32; g.s.camera.z = 0.8;
  r.tools.confirm(); r.tools.mode = 'pan';
  return { from: a.name, to: [t.x, t.y], steps: path.length - 1, starts: starts.length };
});
console.log('scout', sent);
await page.evaluate(() => { const g = window.railhaven.game; g.s.t += 0; });
await page.waitForFunction(() => window.railhaven.game.s.reports?.length > 0, null, { timeout: 60000 });
await shot('scout-report', 2200);
const cardText = await page.evaluate(() => document.querySelector('#card')?.innerText ?? '');
console.log(cardText.replace(/\n+/g, ' | ').slice(0, 600));
await page.click('[data-act=reports]').catch(() => {}); await shot('scout-reports', 500);

// 2. an island arrival card (the save's islands, as if just reached)
await quiet();
const isl = await page.evaluate(() => {
  const g = window.railhaven.game, n = g.world.n, reached = new Set(g.s.isles ?? []);
  g.s.isles = [g.world.home];
  if ([...reached].some(k => k !== g.world.home && g.world.islands[k]?.name)) return 'islands the save reaches';
  // the save reaches no other named island: pretend track runs onto the one with the most towns
  const count = k => g.s.sites.filter(s => s.kind === 'town' && g.world.islandOf[s.y * n + s.x] === k).length;
  const k = g.world.islands.map((o, j) => j).filter(j => g.world.islands[j].name && j !== g.world.home).sort((a, b) => count(b) - count(a))[0];
  let sq = -1; for (let i = 0; i < n * n && sq < 0; i++) if (g.world.islandOf[i] === k) sq = i;
  g.linked = new Set([...g.linked, sq]);
  const t = g.s.sites.find(s => s.kind === 'town' && g.world.islandOf[s.y * n + s.x] === k);
  if (t) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const i = (t.y + dy) * n + t.x + dx; g.s.fog[i >> 3] |= 1 << (i & 7); }
  return 'pretend: ' + g.world.islands[k].name;
});
await shot('island-arrival', 2200);
console.log('arrival:', (await page.evaluate(() => document.querySelector('#card')?.innerText ?? '')).replace(/\n+/g, ' | ').slice(0, 500), isl);

// 3. a frontier landmark close up
await quiet();
for (const k of ['shaft', 'camp']) {
  await page.evaluate(k => { const g = window.railhaven.game, p = g.s.pois.find(q => q.kind === k); const n = g.world.n; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (p.y + dy) * n + p.x + dx; g.s.fog[i >> 3] |= 1 << (i & 7); } p.seen = true; g.s.camera.x = (p.x + 0.5) * 32; g.s.camera.y = (p.y + 0.5) * 32; g.s.camera.z = 3; window.railhaven.openCard(null); }, k);
  await shot('poi-' + k, 900);
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
