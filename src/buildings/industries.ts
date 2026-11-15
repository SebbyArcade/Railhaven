import type { Game, Site } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { T } from '../world/terrain.ts';
import { isMountainFoot } from '../world/sites.ts';
import { stationLinkError } from './stations.ts';

/** Goods and what they are worth per unit (the old game's `rate`). */
export const GOODS = {
  wood: { name: 'Wood', icon: '🪵', value: 5 },
  farm: { name: 'Wheat', icon: '🌾', value: 7 },
  stone: { name: 'Stone', icon: '🪨', value: 5 },
  coal: { name: 'Coal', icon: '⚫', value: 6 },
  iron: { name: 'Iron', icon: '🧲', value: 9 },
  oil: { name: 'Oil', icon: '🛢', value: 12 },
  wool: { name: 'Wool', icon: '🐑', value: 10 },
  planks: { name: 'Planks', icon: '🪚', value: 14 },
  bricks: { name: 'Bricks', icon: '🧱', value: 14 },
  flour: { name: 'Flour', icon: '🍞', value: 18 },
  steel: { name: 'Steel', icon: '⚙️', value: 30 },
  fuel: { name: 'Fuel', icon: '⛽', value: 45 },
  cloth: { name: 'Cloth', icon: '🧵', value: 24 },
} as const;
export type Good = keyof typeof GOODS;

type KindInfo = { name: string; icon: string; makes: Good; price: number; rate: number; needs: string; in?: Partial<Record<Good, number>>; unlock?: number };

/**
 * What the player builds: industries that dig or grow raw goods, and factories (Railway level 1+) that turn one
 * raw good into a product (the Steel Mill needs coal and iron). Factories stand on any open flat land.
 */
export const INDUSTRIES = {
  wood: { name: 'Lumber Camp', icon: '🪵', makes: 'wood', price: 600, rate: 1.1, needs: 'forest next to it' },
  farm: { name: 'Wheat Farm', icon: '🌾', makes: 'farm', price: 800, rate: 1.1, needs: 'open grass for fields' },
  stone: { name: 'Stone Quarry', icon: '🪨', makes: 'stone', price: 800, rate: 1.1, needs: 'a rock outcrop at the foot of mountains' },
  coal: { name: 'Coal Mine', icon: '⚫', makes: 'coal', price: 1000, rate: 1.1, needs: 'a coal seam at the foot of mountains' },
  iron: { name: 'Iron Mine', icon: '🧲', makes: 'iron', price: 1500, rate: 1.1, needs: 'an iron deposit (outer islands)' },
  oil: { name: 'Oil Well', icon: '🛢', makes: 'oil', price: 2500, rate: 0.6, needs: 'an oil seep (outer islands)' },
  wool: { name: 'Sheep Farm', icon: '🐑', makes: 'wool', price: 900, rate: 1.1, needs: 'hills with pasture' },
  sawmill: { name: 'Sawmill', icon: '🪚', makes: 'planks', price: 2500, rate: 0.6, needs: 'open flat land', in: { wood: 1 }, unlock: 1 },
  brickworks: { name: 'Brickworks', icon: '🧱', makes: 'bricks', price: 2500, rate: 0.6, needs: 'open flat land', in: { stone: 1 }, unlock: 1 },
  gristmill: { name: 'Flour Mill', icon: '🍞', makes: 'flour', price: 2500, rate: 0.6, needs: 'open flat land', in: { farm: 1 }, unlock: 1 },
  mill: { name: 'Steel Mill', icon: '⚙️', makes: 'steel', price: 2500, rate: 0.6, needs: 'open flat land', in: { coal: 1, iron: 1 }, unlock: 2 },
  refinery: { name: 'Refinery', icon: '⛽', makes: 'fuel', price: 2500, rate: 0.6, needs: 'open flat land', in: { oil: 1 }, unlock: 2 },
  textile: { name: 'Textile Mill', icon: '🧵', makes: 'cloth', price: 2500, rate: 0.6, needs: 'open flat land', in: { wool: 1 }, unlock: 3 },
} as const satisfies Record<string, KindInfo>;
export type IndustryKind = keyof typeof INDUSTRIES;
export const info = (k: IndustryKind): KindInfo => INDUSTRIES[k];
export const isFactory = (k: IndustryKind) => !!info(k).in;
/** goods a factory takes in */
export const inputsOf = (k: IndustryKind) => Object.keys(info(k).in ?? {}) as Good[];
/** input store per good, by level */
export const bufOf = (b: Building) => 30 + 20 * b.lvl;
/** Why this kind can't be built yet (Railway level), or '' */
export const lockedText = (g: Game, k: IndustryKind) => (info(k).unlock ?? 0) > (g.s.rlv ?? 0) ? `🔒 Unlocks at Railway level ${info(k).unlock}` : '';
const MINES = new Set<IndustryKind>(['stone', 'coal', 'iron', 'oil']);

/**
 * A building and its yard. The yard is a row of four track squares (two loading tracks, entered at the ends);
 * the building stands on the row of four squares beside it.
 */
export interface Building {
  id: number;
  kind: IndustryKind;
  /** west/north end of the yard track */
  x: number;
  y: number;
  horizontal: boolean;
  /** which side of the yard the building row is on: +1 south/east, -1 north/west */
  side: 1 | -1;
  lvl: number;
  stock: number;
  /** factories: raw goods waiting to be made into the product */
  inbuf?: Partial<Record<Good, number>>;
  /** the deposit a mine stands on */
  dep?: number;
}

export const YARD_LEN = 4;

export function yardSquares(n: number, b: Pick<Building, 'x' | 'y' | 'horizontal'>): number[] {
  const out: number[] = [];
  for (let k = 0; k < YARD_LEN; k++) out.push(b.horizontal ? b.y * n + b.x + k : (b.y + k) * n + b.x);
  return out;
}
export function buildingSquares(n: number, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>): number[] {
  return yardSquares(n, b).map(i => b.horizontal ? i + b.side * n : i + b.side);
}
export const footprint = (n: number, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>) => [...yardSquares(n, b), ...buildingSquares(n, b)];

/** Price of the next building of this kind: +25% for every one already built. */
export function priceOf(g: Game, kind: IndustryKind): number {
  const have = (g.s.buildings ?? []).filter(b => b.kind === kind).length;
  return Math.round(INDUSTRIES[kind].price * Math.pow(1.25, have) / 50) * 50;
}

/** Squares within `r` of the building row (for forest, fields and pasture). */
function around(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side'>, r: number): number[] {
  const n = g.world.n, own = new Set(footprint(n, b)), out = new Set<number>();
  for (const i of buildingSquares(n, b)) {
    const x = i % n, y = (i / n) | 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const j = Y * n + X; if (!own.has(j)) out.add(j);
    }
  }
  return [...out];
}

/** How much of its full output the place gives (forest, fields or pasture around it), 0-1. `extra`: squares about to be built on. */
export function shareAt(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>, extra?: Set<number>): number {
  const t = g.world.terr, taken = takenSquares(g), free = (i: number) => !taken.has(i) && !extra?.has(i);
  if (b.kind === 'wood') return Math.min(1, around(g, b, 2).filter(i => t[i] === T.Forest && free(i)).length / 6);
  if (b.kind === 'farm') return Math.min(1, around(g, b, 1).filter(i => t[i] === T.Grass && free(i)).length / 6);
  if (b.kind === 'wool') return Math.min(1, around(g, b, 1).filter(i => (t[i] === T.Hills || t[i] === T.Grass) && free(i)).length / 6);
  return 1;
}

/** The squares a wheat or sheep farm works (its fields or pasture): free grass next to it, at most six. */
export function fieldSquares(g: Game, b: Building): number[] {
  if (b.kind !== 'farm' && b.kind !== 'wool') return [];
  const t = g.world.terr, taken = takenSquares(g);
  return around(g, b, 1).filter(i => (t[i] === T.Grass || (b.kind === 'wool' && t[i] === T.Hills)) && !taken.has(i)).slice(0, 6);
}

/** Buildings that would make less if these squares were built on, and how much less per minute. */
export function harmOf(g: Game, squares: number[]): { b: Building; lost: number }[] {
  const extra = new Set(squares), out: { b: Building; lost: number }[] = [];
  for (const b of g.s.buildings ?? []) {
    if (b.kind !== 'wood' && b.kind !== 'farm' && b.kind !== 'wool') continue;
    const before = shareAt(g, b), after = shareAt(g, b, extra);
    if (after < before) out.push({ b, lost: Math.round(INDUSTRIES[b.kind].rate * (1 + 0.5 * (b.lvl - 1)) * (before - after) * 60) });
  }
  return out;
}
export const harmText = (h: { b: Building; lost: number }[]) => h.length ? ` · ⚠ covers ${h.map(x => `${x.b.kind === 'wood' ? 'trees' : 'fields'} of the ${INDUSTRIES[x.b.kind].name} (−${x.lost}/min)`).join(', ')}` : '';

/** Squares already used by track, buildings, towns and the shed. */
export function takenSquares(g: Game, except?: Building): Set<number> {
  const key = `${g.track.size}/${g.s.buildings?.length ?? 0}/${g.s.shed?.x},${g.s.shed?.y}`;
  if (!except && g.taken?.key === key && g.taken.net === g.net) return g.taken.set;
  const n = g.world.n, out = new Set<number>(g.track.keys());
  for (const b of g.s.buildings ?? []) if (b !== except) for (const i of footprint(n, b)) out.add(i);
  for (const s of g.s.sites) if (s.kind === 'town') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.add((s.y + dy) * n + s.x + dx);
  if (g.s.shed) out.add(g.s.shed.y * n + g.s.shed.x);
  if (!except) g.taken = { key, net: g.net, set: out };
  return out;
}

/**
 * Can this building go here? Returns the reason in plain words (and what to do instead), or ''.
 * Placement is permissive: any spot that works is allowed.
 */
export function placeError(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>): string {
  const n = g.world.n, info = INDUSTRIES[b.kind], taken = takenSquares(g), t = g.world.terr;
  const fp = footprint(n, b); // mines dig into the mountain: their building row may stand on it
  for (const i of fp) {
    const x = i % n, y = (i / n) | 0;
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return 'Too close to the edge of the map';
    if (!isRevealed(g, i)) return 'Part of this spot is still in the fog: explore it first';
    if (t[i] === T.Water) return 'Part of this spot is water: pick dry land';
    if (t[i] === T.Mountain && !(MINES.has(b.kind) && buildingSquares(n, b).includes(i))) return 'The yard track can\'t go on mountain: turn it to the flat land';
    if (taken.has(i)) return 'Something is already built here: pick an open spot';
    const s = g.s.sites.find(o => o.x === x && o.y === y);
    if (s && s.kind === 'plot') return 'A settlement site is here: keep it free for a town';
    if (s && s.kind === 'dep' && !(MINES.has(b.kind) && buildingSquares(n, b).includes(i) && s.res === info.makes)) return 'A deposit is here: only a mine for it can stand on it';
  }
  if (MINES.has(b.kind)) {
    const dep = depositUnder(g, b);
    if (!dep) return `A ${info.name} must stand on ${info.needs}`;
    if (!isMountainFoot(g.world, dep.x, dep.y) && (b.kind === 'stone' || b.kind === 'coal')) return 'This deposit is not at the foot of mountains';
  } else if (shareAt(g, b) < 2 / 6) {
    return `A ${info.name} needs ${info.needs}: there is too little here`;
  }
  return '';
}

export function depositUnder(g: Game, b: Pick<Building, 'x' | 'y' | 'horizontal' | 'side' | 'kind'>): Site | undefined {
  const n = g.world.n, sq = new Set(buildingSquares(n, b)), res = INDUSTRIES[b.kind].makes;
  return g.s.sites.find(s => s.kind === 'dep' && !s.hidden && s.res === res && sq.has(s.y * n + s.x));
}

/** Every way the building could stand with its building row on square (x, y): both directions, both sides. */
export function placementsAt(kind: IndustryKind, x: number, y: number) {
  const out: { x: number; y: number; horizontal: boolean; side: 1 | -1; kind: IndustryKind }[] = [];
  for (const horizontal of [true, false]) for (const side of [1, -1] as const) for (let k = 0; k < YARD_LEN; k++) {
    // the tapped square is in the building row; the yard runs beside it
    const yx = horizontal ? x - k : x - side, yy = horizontal ? y - side : y - k;
    out.push({ x: yx, y: yy, horizontal, side, kind });
  }
  return out;
}

/** The best way to place a building with its building row on (x, y): fits, most output, yard nearest the network. */
export function bestPlacement(g: Game, kind: IndustryKind, x: number, y: number) {
  const n = g.world.n;
  let best: ReturnType<typeof placementsAt>[number] | null = null, bs = -Infinity, why = '';
  for (const p of placementsAt(kind, x, y)) {
    const e = placeError(g, p);
    if (e) { why ||= e; continue; }
    const ends = yardSquares(n, p), a = ends[0]!, z = ends[YARD_LEN - 1]!;
    let near = 99;
    for (const i of g.track.keys()) { const d = Math.min(dist(n, a, i), dist(n, z, i)); if (d < near) near = d; }
    const s = shareAt(g, p) * 10 - near * 0.5;
    if (s > bs) { bs = s; best = p; }
  }
  return best ? { place: best, why: '' } : { place: null, why: why || 'No room for a 2×4 yard here' };
}
const dist = (n: number, a: number, b: number) => Math.abs((a % n) - (b % n)) + Math.abs(((a / n) | 0) - ((b / n) | 0));

/** Build it: pay, lay the yard track, and add it. */
export function build(g: Game, p: ReturnType<typeof placementsAt>[number]): Building | string {
  const e = lockedText(g, p.kind) || placeError(g, p); if (e) return e;
  const price = priceOf(g, p.kind);
  if (price > g.s.money) return `Need $${(price - g.s.money).toLocaleString('en-US')} more`;
  g.s.money -= price;
  const dep = depositUnder(g, p);
  const b: Building = { id: g.s.nextId++, ...p, lvl: 1, stock: 0, ...(dep ? { dep: dep.id } : {}) };
  (g.s.buildings ??= []).push(b);
  // the yard's own track: four squares in a line
  const n = g.world.n, sq = yardSquares(n, b);
  for (let k = 0; k < sq.length; k++) {
    const cur = g.track.get(sq[k]!) ?? { links: 0 };
    const along = b.horizontal ? (k > 0 ? 1 << 2 : 0) | (k < sq.length - 1 ? 1 : 0) : (k > 0 ? 1 << 3 : 0) | (k < sq.length - 1 ? 1 << 1 : 0);
    cur.links |= along; g.track.set(sq[k]!, cur);
  }
  joinYardEnds(g, b);
  return b;
}

/** A yard placed with an end against existing track joins it there (only at its ends, as everywhere). Returns how many ends joined. */
export function joinYardEnds(g: Game, b: Building): number {
  const n = g.world.n, sq = yardSquares(n, b), step = b.horizontal ? 1 : n;
  const out = b.horizontal ? [2, 0] : [3, 1]; // direction out of the first end, out of the last end
  let joined = 0;
  [[sq[0]!, sq[0]! - step, out[0]!], [sq.at(-1)!, sq.at(-1)! + step, out[1]!]].forEach(([end, next, d]) => {
    const o = g.track.get(next!); if (!o) return;
    if (stationLinkError(g.track, n, g.s.sites, end!, next!) || yardLinkError(g, end!, next!)) return;
    g.track.get(end!)!.links |= 1 << d!; o.links |= 1 << ((d! + 2) % 4); joined++;
  });
  return joined;
}

/** Output per second, stock cap (by level). */
export const outputOf = (g: Game, b: Building) => isFactory(b.kind) ? 0.35 + 0.25 * b.lvl : INDUSTRIES[b.kind].rate * (1 + 0.5 * (b.lvl - 1)) * shareAt(g, b);
export const capOf = (b: Building) => 80 + 40 * (b.lvl - 1);

/** Why linking neighbour squares a and b would break a yard (joined from its long side), or ''. */
export function yardLinkError(g: Game, a: number, b: number): string {
  const n = g.world.n, horizontalLink = ((a / n) | 0) === ((b / n) | 0);
  for (const bd of g.s.buildings ?? []) {
    const sq = yardSquares(n, bd);
    if ((sq.includes(a) || sq.includes(b)) && horizontalLink !== bd.horizontal) return `Track can only enter the ${INDUSTRIES[bd.kind].name}'s yard at its two ends`;
    const bs = buildingSquares(n, bd);
    if (bs.includes(a) || bs.includes(b)) return `The ${INDUSTRIES[bd.kind].name} stands here`;
  }
  return '';
}

/** Track squares joined to Ashford by rails (loose yards are not part of the railway until track reaches them). */
export function linkedSquares(g: Game): Set<number> {
  const n = g.world.n, a = g.s.sites[0]!, start = a.y * n + a.x, out = new Set<number>();
  if (!g.track.has(start)) return out;
  const q = [start]; out.add(start);
  for (let h = 0; h < q.length; h++) {
    const i = q[h]!, sq = g.track.get(i)!;
    for (const [d, j] of [[0, i + 1], [1, i + n], [2, i - 1], [3, i - n]] as const) {
      if (!(sq.links & (1 << d)) || out.has(j)) continue;
      const o = g.track.get(j); if (!o || !(o.links & (1 << ((d + 2) % 4)))) continue;
      out.add(j); q.push(j);
    }
  }
  return out;
}

export const isLinked = (g: Game, b: Building) => g.linked?.has(yardSquares(g.world.n, b)[0]!) ?? false;

/**
 * The nearest place on uncovered land where this kind fits, searching out from (cx, cy); null when there is none.
 * Mines only look at their deposits; other kinds look within `R` squares.
 */
export function nearestSpot(g: Game, kind: IndustryKind, cx: number, cy: number, R = 30): { x: number; y: number } | null {
  const n = g.world.n;
  if (MINES.has(kind)) {
    const res = INDUSTRIES[kind].makes;
    const deps = g.s.sites.filter(s => s.kind === 'dep' && s.res === res && !s.hidden && isRevealed(g, s.y * n + s.x))
      .sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
    for (const d of deps) if (bestPlacement(g, kind, d.x, d.y).place) return { x: d.x, y: d.y };
    return null;
  }
  for (let r = 0; r <= R; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1 || !isRevealed(g, y * n + x)) continue;
    if (bestPlacement(g, kind, x, y).place) return { x, y };
  }
  return null;
}

/** Why there is nowhere to build this kind yet, and what to do. */
export const noSpotText = (kind: IndustryKind) => MINES.has(kind)
  ? `No ${INDUSTRIES[kind].needs.replace(/^an? /, '').replace(/ at the foot of mountains| \(outer islands\)/, '')} uncovered yet: lay track toward the mountains to uncover more land`
  : `No room for a ${INDUSTRIES[kind].name} on uncovered land: it needs ${INDUSTRIES[kind].needs}`;
