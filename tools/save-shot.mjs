// Screenshot a save file around a square. Usage: node tools/save-shot.mjs save.json square zoom out.png [building id to open]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, sq, z = 2.4, out = 'shots/save.png', card] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(400);
await page.evaluate(([sq, z, card]) => { const g = window.railhaven.game, n = g.world.n; g.s.camera.x = (sq % n + 0.5) * 32; g.s.camera.y = ((sq / n | 0) + 0.5) * 32; g.s.camera.z = +z; window.railhaven.openCard(card ? { kind: 'bld', id: +card } : null); }, [+sq, z, card]);
await page.waitForTimeout(400); await page.screenshot({ path: out });
await browser.close();
