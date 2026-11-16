// The builders' scene: builds a camp (and a quarry) near Ashford and screenshots the scene at six moments, side by side
// in shots/construct-steps.png. Usage: npm run build && node tools/construct-shot.mjs [seed] [kind]
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const seed = process.argv[2] || 4242, kind = process.argv[3] || 'wood';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve(process.env.GAME ?? 'dist/index.html') + '?new&seed=' + seed);
await page.waitForTimeout(400);
const res = await page.evaluate(kind => {
  const R = window.railhaven, g = R.game, T = R.tools, n = g.world.n, a = g.s.sites[0];
  g.s.money = 1e6; R.openCard(null);
  T.chooseBuild(kind); T.updateGlow(a.x, a.y);
  const spots = [...T.glow].sort((p, q) => Math.hypot(p % n - a.x, (p / n | 0) - a.y) - Math.hypot(q % n - a.x, (q / n | 0) - a.y));
  if (!spots.length) return 'no spot';
  T.tapSquare(spots[0]); T.confirm(); T.mode = 'pan'; T.buildKind = null; R.openCard(null);
  const b = g.s.buildings.at(-1);
  g.s.camera.x = (b.x + (b.horizontal ? 2 : 0.5 + b.side * 0.5)) * 32; g.s.camera.y = (b.y + (b.horizontal ? 0.5 + b.side * 0.5 : 2)) * 32; g.s.camera.z = 2.1; g.news = []; R.tools.selected = undefined;
  return { id: b.id, built: b.built, t: g.s.t, works: b.stock };
}, kind);
console.log(JSON.stringify(res));
await page.addStyleTag({ content: '#toast,.toast{display:none!important}' });
const shots = [];
for (const p of [0.04, 0.2, 0.4, 0.6, 0.8, 0.93, 1.05]) {
  await page.evaluate(p => { const g = window.railhaven.game, b = g.s.buildings.at(-1); b.built = g.s.t - p * 5; }, p);
  await page.waitForTimeout(120);
  const buf = await page.screenshot({ clip: { x: 31, y: 280, width: 350, height: 350 } });
  shots.push([p, buf.toString('base64')]);
}
const works = await page.evaluate(() => { const g = window.railhaven.game; return g.s.buildings.at(-1).stock; });
console.log('stock after the scene (it works from the start):', works.toFixed(2));
const html = `<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;width:${4 * 360}px;font:600 22px system-ui;color:#fff">${shots.map(([p, s]) => `<div style="margin:5px;position:relative"><img src="data:image/png;base64,${s}" width=350 height=350><span style="position:absolute;left:6px;top:4px;background:#0008;padding:2px 6px;border-radius:6px">${p > 1 ? 'done' : (p * 5).toFixed(1) + ' s'}</span></div>`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 4 * 360, height: 2 * 360 } });
await p2.setContent(html); await p2.waitForTimeout(200);
await p2.screenshot({ path: `shots/construct-steps-${kind}.png` });
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
