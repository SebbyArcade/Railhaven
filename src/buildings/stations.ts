import { DX, DY, type Dir } from '../core/grid.ts';
import type { Site } from '../state.ts';
import type { TrackMap } from '../track/types.ts';

/**
 * Station halls. Every town with track on its square has a hall three squares long, centred on the town, lying
 * along the line that runs through it. Inside the hall the line is two platform tracks; the turnouts sit on the
 * square just outside each end. Track may enter a hall only at its two ends.
 */
export interface Hall {
  town: Site;
  /** true when the line runs east-west */
  horizontal: boolean;
  /** the three hall squares, west/north end first */
  squares: [number, number, number];
  /** the square just past each end (where the platform tracks join the line) */
  approaches: [number, number];
}

const bit = (d: Dir) => 1 << d;

/** The hall of a town, or null while no track reaches its square. */
export function hallOf(track: TrackMap, n: number, town: Site): Hall | null {
  if (town.kind !== 'town') return null;
  const c = town.y * n + town.x, sq = track.get(c);
  if (!sq) return null;
  const horizontal = (sq.links & (bit(0) | bit(2))) !== 0 || (sq.links & (bit(1) | bit(3))) === 0;
  const [dx, dy] = horizontal ? [1, 0] : [0, 1];
  const at = (k: number) => (town.y + dy * k) * n + town.x + dx * k;
  return { town, horizontal, squares: [at(-1), at(0), at(1)], approaches: [at(-2), at(2)] };
}

export function hallsOf(track: TrackMap, n: number, sites: Site[]): Hall[] {
  const out: Hall[] = [];
  for (const s of sites) { const h = hallOf(track, n, s); if (h) out.push(h); }
  return out;
}

/** Squares the network lays as double track (the hall, plus the approaches when they run straight on). */
export function doubleSquares(track: TrackMap, halls: Hall[]): Set<number> {
  const out = new Set<number>();
  for (const h of halls) {
    const along = h.horizontal ? bit(0) | bit(2) : bit(1) | bit(3);
    for (const i of h.squares) if (track.has(i)) out.add(i);
    for (const i of h.approaches) { const s = track.get(i); if (s && (s.links & ~along) === 0) out.add(i); }
  }
  return out;
}

/**
 * Why linking squares a and b (neighbours) would break a station, or ''. Track must not join a hall from its long
 * side, and a hall can't hold a junction.
 */
export function stationLinkError(track: TrackMap, n: number, sites: Site[], a: number, b: number): string {
  const ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0, horizontalLink = ay === by;
  for (const s of sites) {
    if (s.kind !== 'town' || Math.abs(s.x - ax) > 2 || Math.abs(s.y - ay) > 2) continue;
    const c = s.y * n + s.x, cur = track.get(c);
    // the hall's direction: as built, or set by this link when it is the first track on the town square
    let horizontal: boolean;
    if (cur) horizontal = hallOf(track, n, s)!.horizontal;
    else if (a === c || b === c) horizontal = horizontalLink;
    else continue;
    const inHall = (x: number, y: number) => horizontal ? y === s.y && Math.abs(x - s.x) <= 1 : x === s.x && Math.abs(y - s.y) <= 1;
    const side = `Track can only enter ${s.name} station at its two ends, not from the side`;
    if ((inHall(ax, ay) || inHall(bx, by)) && horizontalLink !== horizontal) return side;
    if (!cur) { // this link creates the hall: no track may already cross the squares it will cover
      const across = horizontal ? bit(1) | bit(3) : bit(0) | bit(2);
      for (const k of [-1, 1]) { const o = track.get(horizontal ? c + k : c + k * n); if (o && o.links & across) return side; }
    }
  }
  return '';
}

/** The hall a square belongs to (its track or platforms), if any. */
export function hallAt(halls: Hall[], i: number): Hall | undefined {
  return halls.find(h => h.squares.includes(i));
}

export const dirsAlong = (h: Hall): [Dir, Dir] => h.horizontal ? [0, 2] : [1, 3];
export { DX, DY };
