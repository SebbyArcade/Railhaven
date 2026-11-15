// ⛔ Closing a building on a save: tap Close on its card, the barriers come down once the yard is empty, the sign
// shows over it. Usage: node tools/closing-shot.mjs [save]
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
const info = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; g.found = []; g.s.ms.actNew = false; r.openCard(null);
  const n = g.world.n, on = x => [0, 1, 2, 3].every(k => g.track.has(x.horizontal ? x.y * n + x.x + k : (x.y + k) * n + x.x));
  const b = g.s.buildings.find(x => x.kind === 'stone' && on(x)) ?? g.s.buildings.find(x => x.kind !== 'dock' && on(x));
  return { id: b.id, kind: b.kind, x: b.x, y: b.y, h: b.horizontal };
});
await page.evaluate(id => window.railhaven.openCard({ kind: 'bld', id }), info.id); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#card [data-act="shut"]')?.scrollIntoView());
await page.screenshot({ path: 'shots/closing-before.png' });
await page.click('#card [data-act="shut"]'); await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/closing-card.png' });
// let the last train leave and the barriers come down
await page.evaluate(() => window.railhaven.step(60)); await page.waitForTimeout(2200);
const down = await page.evaluate(({ id, x, y, h }) => { const r = window.railhaven, g = r.game; r.openCard(null); g.s.camera.x = (x + (h ? 2 : 1)) * 32; g.s.camera.y = (y + (h ? 1 : 2)) * 32; g.s.camera.z = 3; return g.closedKey; }, info);
await page.waitForTimeout(1800); await page.screenshot({ path: 'shots/closing-map.png' });
console.log(info, 'down:', down, errors.join('\n') || 'no page errors');
await browser.close();
