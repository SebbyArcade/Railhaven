// Bring every old save in tests/saves into the rebuild, run 2 game minutes, print what came over.
// Usage: npx vite-node tools/import-check.ts
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { townLinked, tickTowns } from '../src/economy/towns.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { isLinked } from '../src/buildings/industries.ts';

for (const f of fs.readdirSync('tests/saves')) {
  const t0 = Date.now();
  try {
    const o = await decodeLegacy(fs.readFileSync('tests/saves/' + f, 'utf8'));
    const { g, report } = importLegacy(o);
    const towns = g.s.sites.filter(s => s.kind === 'town'), linked = towns.filter(t => townLinked(g, t)).length;
    const oldLinked = o.sites.filter((s: any) => s.type === 'town' && s.linked).length;
    const bl = (g.s.buildings ?? []).filter(b => isLinked(g, b)).length;
    const e0 = g.s.earned ?? 0;
    for (let k = 0; k < 20 * 120; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
    console.log(`${f}: ${Date.now() - t0} ms`);
    for (const r of report) console.log('  ' + r);
    console.log(`  towns linked ${linked}/${towns.length} (old game ${oldLinked}) · buildings linked ${bl}/${(g.s.buildings ?? []).length} · earned in 2 min $${Math.round((g.s.earned ?? 0) - e0)} · trains with a job ${g.s.trains.filter(t => t.job).length}/${g.s.trains.length}`);
    if (process.env.IMPDEBUG) {
      const { hallOf } = await import('../src/buildings/stations.ts'); const n = g.world.n;
      const docks = (g.s.buildings ?? []).filter(b => b.kind === 'dock');
      console.log('  docks', docks.length, 'linked', docks.filter(b => isLinked(g, b)).length, 'old ports', o.sites.filter((x: any) => x.type === 'port').length);
      for (const b of docks) { const k = g.world.islandOf[b.y * n + b.x]; const ys = [0,1,2,3].map(j => b.horizontal ? b.y * n + b.x + j : (b.y + j) * n + b.x); console.log('   dock', b.x, b.y, b.horizontal ? 'h' : 'v', 'isl', g.world.islandOf[ys[0]!], 'linked', isLinked(g, b), 'island track', [...g.track.keys()].filter(i => g.world.islandOf[i] === g.world.islandOf[ys[0]!]).length, 'linked there', [...g.track.keys()].filter(i => g.world.islandOf[i] === g.world.islandOf[ys[0]!] && g.linked?.has(i)).length); void k; }
      for (const t of towns.filter(t => !townLinked(g, t))) console.log('   unlinked', t.name, 'isl', g.world.islandOf[t.y * n + t.x], 'hall', !!hallOf(g.track, n, t), 'track on sq', g.track.has(t.y * n + t.x));
    }
  } catch (e) { console.log(f, 'FAILED', (e as Error).stack?.split('\n').slice(0, 4).join(' | ')); }
}
