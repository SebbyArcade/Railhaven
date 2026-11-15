// How close islands sit: for each seed, the narrowest straight crossing (shallow water only) between island pairs.
// Usage: npx vite-node tools/island-gaps.ts [seeds...]   (MAPV=1 for the old game's maps)
import { newGame } from '../src/game.ts';
import { generateWorld, MAP_N, MAP_VERSION } from '../src/world/terrain.ts';
import { islandSpec } from '../src/world/specialty.ts';

const seeds = process.argv.slice(2).map(Number);
for (const seed of seeds.length ? seeds : [4242, 7, 31, 12, 3]) {
  const g = newGame(seed);
  Object.assign(g.world, generateWorld(seed, MAP_N, Number(process.env.MAPV ?? MAP_VERSION)));
  const w = g.world, n = w.n, best = new Map<string, number>();
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const a = w.islandOf[y * n + x]!; if (!w.terr[y * n + x] || a < 0) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      let k = 1, deep = false;
      while (k <= 12 && w.terr[(y + dy * k) * n + x + dx * k] === 0) { if (w.deep[(y + dy * k) * n + x + dx * k]) deep = true; k++; }
      const j = (y + dy * k) * n + x + dx * k; if (k === 1 || k > 12 || !w.terr[j] || deep) continue;
      const b = w.islandOf[j]!; if (b === a || b < 0) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`; best.set(key, Math.min(best.get(key) ?? 99, k - 1));
    }
  }
  const name = (k: number) => k === w.home ? 'Ashford Isle' : `${w.islands[k]?.name ?? '#' + k} (${islandSpec(g, k) ?? '-'}, ${w.islands[k]!.size})`;
  const rows = [...best].filter(([, d]) => d <= 3).sort((p, q) => p[1] - q[1]).map(([k, d]) => { const [a, b] = k.split('-').map(Number); return `${d} water: ${name(a!)} ↔ ${name(b!)}`; });
  console.log(`seed ${seed}: ${w.islands.filter(i => i?.name).length} named islands`);
  for (const r of rows) console.log('  ' + r);
}
