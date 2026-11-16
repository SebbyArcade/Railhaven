import { Rng } from '../core/rng.ts';
import type { Game, GameState, Resource, Site } from '../state.ts';
import type { Building } from '../buildings/industries.ts';
import { chartSea, isDock, linkedDocks } from '../ships/docks.ts';
import { reveal } from './fog.ts';
import { frontierPois, poisOf } from './explore.ts';
import { isLand, MAP_N, RING_W, T } from './terrain.ts';
import { isMountainFoot, TOWN_NAMES } from './sites.ts';
import { buildWorld, loadGame, prepareSave } from '../game.ts';


/**
 * 🗺 Expeditions: a late-game way to spend money on more map. A level 3 dock on the railway funds a voyage past the
 * edge of the known sea; the map grows by a ring of open sea all round with new islands in it (towns, settlement
 * sites and rich deposits, iron and oil included). Each one costs twice the last. Everything already built keeps
 * its place: the old map is moved RING_W squares in from the new edge.
 */
export const EXPEDITION_PRICE = 60000;
/** The new deposits each ring brings: gold and gems (jewellery), then cocoa (chocolate), then rubber (tyres); later rings mix them all. */
export const CHAINS: Resource[][] = [['gold', 'gems'], ['cocoa'], ['rubber'], ['gold', 'gems', 'cocoa', 'rubber']];
export const EXPEDITION_DOCK = 3;
export const expeditionPrice = (g: Game) => EXPEDITION_PRICE * 2 ** (g.s.rings ?? 0);
const fmt = (v: number) => '$' + Math.round(v).toLocaleString('en-US');

/** Why this dock can't send an expedition now, or ''. */
export function expeditionError(g: Game, b: Building): string {
  if (!isDock(b)) return 'Only a dock can send an expedition';
  if (b.lvl < EXPEDITION_DOCK) return `Needs a level ${EXPEDITION_DOCK} dock: upgrade this one`;
  if (!linkedDocks(g).includes(b)) return 'Join this dock to your railway first';
  const p = expeditionPrice(g); if (g.s.money < p) return `Need ${fmt(p - Math.floor(g.s.money))} more`;
  return '';
}

/** Move everything saved d squares right and down, on a map that grows from n0 to n0 + 2d squares. */
export function growState(s: GameState, n0: number, d: number) {
  const n1 = n0 + 2 * d, P = d * 32;
  const sq = (i: number) => (Math.floor(i / n0) + d) * n1 + (i % n0) + d;
  const keys = (r?: Record<number, number>) => { if (!r) return r; const o: Record<number, number> = {}; for (const [k, v] of Object.entries(r)) o[sq(+k)] = v; return o; };
  const xy = (o?: { x: number; y: number }) => { if (o) { o.x += d; o.y += d; } };
  const fog = new Uint8Array(Math.ceil((n1 * n1) / 8));
  for (let i = 0; i < n0 * n0; i++) if ((s.fog[i >> 3]! >> (i & 7)) & 1) { const k = sq(i); fog[k >> 3]! |= 1 << (k & 7); }
  s.fog = fog;
  s.terrainEdits = keys(s.terrainEdits)!; s.cut = keys(s.cut); s.stumps = keys(s.stumps);
  s.track = s.track.map(([i, l, b]) => [sq(i), l, b]);
  for (const o of [...s.sites, ...(s.buildings ?? []), ...(s.parks ?? []), ...(s.pois ?? []), ...(s.maps ?? [])]) xy(o);
  xy(s.shed); xy(s.storm);
  s.camera.x += P; s.camera.y += P;
  for (const b of s.breaks ?? []) b.square = sq(b.square);
  for (const sc of s.scouts ?? []) sc.path = sc.path.map(sq);
  for (const sh of s.ships ?? []) if (sh.path) sh.path = sh.path.map(sq);
  for (const t of s.trains) {
    if (t.at) { t.at.x += P; t.at.y += P; }
    if (t.dest !== undefined) t.dest = sq(t.dest);
    if (t.area) t.area = t.area.map(sq);
    t.rr = undefined; t.plan = []; t.held = 0;
  }
  s.netKey = ''; // the rails are numbered afresh: every train is found again by where it stood
}

/** Towns, settlement sites and deposits on the islands a new ring brought (seeded, like the first map's). */
function ringSites(g: Game, ring: number, firstNew: number): Site[] {
  const w = g.world, n = w.n, rng = new Rng(g.s.seed * 7919 + 1000 + ring), sites = g.s.sites, out: Site[] = [];
  let names = sites.filter(s => s.kind === 'town' || s.kind === 'plot').length;
  const nextName = () => { const k = names++; return TOWN_NAMES[k % TOWN_NAMES.length]! + (k >= TOWN_NAMES.length ? ' ' + ['Isle', 'Haven', 'Point', 'Reach'][Math.floor(k / TOWN_NAMES.length) % 4] : ''); };
  const add = (s: Omit<Site, 'id'>) => { const site = { id: sites.length + out.length, ...s } as Site; out.push(site); return site; };
  const all = () => [...sites, ...out];
  const free = (x: number, y: number) => !all().some(s => Math.hypot(s.x - x, s.y - y) < 5);
  const apart = (x: number, y: number) => !all().some(o => (o.kind === 'town' || o.kind === 'plot') && Math.hypot(o.x - x, o.y - y) < 11);
  let j = 0;
  w.islands.forEach((isl, k) => {
    if (k < firstNew || !isl.name) return;
    const r = Math.sqrt(isl.size / Math.PI);
    const put = (ok: (x: number, y: number) => boolean, make: (x: number, y: number) => void) => {
      for (let t = 0; t < 400; t++) {
        const x = Math.round(isl.cx + (rng.next() * 2 - 1) * r), y = Math.round(isl.cy + (rng.next() * 2 - 1) * r);
        if (w.islandOf[y * n + x] !== k || !isLand(w, x, y) || w.terr[y * n + x] === T.Mountain || !free(x, y) || !ok(x, y)) continue;
        make(x, y); return true;
      }
      return false;
    };
    // every new island has a town to find, bigger ones a settlement site too
    put(apart, (x, y) => add({ kind: 'town', x, y, pop: 0, name: nextName() }));
    if (r >= 7) put(apart, (x, y) => add({ kind: 'plot', x, y, name: nextName() }));
    const dep = (res: Resource) => (x: number, y: number) => add({ kind: 'dep', x, y, res, rich: true, hidden: res === 'iron' || res === 'oil' });
    const where = (res: Resource) => res === 'oil' ? () => true
      : res === 'cocoa' ? (x: number, y: number) => w.terr[y * n + x] === T.Grass
      : res === 'rubber' ? (x: number, y: number) => w.terr[y * n + x] === T.Forest || w.terr[y * n + x] === T.Grass
      : (x: number, y: number) => isMountainFoot(w, x, y);
    // this ring's new chain: two of its deposits on every island (taking turns, so a two-deposit chain has both)
    const chain = CHAINS[Math.min(ring, CHAINS.length) - 1]!;
    for (let i = 0; i < 2; i++) { const res = ring > CHAINS.length ? rng.pick(chain) : chain[(j + i) % chain.length]!; if (!put(where(res), dep(res))) put(() => true, dep(res)); }
    for (let i = 0; i < 2; i++) { const res = rng.pick(['coal', 'iron', 'oil', 'stone', 'iron', 'oil'] as const); put(where(res), dep(res)); }
    j++;
  });
  return out;
}

export interface Expedition { g: Game; islands: string[]; towns: number; fresh: Site[] }

/**
 * Send the expedition: pay, grow the map by one ring, place the new islands' towns and deposits, and give back the
 * game to play on (a new Game object: the world and the rails are rebuilt). Returns why not, as a string.
 */
export function sendExpedition(g: Game, b: Building): Expedition | string {
  const e = expeditionError(g, b); if (e) return e;
  const s = g.s, price = expeditionPrice(g), ring = (s.rings ?? 0) + 1, n0 = g.world.n;
  const before = new Set(g.world.islands.map(i => i.name).filter(Boolean));
  prepareSave(g);
  s.money -= price;
  growState(s, n0, RING_W);
  s.rings = ring;
  const w = buildWorld(s);
  if (w.n !== n0 + 2 * RING_W || w.n !== MAP_N + 2 * RING_W * ring) throw new Error('map size mismatch');
  // islands new to this ring: those not in the old list (the old ones keep their numbers)
  const firstNew = w.islands.findIndex(i => !!i.name && !before.has(i.name));
  const g2 = loadGame(s);
  const fresh = firstNew < 0 ? [] : ringSites(g2, ring, firstNew);
  s.sites.push(...fresh);
  if (firstNew >= 0) poisOf(g2).push(...frontierPois(g2, poisOf(g2), firstNew)); // landmarks on the new islands too
  // the expedition's charts: a glimpse of each new island's shore round its town, the rest waits in the fog
  for (const t of fresh) if (t.kind === 'town') reveal(g2, t.x, t.y, 5);
  for (const d of s.buildings ?? []) if (isDock(d)) d.chart = 0; // docks chart the wider sea again
  for (const d of linkedDocks(g2)) chartSea(g2, d);
  g2.taken = undefined;
  const islands = firstNew < 0 ? [] : w.islands.slice(firstNew).filter(i => i.name).map(i => i.name!);
  return { g: g2, islands, towns: fresh.filter(t => t.kind === 'town').length, fresh };
}
