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
});
