// Plays every one-off sound (building, rails, orders, level up...) on a new game, records it and counts clicks/pops,
// like click-check.mjs does for the map sounds. Usage: node tools/cue-check.mjs [html]   (after npm run build)
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const html = process.argv[2] ?? 'dist/index.html';
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
await page.addInitScript(() => {
  localStorage.setItem('railhaven-sound', JSON.stringify({ music: false, sfx: true }));
  window.__rec = [];
  const c = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dst, ...a) {
    if (dst instanceof AudioDestinationNode) {
      const sp = this.context.createScriptProcessor(4096, 2, 2);
      sp.onaudioprocess = e => { const L = e.inputBuffer.getChannelData(0); window.__rec.push(Float32Array.from(L)); e.outputBuffer.getChannelData(0).set(L); e.outputBuffer.getChannelData(1).set(e.inputBuffer.getChannelData(1)); };
      c.call(this, sp); return c.call(sp, dst, ...a);
    }
    return c.call(this, dst, ...a);
  };
});
await page.goto('file://' + resolve(html) + '?new');
await page.waitForTimeout(1000);
await page.evaluate(() => { window.railhaven.openCard(null); window.railhaven.game.s.camera.z = 0.3; }); // zoomed out: only the cues
await page.mouse.click(200, 400);
await page.waitForTimeout(800);
const kinds = ['build', 'built', 'rails', 'unrails', 'upgrade', 'remove', 'train', 'ship', 'order', 'grow', 'level', 'break', 'fire'];
for (const k of kinds) {
  await page.evaluate(() => { window.__rec.length = 0; });
  await page.evaluate(k => window.railhaven.sound.cue([{ kind: k, vol: 1, pan: 0.3 }]), k);
  await page.waitForTimeout(k === 'level' ? 3000 : 1800);
  const r = await page.evaluate(() => {
    const all = new Float32Array(window.__rec.reduce((a, b) => a + b.length, 0)); let o = 0; for (const b of window.__rec) { all.set(b, o); o += b.length; }
    let clicks = 0, peak = 0, sum = 0;
    for (let i = 1; i < all.length; i++) sum += Math.abs(all[i] - all[i - 1]);
    const avg = sum / all.length;
    for (let i = 1; i < all.length; i++) { const j = Math.abs(all[i] - all[i - 1]); peak = Math.max(peak, Math.abs(all[i])); if (j > Math.max(0.05, avg * 25)) clicks++; }
    return { peak: +peak.toFixed(3), clicks };
  });
  console.log(k.padEnd(8), JSON.stringify(r));
}
await browser.close();
