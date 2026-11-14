/** Map squares are addressed by index i = y * n + x. Directions: 0 east, 1 south, 2 west, 3 north. */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;
export const opposite = (d: Dir): Dir => ((d + 2) & 3) as Dir;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];

export interface Grid { readonly n: number }
export const idx = (g: Grid, x: number, y: number) => y * g.n + x;
export const xOf = (g: Grid, i: number) => i % g.n;
export const yOf = (g: Grid, i: number) => (i / g.n) | 0;
export const inside = (g: Grid, x: number, y: number) => x >= 0 && y >= 0 && x < g.n && y < g.n;
export function step(g: Grid, i: number, d: Dir): number {
  const x = xOf(g, i) + DX[d], y = yOf(g, i) + DY[d];
  return inside(g, x, y) ? idx(g, x, y) : -1;
}
/** Direction from square a to its 4-neighbour b, or -1. */
export function dirTo(g: Grid, a: number, b: number): Dir | -1 {
  const dx = xOf(g, b) - xOf(g, a), dy = yOf(g, b) - yOf(g, a);
  for (const d of DIRS) if (DX[d] === dx && DY[d] === dy) return d;
  return -1;
}
