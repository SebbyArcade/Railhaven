/** Curves sampled into polylines with cumulative length, so a position along any piece is a simple lookup. */

export type V2 = [number, number];

export function sampleCubic(p0: V2, p1: V2, p2: V2, p3: V2, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push(a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]);
  }
  return out;
}

export function sampleArc(cx: number, cy: number, r: number, a0: number, a1: number, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps; out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return out;
}

export function cumulative(pts: ArrayLike<number>): Float64Array {
  const n = pts.length / 2, cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1]! + Math.hypot(pts[i * 2]! - pts[i * 2 - 2]!, pts[i * 2 + 1]! - pts[i * 2 - 1]!);
  return cum;
}

/** Point and unit tangent at distance s along a sampled curve (tangent points from start to end). */
export function pointAt(pts: Float64Array, cum: Float64Array, s: number): { x: number; y: number; tx: number; ty: number } {
  const n = cum.length, len = cum[n - 1]!;
  s = Math.max(0, Math.min(len, s));
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m]! <= s) lo = m; else hi = m; }
  const seg = cum[hi]! - cum[lo]! || 1, f = (s - cum[lo]!) / seg;
  const x0 = pts[lo * 2]!, y0 = pts[lo * 2 + 1]!, x1 = pts[hi * 2]!, y1 = pts[hi * 2 + 1]!;
  const dx = x1 - x0, dy = y1 - y0, dl = Math.hypot(dx, dy) || 1;
  return { x: x0 + dx * f, y: y0 + dy * f, tx: dx / dl, ty: dy / dl };
}

export const nodeKey = (x: number, y: number) => Math.round(x * 2) + ',' + Math.round(y * 2);
