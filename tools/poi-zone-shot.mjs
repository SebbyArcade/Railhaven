// Screenshot a landmark on a save, optionally as just tapped (its gift's reach drawn).
// Usage: node tools/poi-shot.mjs save.json poiId zoom out.png [tap]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, id, z = 2, out = 'shots/poi.png', tap] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 600, height: 700 }, deviceScaleFactor: 1 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(400);
await page.evaluate(([id, z, tap]) => {
  const R = window.railhaven, g = R.game, p = g.s.pois.find(q => q.id === +id);
  g.s.camera.x = (p.x + 0.5) * 32; g.s.camera.y = (p.y + 0.5) * 32 - 60 / +z; g.s.camera.z = +z;
  if (tap) R.tools.poiSel = { id: p.id, until: performance.now() + 60000 };
}, [id, z, tap ?? '']);
await page.waitForTimeout(400); await page.screenshot({ path: out });
await browser.close();
