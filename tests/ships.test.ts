import { describe, expect, it } from 'vitest';
import { trackChanged } from '../src/game.ts';
import { build, placeError, placementsAt, yardSquares, type Building, type IndustryKind } from '../src/buildings/industries.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import { orderOf } from '../src/economy/towns.ts';
import { islandOfB } from '../src/ships/docks.ts';
import { buyShip, SHIP_CAP, seaLanes } from '../src/ships/ships.ts';
import type { Game } from '../src/state.ts';
import { dockAndLanding, linkB } from './sea.ts';
import { cardHtml } from '../src/ui/cards.ts';

/** Build a building of this kind on an island, as near to a spot as fits, and join it to the railway there. */
function buildNear(g: Game, kind: IndustryKind, isl: number, cx: number, cy: number): Building | null {
  const n = g.world.n, spots: { q: ReturnType<typeof placementsAt>[number]; d: number }[] = [];
  for (let y = cy - 25; y <= cy + 25; y++) for (let x = cx - 25; x <= cx + 25; x++) {
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) continue;
    for (const q of placementsAt(kind, x, y)) if (g.world.islandOf[yardSquares(n, q)[0]!] === isl && !placeError(g, q)) spots.push({ q, d: Math.hypot(x - cx, y - cy) });
  }
  spots.sort((p, q) => p.d - q.d);
  for (const s of spots.slice(0, 80)) {
    if (placeError(g, s.q)) continue;
    const b = build(g, s.q); if (typeof b === 'string') continue; trackChanged(g);
    if (linkB(g, b)) return b;
  }
  return null;
}

describe('cargo ships', () => {
  it('a ship carries goods waiting at a dock across to the landing', () => {
    const { g, dock, landing } = dockAndLanding(4242);
    expect(seaLanes(g).some(l => (l.a === dock.id && l.b === landing.id) || (l.b === dock.id && l.a === landing.id))).toBe(true);
    dock.outq = [{ good: 'wood', n: 40, to: landing.id }];
    const money = g.s.money, s = buyShip(g, dock);
    expect(typeof s).not.toBe('string');
    expect(g.s.money).toBe(money - 3000);
    let mid = '';
    for (let k = 0; k < 20 * 400 && !(landing.landed?.wood); k++) { tickTrains(g, 0.05); if (!mid && (s as { to?: number; hold: unknown[] }).to !== undefined) mid = cardHtml(g, { kind: 'ship', id: (s as { id: number }).id })!; }
    expect(mid).toContain('Sailing from');
    expect(mid).toContain('40 wood');
    expect(landing.landed?.wood).toBe(40);
    expect(dock.outq.length).toBe(0);
    // its card says where it is and what it carries
    const card = cardHtml(g, { kind: 'ship', id: (s as { id: number }).id })!;
    expect(card).toContain('Cargo ship 1');
    expect(card).toMatch(/At |Sailing from/);
    expect(SHIP_CAP).toBe(80);
  });

  it('goods only an island across the sea needs go to the dock, bound for the landing', () => {
    const { g, dock, landing } = dockAndLanding(4242), n = g.world.n;
    g.s.rlv = 3;
    const a = g.s.sites[0]!, ly = yardSquares(n, landing)[1]!;
    const camp = buildNear(g, 'wood', g.world.home, a.x, a.y);
    expect(camp).not.toBeNull(); if (!camp) return;
    const mill = buildNear(g, 'sawmill', islandOfB(g, landing), ly % n, (ly / n) | 0);
    expect(mill).not.toBeNull(); if (!mill) return;
    // a home order for wood comes first
    expect(shipPlan(g).get(camp.id)?.to).toEqual({ kind: 'town', id: a.id });
    // once home has all the wood it ordered, the camp ships to the mill over the sea
    a.got = { ...orderOf(g, a) };
    const ship = shipPlan(g).get(camp.id);
    expect(ship?.to).toEqual({ kind: 'bld', id: dock.id });
    expect(ship?.sea).toBe(landing.id);
    // landed wood at the landing goes on to the mill by that island's trains
    landing.landed = { wood: 30 };
    const on = shipPlan(g).docks.get(`${landing.id}/wood`);
    expect(on?.to).toEqual({ kind: 'bld', id: mill.id });
  });
});
