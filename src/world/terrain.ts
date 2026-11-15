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
  /** 🗺 on a map grown by expeditions: where the first map (n0 squares) sits inside it */
  box?: { o: number; n0: number };
}

const ISLAND_NAMES = ['Ashford Isle', 'Gull Rock', 'Brackenholm', 'Saltreach', 'Mossy Key', 'Emberfell', 'Cinder Isle',
  'Fernhallow', 'Westerly', 'Ironback', 'Lantern Isle', 'Cobble Key', 'Thornby', 'Starling Isle', 'Kelpmoor', 'Duskwater',
  'Hollowmere', 'Copperhead', 'Pinecrest', 'Wrenhaven', 'Ashgrove', 'Tern Island', 'Bramblecay', 'Foxmoor', 'Rookhold',
  'Sunreach', 'Harrier Isle', 'Marigold Key', 'Stonebay', 'Northwatch', 'Quill Isle', 'Driftwood', 'Oakmere', 'Farthing Isle',
  // far seas, reached by 🗺 expeditions
  'Albatross Isle', 'Coral Reach', 'Mistral Key', 'Saffron Isle', 'Fargone', 'Whalesong', 'Ambergris', 'Seafire',
  'Longshore', 'Kittiwake', 'Glimmerholm', 'Tempest Rock', 'Juniper Key', 'Silverstrand', 'Ospreyholm', 'Horizon Isle'];

/** Map maker versions: 1 = the old game's maps; 2 adds sister islands (pairs of islands 1-3 squares apart, bridgeable). */
export const MAP_VERSION = 2;
/** How many sister islands a version-2 map tries to place. */
export const SISTERS = 3;

type Disc = { x: number; y: number; r: number };

/**
 * Generate the archipelago. Version 1 is identical to the old game's base terrain for the same seed:
 * the home island in the middle, up to 29 more islands farther out, open land around Ashford.
 * Version 2 also places a few sister islands right beside outer islands, so a short strait bridge can join them.
 */
export function generateWorld(seed: number, n0 = MAP_N, version = 1, rings = 0): World {
  const C = n0 >> 1, n = n0; // the first map is n0 squares; each 🗺 expedition ring adds RING_W squares of sea all round
  const at = (x: number, y: number) => y * n + x;
  const H = (x: number, y: number, s = 0) => hash(seed, x, y, s);
  const V = (x: number, y: number, s: number) => vnoise(seed, x, y, s);

  const isl: Disc[] = [{ x: C, y: C, r: 36 }];
  for (let t = 0; t < 900 && isl.length < 30; t++) {
    const a = H(t, 7, 61) * 6.283, d = 50 + H(t, 9, 62) * (C - 24), r = 9 + Math.floor(H(t, 11, 63) * (5 + d / 10));
    const x = Math.round(C + Math.cos(a) * d), y = Math.round(C + Math.sin(a) * d);
    if (x - r < 3 || y - r < 3 || x + r > n - 4 || y + r > n - 4) continue;
    if (isl.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 7)) continue;
    isl.push({ x, y, r });
  }
  const islV = (x: number, y: number, list: Disc[]) => { let v = -9; for (const o of list) v = Math.max(v, 1 - Math.hypot(x - o.x, y - o.y) / o.r); return v; };
  const terrAt = (x: number, y: number, list: Disc[]) => {
    const h = V(x / 9, y / 9, 1) * 0.65 + V(x / 4, y / 4, 2) * 0.35, m = V(x / 6, y / 6, 3), d = Math.hypot(x - C, y - C);
    const land = islV(x, y, list) + (V(x / 5, y / 5, 4) - 0.5) * 0.5;
    let t = land < 0.08 || h < 0.26 ? 0 : h > 0.72 ? 4 : h > 0.63 ? 3 : m > 0.58 ? 2 : 1;
    if (d < 3) t = 1; else if (d < 8 && (t === 0 || t === 4)) t = m > 0.58 ? 2 : 1;
    return t;
  };
  if (version >= 2) addSisters(isl, n, H, terrAt);

  if (rings <= 0) {
    const terr = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) terr[at(x, y)] = terrAt(x, y, isl);
    const w: World = { seed, n, terr, deep: new Uint8Array(n * n), ocean: new Uint8Array(n * n),
      islandOf: new Int16Array(n * n).fill(-1), islands: [], home: 0, cx: C, cy: C };
    refreshWater(w);
    refreshIslands(w);
    return w;
  }
  // 🗺 a grown map: the first map is drawn exactly as before (same squares, same islands), shifted by O squares,
  // and each ring of sea round it gets its own new islands
  const O = rings * RING_W, N = n0 + 2 * O, all = [...isl];
  for (let k = 1; k <= rings; k++) addRing(all, n0, k, H);
  const terr = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xo = x - O, yo = y - O, inner = xo >= 0 && yo >= 0 && xo < n0 && yo < n0;
    terr[y * N + x] = terrAt(xo, yo, inner ? isl : all);
  }
  const w: World = { seed, n: N, terr, deep: new Uint8Array(N * N), ocean: new Uint8Array(N * N),
    islandOf: new Int16Array(N * N).fill(-1), islands: [], home: 0, cx: C + O, cy: C + O, box: { o: O, n0 } };
  refreshWater(w);
  refreshIslands(w);
  return w;
}

/** 🗺 Squares of sea each expedition ring adds on every side of the map. */
export const RING_W = 40;
/** Most new islands one ring brings. */
export const RING_ISLANDS = 7;

/**
 * The islands of expedition ring k, in the first map's coordinates: in the band between the old edge (k-1 rings out)
 * and the new one, each kept 1.3 radii + 3 squares clear of both edges so no land touches the older map, and apart
 * from every other island like the first map's.
 */
function addRing(isl: Disc[], n0: number, k: number, H: (x: number, y: number, s?: number) => number) {
  const a0 = -(k - 1) * RING_W, b0 = n0 + (k - 1) * RING_W, a1 = -k * RING_W, b1 = n0 + k * RING_W;
  let made = 0;
  for (let t = 0; t < 600 && made < RING_ISLANDS; t++) {
    const r = 9 + Math.floor(H(t, k, 81) * 4), m = Math.ceil(r * 1.3) + 3;
    const x = Math.round(a1 + m + H(t, k, 82) * (b1 - a1 - 2 * m)), y = Math.round(a1 + m + H(t, k, 83) * (b1 - a1 - 2 * m));
    // clear of the older map: at least m squares outside its box
    if (x > a0 - m && x < b0 + m && y > a0 - m && y < b0 + m) continue;
    if (isl.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 7)) continue;
    isl.push({ x, y, r }); made++;
  }
}

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * Sister islands: beside a few outer islands, a second island close enough that only 1-3 squares of water part them
 * (a strait a bridge can cross). Each try is drawn in a small window round the pair and kept only if the two stay
 * separate, the sister is big enough to be named, and the narrowest straight crossing is 1-3 squares.
 */
function addSisters(isl: Disc[], n: number, H: (x: number, y: number, s?: number) => number, terrAt: (x: number, y: number, list: Disc[]) => number) {
  const C = n >> 1;
  const order = isl.map((_, k) => k).filter(k => k > 0).sort((a, b) => H(a, 3, 71) - H(b, 3, 71));
  let made = 0;
  for (const k of order) {
    if (made >= SISTERS) break;
    const o = isl[k]!;
    if (Math.hypot(o.x - C, o.y - C) < 60) continue; // not hugging Ashford Isle
    tries: for (let t = 0; t < 10; t++) {
      const a = H(k, t, 72) * 6.283, r = 10 + Math.floor(H(k, t, 73) * 3);
      for (let D = Math.round((o.r + r) * 0.75); D <= o.r + r + 6; D++) {
        const x = Math.round(o.x + Math.cos(a) * D), y = Math.round(o.y + Math.sin(a) * D), s: Disc = { x, y, r };
        if (x - r * 1.3 < 3 || y - r * 1.3 < 3 || x + r * 1.3 > n - 4 || y + r * 1.3 > n - 4) continue tries;
        if (isl.some((q, j) => j !== k && Math.hypot(q.x - x, q.y - y) < q.r + r + 7)) continue tries;
        const gap = strait(o, s, [...isl, s], n, terrAt);
        if (gap === 'merged') continue;
        if (gap >= 1 && gap <= 3) { isl.push(s); made++; break tries; }
        if (gap > 3) continue tries; // farther only widens it: try another direction
      }
    }
  }
}

/** The narrowest straight water crossing (squares) between islands a and b, drawn in a window round them; 'merged' if they touch, 0 if b has too little land. */
function strait(a: Disc, b: Disc, list: Disc[], n: number, terrAt: (x: number, y: number, list: Disc[]) => number): number | 'merged' {
  const m = 3, x0 = Math.max(0, Math.floor(Math.min(a.x - a.r * 1.25, b.x - b.r * 1.25)) - m), y0 = Math.max(0, Math.floor(Math.min(a.y - a.r * 1.25, b.y - b.r * 1.25)) - m);
  const x1 = Math.min(n - 1, Math.ceil(Math.max(a.x + a.r * 1.25, b.x + b.r * 1.25)) + m), y1 = Math.min(n - 1, Math.ceil(Math.max(a.y + a.r * 1.25, b.y + b.r * 1.25)) + m);
  const W = x1 - x0 + 1, Hh = y1 - y0 + 1, land = new Uint8Array(W * Hh), comp = new Int8Array(W * Hh);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) land[y * W + x] = terrAt(x + x0, y + y0, list) > 0 ? 1 : 0;
  const flood = (d: Disc, c: number) => { // from the land square nearest the disc's centre
    let s = -1, bd = 1e9;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const e = Math.hypot(x + x0 - d.x, y + y0 - d.y); if (land[y * W + x] && e < bd) { bd = e; s = y * W + x; } }
    if (s < 0 || bd > d.r * 0.5) return 0;
    if (comp[s]) return comp[s] === c ? 1 : -1;
    const q = [s]; comp[s] = c;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]!, x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= Hh) continue; const j = ny * W + nx; if (land[j] && !comp[j]) { comp[j] = c; q.push(j); } }
    }
    return q.length;
  };
  flood(a, 1);
  const nb = flood(b, 2);
  if (nb < 0) return 'merged';
  if (nb < 60) return 0;
  let best = 99;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    if (comp[y * W + x] !== 1) continue;
    for (const [dx, dy] of D4) {
      let k = 1; while (k <= 4 && x + dx * k >= 0 && y + dy * k >= 0 && x + dx * k < W && y + dy * k < Hh && !land[(y + dy * k) * W + x + dx * k]) k++;
      const xe = x + dx * k, ye = y + dy * k;
      if (k > 1 && xe >= 0 && ye >= 0 && xe < W && ye < Hh && comp[ye * W + xe] === 2) best = Math.min(best, k - 1);
    }
  }
  return best;
}

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
  // on a grown map the first map's squares are labelled first, in their old order, so its islands keep their numbers
  // and each expedition ring's squares after that, ring by ring, so every ring's islands keep theirs too
  const bx = w.box, order: number[] = [], ringStart: number[] = [];
  if (bx) {
    const R = bx.o / RING_W, seen = new Uint8Array(n * n);
    for (let r = 0; r <= R; r++) {
      ringStart.push(order.length);
      const a = bx.o - r * RING_W, b = bx.o + bx.n0 + r * RING_W;
      for (let y = a; y < b; y++) for (let x = a; x < b; x++) { const i = y * n + x; if (!seen[i]) { seen[i] = 1; order.push(i); } }
    }
  } else for (let i = 0; i < n * n; i++) order.push(i);
  const ringOf: number[] = []; let ring = 0;
  for (let h0 = 0; h0 < order.length; h0++) {
    const i = order[h0]!;
    while (ring + 1 < ringStart.length && h0 >= ringStart[ring + 1]!) ring++;
    if (!terr[i] || islandOf[i]! >= 0) continue;
    ringOf[list.length] = ring;
    const q = [i], k = list.length; islandOf[i] = k;
    let sx = 0, sy = 0;
    for (let h = 0; h < q.length; h++) {
      const j = q[h]!, x = j % n, y = (j / n) | 0; sx += x; sy += y;
      for (const [dx, dy] of D4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const m = nx + ny * n; if (terr[m] && islandOf[m]! < 0) { islandOf[m] = k; q.push(m); } }
    }
    const cx = sx / q.length, cy = sy / q.length;
    list.push({ size: q.length, cx, cy, dist: Math.hypot(cx - w.cx, cy - w.cy) });
  }
  // names go nearest the centre first; on a grown map the first map's islands keep theirs and the new ones follow
  const big = list.map((_, k) => k).filter(k => list[k]!.size >= 40).sort((a, b) => ringOf[a]! - ringOf[b]! || list[a]!.dist - list[b]!.dist);
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
