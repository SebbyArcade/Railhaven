// Screenshot a save in winter to see the falling snow. Usage: node tools/snow-shot.mjs save.json out.png
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, out = 'shots/snow.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(500);
await page.evaluate(() => { const g = window.railhaven.game; g.s.tut = undefined; window.railhaven.openCard(null); g.s.t = 400 + Math.floor(g.s.t / 480) * 480; });
await page.waitForTimeout(6000); await page.screenshot({ path: out });
await browser.close();
