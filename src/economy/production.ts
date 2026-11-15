import type { Game } from '../state.ts';
import { capOf, isLinked, outputOf } from '../buildings/industries.ts';

/** Industries joined to the railway fill their stock while they have room. */
export function tickProduction(g: Game, dt: number) {
  for (const b of g.s.buildings ?? []) {
    if (!isLinked(g, b)) continue;
    b.stock = Math.min(capOf(b), b.stock + outputOf(g, b) * dt);
  }
}
