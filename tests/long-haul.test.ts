import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { seaPaths } from '../src/economy/trade.ts';
import { islandOfB, linkedDocks } from '../src/ships/docks.ts';
import { lanesFrom, seaBound, tickShips } from '../src/ships/ships.ts';
import type { Game } from '../src/state.ts';

const his = async () => importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8'))).g as Game;

describe('🚢 long-haul imports: goods two sea routes away', () => {
  it('on his save some islands are only reachable over two sea routes, by way of a dock in between', async () => {
    const g = await his(), home = g.world.home;
    const one = new Set<number>();
    for (const d of linkedDocks(g)) if (islandOfB(g, d) === home) for (const r of lanesFrom(g, d.id)) one.add(islandOfB(g, g.s.buildings!.find(b => b.id === r.id)!));
    const all = seaPaths(g, home);
    for (const k of one) expect(all.has(k)).toBe(true);
    // an island two routes from some island: its route passes three docks
    const two = [...new Set(linkedDocks(g).map(d => islandOfB(g, d)))].some(k => [...seaPaths(g, k).values()].some(s => s.size >= 3));
    expect(two).toBe(true);
  });

  it('a ship landing goods that go one route further leaves them on the quay for the next ship, and they still count as on their way', async () => {
    const g = await his();
    // a dock with a route on to another dock
    const mid = linkedDocks(g).find(d => lanesFrom(g, d.id).length >= 2)!;
    const c = lanesFrom(g, mid.id)[1];
    mid.outq = []; mid.landed = {};
    g.s.ships = [{ id: 999, at: mid.id, pos: 0, wait: 0, hold: [{ good: 'iron', n: 30, to: mid.id, then: c!.id }, { good: 'coal', n: 20, to: mid.id }] }];
    tickShips(g, 0.1);
    expect(mid.landed!.coal).toBe(20); // for this island's trains
    expect(mid.landed!.iron ?? 0).toBe(0);
    expect(mid.outq!.find(q => q.good === 'iron' && q.to === c!.id)?.n).toBeGreaterThanOrEqual(0); // queued for the next ship (it may load at once)
    expect(seaBound(g, c!.id, 'iron')).toBe(30); // waiting or aboard, still bound for the far dock
  });
});
