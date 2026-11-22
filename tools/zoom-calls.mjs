// Canvas calls per frame at different zooms on a save (a phone-independent measure of drawing work).
// Usage: node tools/zoom-calls.mjs [save]
import { load } from './load-save.mjs';
const { browser, page } = await load(process.argv[2] || 'tests/saves/save-seb-2026-11-21-report20.txt');
await page.evaluate(() => {
  const P = CanvasRenderingContext2D.prototype; window.__cc = {};
  for (const k of ['fillRect', 'strokeRect', 'fill', 'stroke', 'drawImage', 'fillText', 'setTransform', 'save', 'arc', 'lineTo', 'measureText']) { const f = P[k]; P[k] = function (...a) { window.__cc[k] = (window.__cc[k] || 0) + 1; return f.apply(this, a); }; }
});
for (const z of [1.8, 0.8, 0.4, 0.2, 0.1]) {
  await page.evaluate(z => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.camera.z = z; g.s.camera.x = a.x * 32 + 16; g.s.camera.y = a.y * 32 + 16; }, z);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); window.__cc = {}; const f = () => { if (++n < 20) requestAnimationFrame(f); else { const o = {}; let tot = 0; for (const [k, v] of Object.entries(window.__cc)) { o[k] = Math.round(v / 20); tot += v / 20; } res({ tot: Math.round(tot), ms: ((performance.now() - t0) / 20).toFixed(0), ...o }); } }; requestAnimationFrame(f); }));
  console.log('zoom', z, JSON.stringify(r));
}
await browser.close();
