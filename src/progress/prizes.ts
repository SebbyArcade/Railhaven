import type { Game } from '../state.ts';

/**
 * 🎁 Prizes for 🌟 island stars (Sébastien chose island stars and prizes, 2026-11-23, to give growing the map a goal).
 * Each prize is won at a star total: a named engine (a small lasting help for the whole fleet), a free town project,
 * or a prize-only building (🎡 Fairground, 🏨 Grand Hotel) that can't be bought. Past the list, a prize every 5 stars.
 * Nothing here is bought by itself: buildings wait as a free build on a town card until the player puts them up.
 */
export type PrizeKind = 'engine' | 'free';
/** a town project the prize gives free (or the prize-only buildings) */
export type FreeKind = 'clock' | 'market' | 'tram' | 'theatre' | 'fair' | 'hotel';
export interface Perks { spd: number; cap: number; load: number; ship: number; run: number }
export interface Prize { at: number; kind: PrizeKind; icon: string; name: string; text: string; perk?: Partial<Perks>; free?: FreeKind }

const E = (at: number, icon: string, name: string, text: string, perk: Partial<Perks>): Prize => ({ at, kind: 'engine', icon, name, text, perk });
const F = (at: number, free: FreeKind): Prize => ({ at, kind: 'free', icon: FREE[free].icon, name: FREE[free].name, text: FREE[free].text, free });

export const FREE: Record<FreeKind, { icon: string; name: string; text: string }> = {
  clock: { icon: '🕰', name: 'Free Clock Tower', text: 'Build a Clock Tower in any Town for free: deliveries there pay 10% more' },
  market: { icon: '🛒', name: 'Free Market Hall', text: 'Build a Market Hall in any City for free: deliveries there pay 15% more' },
  tram: { icon: '🚋', name: 'Free Tram Line', text: 'Build a Tram Line in any City for free: its orders are 5% smaller' },
  theatre: { icon: '🎭', name: 'Free Grand Theatre', text: 'Build a Grand Theatre in any Metropolis for free: deliveries there pay 20% more' },
  fair: { icon: '🎡', name: 'Fairground', text: 'A prize-only building for any Village or bigger: deliveries there pay 15% more' },
  hotel: { icon: '🏨', name: 'Grand Hotel', text: 'A prize-only building for any Town or bigger: its orders are 10% smaller' },
};

export const PRIZES: Prize[] = [
  F(1, 'clock'),
  E(2, '🚂', 'The Kestrel', 'A swift little engine: every train runs 5% faster', { spd: 1.05 }),
  F(3, 'fair'),
  E(5, '📬', 'The Night Mail', 'Every train loads and unloads 15% faster', { load: 0.85 }),
  F(7, 'market'),
  E(9, '🚃', 'The Big Hauler', 'Every train carries 10% more', { cap: 1.1 }),
  F(12, 'hotel'),
  E(15, '🔧', 'The Tinker', 'Every train costs 10% less to run', { run: 0.9 }),
  F(18, 'tram'),
  E(21, '⛴', 'The Herring Queen', 'Every ship sails 15% faster', { ship: 1.15 }),
  F(24, 'fair'),
  E(27, '⚡', 'The Comet', 'Every train runs 5% faster again', { spd: 1.05 }),
  F(30, 'theatre'),
  E(33, '🏗', 'The Goliath', 'Every train carries 10% more again', { cap: 1.1 }),
  F(36, 'hotel'),
  E(40, '🚄', 'The Silver Arrow', 'Every train runs 5% faster and loads 10% faster', { spd: 1.05, load: 0.9 }),
  F(45, 'theatre'),
  E(50, '👑', 'The Railhaven Royal', 'Every train carries 10% more and costs 10% less to run', { cap: 1.1, run: 0.9 }),
];
const AFTER: FreeKind[] = ['clock', 'fair', 'market', 'hotel', 'theatre'];

/** Prize i (0 = the first): the list, then one every 5 stars, taking turns. */
export function prizeAt(i: number): Prize {
  if (i < PRIZES.length) return PRIZES[i]!;
  const k = i - PRIZES.length;
  return F(PRIZES.at(-1)!.at + 5 * (k + 1), AFTER[k % AFTER.length]!);
}

/** How many prizes this many stars wins. */
export function prizesFor(stars: number): number { let i = 0; while (prizeAt(i).at <= stars) i++; return i; }

/** Stars the railway has earned. */
export const starCount = (g: Game) => Object.values(g.s.stars ?? {}).reduce((a, m) => a + bits(m), 0);
export const bits = (m: number) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

/** The engines' help, all multiplied together (1 = none). */
const perkMemo = new WeakMap<Game, { n: number; p: Perks }>();
export function perks(g: Game): Perks {
  const n = g.s.prize ?? 0, c = perkMemo.get(g); if (c && c.n === n) return c.p;
  const p: Perks = { spd: 1, cap: 1, load: 1, ship: 1, run: 1 };
  for (let i = 0; i < (g.s.prize ?? 0); i++) { const q = prizeAt(i).perk; if (q) for (const k of Object.keys(q) as (keyof Perks)[]) p[k] *= q[k]!; }
  perkMemo.set(g, { n, p }); return p;
}

/** Free builds waiting for a town. */
export const freeOf = (g: Game, k: string) => g.s.free?.[k as FreeKind] ?? 0;

/** 🗺 Stars needed to chart the next ring of islands for an expedition: 15, 30, 45... */
export const RING_STARS = 15;
export const ringStars = (g: Game) => RING_STARS * ((g.s.rings ?? 0) + 1);
