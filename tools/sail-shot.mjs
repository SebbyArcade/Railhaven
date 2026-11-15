// The Orders board when the next Railway level needs another island. Usage: node tools/sail-shot.mjs [save]
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
// pretend only Ashford Isle is reached: no docks joined to the railway
const info = await page.evaluate(() => {
  const r = window.railhaven, g = r.game; g.found = []; g.s.ms.actNew = false;
  g.s.rlv = 4; g.s.orders = 31; g.s.buildings = g.s.buildings.filter(b => b.kind !== 'dock');
  for (let k = 0; k < 120; k++) r.step(1 / 20);
  r.openCard({ kind: 'orders', id: 0 }); return { rlv: g.s.rlv, news: (g.news ?? []).filter(m => m.includes('sail')) };
});
await page.waitForTimeout(800); await page.screenshot({ path: 'shots/sail-orders.png' });
console.log(JSON.stringify(info), errors.join('\n') || 'no page errors');
await browser.close();
