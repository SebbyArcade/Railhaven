// Records the game's sound for a few seconds close up on a save and counts sudden jumps (clicks/pops).
// Usage: node tools/click-check.mjs [save] [html]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const file = process.argv[2] ?? 'shots/s14.json', html = process.argv[3] ?? 'dist/index.html';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
await page.addInitScript(s => {
  localStorage.setItem('railhaven2', s);
  window.__rec = [];
  const c = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...a) {
    if (dst instanceof AudioDestinationNode) { // tap everything going to the speakers
      const sp = this.context.createScriptProcessor(4096, 2, 2);
      sp.onaudioprocess = e => { const L = e.inputBuffer.getChannelData(0); window.__rec.push(Float32Array.from(L)); e.outputBuffer.getChannelData(0).set(L); e.outputBuffer.getChannelData(1).set(e.inputBuffer.getChannelData(1)); };
      c.call(this, sp); return c.call(sp, dst, ...a);
    }
    return c.call(this, dst, ...a);
  };
}, readFileSync(file, 'utf8'));
await page.goto('file://' + resolve(html));
await page.waitForTimeout(1000);
await page.evaluate(() => window.railhaven.openCard(null));
await page.mouse.click(200, 400);
await page.evaluate(() => { const r = window.railhaven, g = r.game, c = g.s.camera; c.z = 1.8; let best = null, bn = -1;
  for (const t of g.s.trains) { if (!t.at) continue; c.x = t.at.x; c.y = t.at.y; const k = r.hear().sources.filter(h => h.vol > 0.2).length; if (k > bn) { bn = k; best = t.at; } }
  c.x = best.x; c.y = best.y; });
await page.waitForTimeout(500);
await page.evaluate(() => { window.__rec.length = 0; });
await page.waitForTimeout(8000);
const r = await page.evaluate(() => {
  const all = new Float32Array(window.__rec.reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of window.__rec) { all.set(b, o); o += b.length; }
  // a click: a sample-to-sample jump much bigger than the signal's usual change around it
  let clicks = 0, maxJump = 0, peak = 0, sum = 0;
  for (let i = 1; i < all.length; i++) sum += Math.abs(all[i] - all[i - 1]);
  const avg = sum / all.length;
  for (let i = 1; i < all.length; i++) { const j = Math.abs(all[i] - all[i - 1]); peak = Math.max(peak, Math.abs(all[i])); if (j > maxJump) maxJump = j; if (j > Math.max(0.05, avg * 25)) clicks++; }
  return { seconds: (all.length / 48000).toFixed(1), peak: peak.toFixed(3), maxJump: maxJump.toFixed(3), avgChange: avg.toFixed(5), clicks };
});
console.log(html, JSON.stringify(r));
await browser.close();
