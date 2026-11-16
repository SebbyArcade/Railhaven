import { describe, expect, it } from 'vitest';
import { tickTrains } from '../src/economy/dispatch.ts';
import { buyShip, shipPlace, type CargoShip } from '../src/ships/ships.ts';
import type { Game } from '../src/state.ts';
import { dockAndLanding } from './sea.ts';

// he asked (2026-11-16): two ships moored at one dock lay on top of each other. Each now has its own berth.
/** Do two ships overlap? Hulls are about 1.4 squares long and 0.4 wide. */
function overlap(p: { x: number; y: number; a: number }, q: { x: number; y: number; a: number }): boolean {
  const dx = q.x - p.x, dy = q.y - p.y, ux = Math.cos(p.a), uy = Math.sin(p.a);
  const along = Math.abs(dx * ux + dy * uy), side = Math.abs(-dx * uy + dy * ux);
  const par = Math.abs(Math.sin(q.a - p.a)) < 0.2;
  return par ? along < 1.38 && side < 0.4 : Math.hypot(dx, dy) < 0.9;
}
const moored = (g: Game) => (g.s.ships ?? []).filter(s => s.to === undefined);

describe('ships parking at a dock', () => {
  it('ships at one dock each get their own berth: two along the pier, more at anchor, on the water', () => {
    const { g, dock } = dockAndLanding(4242), n = g.world.n;
    const ships = [1, 2, 3, 4, 5].map(() => buyShip(g, dock) as CargoShip);
    expect(new Set(ships.map(s => s.slot)).size).toBe(5);
    const at = ships.map(s => shipPlace(g, s));
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) expect(overlap(at[i]!, at[j]!), `ships ${i} and ${j}`).toBe(false);
    for (const p of at) expect(g.world.terr[Math.round(p.y) * n + Math.round(p.x)]).toBe(0);
  });

  it('busy sea routes: moored ships never overlap, nobody jumps when a berth frees up', () => {
    const { g, dock, landing } = dockAndLanding(4242);
    for (let k = 0; k < 4; k++) buyShip(g, dock);
    let maxStep = 0, clash = 0, sailed = 0;
    const prev = new Map<number, { x: number; y: number }>();
    for (let k = 0; k < 20 * 900; k++) {
      if (k % 200 === 0) { // keep goods coming both ways
        dock.outq = [{ good: 'wood', n: 60, to: landing.id }];
        landing.outq = [{ good: 'fish', n: 60, to: dock.id }];
      }
      tickTrains(g, 0.05);
      const ms = moored(g);
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (ms[i]!.at === ms[j]!.at && overlap(shipPlace(g, ms[i]!), shipPlace(g, ms[j]!))) clash++;
      for (const s of g.s.ships!) {
        const p = shipPlace(g, s), q = prev.get(s.id);
        if (q) maxStep = Math.max(maxStep, Math.hypot(p.x - q.x, p.y - q.y));
        prev.set(s.id, p); if (s.to !== undefined) sailed++;
      }
    }
    expect(sailed).toBeGreaterThan(0);
    expect(clash).toBe(0);
    expect(maxStep).toBeLessThan(0.2);
  });

  it('ships in older saves (no berth yet, or sharing one) are given their own', () => {
    const { g, dock } = dockAndLanding(4242);
    const a = buyShip(g, dock) as CargoShip, b = buyShip(g, dock) as CargoShip;
    a.slot = 0; b.slot = 0; delete (a as Partial<CargoShip>).slot;
    tickTrains(g, 0.05);
    expect(a.slot).not.toBe(b.slot);
    expect(overlap(shipPlace(g, a), shipPlace(g, b))).toBe(false);
  });
});
