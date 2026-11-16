import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assemble, loadGame } from '../src/game.ts';
import { deserialize } from '../src/save/save.ts';
import { BUILDING_REVEAL, placeError, revealAround, yardSquares } from '../src/buildings/industries.ts';
import { isRevealed } from '../src/world/fog.ts';

const SAVE = 'tests/saves/save-seb-2026-11-16g.json';
const read = () => deserialize(fs.readFileSync(SAVE, 'utf8'));
const fogCount = (f: Uint8Array) => f.reduce((a, v) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return a + c; }, 0);

describe('buildings uncover the land around their yards', () => {
  it('every square within reach of a yard is out of the fog after loading', () => {
    const g = loadGame(read()), n = g.world.n;
    for (const b of g.s.buildings ?? []) for (const i of yardSquares(n, b)) {
      const x = i % n, y = (i / n) | 0;
      for (let dy = -BUILDING_REVEAL; dy <= BUILDING_REVEAL; dy++) for (let dx = -BUILDING_REVEAL; dx <= BUILDING_REVEAL; dx++)
        if (Math.hypot(dx, dy) <= BUILDING_REVEAL) expect(isRevealed(g, (y + dy) * n + x + dx)).toBe(1);
    }
  });

  it("his Oil Well at the fog edge: the coast below it comes out of the fog, so a dock spot there gives a real reason, not 'fog'", () => {
    const s = read(); const old = (assemble as (s: unknown) => ReturnType<typeof loadGame>)(read());
    const g = loadGame(s);
    expect(fogCount(g.s.fog)).toBeGreaterThan(fogCount(old.s.fog));
    const p = { x: 29, y: 160, horizontal: true, side: 1 as const, kind: 'dock' as const, len: 3 };
    expect(placeError(old, p)).toMatch(/fog/);
    expect(placeError(g, p)).not.toMatch(/fog/);
    expect(isRevealed(g, 160 * g.world.n + 31)).toBe(1); // the square past the yard's end: track can go on from it
  });

  it('a building uncovers nothing new the second time', () => {
    const g = loadGame(read());
    for (const b of g.s.buildings ?? []) expect(revealAround(g, b)).toBe(0);
  });
});
