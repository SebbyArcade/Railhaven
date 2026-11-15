import type { Game } from '../state.ts';
import { type Building, footprint, buildingSquares } from './industries.ts';

/**
 * ⛔ Closing a building (Sébastien's idea): the player stops an industry or factory for a while. It makes nothing,
 * takes nothing in, and no train is sent there. Boom barriers come down across both ends of its yard once the last
 * train has left, so no train drives in (or through) until it opens again. Its stock waits for it.
 */
export const canClose = (b: Building) => b.kind !== 'dock';
export const isClosed = (b: Building) => !!b.closed;

/** The yard's track squares (loading tracks and the strip beside them), not the building row. */
export function yardTrackSquares(g: Game, b: Building): Set<number> {
  const n = g.world.n, row = new Set(buildingSquares(n, b));
  return new Set(footprint(n, { ...b, tracks: b.tracks }).filter(i => !row.has(i)));
}

/** Is a train standing on (or partly in) the yard? */
export function yardBusy(g: Game, b: Building): boolean {
  const ys = yardTrackSquares(g, b);
  return g.s.trains.some(t => t.trail.some(s => g.net.pieces[s.piece]?.squares.some(i => ys.has(i))));
}

/** Barriers are down: the building is closed and its yard is empty. */
export const barriersDown = (g: Game, b: Building) => isClosed(b) && !yardBusy(g, b);

/** Pieces trains can't enter because a closed building's barriers are down. */
export function closedPieces(g: Game): Set<number> {
  const out = new Set<number>();
  for (const b of g.s.buildings ?? []) {
    if (!isClosed(b) || yardBusy(g, b)) continue;
    const ys = yardTrackSquares(g, b);
    for (const i of ys) for (const p of g.net.bySquare.get(i) ?? []) out.add(p);
  }
  return out;
}

/** Close or open a building. Returns why not, or ''. */
export function setClosed(b: Building, on: boolean): string {
  if (!canClose(b)) return 'Docks stay open';
  if (on) b.closed = true; else delete b.closed;
  return '';
}

/** Did any barrier go up or down since the last tick? (true = trains must plan around them again) */
export function tickClosures(g: Game): boolean {
  const bs = g.s.buildings ?? [];
  if (!g.closedKey && !bs.some(isClosed)) return false;
  const key = bs.filter(b => barriersDown(g, b)).map(b => b.id).join(',');
  if (key === (g.closedKey ?? '')) return false;
  g.closedKey = key; return true;
}
