import type { Game } from '../state.ts';
import { isFactory } from '../buildings/industries.ts';
import { stepOf, townLinked } from '../economy/towns.ts';
import { MAX_LVL } from '../economy/upgrades.ts';
import { ashford, msOf, reachedIslands } from './missions.ts';

/**
 * Achievements: medals earned in any game and kept across all of them (in the player's profile, not in a game).
 * Each medal gives XP; XP unlocks looks (train paints, town themes) that change nothing in play.
 * No medal can be missed for good, and none pays money (money comes only from deliveries and selling).
 */

export interface Profile {
  /** medal id -> when it was earned (ms since 1970) */
  medals: Record<string, number>;
  /** orders filled across all games */
  orders: number;
  /** map numbers of games played */
  seeds: number[];
  /** looks picked */
  paint?: string; theme?: string;
}
export const emptyProfile = (): Profile => ({ medals: {}, orders: 0, seeds: [] });

export type Group = 'start' | 'orders' | 'towns' | 'industry' | 'explore' | 'railway';
export const GROUPS: { k: Group; icon: string; name: string }[] = [
  { k: 'start', icon: '🚩', name: 'First steps' }, { k: 'orders', icon: '📋', name: 'Orders' }, { k: 'towns', icon: '🏘', name: 'Towns' },
  { k: 'industry', icon: '🏭', name: 'Industry' }, { k: 'explore', icon: '🧭', name: 'Exploring' }, { k: 'railway', icon: '⭐', name: 'Railway' },
];

export interface Medal { id: string; g: Group; icon: string; name: string; how: string; xp: number; prog: (g: Game, p: Profile) => [number, number] }

const towns = (g: Game) => g.s.sites.filter(s => s.kind === 'town');
const linkedTowns = (g: Game) => towns(g).filter(t => t !== ashford(g) && townLinked(g, t));
const biggest = (g: Game) => Math.max(0, ...towns(g).filter(t => (t.pop ?? 0) > 0).map(t => stepOf(t)));
const blds = (g: Game) => g.s.buildings ?? [];
const has = (b: boolean): [number, number] => [b ? 1 : 0, 1];
const PRODUCTS = ['planks', 'bricks', 'flour', 'steel', 'fuel', 'cloth', 'cans'];
const islandAt = (g: Game, s: { x: number; y: number }) => g.world.islandOf[s.y * g.world.n + s.x]!;
function farShore(g: Game) {
  const r = reachedIslands(g);
  return g.s.sites.some(s => s.kind === 'dep' && (s.res === 'iron' || s.res === 'oil') && islandAt(g, s) !== g.world.home && r.has(islandAt(g, s)));
}

export const MEDALS: Medal[] = [
  { id: 'track', g: 'start', icon: '🛤', name: 'Wake the Line', how: 'Lay your first track from Ashford', xp: 10, prog: g => has(g.s.track.length > 0) },
  { id: 'train', g: 'start', icon: '🚂', name: 'First Whistle', how: 'Buy your first train', xp: 10, prog: g => has(g.s.trains.length > 0) },
  { id: 'link', g: 'start', icon: '🤝', name: 'Opening Day', how: 'Link your first town to Ashford', xp: 10, prog: g => has(linkedTowns(g).length > 0) },
  { id: 'order1', g: 'start', icon: '✅', name: 'Paid in Full', how: 'Fill your first order', xp: 10, prog: g => has((g.s.orders ?? 0) > 0) },
  { id: 'order25', g: 'orders', icon: '📋', name: 'Busy Office', how: 'Fill 25 orders in one game', xp: 25, prog: g => [g.s.orders ?? 0, 25] },
  { id: 'order100', g: 'orders', icon: '📚', name: 'Ledger Full', how: 'Fill 100 orders in one game', xp: 50, prog: g => [g.s.orders ?? 0, 100] },
  { id: 'rush', g: 'orders', icon: '⚡', name: 'Rush Job', how: 'Finish a rush', xp: 25, prog: g => has((g.s.rushDone ?? 0) > 0) },
  { id: 'order500', g: 'orders', icon: '🏆', name: 'Never Idle', how: 'Fill 500 orders across all your games', xp: 50, prog: (_g, p) => [p.orders, 500] },
  { id: 'village', g: 'towns', icon: '🏡', name: 'Village Green', how: 'Grow a town to Village', xp: 10, prog: g => [biggest(g), 1] },
  { id: 'city', g: 'towns', icon: '🏙', name: 'Bright Lights', how: 'Grow a town to City', xp: 25, prog: g => [biggest(g), 3] },
  { id: 'metro', g: 'towns', icon: '🌆', name: 'Skyline', how: 'Grow a town to Metropolis', xp: 25, prog: g => [biggest(g), 4] },
  { id: 'mega', g: 'towns', icon: '🌃', name: 'Megacity', how: 'Grow a town to Megacity', xp: 50, prog: g => [biggest(g), 5] },
  { id: 'towns10', g: 'towns', icon: '🗺', name: 'Well Connected', how: 'Link 10 towns in one game', xp: 25, prog: g => [linkedTowns(g).length, 10] },
  { id: 'capital', g: 'towns', icon: '👑', name: 'Capital Pride', how: 'Grow Ashford to City', xp: 25, prog: g => [stepOf(ashford(g)), 3] },
  { id: 'factory', g: 'industry', icon: '🪚', name: 'Sawdust', how: 'Build your first factory', xp: 10, prog: g => has(blds(g).some(b => isFactory(b.kind))) },
  { id: 'chain', g: 'industry', icon: '🔗', name: 'Full Chain', how: 'Get something a factory made to a town', xp: 25, prog: g => has(towns(g).some(t => PRODUCTS.some(k => (t.got?.[k] ?? 0) > 0 || (t.steady?.[k] ?? 0) > 0))) },
  { id: 'mines', g: 'industry', icon: '⛏', name: 'Down the Mine', how: 'Have a stone quarry, coal mine and iron mine in one game', xp: 25, prog: g => [(['stone', 'coal', 'iron'] as const).filter(k => blds(g).some(b => b.kind === k)).length, 3] },
  { id: 'oil', g: 'industry', icon: '🛢', name: 'Black Gold', how: 'Bring oil from an oil well to where it is needed', xp: 25, prog: g => has(blds(g).some(b => (b.inbuf?.oil ?? 0) > 0) || towns(g).some(t => (t.got?.oil ?? 0) > 0)) },
  { id: 'maxlvl', g: 'industry', icon: '🏗', name: 'Big Works', how: `Raise any building to level ${MAX_LVL}`, xp: 25, prog: g => [Math.max(1, ...blds(g).map(b => b.lvl)), MAX_LVL] },
  { id: 'island', g: 'explore', icon: '🏝', name: 'Land Ho', how: 'Reach your first new island', xp: 25, prog: g => [reachedIslands(g).size - 1, 1] },
  { id: 'island3', g: 'explore', icon: '🧭', name: 'Island Hopper', how: 'Reach 3 new islands in one game', xp: 50, prog: g => [reachedIslands(g).size - 1, 3] },
  { id: 'far', g: 'explore', icon: '🌊', name: 'Far Shores', how: 'Reach an island with iron or oil', xp: 25, prog: g => has(farShore(g)) },
  { id: 'ship', g: 'explore', icon: '🚢', name: 'First Sailing', how: 'Get your first cargo ship', xp: 10, prog: g => has((g.s.ships ?? []).length > 0) },
  { id: 'poi', g: 'explore', icon: '🗝', name: 'Treasure Hunter', how: 'Claim a landmark or salvage a shipwreck', xp: 25, prog: g => has((g.s.pois ?? []).some(p => p.got)) },
  { id: 'lvl3', g: 'railway', icon: '⭐', name: 'Level Up', how: 'Reach Railway level 3', xp: 10, prog: g => [g.s.rlv ?? 0, 3] },
  { id: 'lvl6', g: 'railway', icon: '🌟', name: 'Express Lines', how: 'Reach Railway level 6', xp: 25, prog: g => [g.s.rlv ?? 0, 6] },
  { id: 'lvl10', g: 'railway', icon: '💫', name: 'The Network', how: 'Reach Railway level 10', xp: 50, prog: g => [g.s.rlv ?? 0, 10] },
  { id: 'mira', g: 'railway', icon: '🎯', name: "Mira's Favourite", how: "Finish 25 of Mira's missions in one game", xp: 25, prog: g => [msOf(g).done.length, 25] },
  { id: 'fleet', g: 'railway', icon: '🚃', name: 'Big Fleet', how: 'Run 20 trains at once', xp: 25, prog: g => [g.s.trains.length, 20] },
  { id: 'games3', g: 'railway', icon: '🗂', name: 'Fresh Start', how: 'Play three different maps', xp: 10, prog: (_g, p) => [p.seeds.length, 3] },
];

export const TOTAL_XP = MEDALS.reduce((a, m) => a + m.xp, 0);
export const xpOf = (p: Profile) => MEDALS.reduce((a, m) => a + (p.medals[m.id] ? m.xp : 0), 0);

/** Count this game's new orders into the all-games total, remember its map, and award every medal now earned. */
export function checkMedals(g: Game, p: Profile, now = Date.now()): Medal[] {
  const o = g.s.orders ?? 0;
  if (g.s.achOrd === undefined) { g.s.achOrd = o; p.orders += o; } // a game from before achievements counts its orders once
  else if (o > g.s.achOrd) { p.orders += o - g.s.achOrd; g.s.achOrd = o; }
  if (g.s.t > 60 && !p.seeds.includes(g.s.seed)) p.seeds.push(g.s.seed); // a map counts once it has been played a minute
  const got: Medal[] = [];
  for (const m of MEDALS) {
    if (p.medals[m.id]) continue;
    const [v, n] = m.prog(g, p);
    if (v >= n) { p.medals[m.id] = now; got.push(m); }
  }
  return got;
}

export const PROFILE_KEY = 'railhaven.profile';
export function loadProfile(store: { getItem(k: string): string | null }): Profile {
  try { const o = JSON.parse(store.getItem(PROFILE_KEY) ?? 'null'); if (o && typeof o === 'object') return { ...emptyProfile(), ...o }; } catch { /* a fresh profile */ }
  return emptyProfile();
}
export function saveProfile(store: { setItem(k: string, v: string): void }, p: Profile) { store.setItem(PROFILE_KEY, JSON.stringify(p)); }
