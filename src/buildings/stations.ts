import { DX, DY, type Dir } from '../core/grid.ts';
import type { Site } from '../state.ts';
import type { TrackMap } from '../track/types.ts';

/**
 * Station halls. Every town with track on its square (or a straight line right beside it, running past or ending
 * there) has a hall three
 * squares long, centred there, lying along the line. Inside the hall the line is two platform tracks; the turnouts sit on the
 * square just outside each end. Track may enter a hall only at its two ends.
 */
export interface Hall {
  town: Site;
  /** the middle hall square: the town square, or the square beside it where a line runs past */
  cx: number; cy: number;
  /** true when the line runs east-west */
  horizontal: boolean;
  /** the three hall squares, west/north end first */
  squares: [number, number, number];
  /** the square just past each end (where the platform tracks join the line) */
  approaches: [number, number];
}

const bit = (d: Dir) => 1 << d;

/**
 * The hall of a town, or null while no track reaches it. Track on the town square makes the hall there. A straight
 * line running right past the town (on a square beside it, three squares straight) is a station too, so a line laid
 * beside a town serves it without a detour.
 */
export function hallOf(track: TrackMap, n: number, town: Site, terr: Uint8Array): Hall | null {
  if (town.kind !== 'town') return null;
  const dry = (h: Hall) => h.squares.every(i => terr[i] !== 0); // platforms stand on land, never on a bridge
  const c = town.y * n + town.x, sq = track.get(c);
  if (sq) {
    const horizontal = (sq.links & (bit(0) | bit(2))) !== 0 || (sq.links & (bit(1) | bit(3))) === 0;
    return make(n, town, town.x, town.y, horizontal);
  }
  for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const horizontal = oy !== 0, along = horizontal ? bit(0) | bit(2) : bit(1) | bit(3);
    const cx = town.x + ox, cy = town.y + oy, [dx, dy] = horizontal ? [1, 0] : [0, 1];
    const ok = [-1, 0, 1].every(k => track.get((cy + dy * k) * n + cx + dx * k)?.links === along);
    if (ok) { const h = make(n, town, cx, cy, horizontal); if (dry(h)) return h; }
  }
  // a line that ends right beside the town (a mountain or the sea in the way, or just the end of a branch): a dead-end
  // station, its platforms running back along the line from the square beside the town
  for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const horizontal = oy !== 0, along = horizontal ? bit(0) | bit(2) : bit(1) | bit(3);
    const ex = town.x + ox, ey = town.y + oy, [dx, dy] = horizontal ? [1, 0] : [0, 1];
    for (const s of [1, -1] as const) { // the line comes in from this side (+1: from east/south) and stops at (ex, ey)
      const at = (k: number) => track.get((ey + dy * k * s) * n + ex + dx * k * s)?.links;
      const inward = bit((horizontal ? (s === 1 ? 0 : 2) : (s === 1 ? 1 : 3)) as Dir);
      if (at(0) !== inward || at(1) !== along || at(2) !== along) continue;
      const h = make(n, town, ex + dx * s, ey + dy * s, horizontal); if (dry(h)) return h;
    }
  }
  // a line that comes straight at the town and stops on the square in front of it: a dead-end station on that line
  for (const [ox, oy, away] of [[1, 0, 0], [0, 1, 1], [-1, 0, 2], [0, -1, 3]] as const) {
    const along = ox ? bit(0) | bit(2) : bit(1) | bit(3);
    const at = (k: number) => track.get((town.y + oy * k) * n + town.x + ox * k)?.links;
    if (at(1) !== bit(away as Dir) || at(2) !== along || at(3) !== along) continue;
    const h = make(n, town, town.x + ox * 2, town.y + oy * 2, ox !== 0); if (dry(h)) return h;
  }
  return null;
}

function make(n: number, town: Site, cx: number, cy: number, horizontal: boolean): Hall {
  const [dx, dy] = horizontal ? [1, 0] : [0, 1];
  const at = (k: number) => (cy + dy * k) * n + cx + dx * k;
  return { town, horizontal, cx, cy, squares: [at(-1), at(0), at(1)], approaches: [at(-2), at(2)] };
}

export function hallsOf(track: TrackMap, n: number, sites: Site[], terr: Uint8Array): Hall[] {
  const out: Hall[] = [];
  for (const s of sites) { const h = hallOf(track, n, s, terr); if (h) out.push(h); }
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
export function stationLinkError(track: TrackMap, n: number, sites: Site[], a: number, b: number, terr: Uint8Array): string {
  const ax = a % n, ay = (a / n) | 0, bx = b % n, by = (b / n) | 0, horizontalLink = ay === by;
  for (const s of sites) {
    if (s.kind !== 'town' || Math.abs(s.x - ax) > 2 || Math.abs(s.y - ay) > 2) continue;
    const c = s.y * n + s.x, cur = track.get(c);
    // the hall's direction: as built, or set by this link when it is the first track on the town square
    let horizontal: boolean, hx = s.x, hy = s.y;
    const h = hallOf(track, n, s, terr);
    if (h) { horizontal = h.horizontal; hx = h.cx; hy = h.cy; }
    else if (a === c || b === c) horizontal = horizontalLink;
    else continue;
    const inHall = (x: number, y: number) => horizontal ? y === hy && Math.abs(x - hx) <= 1 : x === hx && Math.abs(y - hy) <= 1;
    const side = `Track can only enter ${s.name} station at its two ends, not from the side: the arrows show where`;
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
