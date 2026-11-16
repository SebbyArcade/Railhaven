import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { buildingSquares, DOCK_LEN, isLinked, placeError, placementsAt, yardLen, yardSquares } from '../src/buildings/industries.ts';
import { trainLength } from '../src/trains/train.ts';
import { TILE } from '../src/world/terrain.ts';
import { reveal } from '../src/world/fog.ts';
import { isAnchor } from '../src/track/paint.ts';
import { buyTrainAt } from '../src/economy/dispatch.ts';
import { islandOfB } from '../src/ships/docks.ts';
import { dockAndLanding } from './sea.ts';

describe('docks and landings', () => {
  it('a dock on Ashford Isle reaches another island; a landing there starts its own railway', () => {
    const { g, dock, landing } = dockAndLanding(4242), n = g.world.n;
    expect(islandOfB(g, landing)).not.toBe(g.world.home);
    expect(isLinked(g, landing)).toBe(true);
    expect(isAnchor(g, yardSquares(n, landing)[0]!)).toBe(true);
    void dock;
    const t = buyTrainAt(g, landing);
    expect(typeof t).not.toBe('string');
  });

  it('a dock needs its pier on the sea and its yard on land', () => {
    const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!; g.s.rlv = 1;
    const q = { kind: 'dock' as const, x: a.x + 3, y: a.y + 3, horizontal: true, side: 1 as const };
    expect(placeError(g, q)).toMatch(/pier stands over the water/);
    void n;
  });

  it('a dock fits on a ragged coast when at least half of its pier is over the water', () => {
    const g = newGame(4242), n = g.world.n, t = g.world.terr; g.s.rlv = 1;
    reveal(g, n / 2, n / 2, n);
    let half = 0, one = 0;
    for (let i = 0; i < n * n; i++) for (const q of placementsAt('dock', i % n, (i / n) | 0)) {
      if (g.world.islandOf[yardSquares(n, q)[0]!] !== g.world.home) continue;
      const pier = buildingSquares(n, q), sea = pier.filter(j => !t[j]).length;
      if (pier.some(j => t[j] === 4) || yardSquares(n, q).some(j => !t[j])) continue;
      const e = placeError(g, q);
      if (sea === 2 && !e) half++;
      if (sea === 1) { one++; expect(e).not.toBe(''); }
    }
    expect(half).toBeGreaterThan(0); // ragged spots on Ashford Isle now take a dock
    expect(one).toBeGreaterThan(0);
  });

  it('docks are 3 squares long, and a whole train still fits along the yard (he asked, 2026-11-16)', () => {
    const { g, dock, landing } = dockAndLanding(4242), n = g.world.n;
    for (const b of [dock, landing]) { expect(yardSquares(n, b)).toHaveLength(DOCK_LEN); expect(buildingSquares(n, b)).toHaveLength(DOCK_LEN); }
    expect(placementsAt('dock', 10, 10).every(p => yardLen(p) === 3)).toBe(true);
    expect(placementsAt('wood', 10, 10).every(p => yardLen(p) === 4)).toBe(true);
    const t = buyTrainAt(g, landing); if (typeof t === 'string') throw new Error(t);
    expect(trainLength(t)).toBeLessThan(DOCK_LEN * TILE);
    // docks in older saves have no length and stay 4 squares
    const old = { ...dock }; delete old.len;
    expect(yardSquares(n, old)).toHaveLength(4);
  });
});
