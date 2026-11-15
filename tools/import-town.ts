// Why an imported town isn't on the railway: npx vite-node tools/import-town.ts tests/saves/<file> <town>
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
const o = await decodeLegacy(fs.readFileSync(process.argv[2]!, 'utf8'));
const { g } = importLegacy(o); const n = g.world.n, w = g.world;
const t = g.s.sites.find(s => s.name === process.argv[3])!;
const isl = w.islandOf[t.y * n + t.x];
console.log(t.name, t.x, t.y, 'island', isl);
for (let dy = -12; dy <= 12; dy++) {
  let row = '';
  for (let dx = -20; dx <= 20; dx++) {
    const i = (t.y + dy) * n + t.x + dx, b = (g.s.buildings ?? []).find(b => b.x === t.x + dx && b.y === t.y + dy);
    row += dx === 0 && dy === 0 ? 'T' : b ? (b.kind === 'dock' ? 'D' : 'B') : g.linked?.has(i) ? '=' : g.track.has(i) ? '#' : (g.s.sites.find(s => s.kind === 'town' && s.x === t.x + dx && s.y === t.y + dy) ? 'o' : '~.,^M'[w.terr[i] ?? 0]);
  }
  console.log(row);
}
