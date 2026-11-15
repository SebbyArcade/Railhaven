// Why an old port didn't come over: for each old port, what the rebuild says about docks around it.
// Usage: npx vite-node tools/import-debug.ts tests/saves/<file>
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { placeError, placementsAt } from '../src/buildings/industries.ts';

const o = await decodeLegacy(fs.readFileSync(process.argv[2]!, 'utf8'));
const { g } = importLegacy(o);
const n = g.world.n, w = g.world;
const ports = (o.sites ?? []).filter((s: any) => s.type === 'port');
for (const p of ports) {
  const near = (g.s.buildings ?? []).filter(b => b.kind === 'dock' && Math.hypot(b.x - p.x, b.y - p.y) < 12);
  const isl = w.islandOf[p.y * n + p.x];
  console.log(`port ${p.x},${p.y} terr ${w.terr[p.y * n + p.x]} isl ${isl} linked ${p.linked} · rebuild docks near: ${near.length}`);
  if (near.length) continue;
  const why = new Map<string, number>();
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) for (const q of placementsAt('dock', p.x + dx, p.y + dy)) {
    const e = placeError(g, q); const k = e ? (/far by sea/.test(e) ? e : e.replace(/\d+/g, "#")).slice(0, 120) : "OK"; why.set(k, (why.get(k) ?? 0) + 1);
  }
  for (const [k, v] of [...why].sort((a, b) => b[1] - a[1]).filter((e, j) => j < 8 || /sea|dock|island|reach/i.test(e[0]))) console.log('   ', v, k);
  // the land around: a small picture
  for (let dy = -6; dy <= 6; dy++) {
    let row = '    ';
    for (let dx = -10; dx <= 10; dx++) { const i = (p.y + dy) * n + p.x + dx; row += dx === 0 && dy === 0 ? 'P' : g.track.has(i) ? '#' : '~.^T'[w.terr[i] ?? 0] ?? '?'; }
    console.log(row);
  }
}
