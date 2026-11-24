/**
 * 🚉 City Lines (Sébastien, 2026-11-24: "I want to build tracks, explore maps, connect cities and have trains travel
 * from one city to the other", and "a clear goal for the game"). A separate preview mode on the real engine:
 * - no goods, industries or orders: trains carry travellers between the cities you have linked by rail;
 * - fares are the only money; cities grow from the visitors they get, and each time one grows you pick 1 of 3
 *   shuffled buildings for it (he liked the random picks);
 * - the goal is the 🏁 Grand Line: link each island's capital, one island after another, out to Kingsport.
 */
import type { Game, Site } from '../state.ts';
import type { Train } from '../trains/train.ts';
import { yardSet } from '../buildings/industries.ts';
import { hallOf } from '../buildings/stations.ts';
import { railDist, payFor } from '../economy/shipping.ts';
import { sameRail, railIsleAt } from '../track/isles.ts';
import { reveal } from '../world/fog.ts';
import { chartIslands } from '../world/explore.ts';
import { islandName } from '../ships/docks.ts';
import { sizeCap } from '../economy/towns.ts';

export interface ClState {
  /** travellers waiting at a city for another: key "from>to" */
  pax: Record<string, number>;
  /** visitors each city has had since it last grew */
  vis: Record<number, number>;
  /** buildings picked: town id and kind */
  blds: { town: number; k: BldKind }[];
  /** cities that may pick a building now (in order) */
  picks: number[];
  /** picks granted so far, and how many of their cards already opened by themselves */
  granted: number;
  shown?: number;
  /** the Grand Line: islands in order (Ashford Isle first) and each one's capital (town ids), the last is Kingsport */
  isles: number[];
  caps: number[];
  /** goal steps done (see STEPS) */
  step: number;
  /** travellers carried in all */
  carried: number;
  /** finale card shown */
  fin?: boolean;
  /** goal steps whose card already opened */
  seen?: number;
}

export const cl = (g: Game): ClState | undefined => (g.s as { cl?: ClState }).cl;

// ---------------------------------------------------------------- city buildings (1 of 3 picks)

export type BldKind = 'hotel' | 'market' | 'school' | 'theatre' | 'museum' | 'park' | 'inn' | 'post' | 'street' | 'tram' | 'works' | 'coaches' | 'surveyor' | 'lookout' | 'bank';
export const BLDS: Record<BldKind, { icon: string; name: string; text: string; global?: boolean }> = {
  hotel:    { icon: '🏨', name: 'Grand Hotel', text: '+40% travellers come here' },
  market:   { icon: '🧺', name: 'Market Hall', text: '+30% travellers set off from here' },
  school:   { icon: '🏫', name: 'School', text: 'grows 30% faster from visitors' },
  theatre:  { icon: '🎭', name: 'Theatre', text: '+30% travellers come here' },
  museum:   { icon: '🏛', name: 'Museum', text: 'fares to here pay 25% more' },
  park:     { icon: '🌳', name: 'Park', text: 'grows 20% faster, and +10% travellers come here' },
  inn:      { icon: '🍺', name: 'Railway Inn', text: 'fares from here pay 20% more' },
  post:     { icon: '📮', name: 'Post Office', text: '+$40 for every train that stops here' },
  street:   { icon: '🏘', name: 'New Street', text: '+25% travellers set off from here' },
  tram:     { icon: '🚋', name: 'Tram Line', text: '+15% travellers both ways, and more can wait' },
  works:    { icon: '🛠', name: 'Engine Works', text: 'every train runs 10% faster', global: true },
  coaches:  { icon: '🚃', name: 'Coach Works', text: 'every train carries 20% more travellers', global: true },
  surveyor: { icon: '🧭', name: "Surveyor's Office", text: 'uncovers the land 14 squares around this city' },
  lookout:  { icon: '🗼', name: 'Lookout Tower', text: 'shows the coast and cities of the 2 nearest islands' },
  bank:     { icon: '🏦', name: 'Bank', text: 'every fare on the railway pays 5% more', global: true },
};
const KINDS = Object.keys(BLDS) as BldKind[];
const count = (g: Game, k: BldKind, t?: Site) => cl(g)?.blds.filter(b => b.k === k && (!t || b.town === t.id)).length ?? 0;
export const bldsOf = (g: Game, t: Site) => cl(g)?.blds.filter(b => b.town === t.id).map(b => b.k) ?? [];

/** Train speed and size from the global buildings. */
export const clSpeed = (g: Game) => cl(g) ? 1 + 0.1 * count(g, 'works') : 1;
export const clCap = (g: Game) => cl(g) ? 2 * (1 + 0.2 * count(g, 'coaches')) : 1; // coaches seat 40 travellers to a wagon set's 20 goods

// ---------------------------------------------------------------- setup: the Grand Line

export function setupLines(g: Game) {
  const w = g.world, n = w.n;
  // every settlement site on Ashford Isle is a city waiting for the railway
  for (const s of g.s.sites) if (s.kind === 'plot' && w.islandOf[s.y * n + s.x] === w.home) Object.assign(s, { kind: 'town', pop: 0, lvl: 0, got: {} });
  const isles = [w.home], caps = [g.s.sites[0]!.id];
  const A = g.s.sites[0]!; let at = { x: A.x, y: A.y }, far = 0;
  for (let k = 0; k < 3; k++) {
    // always outward: the next island is farther from Ashford than the last, and the nearest such to the last capital
    let best = -1, bd = Infinity;
    w.islands.forEach((isl, i) => { if (isles.includes(i) || !isl.name || isl.size < 120 || Math.hypot(isl.cx - A.x, isl.cy - A.y) < far + 12) return; const d = Math.hypot(isl.cx - at.x, isl.cy - at.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) break;
    // the capital: a city on that island nearest the last capital (a settlement site becomes one if need be)
    const on = g.s.sites.filter(s => (s.kind === 'town' || s.kind === 'plot') && w.islandOf[s.y * n + s.x] === best)
      .sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
    const c = on[0]; if (!c) continue;
    if (c.kind === 'plot') Object.assign(c, { kind: 'town', pop: 0, lvl: 0, got: {} });
    for (const s of on) if (s.kind === 'plot') Object.assign(s, { kind: 'town', pop: 0, lvl: 0, got: {} });
    isles.push(best); caps.push(c.id); at = { x: c.x, y: c.y }; far = Math.hypot(w.islands[best]!.cx - A.x, w.islands[best]!.cy - A.y);
  }
  const last = g.s.sites.find(s => s.id === caps.at(-1));
  if (last && caps.length > 1) last.name = 'Kingsport';
  (g.s as { cl?: ClState }).cl = { pax: {}, vis: {}, blds: [], picks: [], granted: 0, isles, caps, step: 0, carried: 0 };
  g.s.tut = undefined; // City Lines has its own goal cards instead of the lessons
}

const town = (g: Game, id: number) => g.s.sites.find(s => s.id === id && s.kind === 'town');
const hall = (g: Game, t: Site) => hallOf(g.track, g.world.n, t, g.world.terr, yardSet(g));
/** A city joined to the railway (its station on the network that reaches Ashford, by rail or by sea). */
export function cityLinked(g: Game, t: Site): boolean { const h = hall(g, t); return !!h && !!g.linked?.has(h.squares[1]!); }
/** Rail squares between two cities' stations, or -1 when no track joins them. */
export function cityDist(g: Game, a: Site, b: Site): number {
  const ha = hall(g, a), hb = hall(g, b); if (!ha || !hb) return -1;
  return railDist(g, 't' + b.id, hb.squares)[ha.squares[1]!]!;
}

// ---------------------------------------------------------------- the goal

export interface Step { text: string; how: string; at?: { x: number; y: number }; done: (g: Game) => boolean }
const linkedCount = (g: Game) => g.s.sites.filter(s => s.kind === 'town' && s.id !== g.s.sites[0]!.id && cityLinked(g, s) && sameRail(g, g.world.islandOf[s.y * g.world.n + s.x]!, g.world.home)).length;
export function steps(g: Game): Step[] {
  const c = cl(g)!, out: Step[] = [
    { text: 'Link a city to Ashford', how: 'Tap 🛤 Rails and paint track from Ashford to the nearest city’s station. Cities only send travellers to cities they’re linked to.', done: g => linkedCount(g) >= 1 },
    { text: 'Buy your first train', how: 'Tap 🚂 Trains and buy one. It runs by itself: it picks up travellers at one city and takes them to the other.', done: g => g.s.trains.length + (g.s.ferries?.length ?? 0) >= 1 },
    { text: 'Link a third city', how: 'Every new city on the line sends travellers to all the others, so each link adds more trips. Farther cities pay more.', done: g => linkedCount(g) >= 2 },
    { text: 'Carry 150 travellers', how: 'Add trains if travellers pile up at the stations. Tap a city to see who is waiting.', done: g => cl(g)!.carried >= 150 },
    { text: 'Grow a city', how: 'Visitors make a city grow. When its bar is full, tap ⬆ on its card and pick 1 of 3 buildings.', done: g => g.s.sites.some(s => s.kind === 'town' && (s.lvl ?? 0) >= 1) },
  ];
  for (let k = 1; k < c.caps.length; k++) {
    const t = town(g, c.caps[k]!), isl = c.isles[k]!, last = k === c.caps.length - 1;
    out.push({ text: last ? `Reach Kingsport, the great city of ${islandName(g, isl)}` : `Link ${t?.name ?? 'the capital'}, capital of ${islandName(g, isl)}`,
      how: k === 1 ? 'Islands are reached by sea: build a ⚓ Dock on your coast and a landing on the far shore (Build menu), then lay track from the landing to the capital’s station. Ships carry your trains over.' : 'Sail on: a ⚓ Dock facing the next island, a landing on it, and track to its capital. Link its other cities too: more travellers, more money for the crossing.',
      at: t ? { x: t.x, y: t.y } : undefined, done: g => !!t && cityLinked(g, t) });
  }
  return out;
}
/** The step being worked on now, its number (1-based) and how many there are. */
export function goalNow(g: Game): { s: Step | undefined; n: number; of: number } {
  const all = steps(g), c = cl(g)!; return { s: all[c.step], n: c.step + 1, of: all.length };
}

// ---------------------------------------------------------------- travellers

/** Travellers per minute from a to b: bigger cities travel more; buildings add to it. */
function rate(g: Game, a: Site, b: Site): number {
  const La = a.lvl ?? 0, Lb = b.lvl ?? 0;
  const from = 1 + 0.3 * count(g, 'market', a) + 0.25 * count(g, 'street', a) + 0.15 * count(g, 'tram', a);
  const to = 1 + 0.4 * count(g, 'hotel', b) + 0.3 * count(g, 'theatre', b) + 0.1 * count(g, 'park', b) + 0.15 * count(g, 'tram', b);
  const capital = (a === g.s.sites[0] ? 1.5 : 1) * (b === g.s.sites[0] ? 1.5 : 1);
  return 4 * (1 + 0.5 * La) * (1 + 0.5 * Lb) * from * to * capital;
}
export const waitCap = (g: Game, a: Site) => 40 * (1 + (a.lvl ?? 0)) * (1 + 0.5 * count(g, 'tram', a));
/** Visitors a city needs to grow from each size. */
export const growNeed = (L: number) => [60, 160, 360, 700, 1200][L] ?? Math.round(1200 * Math.pow(1.5, L - 4));
/** The fare for n travellers over d rail squares. */
export function fare(g: Game, a: Site, b: Site, n: number, d: number): number {
  const m = (1 + 0.25 * count(g, 'museum', b)) * (1 + 0.2 * count(g, 'inn', a)) * (1 + 0.05 * count(g, 'bank'));
  return payFor('farm', n, d, 'order') * 1.1 * m;
}
/** The other cities a city's travellers can go to now: linked, on the same rail island, track joining them. */
export function partners(g: Game, a: Site): { b: Site; d: number }[] {
  if (!cityLinked(g, a)) return [];
  const n = g.world.n, ia = railIsleAt(g, a.y * n + a.x), out: { b: Site; d: number }[] = [];
  for (const b of g.s.sites) {
    if (b === a || b.kind !== 'town' || !cityLinked(g, b) || railIsleAt(g, b.y * n + b.x) !== ia) continue;
    const d = cityDist(g, a, b); if (d > 0) out.push({ b, d });
  }
  return out;
}
export const waiting = (g: Game, a: Site, b: Site) => Math.floor(cl(g)?.pax[`${a.id}>${b.id}`] ?? 0);
export const waitingAt = (g: Game, a: Site) => Object.entries(cl(g)?.pax ?? {}).reduce((s, [k, v]) => s + (k.startsWith(a.id + '>') ? Math.floor(v) : 0), 0);

/** Each second: travellers turn up, goal steps tick over. Returns news lines. */
export function tickLines(g: Game, dt: number): string[] {
  const c = cl(g); if (!c) return [];
  const out: string[] = [];
  for (const a of g.s.sites) {
    if (a.kind !== 'town') continue;
    if (cityLinked(g, a)) { const L = a.lvl ?? 0, lo = L === 0 ? 15 : sizeCap(L - 1); a.pop = Math.max(a.pop ?? 0, Math.round(lo + (sizeCap(L) - lo) * growProgress(g, a))); }
    const ps = partners(g, a); if (!ps.length) continue;
    const cap = waitCap(g, a);
    for (const { b } of ps) { const k = `${a.id}>${b.id}`; c.pax[k] = Math.min(cap, (c.pax[k] ?? 0) + rate(g, a, b) * dt / 60); }
  }
  // goal steps
  const all = steps(g);
  while (c.step < all.length && all[c.step]!.done(g)) {
    const s = all[c.step]!; c.step++;
    const capK = c.caps.findIndex((id, k) => k > 0 && s.at && town(g, id)?.x === s.at.x && town(g, id)?.y === s.at.y);
    if (capK > 0) {
      const t = town(g, c.caps[capK]!)!; c.picks.push(t.id); c.granted++;
      reveal(g, t.x, t.y, 8);
      out.push(capK === c.caps.length - 1 ? `🏁 The Grand Line reaches Kingsport! You did it` : `👑 ${t.name} is on the Grand Line! Pick a building for it, then sail on`);
    } else out.push(`✅ ${s.text}: done!${c.step < all.length ? ` Next: ${all[c.step]!.text}` : ''}`);
  }
  return out;
}

/** Visitors arrive: the city grows toward its next size (and the one they left a little too). */
export function visit(g: Game, from: Site, to: Site, n: number) {
  const c = cl(g)!;
  const gm = (t: Site) => (1 + 0.3 * count(g, 'school', t) + 0.2 * count(g, 'park', t));
  c.vis[to.id] = (c.vis[to.id] ?? 0) + n * gm(to);
  c.vis[from.id] = (c.vis[from.id] ?? 0) + n * 0.35 * gm(from);
  c.carried += n;
  for (const t of [to, from]) {
    const L = t.lvl ?? 0;
    if (!t.filled && (c.vis[t.id] ?? 0) >= growNeed(L)) t.filled = true;
  }
}
/** How far the city is toward growing, 0-1. */
export const growProgress = (g: Game, t: Site) => Math.min(1, (cl(g)?.vis[t.id] ?? 0) / growNeed(t.lvl ?? 0));

/** The city grew (the player tapped ⬆): visitors start again toward the next size, and it picks a building. */
export function cityGrew(g: Game, t: Site) {
  const c = cl(g); if (!c) return;
  c.vis[t.id] = 0; c.picks.push(t.id); c.granted++;
}

/** 3 shuffled buildings for a city's pick (never one it already has, unless every train benefits). */
export function choices(g: Game, t: Site): BldKind[] {
  const have = new Set(bldsOf(g, t)), ok = KINDS.filter(k => BLDS[k].global || !have.has(k));
  const seed = (g.s.seed >>> 0) + t.id * 131 + (cl(g)?.granted ?? 0) * 977;
  let s = seed % 2147483647 || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pool = [...ok], out: BldKind[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]!);
  return out;
}
export function pickBld(g: Game, townId: number, k: BldKind): string {
  const c = cl(g); if (!c) return '';
  if (c.picks[0] !== townId) return 'Pick for the city shown first';
  const t = town(g, townId); if (!t) return 'That city is gone';
  if (!choices(g, t).includes(k)) return 'That building is not on offer';
  c.picks.shift(); c.blds.push({ town: t.id, k });
  if (k === 'surveyor') reveal(g, t.x, t.y, 14);
  if (k === 'lookout') chartIslands(g, t.x, t.y, 2);
  return '';
}
/** Which card should open by itself: a pick, a new goal step, the finale. */
export function clNext(g: Game): string | undefined {
  const c = cl(g); if (!c) return;
  if (c.picks.length && (c.shown ?? 0) < c.granted - c.picks.length + 1) { c.shown = c.granted - c.picks.length + 1; return 'pick'; }
  const all = steps(g);
  if (c.step >= all.length && !c.fin) { c.fin = true; return 'fin'; }
  if ((c.seen ?? -1) < c.step && c.step < all.length) { c.seen = c.step; return 'goal'; }
  return undefined;
}

// ---------------------------------------------------------------- trains carry travellers

/** The best trip for an idle train: travellers waiting, fare per square run (empty to the pickup, then loaded). */
export function bestTrip(g: Game, t: Train, at: number, cap: number): { a: Site; b: Site; d: number; n: number } | null {
  let best: { a: Site; b: Site; d: number; n: number } | null = null, bs = 0;
  for (const a of g.s.sites) {
    if (a.kind !== 'town') continue;
    const h = hall(g, a); if (!h) continue;
    const reach = railDist(g, 't' + a.id, h.squares)[at]!; if (reach < 0) continue;
    for (const { b, d } of partners(g, a)) {
      const w = waiting(g, a, b), claimedN = g.s.trains.reduce((s, o) => s + (o !== t && o.job?.src === -a.id - 1 && o.job.to.id === b.id && o.job.phase !== 'toDrop' && o.job.phase !== 'unloading' ? cap : 0), 0);
      const n = Math.min(cap, w - claimedN); if (n < Math.min(8, cap * 0.3)) continue;
      const s = fare(g, a, b, n, d) / (reach + d + 10);
      if (s > bs) { bs = s; best = { a, b, d, n }; }
    }
  }
  return best;
}
/** 📮 Post Offices: a bonus for each train that stops at a city with one (at either end of the trip). */
export const postBonus = (g: Game, a: Site, b: Site) => 40 * (count(g, 'post', a) + count(g, 'post', b));
