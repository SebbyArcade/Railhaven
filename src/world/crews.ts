import type { Game } from '../state.ts';
import type { Step } from '../track/types.ts';
import { nextSteps } from '../track/network.ts';
import { pointAt } from '../track/geometry.ts';

/**
 * Crews ride the rails: the fire crew's engine and the repair crew's handcar run along the track from their base to
 * the job, work there, then ride back. A run is the way they take (piece steps, saved as numbers) and when they set off.
 * It is drawn only (it never holds the line), and a run that no longer matches the rails (track changed) is not drawn.
 */
export interface CrewRun { kind: 'fire' | 'repair'; path: number[]; len: number; t0: number }

/** px a second: about a square in 0.6 s, as crews always rode */
export const CREW_SPEED = 32 / 0.6;
/** seconds to get going before the crew sets off */
export const CREW_START = 4;

const enc = (s: Step) => s.piece * 2 + (s.dir > 0 ? 0 : 1);
const dec = (k: number): Step => ({ piece: k >> 1, dir: k & 1 ? -1 : 1 });

/** The shortest way along the rails from any of `from` to any of `to` (squares), never reversing; null when none. */
export function railPath(g: Game, from: number[], to: number[]): number[] | null {
  const net = g.net, goal = new Set(to), start = new Set(from), held = new Set<number>();
  for (const t of g.s.trains) for (const st of t.trail) held.add(st.piece);
  const dist = new Map<number, number>(), prev = new Map<number, number>(), open: [number, number][] = [];
  for (const sq of start) for (const id of net.bySquare.get(sq) ?? []) for (const dir of [1, -1] as const) {
    const k = enc({ piece: id, dir }); dist.set(k, 0); open.push([0, k]);
  }
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i]![0] < open[bi]![0]) bi = i;
    const [d, k] = open.splice(bi, 1)[0]!; if (d > dist.get(k)!) continue;
    const s = dec(k), p = net.pieces[s.piece]!;
    if (p.squares.some(q => goal.has(q))) {
      const out = [k]; let c = k; while (prev.has(c)) { c = prev.get(c)!; out.push(c); }
      return out.reverse();
    }
    for (const o of nextSteps(net, s)) {
      const ok = enc(o), nd = d + net.pieces[o.piece]!.len + (held.has(o.piece) ? 400 : 0); // keep off tracks trains stand on, where it can
      if (nd < (dist.get(ok) ?? Infinity)) { dist.set(ok, nd); prev.set(ok, k); open.push([nd, ok]); }
    }
  }
  return null;
}

/** A crew run along a path starting at t0, or null when there is no path. */
export function crewRun(g: Game, kind: CrewRun['kind'], path: number[] | null, t0: number): CrewRun | null {
  if (!path) return null;
  const len = path.reduce((a, k) => a + g.net.pieces[dec(k).piece]!.len, 0);
  return { kind, path, len, t0 };
}

/** When a run arrives (seconds from its start, including the start-up time). */
export const runTime = (r: CrewRun) => CREW_START + r.len / CREW_SPEED;

/** The same run, back the other way, setting off at t0. */
export const backRun = (r: CrewRun, t0: number): CrewRun => ({ ...r, path: [...r.path].reverse().map(k => k ^ 1), t0 });

/** Does the run still follow the rails as they are now? */
export function runValid(g: Game, r: CrewRun): boolean {
  const net = g.net;
  for (let i = 0; i < r.path.length; i++) {
    const s = dec(r.path[i]!); if (!net.pieces[s.piece]) return false;
    if (i && !nextSteps(net, dec(r.path[i - 1]!)).some(o => o.piece === s.piece && o.dir === s.dir)) return false;
  }
  return true;
}

/** Where the crew is at time t along a run (world px and heading), or null before it sets off. */
export function runPoint(g: Game, r: CrewRun, t: number): { x: number; y: number; tx: number; ty: number; arrived: boolean } | null {
  if (t < r.t0) return null;
  let d = Math.max(0, Math.min(r.len, (t - r.t0 - CREW_START) * CREW_SPEED)), arrived = d >= r.len - 0.01;
  for (let i = 0; i < r.path.length; i++) {
    const s = dec(r.path[i]!), p = g.net.pieces[s.piece]!;
    if (d <= p.len || i === r.path.length - 1) {
      const at = Math.min(d, p.len), q = pointAt(p.pts, p.cum, s.dir > 0 ? at : p.len - at);
      return { x: q.x, y: q.y, tx: q.tx * s.dir, ty: q.ty * s.dir, arrived };
    }
    d -= p.len;
  }
  return null;
}

/** Drop return runs that are home. */
export function tickCrews(g: Game) {
  const s = g.s; if (!s.crews?.length) return;
  s.crews = s.crews.filter(r => g.s.t < r.t0 + runTime(r) + 1);
}
