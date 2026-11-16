import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { bringTrainFrom, cancelMove, islandOfTrain, tickTrains, trainIslands, FERRY_FEE } from '../src/economy/dispatch.ts';
import { isDock, islandOfB } from '../src/ships/docks.ts';
import { isLinked } from '../src/buildings/industries.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';

const load = async () => importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')) as any).g;

// Sébastien 2026-11-16: "I should always be able to transfer a train from a different island and select which island.
// The train would transfer once finished its delivery."
describe('⛴ bring a train from another island', () => {
  it('lists every other island with trains, and a busy train is booked and crosses after its delivery', async () => {
    const g = await load(), n0 = g.s.trains.length;
    const dock = g.s.buildings!.find(b => isDock(b) && isLinked(g, b) && islandOfB(g, b) === g.world.home)!;
    const isls = trainIslands(g, dock);
    expect(isls.length).toBeGreaterThan(0);
    const from = isls[0]!.island;
    // make every train on that island busy: give each a load to deliver
    for (const t of g.s.trains.filter(t => islandOfTrain(g, t) === from)) {
      t.cargo = { good: 'wood', n: 10, d: 5 } as any;
      t.job = { src: g.s.buildings![0]!.id, to: { kind: 'town', id: g.s.sites[0]!.id }, good: 'wood', phase: 'toDrop', timer: 0 };
    }
    const m0 = g.s.money;
    expect(bringTrainFrom(g, dock, from)).toBe('later');
    expect(g.s.money).toBeCloseTo(m0 - FERRY_FEE);
    const t = g.s.trains.find(x => x.moveTo === dock.id)!;
    expect(t).toBeTruthy();
    for (let k = 0; k < 40; k++) { g.s.t += 0.05; g.sys.tick(0.05); tickTrains(g, 0.05); }
    expect(islandOfTrain(g, g.s.trains.find(x => x.id === t.id)!)).toBe(from); // still busy: it waits
    // it delivers: nothing aboard any more, the job is done
    delete t.cargo; delete t.job;
    for (let k = 0; k < 40; k++) { g.s.t += 0.05; g.sys.tick(0.05); tickProduction(g, 0.05); tickTowns(g, 0.05); tickTrains(g, 0.05); }
    const moved = g.s.trains.find(x => x.id === t.id)!;
    expect(islandOfTrain(g, moved)).toBe(islandOfB(g, dock));
    expect(moved.moveTo).toBeUndefined();
    expect(g.s.trains.length).toBe(n0);
  });

  it('a booking can be cancelled for the fee back', async () => {
    const g = await load();
    const dock = g.s.buildings!.find(b => isDock(b) && isLinked(g, b) && islandOfB(g, b) === g.world.home)!;
    const from = trainIslands(g, dock)[0]!.island;
    for (const t of g.s.trains.filter(t => islandOfTrain(g, t) === from)) t.cargo = { good: 'wood', n: 10, d: 5 } as any;
    const m0 = g.s.money;
    expect(bringTrainFrom(g, dock, from)).toBe('later');
    cancelMove(g, g.s.trains.find(x => x.moveTo === dock.id)!);
    expect(g.s.money).toBeCloseTo(m0);
    expect(g.s.trains.some(x => x.moveTo !== undefined)).toBe(false);
  });
});
