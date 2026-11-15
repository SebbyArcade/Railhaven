import type { Game, Site } from '../state.ts';
import { bufOf, type Building, capOf, GOODS, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, isLinked, lockedText, outputOf, shareAt } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { FOUND_PRICE, orderDone, orderOf, reward, sizeName, steadyGoods, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { type Dest, destName, type Ship, shipPlan, siteOf } from '../economy/shipping.ts';
import { FERRY_FEE, trainPrice, trainStatus } from '../economy/dispatch.ts';
import { dockRange, islandOfB, seaDist } from '../ships/docks.ts';
import { FLEET, type FleetKey, fleetLvl, levelGain, levelPrice, MAX_LVL, MAX_RUSH, refundOf, RUSH_FEE, rushOf, sellOffer, trainCap } from '../economy/upgrades.ts';
import type { Train } from '../trains/train.ts';
import { fmtMoney } from './hud.ts';

export type Card = { kind: 'shed'; id: 0 } | { kind: 'plot'; id: number } | { kind: 'town'; id: number } | { kind: 'bld'; id: number } | { kind: 'train'; id: number };

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
  if (c.kind === 'shed') return shedCard(g);
  if (c.kind === 'plot') { const p = siteOf(g, c.id); return p?.kind === 'plot' ? plotCard(g, p) : null; }
  if (c.kind === 'town') { const t = siteOf(g, c.id); return t?.kind === 'town' ? townCard(g, t) : null; }
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
    const rb = got < need && linked ? rushBtn(g, { kind: 'town', id: t.id }, k) : '';
    h += `<div class="row"><b class="ico">${G.icon}</b><div class="grow"><div class="line"><span>${G.name}</span><span>${got} / ${need}</span></div>${bar(got / need, got >= need ? '#5cc46a' : '#e8a33c')}<small>${src}</small>${rb}</div></div>`;
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

function plotCard(g: Game, p: Site): string {
  const can = g.s.money >= FOUND_PRICE;
  let h = `<div class="head"><b class="big">🚩</b><div><h2>${esc(p.name ?? 'Settlement site')}</h2><span class="chip2">Settlement site</span></div></div>`;
  h += `<div class="note">🏘 Open land waiting for settlers. Found a town here, then lay track onto it: it starts as a Hamlet with its own order.</div>`;
  h += `<button class="act" data-act="found" data-id="${p.id}" ${can ? '' : 'disabled'}>🏘 Found ${esc(p.name ?? 'a town')} · ${fmtMoney(FOUND_PRICE)}</button>`;
  if (!can) h += `<small>Need ${fmtMoney(FOUND_PRICE - Math.floor(g.s.money))} more: deliveries pay for it</small>`;
  return h;
}

function dockCard(g: Game, b: Building): string {
  const linked = isLinked(g, b), home = islandOfB(g, b) === g.world.home, isl = g.world.islands[islandOfB(g, b)]?.name ?? 'this island';
  let h = `<div class="head"><b class="big">⚓</b><div><h2>${home ? 'Dock' : `Landing · ${esc(isl)}`}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">🌊 reaches ${dockRange(b)} squares</span></div></div>`;
  if (!linked) h += home ? `<div class="warn">🔌 Not on the railway yet: lay track from your line to one end of its yard</div>` : `<div class="warn">🌊 No dock of yours reaches this landing</div>`;
  else h += `<div class="gift">🌊 Charts the sea ${dockRange(b)} squares out: shores in reach come out of the fog</div>`;
  // islands this dock reaches, nearest first
  const d = seaDist(g, b), n = g.world.n, near = new Map<number, number>();
  for (let i = 0; i < n * n; i++) {
    const v = d[i]!; if (v < 0 || v > dockRange(b)) continue;
    for (const j of [i + 1, i - 1, i + n, i - n]) { const k = g.world.islandOf[j]; if (k === undefined || k < 0 || !g.world.islands[k]!.name || k === islandOfB(g, b)) continue; if (!near.has(k) || near.get(k)! > v) near.set(k, v); }
  }
  const list = [...near].sort((p, q) => p[1] - q[1]).slice(0, 5);
  if (list.length) {
    h += `<h3>🏝 Islands in reach</h3>`;
    for (const [k, v] of list) {
      const has = (g.s.buildings ?? []).some(o => o.kind === 'dock' && islandOfB(g, o) === k);
      h += `<div class="row"><b class="ico">🏝</b><div class="grow"><div class="line"><span>${esc(g.world.islands[k]!.name!)}</span><span>${v} squares</span></div><small>${has ? '⚓ You have a landing there' : '🏗 Build → Dock on its shore to land there'}</small></div></div>`;
    }
  } else if (linked) h += `<div class="note">🌊 No other island within reach yet: a bigger dock sails farther</div>`;
  if (!home) {
    const p = trainPrice(g) + FERRY_FEE, can = linked && g.s.money >= p;
    h += `<div class="note">🚂 ${g.s.trains.filter(t => islandOfTrain(g, t) === islandOfB(g, b)).length} trains on ${esc(isl)}. Trains stay on their island.</div>`;
    h += `<button class="act" data-act="trainat" data-id="${b.id}" ${can ? '' : 'disabled'}>🚂 Ship a train over · ${fmtMoney(p)}</button>`;
  }
  if (b.lvl < MAX_LVL) {
    const p = levelPrice(b), can = g.s.money >= p;
    h += `<button class="act" data-act="lvl" data-id="${b.id}" ${can ? '' : 'disabled'}>⬆ Level ${b.lvl + 1}: ${levelGain(b)} · ${fmtMoney(p)}</button>`;
  }
  h += `<button class="act warnb" data-act="remove" data-id="${b.id}">🗑 Remove · get ${fmtMoney(refundOf(b))}</button>`;
  return h;
}

/** The island a train is on (from the square under its engine). */
const islandOfTrain = (g: Game, t: Train) => g.world.islandOf[g.net.pieces[t.trail.at(-1)!.piece]!.squares.at(-1)!];

function buildingCard(g: Game, b: Building): string {
  if (b.kind === 'dock') return dockCard(g, b);
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
      h += `<div class="row"><b class="ico">${GOODS[w].icon}</b><div class="grow"><div class="line"><span>${GOODS[w].name}</span><span>${have} / ${max}</span></div>${bar(have / max, have > 0 ? '#5cc46a' : '#e8a33c')}<small>${sourceText(g, plan, { kind: 'bld', id: b.id }, w)}</small>${linked ? rushBtn(g, { kind: 'bld', id: b.id }, w) : ''}</div></div>`;
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
  h += `<div class="note">🚂 ${tr.length ? `${tr.length} train${tr.length > 1 ? 's' : ''} on this` : g.s.trains.length ? `Trains collect when ${Math.round(trainCap(g) * 0.75)} are ready` : 'Buy a train at the engine shed (🚂 Train)'}</div>`;
  // grow it, sell what's piled up, or take it down
  if (b.lvl < MAX_LVL) {
    const p = levelPrice(b), can = g.s.money >= p;
    h += `<button class="act" data-act="lvl" data-id="${b.id}" ${can ? '' : 'disabled'}>⬆ Level ${b.lvl + 1}: ${levelGain(b)} · ${fmtMoney(p)}</button>`;
    if (!can) h += `<small class="why">Need ${fmtMoney(p - Math.floor(g.s.money))} more</small>`;
  } else h += `<div class="gift">⭐ Full size (level ${MAX_LVL}): build a second one to make more</div>`;
  const so = sellOffer(b);
  h += `<div class="pair"><button class="act alt" data-act="sell" data-id="${b.id}" ${so.n > 0 ? '' : 'disabled'}>💸 Sell ${so.n} ${G.icon} · ${fmtMoney(so.pay)}</button>`;
  h += `<button class="act warnb" data-act="remove" data-id="${b.id}">🗑 Remove · get ${fmtMoney(refundOf(b))}</button></div>`;
  h += `<small class="why">Selling takes 3/4 of its stock at 60% of the price; deliveries pay more. Removing gives back half of what you paid${b.dep ? ' and frees the deposit' : ''}; its yard track stays.</small>`;
  return h;
}

/** A small button on an order or input row: rush it (its makers send here first, 30% fee), or stop rushing. */
function rushBtn(g: Game, to: Dest, k: Good): string {
  const on = !!rushOf(g, to, k), full = (g.s.rush ?? []).length >= MAX_RUSH;
  if (!on && full) return '';
  return `<button class="mini${on ? ' on' : ''}" data-act="rush" data-kind="${to.kind}" data-id="${to.id}" data-good="${k}">${on ? '⭐ Rushing · stop' : `⭐ Rush (−${Math.round(RUSH_FEE * 100)}% pay)`}</button>`;
}

function shedCard(g: Game): string {
  let h = `<div class="head"><b class="big">🏚</b><div><h2>Engine shed</h2><span class="chip2">🚂 ${g.s.trains.length} train${g.s.trains.length === 1 ? '' : 's'}</span> <span class="chip2">📦 ${trainCap(g)} per load</span></div></div>`;
  h += `<h3>🔧 Fleet upgrades (every train)</h3>`;
  for (const k of Object.keys(FLEET) as FleetKey[]) {
    const f = FLEET[k], l = fleetLvl(g, k), p = f.price[l], top = p === undefined;
    h += `<div class="row"><b class="ico">${f.icon}</b><div class="grow"><div class="line"><span>${f.name}</span><span>${top ? 'Top level' : `Level ${l} → ${l + 1}`}</span></div>${bar(l / f.price.length, '#5cc46a')}<small>Now: ${f.text(l)}${top ? '' : ` · next: ${f.text(l + 1)}`}</small>`;
    if (!top) h += `<button class="mini" data-act="fleet" data-k="${k}" ${g.s.money >= p ? '' : 'disabled'}>⬆ ${fmtMoney(p)}</button>`;
    h += `</div></div>`;
  }
  h += `<small class="why">Buy trains with 🚂 Train. Upgrades apply to the whole fleet at once.</small>`;
  return h;
}

function trainCard(g: Game, t: Train): string {
  let h = `<div class="head"><b class="big">🚂</b><div><h2>Train ${t.id}</h2><span class="chip2">Carries ${trainCap(g)}</span></div></div>`;
  h += `<div class="note big2">${trainStatus(g, t)}</div>`;
  if (t.lastPay) { h += `<div class="row"><b class="ico">💰</b><div class="grow">Last delivery: ${t.lastPay.n} ${GOODS[t.lastPay.good as Good]?.icon ?? ''} to ${esc(destName(g, t.lastPay.to))} paid <b>${fmtMoney(t.lastPay.pay)}</b></div></div>`; }
  h += `<small class="why">Trains run themselves: each one takes the best waiting load to the place that needs it.</small>`;
  return h;
}
