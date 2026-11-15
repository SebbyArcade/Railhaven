import type { Game, Site } from '../state.ts';
import { fallsMul } from '../world/explore.ts';
import { buildingSquares, bufOf, type Building, capOf, GOODS, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, isLinked, lockedText, outputOf, shareAt, forestOf, stumpsOf } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { FOUND_PRICE, orderDone, orderOf, reward, sizeName, steadyGoods, stepOf, townLinked, upgradePrice } from '../economy/towns.ts';
import { type Dest, destinationsOf, destName, type Ship, shipPlan, siteOf } from '../economy/shipping.ts';
import { FERRY_FEE, trainPrice, trainStatus } from '../economy/dispatch.ts';
import { dockRange, islandName, islandOfB, seaDist } from '../ships/docks.ts';
import { lanesFrom, SHIP_CAP, SHIP_HOLD, SHIP_PRICE, SHIP_SPEED, waitingAt } from '../ships/ships.ts';
import { catchOf, FISHING } from '../economy/upgrades.ts';
import { islandSpec, SPEC_TEXT, specMul } from '../world/specialty.ts';
import { FLEET, type FleetKey, fleetLvl, levelGain, levelPrice, MAX_LVL, MAX_RUSH, refundOf, RUSH_FEE, rushOf, sellOffer, trainCap } from '../economy/upgrades.ts';
import type { Train } from '../trains/train.ts';
import { fmtMoney } from './hud.ts';
import { storyHtml } from './story.ts';
import { ordersHtml, placeName } from './orders.ts';
import { mapHtml, type MapView } from './mapviews.ts';
import { mapCost, MAP_R, MAP_R_SEA } from '../world/maps.ts';

export type Card = { kind: 'shed'; id: 0 } | { kind: 'plot'; id: number } | { kind: 'town'; id: number } | { kind: 'bld'; id: number; page?: string } | { kind: 'train'; id: number } | { kind: 'story'; id: 0; page?: string } | { kind: 'game'; id: number; page?: string } | { kind: 'orders'; id: 0 } | { kind: 'map'; id: 0 } | { kind: 'ship'; id: number };

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
export function cardHtml(g: Game, c: Card, view?: MapView | null): string | null {
  if (c.kind === 'shed') return shedCard(g);
  if (c.kind === 'story') return storyHtml(g, c.page);
  if (c.kind === 'orders') return ordersHtml(g);
  if (c.kind === 'map') return mapHtml(g, view ?? null);
  if (c.kind === 'ship') return shipCard(g, c.id);
  if (c.kind === 'plot') { const p = siteOf(g, c.id); return p?.kind === 'plot' ? plotCard(g, p) : null; }
  if (c.kind === 'town') { const t = siteOf(g, c.id); return t?.kind === 'town' ? townCard(g, t) : null; }
  if (c.kind === 'bld') { const b = g.s.buildings?.find(x => x.id === c.id); return b ? buildingCard(g, b, c.page) : null; }
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
  } else { const fm = fallsMul(g, t.x, t.y); h += `<div class="gift">🎁 ${fmtMoney(Math.round(reward(L) * fm))} when the order is filled${fm > 1 ? ' (💧 Silver Falls +10%)' : ''}</div>`; }
  const st = steadyGoods(t, g);
  if (st.length) h += `<h3>🛒 Keeps buying</h3><div class="chips">${st.map(k => `<span class="chip2">${GOODS[k].icon} ${GOODS[k].name}</span>`).join('')}</div>`;
  const coming = g.s.trains.filter(x => x.job && sameDest(x.job.to, { kind: 'town', id: t.id })).length;
  if (coming) h += `<div class="note">🚂 ${coming} train${coming > 1 ? 's' : ''} bringing goods here</div>`;
  if (linked) h += mapBtn(g, t.x, t.y, MAP_R);
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

/** Ship card: where it is, what it is doing, and what its hold carries where. */
function shipCard(g: Game, id: number): string | null {
  const s = g.s.ships?.find(x => x.id === id); if (!s) return null;
  const dock = (i: number | undefined) => g.s.buildings?.find(b => b.id === i);
  const where = (b: Building | undefined) => { if (!b) return 'a dock'; const k = islandOfB(g, b); return k === g.world.home ? `the dock near ${esc(placeName(g, b).replace(/^Dock near /, ''))}` : `${esc(islandName(g, k))} landing`; };
  const load = s.hold.reduce((a, q) => a + q.n, 0), n = (g.s.ships ?? []).indexOf(s) + 1;
  let h = `<div class="head"><b class="big">🚢</b><div><h2>Cargo ship ${n}</h2><span class="chip2">📦 ${load} / ${SHIP_CAP}</span></div></div>`;
  if (s.to !== undefined && s.path) {
    const left = Math.max(0, Math.ceil(s.path.length - 1 - s.pos)), f = s.pos / Math.max(1, s.path.length - 1);
    h += `<div class="gift">⛴ Sailing from ${where(dock(s.at))} to ${where(dock(s.to))}</div>`;
    h += `<div class="row"><b class="ico">🌊</b><div class="grow"><div class="line"><span>On the way</span><span>${left} squares · ${Math.round(left / SHIP_SPEED)} s</span></div>${bar(f, '#6bb8e8')}</div></div>`;
  } else {
    const wait = waitingAt(dock(s.at) ?? ({} as Building)), most = Math.max(0, ...wait.values());
    const doing = s.wait > 0 ? (load ? 'Loading and unloading' : 'Unloading') : most > 0 ? `Waiting a little for a fuller load (📦 ${most} ready, it leaves at ${SHIP_CAP / 2} or after ${SHIP_HOLD} s)` : 'No goods wait on its routes: it sails where goods are waiting';
    h += `<div class="${most > 0 || s.wait > 0 ? 'gift' : 'note'}">⚓ At ${where(dock(s.at))}</div><div class="note">${doing}</div>`;
  }
  h += `<h3>📦 In the hold</h3>`;
  if (!s.hold.length) h += `<div class="note">Empty${s.to !== undefined ? ': it sails to fetch goods waiting there' : ''}</div>`;
  for (const q of s.hold) h += `<div class="row"><b class="ico">${GOODS[q.good].icon}</b><div class="grow"><div class="line"><span>${q.n} ${GOODS[q.good].name.toLowerCase()}</span><span>→ ${where(dock(q.to))}</span></div></div></div>`;
  const d = dock(s.to ?? s.at);
  if (d) h += `<button class="act alt" data-act="open" data-kind="bld" data-id="${d.id}">⚓ Open ${s.to !== undefined ? 'the dock it sails to' : 'this dock'}</button>`;
  return h + `<div class="note">Ships sail between your docks by themselves and carry goods to other islands.</div>`;
}

/** Dock card: a status line and four tiles (sea routes and ships, fishing, islands, trains or level), each opening a page with Back. */
function dockCard(g: Game, b: Building, page?: string): string {
  const linked = isLinked(g, b), home = islandOfB(g, b) === g.world.home, isl = islandName(g, islandOfB(g, b));
  let h = `<div class="head"><b class="big">⚓</b><div><h2>${home ? 'Dock' : `Landing · ${esc(isl)}`}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">🌊 reaches ${dockRange(b)} squares</span></div></div>`;
  const routes = linked ? lanesFrom(g, b.id) : [], ships = (g.s.ships ?? []).length, wait = waitingAt(b), waiting = [...wait.values()].reduce((a, v) => a + v, 0);
  const l = b.fish ?? 0, c = catchOf(l), next = FISHING[l];
  const name = (id: number) => { const o = g.s.buildings!.find(x => x.id === id)!; const k = islandOfB(g, o); return k === g.world.home ? 'Ashford Isle dock' : `${islandName(g, k)} landing`; };
  // islands this dock reaches, nearest first
  const near = () => {
    const d = seaDist(g, b), n = g.world.n, m = new Map<number, number>();
    for (let i = 0; i < n * n; i++) {
      const v = d[i]!; if (v < 0 || v > dockRange(b)) continue;
      for (const j of [i + 1, i - 1, i + n, i - n]) { const k = g.world.islandOf[j]; if (k === undefined || k < 0 || !g.world.islands[k]!.name || k === islandOfB(g, b)) continue; if (!m.has(k) || m.get(k)! > v) m.set(k, v); }
    }
    return [...m].sort((p, q) => p[1] - q[1]).slice(0, 5);
  };
  const back = `<button class="act back" data-act="page" data-page="">‹ Back</button>`;
  if (page === 'sea') {
    h += `<h3>⛴ Sea routes</h3>`;
    for (const r of routes) h += `<div class="row"><b class="ico">⛴</b><div class="grow"><div class="line"><span>${esc(name(r.id))}</span><span>${r.d} squares · ${Math.round(r.d / SHIP_SPEED)} s</span></div><small>${wait.get(r.id) ? `📦 ${wait.get(r.id)} waiting for a ship` : 'Nothing waiting'}</small></div></div>`;
    if (!routes.length) h += `<div class="note">⛴ ${home ? "Build a Dock on another island's shore within reach: that makes a sea route" : 'No sea route from here yet'}</div>`;
    if (ships) h += `<div class="note">🚢 ${ships} ship${ships === 1 ? '' : 's'} sail${ships === 1 ? 's' : ''} every route: they go where goods wait</div>` + (g.s.ships ?? []).map((x, i) => `<div class="row"><b class="ico">🚢</b><div class="grow"><small>Ship ${i + 1}: ${x.to !== undefined ? `sailing to ${esc(name(x.to))}` : `at ${esc(name(x.at))}`} · 📦 ${x.hold.reduce((a, q) => a + q.n, 0)}</small></div><button class="mini" data-act="open" data-kind="ship" data-id="${x.id}">Open ›</button></div>`).join('');
    else h += routes.length ? `<div class="warn">🚢 No cargo ship yet: goods for other islands wait here until you buy one</div>` : '';
    const landed = Object.entries(b.landed ?? {}).filter(([, v]) => (v ?? 0) >= 1);
    if (landed.length) h += `<div class="gift">📦 Ready here for this island's trains: ${landed.map(([k, v]) => `${GOODS[k as Good].icon} ${Math.floor(v!)}`).join(' · ')}</div>`;
    if (routes.length) h += `<button class="act" data-act="ship" data-id="${b.id}" ${g.s.money >= SHIP_PRICE ? '' : 'disabled'}>🚢 Buy a cargo ship · ${fmtMoney(SHIP_PRICE)}</button>`;
    return h + back;
  }
  if (page === 'fish') {
    h += `<h3>🎣 Fishing</h3>`;
    h += l ? `<div class="row"><b class="ico">🐟</b><div class="grow"><div class="line"><span>${FISHING[l - 1]!.name}</span><span>🐟 ${Math.round(c.fish * 60)}/min${c.shellfish ? ` · 🦞 ${Math.round(c.shellfish * 60)}/min` : ''}</span></div><small>${linked ? 'The catch lands here; trains take it to towns by the sea and to a Cannery' : 'Boats fish once the dock is on your railway'}</small></div></div>`
      : `<div class="note">🎣 Fishing boats catch fish off this dock. Towns by the sea buy it, and shellfish from Town size</div>`;
    if (next) h += `<button class="act" data-act="fish" data-id="${b.id}" ${g.s.money >= next.price ? '' : 'disabled'}>${next.icon} ${next.name}: ${next.text} · ${fmtMoney(next.price)}</button>`;
    return h + back;
  }
  if (page === 'isl') {
    const list = near();
    h += `<h3>🏝 Islands in reach</h3>`;
    for (const [k, v] of list) {
      const has = (g.s.buildings ?? []).some(o => o.kind === 'dock' && islandOfB(g, o) === k);
      h += `<div class="row"><b class="ico">🏝</b><div class="grow"><div class="line"><span>${esc(g.world.islands[k]!.name!)}</span><span>${v} squares</span></div><small>${has ? '⚓ You have a landing there' : '🏗 Build → Dock on its shore to land there'}</small></div></div>`;
    }
    if (!list.length) h += `<div class="note">🌊 No other island within reach yet: a bigger dock sails farther</div>`;
    if (b.lvl < MAX_LVL) { const p = levelPrice(b); h += `<button class="act" data-act="lvl" data-id="${b.id}" ${g.s.money >= p ? '' : 'disabled'}>⬆ Level ${b.lvl + 1}: ${levelGain(b)} · ${fmtMoney(p)}</button>`; }
    return h + back;
  }
  if (page === 'trains' && !home) {
    const p = trainPrice(g) + FERRY_FEE;
    h += `<div class="note">🚂 ${g.s.trains.filter(t => islandOfTrain(g, t) === islandOfB(g, b)).length} trains on ${esc(isl)}. Trains stay on their island.</div>`;
    h += `<button class="act" data-act="trainat" data-id="${b.id}" ${linked && g.s.money >= p ? '' : 'disabled'}>🚂 Ship a train over · ${fmtMoney(p)}</button>`;
    return h + back;
  }
  // front: one status line, then the tiles
  if (!linked) h += home ? `<div class="warn">🔌 Not on the railway yet: lay track from your line to one end of its yard</div>` : `<div class="warn">🌊 No dock of yours reaches this landing</div>`;
  else if (waiting && !ships) h += `<div class="warn">🚢 ${waiting} goods wait for a ship: buy one under Sea routes</div>`;
  else h += `<div class="gift">🌊 Charts the sea ${dockRange(b)} squares out: shores in reach come out of the fog</div>`;
  const sp = islandSpec(g, islandOfB(g, b)); if (sp) h += `<div class="note">★ ${SPEC_TEXT[sp]}: ${sp === 'fish' ? 'fishing boats here catch' : `${INDUSTRIES[sp].name}s here make`} 50% more</div>`;
  const tile = (pg: string, icon: string, title: string, sub: string, alert = false) => `<button class="tile${alert ? ' alert' : ''}" data-act="page" data-page="${pg}"><b>${icon} ${title}</b><small>${sub}</small></button>`;
  const nIsl = near().length, nTr = g.s.trains.filter(t => islandOfTrain(g, t) === islandOfB(g, b)).length;
  h += `<div class="tiles">`
    + tile('sea', '⛴', 'Sea routes', routes.length ? `${routes.length} route${routes.length === 1 ? '' : 's'} · 🚢 ${ships}${waiting ? ` · 📦 ${waiting}` : ''}` : 'none yet', waiting > 0 && !ships)
    + tile('fish', '🎣', 'Fishing', l ? `🐟 ${Math.round(c.fish * 60)}/min${c.shellfish ? ` · 🦞 ${Math.round(c.shellfish * 60)}` : ''}` : 'no boats yet')
    + tile('isl', '🏝', 'Islands', `${nIsl} in reach${b.lvl < MAX_LVL ? ' · ⬆ reach' : ''}`)
    + (home ? '' : tile('trains', '🚂', 'Trains', `${nTr} on ${esc(isl)}`, nTr === 0))
    + `</div>`;
  if (linked) { const m = buildingSquares(g.world.n, b)[1]!; h += mapBtn(g, m % g.world.n, (m / g.world.n) | 0, MAP_R_SEA); }
  h += `<button class="act warnb" data-act="remove" data-id="${b.id}">🗑 Remove · get ${fmtMoney(refundOf(b))}</button>`;
  return h;
}

/** The island a train is on (from the square under its engine). */
const islandOfTrain = (g: Game, t: Train) => g.world.islandOf[g.net.pieces[t.trail.at(-1)!.piece]!.squares.at(-1)!];

function buildingCard(g: Game, b: Building, page?: string): string {
  if (b.kind === 'dock') return dockCard(g, b, page);
  const d = INDUSTRIES[b.kind], k = d.makes, G = GOODS[k], cap = capOf(b), linked = isLinked(g, b), fac = isFactory(b.kind);
  const plan = shipPlan(g);
  const sm = fac ? 1 : specMul(g, islandOfB(g, b), b.kind);
  let h = `<div class="head"><b class="big">${d.icon}</b><div><h2>${d.name}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">${G.icon} ${Math.round(outputOf(g, b) * 60)}/min</span>${sm > 1 ? ' <span class="chip2">★ island specialty +50%</span>' : ''}</div></div>`;
  if (b.fire && g.s.t < b.fire.doneAt) { const c = Math.ceil(b.fire.crewAt - g.s.t); h += `<div class="warn">🔥 On fire: it makes nothing for now. ${c > 0 ? `The fire crew arrives in ${c} s` : `The fire crew is putting it out, ${Math.ceil(b.fire.doneAt - g.s.t)} s left`}. Nothing is lost.</div>`; }
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
    if (b.kind === 'wood') {
      const f = forestOf(g, b).length, st = stumpsOf(g, b), next = st.length ? Math.max(0, Math.ceil(Math.min(...st.map(i => g.s.stumps![i]!)) - g.s.t)) : 0;
      h += `<div class="row"><b class="ico">🌲</b><div class="grow"><div class="line"><span>Forest to cut</span><span>${f} square${f === 1 ? '' : 's'}</span></div>${bar(f / 6, f >= 6 ? '#5cc46a' : '#e8a33c')}<small>${st.length ? `🌱 ${st.length} growing back · next in ${next} s${b.lvl >= 2 ? '' : ' · level 2 regrows 3× faster'}` : 'Each forest square gives 80 wood, then grows back'}</small></div></div>`;
      if (share < 1) h += `<div class="warn">🌲 Few trees left to cut (${Math.round(share * 100)}% output)${f === 0 ? ': it waits for the forest to grow back' : ''}</div>`;
    } else if (share < 1) h += `<div class="warn">🌱 Few fields left around it (${Math.round(share * 100)}% output): track and buildings next to it cover them</div>`;
  }
  h += `<div class="row"><b class="ico">📦</b><div class="grow"><div class="line"><span>${G.name} ready</span><span>${Math.floor(b.stock)} / ${cap}</span></div>${bar(b.stock / cap, b.stock >= cap ? '#e0584a' : '#5cc46a')}${b.stock >= cap ? '<small>Full: it stops making more until a train collects</small>' : ''}</div></div>`;
  const ship = plan.get(b.id);
  const why = (w: Ship['why']) => w === 'order' ? '📋 For its order (full pay)' : w === 'factory' ? '🏭 To make into a product (half pay)' : w === 'steady' ? '🛒 It keeps buying this (part pay)' : '💸 No town needs it now: sold cheap';
  const pinned = b.pin && ship && sameDest(ship.to, b.pin);
  if (page === 'pin') { // choose where its goods go
    h = `<div class="head"><b class="big">📌</b><div><h2>Where should the ${esc(d.name)} send ${G.icon} ${G.name.toLowerCase()}?</h2></div></div>`;
    h += `<button class="act${b.pin ? ' alt' : ''}" data-act="pin" data-id="${b.id}" data-kind="" data-to="">🔄 Automatic${b.pin ? '' : ' ✓'}<br><small>the nearest place that needs it most</small></button>`;
    const ds = destinationsOf(g, b);
    if (!ds.length) h += `<div class="note">No town or factory on its railway yet</div>`;
    for (const x of ds.slice(0, 12)) {
      const on = !!b.pin && sameDest(b.pin, x.to);
      h += `<div class="row${on ? ' ok' : ''}"><b class="ico">${x.to.kind === 'town' ? '🏘' : '🏭'}</b><div class="grow"><div class="line"><span>${esc(x.to.kind === 'bld' ? 'the ' + placeName(g, g.s.buildings!.find(o => o.id === x.to.id)!) : destName(g, x.to))}</span><span>${x.d} squares</span></div><small>${why(x.why)}</small></div><button class="mini${on ? ' on' : ''}" data-act="pin" data-id="${b.id}" data-kind="${x.to.kind}" data-to="${x.to.id}">${on ? '📌 Pinned' : '📌 Send here'}</button></div>`;
    }
    return h + `<small class="why">A pinned building keeps sending there, even when somewhere else needs it more.</small><button class="act back" data-act="page" data-page="">‹ Back</button>`;
  }
  if (ship) h += `<div class="row"><b class="ico">${pinned ? '📌' : '➡'}</b><div class="grow"><div class="line"><span>Sends to <b>${esc(destName(g, ship.to))}</b></span><span>${ship.d} squares</span></div><small>${why(ship.why)}${pinned ? ' · 📌 you chose this' : ''}</small></div><button class="mini" data-act="page" data-page="pin">📌 Choose</button></div>`;
  else if (linked) h += `<div class="warn">🏘 No town on the railway yet to take it</div>`;
  if (b.pin && !pinned) h += `<div class="warn">📌 It is pinned to ${esc(destName(g, b.pin as Dest))}, which its trains can't reach now: it sends automatically meanwhile</div>`;
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
  if (t.broke && g.s.t < t.broke.doneAt) { const c = Math.ceil(t.broke.crewAt - g.s.t); h += `<div class="warn">🔧 Broken down: ${c > 0 ? `the repair crew arrives in ${c} s` : `the crew is fixing it, ${Math.ceil(t.broke.doneAt - g.s.t)} s left`}. Trains behind it wait.</div>`; }
  h += `<div class="note big2">${trainStatus(g, t)}</div>`;
  if (t.lastPay) { h += `<div class="row"><b class="ico">💰</b><div class="grow">Last delivery: ${t.lastPay.n} ${GOODS[t.lastPay.good as Good]?.icon ?? ''} to ${esc(destName(g, t.lastPay.to))} paid <b>${fmtMoney(t.lastPay.pay)}</b></div></div>`; }
  h += `<small class="why">Trains run themselves: each one takes the best waiting load to the place that needs it.</small>`;
  return h;
}

/** 🗺 Area map button: opens Map mode with the circle here (the player can move it before buying). */
function mapBtn(g: Game, x: number, y: number, r: number): string {
  const c = mapCost(g);
  return `<button class="act alt" data-act="areamap" data-x="${x}" data-y="${y}" ${g.s.money >= c ? '' : 'disabled'}>🗺 Map of the area · ${fmtMoney(c)}<br><small>marks hidden towns and landmarks in the fog within ${r} squares</small></button>`;
}
