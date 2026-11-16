// Close-up of a save around a world point, map only (no cards or lessons), for crew pictures.
// Usage: node tools/crew-shot.mjs save.json worldX worldY zoom out.png
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, x, y, z = 3.4, out = 'shots/crew.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 260, height: 260 }, deviceScaleFactor: 3 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(400);
await page.addStyleTag({ content: 'body > *:not(canvas) { display: none !important; }' });
await page.evaluate(([x, y, z]) => { const g = window.railhaven.game; g.s.tut = undefined; window.railhaven.openCard(null); g.s.camera.x = x; g.s.camera.y = y; g.s.camera.z = z; }, [+x, +y, +z]);
await page.waitForTimeout(400); await page.screenshot({ path: out });
await browser.close();
