import type { Game } from '../state.ts';

export const isRevealed = (g: Game, i: number) => (g.s.fog[i >> 3]! >> (i & 7)) & 1;

/** Reveal a disc of squares. Returns how many were new. */
export function reveal(g: Game, x: number, y: number, r: number): number {
  const n = g.world.n; let fresh = 0;
  for (let j = Math.floor(y - r); j <= y + r; j++) for (let i = Math.floor(x - r); i <= x + r; i++) {
    if (i < 0 || j < 0 || i >= n || j >= n || Math.hypot(i - x, j - y) > r + 0.3) continue;
    const k = j * n + i;
    if (!isRevealed(g, k)) { g.s.fog[k >> 3]! |= 1 << (k & 7); fresh++; }
  }
  return fresh;
}

export const emptyFog = (n: number) => new Uint8Array(Math.ceil((n * n) / 8));
