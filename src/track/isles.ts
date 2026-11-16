import type { Game } from '../state.ts';

/**
 * Islands joined by rail. A 🌉 strait bridge makes two islands one railway: trains drive across, so goods, rushes
 * and trains go by rail between them, not by ship. Each island maps to one "rail island" (the first of the islands
 * its rails join, Ashford Isle when it is one of them); islands with no bridge stay their own.
 * Cached with the rail distances, so it is rebuilt when the track changes.
 */
function isles(g: Game): { isl: Int32Array; sq: Int32Array } {
  const hit = g.dist?.get('isles'), hitSq = g.dist?.get('isleSq');
  if (hit && hitSq) return { isl: hit, sq: hitSq };
  const w = g.world, n = w.n, k = w.islands.length, up = new Int32Array(k);
  for (let i = 0; i < k; i++) up[i] = i;
  const find = (a: number): number => { while (up[a] !== a) a = up[a] = up[up[a]!]!; return a; };
  // the home island always wins, then the lowest number
  const join = (a: number, b: number) => { a = find(a); b = find(b); if (a === b) return; if (b === w.home || (a !== w.home && b < a)) [a, b] = [b, a]; up[b] = a; };
  const comp = new Map<number, number>(); // track square -> one island its rails touch (-1: none yet)
  const seen = new Set<number>();
  for (const start of g.track.keys()) {
    if (seen.has(start)) continue;
    const q = [start], mine: number[] = []; seen.add(start); let first = -1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]!; mine.push(i);
      const kk = w.islandOf[i]!; if (kk >= 0) { if (first < 0) first = kk; else join(first, kk); }
      const sq = g.track.get(i)!;
      for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) {
        if (!(sq.links & (1 << d)) || seen.has(j)) continue;
        const o = g.track.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
        seen.add(j); q.push(j);
      }
    }
    for (const i of mine) comp.set(i, first);
  }
  const isl = new Int32Array(k); for (let i = 0; i < k; i++) isl[i] = find(i);
  const sq = new Int32Array(n * n).fill(-1); for (const [i, f] of comp) sq[i] = f < 0 ? -1 : isl[f]!;
  (g.dist ??= new Map()).set('isles', isl).set('isleSq', sq);
  return { isl, sq };
}

/** The rail island an island belongs to (itself when no bridge joins it to another). */
export const railIsle = (g: Game, k: number): number => k < 0 ? k : isles(g).isl[k] ?? k;

/** The rail island of a square: its island's, or for track on a bridge, the islands that bridge joins. */
export function railIsleAt(g: Game, i: number): number {
  const k = g.world.islandOf[i]!;
  if (k >= 0) return railIsle(g, k);
  return isles(g).sq[i] ?? -1;
}

/** Are two islands one railway (the same island, or joined by bridges)? */
export const sameRail = (g: Game, a: number, b: number): boolean => a === b || (a >= 0 && b >= 0 && railIsle(g, a) === railIsle(g, b));

/** Every island in a rail island, Ashford Isle (or the first) first. */
export function isleMembers(g: Game, k: number): number[] {
  if (k < 0) return [k];
  const r = railIsle(g, k), key = 'isleM' + r, hit = g.dist?.get(key); if (hit) return [...hit];
  const { isl } = isles(g), out: number[] = [];
  for (let i = 0; i < isl.length; i++) if (isl[i] === r) out.push(i);
  if (!out.length) out.push(k);
  (g.dist ??= new Map()).set(key, Int32Array.from(out));
  return out;
}
