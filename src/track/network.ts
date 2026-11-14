import { DX, DY, type Dir, opposite } from '../core/grid.ts';
import { TILE } from '../world/terrain.ts';
import { cumulative, nodeKey, sampleArc, sampleCubic, type V2 } from './geometry.ts';
import type { NodeKey, Piece, Step, TrackMap } from './types.ts';

/** Lane offset from the centre line on double track (old game: two-rail lanes ±8 px). */
export const LANE = 8;

export interface NetworkOptions {
  /** squares that must not be part of a wide curve (station halls, yards) */
  noWide?: (i: number) => boolean;
  /** squares that count as double even without the flag (station halls) */
  forceDouble?: (i: number) => boolean;
}

/** The rail network built from painted squares. Rebuilt whenever track changes. */
export interface Network {
  n: number;
  pieces: Piece[];
  /** pieces leaving each node: the step to take and its heading */
  outs: Map<NodeKey, { step: Step; hx: number; hy: number }[]>;
  /** pieces on each square */
  bySquare: Map<number, number[]>;
  /** pieces that physically overlap each piece (crossings, turnouts), not counting itself */
  conflicts: number[][];
  /** a train may wait on this piece while another passes beside it (double track, platforms, yard tracks) */
  passing: boolean[];
  /** which side of its square's centre line a piece runs, seen travelling a→b: 1 left lane, -1 right lane, 0 middle */
  side: number[];
}

const bit = (d: Dir) => 1 << d;
const sides = (m: number): Dir[] => ([0, 1, 2, 3] as Dir[]).filter(d => m & bit(d));

export function buildNetwork(track: TrackMap, n: number, opt: NetworkOptions = {}): Network {
  const T = TILE, pieces: Piece[] = [];
  const nb = (i: number, d: Dir) => { const x = (i % n) + DX[d], y = ((i / n) | 0) + DY[d]; return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x; };
  const isDbl = (i: number) => !!track.get(i)?.dbl || !!opt.forceDouble?.(i);
  /** sides actually joined: both squares agree */
  const links = (i: number) => {
    const sq = track.get(i); if (!sq) return 0;
    let m = 0;
    for (const d of sides(sq.links)) { const j = nb(i, d); const o = j >= 0 ? track.get(j) : undefined; if (o && o.links & bit(opposite(d))) m |= bit(d); }
    return m;
  };
  const laneOffsets = (i: number, d: Dir): number[] => { const j = nb(i, d); return isDbl(i) && j >= 0 && isDbl(j) ? [-LANE, LANE] : [0]; };
  const centre = (i: number): V2 => [((i % n) + 0.5) * T, (((i / n) | 0) + 0.5) * T];
  /** point on side d of square i, offset across the track by o */
  const port = (i: number, d: Dir, o: number): V2 => {
    const [cx, cy] = centre(i), mx = cx + (DX[d] * T) / 2, my = cy + (DY[d] * T) / 2;
    return DX[d] !== 0 ? [mx, my + o] : [mx + o, my];
  };

  const add = (pts: number[], squares: number[], kind: Piece['kind'], ta: V2, tb: V2, endB = false) => {
    const P = Float64Array.from(pts), cum = cumulative(P), k = pts.length;
    pieces.push({ id: pieces.length, pts: P, cum, len: cum[cum.length - 1]!, a: nodeKey(pts[0]!, pts[1]!), b: nodeKey(pts[k - 2]!, pts[k - 1]!),
      ta, tb, squares, kind, ...(endB ? { endB: true } : {}) });
  };

  // 1. wide curves: a clean corner with plain straights on both legs becomes one smooth arc over three squares
  const consumed = new Set<number>();
  const keys = [...track.keys()].sort((a, b) => a - b);
  for (const c of keys) {
    if (consumed.has(c) || opt.noWide?.(c)) continue;
    const m = links(c), s = sides(m);
    if (s.length !== 2 || s[0]! === opposite(s[1]!)) continue;
    const [a, b] = s as [Dir, Dir], A = nb(c, a), B = nb(c, b);
    if (A < 0 || B < 0 || consumed.has(A) || consumed.has(B) || opt.noWide?.(A) || opt.noWide?.(B)) continue;
    if (links(A) !== (bit(a) | bit(opposite(a))) || links(B) !== (bit(b) | bit(opposite(b)))) continue;
    const lanes = laneOffsets(c, a);
    // the inner lane of a double curve cuts the inside corner square, which must be free of track
    const diag = nb(A, b);
    if (lanes.length > 1 && (diag < 0 || track.has(diag) || opt.noWide?.(diag))) continue;
    if (laneOffsets(c, b).length !== lanes.length || laneOffsets(A, a).length !== lanes.length || laneOffsets(B, b).length !== lanes.length) continue;
    consumed.add(c).add(A).add(B);
    const [ox, oy] = centre(c), R = 1.5 * T, kx = ox + R * (DX[a] + DX[b]), ky = oy + R * (DY[a] + DY[b]);
    for (const o of lanes) {
      // the lane at A's far side whose distance from the arc centre is R + o' (inner or outer)
      const pa = port(A, a, o), r = Math.hypot(pa[0] - kx, pa[1] - ky);
      const pb = [port(B, b, -LANE), port(B, b, 0), port(B, b, LANE)].find(p => Math.abs(Math.hypot(p[0] - kx, p[1] - ky) - r) < 0.5)!;
      let a0 = Math.atan2(pa[1] - ky, pa[0] - kx), a1 = Math.atan2(pb[1] - ky, pb[0] - kx);
      while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
      while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
      const pts = sampleArc(kx, ky, r, a0, a1, 24);
      pts[0] = pa[0]; pts[1] = pa[1]; pts[pts.length - 2] = pb[0]; pts[pts.length - 1] = pb[1];
      add(pts, lanes.length > 1 ? [A, c, B, diag] : [A, c, B], 'wide', [-DX[a], -DY[a]], [DX[b], DY[b]]);
    }
  }

  // 2. every other square: one piece per lane for every pair of joined sides
  for (const i of keys) {
    if (consumed.has(i)) continue;
    const s = sides(links(i));
    if (s.length === 1) { // dead end: a short stub to a buffer stop at the centre
      const d = s[0]!, [cx, cy] = centre(i);
      for (const o of laneOffsets(i, d)) {
        const p = port(i, d, o), q: V2 = DX[d] !== 0 ? [cx, cy + o] : [cx + o, cy];
        add([p[0], p[1], q[0], q[1]], [i], 'straight', [-DX[d], -DY[d]], [-DX[d], -DY[d]], true);
      }
      continue;
    }
    for (let u = 0; u < s.length; u++) for (let v = u + 1; v < s.length; v++) {
      const d1 = s[u]!, d2 = s[v]!, straight = d1 === opposite(d2);
      const L1 = laneOffsets(i, d1).map(o => port(i, d1, o)), L2 = laneOffsets(i, d2).map(o => port(i, d2, o));
      const t0: V2 = [-DX[d1], -DY[d1]], t1: V2 = [DX[d2], DY[d2]];
      const pairs: [V2, V2][] = [];
      if (L1.length === L2.length) {
        if (straight) for (let k = 0; k < L1.length; k++) pairs.push([L1[k]!, L2[k]!]);
        else {
          const [cx, cy] = centre(i), kx = cx + (T / 2) * (DX[d1] + DX[d2]), ky = cy + (T / 2) * (DY[d1] + DY[d2]);
          const byDist = (L: V2[]) => [...L].sort((p, q) => Math.hypot(p[0] - kx, p[1] - ky) - Math.hypot(q[0] - kx, q[1] - ky));
          const A1 = byDist(L1), A2 = byDist(L2);
          for (let k = 0; k < A1.length; k++) pairs.push([A1[k]!, A2[k]!]);
        }
      } else for (const p of L1) for (const q of L2) pairs.push([p, q]); // single meets double: a turnout fanning to both lanes
      for (const [p, q] of pairs) {
        let kind: Piece['kind'], k: number;
        if (straight) { const shift = Math.abs(DX[d1] !== 0 ? p[1] - q[1] : p[0] - q[0]); kind = shift > 0.1 ? 'fan' : 'straight'; k = shift > 0.1 ? 0.45 * T : T / 3; }
        else {
          const [cx, cy] = centre(i), kx = cx + (T / 2) * (DX[d1] + DX[d2]), ky = cy + (T / 2) * (DY[d1] + DY[d2]);
          const r = (Math.hypot(p[0] - kx, p[1] - ky) + Math.hypot(q[0] - kx, q[1] - ky)) / 2;
          kind = L1.length !== L2.length ? 'fan' : 'curve'; k = 0.5523 * r;
        }
        const pts = kind === 'straight' ? [p[0], p[1], q[0], q[1]]
          : sampleCubic(p, [p[0] + t0[0] * k, p[1] + t0[1] * k], [q[0] - t1[0] * k, q[1] - t1[1] * k], q, 12);
        add(pts, [i], kind, t0, t1);
      }
    }
  }

  // 3. connections and overlaps
  const outs = new Map<NodeKey, { step: Step; hx: number; hy: number }[]>();
  const push = (k: NodeKey, v: { step: Step; hx: number; hy: number }) => { const a = outs.get(k); if (a) a.push(v); else outs.set(k, [v]); };
  const bySquare = new Map<number, number[]>();
  for (const p of pieces) {
    push(p.a, { step: { piece: p.id, dir: 1 }, hx: p.ta[0], hy: p.ta[1] });
    if (!p.endB) push(p.b, { step: { piece: p.id, dir: -1 }, hx: -p.tb[0], hy: -p.tb[1] });
    for (const s of p.squares) { const a = bySquare.get(s); if (a) a.push(p.id); else bySquare.set(s, [p.id]); }
  }
  const conflicts: number[][] = pieces.map(() => []);
  const near = (p: Piece, q: Piece) => {
    for (let i = 0; i < p.pts.length; i += 2) for (let j = 0; j < q.pts.length; j += 2)
      if (Math.hypot(p.pts[i]! - q.pts[j]!, p.pts[i + 1]! - q.pts[j + 1]!) < 9) return true;
    // straight pieces have only two points: check their midpoints too
    const pm = mid(p), qm = mid(q);
    return Math.hypot(pm[0] - qm[0], pm[1] - qm[1]) < 9;
  };
  for (const [, ids] of bySquare) for (const a of ids) for (const b of ids)
    if (a < b && !conflicts[a]!.includes(b) && near(pieces[a]!, pieces[b]!)) { conflicts[a]!.push(b); conflicts[b]!.push(a); }
  // a train can wait here while another passes: a parallel lane runs beside it (double track, station or yard tracks)
  const passing = pieces.map(p => p.kind !== 'fan' && p.squares.every(sq => net_bySq(bySquare, sq).some(o => o !== p.id && !conflicts[p.id]!.includes(o) && pieces[o]!.kind !== 'fan')));
  const side = pieces.map(p => {
    // offset of the lane from the middle of the square edge it starts on, seen along the direction of travel
    const at = (x: number, y: number): V2 => Math.abs(x / T - Math.round(x / T)) < 1e-6 ? [x, (Math.floor(y / T) + 0.5) * T] : [(Math.floor(x / T) + 0.5) * T, y];
    for (const [x, y, t] of [[p.pts[0]!, p.pts[1]!, p.ta], [p.pts[p.pts.length - 2]!, p.pts[p.pts.length - 1]!, p.tb]] as [number, number, V2][]) {
      const m = at(x, y), ox = x - m[0], oy = y - m[1];
      if (Math.hypot(ox, oy) < 1) continue;
      return Math.sign(t[0] * oy - t[1] * ox);
    }
    return 0;
  });
  return { n, pieces, outs, bySquare, conflicts, passing, side };
}

const net_bySq = (m: Map<number, number[]>, sq: number) => m.get(sq) ?? [];

function mid(p: Piece): V2 {
  const h = p.len / 2; let i = 1;
  while (i < p.cum.length - 1 && p.cum[i]! < h) i++;
  const f = (h - p.cum[i - 1]!) / ((p.cum[i]! - p.cum[i - 1]!) || 1);
  return [p.pts[i * 2 - 2]! + (p.pts[i * 2]! - p.pts[i * 2 - 2]!) * f, p.pts[i * 2 - 1]! + (p.pts[i * 2 + 1]! - p.pts[i * 2 - 1]!) * f];
}

/** Heading when leaving a step's piece at its far end. */
export function exitHeading(net: Network, s: Step): V2 {
  const p = net.pieces[s.piece]!;
  return s.dir === 1 ? p.tb : [-p.ta[0], -p.ta[1]];
}
export const exitNode = (net: Network, s: Step): NodeKey => (s.dir === 1 ? net.pieces[s.piece]!.b : net.pieces[s.piece]!.a);
export const entryNode = (net: Network, s: Step): NodeKey => (s.dir === 1 ? net.pieces[s.piece]!.a : net.pieces[s.piece]!.b);
/** True if the step ends at a buffer stop. */
export const endsAtBuffer = (net: Network, s: Step) => s.dir === 1 && !!net.pieces[s.piece]!.endB;

/** Steps that continue smoothly from the end of `s` (same heading, no turning back). */
export function nextSteps(net: Network, s: Step): Step[] {
  if (endsAtBuffer(net, s)) return [];
  const [hx, hy] = exitHeading(net, s), list = net.outs.get(exitNode(net, s)) ?? [];
  return list.filter(o => o.step.piece !== s.piece && o.hx * hx + o.hy * hy > 0.7).map(o => o.step);
}
