import type { Game } from '../state.ts';
import { type Building, capOf, forestOf, inputsOf, isFactory, isLinked, outputOf, yardSquares } from '../buildings/industries.ts';
import { specMul } from '../world/specialty.ts';
import { catchOf } from './upgrades.ts';

/**
 * Industries joined to the railway fill their stock while they have room. Factories make their product from the
 * raw goods trains bring in: one of each input per unit, as fast as their level allows, while there is room.
 */
export function tickProduction(g: Game, dt: number) {
  tickForests(g);
  for (const b of g.s.buildings ?? []) {
    if (!isLinked(g, b) || (b.fire && g.s.t < b.fire.doneAt)) continue; // a building on fire makes nothing
    if (b.kind === 'dock') { // fishing boats land their catch at the dock, up to what it holds
      if (!b.fish) continue;
      const c = catchOf(b.fish), l = (b.landed ??= {}), m = specMul(g, g.world.islandOf[yardSquares(g.world.n, b)[0]!]!, 'fish');
      for (const k of ['fish', 'shellfish'] as const) if (c[k]) l[k] = Math.min(capOf(b), (l[k] ?? 0) + c[k] * m * dt);
      continue;
    }
    const room = capOf(b) - b.stock;
    if (room <= 0) continue;
    if (!isFactory(b.kind)) {
      const made = Math.min(room, outputOf(g, b) * dt);
      b.stock += made;
      if (b.kind === 'wood' && made > 0) cutTrees(g, b, made);
      continue;
    }
    const ins = inputsOf(b.kind), buf = (b.inbuf ??= {});
    const make = Math.min(room, outputOf(g, b) * dt, ...ins.map(k => buf[k] ?? 0));
    if (make <= 0) continue;
    for (const k of ins) buf[k] = (buf[k] ?? 0) - make;
    b.stock += make;
  }
}

/** Wood a forest square holds before it is cut down, and how long it takes to grow back (3× faster near a level 2+ camp). */
export const TREE_WOOD = 80, REGROW = 300;

/** A lumber camp cuts its forest one square at a time; a cut-down square turns to stumps and grows back. */
function cutTrees(g: Game, b: Building, n: number) {
  const f = forestOf(g, b); if (!f.length) return;
  const i = f[0]!, cut = (g.s.cut ??= {});
  cut[i] = (cut[i] ?? 0) + n;
  if (cut[i]! >= TREE_WOOD) {
    delete cut[i];
    (g.s.stumps ??= {})[i] = g.s.t + REGROW / (b.lvl >= 2 ? 3 : 1);
    g.terrainDirty?.([i]);
  }
}

/** Stumps grow into saplings halfway, then back into forest. */
export function tickForests(g: Game) {
  const st = g.s.stumps; if (!st) return;
  for (const k in st) {
    const i = +k, at = st[k]!;
    if (g.s.t >= at) { delete st[k]; g.terrainDirty?.([i]); continue; }
    if (stumpPhase(g, i) === 2 && !(g.sapl ??= new Set()).has(i)) { g.sapl.add(i); g.terrainDirty?.([i]); }
  }
}

/** 0 forest, 1 stumps, 2 saplings. */
export function stumpPhase(g: Game, i: number): 0 | 1 | 2 {
  const at = g.s.stumps?.[i]; if (at === undefined) return 0;
  return at - g.s.t < REGROW / 6 ? 2 : 1;
}

/** Is the factory working right now, and if not, what does it wait for? */
export function factoryState(g: Game, b: import('../buildings/industries.ts').Building): { busy: boolean; waits: import('../buildings/industries.ts').Good[] } {
  const ins = inputsOf(b.kind), buf = b.inbuf ?? {};
  const waits = ins.filter(k => (buf[k] ?? 0) < 0.01);
  return { busy: isLinked(g, b) && !waits.length && b.stock < capOf(b), waits };
}
