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
  /** lane offsets on squares with more than two lanes side by side (yards with 3 or 4 loading tracks) */
  lanes?: (i: number) => number[] | undefined;
  /** squares where crossovers between the lanes may go even though they are kept free of wide curves (station halls and their approaches) */
  crossOk?: (i: number) => boolean;
  /** station approach squares: a crossover goes next to each, so trains that turn back in a station can reach their own lane */
  stationEnd?: (i: number) => boolean;
  /** dead ends in station halls and yards: the rails run on to the far edge of the square (the buffer stop stands
   *  there), so a whole train fits along the platform clear of the switch at the other end */
  stubToEdge?: (i: number) => boolean;
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
  /** squares that always have two tracks without being doubled (station platforms, building loading tracks and the
   *  squares just past their ends): doubling them would add nothing */
  twin?: Set<number>;
}

const bit = (d: Dir) => 1 << d;
const sides = (m: number): Dir[] => ([0, 1, 2, 3] as Dir[]).filter(d => m & bit(d));

export function buildNetwork(track: TrackMap, n: number, opt: NetworkOptions = {}): Network {
  const T = TILE, pieces: Piece[] = [];
  const nb = (i: number, d: Dir) => { const x = (i % n) + DX[d], y = ((i / n) | 0) + DY[d]; return x < 0 || y < 0 || x >= n || y >= n ? -1 : y * n + x; };
  const isDbl = (i: number) => !!track.get(i)?.dbl || !!opt.forceDouble?.(i);
  /** a flat crossing: the lines go straight over each other, no turning */
  const isCross = (i: number) => !!track.get(i)?.cross && links(i) === 15;
  /** sides actually joined: both squares agree */
  const links = (i: number) => {
    const sq = track.get(i); if (!sq) return 0;
    let m = 0;
    for (const d of sides(sq.links)) { const j = nb(i, d); const o = j >= 0 ? track.get(j) : undefined; if (o && o.links & bit(opposite(d))) m |= bit(d); }
    return m;
  };
  const lanesOf = (i: number): number[] => opt.lanes?.(i) ?? (isDbl(i) ? [-LANE, LANE] : [0]);
  const laneOffsets = (i: number, d: Dir): number[] => {
    const j = nb(i, d); if (j < 0) return [0];
    const a = lanesOf(i), b = lanesOf(j);
    if (a.length < 2 || b.length < 2) return [0];
    return a.length <= b.length ? a : b; // more lanes meet fewer: the side between them has the fewer
  };
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

  // 2. gentle turnouts: at a junction, a branch with plain single straights on both legs leaves the main line
  //    as a radius-1.5 arc that starts a square early, like a real turnout (the straight line stays as it is)
  const turned = new Set<string>(), dblTurn = new Set<Piece>();
  for (const c of keys) {
    if (consumed.has(c) || opt.noWide?.(c) || isCross(c)) continue;
    const s = sides(links(c));
    if (s.length < 3) continue;
    if (isDbl(c)) { // double main line, single branch: both lanes lead off to the branch (the far lane crosses the near one)
      for (const a of s) for (const b of s) {
        if (a === b || a === opposite(b) || !s.includes(opposite(a))) continue;
        const A = nb(c, a), B = nb(c, b);
        if (A < 0 || B < 0 || consumed.has(A) || consumed.has(B) || opt.noWide?.(A) || opt.noWide?.(B) || opt.noWide?.(nb(c, opposite(a)))) continue;
        if (links(A) !== (bit(a) | bit(opposite(a))) || links(B) !== (bit(b) | bit(opposite(b)))) continue;
        if (laneOffsets(c, a).length !== 2 || laneOffsets(A, a).length !== 2 || laneOffsets(c, b).length !== 1 || isDbl(B)) continue;
        const pb = port(B, b, 0), ta: V2 = [-DX[a], -DY[a]], tb: V2 = [DX[b], DY[b]];
        for (const o of [-LANE, LANE]) {
          const pa = port(A, a, o);
          // a quarter ellipse: 1.5 squares along the main line, across to the branch
          const L = Math.abs((pb[0] - pa[0]) * ta[0] + (pb[1] - pa[1]) * ta[1]), W = Math.abs((pb[0] - pa[0]) * tb[0] + (pb[1] - pa[1]) * tb[1]);
          const pts = sampleCubic(pa, [pa[0] + ta[0] * 0.5523 * L, pa[1] + ta[1] * 0.5523 * L], [pb[0] - tb[0] * 0.5523 * W, pb[1] - tb[1] * 0.5523 * W], pb, 24);
          add(pts, [A, c, B], 'wide', ta, tb);
          dblTurn.add(pieces.at(-1)!);
        }
        turned.add(c + ':' + Math.min(a, b) + ':' + Math.max(a, b));
      }
      continue;
    }
    for (const a of s) for (const b of s) {
      if (a >= b || a === opposite(b)) continue;
      const A = nb(c, a), B = nb(c, b);
      if (A < 0 || B < 0 || consumed.has(A) || consumed.has(B) || isDbl(A) || isDbl(B) || opt.noWide?.(A) || opt.noWide?.(B)) continue;
      if (links(A) !== (bit(a) | bit(opposite(a))) || links(B) !== (bit(b) | bit(opposite(b)))) continue;
      const [ox, oy] = centre(c), R = 1.5 * T, kx = ox + R * (DX[a] + DX[b]), ky = oy + R * (DY[a] + DY[b]);
      const pa = port(A, a, 0), pb = port(B, b, 0);
      let a0 = Math.atan2(pa[1] - ky, pa[0] - kx), a1 = Math.atan2(pb[1] - ky, pb[0] - kx);
      while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
      while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
      const pts = sampleArc(kx, ky, R, a0, a1, 24);
      pts[0] = pa[0]; pts[1] = pa[1]; pts[pts.length - 2] = pb[0]; pts[pts.length - 1] = pb[1];
      add(pts, [A, c, B], 'wide', [-DX[a], -DY[a]], [DX[b], DY[b]]);
      turned.add(c + ':' + a + ':' + b);
    }
  }

  // 3. every other square: one piece per lane for every pair of joined sides
  for (const i of keys) {
    if (consumed.has(i)) continue;
    const s = sides(links(i));
    if (s.length === 1) { // dead end: a short stub to a buffer stop at the centre
      const d = s[0]!, [c0, c1] = centre(i), far = opt.stubToEdge?.(i) ? T / 2 - 3 : 0;
      const cx = c0 - DX[d] * far, cy = c1 - DY[d] * far;
      for (const o of laneOffsets(i, d)) {
        const p = port(i, d, o), q: V2 = DX[d] !== 0 ? [cx, cy + o] : [cx + o, cy];
        add([p[0], p[1], q[0], q[1]], [i], 'straight', [-DX[d], -DY[d]], [-DX[d], -DY[d]], true);
      }
      continue;
    }
    const flat = isCross(i);
    for (let u = 0; u < s.length; u++) for (let v = u + 1; v < s.length; v++) {
      const d1 = s[u]!, d2 = s[v]!, straight = d1 === opposite(d2);
      if (flat && !straight) continue; // a crossing has only the two straight lines
      if (turned.has(i + ':' + Math.min(d1, d2) + ':' + Math.max(d1, d2))) continue;
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
      } else { // fewer lanes meet more: a turnout fanning each of the many to the nearest of the few
        const [few, many, flip] = L1.length < L2.length ? [L1, L2, false] : [L2, L1, true];
        const off = (p: V2) => DX[d1] !== 0 ? p[1] : p[0];
        for (const q of many) { const p = few.reduce((u, v) => Math.abs(off(v) - off(q)) < Math.abs(off(u) - off(q)) ? v : u); pairs.push(flip ? [q, p] : [p, q]); }
      }
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

  // 3b. crossovers on double track: two diagonals between the lanes over two squares, so a train that turned back
  //     (and so runs on the wrong lane) can cross back to its own lane soon. Next to stations and yards, and every 8 squares.
  const crossover = new Set<Piece>(), xUsed = new Set<number>();
  const plainDbl = (i: number, d: Dir) => i >= 0 && !consumed.has(i) && (!opt.noWide?.(i) || !!opt.crossOk?.(i)) && !opt.lanes?.(i) && isDbl(i) && !isCross(i) && links(i) === (bit(d) | bit(opposite(d)));
  const xover = (i: number, d: Dir, j: number) => {
    xUsed.add(i).add(j);
    const ta: V2 = [DX[d], DY[d]], k = 0.42 * 2 * T;
    for (const o of [-LANE, LANE]) {
      const p0 = port(i, opposite(d), o), p3 = port(j, d, -o);
      add(sampleCubic(p0, [p0[0] + ta[0] * k, p0[1] + ta[1] * k], [p3[0] - ta[0] * k, p3[1] - ta[1] * k], p3, 16), [i, j], 'fan', ta, ta);
      crossover.add(pieces.at(-1)!);
    }
  };
  for (const i of keys) for (const d of [0, 1] as Dir[]) {
    const j = nb(i, d), before = nb(i, opposite(d)), after = nb(j, d);
    if (!plainDbl(i, d) || !plainDbl(j, d) || xUsed.has(i) || xUsed.has(j)) continue;
    if (laneOffsets(i, opposite(d)).length !== 2 || laneOffsets(j, d).length !== 2) continue;
    const along = d === 0 ? i % n : (i / n) | 0;
    // next to a station or yard on this same line (a branch leaving beside a station doesn't count)
    const stop = (q: number) => q >= 0 && !!opt.noWide?.(q) && !opt.crossOk?.(q);
    const byStop = [before, after].some(stop) || [before >= 0 ? nb(before, opposite(d)) : -1, after >= 0 ? nb(after, d) : -1].some(q => stop(q) && [before, after].some(e => e >= 0 && !!opt.stationEnd?.(e)));
    if (along % 8 !== 0 && !byStop) continue;
    // out on the open line only where the double track runs on a good way both sides (never inside a short passing loop,
    // whose two tracks must stay free to wait on)
    if (!byStop) { let ok = true; for (const [q0, dd] of [[i, opposite(d)], [j, d]] as [number, Dir][]) { let q = q0; for (let k = 0; k < 3; k++) { q = nb(q, dd); if (!plainDbl(q, d)) { ok = false; break; } } } if (!ok) continue; }
    xover(i, d, j);
  }

  // drop pieces left hanging (a branch leg whose junction side is all taken by turnouts): every non-buffer end must join
  for (let changed = true; changed;) {
    changed = false;
    const ends = new Map<NodeKey, number>();
    for (const p of pieces) { ends.set(p.a, (ends.get(p.a) ?? 0) + 1); if (!p.endB) ends.set(p.b, (ends.get(p.b) ?? 0) + 1); }
    const keep = pieces.filter(p => ends.get(p.a)! > 1 && (p.endB || ends.get(p.b)! > 1));
    if (keep.length && keep.length !== pieces.length) { changed = true; pieces.length = 0; keep.forEach((p, k) => { p.id = k; pieces.push(p); }); }
  }

  // 4. connections and overlaps
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
  /** closest approach of two lanes, checked along every segment (a double turnout's far lane crosses the near lane between points) */
  const touch = (p: Piece, q: Piece) => {
    for (const [u, w] of [[p, q], [q, p]] as [Piece, Piece][]) for (let i = 0; i < u.pts.length; i += 2) for (let j = 0; j + 3 < w.pts.length; j += 2)
      if (segDist(u.pts[i]!, u.pts[i + 1]!, w.pts[j]!, w.pts[j + 1]!, w.pts[j + 2]!, w.pts[j + 3]!) < 9) return true;
    return false;
  };
  const crossing = new Set(keys.filter(isCross));
  const across = (a: Piece, b: Piece) => a.squares.some(s => crossing.has(s)) && a.squares.some(s => b.squares.includes(s) && crossing.has(s)) && (a.ta[0] === 0) !== (b.ta[0] === 0);
  for (const [, ids] of bySquare) for (const a of ids) for (const b of ids) {
    if (a >= b || conflicts[a]!.includes(b)) continue;
    const P = pieces[a]!, Q = pieces[b]!;
    if (near(P, Q) || across(P, Q) || ((dblTurn.has(P) || dblTurn.has(Q) || crossover.has(P) || crossover.has(Q)) && touch(P, Q))) { conflicts[a]!.push(b); conflicts[b]!.push(a); }
  }
  // a train can wait here while another passes: a parallel lane runs beside it (double track, station or yard tracks)
  // never on points: a train standing on a crossover's squares would block the trains that need to cross there
  const passing = pieces.map(p => p.kind !== 'fan' && !dblTurn.has(p) && !p.squares.some(sq => crossing.has(sq) || xUsed.has(sq)) && p.squares.every(sq => net_bySq(bySquare, sq).some(o => o !== p.id && !conflicts[p.id]!.includes(o) && pieces[o]!.kind !== 'fan')));
  const side = pieces.map(p => {
    if (crossover.has(p)) return 0; // a crossover is fine either way: the lane after it counts
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

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy, t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
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
