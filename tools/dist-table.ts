// Rail distance (squares) from every building's yard to every linked town's station and every factory's yard.
// Usage: npx vite-node tools/dist-table.ts save.json
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { bldDist } from '../src/economy/shipping.ts';
import { hallOf } from '../src/buildings/stations.ts';
import { yardSquares } from '../src/buildings/industries.ts';

const [file = ''] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, towns = g.s.sites.filter(t => t.kind === 'town' && t.got);
for (const b of g.s.buildings ?? []) {
  const d = bldDist(g, b), row: string[] = [];
  for (const t of towns) { const h = hallOf(g.track, n, t, g.world.terr); if (h) row.push(`${t.name} ${d[h.squares[1]!]}`); }
  for (const f of g.s.buildings ?? []) if (f !== b && ['sawmill', 'brickworks', 'gristmill', 'steelmill'].includes(f.kind)) row.push(`${f.kind}#${f.id} ${d[yardSquares(n, f)[1]!]}`);
  console.log(`${b.kind}#${b.id}: ${row.join(' · ')}`);
}
