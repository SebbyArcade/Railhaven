// A simple bot player: builds what open orders need, lays track to it, buys trains, grows towns, links and founds
// towns, upgrades buildings and the fleet; docks, landings, ships, island trains, landmarks and expeditions; follows
// the 🚦 advice (doubles held-up track). No screen. Usage: npx vite-node tools/bot.ts [seed] [minutes]
// PLAYTEST=1 adds a problem watcher (tools/playtest-watch.ts): money pace, idle/stuck/overlapping trains, broken card text.
import { newGame, trackChanged } from '../src/game.ts';
import { outputOf, bestPlacement, build, type Building, info, isFactory, isLinked, lockedText, priceOf, yardSquares, type IndustryKind, INDUSTRIES, type Good } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { squareCost } from '../src/track/rules.ts';
import { tickProduction } from '../src/economy/production.ts';
import { foundTown, foundPrice, orderDone, orderOf, tickTowns, townLinked, upgradePrice, upgradeTown, stepOf } from '../src/economy/towns.ts';
import { buyTrain, tickTrains, trainPrice } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { buyFleet, FLEET, fleetLvl, levelPrice, maxLvlOf, upgradeBuilding } from '../src/economy/upgrades.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';
import type { Site } from '../src/state.ts';
import { isDock, islandOfB, linkedDocks, islandName } from '../src/ships/docks.ts';
import { buyShip, lanesFrom, shipPrice, buyShipUp, SHIP_UP, shipUpLvl } from '../src/ships/ships.ts';
import { buyTrainAt, islandOfTrain } from '../src/economy/dispatch.ts';
import { PROJECTS, buyProject, projectError, buyPark, nextParkPrice } from '../src/buildings/parks.ts';
import { expeditionError, expeditionPrice, sendExpedition } from '../src/world/expedition.ts';
import { jams } from '../src/economy/jams.ts';
import { TRACK_COST } from '../src/track/rules.ts';
import { reachedIslands } from '../src/progress/missions.ts';
import { monitor, report } from './playtest-watch.ts';

const [seed = 4242, minutes = 20] = process.argv.slice(2).map(Number);
let g = newGame(seed), n = g.world.n, ash = g.s.sites[0]!;
const log: string[] = [];
let rescues = 0;

/** Lay track from the network to any of the target squares (bot only: a breadth-first path, painted square by square). */
function lay(targets: number[], last?: number): boolean {
  const goal = new Set(targets), from = new Map<number, number>(), q: number[] = [];
  for (const i of g.track.keys()) if (g.linked?.has(i) || (!g.linked?.size && i === ash.y * n + ash.x)) { from.set(i, -1); q.push(i); }
  if (!q.length) { const a = ash.y * n + ash.x; from.set(a, -1); q.push(a); }
  let hit = -1;
  for (let h = 0; h < q.length && hit < 0; h++) {
    const i = q[h]!;
    for (const d of [1, -1, n, -n]) {
      const j = i + d; if (from.has(j)) continue;
      if (goal.has(j)) { from.set(j, i); hit = j; break; }
      if (g.track.has(j)) continue;
      const c = squareCost(g, j); // fog is fine to plan through: the track uncovers it as it goes
      if (typeof c === 'string' && !(c.startsWith('Unexplored') && g.world.terr[j] !== 4 && g.world.terr[j] !== 0)) continue;
      from.set(j, i); q.push(j);
    }
  }
  if (hit < 0) return false;
  const path: number[] = []; for (let i = hit; i !== -1; i = from.get(i)!) path.unshift(i);
  if (last !== undefined && path.at(-1) !== last) path.push(last);
  // paint it in pieces: each built piece uncovers the fog ahead
  let at = 0;
  for (let round = 0; round < 40 && at < path.length - 1; round++) {
    const p = startPlan(g, path[at]!); if (!p) return false;
    for (const i of path.slice(at + 1)) { extendPlan(g, p, i); if (p.refused) break; }
    if (p.path.length < 2) return false;
    const r = buildPlan(g, p); if (typeof r === 'string') return false;
    trackChanged(g);
    at = path.indexOf(p.path.at(-1)!);
  }
  return at >= path.length - 1;
}

function linkBuilding(b: Building): boolean {
  const ys = yardSquares(n, b);
  for (const end of [ys[0]!, ys.at(-1)!]) {
    const step = b.horizontal ? (end === ys[0] ? -1 : 1) : (end === ys[0] ? -n : n);
    if (lay([end + step], end) && isLinked(g, b)) return true;
  }
  return isLinked(g, b);
}

/** Build a maker of good k near the network (or near Ashford), and join it up. */
const noMaker = new Set<Good>();
function buildFor(k: Good, again = false): boolean {
  const kind = (Object.keys(INDUSTRIES) as IndustryKind[]).find(m => INDUSTRIES[m].makes === k && !isFactory(m)) ??
    (Object.keys(INDUSTRIES) as IndustryKind[]).find(m => INDUSTRIES[m].makes === k);
  if (!kind || lockedText(g, kind) || priceOf(g, kind) + 800 > g.s.money) return false;
  if (again) log.push(`  ${info(kind).name} makes nothing: building another`);
  // near Ashford first, then near each town on the railway (Ashford has no mountains close by, so mines go farther out)
  const centres = [ash, ...g.s.sites.filter(t => t.kind === 'town' && t !== ash && townLinked(g, t))];
  for (const { x: cx, y: cy } of centres) for (let r = 5; r < 26; r++) for (let a = 0; a < 16; a++) {
    const x = Math.round(cx + Math.cos(a * 0.39) * r), y = Math.round(cy + Math.sin(a * 0.39) * r);
    const p = bestPlacement(g, kind, x, y); if (!p.place) continue;
    const b = build(g, p.place); if (typeof b === 'string') continue;
    trackChanged(g);
    if (linkBuilding(b)) { log.push(`  built ${info(kind).name}`); return true; }
  }
  return explore(k);
}

/** Like a player who reads "lay track toward the mountains": run a line out toward the nearest deposit of k still in the fog. */
const explored = new Set<number>();
function explore(k: Good): boolean {
  const dep = g.s.sites.filter(s => s.kind === 'dep' && s.res === k && !s.hidden && !explored.has(s.id) && g.world.islandOf[s.y * n + s.x] === g.world.islandOf[ash.y * n + ash.x])
    .sort((a, b) => Math.hypot(a.x - ash.x, a.y - ash.y) - Math.hypot(b.x - ash.x, b.y - ash.y))[0];
  if (!dep || g.s.money < 3000) return false;
  explored.add(dep.id);
  const near: number[] = [];
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const i = (dep.y + dy) * n + dep.x + dx; if (Math.hypot(dx, dy) <= 2 && (g.world.terr[i] === 1 || g.world.terr[i] === 2)) near.push(i); }
  const ok = lay(near); log.push(`  explored toward the ${k} deposit ${ok ? '' : '(failed)'}`); return ok;
}

function linkTown(t: Site): boolean {
  const c = t.y * n + t.x;
  return lay([c - 2, c + 2, c - 2 * n, c + 2 * n].filter(i => !g.track.has(i)), undefined) && lay([c]) && townLinked(g, t);
}

function think() {
  if (!g.s.shed && g.s.t < 20) { // first thing, like a player following the hint: a straight line for the engine shed
    for (const d of [1, -1, n, -n]) {
      const a = ash.y * n + ash.x, p = startPlan(g, a); if (!p) break;
      for (let k = 1; k <= 6; k++) extendPlan(g, p, a + d * k);
      if (p.path.length === 7 && typeof buildPlan(g, p) !== 'string') { trackChanged(g); if (g.s.shed) { log.push('  straight line for the shed'); return; } }
    }
  }
  // join up anything built but not yet on the railway
  for (const b of g.s.buildings ?? []) if (!isLinked(g, b) && g.s.money > 1500 && linkBuilding(b)) { log.push(`  joined ${info(b.kind).name}`); return; }
  // grow towns that filled their order
  for (const t of g.s.sites) if (t.kind === 'town' && orderDone(g, t) && g.s.money > upgradePrice(stepOf(t)) + 500) if (!upgradeTown(g, t)) log.push(`  ${t.name} grew`);
  // build makers for open order goods nobody makes yet
  const linked = g.s.sites.filter(t => t.kind === 'town' && (t === ash || townLinked(g, t)));
  for (const t of linked) for (const k of Object.keys(orderOf(g, t)) as Good[]) {
    if ((t.got?.[k] ?? 0) >= orderOf(g, t)[k]!) continue;
    const makers = (g.s.buildings ?? []).filter(b => INDUSTRIES[b.kind].makes === k && isLinked(g, b));
    if (makers.length === 0) { if (!(g.s.buildings ?? []).some(b => INDUSTRIES[b.kind].makes === k)) buildFor(k); continue; }
    // factories also need their raw goods
    for (const f of makers.filter(m => isFactory(m.kind))) for (const w of Object.keys(info(f.kind).in ?? {}) as Good[])
      if (!(g.s.buildings ?? []).some(b => INDUSTRIES[b.kind].makes === w && isLinked(g, b)) && !noMaker.has(w)) { if (buildFor(w)) return; noMaker.add(w); }
    // a maker that makes nothing (fields covered): build another, as its card says
    if (makers.every(m => !isFactory(m.kind) && outputOf(g, m) === 0) && buildFor(k, true)) return;
  }
  // the engine shed needs a straight bit of line near Ashford, as the Train button says
  if (!g.s.shed) {
    for (const d of [1, -1, n, -n]) {
      const a = ash.y * n + ash.x, p = startPlan(g, a); if (!p) break;
      for (let k = 1; k <= 6; k++) extendPlan(g, p, a + d * k);
      if (p.path.length === 7 && typeof buildPlan(g, p) !== 'string') { trackChanged(g); log.push('  straight line for the shed'); if (g.s.shed) return; }
    }
  }
  // one train per two buildings, at least one per building early
  const want = Math.max(1, Math.ceil((g.s.buildings ?? []).filter(b => isLinked(g, b)).length * 1.2));
  if (g.s.trains.length < want && g.s.money > trainPrice(g) + 300) { const t = buyTrain(g); if (typeof t !== 'string') log.push(`  bought train ${t.id}`); return; }
  // link the nearest unlinked town, found a town on a settlement site
  if (g.s.money > +(process.env.LINKAT ?? 4000)) {
    const towns = g.s.sites.filter(t => t.kind === 'town' && !townLinked(g, t)).sort((a, b) => Math.hypot(a.x - ash.x, a.y - ash.y) - Math.hypot(b.x - ash.x, b.y - ash.y));
    for (const t of towns.slice(0, 4)) if (Math.hypot(t.x - ash.x, t.y - ash.y) < 40 && linkTown(t)) { log.push(`  linked ${t.name}`); return; } // the nearest one it can reach (some sit behind mountains or water)
  }
  {
    const p = g.s.sites.find(s => s.kind === 'plot' && Math.hypot(s.x - ash.x, s.y - ash.y) < 30);
    if (p && g.s.money > foundPrice(g, p) + 5000 && !foundTown(g, p)) { log.push(`  founded ${p.name}`); return; }
  }
  // 🚦 follow the Needs-you advice: double the held-up stretch (or build the passing loop)
  for (const j of jams(g)) { const ov0 = overlaps(); const sq = (j.loop ?? j.squares).filter(i => g.track.has(i) && !g.track.get(i)!.dbl); const c = sq.length * TRACK_COST.double;
    if (sq.length && g.s.money > c + 500) { for (const i of sq) g.track.get(i)!.dbl = true; g.s.money -= c; trackChanged(g); log.push(`  🚦 ${(g.s.t / 60).toFixed(2)}m doubled ${sq.length} squares near ${j.near}${overlaps() ? ` ⚠ trains now overlap: ${overlaps()} (squares ${sq.join(',')}, before: ${ov0 || 'none'})` : ''}`); return; } }
  if (sea()) return;
  // upgrades with spare money
  if (g.s.money > 15000) {
    for (const k of ['wag', 'eng', 'rep'] as const) { const p = FLEET[k].price[fleetLvl(g, k)]; if (p !== undefined && g.s.money > p * 2 && !buyFleet(g, k)) { log.push(`  fleet ${FLEET[k].name}`); return; } }
    for (const b of g.s.buildings ?? []) if (b.kind !== "dock" && b.lvl < maxLvlOf(g, b) && g.s.money > levelPrice(b) * 3 && !upgradeBuilding(g, b)) { trackChanged(g); log.push(`  ${info(b.kind).name} level ${b.lvl}`); return; }
  }
}

/** Coast squares of island k (land beside open sea), nearest to (x, y) first. */
function coast(k: number, x: number, y: number): number[] {
  const out: number[] = [], w = g.world;
  for (let i = 0; i < n * n; i++) if (w.islandOf[i] === k && w.terr[i] !== 0 && w.terr[i] !== 4 && [1, -1, n, -n].some(d => w.ocean[i + d])) out.push(i);
  return out.sort((a, b) => Math.hypot(a % n - x, ((a / n) | 0) - y) - Math.hypot(b % n - x, ((b / n) | 0) - y));
}
function tryDock(k: number, x: number, y: number, tries = 60): Building | null {
  for (const i of coast(k, x, y).slice(0, tries)) {
    const p = bestPlacement(g, 'dock', i % n, (i / n) | 0); if (!p.place) continue;
    const b = build(g, p.place); if (typeof b === 'string') continue;
    trackChanged(g); return b;
  }
  return null;
}
const failedIsl = new Set<number>(), seaRuns = new Set<number>();
/** Docks, landings, ships, island trains, landmarks and expeditions (like a player crossing the sea). */
function sea(): boolean {
  if (process.env.NOSEA) return false;
  const docks = (g.s.buildings ?? []).filter(isDock), home = g.world.home;
  const homeDock = docks.find(b => islandOfB(g, b) === home);
  const reached = reachedIslands(g);
  const towns = g.s.sites.filter(t => t.kind === 'town');
  const islTowns = (k: number) => towns.filter(t => g.world.islandOf[t.y * n + t.x] === k);
  const targets = [...new Set(towns.map(t => g.world.islandOf[t.y * n + t.x]!))].filter(k => k !== home && !reached.has(k) && !failedIsl.has(k))
    .sort((a, b) => Math.hypot(g.world.islands[a]!.cx - ash.x, g.world.islands[a]!.cy - ash.y) - Math.hypot(g.world.islands[b]!.cx - ash.x, g.world.islands[b]!.cy - ash.y));
  if (!homeDock) {
    if (lockedText(g, 'dock') || g.s.money < priceOf(g, 'dock', home) + 6000 || !targets.length) return false;
    const I = g.world.islands[targets[0]!]!, b = tryDock(home, I.cx, I.cy);
    if (b) { const ok = linkBuilding(b); log.push(`  built a Dock on Ashford Isle ${ok ? '' : '(not joined)'}`); return true; }
    // the coast is still in the fog: run a line out to the shore facing that island (track uncovers the land round it)
    if (!seaRuns.has(targets[0]!)) { seaRuns.add(targets[0]!); const c = coast(home, I.cx, I.cy).slice(0, 12); const ok = lay(c); log.push(`  track to the coast toward ${islandName(g, targets[0]!)} ${ok ? '' : '(failed)'}`); return ok; }
    return false;
  }
  if (!isLinked(g, homeDock)) { if (g.s.money > 1500 && linkBuilding(homeDock)) log.push('  joined the Dock'); return false; }
  // a landing on the nearest island with towns that a dock reaches
  if (targets.length && g.s.money > priceOf(g, 'dock', targets[0]) + 4000) {
    const k = targets[0]!, I = g.world.islands[k]!;
    const t = islTowns(k).sort((a, b) => Math.hypot(a.x - homeDock.x, a.y - homeDock.y) - Math.hypot(b.x - homeDock.x, b.y - homeDock.y))[0]!;
    const b = tryDock(k, t.x, t.y, 80);
    if (b) { log.push(`  landed on ${islandName(g, k)} (${I.size} squares)`); return true; }
    // too far: grow the home dock's reach, else give up on this island for a while
    if (homeDock.lvl < 3 && g.s.money > levelPrice(homeDock) + 2000 && !upgradeBuilding(g, homeDock)) { trackChanged(g); log.push(`  Dock level ${homeDock.lvl}`); return true; }
    if (homeDock.lvl >= 3) { failedIsl.add(k); log.push(`  can't land on ${islandName(g, k)}`); }
  }
  // a ship for each pair of linked docks with a sea route
  const ld = linkedDocks(g);
  if (ld.length >= 2 && (g.s.ships?.length ?? 0) < ld.length - 1 && g.s.money > shipPrice(g) + 1000) {
    for (const d of ld) if (lanesFrom(g, d.id).length && typeof buyShip(g, d) !== 'string') { log.push(`  bought a ship (${g.s.ships!.length})`); return true; }
  }
  // link towns on reached islands, from the landing
  for (const k of reached) if (k !== home) for (const t of islTowns(k)) if (!townLinked(g, t) && g.s.money > 3000 && !failedTown.has(t.id)) {
    if (linkTown(t)) { log.push(`  linked ${t.name} on ${islandName(g, k)}`); return true; } failedTown.add(t.id);
  }
  // trains on each island: about one per linked building there
  for (const d of ld) {
    const k = islandOfB(g, d); if (k === home) continue;
    const bs = (g.s.buildings ?? []).filter(b => !isDock(b) && islandOfB(g, b) === k && isLinked(g, b)).length + islTowns(k).filter(t => townLinked(g, t)).length;
    const have = g.s.trains.filter(t => islandOfTrain(g, t) === k).length;
    if (have < Math.max(1, Math.ceil(bs * 0.8)) && g.s.money > trainPrice(g) + 1500) { const t = buyTrainAt(g, d); if (typeof t !== 'string') { log.push(`  train ${t.id} by boat to ${islandName(g, k)}`); return true; } }
  }
  // spare money: Ashford landmarks, town projects, parks, fleet upgrades per island, ship upgrades, expeditions
  for (const P of PROJECTS) for (const t of P.ashford ? [ash] : towns.filter(t => townLinked(g, t) || t === ash))
    if (g.s.money > P.price * (P.ashford ? 1.3 : 2.5) && !projectError(g, t, P.k) && !buyProject(g, t, P.k)) { log.push(`  ${P.icon} ${P.name} at ${t.name}`); return true; }
  if (g.s.money > 40000) for (const t of towns) if (townLinked(g, t)) { const p = nextParkPrice(g, t); if (p && g.s.money > p * 4 && !buyPark(g, t)) { log.push(`  park at ${t.name}`); return true; } }
  if (g.s.money > 20000) for (const k of reached) for (const f of ['wag', 'eng', 'rep'] as const) { const p = FLEET[f].price[fleetLvl(g, f, k)]; if (p !== undefined && g.s.money > p * 2 && !buyFleet(g, f, k)) { log.push(`  fleet ${FLEET[f].name} on ${islandName(g, k)}`); return true; } }
  if (g.s.money > 30000 && g.s.ships?.length) for (const f of ['spd', 'hold'] as const) { const p = SHIP_UP[f].price[shipUpLvl(g, f)]; if (p !== undefined && g.s.money > p * 2 && !buyShipUp(g, f)) { log.push(`  ship upgrade ${f}`); return true; } }
  for (const d of ld) if (d.lvl < 3 && g.s.money > levelPrice(d) * 3 && !upgradeBuilding(g, d)) { trackChanged(g); log.push(`  Dock level ${d.lvl}`); return true; }
  if (!targets.length) for (const d of ld) if (!expeditionError(g, d) && g.s.money > expeditionPrice(g) * 1.3) {
    const r = sendExpedition(g, d); if (typeof r === 'string') continue;
    g = r.g; n = g.world.n; ash = g.s.sites[0]!; failedIsl.clear(); failedTown.clear(); explored.clear();
    log.push(`  🗺 expedition: ${r.islands.join(', ')} (${r.towns} towns)`); return true;
  }
  return false;
}
const failedTown = new Set<number>();
/** Two trains on one rail piece (they must never overlap). */
function overlaps(): string {
  const at = new Map<number, number>();
  for (const t of g.s.trains) for (const st of t.trail) { const o = at.get(st.piece); if (o !== undefined && o !== t.id) return `trains ${o} and ${t.id} on piece ${st.piece}`; at.set(st.piece, t.id); }
  return '';
}

const t0 = Date.now();
for (let s = 0; s < minutes * 60; s++) {
  try { for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g); } } catch (e) { console.log('GAME ERROR', (g.s.t / 60).toFixed(1), (e as Error).stack?.split('\n').slice(0, 5).join(' | ')); }
  if (process.env.BOTNEWS && g.news?.length) { for (const m of g.news) if (/[⛈🌊🌤🔧🔥🚒]/u.test(m)) console.log('news', (g.s.t / 60).toFixed(1), m); g.news.length = 0; }
  if (s % 5 === 0) { if (checkStuck(g)) rescues++; }
  if (s % 10 === 0) { try { think(); } catch (e) { log.push(`  BOT ERROR ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`); } }
  if (process.env.PLAYTEST && s % 60 === 59) monitor(g);
  if (s % 300 === 299) log.push(`min ${Math.round((s + 1) / 60)}: $${Math.round(g.s.money)} earned $${Math.round(g.s.earned ?? 0)} orders ${g.s.orders ?? 0} level ${g.s.rlv ?? 0} towns ${g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t)).length} trains ${g.s.trains.length} ships ${g.s.ships?.length ?? 0} islands ${reachedIslands(g).size} buildings ${(g.s.buildings ?? []).length}`);
}
if (process.env.PLAYTEST) report(g);
const idle = g.s.trains.filter(t => !t.job).length;
if (process.env.BOTTOWNS) for (const t of g.s.sites) if (t.kind === 'town' && (t === ash || townLinked(g, t))) log.push(`  ${t.name} step ${stepOf(t)} order ${JSON.stringify(orderOf(g, t))} got ${JSON.stringify(t.got ?? {})}`);
const ms = g.s.ms;
if (ms) log.push(`missions done ${ms.done.length} ($${ms.done.reduce((v, d) => v + d.reward, 0)}): ${ms.done.map(d => `${d.min}m ${d.title}`).join(' · ')}\n  now: ${[ms.main, ...ms.side].filter(Boolean).map(m => m!.title).join(' | ')}`);
console.log(log.join('\n'));
console.log(`seed ${seed}: ${minutes} game min in ${((Date.now() - t0) / 1000).toFixed(1)} s · idle trains ${idle}/${g.s.trains.length} · no-fail top-ups ${rescues}`);
if (process.env.BOTNEWS) for (const m of g.news ?? []) if (/[⛈🌊🌤🔧🔥🚒]/u.test(m)) console.log("news", m);
if (process.env.BOTDEBUG) for (const t of g.s.trains) console.log('train', t.id, JSON.stringify(t.job), 'v', t.v, 'dest', t.dest, 'plan', t.plan.length, 'refuge', t.refuge, 'cargo', JSON.stringify(t.cargo), 'head', g.net.pieces[t.trail.at(-1)!.piece]!.squares.at(-1));
if (process.env.BOTDEBUG) for (const b of g.s.buildings ?? []) console.log(b.kind, b.id, 'out/min', Math.round(outputOf(g, b) * 60), 'stock', Math.round(b.stock), 'linked', isLinked(g, b), 'yard', yardSquares(n, b).join(','));
if (process.env.BOTSAVE) { const { saveTo } = await import('../src/save/save.ts'); const fs = await import('node:fs'); const file = process.env.BOTSAVE; saveTo({ getItem: () => null, setItem: (_k, v) => fs.writeFileSync(file, v) }, g); }
