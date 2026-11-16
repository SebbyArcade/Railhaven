import type { Game } from '../state.ts';
import { reachedIslands } from './missions.ts';

/**
 * 🏝 Island arrivals: the first time your railway reaches an island (a landing on the railway, or track carried
 * onto it), its arrival card says what is known about it and what still hides there. An older game notes the islands
 * it has already reached quietly, without cards.
 */
export function checkArrivals(g: Game): number[] {
  const now = reachedIslands(g);
  if (!g.s.isles) { g.s.isles = [...now]; return []; }
  const had = new Set(g.s.isles), fresh = [...now].filter(k => !had.has(k) && k !== g.world.home && !!g.world.islands[k]?.name); // small unnamed islets: no card
  if (!fresh.length) return [];
  g.s.isles.push(...fresh);
  (g.arrived ??= []).push(...fresh);
  return fresh;
}
