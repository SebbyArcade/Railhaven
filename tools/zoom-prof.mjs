import { load } from './load-save.mjs';
const { browser, page } = await load((process.argv[2] !== 'x' && process.argv[2]) || 'tests/saves/save-seb-2026-11-21-report20.txt');
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
for (const z of [+(process.argv[3] || 0.1)]) {
  await page.evaluate(z => { const g = window.railhaven.game, a = g.s.sites[0]; g.s.camera.z = z; g.s.camera.x = a.x * 32 + 16; g.s.camera.y = a.y * 32 + 16; }, z);
  await page.waitForTimeout(1500);
  await cdp.send('Profiler.start'); await page.waitForTimeout(4000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas; let tot = 0;
  profile.samples.forEach((id, i) => { const n = byId.get(id), k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + dt[i]); tot += dt[i]; });
  console.log('zoom', z, 'total ms', (tot / 1000).toFixed(0));
  // inclusive time per function
  const parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const inc = new Map();
  profile.samples.forEach((id, i) => { const seen = new Set(); for (let x = id; x; x = parent.get(x)) { const n = byId.get(x), k = n.callFrame.functionName + ':' + n.callFrame.lineNumber; if (seen.has(k)) continue; seen.add(k); inc.set(k, (inc.get(k) || 0) + dt[i]); } });
  console.log('-- inclusive'); [...inc].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), k));
  console.log('-- self');
  [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), k));
}
await browser.close();
