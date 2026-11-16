import { hash } from '../core/rng.ts';
import type { Game } from '../state.ts';
import { hallsOf } from '../buildings/stations.ts';
import { closedPieces, tickClosures } from '../buildings/closing.ts';
import { shedSiding } from '../buildings/shed.ts';
import { backRun, crewRun, railPath, runTime, tickCrews } from '../world/crews.ts';
import { yardSet } from '../buildings/industries.ts';

/** Where the repair crew sets off: the engine shed's siding, else Ashford's station. */
function crewBase(g: Game): number[] {
  const sd = shedSiding(g); if (sd) return [sd.line];
  const a = g.s.sites[0]!, h = hallsOf(g.track, g.world.n, [a], g.world.terr, yardSet(g))[0];
  return h ? h.squares : [a.y * g.world.n + a.x];
}

/**
 * Broken rails: now and then a busy stretch of line is blocked (a rockslide, washout, fallen tree or heat buckle).
 * A repair crew rides out along the rails on a handcar from the engine shed, fixes it and rides back; trains go round or wait.
 */
export interface Break {
  square: number;
  kind: 'rockslide' | 'washout' | 'fallen tree' | 'heat buckle';
  /** game time the crew arrives, and when the rail is fixed */
  crewAt: number;
  doneAt: number;
  /** the repair crew's ride along the rails from the engine shed */
  run?: import('../world/crews.ts').CrewRun;
}

export const BREAKS_START = 15 * 60;
const GAP_MIN = 8 * 60, GAP_MAX = 10 * 60, MAX_ACTIVE = 2, REPAIR_TIME = 30;
export const BREAK_TEXT: Record<Break['kind'], string> = {
  rockslide: '🪨 Rockslide', washout: '🌊 Washout', 'fallen tree': '🌳 Fallen tree', 'heat buckle': '☀️ Heat buckle',
};

/** Pieces trains can't enter because of broken rails (or the barriers of a closed building). */
export function blockedPieces(g: Game): Set<number> {
  const out = new Set<number>();
  for (const b of g.s.breaks ?? []) for (const p of g.net.bySquare.get(b.square) ?? []) out.add(p);
  for (const p of closedPieces(g)) out.add(p); // ⛔ barriers down at closed buildings
  return out;
}

/** Break a rail on a busy square (or on `at` when given). Returns the break, or null if nowhere fits. */
export function breakRail(g: Game, at?: number): Break | null {
  const n = g.world.n, busy = new Map<number, number>(), sys = g.sys;
  const off = new Set<number>();
  for (const h of hallsOf(g.track, n, g.s.sites, g.world.terr, yardSet(g))) for (const i of [...h.squares, ...h.approaches]) off.add(i);
  for (const b of g.s.breaks ?? []) off.add(b.square);
  // no break under a train or on a stretch a train has already signalled
  for (const [p] of sys.holder) for (const q of g.net.pieces[p]!.squares) off.add(q);
  let pick = at ?? -1;
  if (pick < 0) {
    for (const t of g.s.trains) for (const m of t.plan) if (!('rev' in m)) for (const q of g.net.pieces[m.piece]!.squares) busy.set(q, (busy.get(q) ?? 0) + 1);
    const cands = [...(busy.size ? busy.keys() : g.track.keys())].filter(i => !off.has(i) && g.track.get(i) && countLinks(g.track.get(i)!.links) === 2);
    if (!cands.length) return null;
    pick = cands[Math.floor(hash(g.s.seed, Math.floor(g.s.t), cands.length, 31) * cands.length)]!;
  } else if (off.has(pick) || !g.track.has(pick)) return null;
  const kinds: Break['kind'][] = ['rockslide', 'washout', 'fallen tree', 'heat buckle'];
  const kind = kinds[Math.floor(hash(g.s.seed, pick, Math.floor(g.s.t), 32) * 4)]!;
  // the crew rides out from the engine shed (or Ashford) at about a square a second
  const from = g.s.shed ?? g.s.sites[0]!, x = pick % n, y = (pick / n) | 0;
  const run = crewRun(g, 'repair', railPath(g, crewBase(g), [pick]), g.s.t);
  const crewAt = run ? g.s.t + runTime(run) : g.s.t + 5 + Math.hypot(x - from.x, y - from.y) * 0.8;
  const b: Break = { square: pick, kind, crewAt, doneAt: crewAt + REPAIR_TIME, ...(run ? { run } : {}) };
  (g.s.breaks ??= []).push(b);
  return b;
}

/** Fire new breaks on schedule and finish repairs. Returns true when the set of broken rails changed. */
export function tickBreaks(g: Game): boolean {
  const s = g.s; let changed = false;
  s.nextBreak ??= BREAKS_START + hash(s.seed, 1, 2, 33) * (GAP_MAX - GAP_MIN);
  if (s.t >= s.nextBreak) {
    s.nextBreak = s.t + GAP_MIN + hash(s.seed, Math.floor(s.t), 3, 34) * (GAP_MAX - GAP_MIN);
    if ((s.breaks?.length ?? 0) < MAX_ACTIVE && breakRail(g)) changed = true;
  }
  if (s.breaks?.some(b => s.t >= b.doneAt)) {
    for (const b of s.breaks) if (s.t >= b.doneAt && b.run) (s.crews ??= []).push(backRun(b.run, s.t)); // the crew rides home
    s.breaks = s.breaks.filter(b => s.t < b.doneAt); changed = true;
  }
  tickCrews(g);
  if (tickClosures(g)) changed = true; // ⛔ a closed building's barriers went up or down
  return changed;
}

const countLinks = (m: number) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
