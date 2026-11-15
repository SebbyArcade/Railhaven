import type { Game, Site } from '../state.ts';
import { bufOf, type Building, GOODS, type Good, INDUSTRIES, inputsOf, isFactory, isLinked, yardSquares } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { orderOf, steadyGoods, townLinked, townRoom } from './towns.ts';

/** Train load, and the least a train waits for before it sets off to collect (it leaves mostly full). */
export const TRAIN_CAP = 20;
export const MIN_LOAD = 15;
export const PAY = 0.41;
/** factories pay half for the raw goods they take */
export const FACP = 0.5;
/** distance factor: longer hauls pay more per unit */
export const DF = (d: number) => Math.pow(Math.max(8, d) / 8, 0.85);

/** Rail distance in squares from a set of squares to every track square (-1 = not joined). Cached until the track changes. */
export function railDist(g: Game, key: string, from: number[]): Int32Array {
  const c = (g.dist ??= new Map()).get(key); if (c) return c;
  const n = g.world.n, out = new Int32Array(n * n).fill(-1), q: number[] = [];
  for (const i of from) if (g.track.has(i)) { out[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, sq = g.track.get(i)!;
    for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) {
      if (!(sq.links & (1 << d)) || out[j] !== -1) continue;
      const o = g.track.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
      out[j] = out[i]! + 1; q.push(j);
    }
  }
  g.dist.set(key, out);
  return out;
}
export const bldDist = (g: Game, b: Building) => railDist(g, 'b' + b.id, yardSquares(g.world.n, b));

export type Dest = { kind: 'town' | 'bld'; id: number };
export type Why = 'order' | 'factory' | 'steady' | 'extra';
export interface Ship { to: Dest; why: Why; d: number }

export const siteOf = (g: Game, id: number): Site | undefined => g.s.sites.find(s => s.id === id);
export const bldOf = (g: Game, id: number): Building | undefined => g.s.buildings?.find(b => b.id === id);
/** Where a train stops to unload: the town's station hall, or the factory's yard. */
export const destSquares = (g: Game, to: Dest): number[] => {
  if (to.kind === 'bld') { const b = bldOf(g, to.id); return b ? yardSquares(g.world.n, b) : []; }
  const t = siteOf(g, to.id); const h = t && hallOf(g.track, g.world.n, t); return h ? h.squares : [];
};
export const destName = (g: Game, to: Dest) => to.kind === 'bld' ? `the ${INDUSTRIES[bldOf(g, to.id)?.kind ?? 'sawmill'].name}` : siteOf(g, to.id)?.name ?? 'a town';
export const goodOf = (b: Building): Good => INDUSTRIES[b.kind].makes;
export const PART_PAY: Record<Why, number> = { order: 1, factory: FACP, steady: 0.35, extra: 0.175 };
const key = (to: Dest, k: Good) => `${to.kind}${to.id}/${k}`;

/** Units already on their way to (or about to be collected for) each place and good. */
function enRoute(g: Game): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of g.s.trains) {
    const j = t.job; if (!j) continue;
    const k = key(j.to, j.good as Good);
    m.set(k, (m.get(k) ?? 0) + (t.cargo?.n ?? TRAIN_CAP));
  }
  return m;
}

/** How much a factory still has room for of one of its inputs. */
export const factoryRoom = (f: Building, k: Good) => Math.max(0, bufOf(f) - (f.inbuf?.[k] ?? 0));

/**
 * The shipping plan: where each building sends its goods. Open orders and factories first, shared out
 * nearest-first so several camps don't all pile into one place; then towns that keep buying the good (steady
 * demand); else the nearest town on the railway (paid as extra).
 */
export function shipPlan(g: Game): Map<number, Ship> {
  const out = new Map<number, Ship>(), n = g.world.n;
  const towns = g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t));
  const bs = (g.s.buildings ?? []).filter(b => isLinked(g, b));
  const facs = bs.filter(b => isFactory(b.kind));
  const way = enRoute(g);
  const pairs: { b: Building; to: Dest; d: number; t?: Site; f?: Building }[] = [];
  for (const b of bs) {
    const dist = bldDist(g, b), k = goodOf(b);
    for (const t of towns) { const h = hallOf(g.track, n, t)!, d = dist[h.squares[1]]!; if (d >= 0) pairs.push({ b, to: { kind: 'town', id: t.id }, d, t }); }
    for (const f of facs) if (f !== b && inputsOf(f.kind).includes(k)) { const d = dist[yardSquares(n, f)[1]!]!; if (d >= 0) pairs.push({ b, to: { kind: 'bld', id: f.id }, d, f }); }
  }
  pairs.sort((p, q) => p.d - q.d);
  const left = new Map<string, number>();
  const room = (p: typeof pairs[number], why: 'need' | 'steady'): number => {
    const k = goodOf(p.b), kk = key(p.to, k) + why;
    if (!left.has(kk)) {
      let r = 0;
      if (why === 'need') r = p.f ? factoryRoom(p.f, k) : orderOf(g, p.t!)[k] ? townRoom(g, p.t!, k).order : 0;
      else r = p.t && steadyGoods(p.t).includes(k) ? Math.max(townRoom(g, p.t, k).steady, 1) : 0;
      left.set(kk, r - (why === 'need' ? way.get(key(p.to, k)) ?? 0 : 0));
    }
    return left.get(kk)!;
  };
  for (const why of ['need', 'steady'] as const) {
    for (const p of pairs) {
      if (out.has(p.b.id) || room(p, why) <= 0) continue;
      out.set(p.b.id, { to: p.to, why: why === 'steady' ? 'steady' : p.f ? 'factory' : 'order', d: p.d });
      const kk = key(p.to, goodOf(p.b)) + why; left.set(kk, left.get(kk)! - TRAIN_CAP);
    }
  }
  for (const p of pairs) if (!out.has(p.b.id) && p.t) out.set(p.b.id, { to: p.to, why: 'extra', d: p.d });
  return out;
}

/** What a load of n units pays when delivered there. */
export const payFor = (k: Good, n: number, d: number, why: Why) => GOODS[k].value * DF(d) * PAY * n * PART_PAY[why];
