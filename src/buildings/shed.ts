import { DX, DY, type Dir } from '../core/grid.ts';
import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { hallsOf } from './stations.ts';
import { footprint, yardSet } from './industries.ts';

/**
 * The engine shed: a building near Ashford joined to the line by its own short siding. The siding runs from a
 * plain straight stretch of line (a turnout there), across one square, into the shed: two squares of track, enough
 * for a whole train to stand clear of the line.
 */
export interface Shed { x: number; y: number; /** direction from the shed toward the line */ side: Dir }

const SEARCH = 6;
const opp = (d: Dir) => ((d + 2) % 4) as Dir;
const bit = (d: number) => 1 << d;

/** The shed square, the siding square in front of it, and the line square the siding joins. */
export function shedSiding(g: Game, sh = g.s.shed): { shed: number; mid: number; line: number } | null {
  if (!sh) return null;
  const n = g.world.n, d = sh.side, at = (k: number) => (sh.y + DY[d] * k) * n + sh.x + DX[d] * k;
  return { shed: at(0), mid: at(1), line: at(2) };
}

/** Can the shed stand on (x, y) with its siding toward `d`? `own` is the shed already there (its siding is allowed). */
function fits(g: Game, x: number, y: number, d: Dir, blocked: Set<number>, own: boolean): boolean {
  const n = g.world.n, S = y * n + x, A = S + DX[d] + DY[d] * n, L = A + DX[d] + DY[d] * n;
  const lx = x + 2 * DX[d], ly = y + 2 * DY[d];
  if (x < 2 || y < 2 || x >= n - 2 || y >= n - 2 || lx < 1 || ly < 1 || lx >= n - 1 || ly >= n - 1) return false;
  for (const i of [S, A]) {
    const t = g.world.terr[i];
    if (!(t === 1 || t === 2) || !isRevealed(g, i) || blocked.has(i)) return false;
  }
  if (g.s.sites.some(s => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1)) return false;
  // the shed square holds only the siding's end; the middle square only the siding
  const sTrack = g.track.get(S)?.links ?? 0, aTrack = g.track.get(A)?.links ?? 0;
  if (own ? sTrack !== bit(d) || aTrack !== (bit(d) | bit(opp(d))) : sTrack || aTrack) return false;
  // the line: a plain straight running across the siding (plus the siding's own turnout when it is ours)
  const line = g.track.get(L), along = DX[d] !== 0 ? bit(1) | bit(3) : bit(0) | bit(2);
  if (!line || blocked.has(L) || !(g.linked?.has(L) ?? true)) return false;
  if (line.links !== (own ? along | bit(opp(d)) : along)) return false;
  // track may pass behind or beside the shed and its siding, but nothing may run into them from the sides
  const side = DX[d] !== 0 ? [1, 3] : [0, 2], into = (i: number, e: Dir) => ((g.track.get(i)?.links ?? 0) & bit(opp(e))) !== 0;
  for (const e of [opp(d), ...side] as Dir[]) if (into((y + DY[e]) * n + x + DX[e], e)) return false;
  for (const e of side as Dir[]) if (into(A + DX[e] + DY[e] * n, e)) return false;
  return true;
}

/** Take the siding up (only its own links: any track the player laid across those squares stays). */
function liftSiding(g: Game) {
  const s = shedSiding(g); if (!s) return;
  const d = g.s.shed!.side;
  if (g.track.get(s.shed)?.links !== bit(d)) return; // no siding here (an older save, or the player built over it)
  const drop = (i: number, bits: number) => { const t = g.track.get(i); if (!t) return; t.links &= ~bits; if (!t.links) g.track.delete(i); };
  drop(s.shed, bit(d)); drop(s.mid, bit(d) | bit(opp(d))); drop(s.line, bit(opp(d)));
}

function laySiding(g: Game) {
  const s = shedSiding(g)!, d = g.s.shed!.side;
  g.track.set(s.shed, { links: bit(d) });
  g.track.set(s.mid, { links: bit(d) | bit(opp(d)) });
  g.track.get(s.line)!.links |= bit(opp(d));
}

/**
 * Keep the shed where it is if it still fits, otherwise move it (siding and all) to the closest good spot to
 * Ashford, or take it away until the line has a straight stretch. Changes the track: call before building the network.
 * Returns the squares that changed.
 */
export function placeShed(g: Game): number[] {
  const n = g.world.n, a = g.s.sites[0]!, blocked = new Set<number>();
  for (const h of hallsOf(g.track, n, g.s.sites, g.world.terr, yardSet(g))) for (const i of [...h.squares, ...h.approaches]) blocked.add(i);
  for (const b of g.s.buildings ?? []) for (const i of footprint(n, b)) blocked.add(i);
  for (const p of g.s.parks ?? []) blocked.add(p.y * n + p.x);
  const cur = g.s.shed;
  if (cur && fits(g, cur.x, cur.y, cur.side, blocked, true)) return [];
  if (cur && fits(g, cur.x, cur.y, cur.side, blocked, false)) { laySiding(g); return Object.values(shedSiding(g)!); } // an older save: no siding yet
  const before = cur ? Object.values(shedSiding(g)!) : [];
  if (cur) liftSiding(g);
  let best: Shed | undefined, bd = Infinity;
  for (let dy = -SEARCH; dy <= SEARCH; dy++) for (let dx = -SEARCH; dx <= SEARCH; dx++) for (const d of [0, 1, 2, 3] as Dir[]) {
    const x = a.x + dx, y = a.y + dy;
    if (!fits(g, x, y, d, blocked, false)) continue;
    const dist = Math.hypot(dx, dy); if (dist < bd) { bd = dist; best = { x, y, side: d }; }
  }
  if (best) { g.s.shed = best; laySiding(g); } else delete g.s.shed;
  return [...before, ...(best ? Object.values(shedSiding(g)!) : [])];
}

/** Put the shed back where it stood (Undo): take up the siding where it is now; the next trackChanged lays the old one. */
export function restoreShed(g: Game, sh: Shed | null | undefined) {
  if (sh === undefined) return;
  const cur = g.s.shed;
  if (cur && sh && cur.x === sh.x && cur.y === sh.y && cur.side === sh.side) return;
  if (cur) liftSiding(g);
  if (sh) g.s.shed = { ...sh }; else delete g.s.shed;
}

export const shedSquare = (g: Game) => g.s.shed ? g.s.shed.y * g.world.n + g.s.shed.x : -1;
