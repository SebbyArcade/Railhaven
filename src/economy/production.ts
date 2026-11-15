import type { Game } from '../state.ts';
import { capOf, inputsOf, isFactory, isLinked, outputOf } from '../buildings/industries.ts';
import { catchOf } from './upgrades.ts';

/**
 * Industries joined to the railway fill their stock while they have room. Factories make their product from the
 * raw goods trains bring in: one of each input per unit, as fast as their level allows, while there is room.
 */
export function tickProduction(g: Game, dt: number) {
  for (const b of g.s.buildings ?? []) {
    if (!isLinked(g, b)) continue;
    if (b.kind === 'dock') { // fishing boats land their catch at the dock, up to what it holds
      if (!b.fish) continue;
      const c = catchOf(b.fish), l = (b.landed ??= {});
      for (const k of ['fish', 'shellfish'] as const) if (c[k]) l[k] = Math.min(capOf(b), (l[k] ?? 0) + c[k] * dt);
      continue;
    }
    const room = capOf(b) - b.stock;
    if (room <= 0) continue;
    if (!isFactory(b.kind)) { b.stock = Math.min(capOf(b), b.stock + outputOf(g, b) * dt); continue; }
    const ins = inputsOf(b.kind), buf = (b.inbuf ??= {});
    const make = Math.min(room, outputOf(g, b) * dt, ...ins.map(k => buf[k] ?? 0));
    if (make <= 0) continue;
    for (const k of ins) buf[k] = (buf[k] ?? 0) - make;
    b.stock += make;
  }
}

/** Is the factory working right now, and if not, what does it wait for? */
export function factoryState(g: Game, b: import('../buildings/industries.ts').Building): { busy: boolean; waits: import('../buildings/industries.ts').Good[] } {
  const ins = inputsOf(b.kind), buf = b.inbuf ?? {};
  const waits = ins.filter(k => (buf[k] ?? 0) < 0.01);
  return { busy: isLinked(g, b) && !waits.length && b.stock < capOf(b), waits };
}
