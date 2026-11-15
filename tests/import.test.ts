import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy, isLegacy } from '../src/save/legacy.ts';
import { townLinked, tickTowns } from '../src/economy/towns.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { serialize, deserialize } from '../src/save/save.ts';
import { loadGame, prepareSave } from '../src/game.ts';

const read = (f: string) => fs.readFileSync('tests/saves/' + f, 'utf8');

describe('bringing old games over', () => {
  it('reads a RAILHAVEN2 code and a JSON save', async () => {
    const a = await decodeLegacy(read('railhaven-save-v278.txt')), b = await decodeLegacy(read('save-seb-2026-11-10c.json'));
    expect(isLegacy(a)).toBe(true); expect(isLegacy(b)).toBe(true);
    await expect(decodeLegacy('hello')).rejects.toThrow(/not a Railhaven save/);
  });

  it("Sébastien's 2026-11-10 game: towns, track, buildings and trains come over and the game runs", async () => {
    const o = await decodeLegacy(read('save-seb-2026-11-10c.json'));
    const { g, report } = importLegacy(o);
    expect(g.s.sites[0]!.name).toBe('Ashford');
    expect(g.s.sites.filter(s => s.kind === 'town').length).toBe(o.sites.filter((s: any) => s.type === 'town').length);
    expect(townLinked(g, g.s.sites[0]!)).toBe(true);
    expect(g.s.sites.filter(s => s.kind === 'town' && townLinked(g, s)).length).toBeGreaterThanOrEqual(8);
    expect((g.s.buildings ?? []).length).toBeGreaterThanOrEqual(15);
    expect(g.s.trains.length).toBe(o.trains.length);
    expect(g.s.orders).toBe(o.stats.orders);
    expect(g.s.money).toBeGreaterThanOrEqual(o.money); // what didn't fit is paid back
    expect(report.join(' ')).toMatch(/Railway level/);
    const e0 = g.s.earned ?? 0;
    for (let k = 0; k < 20 * 60; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
    expect((g.s.earned ?? 0) - e0).toBeGreaterThan(0);
    // and it saves and loads like any rebuild game
    prepareSave(g); const h = loadGame(deserialize(serialize(g.s)));
    expect(h.s.trains.length).toBe(g.s.trains.length); expect(h.track.size).toBe(g.track.size);
  }, 60000);
});
