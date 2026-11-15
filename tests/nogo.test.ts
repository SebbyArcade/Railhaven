import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { buildNoGo, railNoGo } from '../src/buildings/nogo.ts';
import { buildingSquares, isLinked, placeError, placementsAt, yardSquares } from '../src/buildings/industries.ts';
import { squareCost } from '../src/track/rules.ts';
import { isRevealed } from '../src/world/fog.ts';

describe('faint red no-go squares', () => {
  it('match the rules: rails never go where it is tinted, and only refused squares are tinted', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const n = g.world.n; let mountains = 0, grass = 0;
    for (let i = 0; i < n * n; i++) {
      if (!isRevealed(g, i) || g.track.has(i)) { expect(railNoGo(g, i)).toBe(false); continue; }
      const t = g.world.terr[i];
      if (t === 4) { expect(railNoGo(g, i)).toBe(true); mountains++; } // mountains block track (no tunnels yet)
      if (typeof squareCost(g, i) === 'string') expect(railNoGo(g, i)).toBe(true);
      if (t === 1 && !railNoGo(g, i)) grass++;
    }
    expect(mountains).toBeGreaterThan(0); expect(grass).toBeGreaterThan(0);
    const b = g.s.buildings!.find(x => x.kind !== 'dock' && isLinked(g, x))!;
    for (const i of buildingSquares(n, b)) expect(railNoGo(g, i)).toBe(true);
    for (const i of yardSquares(n, b)) expect(railNoGo(g, i)).toBe(false); // its yard is track
  });

  it('build mode: a building never fits over a tinted square', async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const n = g.world.n, a = g.s.sites[0]!;
    for (const k of ['wood', 'farm', 'stone', 'sawmill'] as const) {
      let fits = 0;
      for (let y = a.y - 12; y <= a.y + 12; y++) for (let x = a.x - 12; x <= a.x + 12; x++) for (const p of placementsAt(k, x, y)) {
        if (placeError(g, p)) continue; fits++;
        const sq = [...yardSquares(n, p), ...buildingSquares(n, p)];
        for (const i of sq) expect(buildNoGo(g, k, i), `${k} at ${x},${y}`).toBe(false);
      }
      if (k !== 'stone') expect(fits).toBeGreaterThan(0);
    }
  });
});
