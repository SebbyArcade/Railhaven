import type { Game, Site } from '../state.ts';
import { type Building, capOf, GOODS, type Good, INDUSTRIES, type IndustryKind, isLinked, outputOf, shareAt } from '../buildings/industries.ts';
import { orderDone, orderOf, reward, sizeName, steadyGoods, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { shipPlan, siteOf } from '../economy/shipping.ts';
import { trainStatus } from '../economy/dispatch.ts';
import type { Train } from '../trains/train.ts';
import { fmtMoney } from './hud.ts';

export type Card = { kind: 'town'; id: number } | { kind: 'bld'; id: number } | { kind: 'train'; id: number };

/** which industry makes each raw good (factories come later) */
const MAKER: Partial<Record<Good, IndustryKind>> = { wood: 'wood', farm: 'farm', stone: 'stone', coal: 'coal', iron: 'iron', oil: 'oil', wool: 'wool' };
const FACTORY: Partial<Record<Good, string>> = { planks: 'a Sawmill', bricks: 'a Brickworks', flour: 'a Gristmill', steel: 'a Steel Mill', fuel: 'a Refinery', cloth: 'a Textile Mill' };

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const bName = (b: Building) => INDUSTRIES[b.kind].name;

/** Card HTML. Every number is read fresh, so the card is redrawn each second while open. */
export function cardHtml(g: Game, c: Card): string | null {
  if (c.kind === 'town') { const t = siteOf(g, c.id); return t ? townCard(g, t) : null; }
  if (c.kind === 'bld') { const b = g.s.buildings?.find(x => x.id === c.id); return b ? buildingCard(g, b) : null; }
  const t = g.s.trains.find(x => x.id === c.id); return t ? trainCard(g, t) : null;
}

function townCard(g: Game, t: Site): string {
  const L = stepOf(t), o = orderOf(g, t), linked = townLinked(g, t), plan = shipPlan(g);
  let h = `<div class="head"><b class="big">🏘</b><div><h2>${esc(t.name ?? 'Town')}</h2><span class="chip2">${sizeName(L)}</span> <span class="chip2">👥 ${Math.floor(t.pop ?? 0)}</span></div></div>`;
  if (!linked) h += `<div class="warn">🔌 Not on the railway yet: lay track from your line into its station</div>`;
  const done = orderDone(g, t);
  h += `<h3>📋 ${done ? 'Order filled!' : `Wants these to grow into a ${sizeName(L + 1)}`}</h3>`;
  for (const k of Object.keys(o) as Good[]) {
    const need = o[k]!, got = Math.min(need, Math.floor(t.got?.[k] ?? 0)), G = GOODS[k];
    const from = (g.s.buildings ?? []).filter(b => plan.get(b.id)?.to.id === t.id && INDUSTRIES[b.kind].makes === k);
    let src: string;
    if (got >= need) src = '✅ Done';
    else if (from.length) src = `🚂 from ${from.length > 1 ? `${from.length} buildings` : 'the ' + bName(from[0]!)}`;
    else if (MAKER[k]) {
      const any = (g.s.buildings ?? []).filter(b => b.kind === MAKER[k]);
      src = any.length ? (any.some(b => isLinked(g, b)) ? '🔀 Its maker ships to a town that needs it more' : `🔌 Join your ${INDUSTRIES[MAKER[k]!].name} to the railway`) : `🏗 Build a ${INDUSTRIES[MAKER[k]!].name}`;
    } else src = `🏭 Made by ${FACTORY[k] ?? 'a factory'} (coming soon)`;
    h += `<div class="row"><b class="ico">${G.icon}</b><div class="grow"><div class="line"><span>${G.name}</span><span>${got} / ${need}</span></div>${bar(got / need, got >= need ? '#5cc46a' : '#e8a33c')}<small>${src}</small></div></div>`;
  }
  if (done) {
    const p = upgradePrice(L), can = p <= g.s.money;
    h += `<button class="act" data-act="upgrade" data-id="${t.id}" ${can ? '' : 'disabled'}>⬆ Grow into a ${sizeName(L + 1)} · ${fmtMoney(p)}</button>`;
    if (!can) h += `<small class="why">Need ${fmtMoney(p - g.s.money)} more: deliveries keep paying</small>`;
  } else h += `<div class="gift">🎁 ${fmtMoney(reward(L))} when the order is filled</div>`;
  const st = steadyGoods(t);
  if (st.length) h += `<h3>🛒 Keeps buying</h3><div class="chips">${st.map(k => `<span class="chip2">${GOODS[k].icon} ${GOODS[k].name}</span>`).join('')}</div>`;
  const coming = g.s.trains.filter(x => x.job?.to.id === t.id).length;
  if (coming) h += `<div class="note">🚂 ${coming} train${coming > 1 ? 's' : ''} bringing goods here</div>`;
  return h;
}

function buildingCard(g: Game, b: Building): string {
  const d = INDUSTRIES[b.kind], k = d.makes, G = GOODS[k], cap = capOf(b), linked = isLinked(g, b);
  let h = `<div class="head"><b class="big">${d.icon}</b><div><h2>${d.name}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">${G.icon} ${Math.round(outputOf(g, b) * 60)}/min</span></div></div>`;
  if (!linked) h += `<div class="warn">🔌 Not on the railway yet: lay track from your line to one end of its yard</div>`;
  const share = shareAt(g, b);
  if (share < 1) h += `<div class="warn">${b.kind === 'wood' ? '🌲 Few trees' : '🌱 Few fields'} left around it (${Math.round(share * 100)}% output): track and buildings next to it cover them</div>`;
  h += `<div class="row"><b class="ico">📦</b><div class="grow"><div class="line"><span>${G.name} ready</span><span>${Math.floor(b.stock)} / ${cap}</span></div>${bar(b.stock / cap, b.stock >= cap ? '#e0584a' : '#5cc46a')}${b.stock >= cap ? '<small>Full: it stops making more until a train collects</small>' : ''}</div></div>`;
  const ship = shipPlan(g).get(b.id), to = ship && siteOf(g, ship.to.id);
  if (to) h += `<div class="row"><b class="ico">➡</b><div class="grow"><div class="line"><span>Sends to <b>${esc(to.name ?? '')}</b></span><span>${ship!.d} squares</span></div><small>${ship!.why === 'order' ? '📋 For its order (full pay)' : ship!.why === 'steady' ? '🛒 It keeps buying this (part pay)' : '💸 No town needs it now: sold cheap'}</small></div></div>`;
  else if (linked) h += `<div class="warn">🏘 No town on the railway yet to take it</div>`;
  const tr = g.s.trains.filter(t => t.job?.src === b.id);
  h += `<div class="note">🚂 ${tr.length ? `${tr.length} train${tr.length > 1 ? 's' : ''} on this` : g.s.trains.length ? 'Trains collect when 15 are ready' : 'Buy a train at the engine shed (🚂 Train)'}</div>`;
  return h;
}

function trainCard(g: Game, t: Train): string {
  let h = `<div class="head"><b class="big">🚂</b><div><h2>Train ${t.id}</h2><span class="chip2">Carries 20</span></div></div>`;
  h += `<div class="note big2">${trainStatus(g, t)}</div>`;
  if (t.lastPay) { const town = siteOf(g, t.lastPay.town); h += `<div class="row"><b class="ico">💰</b><div class="grow">Last delivery: ${t.lastPay.n} ${GOODS[t.lastPay.good as Good]?.icon ?? ''} to ${esc(town?.name ?? '')} paid <b>${fmtMoney(t.lastPay.pay)}</b></div></div>`; }
  h += `<small class="why">Trains run themselves: each one takes the best waiting load to the place that needs it.</small>`;
  return h;
}
