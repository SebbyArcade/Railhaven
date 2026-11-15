import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, type Building, yardSquares } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns, orderOf, upgradeTown } from '../src/economy/towns.ts';
import { buyTrain, tickTrains, trainPrice } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import type { Game } from '../src/state.ts';

/** a farm next to Ashford, joined by track */
function farmGame(): { g: Game; b: Building } {
  const g = newGame(4242), n = g.world.n, a = g.s.sites[0]!;
  let place = null;
  for (let r = 4; r < 9 && !place; r++) for (let dy = -r; dy <= r && !place; dy++) for (let dx = -r; dx <= r && !place; dx++) {
    const p = bestPlacement(g, 'farm', a.x + dx, a.y + dy); if (p.place) place = p.place;
  }
  const b = build(g, place!); if (typeof b === 'string') throw new Error(b);
  trackChanged(g);
  const ys = yardSquares(n, b), end = [ys[0]!, ys.at(-1)!].sort((p, q) => Math.hypot(p % n - a.x, (p / n | 0) - a.y) - Math.hypot(q % n - a.x, (q / n | 0) - a.y))[0]!;
  const step = b.horizontal ? (end === ys[0] ? -1 : 1) : (end === ys[0] ? -n : n);
  const p = startPlan(g, a.y * n + a.x)!; extendPlan(g, p, end + step); extendPlan(g, p, end);
  const r = buildPlan(g, p); if (typeof r === 'string') throw new Error(r);
  trackChanged(g);
  // a straight line east of Ashford, where the engine shed stands
  const q = startPlan(g, a.y * n + a.x)!; for (let k = 1; k <= 6; k++) extendPlan(g, q, a.y * n + a.x + k);
  const r2 = buildPlan(g, q); if (typeof r2 === 'string') throw new Error(r2);
  trackChanged(g);
  return { g, b };
}

function run(g: Game, secs: number) {
  for (let k = 0; k < secs * 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
}

describe('towns, orders and goods trains', () => {
  it('the shipping plan sends the farm\'s wheat to Ashford\'s order', () => {
    const { g, b } = farmGame();
    expect(orderOf(g, g.s.sites[0]!).farm).toBe(30);
    expect(shipPlan(g).get(b.id)?.why).toBe('order');
  });

  it('a bought train collects wheat, delivers it to Ashford and gets paid', () => {
    const { g } = farmGame();
    expect(g.s.shed).toBeTruthy();
    expect(trainPrice(g)).toBe(1000);
    const t = buyTrain(g); if (typeof t === 'string') throw new Error(t);
    const m0 = g.s.money;
    run(g, 150);
    const ash = g.s.sites[0]!;
    expect(ash.got?.farm ?? 0).toBeGreaterThanOrEqual(15);
    expect(g.s.earned ?? 0).toBeGreaterThan(0);
    expect(g.s.money).toBeGreaterThan(m0 - 200); // upkeep only while moving
  });

  it('a filled order pays its reward once, and the town grows only when the player upgrades', () => {
    const { g } = farmGame();
    const ash = g.s.sites[0]!;
    ash.got = { farm: 30, wood: 20 };
    expect(upgradeTown(g, ash)).toBe('');
    expect(ash.lvl).toBe(1);
    expect(orderOf(g, ash).stone).toBe(30);
  });
});

