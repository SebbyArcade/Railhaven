import { describe, expect, it } from 'vitest';
import { footprint } from '../src/buildings/industries.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { buyShip, shipPlace, type CargoShip } from '../src/ships/ships.ts';
import { Tools } from '../src/ui/tools.ts';
import { dockAndLanding } from './sea.ts';

// he asked (2026-11-16): ships glide in alongside the pier instead of driving into the dock and jumping beside it
describe('ships at the berth', () => {
  it('a ship never jumps or spins: arriving, tying up and pulling away are smooth', () => {
    const { g, dock, landing } = dockAndLanding(4242);
    dock.outq = [{ good: 'wood', n: 40, to: landing.id }];
    const s = buyShip(g, dock) as CargoShip;
    let prev = shipPlace(g, s), maxStep = 0, maxTurn = 0, sailed = false, back = false;
    for (let k = 0; k < 20 * 600 && !back; k++) {
      tickTrains(g, 0.05);
      const p = shipPlace(g, s);
      maxStep = Math.max(maxStep, Math.hypot(p.x - prev.x, p.y - prev.y));
      maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(p.a - prev.a), Math.cos(p.a - prev.a))));
      prev = p;
      if (s.to !== undefined) sailed = true;
      if (sailed && s.to === undefined && s.at === landing.id && landing.landed?.wood) { // tied up: now send it home again
        for (let j = 0; j < 20 * 400 && s.at !== dock.id; j++) { tickTrains(g, 0.05); const q = shipPlace(g, s); maxStep = Math.max(maxStep, Math.hypot(q.x - prev.x, q.y - prev.y)); maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(q.a - prev.a), Math.cos(q.a - prev.a)))); prev = q; }
        back = true;
      }
    }
    expect(sailed).toBe(true);
    expect(maxStep).toBeLessThan(0.2); // squares per 1/20 s: no jumps
    expect(maxTurn).toBeLessThan(0.35); // no sudden spins (a path corner turns by at most 45°, spread over the curve)
  });

  it('a tap on the dock opens the dock, even with a ship moored right beside it', () => {
    const { g, dock } = dockAndLanding(4242), n = g.world.n;
    buyShip(g, dock);
    const tools = new Tools(() => g);
    for (const i of footprint(n, dock)) expect(tools.tapWorld((i % n + 0.5) * 32, (((i / n) | 0) + 0.5) * 32)).toBe(false);
    const p = shipPlace(g, g.s.ships![0]!);
    expect(tools.tapWorld((p.x + 0.5) * 32, (p.y + 0.5) * 32)).toBe(footprint(n, dock).includes(Math.floor(p.y + 0.5) * n + Math.floor(p.x + 0.5)) ? false : true);
  });
});
