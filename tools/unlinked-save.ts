// A new game where a line runs right past a town but curves away beside it (Stonecroft, 2026-11-16), for the
// unlinked-town screenshots. Usage: npx vite-node tools/unlinked-save.ts [out]
import fs from 'node:fs';
import { newGame, trackChanged } from '../src/game.ts';
import { saveJson } from '../src/save/save.ts';
import { layPath } from '../src/track/edit.ts';
import { reveal } from '../src/world/fog.ts';
import { townLinked } from '../src/economy/towns.ts';
import { joinGap } from '../src/track/joins.ts';

const [out = 'shots/unlinked.json'] = process.argv.slice(2);
for (let seed = 1; seed < 200; seed++) {
  const g = newGame(seed), n = g.world.n, a = g.s.sites[0]!, sq = (x: number, y: number) => y * n + x;
  const line = (pts: [number, number][]) => { const o: number[] = []; for (let k = 0; k < pts.length - 1; k++) { let [x, y] = pts[k]!; const [tx, ty] = pts[k + 1]!; while (x !== tx || y !== ty) { o.push(sq(x, y)); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); } } o.push(sq(...pts.at(-1)!)); return o; };
  for (const t of g.s.sites.slice(1)) {
    if (t.kind !== 'town' || Math.abs(t.x - a.x) > 22 || t.y - a.y < 6 || t.y - a.y > 22 || t.x - a.x < 4) continue;
    const p = line([[a.x, a.y], [t.x + 1, a.y], [t.x + 1, t.y + 1], [t.x + 3, t.y + 1]]);
    const ok = p.every(i => { const k = g.world.terr[i]; return (k === 1 || k === 2) && !g.s.sites.some((s, j) => j > 0 && s.y * n + s.x === i); });
    if (!ok) continue;
    for (const i of p) reveal(g, i % n, (i / n) | 0, 3);
    layPath(g.track, n, p); trackChanged(g);
    if (townLinked(g, t)) continue;
    const gap = joinGap(g, t);
    g.s.money = 20000;
    fs.mkdirSync('shots', { recursive: true }); fs.writeFileSync(out, saveJson(g));
    console.log('seed', seed, 'town', t.name, 'square', t.y * n + t.x, 'gap', gap?.squares.length);
    process.exit(0);
  }
}
console.log('no spot');
