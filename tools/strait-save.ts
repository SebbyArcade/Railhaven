// A picture save: a new map (seed 4242) with its sister islands uncovered and a strait bridge laid across one of them.
// Usage: npx vite-node tools/strait-save.ts [out.json]   then node tools/strait-shot.mjs
import fs from 'node:fs';
import { newGame, trackChanged } from '../src/game.ts';
import { layPath } from '../src/track/edit.ts';
import { saveTo } from '../src/save/save.ts';
import { reveal } from '../src/world/fog.ts';

const g = newGame(4242), w = g.world, n = w.n;
const out = process.argv[2] ?? 'shots/strait.json';
// the straight crossings between two named islands over 1-3 squares of shallow water
const lines: number[][] = [];
for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
  const a = y * n + x, ka = w.islandOf[a]!; if (!w.terr[a] || !w.islands[ka]?.name || w.terr[a] === 4) continue;
  for (const st of [1, n]) {
    const line = [a]; let j = a + st;
    while (line.length <= 4 && !w.terr[j] && !w.deep[j]) { line.push(j); j += st; }
    if (line.length > 1 && line.length <= 4 && w.terr[j] && w.terr[j] !== 4 && w.islandOf[j] !== ka && w.islands[w.islandOf[j]!]?.name) lines.push([...line, j]);
  }
}
const nearTown = (l: number[]) => l.some(i => g.s.sites.some(t => (t.kind === 'town' || t.kind === 'plot') && Math.abs(t.x - i % n) <= 3 && Math.abs(t.y - ((i / n) | 0)) <= 3));
const line = lines.filter(l => (process.env.NEARTOWN ? nearTown(l) : !nearTown(l)) && w.islandOf[l[0]!] !== w.home && w.islandOf[l.at(-1)!] !== w.home).sort((p, q) => q.length - p.length)[0]!, st = line[1]! - line[0]!;
// run the track a few squares inland on both sides, over land only
const path = [...line];
for (let k = 0; k < 4; k++) { const i = path[0]! - st; if (!w.terr[i] || w.terr[i] === 4) break; path.unshift(i); }
for (let k = 0; k < 4; k++) { const i = path.at(-1)! + st; if (!w.terr[i] || w.terr[i] === 4) break; path.push(i); }
layPath(g.track, n, path); trackChanged(g);
g.s.rlv = 6; g.s.money = 60000;
for (const i of path) reveal(g, i % n, (i / n) | 0, 14);
const mid = line[(line.length / 2) | 0]!;
g.s.camera = { x: ((mid % n) + 0.5) * 32, y: (((mid / n) | 0) + 0.5) * 32, z: 1.6 };
saveTo({ getItem: () => null, setItem: (_k: string, v: string) => fs.writeFileSync(out, v) }, g);
console.log(JSON.stringify({ out, water: line.length - 2, a: w.islands[w.islandOf[line[0]!]!]!.name, b: w.islands[w.islandOf[line.at(-1)!]!]!.name, mid }));
