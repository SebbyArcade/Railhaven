import type { Game, GameState, Resource, Site } from '../state.ts';
import { loadGame, newGame, trackChanged } from '../game.ts';
import { build, capOf, type Building, footprint, INDUSTRIES, type IndustryKind, isFactory, isLinked, placeError, placementsAt, priceOf, yardSquares, type Good } from '../buildings/industries.ts';
import { stationLinkError } from '../buildings/stations.ts';
import { orderOf, sizeCap } from '../economy/towns.ts';
import { railLevel } from '../economy/dispatch.ts';
import { FLEET } from '../economy/upgrades.ts';
import { placeTrain } from '../trains/train.ts';
import { buildPlan, extendPlan, startPlan } from '../track/paint.ts';
import { squareCost } from '../track/rules.ts';
import { buyShip, SHIP_PRICE } from '../ships/ships.ts';
import { linkedDocks } from '../ships/docks.ts';
import { emptyFog } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';

/**
 * Bring a game from the old single-file Railhaven into the rebuild. The map is the same for the same seed, so towns,
 * track and fog come over square for square. Old buildings stood on one square; here each has a 2×4 yard, so each is
 * placed as close as it fits to where it stood (preferring a yard on the old track). Anything that can't be placed
 * is paid back in money, and the report says so. Trains come back spread over the line; ships come back at a dock.
 */

/** The old save as text: its JSON, or a RAILHAVEN2: code (gzip, base64). */
export async function decodeLegacy(text: string): Promise<any> {
  const t = text.trim();
  if (t.startsWith('{')) return JSON.parse(t);
  const m = /^RAILHAVEN(\d):(.*)$/s.exec(t);
  if (!m) throw new Error('This is not a Railhaven save: paste the code from the old game (it starts with RAILHAVEN2:) or pick its save file');
  const bin = Uint8Array.from(atob(m[2]!.replace(/\s+/g, '')), c => c.charCodeAt(0));
  if (m[1] === '1') return JSON.parse(new TextDecoder().decode(bin));
  const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(ds).text());
}

/** Is this an old-game save (as opposed to a rebuild save)? */
export const isLegacy = (o: any) => !!o && typeof o === 'object' && Array.isArray(o.sites) && Array.isArray(o.track) && typeof o.track[0] !== 'object' && o.version === undefined;

const KINDS: Record<string, IndustryKind> = {
  wood: 'wood', farm: 'farm', stone: 'stone', coal: 'coal', iron: 'iron', oil: 'oil', wool: 'wool',
  sawmill: 'sawmill', brickworks: 'brickworks', gristmill: 'gristmill', mill: 'mill', refinery: 'refinery', textile: 'textile', cannery: 'cannery', port: 'dock',
};
const MINES = new Set<IndustryKind>(['stone', 'coal', 'iron', 'oil']);
const fmt = (v: number) => '$' + Math.round(v).toLocaleString('en-US');

export interface ImportResult { g: Game; report: string[] }

export function importLegacy(o: any): ImportResult {
  const base = newGame(o.seed), n = base.world.n, report: string[] = [];
  if (o.track.some((i: number) => i >= n * n)) throw new Error('This save is from a map of another size and cannot be brought over');
  // places: towns (Ashford first), settlement sites, deposits; a mine's own deposit comes back under it
  let id = 1;
  const sites: Site[] = [], oldSites: any[] = o.sites;
  const ash = oldSites.find(s => s.type === 'town' && s.name === 'Ashford') ?? oldSites.find(s => s.type === 'town');
  const towns = [ash, ...oldSites.filter(s => s.type === 'town' && s !== ash)];
  for (const t of towns) {
    const lvl = Math.max(0, Math.floor(t.lvl ?? 0)), pop = (t.pop ?? 0) > 0 ? Math.max(15, Math.min(sizeCap(lvl), Math.round(t.pop))) : 0;
    sites.push({ id: id++, kind: 'town', x: t.x, y: t.y, name: t.name, pop, lvl, got: {} , ...(t.got ? { oldGot: t.got } as any : {}) });
  }
  for (const p of oldSites.filter(s => s.type === 'plot')) sites.push({ id: id++, kind: 'plot', x: p.x, y: p.y, name: p.name });
  for (const d of oldSites.filter(s => s.type === 'dep')) sites.push({ id: id++, kind: 'dep', x: d.x, y: d.y, res: d.res as Resource, ...(d.rich ? { rich: true } : {}), ...(d.hidden ? { hidden: true } : {}) });
  const olds = oldSites.filter(s => KINDS[s.type]);
  for (const b of olds) if (MINES.has(KINDS[b.type]!)) sites.push({ id: id++, kind: 'dep', x: b.x, y: b.y, res: (b.res0 ?? b.type) as Resource, ...(b.rich ? { rich: true } : {}) });

  // fog and track, square for square; a track square joins every track neighbour (except into a station's long side)
  const fog = emptyFog(n); for (const i of o.rev ?? []) fog[i >> 3]! |= 1 << (i & 7);
  const sq = new Set<number>(o.track), dbl = new Set<number>(o.dbl ?? []);
  // the old game kept a town's station square out of the track list: put it back for every town on the railway
  oldSites.forEach((t, k) => {
    if (t.type !== 'town' || !(t.linked || t.station)) return;
    const st = o.stnTileMap?.[k], i = (st?.y ?? t.y) * n + (st?.x ?? t.x);
    const near = [1, -1, n, -n].some(d => sq.has(i + d));
    if (near) sq.add(i);
  });
  const tmap = new Map<number, { links: number; dbl?: boolean }>();
  const nb = (i: number, d: number) => d === 0 ? (i % n < n - 1 ? i + 1 : -1) : d === 1 ? i + n : d === 2 ? (i % n > 0 ? i - 1 : -1) : i - n;
  for (const i of sq) { let links = 0; for (let d = 0; d < 4; d++) if (sq.has(nb(i, d))) links |= 1 << d; tmap.set(i, dbl.has(i) ? { links, dbl: true } : { links }); }
  for (const i of sq) for (let d = 0; d < 2; d++) {
    const j = nb(i, d); if (!sq.has(j)) continue;
    if (stationLinkError(tmap, n, sites, i, j)) { tmap.get(i)!.links &= ~(1 << d); tmap.get(j)!.links &= ~(1 << ((d + 2) % 4)); }
  }
  for (const [i, t] of tmap) if (!t.links) tmap.delete(i);

  const s: GameState = {
    ...base.s, t: o.t ?? 0, money: 0, fog, sites, terrainEdits: {}, track: [...tmap].map(([i, t]) => [i, t.links, t.dbl ? 1 : 0]),
    trains: [], netKey: '', nextId: id, earned: o.earned ?? 0,
    orders: o.stats?.orders ?? 0, camera: { x: ash.x * TILE + TILE / 2, y: ash.y * TILE + TILE / 2, z: 1.2 },
  };
  for (const [i, v] of Object.entries(o.terrainEdits ?? {})) s.terrainEdits[+i] = v as number;
  s.rlv = railLevel(s.orders ?? 0);
  // fleet upgrades: the best level the old game reached on any island
  const up: any[] = Object.values(o.upI ?? {});
  for (const k of ['wag', 'eng', 'rep'] as const) { const l = Math.min(FLEET[k].lv.length - 1, Math.max(0, ...up.map(u => u?.[k] ?? 0))); if (l) (s.fleet ??= {})[k] = l; }
  const g = loadGame(s);

  // buildings: as close as each fits to where it stood, yard on the old track if it can be
  let placed = 0, refund = 0;
  const missed: string[] = [];
  // docks first, nearest Ashford first (a landing needs a dock that reaches it), then mines (they can't move far), then the rest
  const A = (b: any) => Math.hypot(b.x - ash.x, b.y - ash.y);
  const rank = (b: any) => KINDS[b.type] === 'dock' ? 0 : MINES.has(KINDS[b.type]!) ? 1 : 2;
  const order = [...olds].sort((a, b) => rank(a) - rank(b) || A(a) - A(b));
  let joinedSq = 0;
  for (const ob of order) {
    const kind = KINDS[ob.type]!, best = placeNear(g, kind, ob.x, ob.y) ?? (kind === 'dock' ? dockOnIsland(g, ob.x, ob.y) : null);
    const value = ob.paid ?? INDUSTRIES[kind].price;
    if (!best) { refund += value; missed.push(INDUSTRIES[kind].name); continue; }
    g.s.money += priceOf(g, kind);
    const b = build(g, best); if (typeof b === 'string') { g.s.money -= priceOf(g, kind); refund += value; missed.push(INDUSTRIES[kind].name); continue; }
    b.paid = value; b.lvl = Math.max(1, Math.min(3, ob.lvl ?? 1)); b.stock = Math.min(capOf(b), Math.max(0, ob.stock ?? 0));
    if (ob.inp && isFactory(kind)) for (const [k, v] of Object.entries(ob.inp)) (b.inbuf ??= {})[k as Good] = Math.min(30 + 20 * b.lvl, v as number);
    if (kind === 'dock' && ob.fish) b.fish = Math.min(3, ob.fish);
    trackChanged(g);
    // it was on the railway in the old game: join its yard to the line again with a short stretch of track (free)
    if (ob.linked && !isLinked(g, b)) joinedSq += joinToLine(g, b);
    // a landing: join it to the island's own railway, which the old game reached through it
    const isl = g.world.islandOf[yardSquares(n, b)[0]!];
    if (kind === 'dock' && isLinked(g, b) && isl !== g.world.home && [...g.track.keys()].some(i => g.world.islandOf[i] === isl && !g.linked?.has(i))) joinedSq += joinToLine(g, b, true);
    placed++;
  }
  g.s.money = 0;
  trackChanged(g);
  report.push(`🏘 ${towns.length} towns with their sizes · 🛤 ${tmap.size} squares of track`);
  report.push(`🏭 ${placed} of ${olds.length} buildings placed near where they stood${joinedSq ? ` (${joinedSq} squares of track added to join their yards)` : ''}${missed.length ? ` · ${missed.length} didn't fit (${[...new Set(missed)].join(', ')}): ${fmt(refund)} paid back` : ''}`);

  // town orders: what was already delivered toward the current order
  for (const t of g.s.sites) {
    const old = (t as any).oldGot; delete (t as any).oldGot; if (!old || t.kind !== 'town') continue;
    const o2 = orderOf(g, t); for (const k of Object.keys(o2) as Good[]) if (old[k]) t.got![k] = Math.min(o2[k]!, Math.floor(old[k]));
  }

  // trains: spread over the line, each on its own stretch away from stations and yards
  const want = (o.trains ?? []).length, busy = new Set<number>();
  for (const b of g.s.buildings ?? []) for (const i of footprint(n, b)) busy.add(i);
  let trains = 0;
  for (const p of g.net.pieces) {
    if (trains >= want) break;
    if (p.squares.some(i => busy.has(i)) || g.sys.holder.has(p.id) || !p.squares.every(i => g.linked?.has(i))) continue;
    const t = placeTrain(g.net, g.s.nextId, { piece: p.id, dir: 1 }, 3);
    if (t.trail.some(st => g.sys.holder.has(st.piece))) continue;
    g.s.nextId++; g.s.trains.push(t); g.sys.rebuildHolds(); trains++;
    for (const st of t.trail) for (const i of g.net.pieces[st.piece]!.squares) busy.add(i);
  }
  const lostT = want - trains; if (lostT > 0) refund += lostT * 1000;
  report.push(`🚂 ${trains} trains back on the line${lostT > 0 ? ` · ${lostT} had no room: ${fmt(lostT * 1000)} paid back` : ''}`);

  // ships: back at a dock that has a sea route
  const wantS = (o.ships ?? []).length; let ships = 0;
  for (let k = 0; k < wantS; k++) {
    const d = linkedDocks(g).find(x => buyShipFree(g, x)); if (d) ships++;
  }
  if (wantS - ships > 0) refund += (wantS - ships) * SHIP_PRICE;
  if (wantS) report.push(`🚢 ${ships} cargo ships${wantS - ships > 0 ? ` · ${wantS - ships} without a sea route here: ${fmt((wantS - ships) * SHIP_PRICE)} paid back` : ''}`);

  g.s.money = (o.money ?? 0) + refund;
  g.news = []; // what the rebuild noticed while laying it all out (landmarks seen, seas charted) is old news
  report.push(`⭐ Railway level ${g.s.rlv} (${g.s.orders} orders filled) · 💰 ${fmt(g.s.money)}`);
  return { g, report };
}

function buyShipFree(g: Game, d: Building): boolean {
  g.s.money += SHIP_PRICE; const s = buyShip(g, d);
  if (typeof s === 'string') { g.s.money -= SHIP_PRICE; return false; }
  return true;
}

/** A dock that didn't fit by the old port: the nearest spot on the same island's shore (within 30 squares) that fits. */
function dockOnIsland(g: Game, x: number, y: number) {
  const n = g.world.n, w = g.world, k = w.islandOf[y * n + x] ?? -1;
  // the old port square may be water: its island is the land next to it
  let isl = k; if (isl < 0) for (const d of [1, -1, n, -n]) { const j = w.islandOf[y * n + x + d]!; if (j >= 0) { isl = j; break; } }
  let best: ReturnType<typeof placementsAt>[number] | null = null, bd = Infinity;
  for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++) {
    const d = Math.hypot(dx, dy); if (d >= bd || d > 30) continue;
    const i = (y + dy) * n + x + dx; if (w.terr[i] !== 0 || ![1, -1, n, -n].some(e => w.islandOf[i + e] === isl)) continue; // pier squares: water by this island
    for (const p of placementsAt('dock', x + dx, y + dy)) if (!placeError(g, p)) { best = p; bd = d; break; }
  }
  return best;
}

/** Lay the shortest stretch of track (at most 8 squares) from the railway to one end of the yard; free. Returns the squares laid. */
function joinToLine(g: Game, b: Building, island = false): number {
  const n = g.world.n, ys = yardSquares(n, b), step = b.horizontal ? 1 : n;
  for (const [end, out] of [[ys[0]!, ys[0]! - step], [ys.at(-1)!, ys.at(-1)! + step]] as const) {
    if (typeof squareCost(g, out) === 'string' && !g.track.has(out)) continue;
    // breadth-first from the square past the yard end to the nearest railway square
    const from = new Map<number, number>([[out, -1]]), q = [out]; let hit = -1;
    for (let h = 0; h < q.length && hit < 0; h++) {
      const i = q[h]!; if ((from.size > 400)) break;
      for (const d of [1, -1, n, -n]) {
        const j = i + d; if (from.has(j) || ys.includes(j)) continue;
        if (island ? g.track.has(j) && !g.linked?.has(j) && g.world.islandOf[j] === g.world.islandOf[end] : g.linked?.has(j)) { from.set(j, i); hit = j; break; }
        if (g.track.has(j) || typeof squareCost(g, j) === 'string') continue;
        let len = 0; for (let k = i; k !== -1; k = from.get(k)!) len++;
        if (len > (island ? 14 : 8)) continue;
        from.set(j, i); q.push(j);
      }
    }
    if (hit < 0) continue;
    const path: number[] = []; for (let i = hit; i !== -1; i = from.get(i)!) path.push(i);
    path.push(end);
    if (island) path.reverse(); // a drag starts on the railway: here that is the landing's yard
    const money = g.s.money; g.s.money = 1e9;
    const p = startPlan(g, path[0]!); if (!p) { g.s.money = money; continue; }
    for (const i of path.slice(1)) extendPlan(g, p, i);
    const r = buildPlan(g, p); g.s.money = money;
    if (typeof r === 'string') continue;
    trackChanged(g);
    if (island || isLinked(g, b)) return path.length - 1;
  }
  return 0;
}

/** Where a building that stood on square (x, y) fits best: yard on existing track, close to the old spot. */
function placeNear(g: Game, kind: IndustryKind, x: number, y: number) {
  const n = g.world.n;
  let best: ReturnType<typeof placementsAt>[number] | null = null, bs = -Infinity;
  // a mine needs a deposit of its kind under its building row (placeError checks): look around the old one, then
  // at other deposits of that kind close by; a dock looks along the coast nearby; others close to where they stood
  const R = MINES.has(kind) ? 3 : kind === 'dock' ? 10 : 5;
  const res = INDUSTRIES[kind].makes;
  const centres = MINES.has(kind) ? [[x, y], ...g.s.sites.filter(s => s.kind === 'dep' && s.res === res && Math.hypot(s.x - x, s.y - y) <= 10 && (s.x !== x || s.y !== y)).map(s => [s.x, s.y])] : [[x, y]];
  for (const [cx, cy] of centres) for (let dy = -R - 1; dy <= R + 1; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
    if (best && (cx !== x || cy !== y)) break; // a spot by the old deposit wins
    const px = cx! + dx - x, py = cy! + dy - y;
    for (const p of placementsAt(kind, x + px, y + py)) {
      if (placeError(g, p)) continue;
      const ys = yardSquares(n, p), on = ys.filter(i => g.track.has(i)).length;
      const step = p.horizontal ? 1 : n, touch = [ys[0]! - step, ys.at(-1)! + step].filter(i => g.track.has(i)).length;
      const linkedEnd = [ys[0]! - step, ys.at(-1)! + step].filter(i => g.linked?.has(i)).length;
      const sc = on * 3 + touch * 2 + linkedEnd * 4 - Math.hypot(px, py);
      if (sc > bs) { bs = sc; best = p; }
    }
  }
  return best;
}
