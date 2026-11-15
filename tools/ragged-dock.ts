// A dock on a ragged coast near Ashford, saved for tools/save-shot.mjs. Usage: npx vite-node tools/ragged-dock.ts [seed]
import fs from 'node:fs';
import { newGame, trackChanged, prepareSave } from '../src/game.ts';
import { build, buildingSquares, placeError, placementsAt, yardSquares } from '../src/buildings/industries.ts';
import { serialize } from '../src/save/save.ts';
import { reveal } from '../src/world/fog.ts';
const g = newGame(+(process.argv[2] ?? 4242)), n = g.world.n, a = g.s.sites[0]!, t = g.world.terr;
g.s.money = 1e6; g.s.rlv = 1; reveal(g, n / 2, n / 2, n);
let best: any = null, bd = Infinity;
for (let i = 0; i < n * n; i++) for (const q of placementsAt('dock', i % n, (i / n) | 0)) {
  const sea = buildingSquares(n, q).filter(j => !t[j]).length, d = Math.hypot(q.x - a.x, q.y - a.y);
  if (sea === 2 && d < bd && g.world.islandOf[yardSquares(n, q)[0]!] === g.world.home && !placeError(g, q)) { best = q; bd = d; }
}
const b = build(g, best); trackChanged(g);
if (typeof b === 'string') throw new Error(b);
prepareSave(g); fs.writeFileSync('shots/ragged.json', serialize(g.s));
console.log('dock', b.id, 'square', (b.y + 1) * n + b.x + 2, 'pier', buildingSquares(n, b).map(j => t[j]).join(''));
