import type { Game } from '../state.ts';

export const isRevealed = (g: Game, i: number) => (g.s.fog[i >> 3]! >> (i & 7)) & 1;

/** Has the player uncovered this island's middle? (Island centres are fractional: round them, or the check lands on some other square.) */
export const islandKnown = (g: Game, k: number) => {
  const o = g.world.islands[k], n = g.world.n; if (!o) return false;
  const x = Math.round(o.cx), y = Math.round(o.cy);
  return x >= 0 && y >= 0 && x < n && y < n && !!isRevealed(g, y * n + x);
};

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

/** Fog pockets up to this many squares, with explored land all round them, clear by themselves. */
export const POCKET_MAX = 80;

/**
 * Clear small fog pockets the railway has wrapped round (Sébastien, 2026-11-22: the middle of a wide track loop
 * stayed fogged, since track clears only 3 squares each side). A pocket clears only if every square bordering it is
 * explored and none of it touches the map edge, so the open frontier is never uncovered. Returns squares cleared.
 */
export function clearPockets(g: Game): number {
  const n = g.world.n, seen = new Uint8Array(n * n); let cleared = 0;
  const railed = new Set<number>(); for (const i of g.linked ?? []) railed.add(g.world.islandOf[i]!); // islands with your track on them
  for (let i0 = 0; i0 < n * n; i0++) {
    if (seen[i0] || isRevealed(g, i0)) continue;
    const q = [i0], part: number[] = []; seen[i0] = 1; let open = false;
    while (q.length) {
      const i = q.pop()!; part.push(i);
      const x = i % n, y = (i / n) | 0;
      if (x === 0 || y === 0 || x === n - 1 || y === n - 1) open = true;
      if (part.length > POCKET_MAX) open = true;
      const k = g.world.islandOf[i]!; if (k >= 0 && !railed.has(k)) open = true; // land of an island you haven't reached stays hidden
      for (const j of [i - 1, i + 1, i - n, i + n]) {
        if (j < 0 || j >= n * n || (Math.abs((j % n) - x) > 1) || seen[j] || isRevealed(g, j)) continue;
        seen[j] = 1; q.push(j);
      }
    }
    if (open) continue;
    for (const i of part) { g.s.fog[i >> 3]! |= 1 << (i & 7); cleared++; }
  }
  return cleared;
}
