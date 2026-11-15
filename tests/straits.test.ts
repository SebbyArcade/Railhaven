import { describe, expect, it } from 'vitest';
import { buildWorld, newGame } from '../src/game.ts';
import type { Game } from '../src/state.ts';
import { generateWorld, MAP_N, MAP_VERSION } from '../src/world/terrain.ts';
import { bridgeJoinsIslands, STRAIT_COST, STRAIT_MAX } from '../src/track/rules.ts';
import { planCost, straitSquares } from '../src/track/paint.ts';
import { reachedIslands } from '../src/progress/missions.ts';

/** Straight crossings between two different named islands over 1-3 squares of shallow water: [land A, ...water, land B]. */
function straits(g: Game): number[][] {
  const w = g.world, n = w.n, out: number[][] = [];
  for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
    const a = y * n + x, ka = w.islandOf[a]!; if (!w.terr[a] || !w.islands[ka]?.name) continue;
    for (const st of [1, n]) {
      const line = [a]; let j = a + st;
      while (line.length <= 4 && !w.terr[j] && !w.deep[j]) { line.push(j); j += st; }
      const kb = w.islandOf[j]!;
      if (line.length > 1 && line.length <= 4 && w.terr[j] && kb !== ka && w.islands[kb]?.name) out.push([...line, j]);
    }
  }
  return out;
}
const pairs = (g: Game) => new Set(straits(g).map(l => { const a = g.world.islandOf[l[0]!]!, b = g.world.islandOf[l.at(-1)!]!; return a < b ? `${a}-${b}` : `${b}-${a}`; }));

describe('🌉 sister islands and strait bridges', () => {
  it('new maps place 2-3 sister islands a short strait apart; saves made before keep the old maps', () => {
    for (const seed of [4242, 7, 31, 12, 3]) {
      const g = newGame(seed);
      expect(g.s.mapV).toBe(MAP_VERSION);
      expect(pairs(g).size).toBeGreaterThanOrEqual(2);
      const old = buildWorld({ ...g.s, mapV: undefined, terrainEdits: {} });
      expect(Buffer.from(old.terr).equals(Buffer.from(generateWorld(seed, MAP_N, 1).terr))).toBe(true);
    }
  });

  it('two islands can only be joined after the Bridge Works, across at most 3 squares, at the strait price', () => {
    const g = newGame(4242), line = straits(g)[0]!, water = line.slice(1, -1), on = new Set(line);
    // before the Bridge Works: refused, and the reason names what to do
    expect(bridgeJoinsIslands(g, water, i => on.has(i))).toMatch(/Bridge Works/);
    (g.s.parks ??= []).push({ town: g.s.sites[0]!.id, x: -9, y: -9, k: 'bridgeworks' });
    expect(bridgeJoinsIslands(g, water, i => on.has(i))).toBe('');
    // the new water squares cost the strait price
    g.track.set(line[0]!, { links: 0 } as never);
    const p = { path: line };
    expect([...straitSquares(g, p)].sort()).toEqual([...water].sort());
    expect(planCost(g, p)).toBeGreaterThanOrEqual(water.length * STRAIT_COST);
    // a wider gap is still refused: widen this one by flooding land squares of the far island
    const far = line.at(-1)!, st = line[1]! - line[0]!, wide = [...water];
    for (let k = 0; wide.length <= STRAIT_MAX; k++) { const i = far + st * k; g.world.terr[i] = 0; wide.push(i); }
    const on2 = new Set([line[0]!, ...wide, far + st * (wide.length - water.length)]);
    g.world.terr[far + st * (wide.length - water.length)] = 1;
    expect(bridgeJoinsIslands(g, wide, i => on2.has(i))).toMatch(/at most 3 squares/);
  });

  it('a sister island your track runs onto counts as reached', () => {
    const g = newGame(4242), line = straits(g)[0]!, kb = g.world.islandOf[line.at(-1)!]!;
    expect(reachedIslands(g).has(kb)).toBe(false);
    g.linked = new Set([line.at(-1)!]);
    expect(reachedIslands(g).has(kb)).toBe(true);
  });
});
