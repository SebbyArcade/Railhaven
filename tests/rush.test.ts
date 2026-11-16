import { describe, expect, it } from 'vitest';
import { trackChanged } from '../src/game.ts';
import { build, placeError, placementsAt, yardSquares, type Building, type IndustryKind } from '../src/buildings/industries.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import { RUSH_MIN, rushBySea, rushDelivered, rushFee, rushMore, rushOf, rushUnitPrice, startRush, stopRush } from '../src/economy/upgrades.ts';
import { islandOfB } from '../src/ships/docks.ts';
import { buyShip } from '../src/ships/ships.ts';
import type { Game } from '../src/state.ts';
import { ordersHtml, rushRoute } from '../src/ui/orders.ts';
import { dockAndLanding, linkB } from './sea.ts';

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

/** Ashford Isle with a lumber camp, and a sawmill on the island across the sea (only home makes wood). */
function campAndMill() {
  const { g, dock, landing } = dockAndLanding(4242), n = g.world.n;
  g.s.rlv = 3;
  const a = g.s.sites[0]!, ly = yardSquares(n, landing)[1]!;
  const camp = buildNear(g, 'wood', g.world.home, a.x, a.y)!;
  const mill = buildNear(g, 'sawmill', islandOfB(g, landing), ly % n, (ly / n) | 0)!;
  expect(camp).not.toBeNull(); expect(mill).not.toBeNull();
  return { g, dock, landing, camp, mill, a };
}

describe('⭐ rushes', () => {
  it('are paid up front, cost more the more run at once, and refund what is not delivered', () => {
    const { g, a, mill } = campAndMill();
    const town = { kind: 'town' as const, id: a.id }, fac = { kind: 'bld' as const, id: mill.id };
    a.got = {};
    // the first rush costs 30% of the normal pay ×1.25; at least $150
    const p1 = rushUnitPrice(g, town, 'wood'), f1 = rushFee(g, town, 'wood');
    expect(f1).toBeGreaterThanOrEqual(RUSH_MIN);
    const m0 = g.s.money;
    expect(startRush(g, town, 'wood')).toBe('');
    expect(g.s.money).toBe(m0 - f1);
    // the second one is dearer per unit (×1.5 instead of ×1.25), and ×1.5 again when it must come by ship
    expect(rushBySea(g, fac, 'wood')).toBe(true);
    expect(rushUnitPrice(g, fac, 'wood') / p1).toBeCloseTo(1.5 / 1.25 * 1.5, 5);
    const f2 = rushFee(g, fac, 'wood');
    expect(startRush(g, fac, 'wood')).toBe('');
    expect(g.s.money).toBe(m0 - f1 - f2);
    // ＋20 charges for 20 more at the price paid, −20 gives it back
    const r = rushOf(g, fac, 'wood')!, m1 = g.s.money;
    const c = rushMore(g, fac, 'wood', 20) as number;
    expect(c).toBeGreaterThan(0); expect(r.left).toBe(70); expect(g.s.money).toBe(m1 - c);
    expect(rushMore(g, fac, 'wood', -20)).toBe(-c); expect(r.left).toBe(50); expect(g.s.money).toBe(m1);
    // half delivered: stopping refunds the other half
    rushDelivered(g, fac, 'wood', 25);
    const m2 = g.s.money, back = stopRush(g, fac, 'wood');
    expect(Math.abs(back - f2 / 2)).toBeLessThanOrEqual(5);
    expect(g.s.money).toBe(m2 + back);
    expect(rushOf(g, fac, 'wood')).toBeUndefined();
    // not enough money: it says how much more
    g.s.money = 10;
    expect(startRush(g, fac, 'wood')).toMatch(/you need \$/);
  });

  it('a good made only on another island comes by ship first, and the ship sails at once', () => {
    const { g, dock, landing, camp, mill, a } = campAndMill();
    a.got = {};
    // without a rush, Ashford's own order for wood comes first
    expect(shipPlan(g).get(camp.id)?.to).toEqual({ kind: 'town', id: a.id });
    expect(startRush(g, { kind: 'bld', id: mill.id }, 'wood')).toBe('');
    const plan = shipPlan(g), s = plan.get(camp.id)!;
    expect(s).toMatchObject({ to: { kind: 'bld', id: dock.id }, sea: landing.id, rush: true });
    expect(rushRoute(g, g.s.rush![0]!, plan).text).toMatch(/comes by ship from/);
    expect(ordersHtml(g)).toContain('Rushes 1/3');
    // a small rushed load doesn't wait for a fuller hold
    dock.outq = [{ good: 'wood', n: 10, to: landing.id }];
    const ship = buyShip(g, dock); if (typeof ship === 'string') throw new Error(ship);
    for (let k = 0; k < 6 / 0.05 && ship.to === undefined; k++) tickTrains(g, 0.05);
    expect(ship.to).toBe(landing.id);
  });

  it('pays the normal price for rushed deliveries', () => {
    const { g, a } = campAndMill();
    a.got = {};
    expect(startRush(g, { kind: 'town', id: a.id }, 'wood')).toBe('');
    const r = rushOf(g, { kind: 'town', id: a.id }, 'wood')!;
    expect(rushDelivered(g, { kind: 'town', id: a.id }, 'wood', 5)).toBe(false);
    expect(r.left).toBeGreaterThan(0);
  });
});
