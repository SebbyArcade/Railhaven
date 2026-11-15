import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { isLinked, placeError, yardSquares } from '../src/buildings/industries.ts';
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
});
