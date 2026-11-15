// The Engine shed's trains by island, the 🚦 line on the Orders board, a dock's Trains page and Double mode with
// a held-up stretch marked. Usage: node tools/fleet-shot.mjs save.json outDir
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/fleet'] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const errors = [];
for (const [name, w, h] of [['fold', 412, 915], ['open', 884, 1104]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
  await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.railhaven.game; if (g.s.ms) g.s.ms.actNew = false; });
  const shot = async (tag, fn) => { await page.evaluate(fn); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${name}-${tag}.png` }); };
  await shot('shed', () => window.railhaven.openCard({ kind: 'shed', id: 0 }));
  await shot('orders', () => window.railhaven.openCard({ kind: 'orders', id: 0 }));
  // the dock the 🚦 Ship › button opens
  await page.evaluate(() => document.querySelector('[data-page="trains"][data-act="open"]')?.click());
  await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${name}-docktrains.png` });
  if (name === 'open') { // a message while a side card is open
    await page.evaluate(() => document.querySelector('[data-act="shipover"]')?.click());
    await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${name}-toast.png` });
  }
  await page.close();
}
console.log(errors.join('\n') || 'no page errors');
await browser.close();
