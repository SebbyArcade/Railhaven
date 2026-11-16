import type { Game } from '../state.ts';
import type { Step } from '../track/types.ts';
import { nextSteps } from '../track/network.ts';
import { pointAt } from '../track/geometry.ts';

/**
 * Crews ride the rails: the fire crew's engine and the repair crew's handcar run along the track from their base to
 * the job, work there, then ride back. A run is the way they take (piece steps, saved as numbers) and when they set off.
 * On the rails a crew holds the stretch it stands on, like a train: trains stop behind it (or go round) and never run
 * through it. A crew never runs into a train either: it stops, and if the train needs its stretch (a train coming the
 * other way on a single line) the crew lifts its car off the rails and waits beside them until the way is clear.
 * A run that no longer matches the rails (track changed) is not drawn and holds nothing.
 */
export interface CrewRun {
  kind: 'fire' | 'repair'; path: number[]; len: number; t0: number;
  /** seconds held up so far (stopped for trains): the run is that much later */
  slip?: number;
  /** seconds stopped right now, waiting for a train to clear the way */
  stop?: number;
  /** off the rails, beside them, letting trains by: seconds since it stepped off */
  off?: number;
}

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

/** When a run arrives (seconds from its start, including the start-up time and any wait for trains). */
export const runTime = (r: CrewRun) => CREW_START + (r.slip ?? 0) + r.len / CREW_SPEED;

/** How far along its way the crew is at time t (px). */
export const runDist = (r: CrewRun, t: number) => Math.max(0, Math.min(r.len, (t - r.t0 - CREW_START - (r.slip ?? 0)) * CREW_SPEED));

/** The same run, back the other way, setting off at t0. */
export const backRun = (r: CrewRun, t0: number): CrewRun => ({ kind: r.kind, len: r.len, path: [...r.path].reverse().map(k => k ^ 1), t0 });

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
  let d = runDist(r, t), arrived = d >= r.len - 0.01;
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

/** Where to draw the crew's car: on the rails, or beside them (a car's width out) while it lets trains by. */
export function crewPoint(g: Game, r: CrewRun, t: number) {
  const p = runPoint(g, r, t); if (!p || r.off === undefined) return p;
  return { ...p, x: p.x - p.ty * 11, y: p.y + p.tx * 11 };
}

/** length of the crew's car (px), the gap it keeps from trains, seconds stopped before it lifts the car off the
 *  rails, longest it waits beside them before riding on beside the line, and how near the job it may walk the rest */
export const CREW_LEN = 14, CREW_GAP = 10, STEP_OFF = 2, OFF_MAX = 12, WALK = 48;

/** The pieces the run covers between distances a and b along it (px). */
function spanPieces(g: Game, r: CrewRun, a: number, b: number): number[] {
  const out: number[] = []; let s = 0;
  for (const k of r.path) {
    const id = dec(k).piece, e = s + g.net.pieces[id]!.len;
    if (e >= a && s <= b) out.push(id);
    if (s > b) break;
    s = e;
  }
  return out;
}

const validity = new WeakMap<CrewRun, unknown>();
/** runValid, worked out again only when the rails change */
function stillValid(g: Game, r: CrewRun): boolean {
  if (validity.get(r) === g.net) return true;
  if (!runValid(g, r)) return false;
  validity.set(r, g.net); return true;
}

/**
 * Move the crews along their runs and tell the trains which pieces they hold (g.sys.crew). A crew stops where a
 * train stands or has signalled its way, steps off the rails if it has to wait, and gets back on once the way is clear.
 * While a crew going out to a job waits, the job's times (crewAt, doneAt) move on with it.
 */
export function moveCrews(g: Game, dt: number) {
  const s = g.s, sys = g.sys, hold = new Set<number>(), t = s.t;
  const runs: { r: CrewRun; job?: { crewAt: number; doneAt: number } }[] = [];
  for (const b of s.buildings ?? []) if (b.fire?.run && t < b.fire.doneAt) runs.push({ r: b.fire.run, job: b.fire });
  for (const b of s.breaks ?? []) if (b.run && t < b.doneAt) runs.push({ r: b.run, job: b });
  for (const r of s.crews ?? []) runs.push({ r });
  const trainOn = (p: number) => { if (sys.holder.has(p)) return true; for (const c of g.net.conflicts[p] ?? []) if (sys.holder.has(c)) return true; return false; };
  const take = (ids: number[]) => { for (const p of ids) { hold.add(p); for (const c of g.net.conflicts[p] ?? []) hold.add(c); } };
  for (const { r, job } of runs) {
    if (t < r.t0 || !stillValid(g, r)) continue;
    const d = runDist(r, t), going = t >= r.t0 + CREW_START + (r.slip ?? 0);
    if (d >= r.len - 0.01) { // there: it stands at the job while the crew works (a car off the rails holds nothing)
      if (job && r.off === undefined) take(spanPieces(g, r, d - CREW_LEN / 2, d + CREW_LEN / 2));
      continue;
    }
    const step = going ? CREW_SPEED * dt : 0;
    const wait = (secs: number) => { r.slip = (r.slip ?? 0) + secs; if (job) { job.crewAt += secs; job.doneAt += secs; } };
    const clear = !spanPieces(g, r, d - CREW_LEN / 2, d + CREW_LEN / 2 + step + CREW_GAP).some(trainOn);
    if (r.off !== undefined) { // beside the rails
      if (clear) { r.off = undefined; r.stop = 0; } // the way is clear: back on the rails
      else {
        r.off += dt;
        if (job && r.len - d <= WALK) { wait(-(r.len - d) / CREW_SPEED); continue; } // close enough: the crew walks the rest
        if (r.off < OFF_MAX) wait(dt); // waits for the train to go by; after a while it rides on beside the line
        continue;
      }
    }
    if (!clear) { // stop behind the train; lift the car off the rails if it has to wait a while (or can't even start)
      wait(dt); r.stop = (r.stop ?? 0) + dt;
      if (r.stop >= STEP_OFF || !going) { r.off = 0; r.stop = 0; continue; }
      take(spanPieces(g, r, d - CREW_LEN / 2, d + CREW_LEN / 2));
      continue;
    }
    r.stop = 0;
    take(spanPieces(g, r, d - CREW_LEN / 2, d + CREW_LEN / 2 + step + CREW_GAP));
  }
  sys.crew = hold;
}

/** Drop return runs that are home. */
export function tickCrews(g: Game) {
  const s = g.s; if (!s.crews?.length) return;
  s.crews = s.crews.filter(r => g.s.t < r.t0 + runTime(r) + 1);
}
