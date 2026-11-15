import type { Game, Site } from '../state.ts';
import type { Building } from '../buildings/industries.ts';
import { maxLvlOf } from '../economy/upgrades.ts';
import { reachedIslands } from '../progress/missions.ts';
import { capOf, GOODS, type Good, INDUSTRIES, isFactory, isLinked } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { orderDone, orderOf, orderProgress, sizeName, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { bldDist, destSquares, shipPlan } from '../economy/shipping.ts';
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
export interface Stuck { icon: string; text: string; btn: string; x: number; y: number; /** the building it is about */ bld?: number }
export function stuckList(g: Game, plan = shipPlan(g)): Stuck[] {
  const out: Stuck[] = [];
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t) && orderDone(g, t)) out.push({ icon: '⬆', text: `${esc(t.name ?? 'A town')} can grow into a ${sizeName(stepOf(t) + 1)} (${fmtMoney(upgradePrice(stepOf(t)))})`, btn: open('town', t.id, 'Open ›'), x: t.x, y: t.y });
  for (const b of g.s.buildings ?? []) {
    if (b.closed) continue; // ⛔ closed on purpose: not a problem
    const name = placeName(g, b);
    if (!isLinked(g, b)) { out.push({ icon: '🔌', text: `The ${name} isn't on the railway: lay track to one end of its yard`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id }); continue; }
    if (isFactory(b.kind)) { const w = factoryState(g, b).waits; if (w.length) out.push({ icon: '⏳', text: `The ${name} waits for ${w.map(k => `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`).join(' and ')}`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id }); }
    const k = INDUSTRIES[b.kind].makes as Good;
    if (b.kind !== 'dock' && b.stock >= capOf(b) && !plan.get(b.id)) out.push({ icon: '📦', text: `The ${name} is full: no place on the railway needs ${GOODS[k].icon} ${GOODS[k].name.toLowerCase()} now`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id });
  }
  for (const x of bottlenecks(g, plan)) {
    if (!x.near.length) { // none of the makers is on those towns' railway
      const t = x.towns[0]!, kind = INDUSTRIES[x.makers[0]!.kind].name;
      out.push({ icon: '🐢', text: `${x.towns.length} towns wait for ${GOODS[x.good].icon} ${GOODS[x.good].name.toLowerCase()}, but no ${kind} can reach them: build one on their island, or a dock on each side`, btn: open('town', t.id), x: t.x, y: t.y });
      continue;
    }
    x.makers = x.near;
    const b = x.makers.find(m => isFactory(m.kind) && factoryState(g, m).waits.length) ?? [...x.makers].sort((p, q) => p.lvl - q.lvl)[0]!;
    const name = placeName(g, b), w = isFactory(b.kind) ? factoryState(g, b).waits : [];
    const fix = b.closed ? `the ${name} is closed: open it again` : w.length ? `the ${name} is short of ${w.map(k => `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`).join(' and ')}: bring more in`
      : b.lvl < maxLvlOf(g, b) ? `the ${name} can't keep up: upgrade it or build another` : `the ${name} can't keep up: build another`;
    out.push({ icon: '🐢', text: `${x.towns.length} towns wait for ${GOODS[x.good].icon} ${GOODS[x.good].name.toLowerCase()}: ${fix}`, btn: open('bld', b.id), x: b.x, y: b.y, ...(b.closed ? {} : { bld: b.id }) });
  }
  const idle = g.s.trains.filter(t => !t.job);
  if (idle.length) { const p = bodyPoint(g.net, idle[0]!, 0); out.push({ icon: '💤', text: `${idle.length} train${idle.length > 1 ? 's wait' : ' waits'} for a load`, btn: open('train', idle[0]!.id), x: p.x / TILE - 0.5, y: p.y / TILE - 0.5 }); }
  const rank = ['⬆', '🐢', '🔌', '📦', '💤', '⏳']; // the most useful first: a starved factory usually shows up in a 🐢 line too
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
  let h = `<div class="head"><b class="big">📋</b><div><h2>Orders</h2><span class="chip2">⭐ Railway level ${L}</span> <span class="chip2">${o} orders filled</span></div></div>`;
  if (next !== undefined) {
    h += `<div class="row"><b class="ico">⭐</b><div class="grow"><div class="line"><span>Level ${L + 1}</span><span>${o} / ${next}</span></div>${bar((o - prev) / (next - prev), '#ffd27a')}`
      + `<small>${UNLOCKS[L + 1] ? `Unlocks ${UNLOCKS[L + 1]}` : 'Every order filled counts'}</small></div></div>`;
    const bl = levelNow(g).blocked;
    if (bl) h += `<div class="warn">⛵ Level ${bl.level} also needs ${bl.need} islands reached: you have ${bl.have}. Build a ⚓ Dock and land on another island</div>`;
    else if (LEVEL_ISLANDS[L + 1]) h += `<small class="why">⛵ Level ${L + 1} also needs ${LEVEL_ISLANDS[L + 1]} islands reached (Ashford Isle counts as one)</small>`;
  } else h += `<div class="gift">⭐ Top Railway level: every order still pays</div>`;
  const stuck = stuckList(g);
  if (stuck.length) {
    h += `<h3>⚠ Needs you</h3>`;
    for (const s of stuck.slice(0, 6)) h += `<div class="row"><b class="ico">${s.icon}</b><div class="grow"><small>${s.text}</small></div>${s.btn}</div>`;
    if (stuck.length > 6) h += `<small class="why">and ${stuck.length - 6} more</small>`;
  }
  const towns = g.s.sites.filter((t): t is Site => t.kind === 'town' && townLinked(g, t)).sort((a, b) => orderProgress(g, b) - orderProgress(g, a));
  h += `<h3>🏘 Towns on your railway</h3>`;
  for (const t of towns) {
    const ord = orderOf(g, t), p = orderProgress(g, t);
    const goods = (Object.keys(ord) as Good[]).map(k => { const need = ord[k]!, got = Math.min(need, Math.floor(t.got?.[k] ?? 0)); return `<span class="chip2${got >= need ? ' ok' : ''}">${GOODS[k].icon} ${got}/${need}</span>`; }).join(' ');
    h += `<div class="row"><b class="ico">${p >= 1 ? '⬆' : '🏘'}</b><div class="grow"><div class="line"><span>${esc(t.name ?? 'Town')} · ${sizeName(stepOf(t))}</span><span>${Math.round(p * 100)}%</span></div>${bar(p, p >= 1 ? '#5cc46a' : '#e8a33c')}<div class="chips">${goods}</div></div>${open('town', t.id, '›')}</div>`;
  }
  const off = g.s.sites.filter(t => t.kind === 'town' && (t.pop ?? 0) > 0 && !townLinked(g, t)).length;
  if (off) h += `<div class="note">🔌 ${off} more town${off > 1 ? 's' : ''} you've found ${off > 1 ? 'are' : 'is'} not on the railway yet</div>`;
  return h;
}
