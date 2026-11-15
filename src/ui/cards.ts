import type { Game, Site } from '../state.ts';
import { bufOf, type Building, capOf, GOODS, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, isLinked, lockedText, outputOf, shareAt } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { orderDone, orderOf, reward, sizeName, steadyGoods, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { type Dest, destName, type Ship, shipPlan, siteOf } from '../economy/shipping.ts';
import { trainStatus } from '../economy/dispatch.ts';
import type { Train } from '../trains/train.ts';
import { fmtMoney } from './hud.ts';

export type Card = { kind: 'town'; id: number } | { kind: 'bld'; id: number } | { kind: 'train'; id: number };

/** the kind that makes each good */
const makerOf = (k: Good) => (Object.keys(INDUSTRIES) as IndustryKind[]).find(m => INDUSTRIES[m].makes === k);
const sameDest = (a: Dest | undefined, b: Dest) => !!a && a.kind === b.kind && a.id === b.id;

/** Where a good for this place comes from, or what the player can do to get it. */
function sourceText(g: Game, plan: Map<number, Ship>, to: Dest, k: Good): string {
  const from = (g.s.buildings ?? []).filter(b => sameDest(plan.get(b.id)?.to, to) && INDUSTRIES[b.kind].makes === k);
  if (from.length) return `🚂 from ${from.length > 1 ? `${from.length} buildings` : 'the ' + bName(from[0]!)}`;
  const coming = g.s.trains.filter(t => t.job && sameDest(t.job.to, to) && t.job.good === k).length;
  if (coming) return `🚂 ${coming} train${coming > 1 ? 's' : ''} bringing it now`;
  const m = makerOf(k); if (!m) return '❔ Nobody can make this yet';
  const any = (g.s.buildings ?? []).filter(b => b.kind === m), name = INDUSTRIES[m].name;
  if (any.some(b => isLinked(g, b))) return `🔀 Your ${name} ships to a place that needs it more`;
  if (any.length) return `🔌 Join your ${name} to the railway`;
  const lock = lockedText(g, m);
  return lock ? `🏭 Made by a ${name} · ${lock}` : `🏗 Build a ${name}`;
}

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
    const src = got >= need ? '✅ Done' : sourceText(g, plan, { kind: 'town', id: t.id }, k);
    h += `<div class="row"><b class="ico">${G.icon}</b><div class="grow"><div class="line"><span>${G.name}</span><span>${got} / ${need}</span></div>${bar(got / need, got >= need ? '#5cc46a' : '#e8a33c')}<small>${src}</small></div></div>`;
  }
  if (done) {
    const p = upgradePrice(L), can = p <= g.s.money;
    h += `<button class="act" data-act="upgrade" data-id="${t.id}" ${can ? '' : 'disabled'}>⬆ Grow into a ${sizeName(L + 1)} · ${fmtMoney(p)}</button>`;
    if (!can) h += `<small class="why">Need ${fmtMoney(p - g.s.money)} more: deliveries keep paying</small>`;
  } else h += `<div class="gift">🎁 ${fmtMoney(reward(L))} when the order is filled</div>`;
  const st = steadyGoods(t);
  if (st.length) h += `<h3>🛒 Keeps buying</h3><div class="chips">${st.map(k => `<span class="chip2">${GOODS[k].icon} ${GOODS[k].name}</span>`).join('')}</div>`;
  const coming = g.s.trains.filter(x => x.job && sameDest(x.job.to, { kind: 'town', id: t.id })).length;
  if (coming) h += `<div class="note">🚂 ${coming} train${coming > 1 ? 's' : ''} bringing goods here</div>`;
  return h;
}

function buildingCard(g: Game, b: Building): string {
  const d = INDUSTRIES[b.kind], k = d.makes, G = GOODS[k], cap = capOf(b), linked = isLinked(g, b), fac = isFactory(b.kind);
  const plan = shipPlan(g);
  let h = `<div class="head"><b class="big">${d.icon}</b><div><h2>${d.name}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">${G.icon} ${Math.round(outputOf(g, b) * 60)}/min</span></div></div>`;
  if (!linked) h += `<div class="warn">🔌 Not on the railway yet: lay track from your line to one end of its yard</div>`;
  if (fac) {
    const st = factoryState(g, b);
    if (linked) h += st.busy ? `<div class="gift">🟢 Working: making ${G.icon} ${G.name}</div>` : b.stock >= cap ? `<div class="warn">📦 Full: waiting for a train to collect</div>` : `<div class="warn">🟠 Waiting for ${st.waits.map(w => GOODS[w].icon + ' ' + GOODS[w].name).join(' and ')}</div>`;
    h += `<h3>① Brings in</h3>`;
    for (const w of inputsOf(b.kind)) {
      const have = Math.floor(b.inbuf?.[w] ?? 0), max = bufOf(b);
      h += `<div class="row"><b class="ico">${GOODS[w].icon}</b><div class="grow"><div class="line"><span>${GOODS[w].name}</span><span>${have} / ${max}</span></div>${bar(have / max, have > 0 ? '#5cc46a' : '#e8a33c')}<small>${sourceText(g, plan, { kind: 'bld', id: b.id }, w)}</small></div></div>`;
    }
    h += `<h3>② Sends out</h3>`;
  } else {
    const share = shareAt(g, b);
    if (share < 1) h += `<div class="warn">${b.kind === 'wood' ? '🌲 Few trees' : '🌱 Few fields'} left around it (${Math.round(share * 100)}% output): track and buildings next to it cover them</div>`;
  }
  h += `<div class="row"><b class="ico">📦</b><div class="grow"><div class="line"><span>${G.name} ready</span><span>${Math.floor(b.stock)} / ${cap}</span></div>${bar(b.stock / cap, b.stock >= cap ? '#e0584a' : '#5cc46a')}${b.stock >= cap ? '<small>Full: it stops making more until a train collects</small>' : ''}</div></div>`;
  const ship = plan.get(b.id);
  const why = (w: Ship['why']) => w === 'order' ? '📋 For its order (full pay)' : w === 'factory' ? '🏭 To make into a product (half pay)' : w === 'steady' ? '🛒 It keeps buying this (part pay)' : '💸 No town needs it now: sold cheap';
  if (ship) h += `<div class="row"><b class="ico">➡</b><div class="grow"><div class="line"><span>Sends to <b>${esc(destName(g, ship.to))}</b></span><span>${ship.d} squares</span></div><small>${why(ship.why)}</small></div></div>`;
  else if (linked) h += `<div class="warn">🏘 No town on the railway yet to take it</div>`;
  const tr = g.s.trains.filter(t => t.job?.src === b.id || (t.job && sameDest(t.job.to, { kind: 'bld', id: b.id })));
  h += `<div class="note">🚂 ${tr.length ? `${tr.length} train${tr.length > 1 ? 's' : ''} on this` : g.s.trains.length ? 'Trains collect when 15 are ready' : 'Buy a train at the engine shed (🚂 Train)'}</div>`;
  return h;
}

function trainCard(g: Game, t: Train): string {
  let h = `<div class="head"><b class="big">🚂</b><div><h2>Train ${t.id}</h2><span class="chip2">Carries 20</span></div></div>`;
  h += `<div class="note big2">${trainStatus(g, t)}</div>`;
  if (t.lastPay) { h += `<div class="row"><b class="ico">💰</b><div class="grow">Last delivery: ${t.lastPay.n} ${GOODS[t.lastPay.good as Good]?.icon ?? ''} to ${esc(destName(g, t.lastPay.to))} paid <b>${fmtMoney(t.lastPay.pay)}</b></div></div>`; }
  h += `<small class="why">Trains run themselves: each one takes the best waiting load to the place that needs it.</small>`;
  return h;
}
