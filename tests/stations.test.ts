import { describe, expect, it } from 'vitest';
import { doubleSquares, hallOf, hallsOf, stationLinkError } from '../src/buildings/stations.ts';
import { layPath } from '../src/track/edit.ts';
import { buildNetwork } from '../src/track/network.ts';
import type { TrackMap } from '../src/track/types.ts';
import type { Site } from '../src/state.ts';

const N = 40, sq = (x: number, y: number) => y * N + x;
const town: Site = { id: 1, kind: 'town', x: 10, y: 10, name: 'Brinemoor', pop: 120 };
const line = (pts: [number, number][]) => { const out: number[] = []; for (let k = 0; k < pts.length - 1; k++) { let [x, y] = pts[k]!; const [tx, ty] = pts[k + 1]!; while (x !== tx || y !== ty) { out.push(sq(x, y)); if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); } } out.push(sq(...pts.at(-1)!)); return out; };

describe('station halls', () => {
  it('lie along the line through the town, three squares long', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 10], [15, 10]]));
    const h = hallOf(t, N, town)!;
    expect(h.horizontal).toBe(true);
    expect(h.squares).toEqual([sq(9, 10), sq(10, 10), sq(11, 10)]);
  });

  it('refuse track joining from the long side, with the reason', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[5, 10], [15, 10]]));
    expect(stationLinkError(t, N, [town], sq(11, 11), sq(11, 10))).toMatch(/only enter Brinemoor station at its two ends/);
    expect(stationLinkError(t, N, [town], sq(10, 9), sq(10, 10))).not.toBe('');
    // past the end is fine
    expect(stationLinkError(t, N, [town], sq(12, 11), sq(12, 10))).toBe('');
  });

  it('the first track into the town decides the direction; a crossing line beside it blocks that', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[11, 5], [11, 15]])); // passes just east of the town
    expect(stationLinkError(t, N, [town], sq(11, 10), sq(10, 10))).not.toBe(''); // the hall would sit across it
    expect(stationLinkError(t, N, [town], sq(10, 9), sq(10, 10))).toBe(''); // from the north: hall runs north-south
  });

  it('run as two platform tracks where trains can stand side by side', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[4, 10], [16, 10]]));
    const dbl = doubleSquares(t, hallsOf(t, N, [town]));
    expect([...dbl].sort((a, b) => a - b)).toEqual([sq(8, 10), sq(9, 10), sq(10, 10), sq(11, 10), sq(12, 10)]);
    const net = buildNetwork(t, N, { forceDouble: i => dbl.has(i) });
    const atTown = net.bySquare.get(sq(10, 10))!;
    expect(atTown.length).toBe(2);
    for (const id of atTown) expect(net.passing[id]).toBe(true);
  });

  it('a line ending right beside the town is a dead-end station (Brinemoor under the mountain)', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[9, 16], [9, 10]])); // up the west side, ends beside the town
    const h = hallOf(t, N, town)!;
    expect(h).not.toBeNull();
    expect(h.horizontal).toBe(false);
    expect(h.squares).toEqual([sq(9, 10), sq(9, 11), sq(9, 12)]);
    // two platform tracks with buffer stops at the town end
    const dbl = doubleSquares(t, hallsOf(t, N, [town]));
    const net = buildNetwork(t, N, { forceDouble: i => dbl.has(i) });
    expect(net.bySquare.get(sq(9, 10))!.length).toBe(2);
    // turning into the town from its side is still refused, with the reason
    expect(stationLinkError(t, N, [town], sq(9, 10), sq(10, 10))).toMatch(/two ends/);
    // ending one square short of the town is not a station
    const u: TrackMap = new Map(); layPath(u, N, line([[9, 16], [9, 11]]));
    expect(hallOf(u, N, town)).toBeNull(); // (9, 11) only touches the town's corner
  });

  it('a line coming straight at the town and ending in front of it is a dead-end station', () => {
    const t: TrackMap = new Map(); layPath(t, N, line([[16, 10], [11, 10]])); // from the east, stops beside the town
    const h = hallOf(t, N, town)!;
    expect(h).not.toBeNull();
    expect(h.horizontal).toBe(true);
    expect(h.squares).toEqual([sq(11, 10), sq(12, 10), sq(13, 10)]);
    expect(h.approaches).toEqual([sq(10, 10), sq(14, 10)]); // it can still run on into the town later
  });
});
