import type { Game, Site } from '../state.ts';
import type { Building } from '../buildings/industries.ts';
import { destIsland, MAX_RUSH, maxLvlOf, minLoad, type Rush, RUSH_MUL, rushBySea, RUSH_STEP } from '../economy/upgrades.ts';
import { reachedIslands } from '../progress/missions.ts';
import { aName, capOf, farText, GOODS, type Good, INDUSTRIES, inputsOf, type IndustryKind, isFactory, isLinked, shareAt } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { capitalOf, tradeOf, tradeWhy } from '../economy/trade.ts';
import { islandName } from '../ships/docks.ts';
import { orderDone, orderOf, orderProgress, sizeName, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { bldDist, bldOf, destSquares, goodOf, type Plan, shipPlan, siteOf } from '../economy/shipping.ts';
import { islandOfTrain } from '../economy/dispatch.ts';
import { jams } from '../economy/jams.ts';
import { isDock, islandOfB } from '../ships/docks.ts';
import { TRACK_COST } from '../track/rules.ts';
import { LEVEL_ISLANDS, levelNow, RLV, UNLOCKS } from '../economy/dispatch.ts';
import { fmtMoney } from './hud.ts';
import { bodyPoint } from '../trains/train.ts';
import { TILE } from '../world/terrain.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const open = (kind: 'town' | 'bld' | 'train', id: number, label = '📍') => `<button class="mini" data-act="open" data-kind="${kind}" data-id="${id}">${label}</button>`;

/** The nearest town, for names like "Lumber Camp near Brinemoor". */
export function placeName(g: Game, b: Building): string {
  let best: Site | undefined, bd = Infinity;
  for (const t of g.s.sites) if (t.kind === 'town' && (t.pop ?? 0) > 0) { const d = Math.hypot(t.x - b.x, t.y - b.y); if (d < bd) { bd = d; best = t; } }
  return `${INDUSTRIES[b.kind].name}${best?.name ? ' near ' + best.name : ''}`;
}

/** What needs the player: towns ready to grow, buildings off the railway, factories short of goods, full buildings, idle trains. */
export interface Stuck {
  icon: string; text: string; btn: string; x: number; y: number; /** the building it is about */ bld?: number; name?: string;
  /** buildings stuck for the same reason are shown as one group: the cause, said for several, and the button that fixes it */
  cause?: string; many?: string; fix?: string;
}
export function stuckList(g: Game, plan = shipPlan(g)): Stuck[] {
  const out: Stuck[] = [];
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t) && orderDone(g, t)) out.push({ icon: '⬆', text: `${esc(t.name ?? 'A town')} can grow into a ${sizeName(stepOf(t) + 1)} (${fmtMoney(upgradePrice(stepOf(t)))})`, btn: open('town', t.id, 'Open ›'), x: t.x, y: t.y });
  for (const b of g.s.buildings ?? []) {
    if (b.closed) continue; // ⛔ closed on purpose: not a problem
    const name = placeName(g, b);
    const rail = `<button class="mini" data-act="railto" data-x="${b.x}" data-y="${b.y}">🛤 Lay track ›</button>`;
    if (!isLinked(g, b)) { out.push({ icon: '🔌', text: `The ${name} isn't on the railway: lay track to one end of its yard`, btn: rail, x: b.x, y: b.y, bld: b.id, name, cause: 'off', many: "aren't on the railway: lay track to one end of each yard", fix: rail }); continue; }
    if (isFactory(b.kind)) { const w = factoryState(g, b).waits; if (w.length) { const gs = w.map(k => `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`).join(' and '); out.push({ icon: '⏳', text: `The ${name} waits for ${gs}`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id, name, cause: 'wait/' + w.join(), many: `wait for ${gs}` }); } }
    const k = INDUSTRIES[b.kind].makes as Good;
    // a farm whose fields are all covered by track or buildings makes nothing at all (one town waiting is enough to say so)
    if ((b.kind === 'farm' || b.kind === 'wool') && shareAt(g, b) === 0) out.push({ icon: '🌾', text: `The ${name} makes nothing: track or buildings cover all its ${b.kind === 'farm' ? 'fields' : 'pasture'}. Remove track next to it, or build another on open grass`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id, name, cause: 'nofields', many: `make nothing: track or buildings cover all their ${b.kind === 'farm' ? 'fields' : 'pasture'}` });
    if (b.kind !== 'dock' && b.stock >= capOf(b) && !plan.get(b.id)) {
      const d = outDiag(g, b, k), sell = `<button class="mini" data-act="sell" data-id="${b.id}">💸 Sell ›</button>`;
      out.push({ icon: '📦', text: `The ${name} is full: ${d.text}`, btn: d.btn || sell, x: b.x, y: b.y, bld: b.id, name, cause: 'full/' + k + d.text, many: `are full: ${d.text}`, fix: d.btn || open('bld', b.id) });
    }
  }
  for (const x of bottlenecks(g, plan)) {
    if (!x.near.length) { // none of the makers is on those towns' railway
      const t = x.towns[0]!, kind = INDUSTRIES[x.makers[0]!.kind].name;
      out.push({ icon: '🐢', text: `${x.towns.length} towns wait for ${GOODS[x.good].icon} ${GOODS[x.good].name.toLowerCase()}, but no ${kind} can reach them: build one on their island, or a dock on each side`, btn: open('town', t.id), x: t.x, y: t.y });
      continue;
    }
    x.makers = x.near;
    const boxed = (m: Building) => (m.kind === 'farm' || m.kind === 'wool') && shareAt(g, m) < 0.75; // fields covered by track or buildings
    const b = x.makers.find(m => isFactory(m.kind) && factoryState(g, m).waits.length) ?? x.makers.find(boxed) ?? [...x.makers].sort((p, q) => p.lvl - q.lvl)[0]!;
    const name = placeName(g, b), w = isFactory(b.kind) ? factoryState(g, b).waits : [];
    // a maker standing full makes enough: what's missing is a train to carry it
    const full = !w.length && x.makers.some(m => !m.closed && m.stock >= capOf(m) * 0.9) && !g.s.trains.some(t => !t.job);
    const fix = b.closed ? `the ${name} is closed: open it again` : w.length ? `the ${name} is short of ${w.map(k => `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`).join(' and ')}: ${w.map(k => farText(g, k)).find(Boolean)?.replace(/^./, c => c.toLowerCase()) ?? 'bring more in'}`
      : full ? `the ${placeName(g, x.makers.find(m => m.stock >= capOf(m) * 0.9)!)} is full, but every train is busy: buy another train (🚂 Train)`
      : boxed(b) ? `the ${name} works at ${Math.round(shareAt(g, b) * 100)}%: track or buildings cover its fields. Remove track next to it, or build another on open grass`
      : b.lvl < maxLvlOf(g, b) ? `the ${name} can't keep up: upgrade it or build another` : `the ${name} can't keep up: build another`;
    out.push({ icon: '🐢', text: `${x.towns.length} towns wait for ${GOODS[x.good].icon} ${GOODS[x.good].name.toLowerCase()}: ${fix}`, btn: open('bld', b.id), x: b.x, y: b.y, ...(b.closed ? {} : { bld: b.id }) });
  }
  for (const j of jams(g)) {
    const n = j.trains.length, who = `${n} train${n > 1 ? 's are' : ' is'} held up near ${esc(j.near)}`;
    if (j.crowded) { // more trains than work and track on that island: ship spares away
      const to = (g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b) && islandOfB(g, b) !== j.island)
        .sort((a, b) => +(islandOfB(g, b) === g.world.home) - +(islandOfB(g, a) === g.world.home))[0];
      out.push({ icon: '🚦', text: `${who}: ${esc(j.crowded.island)} has ${j.crowded.idle} trains with no work standing on its line. Ship spare trains to another island (⚓ Dock → 🚂 Trains there)`, btn: to ? `<button class="mini" data-act="open" data-kind="bld" data-id="${to.id}" data-page="trains">⛴ Ship ›</button>` : open('train', j.trains[0]!.id), x: j.x, y: j.y });
    } else if (j.squares.length) {
      if (j.loop) out.push({ icon: '🚦', text: `${who}: trains wait for each other on single track. A 🔁 passing loop here (${j.loop.length} squares, ${fmtMoney(j.loop.length * TRACK_COST.double)}) lets them pass`, btn: `<button class="mini" data-act="dbljam" data-sq="${j.loop.join(',')}">🔁 Loop ›</button>`, x: j.x, y: j.y });
      else out.push({ icon: '🚦', text: `${who}: the line ahead is single track. Double ${j.squares.length} square${j.squares.length > 1 ? 's' : ''} (${fmtMoney(j.squares.length * TRACK_COST.double)}) so trains can pass`, btn: `<button class="mini" data-act="dbljam" data-sq="${j.squares.join(',')}">═ Double ›</button>`, x: j.x, y: j.y });
    } else out.push({ icon: '🚦', text: `${who}: trains are queuing on double track. Another line or a bigger yard there would help`, btn: open('train', j.trains[0]!.id), x: j.x, y: j.y });
  }
  const idle = g.s.trains.filter(t => !t.job);
  if (idle.length) { const p = bodyPoint(g.net, idle[0]!, 0); out.push({ icon: '💤', text: `${idle.length} train${idle.length > 1 ? 's wait' : ' waits'} for a load`, btn: open('train', idle[0]!.id), x: p.x / TILE - 0.5, y: p.y / TILE - 0.5 }); }
  const rank = ['⬆', '🚦', '🐢', '🌾', '🔌', '📦', '💤', '⏳']; // the most useful first: a starved factory usually shows up in a 🐢 line too
  return out.sort((a, b) => rank.indexOf(a.icon) - rank.indexOf(b.icon));
}

/** Goods that 2+ towns on the railway wait for, though you make them: no building of yours sends them there yet. */
export function bottlenecks(g: Game, plan = shipPlan(g)): { good: Good; towns: Site[]; makers: Building[]; near: Building[] }[] {
  const out: { good: Good; towns: Site[]; makers: Building[]; near: Building[] }[] = [];
  const bs = (g.s.buildings ?? []).filter(b => b.kind !== 'dock' && isLinked(g, b));
  const want = new Map<Good, Site[]>();
  for (const t of g.s.sites) {
    if (t.kind !== 'town' || !townLinked(g, t)) continue;
    const o = orderOf(g, t);
    for (const k of Object.keys(o) as Good[]) {
      if ((t.got?.[k] ?? 0) >= o[k]!) continue;
      const fed = bs.some(b => INDUSTRIES[b.kind].makes === k && plan.get(b.id)?.to.kind === 'town' && plan.get(b.id)?.to.id === t.id);
      if (!fed) want.set(k, [...(want.get(k) ?? []), t]);
    }
  }
  for (const [good, towns] of want) {
    const makers = bs.filter(b => INDUSTRIES[b.kind].makes === good);
    if (towns.length < 2 || !makers.length) continue;
    // makers that reach one of those towns by rail (or send it over the sea already)
    const isl = reachedIslands(g), n = g.world.n, on = (x: number, y: number) => isl.has(g.world.islandOf[y * n + x]!);
    const near = makers.filter(b => { const d = bldDist(g, b); return towns.some(t => destSquares(g, { kind: 'town', id: t.id }).some(q => d[q]! >= 0) || on(b.x, b.y) && on(t.x, t.y)); });
    out.push({ good, towns, makers, near });
  }
  return out.sort((a, b) => b.towns.length - a.towns.length);
}

/** The 📋 Orders board: Railway level, what needs you, then every town's order on the railway, nearest to done first. */
export function ordersHtml(g: Game): string {
  const L = g.s.rlv ?? 0, o = g.s.orders ?? 0, next = RLV[L + 1], prev = RLV[L] ?? 0;
  let h = `<div class="head"><b class="big">📋</b><div><h2>Orders</h2><span class="chip2">⭐ Railway level ${L}</span> <span class="chip2">${o} order${o === 1 ? '' : 's'} filled</span></div></div>`;
  if (next !== undefined) {
    h += `<div class="row"><b class="ico">⭐</b><div class="grow"><div class="line"><span>Level ${L + 1}</span><span>${o} / ${next}</span></div>${bar((o - prev) / (next - prev), '#ffd27a')}`
      + `<small>${UNLOCKS[L + 1] ? `Unlocks ${UNLOCKS[L + 1]}` : 'Every order filled counts'}</small></div></div>`;
    const bl = levelNow(g).blocked;
    if (bl) h += `<div class="warn">⛵ Level ${bl.level} also needs ${bl.need} islands reached: you have ${bl.have}. Build a ⚓ Dock and land on another island</div>`;
    else if (LEVEL_ISLANDS[L + 1]) h += `<small class="why">⛵ Level ${L + 1} also needs ${LEVEL_ISLANDS[L + 1]} islands reached (Ashford Isle counts as one)</small>`;
  } else h += `<div class="gift">⭐ Top Railway level: every order still pays</div>`;
  const plan = shipPlan(g), stuck = stuckList(g, plan);
  h += rushBox(g, plan);
  if (stuck.length) {
    h += `<h3>⚠ Needs you</h3>`;
    h += stuckRows(stuck, 6);
  }
  const towns = g.s.sites.filter((t): t is Site => t.kind === 'town' && townLinked(g, t)).sort((a, b) => orderProgress(g, b) - orderProgress(g, a));
  h += `<h3>🏘 Towns on your railway</h3>`;
  for (const t of towns) {
    const ord = orderOf(g, t), p = orderProgress(g, t);
    const goods = (Object.keys(ord) as Good[]).map(k => { const need = ord[k]!, got = Math.min(need, Math.floor(t.got?.[k] ?? 0)); return `<span class="chip2${got >= need ? ' ok' : ''}">${GOODS[k].icon} ${got}/${need}</span>`; }).join(' ');
    h += `<div class="row"><b class="ico">${p >= 1 ? '⬆' : '🏘'}</b><div class="grow"><div class="line"><span>${esc(t.name ?? 'Town')} · ${sizeName(stepOf(t))}</span><span>${Math.round(p * 100)}%</span></div>${bar(p, p >= 1 ? '#5cc46a' : '#e8a33c')}<div class="chips">${goods}</div></div>${open('town', t.id, '›')}</div>`;
  }
  // 🤝 trade orders between island capitals
  const caps = Object.keys(g.s.trade ?? {}).map(Number).map(k => capitalOf(g, k)).filter((t): t is Site => !!t && !!tradeOf(g, t));
  if (caps.length) {
    h += `<h3>🤝 Trade between islands</h3>`;
    for (const t of caps) {
      const o = tradeOf(g, t)!, G = GOODS[o.good], why = tradeWhy(g, t, o);
      h += `<div class="row"><b class="ico">${G.icon}</b><div class="grow"><div class="line"><span>👑 ${esc(t.name ?? 'Capital')} wants ${G.name.toLowerCase()} from ${esc(islandName(g, o.from))}</span><span>${o.got}/${o.need}</span></div>${bar(o.got / o.need, '#6bb8e8')}${why ? `<small class="why">⚠ ${why}</small>` : ''}</div>${open('town', t.id, '›')}</div>`;
    }
  }
  const off = g.s.sites.filter(t => t.kind === 'town' && (t.pop ?? 0) > 0 && !townLinked(g, t)).length;
  if (off) h += `<div class="note">🔌 ${off} more town${off > 1 ? 's' : ''} you've found ${off > 1 ? 'are' : 'is'} not on the railway yet</div>`;
  return h;
}

/**
 * Nothing on the railway takes a good: say who would (towns on another island, a factory that uses it) and what is
 * missing to get it there, with the button that starts the fix.
 */
export function outDiag(g: Game, b: Building, k: Good): { text: string; btn: string } {
  const G = `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`, n = g.world.n, here = g.world.islandOf[b.y * n + b.x];
  const far = g.s.sites.filter(t => t.kind === 'town' && townLinked(g, t) && g.world.islandOf[t.y * n + t.x] !== here && (orderOf(g, t)[k] ?? 0) > (t.got?.[k] ?? 0));
  const dock = `<button class="mini" data-act="builddock">⚓ Build a dock ›</button>`;
  if (far.length) {
    const isl = islandName(g, g.world.islandOf[far[0]!.y * n + far[0]!.x]!), myDock = (g.s.buildings ?? []).some(d => d.kind === 'dock' && isLinked(g, d) && islandOfB(g, d) === here);
    return { text: `${far.map(t => esc(t.name ?? 'a town')).slice(0, 2).join(' and ')} on ${esc(isl)} want ${G}, but no sea route goes there: ${myDock ? `build a ⚓ landing on ${esc(isl)} within your dock's reach` : 'build a ⚓ dock here and a landing there'}`, btn: dock };
  }
  const use = (Object.keys(INDUSTRIES) as IndustryKind[]).find(f => isFactory(f) && inputsOf(f).includes(k));
  return { text: `no place on the railway needs ${G} now${use ? `: ${aName(INDUSTRIES[use].name)} would use it, or sell it` : ': sell it'}`, btn: '' };
}

/** Buildings whose goods wait for a free train: plenty ready, somewhere to send them, no train coming, and every train on their island busy. */
export function waitingForTrain(g: Game, plan: Plan): Set<number> {
  const out = new Set<number>(), busy = new Map<number, boolean>(), n = g.world.n;
  const allBusy = (isl: number) => { if (!busy.has(isl)) busy.set(isl, !g.s.trains.some(t => !t.job && islandOfTrain(g, t) === isl)); return busy.get(isl)!; };
  for (const b of g.s.buildings ?? []) {
    if (b.closed || b.kind === 'dock' || !plan.get(b.id) || b.stock < Math.max(20, minLoad(g)) || !isLinked(g, b)) continue;
    if (g.s.trains.some(t => t.job?.src === b.id)) continue;
    if (allBusy(g.world.islandOf[b.y * n + b.x]!)) out.add(b.id);
  }
  return out;
}

/** Where a rush's goods come from now, in plain words (red when nothing brings them). */
export function rushRoute(g: Game, r: Rush, plan: Plan): { text: string; bad: boolean } {
  let rail = 0, seaFrom = -1;
  const isl = destIsland(g, r.to), docksIsl = (id: number) => { const d = bldOf(g, id); return d ? islandOfB(g, d) : -2; };
  const look = (src: Building, k: Good, v: { to: { kind: string; id: number }; rush?: boolean; sea?: number; then?: number }) => {
    if (!v.rush || k !== r.good) return;
    if (v.sea === undefined) { if (v.to.kind === r.to.kind && v.to.id === r.to.id) rail++; }
    else if (docksIsl(v.then ?? v.sea) === isl && seaFrom < 0) seaFrom = islandOfB(g, src);
  };
  for (const [id, v] of plan) { const b = bldOf(g, id); if (b) look(b, goodOf(b), v); }
  for (const [key, v] of plan.docks) { const [id, k] = key.split('/'); const b = bldOf(g, +id!); if (b) look(b, k as Good, v); }
  const afloat = (g.s.ships ?? []).some(s => s.hold.some(q => q.good === r.good && docksIsl(q.then ?? q.to) === isl));
  if (rail) return { text: `🚂 ${rail === 1 ? 'a building sends' : `${rail} buildings send`} it here first`, bad: false };
  if (seaFrom >= 0) return { text: `🚢 comes by ship from ${esc(islandName(g, seaFrom))}`, bad: false };
  if (afloat) return { text: '🚢 on its way by ship', bad: false };
  const trains = g.s.trains.filter(t => t.job && t.job.good === r.good && t.job.to.kind === r.to.kind && t.job.to.id === r.to.id).length;
  if (trains) return { text: `🚂 ${trains === 1 ? 'a train is' : `${trains} trains are`} bringing it`, bad: false };
  if ((g.s.rush ?? []).some(o => o !== r && o.good === r.good)) return { text: '⏳ its makers serve the earlier rush first', bad: false };
  return rushBySea(g, r.to, r.good) ? { text: '🚢 nothing on this island makes it, and no dock route brings it', bad: true } : { text: 'nothing on your railway that reaches it makes it yet', bad: true };
}

/** ⭐ The rushes running, on top of the Orders board: progress, where they come from, ＋/− for factories, stop with refund. */
function rushBox(g: Game, plan: Plan): string {
  const R = g.s.rush ?? [], n = R.length;
  let h = `<h3>⭐ Rushes ${n}/${MAX_RUSH}</h3>`;
  if (!n) return h + `<div class="note">⭐ Open a town or factory and tap ⭐ Rush next to a good: every maker that reaches it sends there first, by ship too. Paid up front; what isn't delivered is refunded if you stop it.</div>`;
  for (const r of R) {
    const tot = Math.max(r.n ?? r.left, r.left), done = tot - Math.max(0, r.left), G = GOODS[r.good], rt = rushRoute(g, r, plan);
    const place = r.to.kind === 'town' ? esc(siteOf(g, r.to.id)?.name ?? 'a town') : (() => { const b = bldOf(g, r.to.id); return b ? 'the ' + placeName(g, b) : 'a factory'; })();
    const back = r.pu ? Math.round(r.pu * Math.min(Math.max(0, r.left), r.paid ?? 0) / 10) * 10 : 0, step = Math.round((r.pu ?? 0) * RUSH_STEP / 10) * 10;
    const ab = `data-kind="${r.to.kind}" data-id="${r.to.id}" data-good="${r.good}"`;
    h += `<div class="row"><b class="ico">${G.icon}</b><div class="grow"><div class="line"><span>⭐ ${G.name} to ${place}</span><span>${done} / ${tot}</span></div>${bar(done / Math.max(1, tot), '#ffd27a')}`
      + `<small class="${rt.bad ? 'why' : ''}"${rt.bad ? ' style="color:#ff8a6a"' : ''}>${rt.text}</small><div class="chips">`
      + (r.to.kind === 'bld' ? `<button class="mini" data-act="rushamt" data-d="-${RUSH_STEP}" ${ab}>−${RUSH_STEP}${step ? ` · ${fmtMoney(step)} back` : ''}</button><button class="mini" data-act="rushamt" data-d="${RUSH_STEP}" ${ab} ${g.s.money >= step ? '' : 'disabled'}>＋${RUSH_STEP}${step ? ` · ${fmtMoney(step)}` : ''}</button>` : '')
      + `<button class="mini" data-act="rush" ${ab}>✕ Stop${back ? ` · ${fmtMoney(back)} back` : ''}</button></div></div>${open(r.to.kind, r.to.id, '›')}</div>`;
  }
  if (n < MAX_RUSH) h += `<small class="why">The more rushes run at once, the dearer the next: rush ${n + 1} costs ×${RUSH_MUL[n]}</small>`;
  return h;
}

/** Stuck entries with the same cause folded into one row: what is wrong, which places (each tappable), and the fix. */
function stuckRows(list: Stuck[], max: number): string {
  const groups: Stuck[][] = [], by = new Map<string, Stuck[]>();
  for (const s of list) { if (!s.cause) { groups.push([s]); continue; } const k = s.icon + s.cause; let gr = by.get(k); if (!gr) { gr = []; by.set(k, gr); groups.push(gr); } gr.push(s); }
  let h = '';
  for (const gr of groups.slice(0, max)) {
    const s = gr[0]!;
    if (gr.length === 1) { h += `<div class="row"><b class="ico">${s.icon}</b><div class="grow"><small>${s.text}</small></div>${s.btn}</div>`; continue; }
    const names = gr.map(x => `<button class="mini" data-act="open" data-kind="bld" data-id="${x.bld}">📍 ${esc(x.name ?? 'Open')}</button>`).join('');
    h += `<div class="row"><b class="ico">${s.icon}</b><div class="grow"><small>${gr.length} buildings ${s.many}</small><div class="chips">${names}</div></div>${s.fix ?? ''}</div>`;
  }
  if (groups.length > max) h += `<small class="why">and ${groups.length - max} more</small>`;
  return h;
}
