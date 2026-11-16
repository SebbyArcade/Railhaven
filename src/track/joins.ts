import type { Game, Site } from '../state.ts';
import { hallOf } from '../buildings/stations.ts';
import { railNoGo } from '../buildings/nogo.ts';
import { isRevealed } from '../world/fog.ts';
import { layPath } from './edit.ts';
import { planError } from './paint.ts';
import type { TrackMap } from './types.ts';
import { yardSet } from '../buildings/industries.ts';

/** How many new squares a gap may hold and still be shown: a few squares, so it reads as "almost there". */
export const GAP_MAX = 4;

/** The missing squares, in the order they are laid, and the railway square they start from. */
export interface JoinGap { from: number; squares: number[] }

const memo = new WeakMap<Set<number>, Map<number, JoinGap | null>>();

/**
 * The fewest empty squares of track that would put a town on the railway, when your track already comes within a
 * few squares of it (null: no such short gap). The squares obey the same rules as painting track (station ends,
 * yards, parks, fog, no bridges), so laying exactly these squares, starting from `from`, links the town.
 * Worked out once per change of the network.
 */
export function joinGap(g: Game, t: Site): JoinGap | null {
  if (t.kind !== 'town' || !g.linked?.size) return null;
  const h0 = hallOf(g.track, g.world.n, t, g.world.terr, yardSet(g)); if (h0 && g.linked.has(h0.squares[1])) return null; // already on the railway
  let m = memo.get(g.linked); if (!m) { m = new Map(); memo.set(g.linked, m); }
  if (m.has(t.id)) return m.get(t.id)!;
  const v = find(g, t); m.set(t.id, v); return v;
}

function find(g: Game, t: Site): JoinGap | null {
  const n = g.world.n, linked = g.linked!, R = GAP_MAX + 2;
  const near = (i: number) => Math.abs(i % n - t.x) <= R && Math.abs(((i / n) | 0) - t.y) <= R;
  const free = (i: number) => near(i) && !g.track.has(i) && isRevealed(g, i) && g.world.terr[i] !== 0 && !railNoGo(g, i);
  // breadth-first from every railway square near the town: each step is one new square of track
  type Node = { sq: number; from: Node | null };
  let layer: Node[] = [];
  for (const i of linked) if (near(i)) layer.push({ sq: i, from: null });
  const seen = new Set<number>();
  for (let depth = 1; depth <= GAP_MAX && layer.length; depth++) {
    const next: Node[] = [];
    for (const a of layer) {
      const x = a.sq % n, y = (a.sq / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
        const j = Y * n + X; if (!free(j)) continue;
        const node: Node = { sq: j, from: a }, path: number[] = [];
        for (let k: Node | null = node; k; k = k.from) path.unshift(k.sq);
        if (joins(g, t, path)) return { from: path[0]!, squares: path.slice(1) };
        const key = j * 4 + (dx ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3)); // a square reached from each side is its own state: the side decides where a station can go
        if (!seen.has(key)) { seen.add(key); next.push(node); }
      }
    }
    layer = next;
  }
  return null;
}

/** Would laying this stroke (railway square first) be allowed and link the town? */
function joins(g: Game, t: Site, path: number[]): boolean {
  const n = g.world.n;
  if (Math.abs(path.at(-1)! % n - t.x) + Math.abs(((path.at(-1)! / n) | 0) - t.y) > 3) return false; // too far yet to make a station
  const tr: TrackMap = new Map(g.track);
  for (const i of path) { const o = tr.get(i); if (o) tr.set(i, { ...o }); }
  layPath(tr, n, path);
  const h = hallOf(tr, n, t, g.world.terr, yardSet(g));
  if (!h || !(path.includes(h.squares[1]) || g.linked!.has(h.squares[1]))) return false;
  const e = planError(g, { path });
  return !e || e.startsWith('Need $');
}
