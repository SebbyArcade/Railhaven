import { DX, DY, type Dir } from '../core/grid.ts';
import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { hallsOf } from './stations.ts';
import { footprint } from './industries.ts';

/** The engine shed: a building beside a plain straight stretch of line near Ashford, its doors facing the track. */
export interface Shed { x: number; y: number; /** direction from the shed to the track */ side: Dir }

const SEARCH = 6;

function squareOk(g: Game, x: number, y: number, blocked: Set<number>): Dir | -1 {
  const n = g.world.n, i = y * n + x, t = g.world.terr[i];
  if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1 || !(t === 1 || t === 2) || !isRevealed(g, i) || g.track.has(i) || blocked.has(i)) return -1;
  if (g.s.sites.some(s => Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1)) return -1;
  let side: Dir | -1 = -1;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const j = (y + DY[d]) * n + x + DX[d], sq = g.track.get(j);
    if (!sq) continue;
    if (side >= 0) return -1; // track on two sides: no room
    // the track beside must be a plain straight running past the doors (not towards them)
    const along = DX[d] !== 0 ? (1 << 1) | (1 << 3) : (1 << 0) | (1 << 2);
    if (sq.links !== along || blocked.has(j) || !(g.linked?.has(j) ?? true)) return -1; // beside the railway, not a loose yard
    side = d;
  }
  if (side < 0) return -1;
  // nothing behind or beside the shed
  for (const d of [0, 1, 2, 3] as Dir[]) if (d !== side && g.track.has((y + DY[d]) * n + x + DX[d])) return -1;
  return side;
}

/** Keep the shed where it is if it still fits, otherwise find the closest good square to Ashford (or none yet). */
export function placeShed(g: Game) {
  const n = g.world.n, a = g.s.sites[0]!, blocked = new Set<number>();
  for (const h of hallsOf(g.track, n, g.s.sites)) for (const i of [...h.squares, ...h.approaches]) blocked.add(i);
  for (const b of g.s.buildings ?? []) for (const i of footprint(n, b)) blocked.add(i);
  const cur = g.s.shed;
  if (cur && squareOk(g, cur.x, cur.y, blocked) === cur.side) return;
  let best: { x: number; y: number; side: Dir } | undefined, bd = Infinity;
  for (let dy = -SEARCH; dy <= SEARCH; dy++) for (let dx = -SEARCH; dx <= SEARCH; dx++) {
    const x = a.x + dx, y = a.y + dy, side = squareOk(g, x, y, blocked);
    if (side < 0) continue;
    const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = { x, y, side: side as Dir }; }
  }
  if (best) g.s.shed = best; else delete g.s.shed;
}

export const shedSquare = (g: Game) => g.s.shed ? g.s.shed.y * g.world.n + g.s.shed.x : -1;
