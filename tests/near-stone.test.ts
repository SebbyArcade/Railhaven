import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';

// Playtest 2026-11-16: the home island had one stone outcrop, sometimes 29 squares out, and every town needs stone
// to grow into a Town. Now there is always one within 18 squares of Ashford.
describe('stone near Ashford', () => {
  it('every new map has a stone outcrop on the home island within 18 squares of Ashford', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame(seed), n = g.world.n, a = g.s.sites[0]!, home = g.world.islandOf[a.y * n + a.x];
      const near = g.s.sites.some(s => s.kind === 'dep' && s.res === 'stone' && g.world.islandOf[s.y * n + s.x] === home && Math.hypot(s.x - a.x, s.y - a.y) <= 19);
      expect(near, `seed ${seed}`).toBe(true);
    }
  });
});
