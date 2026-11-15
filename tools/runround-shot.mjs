// Waits on a save until a train runs its engine round, then screenshots it a few times. Usage: node tools/runround-shot.mjs [save]
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
await page.evaluate(() => { const r = window.railhaven; r.game.found = []; r.game.s.ms.actNew = false; r.openCard(null); });
// run the game fast until a train starts running round
const id = await page.evaluate(() => { const r = window.railhaven, g = r.game; for (let k = 0; k < 20 * 60 * 6; k++) { r.step(0.05); const t = g.s.trains.find(t => t.rr && t.rr.s === 0); if (t) return t.id; } return null; });
if (id === null) { console.log('no run-round in 6 game minutes'); await browser.close(); process.exit(0); }
for (let k = 0; k < 4; k++) {
  await page.evaluate(id => { const r = window.railhaven, g = r.game, t = g.s.trains.find(t => t.id === id); const p = g.net.pieces[t.trail.at(-1).piece].squares[0], n = g.world.n; g.s.camera.x = (p % n + 0.5) * 32; g.s.camera.y = ((p / n | 0) + 0.5) * 32; g.s.camera.z = 3.2; }, id);
  await page.waitForTimeout(300); await page.screenshot({ path: `shots/runround-${k}.png` });
  await page.evaluate(id => { const r = window.railhaven, t = r.game.s.trains.find(t => t.id === id); for (let j = 0; j < 30 && t.rr; j++) r.step(0.05); }, id);
}
const done = await page.evaluate(id => { const r = window.railhaven, g = r.game, t = g.s.trains.find(t => t.id === id); let k = 0; for (; k < 400 && t.rr; k++) r.step(0.05); r.step(0.05); const p = g.net.pieces[t.trail[0].piece].squares[0], n = g.world.n; g.s.camera.x = (p % n + 0.5) * 32; g.s.camera.y = ((p / n | 0) + 0.5) * 32; return { k, engineAhead: t.engineAhead, plan: t.plan.length }; }, id);
await page.waitForTimeout(300); await page.screenshot({ path: 'shots/runround-done.png' });
console.log('after run-round', done);
console.log('train', id, errors.join('\n') || 'no page errors');
await browser.close();
