import { hash, vnoise } from '../core/rng.ts';

/** Terrain codes, same as the old game. */
export const enum T { Water = 0, Grass = 1, Forest = 2, Hills = 3, Mountain = 4 }
export const TERRAIN_NAMES = ['Water', 'Grassland', 'Forest', 'Hills', 'Mountain'] as const;

export const MAP_N = 208;
export const TILE = 32;

export interface IslandInfo {
  /** land squares */ size: number;
  cx: number; cy: number;
  /** distance from map centre */ dist: number;
  /** name, only for land masses of 40+ squares */ name?: string;
}

export interface World {
  readonly seed: number;
  readonly n: number;
  /** terrain per square */ terr: Uint8Array;
  /** open ocean joined to the map edge (no land within 2 squares) */ deep: Uint8Array;
  /** any water joined to the open ocean (lakes excluded) */ ocean: Uint8Array;
  /** land mass id per square, -1 on water */ islandOf: Int16Array;
  islands: IslandInfo[];
  /** id of the home island (Ashford's) */ home: number;
  /** centre square (Ashford) */ cx: number; cy: number;
}

const ISLAND_NAMES = ['Ashford Isle', 'Gull Rock', 'Brackenholm', 'Saltreach', 'Mossy Key', 'Emberfell', 'Cinder Isle',
  'Fernhallow', 'Westerly', 'Ironback', 'Lantern Isle', 'Cobble Key', 'Thornby', 'Starling Isle', 'Kelpmoor', 'Duskwater',
  'Hollowmere', 'Copperhead', 'Pinecrest', 'Wrenhaven', 'Ashgrove', 'Tern Island', 'Bramblecay', 'Foxmoor', 'Rookhold',
  'Sunreach', 'Harrier Isle', 'Marigold Key', 'Stonebay', 'Northwatch', 'Quill Isle', 'Driftwood', 'Oakmere', 'Farthing Isle'];

/**
 * Generate the archipelago. Identical to the old game's base terrain for the same seed:
 * the home island in the middle, up to 29 more islands farther out, open land around Ashford.
 */
export function generateWorld(seed: number, n = MAP_N): World {
  const C = n >> 1;
  const at = (x: number, y: number) => y * n + x;
  const H = (x: number, y: number, s = 0) => hash(seed, x, y, s);
  const V = (x: number, y: number, s: number) => vnoise(seed, x, y, s);

  const isl: { x: number; y: number; r: number }[] = [{ x: C, y: C, r: 36 }];
  for (let t = 0; t < 900 && isl.length < 30; t++) {
    const a = H(t, 7, 61) * 6.283, d = 50 + H(t, 9, 62) * (C - 24), r = 9 + Math.floor(H(t, 11, 63) * (5 + d / 10));
    const x = Math.round(C + Math.cos(a) * d), y = Math.round(C + Math.sin(a) * d);
    if (x - r < 3 || y - r < 3 || x + r > n - 4 || y + r > n - 4) continue;
    if (isl.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 7)) continue;
    isl.push({ x, y, r });
  }
  const islV = (x: number, y: number) => { let v = -9; for (const o of isl) v = Math.max(v, 1 - Math.hypot(x - o.x, y - o.y) / o.r); return v; };

  const terr = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const h = V(x / 9, y / 9, 1) * 0.65 + V(x / 4, y / 4, 2) * 0.35, m = V(x / 6, y / 6, 3), d = Math.hypot(x - C, y - C);
    const land = islV(x, y) + (V(x / 5, y / 5, 4) - 0.5) * 0.5;
    let t = land < 0.08 || h < 0.26 ? 0 : h > 0.72 ? 4 : h > 0.63 ? 3 : m > 0.58 ? 2 : 1;
    if (d < 3) t = 1; else if (d < 8 && (t === 0 || t === 4)) t = m > 0.58 ? 2 : 1;
    terr[at(x, y)] = t;
  }

  const w: World = { seed, n, terr, deep: new Uint8Array(n * n), ocean: new Uint8Array(n * n),
    islandOf: new Int16Array(n * n).fill(-1), islands: [], home: 0, cx: C, cy: C };
  refreshWater(w);
  refreshIslands(w);
  return w;
}

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Recompute open ocean and sea water (call after terrain edits that touch water). */
export function refreshWater(w: World): void {
  const { n, terr, deep, ocean } = w;
  deep.fill(0); ocean.fill(0);
  const at = (x: number, y: number) => y * n + x;
  const c = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (terr[at(x, y)]) continue;
    let l = 0;
    for (let j = -2; j <= 2 && !l; j++) for (let i = -2; i <= 2; i++) {
      const a = x + i, b = y + j;
      if (a >= 0 && b >= 0 && a < n && b < n && terr[at(a, b)]) { l = 1; break; }
    }
    if (!l) c[at(x, y)] = 1;
  }
  const q: number[] = [];
  for (let k = 0; k < n; k++) for (const i of [at(k, 0), at(k, n - 1), at(0, k), at(n - 1, k)]) if (c[i] && !deep[i]) { deep[i] = 1; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const j = at(nx, ny); if (c[j] && !deep[j]) { deep[j] = 1; q.push(j); } }
  }
  const q2: number[] = [];
  for (let i = 0; i < n * n; i++) if (deep[i]) { ocean[i] = 1; q2.push(i); }
  for (let h = 0; h < q2.length; h++) {
    const i = q2[h]!, x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const j = at(nx, ny); if (!terr[j] && !ocean[j]) { ocean[j] = 1; q2.push(j); } }
  }
}

/** Label land masses; masses of 40+ squares get names, nearest the centre first. */
export function refreshIslands(w: World): void {
  const { n, terr, islandOf } = w;
  islandOf.fill(-1);
  const list: IslandInfo[] = [];
  for (let i = 0; i < n * n; i++) {
    if (!terr[i] || islandOf[i]! >= 0) continue;
    const q = [i], k = list.length; islandOf[i] = k;
    let sx = 0, sy = 0;
    for (let h = 0; h < q.length; h++) {
      const j = q[h]!, x = j % n, y = (j / n) | 0; sx += x; sy += y;
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const m = nx + ny * n; if (terr[m] && islandOf[m]! < 0) { islandOf[m] = k; q.push(m); } }
    }
    const cx = sx / q.length, cy = sy / q.length;
    list.push({ size: q.length, cx, cy, dist: Math.hypot(cx - w.cx, cy - w.cy) });
  }
  const big = list.map((_, k) => k).filter(k => list[k]!.size >= 40).sort((a, b) => list[a]!.dist - list[b]!.dist);
  big.forEach((k, j) => { list[k]!.name = j === 0 ? ISLAND_NAMES[0] : ISLAND_NAMES[1 + (j - 1) % (ISLAND_NAMES.length - 1)]; });
  w.islands = list;
  w.home = islandOf[w.cy * n + w.cx]!;
}

/** Named island id at a square, or -1. */
export function islandAt(w: World, x: number, y: number): number {
  const k = w.islandOf[y * w.n + x]!;
  return k >= 0 && w.islands[k]!.name ? k : -1;
}

export const isLand = (w: World, x: number, y: number) =>
  x > 1 && y > 1 && x < w.n - 2 && y < w.n - 2 && w.terr[y * w.n + x]! > 0;
/** Buildable land: grass, forest or hills. */
export const isFlatLand = (w: World, x: number, y: number) => isLand(w, x, y) && w.terr[y * w.n + x]! < 4;
