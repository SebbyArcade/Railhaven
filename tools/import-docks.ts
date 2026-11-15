// Where each imported dock went: npx vite-node tools/import-docks.ts tests/saves/<file>
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { buildingSquares, yardSquares } from '../src/buildings/industries.ts';
const o = await decodeLegacy(fs.readFileSync(process.argv[2]!, 'utf8'));
const { g } = importLegacy(o); const n = g.world.n;
for (const b of (g.s.buildings ?? []).filter(b => b.kind === 'dock'))
  console.log(`dock ${b.x},${b.y} ${b.horizontal ? 'h' : 'v'} isl ${g.world.islandOf[yardSquares(n, b)[0]!]} pier water ${buildingSquares(n, b).filter(i => !g.world.terr[i]).length}/4 linked ${g.linked?.has(yardSquares(n, b)[0]!)}`);
