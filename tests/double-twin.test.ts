import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Game } from '../src/state.ts';
import { loadFrom } from '../src/save/save.ts';
import { yardSquares } from '../src/buildings/industries.ts';
import { hallsOf } from '../src/buildings/stations.ts';
import { Tools } from '../src/ui/tools.ts';

(globalThis as any).document ??= { getElementById: () => ({ style: {}, classList: { add() {}, remove() {} } }) };
(globalThis as any).window ??= { setTimeout: () => 0 };

const live = () => { const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16d.json', 'utf8'); return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game; };

describe('═ Double on stations and buildings', () => {
  it('skips platform and loading-track squares: they already have two tracks, so they cost nothing and add nothing', () => {
    const g = live(), n = g.world.n, tools = new Tools(() => g);
    const farm = g.s.buildings!.find(b => b.kind === 'farm' && yardSquares(n, b).every(i => g.track.has(i)))!;
    expect(farm).toBeTruthy();
    const yard = yardSquares(n, farm);
    for (const i of yard) expect(g.net.twin!.has(i)).toBe(true);
    tools.mode = 'double';
    tools.dragStart(yard[0]!); for (const i of yard.slice(1)) tools.dragOver(i);
    expect(tools.dbl.size).toBe(0);
    expect(tools.bar()).toBe(null); // no "Double 5 squares · $200" for nothing
    // a station platform is skipped the same way
    const hall = hallsOf(g.track, n, g.s.sites, g.world.terr)[0]!;
    tools.dragStart(hall.squares[0]!);
    expect(tools.dbl.size).toBe(0);
    // plain single track still doubles and is charged
    const plain = [...g.track].find(([i, s]) => !s.dbl && !g.net.twin!.has(i))![0];
    tools.dragStart(plain);
    expect(tools.bar()!.text).toMatch(/^Double 1 square · /);
  });
});
