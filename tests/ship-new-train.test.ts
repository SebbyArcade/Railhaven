import { describe, expect, it } from 'vitest';
import { buyTrainAt, FERRY_FEE, headSquare, islandOfTrain, sellTrain, shipNewWhy, tickTrains, trainPrice } from '../src/economy/dispatch.ts';
import { yardSquares } from '../src/buildings/industries.ts';
import { islandOfB } from '../src/ships/docks.ts';
import { dockAndLanding } from './sea.ts';
import type { Game } from '../src/state.ts';

const tick = (g: Game, dt = 0.1) => { g.s.t += dt; g.sys.tick(dt); tickTrains(g, dt); };

// Sébastien 2026-11-16: "When in select ship new train to add to an island, trains should have to leave the engine
// shed then travel to a dock (closest) to get shipped via ship."
describe('⛴ a new train for another island runs to the dock and sails over', () => {
  it('leaves the engine shed, runs on the rails to the dock, goes aboard a boat and lands on the island', () => {
    const { g, dock, landing } = dockAndLanding(4242), n = g.world.n;
    expect(shipNewWhy(g, landing)).toBe('');
    const m0 = g.s.money, price = trainPrice(g) + FERRY_FEE;
    const t = buyTrainAt(g, landing); if (typeof t === 'string') throw new Error(t);
    expect(g.s.money).toBeCloseTo(m0 - price);
    expect(islandOfTrain(g, t)).toBe(g.world.home); // it starts at the engine shed, not on the landing
    expect(t.ferry?.to).toBe(landing.id);
    let atDock = false, aboard = false, landed = false;
    for (let k = 0; k < 6000 && !landed; k++) {
      tick(g);
      const on = g.s.trains.find(x => x.id === t.id);
      if (on && on.ferry && yardSquares(n, dock).includes(headSquare(g, on))) atDock = true;
      if (g.s.ferries?.some(f => f.train === t.id)) { aboard = true; expect(g.s.trains.some(x => x.id === t.id)).toBe(false); expect(trainPrice(g)).toBe(price - FERRY_FEE); }
      if (on && !on.ferry && islandOfTrain(g, on) === islandOfB(g, landing)) landed = true;
    }
    expect(atDock).toBe(true);
    expect(aboard).toBe(true);
    expect(landed).toBe(true);
    expect(g.s.ferries ?? []).toHaveLength(0);
    expect(g.s.money).toBeLessThanOrEqual(m0 - price); // running costs on the way, no refund
  });

  it('with no dock joined to the engine shed by rail, it says why and charges nothing', () => {
    const { g, dock, landing } = dockAndLanding(4242);
    // the home dock leaves the railway: the landing stays reached (it was charted), but no dock can take a train
    g.s.buildings = g.s.buildings!.filter(b => b !== dock); g.linked = new Set([...g.linked!].filter(i => !yardSquares(g.world.n, dock).includes(i)));
    g.linked = new Set([...g.linked, ...yardSquares(g.world.n, landing)]);
    const m0 = g.s.money, why = shipNewWhy(g, landing);
    expect(why).toMatch(/Dock on Ashford Isle/);
    expect(buyTrainAt(g, landing)).toBe(why);
    expect(g.s.money).toBe(m0);
  });

  it('selling it before it boards pays the crossing back too', () => {
    const { g, landing } = dockAndLanding(4242);
    const t = buyTrainAt(g, landing); if (typeof t === 'string') throw new Error(t);
    const m0 = g.s.money;
    expect(sellTrain(g, t)).toBe('');
    expect(g.s.money).toBeGreaterThan(m0 + FERRY_FEE);
  });
});
