import type { Game, Site } from '../state.ts';
import { INDUSTRIES, type IndustryKind, isLinked } from '../buildings/industries.ts';
import { sizeName, stepOf, townLinked } from '../economy/towns.ts';
import { isDock, islandOfB } from '../ships/docks.ts';
import { islandSpec, SPEC_TEXT } from '../world/specialty.ts';
import { reachedIslands } from './missions.ts';
import { FREE, prizeAt, prizesFor, starCount } from './prizes.ts';

/**
 * 🌟 Island stars (Sébastien chose them, 2026-11-23: "missing goals that make players want to keep growing their
 * map"). Every named island has up to three goals. Ashford Isle: link 3 towns to Ashford, grow Ashford into a City,
 * link every town on the island. Outer islands: link every town there, grow one into a City, and put the island's
 * specialty to work (a level 2 building of that kind, or fishing boats on a fishing island). A goal reached earns
 * its star for good (stars are never taken back); star totals win prizes and chart the next ring of islands.
 */
export type GoalKind = 'three' | 'ashcity' | 'all' | 'city' | 'spec' | 'reach';
export interface Goal { k: GoalKind; bit: number; icon: string; title: string; how: string; v: number; of: number; done: boolean; earned: boolean; town?: number }

/** The key an island's stars are saved under: its name (island numbers can change when the map grows). */
export const starKey = (g: Game, k: number) => k === g.world.home ? 'home' : g.world.islands[k]?.name ?? String(k);
export const starsOn = (g: Game, k: number) => g.s.stars?.[starKey(g, k)] ?? 0;

const CITY = 3;
const islOf = (g: Game, s: { x: number; y: number }) => g.world.islandOf[s.y * g.world.n + s.x]!;
const lc = (s: string) => s.toLowerCase();

/** What the specialty building is called, and whether this island has one at work. */
function specGoal(g: Game, k: number): { name: string; icon: string; v: number; how: string } | null {
  const sp = islandSpec(g, k); if (!sp) return null;
  const mine = (g.s.buildings ?? []).filter(b => islandOfB(g, b) === k && isLinked(g, b));
  if (sp === 'fish') {
    const best = Math.max(0, ...mine.filter(isDock).map(b => b.fish ?? 0));
    return { name: 'fishing boats', icon: '🎣', v: best >= 1 ? 1 : 0, how: 'Join a ⚓ Dock here to your railway, open it and buy 🎣 Fishing boats' };
  }
  const I = INDUSTRIES[sp as IndustryKind]; if (!I) return null;
  const best = Math.max(0, ...mine.filter(b => b.kind === sp).map(b => b.lvl));
  return { name: I.name, icon: I.icon, v: Math.min(2, best), how: `Build ${/^[AEIOU]/.test(I.name) ? 'an' : 'a'} ${I.icon} ${I.name} here (${SPEC_TEXT[sp]}: it makes 50% more) and upgrade it to level 2` };
}

/** An island's goals, with how far along each one is. */
export function goalsOf(g: Game, k: number): Goal[] {
  const isl = g.world.islands[k]; if (!isl?.name) return [];
  const m = starsOn(g, k), out: Goal[] = [];
  const add = (o: Omit<Goal, 'bit' | 'done' | 'earned'>) => { const bit = 1 << out.length, earned = !!(m & bit); out.push({ ...o, bit, earned, done: earned || o.v >= o.of }); };
  const towns = g.s.sites.filter(s => s.kind === 'town' && islOf(g, s) === k);
  const linked = (t: Site) => t === g.s.sites[0] || townLinked(g, t);
  const on = towns.filter(linked);
  if (k === g.world.home) {
    const a = g.s.sites[0]!;
    add({ k: 'three', icon: '🔗', title: 'Link 3 towns to Ashford', how: '🏗 Build → 🛤 Build rails: paint track from your line into a town’s station', v: Math.min(3, on.filter(t => t !== a).length), of: 3 });
    add({ k: 'ashcity', icon: '🏙', title: 'Grow Ashford into a City', how: 'Fill Ashford’s orders, then tap ⬆ Grow on its card', v: Math.min(CITY, stepOf(a)), of: CITY, town: a.id });
    add({ k: 'all', icon: '🗺', title: 'Link every town on Ashford Isle', how: 'Every town on your home island joined to the railway', v: on.length, of: Math.max(1, towns.length) });
    return out;
  }
  const name = isl.name;
  if (!towns.length && !g.s.sites.some(s => s.kind === 'plot' && islOf(g, s) === k)) {
    add({ k: 'reach', icon: '⚓', title: `Reach ${name}`, how: 'A ⚓ Dock with the reach and a landing on its shore', v: reachedIslands(g).has(k) ? 1 : 0, of: 1 });
  } else {
    add({ k: 'all', icon: '🔗', title: `Link every town on ${name}`, how: towns.length ? `${on.length} of ${towns.length} on your railway. Land there by sea, then lay track to each station` : 'Found a town on its settlement site, then link it', v: on.length, of: Math.max(1, towns.length) });
    const big = [...towns].sort((p, q) => stepOf(q) - stepOf(p) || +linked(q) - +linked(p))[0];
    add({ k: 'city', icon: '🏙', title: `Grow a town on ${name} into a City`, how: big ? `${big.name} is a ${sizeName(stepOf(big))}: fill its orders and tap ⬆ Grow` : 'Link a town here and grow it', v: Math.min(CITY, big ? stepOf(big) : 0), of: CITY, ...(big ? { town: big.id } : {}) });
  }
  const sp = specGoal(g, k);
  if (sp) add({ k: 'spec', icon: sp.icon, title: sp.name === 'fishing boats' ? `Fishing boats on ${name}` : `A level 2 ${sp.name} on ${name}`, how: sp.how, v: sp.v, of: sp.name === 'fishing boats' ? 1 : 2 });
  return out;
}

/** Islands whose goals the player can see: home, those the railway reaches, and those already starred. */
export function atlasIslands(g: Game): number[] {
  const R = reachedIslands(g), out: number[] = [];
  g.world.islands.forEach((isl, k) => { if (isl.name && (k === g.world.home || R.has(k) || starsOn(g, k))) out.push(k); });
  return out.sort((a, b) => (a === g.world.home ? -1 : b === g.world.home ? 1 : (g.world.islands[a]!.dist ?? 0) - (g.world.islands[b]!.dist ?? 0)));
}

/** A star just earned, for its card. */
export interface StarNews { isl: number; title: string; icon: string; prizes: number[]; total: number }

/**
 * Every couple of seconds: award stars for goals reached on islands the railway reaches, and the prizes their total
 * wins. A game from before stars gets everything it already did at once, on one card.
 */
export function tickStars(g: Game): StarNews[] {
  const R = reachedIslands(g), got: StarNews[] = [];
  for (const k of R) {
    if (!g.world.islands[k]?.name) continue;
    for (const o of goalsOf(g, k)) {
      if (o.earned || o.v < o.of) continue;
      const key = starKey(g, k); (g.s.stars ??= {})[key] = (g.s.stars[key] ?? 0) | o.bit;
      got.push({ isl: k, title: o.title, icon: o.icon, prizes: [], total: 0 });
    }
  }
  if (!got.length) return [];
  const total = starCount(g), had = g.s.prize ?? 0, now = prizesFor(total);
  const won: number[] = []; for (let i = had; i < now; i++) won.push(i);
  for (const i of won) { const p = prizeAt(i); if (p.free) (g.s.free ??= {})[p.free] = (g.s.free[p.free] ?? 0) + 1; }
  g.s.prize = now;
  // one card for all of them (a game from before stars, or several goals at once); else one per star with its prize
  const cards = got.length > 1 ? [{ isl: -1, title: `${got.length} stars`, icon: '🌟', prizes: won, total }] : [{ ...got[0]!, prizes: won, total }];
  (g.starQ ??= []).push(...cards);
  return cards;
}

/** A prize in a few words, for cards. */
export const prizeLine = (i: number) => { const p = prizeAt(i); return `${p.icon} ${p.name}: ${p.kind === 'free' && p.free ? lc(FREE[p.free].text[0]!) + FREE[p.free].text.slice(1) : lc(p.text[0]!) + p.text.slice(1)}`; };
