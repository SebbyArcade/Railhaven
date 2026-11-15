import type { Game, Resource } from '../state.ts';
import { T } from './terrain.ts';

/**
 * Island specialties. Every named outer island is good at one thing its land allows: a deposit it has (oil, iron,
 * coal), mountains (stone), forest (wood), open grass (wheat), or the sea all round (fish); the seed picks which. Industries of that kind there make 50% more; a fish island's boats catch 50% more.
 * Ashford Isle has no specialty.
 */
export type Specialty = Resource | 'fish';
export const SPEC_BONUS = 1.5;

export const SPEC_TEXT: Record<Specialty, string> = {
  wood: '🪵 Timber island', farm: '🌾 Farm island', stone: '🪨 Stone island', coal: '⚫ Coal island',
  iron: '🧲 Iron island', oil: '🛢 Oil island', fish: '🐟 Fishing island',
};

export function islandSpec(g: Game, k: number): Specialty | null {
  const c = (g.spec ??= new Map()); if (c.has(k)) return c.get(k)!;
  let out: Specialty | null = null;
  const isl = g.world.islands[k];
  if (k >= 0 && k !== g.world.home && isl?.name) {
    const n = g.world.n, cnt = [0, 0, 0, 0, 0];
    for (let i = 0; i < n * n; i++) if (g.world.islandOf[i] === k) cnt[g.world.terr[i]!]!++;
    const deps = new Set(g.s.sites.filter(s => s.kind === 'dep' && g.world.islandOf[s.y * n + s.x] === k).map(s => s.res));
    const land = Math.max(1, isl.size);
    // what the island could be good at; the seed picks one of them, so islands differ
    const can: Specialty[] = [];
    for (const r of ['oil', 'iron', 'coal'] as const) if (deps.has(r)) can.push(r);
    if ((cnt[T.Mountain]! + cnt[T.Hills]!) / land > 0.15) can.push('stone');
    if (cnt[T.Forest]! / land > 0.25) can.push('wood');
    if (cnt[T.Grass]! / land > 0.35) can.push('farm');
    can.push('fish');
    out = can[(g.s.seed * 7 + k * 13) % can.length]!;
  }
  c.set(k, out);
  return out;
}

/** The output bonus for an industry of this kind on island k (1 = none). */
export const specMul = (g: Game, k: number, kind: string) => islandSpec(g, k) === kind ? SPEC_BONUS : 1;
