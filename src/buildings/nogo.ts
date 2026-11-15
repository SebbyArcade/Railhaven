import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { T } from '../world/terrain.ts';
import { squareCost } from '../track/rules.ts';
import { buildingSquares, footprint, type IndustryKind, MINES, stripSquares, tracksOf } from './industries.ts';

/**
 * Squares where the player can't build, so Rails and Build mode can tint them faint red before a drag or a tap
 * (Sébastien, 2026-11-15). They follow the same rules that refuse a square, so the tint never disagrees with them.
 * Fog is left alone (it is dark already) and so is the player's own track.
 */

/** Rails: terrain track can't take (mountains until tunnels, open sea, too far out for a bridge, deposits, sites),
 * the buildings themselves (not their yards), parks and the engine shed. */
export function railNoGo(g: Game, i: number): boolean {
  if (!isRevealed(g, i) || g.track.has(i)) return false;
  const c = squareCost(g, i); if (typeof c === 'string') return true;
  return blockedByThings(g, i, false);
}

/** Buildings of a kind: water (docks put their pier on it), mountains (mines dig into them), and squares other
 * buildings, towns, parks and the shed already use. */
export function buildNoGo(g: Game, k: IndustryKind, i: number): boolean {
  if (!isRevealed(g, i) || g.track.has(i)) return false;
  const t = g.world.terr[i];
  if (t === T.Water && k !== 'dock') return true;
  if (t === T.Mountain && !MINES.has(k)) return true;
  if (blockedByThings(g, i, true)) return true;
  const n = g.world.n, x = i % n, y = (i / n) | 0;
  return g.s.sites.some(s => s.kind === 'town' && Math.abs(s.x - x) <= 1 && Math.abs(s.y - y) <= 1); // towns keep the squares round them free
}

function blockedByThings(g: Game, i: number, whole: boolean): boolean {
  const n = g.world.n;
  for (const b of g.s.buildings ?? []) {
    if (whole ? footprint(n, b).includes(i) : buildingSquares(n, b).includes(i) || (tracksOf(b) > 2 && stripSquares(n, b).includes(i))) return true;
  }
  if ((g.s.parks ?? []).some(p => p.y * n + p.x === i)) return true;
  return !!g.s.shed && g.s.shed.y * n + g.s.shed.x === i;
}
