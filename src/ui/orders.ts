import type { Game, Site } from '../state.ts';
import { capOf, GOODS, type Good, INDUSTRIES, isFactory, isLinked } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { orderDone, orderOf, orderProgress, sizeName, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { shipPlan } from '../economy/shipping.ts';
import { RLV, UNLOCKS } from '../economy/dispatch.ts';
import { fmtMoney } from './hud.ts';
import { bodyPoint } from '../trains/train.ts';
import { TILE } from '../world/terrain.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const open = (kind: 'town' | 'bld' | 'train', id: number, label = '📍') => `<button class="mini" data-act="open" data-kind="${kind}" data-id="${id}">${label}</button>`;

/** What needs the player: towns ready to grow, buildings off the railway, factories short of goods, full buildings, idle trains. */
export interface Stuck { icon: string; text: string; btn: string; x: number; y: number; /** the building it is about */ bld?: number }
export function stuckList(g: Game, plan = shipPlan(g)): Stuck[] {
  const out: Stuck[] = [];
  for (const t of g.s.sites) if (t.kind === 'town' && townLinked(g, t) && orderDone(g, t)) out.push({ icon: '⬆', text: `${esc(t.name ?? 'A town')} can grow into a ${sizeName(stepOf(t) + 1)} (${fmtMoney(upgradePrice(stepOf(t)))})`, btn: open('town', t.id, 'Open ›'), x: t.x, y: t.y });
  for (const b of g.s.buildings ?? []) {
    const name = INDUSTRIES[b.kind].name;
    if (!isLinked(g, b)) { out.push({ icon: '🔌', text: `The ${name} isn't on the railway: lay track to one end of its yard`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id }); continue; }
    if (isFactory(b.kind)) { const w = factoryState(g, b).waits; if (w.length) out.push({ icon: '⏳', text: `The ${name} waits for ${w.map(k => `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`).join(' and ')}`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id }); }
    const k = INDUSTRIES[b.kind].makes as Good;
    if (b.kind !== 'dock' && b.stock >= capOf(b) && !plan.get(b.id)) out.push({ icon: '📦', text: `The ${name} is full: no place on the railway needs ${GOODS[k].icon} ${GOODS[k].name.toLowerCase()} now`, btn: open('bld', b.id), x: b.x, y: b.y, bld: b.id });
  }
  const idle = g.s.trains.filter(t => !t.job);
  if (idle.length) { const p = bodyPoint(g.net, idle[0]!, 0); out.push({ icon: '💤', text: `${idle.length} train${idle.length > 1 ? 's wait' : ' waits'} for a load`, btn: open('train', idle[0]!.id), x: p.x / TILE - 0.5, y: p.y / TILE - 0.5 }); }
  return out;
}

/** The 📋 Orders board: Railway level, what needs you, then every town's order on the railway, nearest to done first. */
export function ordersHtml(g: Game): string {
  const L = g.s.rlv ?? 0, o = g.s.orders ?? 0, next = RLV[L + 1], prev = RLV[L] ?? 0;
  let h = `<div class="head"><b class="big">📋</b><div><h2>Orders</h2><span class="chip2">⭐ Railway level ${L}</span> <span class="chip2">${o} orders filled</span></div></div>`;
  if (next !== undefined) {
    h += `<div class="row"><b class="ico">⭐</b><div class="grow"><div class="line"><span>Level ${L + 1}</span><span>${o} / ${next}</span></div>${bar((o - prev) / (next - prev), '#ffd27a')}`
      + `<small>${UNLOCKS[L + 1] ? `Unlocks ${UNLOCKS[L + 1]}` : 'Every order filled counts'}</small></div></div>`;
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
