import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { layPath } from '../src/track/edit.ts';
import { BRIDGE_UPKEEP, bridgeSquares } from '../src/track/rules.ts';
import { tickTrains } from '../src/economy/dispatch.ts';

describe('bridge upkeep', () => {
  it('each bridge square costs $25 a minute, counted with running costs', () => {
    const g = newGame(4242), n = g.world.n;
    // a short line of track over the first water square found next to land, plus the land square before it
    let wet = -1;
    for (let i = n + 1; i < n * n - n - 1 && wet < 0; i++) if (g.world.terr[i] === 0 && g.world.terr[i - 1]! > 0 && g.world.terr[i - 1] !== 4 && g.world.terr[i + 1] === 0) wet = i;
    expect(wet).toBeGreaterThan(0);
    expect(bridgeSquares(g)).toBe(0);
    layPath(g.track, n, [wet - 1, wet, wet + 1]); trackChanged(g);
    expect(bridgeSquares(g)).toBe(2);
    const m0 = g.s.money, u0 = g.s.upkeep ?? 0;
    for (let k = 0; k < 600; k++) tickTrains(g, 0.1); // one minute, no trains
    expect(m0 - g.s.money).toBeCloseTo(2 * BRIDGE_UPKEEP, 5);
    expect((g.s.upkeep ?? 0) - u0).toBeCloseTo(2 * BRIDGE_UPKEEP, 5);
  });
});
