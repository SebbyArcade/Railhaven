// Tap a cargo ship and open its card. Usage: node tools/ship-shot.mjs save.json
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync('shots', { recursive: true });
const [file] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => { localStorage.setItem('railhaven2', s); }, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve('dist/index.html'));
await page.waitForTimeout(1500);
await page.evaluate(() => { const r = window.railhaven; r.openCard(null); r.step(60); });
// follow a ship at sea with cargo and tap it
const ok = await page.evaluate(() => { const r = window.railhaven, g = r.game; const s = g.s.ships.find(x => x.to !== undefined && x.hold.length) ?? g.s.ships.find(x => x.to !== undefined) ?? g.s.ships[0]; window._sid = s.id; return !!s; });
for (let k = 0; k < 2; k++) {
  const p = await page.evaluate(() => { const r = window.railhaven, g = r.game, s = g.s.ships.find(x => x.id === window._sid); const c = g.s.camera; c.z = 1.6;
    const n = g.world.n; let x, y; if (s.to !== undefined && s.path) { const i = s.path[Math.min(s.path.length - 1, Math.floor(s.pos))]; x = i % n; y = (i / n) | 0; } else { const d = g.s.buildings.find(b => b.id === s.at); x = d.x; y = d.y; }
    c.x = (x + 0.5) * 32; c.y = (y + 0.5) * 32; return true; });
  await page.waitForTimeout(400);
}
// tap at the ship's drawn place (centre of the screen is close; search the ring)
const hit = await page.evaluate(() => { const r = window.railhaven, g = r.game, c = g.s.camera; const s = g.s.ships.find(x => x.id === window._sid);
  const t = r.tools; for (let dy = -60; dy <= 60; dy += 4) for (let dx = -60; dx <= 60; dx += 4) { const wx = c.x + dx / c.z, wy = c.y + dy / c.z; if (t.tapWorld(wx, wy) && t.card?.kind === 'ship') { r.openCard(t.card); return [dx, dy]; } } return null; });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/ship-card.png' });
console.log(ok, JSON.stringify(hit), await page.evaluate(() => JSON.stringify(window.railhaven.tools.card)), errors.join('\n') || 'no page errors');
await browser.close();
