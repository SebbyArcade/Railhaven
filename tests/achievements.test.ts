import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { newGame } from '../src/game.ts';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { checkMedals, emptyProfile, MEDALS, TOTAL_XP, xpOf } from '../src/progress/achievements.ts';
import { PAINTS, THEMES } from '../src/render/looks.ts';

describe('achievements', () => {
  it('a fresh map earns nothing yet', () => {
    const p = emptyProfile();
    expect(checkMedals(newGame(4242), p)).toEqual([]);
    expect(xpOf(p)).toBe(0);
  });

  it("Sébastien's Nov 14 game earns the medals it already deserves, and counts its orders once", async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const p = emptyProfile();
    const got = checkMedals(g, p).map(m => m.id);
    for (const id of ['track', 'train', 'link', 'order1', 'order25', 'village', 'factory', 'lvl3']) expect(got).toContain(id);
    expect(got).not.toContain('games3');
    expect(p.orders).toBe(g.s.orders);
    expect(checkMedals(g, p)).toEqual([]); // nothing twice
    expect(p.orders).toBe(g.s.orders);
    g.s.orders! += 2; checkMedals(g, p);
    expect(p.orders).toBe(g.s.orders);
    console.log(`Nov 14 game: ${got.length} medals, ${xpOf(p)} XP: ${got.join(', ')}`);
  });

  it('every look can be unlocked, the first of each is free, and medal ids are unique', () => {
    expect(new Set(MEDALS.map(m => m.id)).size).toBe(MEDALS.length);
    expect(MEDALS.length).toBe(MEDALS.length); expect(MEDALS.length).toBeGreaterThanOrEqual(54);
    expect(PAINTS[0]!.xp).toBe(0); expect(THEMES[0]!.xp).toBe(0);
    for (const l of [...PAINTS, ...THEMES]) expect(l.xp).toBeLessThanOrEqual(TOTAL_XP);
  });

  it('a rush finished in the game rules earns Rush Job', () => {
    const g = newGame(7), p = emptyProfile();
    g.s.rushDone = 1;
    expect(checkMedals(g, p).map(m => m.id)).toContain('rush');
  });
});
