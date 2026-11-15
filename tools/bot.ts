// A simple bot player: builds what open orders need, lays track to it, buys trains, grows towns, links and founds
// towns, upgrades buildings and the fleet. No screen. Usage: npx vite-node tools/bot.ts [seed] [minutes]
import { newGame, trackChanged } from '../src/game.ts';
import { outputOf, bestPlacement, build, type Building, info, isFactory, isLinked, lockedText, priceOf, yardSquares, type IndustryKind, INDUSTRIES, type Good } from '../src/buildings/industries.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { squareCost } from '../src/track/rules.ts';
import { tickProduction } from '../src/economy/production.ts';
import { foundTown, FOUND_PRICE, orderDone, orderOf, tickTowns, townLinked, upgradePrice, upgradeTown, stepOf } from '../src/economy/towns.ts';
import { buyTrain, tickTrains, trainPrice } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { buyFleet, FLEET, fleetLvl, levelPrice, upgradeBuilding } from '../src/economy/upgrades.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { breaksChanged } from '../src/game.ts';
import type { Site } from '../src/state.ts';

const [seed = 4242, minutes = 20] = process.argv.slice(2).map(Number);
const g = newGame(seed), n = g.world.n, ash = g.s.sites[0]!;
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
function buildFor(k: Good): boolean {
  const kind = (Object.keys(INDUSTRIES) as IndustryKind[]).find(m => INDUSTRIES[m].makes === k && !isFactory(m)) ??
    (Object.keys(INDUSTRIES) as IndustryKind[]).find(m => INDUSTRIES[m].makes === k);
  if (!kind || lockedText(g, kind) || priceOf(g, kind) + 800 > g.s.money) return false;
  const cx = ash.x, cy = ash.y;
  for (let r = 5; r < 26; r++) for (let a = 0; a < 16; a++) {
    const x = Math.round(cx + Math.cos(a * 0.39) * r), y = Math.round(cy + Math.sin(a * 0.39) * r);
    const p = bestPlacement(g, kind, x, y); if (!p.place) continue;
    const b = build(g, p.place); if (typeof b === 'string') continue;
    trackChanged(g);
    if (linkBuilding(b)) { log.push(`  built ${info(kind).name}`); return true; }
  }
  return false;
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
      if (!(g.s.buildings ?? []).some(b => INDUSTRIES[b.kind].makes === w && isLinked(g, b))) { buildFor(w); return; }
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
  if (g.s.money > 4000) {
    const towns = g.s.sites.filter(t => t.kind === 'town' && !townLinked(g, t)).sort((a, b) => Math.hypot(a.x - ash.x, a.y - ash.y) - Math.hypot(b.x - ash.x, b.y - ash.y));
    if (towns[0] && Math.hypot(towns[0].x - ash.x, towns[0].y - ash.y) < 40 && linkTown(towns[0])) { log.push(`  linked ${towns[0].name}`); return; }
  }
  if (g.s.money > FOUND_PRICE + 5000) {
    const p = g.s.sites.find(s => s.kind === 'plot' && Math.hypot(s.x - ash.x, s.y - ash.y) < 30);
    if (p && !foundTown(g, p)) { log.push(`  founded ${p.name}`); return; }
  }
  // upgrades with spare money
  if (g.s.money > 15000) {
    for (const k of ['wag', 'eng', 'rep'] as const) { const p = FLEET[k].price[fleetLvl(g, k)]; if (p !== undefined && g.s.money > p * 2 && !buyFleet(g, k)) { log.push(`  fleet ${FLEET[k].name}`); return; } }
    for (const b of g.s.buildings ?? []) if (b.lvl < 3 && g.s.money > levelPrice(b) * 3 && !upgradeBuilding(g, b)) { log.push(`  ${info(b.kind).name} level ${b.lvl}`); return; }
  }
}

const t0 = Date.now();
for (let s = 0; s < minutes * 60; s++) {
  for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (tickBreaks(g)) breaksChanged(g); }
  if (s % 5 === 0) { if (checkStuck(g)) rescues++; }
  if (s % 10 === 0) think();
  if (s % 300 === 299) log.push(`min ${Math.round((s + 1) / 60)}: $${Math.round(g.s.money)} earned $${Math.round(g.s.earned ?? 0)} orders ${g.s.orders ?? 0} level ${g.s.rlv ?? 0} towns ${g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t)).length} trains ${g.s.trains.length} buildings ${(g.s.buildings ?? []).length}`);
}
const idle = g.s.trains.filter(t => !t.job).length;
const ms = g.s.ms;
if (ms) log.push(`missions done ${ms.done.length} ($${ms.done.reduce((v, d) => v + d.reward, 0)}): ${ms.done.map(d => `${d.min}m ${d.title}`).join(' · ')}\n  now: ${[ms.main, ...ms.side].filter(Boolean).map(m => m!.title).join(' | ')}`);
console.log(log.join('\n'));
console.log(`seed ${seed}: ${minutes} game min in ${((Date.now() - t0) / 1000).toFixed(1)} s · idle trains ${idle}/${g.s.trains.length} · no-fail top-ups ${rescues}`);
if (process.env.BOTDEBUG) for (const t of g.s.trains) console.log('train', t.id, JSON.stringify(t.job), 'v', t.v, 'dest', t.dest, 'plan', t.plan.length, 'refuge', t.refuge, 'cargo', JSON.stringify(t.cargo), 'head', g.net.pieces[t.trail.at(-1)!.piece]!.squares.at(-1));
if (process.env.BOTDEBUG) for (const b of g.s.buildings ?? []) console.log(b.kind, b.id, 'out/min', Math.round(outputOf(g, b) * 60), 'stock', Math.round(b.stock), 'linked', isLinked(g, b), 'yard', yardSquares(n, b).join(','));
if (process.env.BOTSAVE) { const { saveTo } = await import('../src/save/save.ts'); const fs = await import('node:fs'); const file = process.env.BOTSAVE; saveTo({ getItem: () => null, setItem: (_k, v) => fs.writeFileSync(file, v) }, g); }
