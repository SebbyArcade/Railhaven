// The unlinked-town look: map, town card and Rails mode. Usage: node tools/unlinked-shot.mjs save.json square
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [file, sq] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 420, height: 800 }, deviceScaleFactor: 2 });
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(500);
await page.evaluate(sq => { const g = window.railhaven.game, n = g.world.n; g.s.camera.x = (sq % n + 0.5) * 32; g.s.camera.y = (sq / n | 0) * 32; g.s.camera.z = 1.8; }, +sq);
await page.waitForTimeout(400); await page.screenshot({ path: 'shots/unlinked-map.png' });
await page.evaluate(sq => { const g = window.railhaven.game; const t = g.s.sites.find(s => s.y * g.world.n + s.x === sq); window.railhaven.openCard({ kind: 'town', id: t.id }); }, +sq);
await page.waitForTimeout(400); await page.screenshot({ path: 'shots/unlinked-card.png' });
await page.click('[data-act="railtown"]', { timeout: 5000 }); await page.waitForTimeout(500); await page.screenshot({ path: 'shots/unlinked-rails.png' });
await browser.close();
