// Which drawing functions make the most canvas calls at a zoom (sampled stacks). Usage: node tools/zoom-who.mjs [save] [zoom]
import { load } from './load-save.mjs';
const { browser, page } = await load((process.argv[2] !== 'x' && process.argv[2]) || 'tests/saves/save-seb-2026-11-21-report20.txt');
const z = +(process.argv[3] || 0.1);
await page.evaluate(z => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.camera.z = z; g.s.camera.x = a.x * 32 + 16; g.s.camera.y = a.y * 32 + 16; }, z);
await page.waitForTimeout(1200);
const r = await page.evaluate(() => new Promise(res => {
  const P = CanvasRenderingContext2D.prototype, tally = {}; let i = 0;
  for (const k of ['fillRect', 'fill', 'stroke', 'lineTo', 'arc', 'drawImage', 'fillText']) { const f = P[k]; P[k] = function (...a) { if (++i % 20 === 0) { const st = new Error().stack.split('\n').slice(2, 5).map(l => (l.trim().split(' ')[1] || '?')).join(' < '); tally[st] = (tally[st] || 0) + 20; } return f.apply(this, a); }; }
  let n = 0; const f = () => { if (++n < 10) requestAnimationFrame(f); else res(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${Math.round(v / 10)}  ${k}`)); }; requestAnimationFrame(f);
}));
console.log(r.join('\n'));
await browser.close();
