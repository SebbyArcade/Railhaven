// Prints the track around the network as text: = double, - single, + junction, X crossing, H station hall, Y yard, B building.
// Usage: npx vite-node tools/track-ascii.ts save.json
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { yardSquares } from '../src/buildings/industries.ts';

const raw = fs.readFileSync(process.argv[2]!, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, keys = [...g.track.keys()];
const xs = keys.map(i => i % n), ys = keys.map(i => (i / n) | 0);
const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
const yard = new Set<number>(); for (const b of g.s.buildings ?? []) for (const i of yardSquares(n, b)) yard.add(i);
const hall = new Set<number>(g.sys.anyLane ? [...g.sys.anyLane].flatMap(p => g.net.pieces[p]!.squares) : []);
const bc = (m: number) => [1, 2, 4, 8].filter(b => m & b).length;
console.log(`x ${x0}..${x1}  y ${y0}..${y1}`);
for (let y = y0; y <= y1; y++) {
  let row = String(y).padStart(4) + ' ';
  for (let x = x0; x <= x1; x++) {
    const i = y * n + x, s = g.track.get(i);
    const site = g.s.sites.find(q => q.x === x && q.y === y);
    if (!s) { row += site ? (site.kind === 'town' ? 'T' : 'o') : (g.s.buildings ?? []).some(b => b.x === x && b.y === y) ? 'B' : '.'; continue; }
    const k = bc(s.links);
    row += yard.has(i) ? 'Y' : hall.has(i) ? 'H' : s.cross ? 'X' : k >= 3 ? '+' : s.dbl ? '=' : k === 1 ? 'o' : '-';
  }
  console.log(row);
}
console.log('trains', g.s.trains.map(t => `${t.id}:${t.job?.phase ?? 'idle'}`).join(' '));
