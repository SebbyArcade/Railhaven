import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { buyTrain } from '../src/economy/dispatch.ts';

// Playtest 2026-11-16: on seed 3033 the shed's siding met a straight line with plain track on both sides of the
// turnout, both gentle turnouts curved through the siding's square, and every "Buy a train" said the siding was busy.
describe('a train can always be bought at the engine shed', () => {
  for (const seed of [3033, 4747, 4242, 11, 202])
    it(`seed ${seed}: a long straight line through the shed's turnout`, () => {
      const g = newGame(seed), n = g.world.n, a = g.s.sites[0]!;
      let built = false;
      for (const d of [1, -1, n, -n]) {
        const p = startPlan(g, a.y * n + a.x)!; for (let k = 1; k <= 8; k++) extendPlan(g, p, a.y * n + a.x + d * k);
        if (p.path.length === 9 && typeof buildPlan(g, p) !== 'string') { trackChanged(g); built = true; break; }
      }
      expect(built).toBe(true);
      expect(g.s.shed).toBeTruthy();
      g.s.money = 1e5;
      const t = buyTrain(g);
      expect(typeof t === 'string' ? t : 'bought').toBe('bought');
    });
});
