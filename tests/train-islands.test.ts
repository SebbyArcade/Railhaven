import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { headSquare, islandOfTrain, shipTrainTo, spareTrains, FERRY_FEE } from '../src/economy/dispatch.ts';
import { jams, JAM_AFTER } from '../src/economy/jams.ts';
import { isDock, islandOfB } from '../src/ships/docks.ts';
import { isLinked } from '../src/buildings/industries.ts';
import { stuckList } from '../src/ui/orders.ts';

const load = async () => { const o: any = await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')); return { o, g: importLegacy(o).g }; };

describe('trains and islands', () => {
  it('imported trains go back to the island they were on in the old game (not 15 on one small island)', async () => {
    const { o, g } = await load(), n = g.world.n;
    const count = (ks: number[]) => { const m = new Map<number, number>(); for (const k of ks) m.set(k, (m.get(k) ?? 0) + 1); return m; };
    const old = count(o.trains.map((t: any) => { const p = t.path[Math.min(Math.floor(t.pos), t.path.length - 1)]; return g.world.islandOf[p[1] * n + p[0]]!; }));
    const now = count(g.s.trains.map(t => islandOfTrain(g, t)));
    expect(g.s.trains.length).toBe(o.trains.length);
    for (const [k, v] of old) expect(now.get(k)).toBe(v);
  });

  it('a train with no work on another island can be shipped over to a dock, for the crossing fee', async () => {
    const { g } = await load();
    const dock = g.s.buildings!.find(b => isDock(b) && isLinked(g, b) && islandOfB(g, b) === g.world.home)!;
    const spare = spareTrains(g, dock);
    expect(spare.length).toBeGreaterThan(0);
    expect(spare.every(t => islandOfTrain(g, t) !== g.world.home)).toBe(true);
    const id = spare[0]!.id, m0 = g.s.money, n0 = g.s.trains.length;
    const t = shipTrainTo(g, dock);
    expect(typeof t).not.toBe('string');
    expect(g.s.trains.length).toBe(n0); // the same train, moved
    const moved = g.s.trains.find(x => x.id === id)!;
    expect(islandOfTrain(g, moved)).toBe(g.world.home);
    expect(g.world.islandOf[headSquare(g, moved)]).toBe(islandOfB(g, dock));
    expect(g.s.money).toBeCloseTo(m0 - FERRY_FEE);
  });

  it('trains held up for long show as a 🚦 jam with what to do', async () => {
    const { g } = await load();
    expect(jams(g)).toEqual([]);
    const t = g.s.trains.find(x => islandOfTrain(g, x) === g.world.home)!;
    // pretend it waits on its way somewhere along the line ahead
    const next = g.net.pieces.findIndex(p => p.squares.some(i => g.track.has(i) && !g.track.get(i)!.dbl) && p.squares.every(i => g.world.islandOf[i] === g.world.home));
    t.job = { src: g.s.buildings![0]!.id, to: { kind: 'town', id: g.s.sites[0]!.id }, good: 'wood', phase: 'toLoad', timer: 0 };
    t.plan = [{ piece: next, dir: 1 }]; t.stopT = JAM_AFTER + 1;
    const j = jams(g);
    expect(j.length).toBe(1);
    expect(j[0]!.trains).toEqual([t]);
    expect(stuckList(g).some(s => s.icon === '🚦' && /held up near/.test(s.text))).toBe(true);
  });
});
