import { chromium } from 'playwright';
import { resolve } from 'node:path';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 412, height: 915 } });
await p.goto('file://' + resolve('legacy/railhaven-v283-preview.html'));
await p.waitForTimeout(2500);
const out = await p.evaluate(() => {
  const r = {};
  for (const ty of ['wood', 'farm', 'coal', 'stone', 'iron', 'oil', 'wool']) for (const l of [1, 2, 3]) { const s = { type: ty, lvl: l, x: 0, y: 0 }; try { r[ty + l] = [IND.rate(s), IND.cap(s)]; } catch (e) { r[ty + l] = e.message; } }
  try { r.shedcap = [1, 2, 3, 4].map(l => SHED.cap(l)); } catch (e) { r.shedcap = e.message; }
  try { r.trainCost = String(trainCost); } catch (e) { r.trainCost = e.message; }
  try { r.tripSecs = String(tripSecs); } catch (e) { r.tripSecs = e.message; }
  try { r.fleetMul = String(fleetMul); } catch (e) {}
  try { r.SHED = JSON.stringify(SHED, (k, x) => typeof x === 'function' ? String(x) : x); } catch (e) {}
  try { r.share = String(share); } catch (e) {}
  try { r.sellPay = String(sellPay); r.sellNow = String(sellNow); } catch (e) {}
  try { r.speed = String(trainSpeed); } catch (e) { r.speed = e.message; }
  return r;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
