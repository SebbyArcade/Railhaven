// Sound peaks check: plays a busy close-up (many trains chuffing, mines, loading, sea and wind) through the game's own
// sound code into an offline recording, then reports how loud it got, how many samples hit the limit (crackle) and
// how many sounds played at once. Usage: npm run build && node tools/sound-peaks.mjs [trains] [seconds] [sfxVol 1-5]
// LATE=0.02 makes the clock read 20 ms behind, like a busy phone frame; QUIET=1 plays only chuffing trains (no music,
// no sea or wind, no mines), so a sudden start shows up as a big jump between two samples. GAME=file picks another build.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const [trains = 24, secs = 20, vol = 5] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + resolve(process.env.GAME ?? 'dist/index.html'));
await page.waitForTimeout(800);
const r = await page.evaluate(async ({ trains, secs, vol, late, quiet }) => {
  const rate = 44100, ac = new OfflineAudioContext(2, rate * secs, rate);
  Object.defineProperty(ac, 'state', { get: () => 'running' });
  const clock = Object.getOwnPropertyDescriptor(BaseAudioContext.prototype, 'currentTime').get;
  Object.defineProperty(ac, 'currentTime', { get: () => Math.max(0, clock.call(ac) - late) });
  let live = 0, most = 0; // sounds playing at once
  const mk = OfflineAudioContext.prototype;
  for (const name of ['createOscillator', 'createBufferSource']) {
    const f = mk[name]; mk[name] = function () { const n = f.call(this), st = n.stop.bind(n); n.start = ((s0) => (...a) => { live++; most = Math.max(most, live); n.onended = () => live--; return s0(...a); })(n.start.bind(n)); n.stop = st; return n; };
  }
  const Saved = window.AudioContext; window.AudioContext = function () { return ac; };
  const s = new (window.railhaven.sound.constructor)();
  s.settings = { music: !quiet, sfx: true, musicVol: 3, sfxVol: vol, muted: false };
  s.unlock(); window.AudioContext = Saved;
  const sources = [];
  for (let i = 0; i < trains; i++) sources.push({ id: 't' + i, kind: i % 4 === 3 ? 'load' : 'train', vol: 0.5 + 0.5 * ((i * 37) % 10) / 10, pan: ((i * 13) % 14) / 10 - 0.7, rate: 0.5 + ((i * 7) % 5) / 10, moving: i % 4 !== 3 });
  if (!quiet) sources.push({ id: 'b1', kind: 'coal', vol: 1, pan: -0.2 }, { id: 'b2', kind: 'iron', vol: 1, pan: 0.2 });
  const scene = quiet ? { near: 1, sources: sources.filter(h => h.kind === 'train'), sea: 0, forest: 0, grass: 0, hills: 0, storm: 0 } : { near: 1, sources, sea: 0.3, forest: 0, grass: 0.1, hills: 0.6, storm: 0 };
  for (let t = 0.1; t < secs - 0.5; t += 0.1) { ac.suspend(t).then(() => { s.update(scene); void ac.resume(); }); }
  const buf = await ac.startRendering();
  let peak = 0, over = 0, jump = 0, at = 0; const n = buf.length;
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 1; i < n; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a >= 0.99) over++; const j = Math.abs(d[i] - d[i - 1]); if (j > jump) { jump = j; at = i / rate; } } }
  let sq = 0; const d0 = buf.getChannelData(0); for (let i = 0; i < n; i++) sq += d0[i] * d0[i];
  return { peak: +peak.toFixed(3), clipped: over, rms: +Math.sqrt(sq / n).toFixed(3), biggestStep: +jump.toFixed(3), stepAt: +at.toFixed(3), mostAtOnce: most };
}, { trains, secs, vol, late: +(process.env.LATE ?? 0), quiet: !!process.env.QUIET });
console.log(`${trains} sources, ${secs} s, effects volume ${vol}:`, r);
console.log(errors.join('\n') || 'no page errors');
await browser.close();
