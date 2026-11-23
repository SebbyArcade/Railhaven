import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game.ts';
import { clearPockets, isRevealed, reveal } from '../src/world/fog.ts';

describe('fog pockets inside track loops clear by themselves', () => {
  const hide = (g: ReturnType<typeof newGame>, i: number) => { g.s.fog[i >> 3]! &= ~(1 << (i & 7)); };
  it('a 2 x 10 strip of fog with explored land all round clears (his loop by Gullhaven)', () => {
    const g = newGame(4242), n = g.world.n, cx = g.world.cx, cy = g.world.cy;
    reveal(g, cx, cy, 14); g.linked = new Set([cy * n + cx]);
    const strip: number[] = []; for (let y = cy - 5; y < cy + 5; y++) for (let x = cx + 2; x < cx + 4; x++) strip.push(y * n + x);
    strip.forEach(i => hide(g, i));
    expect(clearPockets(g)).toBe(20);
    for (const i of strip) expect(isRevealed(g, i)).toBe(1);
  });
  it('the open fog edge and big fog areas stay', () => {
    const g = newGame(4242), n = g.world.n; g.linked = new Set([g.world.cy * n + g.world.cx]);
    const before = g.s.fog.slice(); clearPockets(g);
    expect([...g.s.fog]).toEqual([...before]);
  });
  it('a pocket on an island your railway has not reached stays hidden', () => {
    const g = newGame(4242), n = g.world.n, cx = g.world.cx, cy = g.world.cy;
    reveal(g, cx, cy, 14); g.linked = new Set(); // no track anywhere
    const i = cy * n + cx + 3; hide(g, i);
    expect(clearPockets(g)).toBe(0);
  });
});
