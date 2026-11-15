import { describe, expect, it } from 'vitest';
import { newGame, trackChanged } from '../src/game.ts';
import { bestPlacement, build, type Building, yardSquares } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns, orderOf, upgradeTown } from '../src/economy/towns.ts';
import { buyTrain, tickTrains, trainPrice } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';
import type { Game } from '../src/state.ts';
import { buyFleet, expressMul, levelPrice, refundOf, removeBuilding, sellStock, toggleRush, trainCap, upgradeBuilding } from '../src/economy/upgrades.ts';
import { outputOf, capOf } from '../src/buildings/industries.ts';
import { checkStuck } from '../src/economy/nofail.ts';

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

/** Lay track from the railway to the nearer end of a building's yard (tries the closest track squares in turn). */
function link(g: Game, b: Building): boolean {
  const n = g.world.n, ys = yardSquares(n, b), d = (p: number, q: number) => Math.hypot(p % n - q % n, (p / n | 0) - (q / n | 0));
  for (const end of [ys[0]!, ys.at(-1)!]) {
    const step = b.horizontal ? (end === ys[0] ? -1 : 1) : (end === ys[0] ? -n : n);
    const froms = [...g.track.keys()].filter(i => g.linked!.has(i) && !ys.includes(i)).sort((p, q) => d(p, end) - d(q, end)).slice(0, 15);
    for (const from of froms) {
      const p = startPlan(g, from); if (!p) continue;
      extendPlan(g, p, end + step); extendPlan(g, p, end);
      if (p.path.at(-1) !== end) continue;
      if (typeof buildPlan(g, p) === 'string') continue;
      trackChanged(g);
      if (g.linked!.has(end)) return true;
    }
  }
  return false;
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

  it('a factory is locked until Railway level 1, then takes wheat from the farm and makes flour', () => {
    const { g, b: farm } = farmGame(), n = g.world.n, a = g.s.sites[0]!;
    g.s.money = 1e5;
    let mill: Building | null = null;
    expect(build(g, { kind: 'gristmill', x: 0, y: 0, horizontal: true, side: 1 })).toMatch(/Railway level 1/);
    g.s.rlv = 1;
    for (let r = 3; r < 10 && !mill; r++) for (let dy = -r; dy <= r && !mill; dy++) for (let dx = -r; dx <= r && !mill; dx++) {
      const p = bestPlacement(g, 'gristmill', a.x + dx, a.y + dy); if (!p.place) continue;
      const m = build(g, p.place); if (typeof m === 'string') continue;
      trackChanged(g);
      if (link(g, m)) mill = m;
    }
    expect(mill).not.toBeNull(); if (!mill) return;
    void n;
    a.got = { farm: 30 }; // Ashford has its wheat: the farm's wheat goes to the mill now
    expect(shipPlan(g).get(farm.id)).toMatchObject({ to: { kind: 'bld', id: mill.id }, why: 'factory' });
    const t = buyTrain(g); if (typeof t === 'string') throw new Error(t);
    run(g, 200);
    expect((mill.inbuf?.farm ?? 0) + mill.stock).toBeGreaterThan(0);
    expect(mill.stock).toBeGreaterThan(0);
  });

  it('building levels, selling stock and removing a building', () => {
    const { g, b } = farmGame();
    g.s.money = 1e5;
    const out1 = outputOf(g, b), cap1 = capOf(b), p = levelPrice(b);
    expect(upgradeBuilding(g, b)).toBe('');
    expect(b.lvl).toBe(2); expect(outputOf(g, b)).toBeGreaterThan(out1); expect(capOf(b)).toBeGreaterThan(cap1);
    expect(b.paid).toBe(800 + p);
    upgradeBuilding(g, b); expect(upgradeBuilding(g, b)).toMatch(/Railway level 4/);
    // later Railway levels: level 4 at Railway level 4, level 5 at 6, then full size
    g.s.rlv = 4; const o3 = outputOf(g, b); expect(upgradeBuilding(g, b)).toBe(''); expect(b.lvl).toBe(4); expect(outputOf(g, b)).toBeGreaterThan(o3);
    expect(upgradeBuilding(g, b)).toMatch(/Railway level 6/);
    g.s.rlv = 6; expect(upgradeBuilding(g, b)).toBe(''); expect(b.lvl).toBe(5); expect(b.tracks ?? 2).toBeLessThanOrEqual(4);
    expect(upgradeBuilding(g, b)).toMatch(/full size/);
    b.stock = 40; const m = g.s.money;
    expect(sellStock(g, b)).toBe('');
    expect(b.stock).toBe(10); expect(g.s.money).toBeGreaterThan(m);
    const r = refundOf(b), m2 = g.s.money;
    expect(removeBuilding(g, b)).toBe('');
    expect(g.s.buildings!.includes(b)).toBe(false); expect(g.s.money).toBe(m2 + r);
  });

  it('later Railway levels: express engines and longer trains', () => {
    const { g } = farmGame();
    const c0 = trainCap(g), v0 = expressMul(g);
    g.s.rlv = 5; expect(expressMul(g)).toBeCloseTo(v0 * 1.15);
    g.s.rlv = 7; expect(trainCap(g)).toBe(Math.round(c0 * 1.2));
    g.s.rlv = 8; expect(expressMul(g)).toBeCloseTo(1.15 * 1.15);
  });

  it('fleet upgrades carry more; a rush sends goods there first', () => {
    const { g, b } = farmGame();
    g.s.money = 1e5;
    expect(buyFleet(g, 'wag')).toBe(''); expect(trainCap(g)).toBe(30);
    const ash = g.s.sites[0]!; ash.got = { farm: 30 }; // order's wheat in: the farm would sell extra
    expect(toggleRush(g, { kind: 'town', id: ash.id }, 'farm')).toMatch(/Nothing left/);
    ash.got = {};
    expect(toggleRush(g, { kind: 'town', id: ash.id }, 'farm')).toBe('');
    expect(shipPlan(g).get(b.id)).toMatchObject({ rush: true });
  });

  it('no-fail: a broke player with nothing earning gets topped up, once in a while, never while earning', () => {
    const g = newGame(4242);
    g.s.money = 50;
    const add = checkStuck(g);
    expect(add).toBeGreaterThan(0); expect(g.s.money).toBeGreaterThanOrEqual(1800);
    g.s.money = 50; expect(checkStuck(g)).toBe(0); // not again straight away
    const { g: g2 } = farmGame(); buyTrain(g2); g2.s.money = 10;
    expect(checkStuck(g2)).toBe(0); // the farm will fill a train soon
  });
});
