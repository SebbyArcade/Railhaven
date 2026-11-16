// Go › on notes about a place: a fire and a breakdown on a save, the note with its button, then the map after Go ›.
// Usage: node tools/news-go-shot.mjs [save] [outdir] [width] [height]
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'tests/saves/save-seb-2026-11-16h.json', out = process.argv[3] ?? 'shots';
const W = +(process.argv[4] ?? 412), H = +(process.argv[5] ?? 860);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('railhaven2', s), readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
const tag = `${W}x${H}`;
const ready = () => page.evaluate(() => { const r = window.railhaven, g = r.game; r.openCard(null); if (g.s.ms) g.s.ms.actNew = false; g.found = []; g.news = []; g.s.storm = undefined; const a = g.s.sites[0]; g.s.camera.x = a.x * 32; g.s.camera.y = a.y * 32; });
const report = [];

for (const kind of ['fire', 'breakdown']) {
  await ready();
  await page.evaluate(k => { const g = window.railhaven.game; g.s.t = Math.max(g.s.t, 13 * 60); g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: 1e9, [k]: g.s.t }; }, kind);
  await page.waitForSelector('#toast.go button', { timeout: 8000 });
  const text = await page.textContent('#toast');
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}/${kind}-note-${tag}.png` });
  const before = await page.evaluate(() => ({ ...window.railhaven.game.s.camera }));
  await page.tap('#toast button');
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${kind}-go-${tag}.png` });
  const after = await page.evaluate(() => { const r = window.railhaven; return { cam: { ...r.game.s.camera }, card: r.tools.card }; });
  report.push({ kind, text, moved: Math.round(Math.hypot(after.cam.x - before.x, after.cam.y - before.y)), card: after.card });
}
// a note with no place (the storm passing) has no button
await ready();
await page.evaluate(() => window.railhaven.game.news.push('🌤 The storm has passed'));
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('🌤'), null, { timeout: 9000 });
report.push({ kind: 'no place', button: await page.$('#toast.go button') !== null });
console.log(JSON.stringify(report, null, 1));
if (errors.length) console.log('page errors:', errors);
await browser.close();
