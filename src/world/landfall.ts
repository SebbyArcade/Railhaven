import type { Game } from '../state.ts';
import { say } from '../core/news.ts';
import { isRevealed, reveal } from './fog.ts';
import { islandOfB, linkedDocks } from '../ships/docks.ts';
import { reachedIslands } from '../progress/missions.ts';
import { yardSquares } from '../buildings/industries.ts';
import { checkPois } from './explore.ts';

/**
 * 🏕 Landfall: the first time your railway reaches an island (a landing joined to the railway, or track over a strait
 * bridge), a landing crew sets off and maps the whole island, spreading out from where it landed. The map clears in a
 * growing circle with its shore, so one landing is enough to plan rails there (Sébastien, 2026-11-22: a dock showed
 * only one side of an island, and a second dock was cheaper than a scout). Ashford Isle is still explored by track.
 */
export interface Sweep { isl: number; x: number; y: number; r: number; max: number; /** started as a game loaded: one note for all */ q?: boolean }

/** Squares a landing crew maps per second. */
export const SWEEP_SPEED = 0.75;
/** Shore water mapped round every land square. */
export const SWEEP_SHORE = 2;

/** An island's land squares, nearest the start first (cached per sweep: rebuilt after a load). */
const order = new WeakMap<Sweep, { sq: number[]; d: number[]; k: number }>();
function sweepOrder(g: Game, s: Sweep) {
  let o = order.get(s); if (o) return o;
  const n = g.world.n, list: [number, number][] = [];
  for (let i = 0; i < n * n; i++) if (g.world.islandOf[i] === s.isl) list.push([i, Math.hypot((i % n) - s.x, ((i / n) | 0) - s.y)]);
  list.sort((a, b) => a[1] - b[1]);
  o = { sq: list.map(e => e[0]), d: list.map(e => e[1]), k: 0 };
  while (o.k < o.d.length && o.d[o.k]! < s.r) o.k++; // a sweep picked up from a save: what it mapped is already clear
  order.set(s, o); return o;
}

/** Does this island still have land under the fog? */
function fogged(g: Game, k: number): boolean {
  const n = g.world.n;
  for (let i = 0; i < n * n; i++) if (g.world.islandOf[i] === k && !isRevealed(g, i)) return true;
  return false;
}

/** Where the crew comes ashore on an island: its landing, else the first square of track there. */
function landfallAt(g: Game, k: number): { x: number; y: number } | null {
  const n = g.world.n, d = linkedDocks(g).find(b => islandOfB(g, b) === k);
  if (d) { const i = yardSquares(n, d)[0]!; return { x: i % n, y: (i / n) | 0 }; }
  for (const i of g.linked ?? []) if (g.world.islandOf[i] === k) return { x: i % n, y: (i / n) | 0 };
  return null;
}

/** Start a crew on every island the railway reaches that isn't mapped yet. Quiet: no news (used when a game loads). */
export function startSweeps(g: Game, quiet = false): number {
  const list = g.s.sweeps ?? []; let started = 0;
  for (const k of reachedIslands(g)) {
    if (k === g.world.home || list.some(s => s.isl === k) || !fogged(g, k)) continue;
    const p = landfallAt(g, k); if (!p) continue;
    const s: Sweep = { isl: k, x: p.x, y: p.y, r: 0, max: 0, ...(quiet ? { q: true } : {}) };
    const o = sweepOrder(g, s); s.max = (o.d.at(-1) ?? 0) + 1;
    list.push(s); g.s.sweeps = list; started++;
    if (!quiet) say(g, `🏕 A landing crew sets off to map ${g.world.islands[k]?.name ?? 'the island'}: watch the fog clear`, { kind: 'isle', id: k });
  }
  if (quiet && started) say(g, `🏕 Landing crews set off to map ${started === 1 ? 'an island' : started + ' islands'} your railway reaches`);
  return started;
}

/** Crews walk outward: every land square they pass comes out of the fog with its shore. */
export function tickSweeps(g: Game, dt: number) {
  const list = g.s.sweeps; if (!list?.length) return;
  const n = g.world.n, done: Sweep[] = [];
  for (const s of list) {
    const o = sweepOrder(g, s);
    s.r += SWEEP_SPEED * dt;
    while (o.k < o.sq.length && o.d[o.k]! <= s.r) { const i = o.sq[o.k++]!; reveal(g, i % n, (i / n) | 0, SWEEP_SHORE); }
    if (o.k >= o.sq.length) done.push(s);
  }
  if (!done.length) return;
  g.s.sweeps = list.filter(s => !done.includes(s));
  checkPois(g);
  if (done.some(s => s.q) && !g.s.sweeps.some(s => s.q)) say(g, '🗺 The landing crews have mapped every island your railway reaches');
  for (const s of done) {
    if (s.q) continue;
    const towns = g.s.sites.filter(t => t.kind === 'town' && g.world.islandOf[t.y * n + t.x] === s.isl).length;
    say(g, `🗺 ${g.world.islands[s.isl]?.name ?? 'The island'} is mapped${towns ? `: ${towns === 1 ? '1 town' : towns + ' towns'} to link` : ''}`, { kind: 'isle', id: s.isl });
  }
}

/** Where the crew walkers are drawn: up to 3 squares on the edge of what is mapped, spread round the start. */
export function crewSpots(g: Game, s: Sweep): { x: number; y: number }[] {
  const o = sweepOrder(g, s), n = g.world.n, seen = new Set<number>(), out: { x: number; y: number }[] = [];
  for (let k = o.k - 1; k >= Math.max(0, o.k - 400) && out.length < 3; k--) {
    const i = o.sq[k]!, x = i % n, y = (i / n) | 0, a = Math.floor(((Math.atan2(y - s.y, x - s.x) + Math.PI) / (2 * Math.PI)) * 3) % 3;
    if (seen.has(a)) continue; seen.add(a); out.push({ x, y });
  }
  return out;
}
