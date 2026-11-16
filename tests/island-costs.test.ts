import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { newGame, loadGame } from '../src/game.ts';
import { INDUSTRIES, priceOf, ramp, type Building } from '../src/buildings/industries.ts';
import { buyFleet, capOf, fleetIsl, fleetIsls, fleetLvl, trainCap } from '../src/economy/upgrades.ts';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { foundPrice, FOUND_PRICE, foundTown } from '../src/economy/towns.ts';
import { shipPrice, SHIP_PRICE } from '../src/ships/ships.ts';
import type { GameState } from '../src/state.ts';

/** a fake building of a kind on an island: the first land square of that island, as its yard start */
function fakeOn(g: ReturnType<typeof newGame>, kind: Building['kind'], isl: number, id: number): Building {
  const n = g.world.n, i = g.world.islandOf.findIndex((k, j) => k === isl && j % n < n - 5);
  return { id, kind, x: i % n, y: (i / n) | 0, horizontal: true, side: 1, lvl: 1, stock: 0 } as unknown as Building;
}

describe('costs per island', () => {
  it('a building costs 25% more for each of its kind on the same island, 5% for each elsewhere', () => {
    const g = newGame(4242), home = g.world.home;
    const other = g.world.islands.findIndex((x, k) => k !== home && x?.name);
    expect(other).toBeGreaterThanOrEqual(0);
    const base = INDUSTRIES.wood.price;
    expect(priceOf(g, 'wood', home)).toBe(base);
    g.s.buildings = [fakeOn(g, 'wood', home, 1), fakeOn(g, 'wood', home, 2)];
    expect(priceOf(g, 'wood', home)).toBe(ramp(base, 2, 0));
    expect(priceOf(g, 'wood', other)).toBe(ramp(base, 0, 2));
    expect(priceOf(g, 'wood', other)).toBeLessThan(priceOf(g, 'wood', home));
    // 20 camps spread over 5 islands stay affordable on a fresh island
    expect(ramp(base, 0, 20)).toBeLessThan(base * 3);
  });

  it('founding towns and buying ships get dearer the more you have', () => {
    const g = newGame(4242);
    const plots = g.s.sites.filter(s => s.kind === 'plot');
    expect(foundPrice(g, plots[0]!)).toBe(FOUND_PRICE);
    g.s.money = 1e6; expect(foundTown(g, plots[0]!)).toBe('');
    const sameIsl = plots.slice(1).find(p => g.world.islandOf[p.y * g.world.n + p.x] === g.world.islandOf[plots[0]!.y * g.world.n + plots[0]!.x]);
    if (sameIsl) expect(foundPrice(g, sameIsl)).toBe(Math.round(FOUND_PRICE * 1.25 / 50) * 50);
    expect(shipPrice(g)).toBe(SHIP_PRICE);
    g.s.ships = [{}, {}, {}] as never;
    expect(shipPrice(g)).toBe(SHIP_PRICE + 1000);
  });
});

describe('fleet upgrades per island', () => {
  it('an upgrade bought for one island leaves the others as they are', async () => {
    const o: any = await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8'));
    const { g } = importLegacy(o), home = g.world.home;
    const away = g.s.trains.find(t => fleetIsl(g, t) !== home)!, here = g.s.trains.find(t => fleetIsl(g, t) === home)!;
    expect(away && here).toBeTruthy();
    const k = fleetIsl(g, away), lvHome = fleetLvl(g, 'wag', home), lvAway = fleetLvl(g, 'wag', k);
    g.s.money = 1e6;
    expect(buyFleet(g, 'wag', k)).toBe('');
    expect(fleetLvl(g, 'wag', k)).toBe(lvAway + 1);
    expect(fleetLvl(g, 'wag', home)).toBe(lvHome);
    expect(capOf(g, away)).toBe(trainCap(g, k));
    expect(capOf(g, here)).toBe(trainCap(g, home));
    expect(fleetIsls(g)).toContain(k);
  });

  it('older saves keep what they bought on every island already reached; new islands start plain', () => {
    const g0 = newGame(4242), s = JSON.parse(JSON.stringify(g0.s)) as GameState;
    s.fleet = { wag: 2, eng: 1 };
    const g = loadGame(s), home = g.world.home;
    expect(fleetLvl(g, 'wag', home)).toBe(2); expect(fleetLvl(g, 'eng', home)).toBe(1);
    expect(g.s.fleet).toBeUndefined();
    const other = g.world.islands.findIndex((x, k) => k !== home && x?.name);
    expect(fleetLvl(g, 'wag', other)).toBe(0);
  });
});
