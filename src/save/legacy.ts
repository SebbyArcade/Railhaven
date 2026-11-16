import { hasProject, PARK_PRICE, type ParkKind, parkFree, parkSpot, parksOf, projectOf } from '../buildings/parks.ts';
import type { Game, GameState, Resource, Site } from '../state.ts';
import { loadGame, newGame, trackChanged } from '../game.ts';
import { build, growsTracks, stripError, capOf, type Building, footprint, INDUSTRIES, type IndustryKind, isFactory, isLinked, placeError, placementsAt, priceOf, islandAtYard, buildingSquares, yardSquares, yardLen, type Good } from '../buildings/industries.ts';
import { stationLinkError } from '../buildings/stations.ts';
import { orderOf, sizeCap } from '../economy/towns.ts';
import { railLevel } from '../economy/dispatch.ts';
import { FLEET } from '../economy/upgrades.ts';
import { placeTrain } from '../trains/train.ts';
import { buildPlan, extendPlan, startPlan } from '../track/paint.ts';
import { squareCost } from '../track/rules.ts';
import { buyShip, SHIP_PRICE } from '../ships/ships.ts';
import { DOCK_RANGE, linkedDocks } from '../ships/docks.ts';
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
  const base = newGame(o.seed, 1), n = base.world.n, report: string[] = [];
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
  // a line that joined the old station from the side at one end of the hall: bend it round into the hall's end instead
  // (two squares of track: one beside the line, one in front of the hall's end)
  const land = (i: number) => base.world.terr[i] !== 0 && base.world.terr[i] !== 4 && !oldSites.some(o => o.y * n + o.x === i);
  for (const t of sites) {
    if (t.kind !== 'town') continue;
    const c = t.y * n + t.x; if (!sq.has(c)) continue;
    const hz = sq.has(c + 1) || sq.has(c - 1) || !(sq.has(c + n) || sq.has(c - n)), step = hz ? 1 : n, side = hz ? n : 1;
    for (const k of [-1, 1]) {
      const e = c + k * step; if (!sq.has(e)) continue;
      for (const j of [e + side, e - side]) {
        if (!sq.has(j)) continue;
        const j2 = j + k * step, a = c + 2 * k * step;
        if ((sq.has(j2) || land(j2)) && (sq.has(a) || land(a))) { sq.add(j2); sq.add(a); }
      }
    }
  }
  const tmap = new Map<number, { links: number; dbl?: boolean }>();
  const nb = (i: number, d: number) => d === 0 ? (i % n < n - 1 ? i + 1 : -1) : d === 1 ? i + n : d === 2 ? (i % n > 0 ? i - 1 : -1) : i - n;
  for (const i of sq) { let links = 0; for (let d = 0; d < 4; d++) if (sq.has(nb(i, d))) links |= 1 << d; tmap.set(i, dbl.has(i) ? { links, dbl: true } : { links }); }
  // the old game let a line join a station from the side; here a hall runs one way. Where track meets a town square from
  // both directions, keep the way that leads on to more of the railway and cut the short stubs the other way
  const reachOf = (from: number[], skip: number) => { const seen = new Set<number>([skip, ...from]), q = [...from]; for (let h = 0; h < q.length && seen.size < 600; h++) for (let d = 0; d < 4; d++) { const j = nb(q[h]!, d); if (j >= 0 && sq.has(j) && !seen.has(j)) { seen.add(j); q.push(j); } } return seen.size; };
  for (const t of sites) {
    if (t.kind !== 'town') continue;
    const c = t.y * n + t.x, m = tmap.get(c); if (!m) continue;
    const ew = [0, 2].filter(d => m.links & (1 << d)), ns = [1, 3].filter(d => m.links & (1 << d));
    if (!ew.length || !ns.length) continue;
    const r = (ds: number[]) => reachOf(ds.map(d => nb(c, d)), c);
    for (const d of r(ew) >= r(ns) ? ns : ew) { m.links &= ~(1 << d); const o = tmap.get(nb(c, d)); if (o) o.links &= ~(1 << ((d + 2) % 4)); }
  }
  for (const i of sq) for (let d = 0; d < 2; d++) {
    const j = nb(i, d); if (!sq.has(j)) continue;
    if (stationLinkError(tmap, n, sites, i, j, base.world.terr)) { tmap.get(i)!.links &= ~(1 << d); tmap.get(j)!.links &= ~(1 << ((d + 2) % 4)); }
  }
  for (const [i, t] of tmap) if (!t.links) tmap.delete(i);

  const s: GameState = {
    ...base.s, t: o.t ?? 0, money: 0, fog, sites, terrainEdits: {}, track: [...tmap].map(([i, t]) => [i, t.links, t.dbl ? 1 : 0]),
    trains: [], netKey: '', nextId: id, earned: o.earned ?? 0,
    orders: o.stats?.orders ?? 0, maps: Array.isArray(o.maps) ? o.maps.filter((m: any) => m && Number.isFinite(m.x) && Number.isFinite(m.y)).map((m: any) => ({ x: m.x, y: m.y, r: m.r ?? 45 })) : undefined, camera: { x: ash.x * TILE + TILE / 2, y: ash.y * TILE + TILE / 2, z: 1.2 },
  };
  for (const [i, v] of Object.entries(o.terrainEdits ?? {})) s.terrainEdits[+i] = v as number;
  s.rlv = railLevel(s.orders ?? 0);
  // fleet upgrades: the best level the old game reached on any island
  const up: any[] = Object.values(o.upI ?? {});
  for (const k of ['wag', 'eng', 'rep'] as const) { const l = Math.min(FLEET[k].lv.length - 1, Math.max(0, ...up.map(u => u?.[k] ?? 0))); if (l) (s.fleet ??= {})[k] = l; }
  // ship upgrades carry over as they were (old prices and levels match)
  for (const k of ['spd', 'hold'] as const) { const l = Math.min(3, Math.max(0, Math.floor(+(o.shU?.[k] ?? 0)) || 0)); if (l) (s.shipU ??= {})[k] = l; }
  const g = loadGame(s);

  // buildings: as close as each fits to where it stood, yard on the old track if it can be
  let placed = 0, refund = 0;
  const missed: string[] = [];
  // docks first, nearest Ashford first (a landing needs a dock that reaches it), then mines (they can't move far), then the rest
  const A = (b: any) => Math.hypot(b.x - ash.x, b.y - ash.y);
  const rank = (b: any) => KINDS[b.type] === 'dock' ? 0 : MINES.has(KINDS[b.type]!) ? 1 : 2;
  const order = [...olds].sort((a, b) => rank(a) - rank(b) || A(a) - A(b));
  let joinedSq = 0; const upgraded: Building[] = [];
  for (const ob of order) {
    // a dock looks for open water first (a straight shore reaches further), then a ragged coast
    const kind = KINDS[ob.type]!, findDock = () => placeNear(g, kind, ob.x, ob.y, true) ?? dockOnIsland(g, ob.x, ob.y, true) ?? placeNear(g, kind, ob.x, ob.y) ?? dockOnIsland(g, ob.x, ob.y);
    let best = kind === 'dock' ? findDock() : placeNear(g, kind, ob.x, ob.y);
    // the old game's sea reach was measured differently: a landing it reached may be just past a dock's reach here, so
    // that dock gets the next level for free (the nearest one that makes the landing fit)
    if (!best && kind === 'dock') for (const a of linkedDocks(g).filter(d => d.lvl < DOCK_RANGE.length).sort((p, q) => Math.hypot(p.x - ob.x, p.y - ob.y) - Math.hypot(q.x - ob.x, q.y - ob.y))) {
      a.lvl++; best = findDock();
      if (best) { upgraded.push(a); break; }
      a.lvl--;
    }
    const value = ob.paid ?? INDUSTRIES[kind].price;
    if (!best) { refund += value; missed.push(INDUSTRIES[kind].name); continue; }
    const pay = priceOf(g, kind, islandAtYard(g, best)); g.s.money += pay;
    const b = build(g, best); if (typeof b === 'string') { g.s.money -= pay; refund += value; missed.push(INDUSTRIES[kind].name); continue; }
    b.paid = value; b.lvl = Math.max(1, Math.min(3, ob.lvl ?? 1)); b.stock = Math.min(capOf(b), Math.max(0, ob.stock ?? 0));
    if (ob.inp && isFactory(kind)) for (const [k, v] of Object.entries(ob.inp)) (b.inbuf ??= {})[k as Good] = Math.min(30 + 20 * b.lvl, v as number);
    if (kind === 'dock' && ob.fish) b.fish = Math.min(3, ob.fish);
    if (growsTracks(kind) && b.lvl >= 2 && !stripError(g, b)) b.tracks = b.lvl + 1; // its extra loading tracks, where there is room
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
  report.push(`🏭 ${placed} of ${olds.length} buildings placed near where they stood${joinedSq ? ` (${joinedSq} squares of track added to join their yards)` : ''}${upgraded.length ? ` · ${upgraded.length} dock${upgraded.length > 1 ? 's' : ''} raised a level to reach ${upgraded.length > 1 ? 'their landings' : 'its landing'}` : ''}${missed.length ? ` · ${missed.length} didn't fit (${[...new Set(missed)].join(', ')}): ${fmt(refund)} paid back` : ''}`);

  // town orders: what was already delivered toward the current order
  for (const t of g.s.sites) {
    const old = (t as any).oldGot; delete (t as any).oldGot; if (!old || t.kind !== 'town') continue;
    const o2 = orderOf(g, t); for (const k of Object.keys(o2) as Good[]) if (old[k]) t.got![k] = Math.min(o2[k]!, Math.floor(old[k]));
  }

  // trains: spread over the line, each on its own stretch away from stations and yards
  // each train goes back near where it was in the old game, on the same island (trains can't cross the sea by
  // themselves: putting them in track order once left 15 of 37 trains on one small island)
  const want = (o.trains ?? []).length, busy = new Set<number>();
  for (const b of g.s.buildings ?? []) for (const i of footprint(n, b)) busy.add(i);
  const free = g.net.pieces.filter(p => p.squares.every(i => g.linked?.has(i)) && !p.squares.some(i => busy.has(i)));
  const isl = g.world.islandOf, mid = (p: { squares: number[] }) => p.squares[p.squares.length >> 1]!;
  let trains = 0;
  for (const ot of o.trains ?? []) {
    const path: [number, number][] = Array.isArray(ot?.path) ? ot.path : [];
    const at = path[Math.max(0, Math.min(path.length - 1, Math.floor(ot?.pos ?? 0)))];
    const ox = at?.[0] ?? base.s.sites[0]!.x, oy = at?.[1] ?? base.s.sites[0]!.y;
    // its island: where it stood (or, on a bridge, the nearest land square of its route)
    let home = isl[oy * n + ox] ?? -1;
    if (home < 0) for (const q of [...path].sort((a, b) => Math.hypot(a[0] - ox, a[1] - oy) - Math.hypot(b[0] - ox, b[1] - oy))) { const k = isl[q[1] * n + q[0]] ?? -1; if (k >= 0) { home = k; break; } }
    const near = (p: { squares: number[] }) => { const s = mid(p); return Math.hypot(s % n - ox, Math.floor(s / n) - oy); };
    const onIsl = (p: { squares: number[] }) => home < 0 || p.squares.every(i => isl[i] === home || isl[i]! < 0);
    // its own island first, nearest first; if its island's line is full, the nearest free spot anywhere (it was paid for)
    const cands = free.filter(p => !g.sys.holder.has(p.id)).sort((a, b) => +onIsl(b) - +onIsl(a) || near(a) - near(b));
    for (const p of cands) {
      if (p.squares.some(i => busy.has(i))) continue;
      const t = placeTrain(g.net, g.s.nextId, { piece: p.id, dir: 1 }, 3);
      if (t.trail.some(st => g.sys.holder.has(st.piece))) continue;
      g.s.nextId++; g.s.trains.push(t); g.sys.rebuildHolds(); trains++;
      for (const st of t.trail) for (const i of g.net.pieces[st.piece]!.squares) busy.add(i);
      break;
    }
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

  // town parks and projects: on the same square if it is still free, else the best free square near the town
  const oldParks: any[] = Array.isArray(o.parks) ? o.parks : [];
  if (oldParks.length) {
    let put = 0, back = 0;
    for (const op of oldParks) {
      const town = sites.find(s => s.kind === 'town' && s.name === oldSites[op.t]?.name), k: ParkKind = op.pj && projectOf(op.pj) ? op.pj : 'park';
      const price = projectOf(k)?.price ?? PARK_PRICE[town ? parksOf(g, town).length : 0] ?? PARK_PRICE[0]!;
      if (!town || (k === 'park' ? parksOf(g, town).length >= PARK_PRICE.length : hasProject(g, town, k))) { back += price; continue; }
      const at = parkFree(g, op.x, op.y) ? { x: op.x, y: op.y } : parkSpot(g, town);
      if (!at) { back += price; continue; }
      (g.s.parks ??= []).push({ town: town.id, ...at, k }); g.taken = undefined; put++;
    }
    refund += back;
    report.push(`🌳 ${put} of ${oldParks.length} town parks and projects back in their towns${back ? ` · ${oldParks.length - put} had no room: ${fmt(back)} paid back` : ''}`);
  }

  // the old ⛰ Foundry landmark: tunnels stay open, and it stands near Ashford again
  if (o.lm?.foundry && !hasProject(g, sites[0]!, 'foundry')) {
    const at = parkSpot(g, sites[0]!);
    if (at) { (g.s.parks ??= []).push({ town: sites[0]!.id, ...at, k: 'foundry' }); g.taken = undefined; report.push('⛰ The Foundry stands in Ashford again: track can tunnel through mountains'); }
    else { refund += projectOf('foundry')!.price; report.push(`⛰ No room near Ashford for the Foundry: ${fmt(projectOf('foundry')!.price)} paid back`); }
  }
  // the old 🌉 Bridge Works landmark (it made water track cheaper): it stands again and now builds strait bridges
  if (o.lm?.viaduct && !hasProject(g, sites[0]!, 'bridgeworks')) {
    const at = parkSpot(g, sites[0]!);
    if (at) { (g.s.parks ??= []).push({ town: sites[0]!.id, ...at, k: 'bridgeworks' }); g.taken = undefined; report.push('🌉 The Bridge Works stands in Ashford again: it now builds strait bridges to islands up to 3 squares away'); }
    else { refund += projectOf('bridgeworks')!.price; report.push(`🌉 No room near Ashford for the Bridge Works: ${fmt(projectOf('bridgeworks')!.price)} paid back`); }
  }
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

/** Pier squares over water. */
const pierSea = (g: Game, p: Parameters<typeof buildingSquares>[1]) => buildingSquares(g.world.n, p).filter(i => !g.world.terr[i]).length;

/** The island an old port served: the land under it, or the land next to it when the port square is water. */
function portIsland(g: Game, x: number, y: number): number {
  const n = g.world.n, w = g.world; let isl = w.islandOf[y * n + x] ?? -1;
  if (isl < 0) for (const d of [1, -1, n, -n]) { const j = w.islandOf[y * n + x + d]!; if (j >= 0) { isl = j; break; } }
  return isl;
}

/** A dock that didn't fit by the old port: the nearest spot on the same island's shore (within 30 squares) that fits. */
function dockOnIsland(g: Game, x: number, y: number, openWater = false) {
  const n = g.world.n, w = g.world, isl = portIsland(g, x, y);
  let best: ReturnType<typeof placementsAt>[number] | null = null, bd = Infinity;
  for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++) {
    const d = Math.hypot(dx, dy); if (d >= bd || d > 30) continue;
    const i = (y + dy) * n + x + dx; if (w.terr[i] !== 0 || ![1, -1, n, -n].some(e => w.islandOf[i + e] === isl)) continue; // pier squares: water by this island
    for (const p of placementsAt('dock', x + dx, y + dy)) if ((!openWater || pierSea(g, p) === yardLen(p)) && !placeError(g, p)) { best = p; bd = d; break; }
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
function placeNear(g: Game, kind: IndustryKind, x: number, y: number, openWater = false) {
  const n = g.world.n;
  let best: ReturnType<typeof placementsAt>[number] | null = null, bs = -Infinity;
  // a mine needs a deposit of its kind under its building row (placeError checks): look around the old one, then
  // at other deposits of that kind close by; a dock looks along the coast nearby; others close to where they stood
  const R = MINES.has(kind) ? 3 : kind === 'dock' ? 10 : 5;
  const res = INDUSTRIES[kind].makes;
  const seen = new Set<string>();
  const isl = kind === 'dock' ? portIsland(g, x, y) : -1;
  const centres = MINES.has(kind) ? [[x, y], ...g.s.sites.filter(s => s.kind === 'dep' && s.res === res && Math.hypot(s.x - x, s.y - y) <= 10 && (s.x !== x || s.y !== y)).map(s => [s.x, s.y])] : [[x, y]];
  for (const [cx, cy] of centres) for (let dy = -R - 1; dy <= R + 1; dy++) for (let dx = -R - 1; dx <= R + 1; dx++) {
    if (best && (cx !== x || cy !== y)) break; // a spot by the old deposit wins
    const px = cx! + dx - x, py = cy! + dy - y;
    for (const p of placementsAt(kind, x + px, y + py)) {
      const key = `${p.x},${p.y},${+p.horizontal},${p.side}`; if (seen.has(key)) continue; seen.add(key); // each spot is reached from all 4 of its squares
      if (openWater && pierSea(g, p) < yardLen(p)) continue;
      if (placeError(g, p)) continue;
      if (kind === 'dock' && g.world.islandOf[yardSquares(n, p)[0]!] !== isl) continue; // a dock stays on the island it served
      const ys = yardSquares(n, p), on = ys.filter(i => g.track.has(i)).length;
      const step = p.horizontal ? 1 : n, touch = [ys[0]! - step, ys.at(-1)! + step].filter(i => g.track.has(i)).length;
      const linkedEnd = [ys[0]! - step, ys.at(-1)! + step].filter(i => g.linked?.has(i)).length;
      // distance from the old spot to the nearest square of the building row inside the search window (as if seen from each of its squares)
      let dist = Infinity;
      for (const q of buildingSquares(n, p)) { const u = q % n - x, v = ((q / n) | 0) - y; if (Math.abs(u - (cx! - x)) <= R + 1 && Math.abs(v - (cy! - y)) <= R + 1) dist = Math.min(dist, Math.hypot(u, v)); }
      const sc = on * 3 + touch * 2 + linkedEnd * 4 - dist;
      if (sc > bs) { bs = sc; best = p; }
    }
  }
  return best;
}
