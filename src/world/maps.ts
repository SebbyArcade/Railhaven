import type { Game } from '../state.ts';
import { buildingSquares, isLinked } from '../buildings/industries.ts';
import { townLinked } from '../economy/towns.ts';
import { isRevealed } from './fog.ts';
import { poisOf, toldIslands } from './explore.ts';

/**
 * 🗺 Area maps, bought at a town or dock on the railway. A map marks what hides in the fog inside its circle (towns,
 * settlement sites and landmarks) with a glowing ?, so the player knows where to scout or lay track. It doesn't lift
 * the fog. A map that finds nothing gives half its price back.
 */
export interface AreaMap { x: number; y: number; r: number }
export interface Find { x: number; y: number; what: 'town' | 'plot' | 'poi' }

/** circle radius from a town, from a dock (sea charts reach further), and how far from the railway its middle may go */
export const MAP_R = 45, MAP_R_SEA = 70, MAP_FAR = 40;
export const mapCost = (g: Game) => Math.round(1000 * Math.pow(1.5, (g.s.maps ?? []).length) / 100) * 100;

/** Towns and docks on the railway: where maps are sold. */
export function mapPlaces(g: Game): { x: number; y: number; name: string; dock: boolean }[] {
  const out: { x: number; y: number; name: string; dock: boolean }[] = [], n = g.world.n;
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t)) out.push({ x: t.x, y: t.y, name: t.name ?? 'a town', dock: false });
  for (const b of g.s.buildings ?? []) if (b.kind === 'dock' && isLinked(g, b)) { const m = buildingSquares(n, b)[1]!; out.push({ x: m % n, y: (m / n) | 0, name: 'the dock', dock: true }); }
  return out;
}

/** The nearest map seller to (x, y), with the circle it sells there; or why a map can't be centred there. */
export function mapAt(g: Game, x: number, y: number): { x: number; y: number; r: number; near: string } | string {
  const n = g.world.n;
  if (x < 0 || y < 0 || x >= n || y >= n) return 'That is off the edge of the map';
  const ps = mapPlaces(g); if (!ps.length) return 'Join a town to your railway first: maps are sold there';
  const p = ps.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]!;
  if (Math.hypot(p.x - x, p.y - y) > MAP_FAR) return `Too far from your railway: centre the map within ${MAP_FAR} squares of a town or dock on it`;
  return { x, y, r: p.dock ? MAP_R_SEA : MAP_R, near: p.name };
}

/** What still hides in the fog inside a circle. */
export function mapFinds(g: Game, x: number, y: number, r: number): Find[] {
  const n = g.world.n, out: Find[] = [], fog = (a: number, b: number) => !isRevealed(g, b * n + a), inR = (a: number, b: number) => Math.hypot(a - x, b - y) <= r;
  for (const s of g.s.sites) if ((s.kind === 'town' || s.kind === 'plot') && fog(s.x, s.y) && inR(s.x, s.y)) out.push({ x: s.x, y: s.y, what: s.kind });
  for (const p of poisOf(g)) if (!p.seen && !p.got && fog(p.x, p.y) && inR(p.x, p.y)) out.push({ x: p.x, y: p.y, what: 'poi' });
  return out;
}

/** What still hides in the fog on one island (an explorer's camp's notes). */
export function islandFinds(g: Game, k: number): Find[] {
  const n = g.world.n, on = (x: number, y: number) => g.world.islandOf[y * n + x] === k && !isRevealed(g, y * n + x), out: Find[] = [];
  for (const s of g.s.sites) if ((s.kind === 'town' || s.kind === 'plot') && on(s.x, s.y)) out.push({ x: s.x, y: s.y, what: s.kind });
  for (const p of poisOf(g)) if (!p.seen && !p.got && p.kind !== 'wreck' && on(p.x, p.y)) out.push({ x: p.x, y: p.y, what: 'poi' });
  return out;
}

/** Every ? shown on the map: finds inside bought maps, and on islands whose explorer's camp is yours, still in the fog. */
export function rumours(g: Game): Find[] {
  const seen = new Set<number>(), out: Find[] = [];
  const add = (f: Find) => { const k = f.y * g.world.n + f.x; if (!seen.has(k)) { seen.add(k); out.push(f); } };
  for (const m of g.s.maps ?? []) for (const f of mapFinds(g, m.x, m.y, m.r)) add(f);
  for (const k of toldIslands(g)) for (const f of islandFinds(g, k)) add(f);
  return out;
}

/** Buy the map of a circle. Returns what it marked (and half the price back when it marked nothing), or why not. */
export function buyMap(g: Game, x: number, y: number): { finds: Find[]; refund: number; r: number } | string {
  const at = mapAt(g, x, y); if (typeof at === 'string') return at;
  const c = mapCost(g); if (g.s.money < c) return `A map costs ${c}: deliveries pay for it`;
  const have = new Set(rumours(g).map(f => f.y * g.world.n + f.x));
  const finds = mapFinds(g, at.x, at.y, at.r).filter(f => !have.has(f.y * g.world.n + f.x));
  g.s.money -= c; (g.s.maps ??= []).push({ x: at.x, y: at.y, r: at.r });
  const refund = finds.length ? 0 : Math.round(c / 2); g.s.money += refund;
  return { finds, refund, r: at.r };
}

/** "lots of rumours" / "a few rumours" / "quiet": travellers' talk before buying. */
export function talkOf(k: number): string { return k >= 6 ? 'lots of rumours out there' : k >= 2 ? 'a few rumours' : 'quiet around here'; }

/** The finds in words, for the toast: "1 hidden town, 2 landmarks". */
export function findsText(fs: Find[]): string {
  const c = (w: Find['what']) => fs.filter(f => f.what === w).length, parts: string[] = [];
  const t = c('town'), p = c('plot'), l = c('poi');
  if (t) parts.push(`${t} hidden town${t > 1 ? 's' : ''}`);
  if (p) parts.push(`${p} settlement site${p > 1 ? 's' : ''}`);
  if (l) parts.push(`${l} landmark${l > 1 ? 's' : ''}`);
  return parts.join(', ');
}
