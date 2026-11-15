import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { readSave, saveCode, serialize } from '../src/save/save.ts';

describe('Move my game', () => {
  it('a save code and a save file bring the same game back', async () => {
    const g = newGame(4242); g.s.money = 12345;
    const code = await saveCode(g);
    expect(code.startsWith('RAILHAVEN3:')).toBe(true);
    const back = await readSave(code);
    expect(back?.s.money).toBe(12345);
    expect(serialize(back!.s)).toBe(serialize(g.s));
    const file = await readSave(serialize(g.s));
    expect(file?.s.seed).toBe(4242);
  });
  it('an old-game save is left for the importer', async () => {
    expect(await readSave('{"sites":[],"track":[1]}')).toBeNull();
    expect(await readSave('RAILHAVEN2:abc')).toBeNull();
  });
});
