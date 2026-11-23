import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadGame, trackChanged } from '../src/game.ts';
import zlib from 'node:zlib';
import { deserialize } from '../src/save/save.ts';
import { isRevealed } from '../src/world/fog.ts';
import { tickSweeps } from '../src/world/landfall.ts';
import { reachedIslands } from '../src/progress/missions.ts';

const SAVES = ['tests/saves/save-seb-2026-11-16i.json', 'tests/saves/save-seb-2026-11-21-report20.txt'];
const read = (f: string) => { const t = fs.readFileSync(f, 'utf8').trim(); return deserialize(t.startsWith('RAILHAVEN3:') ? zlib.gunzipSync(Buffer.from(t.slice(11), 'base64')).toString('utf8') : t); };

describe('🏕 landing crews map the whole island the railway reaches', () => {
  for (const f of SAVES) it(`every island reached is fully mapped a few minutes after loading ${f.split('/').pop()}`, () => {
    const g = loadGame(read(f)), n = g.world.n;
    const fogged = (k: number) => { let c = 0; for (let i = 0; i < n * n; i++) if (g.world.islandOf[i] === k && !isRevealed(g, i)) c++; return c; };
    const isl = [...reachedIslands(g)].filter(k => k !== g.world.home);
    expect(isl.some(k => fogged(k) > 0)).toBe(true); // before: far sides of islands in the fog
    expect(g.s.sweeps?.length).toBeGreaterThan(0);
    for (let s = 0; s < 240 * 4; s++) tickSweeps(g, 0.25);
    for (const k of isl) expect(fogged(k), g.world.islands[k]?.name).toBe(0);
    expect(g.s.sweeps).toHaveLength(0);
    expect(g.news?.some(m => m.includes("mapped"))).toBe(true);
    trackChanged(g); expect(g.s.sweeps).toHaveLength(0); // mapped islands don't start again
  });

  it('Ashford Isle is still explored by track: no crew there', () => {
    const g = loadGame(read(SAVES[0]!));
    expect(g.s.sweeps?.some(s => s.isl === g.world.home)).toBe(false);
  });
});
