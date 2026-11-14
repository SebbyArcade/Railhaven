import { DX, DY, type Dir, opposite } from '../core/grid.ts';
import type { TrackMap } from './types.ts';

/** Join two 4-neighbour squares with track (adds them if new). */
export function linkSquares(track: TrackMap, n: number, a: number, b: number): boolean {
  const ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0;
  let d: Dir | -1 = -1;
  for (const k of [0, 1, 2, 3] as Dir[]) if (ax + DX[k] === bx && ay + DY[k] === by) d = k;
  if (d < 0) return false;
  const dd = d as Dir;
  const sa = track.get(a) ?? { links: 0 }, sb = track.get(b) ?? { links: 0 };
  sa.links |= 1 << dd; sb.links |= 1 << opposite(dd);
  track.set(a, sa); track.set(b, sb);
  return true;
}

/** Remove a square and every link into it. */
export function removeSquare(track: TrackMap, n: number, i: number) {
  const sq = track.get(i); if (!sq) return;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    if (!(sq.links & (1 << d))) continue;
    const x = (i % n) + DX[d], y = ((i / n) | 0) + DY[d], j = y * n + x, o = track.get(j);
    if (o) { o.links &= ~(1 << opposite(d)); if (!o.links) track.delete(j); }
  }
  track.delete(i);
}

/** Lay a path of 4-neighbour squares as one connected line. */
export function layPath(track: TrackMap, n: number, path: number[]) {
  for (let k = 1; k < path.length; k++) linkSquares(track, n, path[k - 1]!, path[k]!);
}

/** Old saves: every two neighbouring track squares are joined. */
export function linkByAdjacency(squares: Iterable<number>, n: number): TrackMap {
  const set = new Set(squares), track: TrackMap = new Map();
  for (const i of set) {
    const x = i % n, y = (i / n) | 0;
    if (x + 1 < n && set.has(i + 1)) linkSquares(track, n, i, i + 1);
    if (y + 1 < n && set.has(i + n)) linkSquares(track, n, i, i + n);
  }
  return track;
}
