// Rails mode zoomed out: how busy the island coast lines look. Usage: node tools/coast-wide.mjs save.json out.png [zoom]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, outPng = 'shots/coasts-wide.png', z = '0.7'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html')); await page.waitForTimeout(1500);
await page.evaluate(zz => { const r = window.railhaven; if (r.game.s.ms) r.game.s.ms.actNew = false; r.openCard(null); r.tools.mode = 'rail'; r.game.s.camera.z = zz; }, +z);
await page.waitForTimeout(600); await page.screenshot({ path: outPng }); await browser.close();
