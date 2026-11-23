import { hallOf } from '../buildings/stations.ts';
import type { Game, Site } from '../state.ts';
import { fallsMul, POI, POI_RARITY, poisOf, RARITY } from '../world/explore.ts';
import { isleCard, reportsHtml, scoutCard } from './discover.ts';
import { joinGap } from '../track/joins.ts';
import { aName, buildingSquares, farText, yardSquares, bufOf, growsTracks, stripError, tracksOf, type Building, capOf, GOODS, type Good, INDUSTRIES, type IndustryKind, inputsOf, isFactory, isLinked, lockedText, outputOf, shareAt, forestOf, stumpsOf, yardSet } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { hasProject, nextParkPrice, orderMul, PARK_PRICE, parkSpot, parksOf, payMul, projectsFor, projectsOf, rewardMul } from '../buildings/parks.ts';
import { isCapital, islandOfSite, regions, tradeOf, tradeReward, tradeWhy } from '../economy/trade.ts';
import { foundPrice, orderDone, orderOf, reward, sizeName, steadyFull, steadyGoods, stepOf, townLinked, upgradePrice, waitsAbroad } from '../economy/towns.ts';
import { type Dest, destinationsOf, destName, type Ship, shipPlan, siteOf } from '../economy/shipping.ts';
import { FERRY_FEE, ferryDock, fleetByIsland, islandOfTrain, shipNewWhy, trainIslands, trainPrice, trainRefund, trainStatus, trainToSell } from '../economy/dispatch.ts';
import { JAM_AFTER } from '../economy/jams.ts';
import { BRIDGE_UPKEEP, bridgeSquares } from '../track/rules.ts';
import { dockRange, isDock, islandName, islandOfB, railIsleName, railIsleOfB, seaDist } from '../ships/docks.ts';
import { railIsle, sameRail } from '../track/isles.ts';
import { EXPEDITION_DOCK, expeditionError, expeditionPrice } from '../world/expedition.ts';
import { RING_ISLANDS } from '../world/terrain.ts';
import { lanesFrom, seaLanes, SHIP_HOLD, shipPrice, SHIP_UP, type ShipUpKey, shipCap, shipSpeed, shipUpLvl, waitingAt } from '../ships/ships.ts';
import { catchOf, FISHING } from '../economy/upgrades.ts';
import { islandSpec, SPEC_TEXT, specMul } from '../world/specialty.ts';
import { FLEET, type FleetKey, fleetLvl, levelGain, levelPrice, lvlUnlockAt, MAX_LVL, maxLvlOf, MAX_RUSH, refundOf, rushBySea, rushMakers, rushFee, rushOf, sellOffer, trainCap, capOf as trainCapOf, fleetIsls } from '../economy/upgrades.ts';
import type { Train } from '../trains/train.ts';
import { fmtMoney } from './hud.ts';
import { storyHtml } from './story.ts';
import { ordersHtml, placeName, waitingForTrain } from './orders.ts';
import { mapHtml, type MapView } from './mapviews.ts';
import { mapCost, MAP_R, MAP_R_SEA } from '../world/maps.ts';

export type Card = { kind: 'shed'; id: 0; page?: string } | { kind: 'fleet'; id: 0; page?: string } | { kind: 'plot'; id: number } | { kind: 'town'; id: number; page?: string } | { kind: 'bld'; id: number; page?: string } | { kind: 'train'; id: number } | { kind: 'story'; id: 0; page?: string } | { kind: 'game'; id: number; page?: string } | { kind: 'orders'; id: 0 } | { kind: 'map'; id: 0 } | { kind: 'ship'; id: number } | { kind: 'ships'; id: 0 } | { kind: 'find'; id: number; more?: number } | { kind: 'scout'; id: number } | { kind: 'isle'; id: number; fresh?: boolean };

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
  const far = farText(g, k); if (far) return `🏝 ${far}`;
  const lock = lockedText(g, m);
  return lock ? `🏭 Made by ${aName(name)} · ${lock}` : `🏗 Build ${aName(name)}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const bar = (f: number, col: string) => `<div class="bar"><i style="width:${Math.round(Math.min(1, Math.max(0, f)) * 100)}%;background:${col}"></i></div>`;
const bName = (b: Building) => INDUSTRIES[b.kind].name;

/** Card HTML. Every number is read fresh, so the card is redrawn each second while open. */
export function cardHtml(g: Game, c: Card, view?: MapView | null): string | null {
  if (c.kind === 'shed') return shedCard(g, c.page);
  if (c.kind === 'fleet') return fleetCard(g, c.page);
  if (c.kind === 'story') return storyHtml(g, c.page);
  if (c.kind === 'orders') return ordersHtml(g);
  if (c.kind === 'map') return mapHtml(g, view ?? null);
  if (c.kind === 'ship') return shipCard(g, c.id);
  if (c.kind === 'ships') return shipsCard(g);
  if (c.kind === 'plot') { const p = siteOf(g, c.id); return p?.kind === 'plot' ? plotCard(g, p) : null; }
  if (c.kind === 'find') return findCard(g, c.id, c.more ?? 0);
  if (c.kind === 'scout') return c.id ? scoutCard(g, c.id) : reportsHtml(g);
  if (c.kind === 'isle') return isleCard(g, c.id, !!c.fresh);
  if (c.kind === 'town') { const t = siteOf(g, c.id); return t?.kind === 'town' ? townCard(g, t, c.page) : null; }
  if (c.kind === 'bld') { const b = g.s.buildings?.find(x => x.id === c.id); return b ? buildingCard(g, b, c.page) : null; }
  const t = g.s.trains.find(x => x.id === c.id); return t ? trainCard(g, t) : null;
}

function townCard(g: Game, t: Site, page?: string): string {
  const L = stepOf(t), o = orderOf(g, t), linked = townLinked(g, t), plan = shipPlan(g);
  let h = `<div class="head"><b class="big">🏘</b><div><h2>${esc(t.name ?? 'Town')}</h2><span class="chip2">${sizeName(L)}</span> <span class="chip2">👥 ${Math.floor(t.pop ?? 0)}</span>${linked && isCapital(g, t) && g.s.caps && Object.keys(g.s.caps).length ? ` <span class="chip2">👑 Capital of ${esc(islandName(g, islandOfSite(g, t)))}</span>` : ''}</div></div>`;
  if (page === 'parks' || page === 'projects') return h + townPage(g, t, page);
  if (!linked) {
    const gap = joinGap(g, t)?.squares, go = `<button class="mini" data-act="railtown" data-x="${t.x}" data-y="${t.y}">🛤 Lay track ›</button>`;
    const j = joinGap(g, t);
    h += gap && j ? `<div class="warn">🔌 Not on the railway yet: your track is only ${gap.length === 1 ? '1 square' : `${gap.length} squares`} short (about ${fmtMoney(j.cost)}). Lay track from the gold arrow over the dashed ${gap.length === 1 ? 'square' : 'squares'}: its 🚉 station goes on the pale outline ${go}</div>`
      : `<div class="warn">🔌 Not on the railway yet: ${hallOf(g.track, g.world.n, t, g.world.terr, yardSet(g)) ? 'join your line to either end of its station' : 'lay track from your line into its 🚉 station outline'} (🛤 Rails shows it, with an arrow where track comes in) ${go}</div>`;
  }
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
  } else { const fm = fallsMul(g, t.x, t.y), cm = rewardMul(g); h += `<div class="gift">🎁 ${fmtMoney(Math.round(reward(L) * fm * cm))} when the order is filled${fm > 1 ? ' (💧 Silver Falls +10%)' : ''}${cm > 1 ? ' (⛪ Cathedral +5%)' : ''}</div>`; }
  if (linked) h += tradeHtml(g, t, plan);
  const st = steadyGoods(t, g);
  if (st.length) h += `<h3>🛒 Keeps buying</h3><div class="chips">${st.map(k => `<span class="chip2">${GOODS[k].icon} ${GOODS[k].name}</span>`).join('')}</div>`;
  const abroad = linked ? waitsAbroad(g, t) : [];
  if (abroad.length) h += `<div class="gift">💰 While its order waits for ${abroad.map(k => `${GOODS[k].icon} ${GOODS[k].name.toLowerCase()}`).join(' and ')} from the outer islands, it pays full price for its other order goods</div>`;
  const coming = g.s.trains.filter(x => x.job && sameDest(x.job.to, { kind: 'town', id: t.id })).length;
  if (coming) h += `<div class="note">🚂 ${coming} train${coming > 1 ? 's' : ''} bringing goods here</div>`;
  if (linked) h += mapBtn(g, t.x, t.y, MAP_R);
  if (linked) {
    const np = parksOf(g, t).length, pj = projectsOf(g, t).length, om = orderMul(g, t), pm = payMul(g, t);
    if (om < 1 || pm > 1) h += `<div class="gift">${om < 1 ? `🌳 Orders ${Math.round((1 - om) * 100)}% smaller` : ''}${om < 1 && pm > 1 ? ' · ' : ''}${pm > 1 ? `🏛 Deliveries pay ${Math.round((pm - 1) * 100)}% more` : ''}</div>`;
    const tile = (pg: string, icon: string, title: string, sub: string) => `<button class="tile" data-act="page" data-page="${pg}"><b>${icon} ${title}</b><small>${sub}</small></button>`;
    h += `<div class="tiles">` + tile('parks', '🌳', 'Parks', `${np} / ${PARK_PRICE.length}${np ? ` · orders −${np * 5}%` : ''}`) + tile('projects', '🏛', 'Town projects', `${pj} / ${projectsFor(g, t).length}`) + `</div>`;
  }
  return h;
}

/** A capital's 🤝 trade order: what it wants from which island, how far along, and why nothing comes. */
function tradeHtml(g: Game, t: Site, plan: ReturnType<typeof shipPlan>): string {
  if (!isCapital(g, t)) return '';
  const o = tradeOf(g, t);
  if (!o) {
    if (t !== g.s.sites[0] || regions(g).size > 1) return '';
    return `<div class="note">🤝 Trade between islands: link a town on another island and join the two by a ship route. Each island's 👑 capital then orders goods only the other island makes.</div>`;
  }
  const G = GOODS[o.good], from = esc(islandName(g, o.from)), why = tradeWhy(g, t, o);
  let h = `<h3>🤝 Trade order ${o.n}</h3>`;
  h += `<div class="row"><b class="ico">${G.icon}</b><div class="grow"><div class="line"><span>${G.name} from ${from}</span><span>${o.got} / ${o.need}</span></div>${bar(o.got / o.need, '#6bb8e8')}<small>${why ? `⚠ ${why}` : tradeSource(g, plan, t, o.good, o.from)}</small></div></div>`;
  h += `<div class="gift">🎁 ${fmtMoney(Math.round(tradeReward(o.n) * rewardMul(g)))} when it is filled, and it counts as a filled order. Optional: ${esc(t.name ?? 'the town')} grows without it.</div>`;
  return h;
}

/** Where a trade order's goods are: on trains here, on a ship, or being sent over from the far island. */
function tradeSource(g: Game, plan: ReturnType<typeof shipPlan>, t: Site, k: Good, from: number): string {
  const to = { kind: 'town' as const, id: t.id }, here = islandOfSite(g, t);
  const coming = g.s.trains.filter(x => x.job && sameDest(x.job.to, to) && x.job.good === k).length;
  if (coming) return `🚂 ${coming} train${coming > 1 ? 's' : ''} bringing it now`;
  const afloat = (g.s.ships ?? []).reduce((a, s) => a + s.hold.filter(q => q.good === k).reduce((b, q) => b + q.n, 0), 0);
  if (afloat) return `🚢 ${afloat} on a ship now`;
  const sent = (g.s.buildings ?? []).some(b => { // sent to its dock for a ship here (or for a ship to a dock that passes it on here)
    const p = plan.get(b.id), far = p && (p.then ?? p.sea), d = far !== undefined ? g.s.buildings!.find(x => x.id === far) : undefined;
    return sameRail(g, islandOfB(g, b), from) && INDUSTRIES[b.kind].makes === k && !!d && sameRail(g, islandOfB(g, d), here);
  });
  if (sent) return `⛴ ${esc(islandName(g, from))} sends it to its dock for a ship`;
  return `🔀 ${esc(islandName(g, from))}'s ${GOODS[k].name.toLowerCase()} goes to places that need it first: make more there`;
}

/** The Parks and Town projects pages of a town card. */
function townPage(g: Game, t: Site, page: string): string {
  const back = `<button class="act back" data-act="page" data-page="">‹ Back</button>`, name = esc(t.name ?? 'this town');
  let h = '';
  if (page === 'parks') {
    const np = parksOf(g, t).length, c = nextParkPrice(g, t), spot = c !== null ? parkSpot(g, t) : null;
    h += `<h3>🌳 Parks</h3><div class="note">Parks make ${name} a nicer place to live: each one makes its orders 5% smaller, so it grows with fewer goods. Up to ${PARK_PRICE.length} per town.</div>`;
    h += `<div class="row"><b class="ico">🌳</b><div class="grow"><div class="line"><span>${[0, 1, 2].map(k => k < np ? '🌳' : '<span style="opacity:.3">🌳</span>').join(' ')}</span><span>${np} / ${PARK_PRICE.length}</span></div>${bar(np / PARK_PRICE.length, '#5cc46a')}<small>${np ? `Orders here are ${np * 5}% smaller` : 'No park yet'}</small></div></div>`;
    if (c === null) h += `<div class="gift">✅ ${name} has all its parks</div>`;
    else if (!spot) h += `<div class="warn">🚧 No free grass near ${name}: track, water or buildings fill every square 2-4 squares from its centre</div>`;
    else { h += `<button class="act" data-act="park" data-id="${t.id}" ${g.s.money >= c ? '' : 'disabled'}>🌳 Open a park · ${fmtMoney(c)}</button>`; if (g.s.money < c) h += `<small class="why">Need ${fmtMoney(c - Math.floor(g.s.money))} more: deliveries keep paying</small>`; }
    return h + back;
  }
  h += `<h3>🏛 Town projects</h3><div class="note">Big projects for a growing town. Each adds a building to ${name}'s streets and a lasting bonus here.</div>`;
  const room = !!parkSpot(g, t);
  let grand = false;
  for (const P of projectsFor(g, t)) {
    if (P.size >= 3 && P.ashford && !grand) { grand = true; h += `<h3>👑 Grand Ashford</h3><div class="note">Landmarks for a rich railway: they help the whole network.</div>`; }
    if (!P.ashford && grand) { grand = false; h += `<h3>🏘 For Ashford's streets</h3>`; }
    const has = hasProject(g, t, P.k), rl = !!P.rlv && (g.s.rlv ?? 0) < P.rlv, lock = stepOf(t) < P.size || rl;
    h += `<div class="row${has ? ' done' : ''}"><b class="ico">${P.icon}</b><div class="grow"><div class="line"><span>${P.name}</span><span>${has ? '✅ Built' : rl ? `🔒 Railway level ${P.rlv}` : lock ? `🔒 ${sizeName(P.size)}` : fmtMoney(P.price)}</span></div><small>${P.text}</small>`;
    if (!has && !lock) h += room ? `<button class="mini" data-act="project" data-id="${t.id}" data-k="${P.k}" ${g.s.money >= P.price ? '' : 'disabled'}>🏗 Build · ${fmtMoney(P.price)}</button>` : `<small class="why">No free grass near ${name} for it</small>`;
    else if (rl) h += `<small class="why">Unlocks at Railway level ${P.rlv}: fill more town orders</small>`;
    else if (lock) h += `<small class="why">Unlocks when ${name} grows into a ${sizeName(P.size)}</small>`;
    h += `</div></div>`;
  }
  return h + back;
}

function plotCard(g: Game, p: Site): string {
  const fp = foundPrice(g, p), can = g.s.money >= fp;
  let h = `<div class="head"><b class="big">🚩</b><div><h2>${esc(p.name ?? 'Settlement site')}</h2><span class="chip2">Settlement site</span></div></div>`;
  h += `<div class="row"><b class="ico">①</b><div class="grow"><b>Found the town</b> · ${fmtMoney(fp)}<small>houses go up and it becomes a Hamlet with its own order</small></div></div>`;
  h += `<div class="row"><b class="ico">②</b><div class="grow"><b>Lay track into its station</b><small>🛤 Rails: from your line to the town square, like any town</small></div></div>`;
  h += `<div class="row"><b class="ico">③</b><div class="grow"><b>Fill its order</b><small>your trains bring what it asks for, and you earn its reward</small></div></div>`;
  h += `<button class="act" data-act="found" data-id="${p.id}" ${can ? '' : 'disabled'}>🏘 Found ${esc(p.name ?? 'a town')} · ${fmtMoney(fp)}</button>`;
  if (!can) h += `<div class="row"><b class="ico">💰</b><div class="grow"><div class="line"><span>You have ${fmtMoney(g.s.money)}</span><span>need ${fmtMoney(fp - Math.floor(g.s.money))} more</span></div>${bar(g.s.money / fp, '#e8a33c')}<small>Deliveries pay for it. Short of money? Sell stock at a full building (💸 Sell) or a spare train (💰 on its card)</small></div></div>`;
  return h;
}

/** 🚢 Ships (toolbar): every cargo ship and what it does, the sea routes (drawn on the map while this is open), buy and upgrade. */
function shipsCard(g: Game): string {
  const ships = g.s.ships ?? [], lanes = seaLanes(g), bld = (i: number) => g.s.buildings?.find(b => b.id === i);
  const where = (i: number) => { const b = bld(i); if (!b) return 'a dock'; const k = islandOfB(g, b); return k === g.world.home ? `${esc(placeName(g, b).replace(/^Dock near /, ''))} dock` : `${esc(islandName(g, k))} landing`; };
  let h = `<div class="head"><b class="big">🚢</b><div><h2>Ships</h2><span class="chip2">🚢 ${ships.length} ship${ships.length === 1 ? '' : 's'}</span> <span class="chip2">⛴ ${lanes.length} route${lanes.length === 1 ? '' : 's'}</span></div></div>`;
  if (!lanes.length) return h + `<div class="note">⛴ A sea route joins two docks on different islands. Build → ⚓ Dock on your coast and another on an island's shore within reach, both on your railway.</div>`;
  h += `<div class="note">🗺 Your sea routes are drawn on the map in blue while this is open</div>`;
  // buy and upgrade first, above the lists, so they never need a long scroll
  const home = lanes.map(l => bld(l.a)!).find(b => islandOfB(g, b) === g.world.home) ?? bld(lanes[0]!.a)!;
  h += `<button class="act" data-act="ship" data-id="${home.id}" ${g.s.money >= shipPrice(g) ? '' : 'disabled'}>🚢 Buy a cargo ship · ${fmtMoney(shipPrice(g))}</button>`;
  if (ships.length) h += shipUpRows(g);
  h += `<h3>🚢 Your ships</h3>`;
  for (const [i, s] of ships.entries()) {
    const load = s.hold.reduce((a, q) => a + q.n, 0), goods = [...new Set(s.hold.map(q => GOODS[q.good].icon))].join('');
    h += `<div class="row"><b class="ico">🚢</b><div class="grow"><div class="line"><span>Ship ${i + 1}</span><span>📦 ${load}${goods ? ' ' + goods : ''}</span></div><small>${s.to !== undefined ? `⛴ Sailing to ${where(s.to)}` : `⚓ At ${where(s.at)}`}</small></div><button class="mini" data-act="open" data-kind="ship" data-id="${s.id}">Open ›</button></div>`;
  }
  if (!ships.length) h += `<div class="warn">🚢 No cargo ship yet: goods for other islands wait at the docks until you buy one</div>`;
  h += `<h3>⛴ Sea routes</h3>`;
  for (const l of lanes) {
    const wait = (waitingAt(bld(l.a)!).get(l.b) ?? 0) + (waitingAt(bld(l.b)!).get(l.a) ?? 0);
    h += `<div class="row"><b class="ico">⛴</b><div class="grow"><div class="line"><span>${where(l.a)} ↔ ${where(l.b)}</span><span>${l.d} squares · ${Math.round(l.d / shipSpeed(g))} s</span></div><small>${wait ? `📦 ${wait} waiting for a ship` : 'Nothing waiting'}</small></div></div>`;
  }
  return h;
}

/** Ship card: where it is, what it is doing, and what its hold carries where. */
function shipCard(g: Game, id: number): string | null {
  const s = g.s.ships?.find(x => x.id === id); if (!s) return null;
  const dock = (i: number | undefined) => g.s.buildings?.find(b => b.id === i);
  const where = (b: Building | undefined) => { if (!b) return 'a dock'; const k = islandOfB(g, b); return k === g.world.home ? `the dock near ${esc(placeName(g, b).replace(/^Dock near /, ''))}` : `${esc(islandName(g, k))} landing`; };
  const load = s.hold.reduce((a, q) => a + q.n, 0), n = (g.s.ships ?? []).indexOf(s) + 1;
  let h = `<div class="head"><b class="big">🚢</b><div><h2>Cargo ship ${n}</h2><span class="chip2">📦 ${load} / ${shipCap(g)}</span></div></div>`;
  if (s.to !== undefined && s.path) {
    const left = Math.max(0, Math.ceil(s.path.length - 1 - s.pos)), f = s.pos / Math.max(1, s.path.length - 1);
    h += `<div class="gift">⛴ Sailing from ${where(dock(s.at))} to ${where(dock(s.to))}</div>`;
    h += `<div class="row"><b class="ico">🌊</b><div class="grow"><div class="line"><span>On the way</span><span>${left} squares · ${Math.round(left / shipSpeed(g))} s</span></div>${bar(f, '#6bb8e8')}</div></div>`;
  } else {
    const wait = waitingAt(dock(s.at) ?? ({} as Building)), most = Math.max(0, ...wait.values());
    const doing = s.wait > 0 ? (load ? 'Loading and unloading' : 'Unloading') : most > 0 ? `Waiting a little for a fuller load (📦 ${most} ready, it leaves at ${shipCap(g) / 2} or after ${SHIP_HOLD} s)` : 'No goods wait on its routes: it sails where goods are waiting';
    h += `<div class="${most > 0 || s.wait > 0 ? 'gift' : 'note'}">⚓ At ${where(dock(s.at))}</div><div class="note">${doing}</div>`;
  }
  h += shipUpRows(g);
  h += `<h3>📦 In the hold</h3>`;
  if (!s.hold.length) h += `<div class="note">Empty${s.to !== undefined ? ': it sails to fetch goods waiting there' : ''}</div>`;
  for (const q of s.hold) h += `<div class="row"><b class="ico">${GOODS[q.good].icon}</b><div class="grow"><div class="line"><span>${q.n} ${GOODS[q.good].name.toLowerCase()}</span><span>→ ${where(dock(q.to))}</span></div>${q.then !== undefined ? `<small>then on by the next ship to ${where(dock(q.then))}</small>` : ''}</div></div>`;
  const d = dock(s.to ?? s.at);
  if (d) h += `<button class="act alt" data-act="open" data-kind="bld" data-id="${d.id}">⚓ Open ${s.to !== undefined ? 'the dock it sails to' : 'this dock'}</button>`;
  return h + `<div class="note">Ships sail between your docks by themselves and carry goods to other islands.</div>`;
}

/** Dock card: a status line and four tiles (sea routes and ships, fishing, islands, trains or level), each opening a page with Back. */
function dockCard(g: Game, b: Building, page?: string): string {
  const linked = isLinked(g, b), home = islandOfB(g, b) === g.world.home, isl = islandName(g, islandOfB(g, b));
  // trains: islands joined by a 🌉 bridge are one railway (trains drive over from Ashford Isle's engine shed)
  const rIsl = railIsleOfB(g, b), railHome = rIsl === g.world.home, rName = railIsleName(g, rIsl);
  let h = `<div class="head"><b class="big">⚓</b><div><h2>${home ? 'Dock' : `Landing · ${esc(isl)}`}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">🌊 reaches ${dockRange(b)} squares</span></div></div>`;
  const routes = linked ? lanesFrom(g, b.id) : [], ships = (g.s.ships ?? []).length, wait = waitingAt(b), waiting = [...wait.values()].reduce((a, v) => a + v, 0);
  const l = b.fish ?? 0, c = catchOf(l), next = FISHING[l];
  const name = (id: number) => { const o = g.s.buildings!.find(x => x.id === id)!; const k = islandOfB(g, o); return k === g.world.home ? 'Ashford Isle dock' : `${islandName(g, k)} landing`; };
  // islands this dock reaches, nearest first
  const near = () => {
    const d = seaDist(g, b), n = g.world.n, m = new Map<number, number>(), at = new Map<number, number>();
    for (let i = 0; i < n * n; i++) {
      const v = d[i]!; if (v < 0 || v > dockRange(b)) continue;
      for (const j of [i + 1, i - 1, i + n, i - n]) { const k = g.world.islandOf[j]; if (k === undefined || k < 0 || !g.world.islands[k]!.name || k === islandOfB(g, b)) continue; if (!m.has(k) || m.get(k)! > v) { m.set(k, v); at.set(k, j); } }
    }
    return [...m].sort((p, q) => p[1] - q[1]).slice(0, 5).map(([k, v]) => [k, v, at.get(k)!] as const);
  };
  const back = `<button class="act back" data-act="page" data-page="">‹ Back</button>`;
  if (page === 'sea') {
    if (routes.length) h += `<button class="act" data-act="ship" data-id="${b.id}" ${g.s.money >= shipPrice(g) ? '' : 'disabled'}>🚢 Buy a cargo ship · ${fmtMoney(shipPrice(g))}</button>`;
    if (ships) h += shipUpRows(g);
    h += `<h3>⛴ Sea routes</h3>`;
    for (const r of routes) h += `<div class="row"><b class="ico">⛴</b><div class="grow"><div class="line"><span>${esc(name(r.id))}</span><span>${r.d} squares · ${Math.round(r.d / shipSpeed(g))} s</span></div><small>${wait.get(r.id) ? `📦 ${wait.get(r.id)} waiting for a ship` : 'Nothing waiting'}</small></div></div>`;
    if (!routes.length) h += `<div class="note">⛴ ${home ? "Build a Dock on another island's shore within reach: that makes a sea route" : 'No sea route from here yet'}</div>`;
    if (ships) h += `<div class="note">🚢 ${ships} ship${ships === 1 ? '' : 's'} sail${ships === 1 ? 's' : ''} every route: they go where goods wait</div>` + (g.s.ships ?? []).map((x, i) => `<div class="row"><b class="ico">🚢</b><div class="grow"><small>Ship ${i + 1}: ${x.to !== undefined ? `sailing to ${esc(name(x.to))}` : `at ${esc(name(x.at))}`} · 📦 ${x.hold.reduce((a, q) => a + q.n, 0)}</small></div><button class="mini" data-act="open" data-kind="ship" data-id="${x.id}">Open ›</button></div>`).join('');
    else h += routes.length ? `<div class="warn">🚢 No cargo ship yet: goods for other islands wait here until you buy one</div>` : '';
    const landed = Object.entries(b.landed ?? {}).filter(([, v]) => (v ?? 0) >= 1);
    if (landed.length) h += `<div class="gift">📦 Ready here for this island's trains: ${landed.map(([k, v]) => `${GOODS[k as Good].icon} ${Math.floor(v!)}`).join(' · ')}</div>`;
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
    for (const [k, v, at] of list) {
      const has = (g.s.buildings ?? []).some(o => o.kind === 'dock' && islandOfB(g, o) === k), n = g.world.n;
      h += `<div class="row"><b class="ico">🏝</b><div class="grow"><div class="line"><span>${esc(g.world.islands[k]!.name!)}</span><span>${v} squares</span></div><small>${has ? '⚓ You have a landing there' : '🏗 Its shore glows where a landing fits'}</small></div>${has ? '' : `<button class="mini" data-act="landat" data-x="${at % n}" data-y="${(at / n) | 0}">⚓ Land ›</button>`}</div>`;
    }
    if (!list.length) h += `<div class="note">🌊 No other island within reach yet: a bigger dock sails farther</div>`;
    if (b.lvl < MAX_LVL) { const p = levelPrice(b); h += `<button class="act" data-act="lvl" data-id="${b.id}" ${g.s.money >= p ? '' : 'disabled'}>⬆ Level ${b.lvl + 1}: ${levelGain(b)} · ${fmtMoney(p)}</button>`; }
    if (b.lvl >= EXPEDITION_DOCK) h += `<button class="act alt" data-act="page" data-page="exp">🗺 Expedition to the far seas ›</button>`;
    else h += `<small class="why">🗺 A level ${EXPEDITION_DOCK} dock can send expeditions to new islands past the edge of the sea</small>`;
    return h + back;
  }
  if (page === 'exp') {
    // 🗺 expeditions: past the edge of the known sea
    const ep = expeditionPrice(g), er = expeditionError(g, b), done = g.s.rings ?? 0;
    h += `<h3>🗺 Expedition to the far seas</h3>`;
    h += `<div class="row"><b class="ico">🧭</b><div class="grow"><b>A new ring of islands</b><small>About ${RING_ISLANDS} new islands all round the map, past the edge of your sea</small></div></div>`;
    h += `<div class="row"><b class="ico">🏘</b><div class="grow"><b>A town on each</b><small>Lay track to it and it starts its own orders</small></div></div>`;
    h += `<div class="row"><b class="ico">⛏</b><div class="grow"><b>Rich deposits</b><small>Coal, stone, iron and oil, richer than at home</small></div></div>`;
    h += `<div class="chips"><span class="chip2">💰 ${fmtMoney(ep)}</span><span class="chip2">🗺 sent so far: ${done}</span><span class="chip2">next one ${fmtMoney(ep * 2)}</span></div>`;
    h += `<button class="act" data-act="expedition" data-id="${b.id}" ${er ? 'disabled' : ''}>🗺 Send an expedition · ${fmtMoney(ep)}</button>`;
    if (er) h += `<small class="why">${er}</small>`;
    return h + `<button class="act back" data-act="page" data-page="isl">‹ Back</button>`;
  }
  if (page === 'trains') {
    const p = trainPrice(g) + FERRY_FEE, mine = g.s.trains.filter(t => islandOfTrain(g, t) === rIsl);
    const idle = mine.filter(t => !t.job).length;
    h += `<div class="note">🚂 ${mine.length} train${mine.length === 1 ? '' : 's'} on ${esc(rName)}${idle ? ` · 💤 ${idle} waiting for work` : ''}. Trains stay on their island unless shipped.</div>`;
    if (!railHome) { // buy first, above the lists
      const why = shipNewWhy(g, b);
      h += `<button class="act" data-act="trainat" data-id="${b.id}" ${!why && g.s.money >= p ? '' : 'disabled'}>🚂 Ship a new train over · ${fmtMoney(p)}<br><small>it leaves the engine shed, runs to the nearest dock and sails here</small></button>`;
      if (why) h += `<small class="why">${why}</small>`;
    }
    // ⛴ bring one from any other island: a free one sails now, a busy one after it has delivered its load
    const coming = g.s.trains.filter(t => t.moveTo === b.id);
    for (const t of coming) h += `<div class="row"><b class="ico">⛴</b><div class="grow"><b>Train ${t.id} is coming from ${esc(railIsleName(g, islandOfTrain(g, t)))}</b><small>${t.cargo ? 'It sails as soon as it has delivered its load' : t.broke ? 'It sails once the repair crew has fixed it' : 'It sails in a moment'}</small></div><button class="mini" data-act="unmove" data-id="${b.id}" data-to="${t.id}">✕ Cancel</button></div>`;
    const isls = trainIslands(g, b);
    if (isls.length) h += `<h3>⛴ Bring a train from another island · ${fmtMoney(FERRY_FEE)}</h3>`;
    for (const x of isls) {
      const can = x.n > x.booked, sub = !can ? 'every train there is already coming' : x.free ? `${x.free} waiting for work: one sails now` : 'all busy: one sails after its delivery';
      h += `<div class="row"><b class="ico">🏝</b><div class="grow"><div class="line"><span>${esc(x.name)}</span><span>🚂 ${x.n}</span></div><small>${sub}</small></div><button class="mini" data-act="bringfrom" data-id="${b.id}" data-to="${x.island}" ${linked && can && g.s.money >= FERRY_FEE ? '' : 'disabled'}>⛴ Bring one</button></div>`;
    }
    // ⛴ new trains on their way here: running from the engine shed to their dock, or aboard a boat
    for (const t of g.s.trains.filter(x => x.ferry?.to === b.id)) { const d = ferryDock(g, t); h += `<div class="row"><b class="ico">🚂</b><div class="grow"><b>New Train ${t.id} is on its way</b><small>Running on the rails to ${d ? `the ⚓ dock near ${esc(placeName(g, d).replace(/^Dock near /, ''))}` : 'the ⚓ dock'}, where a boat takes it over</small></div></div>`; }
    for (const f of (g.s.ferries ?? []).filter(x => x.to === b.id)) h += `<div class="row"><b class="ico">⛴</b><div class="grow"><b>Train ${f.train} is at sea</b><small>${f.pos < (f.path?.length ?? 1) - 1 ? 'The boat lands it here soon' : 'Waiting for the yard to clear to set it down'}</small></div></div>`;
    if (railHome && !isls.length) h += `<div class="note">Buy new trains for ${esc(rName)} at the 🏚 Engine shed. Trains on other islands with a dock can be shipped here.</div>`;
    return h + back;
  }
  // front: one status line, then the tiles
  if (!linked) h += home ? `<div class="warn">🔌 Not on the railway yet: join one end of its yard to your track (🛤 Rails: draw from either side)</div>` : `<div class="warn">🌊 No dock of yours reaches this landing</div>`;
  else if (waiting && !ships) h += `<div class="warn">🚢 ${waiting} goods wait for a ship: buy one under Sea routes</div>`;
  else h += `<div class="gift">🌊 Charts all the sea it reaches, ${dockRange(b)} squares out: every shore it can land on is out of the fog</div>`;
  const sp = islandSpec(g, islandOfB(g, b)); if (sp) h += `<div class="note">★ ${SPEC_TEXT[sp]}: ${sp === 'fish' ? 'fishing boats here catch' : `${INDUSTRIES[sp].name}s here make`} 50% more</div>`;
  const tile = (pg: string, icon: string, title: string, sub: string, alert = false) => `<button class="tile${alert ? ' alert' : ''}" data-act="page" data-page="${pg}"><b>${icon} ${title}</b><small>${sub}</small></button>`;
  const nIsl = near().length, nTr = g.s.trains.filter(t => islandOfTrain(g, t) === rIsl).length;
  h += `<div class="tiles">`
    + tile('sea', '⛴', 'Sea routes', routes.length ? `${routes.length} route${routes.length === 1 ? '' : 's'} · 🚢 ${ships}${waiting ? ` · 📦 ${waiting}` : ''}` : 'none yet', waiting > 0 && !ships)
    + tile('fish', '🎣', 'Fishing', l ? `🐟 ${Math.round(c.fish * 60)}/min${c.shellfish ? ` · 🦞 ${Math.round(c.shellfish * 60)}` : ''}` : 'no boats yet')
    + tile('isl', '🏝', 'Islands', `${nIsl} in reach${b.lvl < MAX_LVL ? ' · ⬆ reach' : ' · 🗺 expedition'}`)
    + tile('trains', '🚂', 'Trains', `${nTr} on ${esc(isl)}`, !home && nTr === 0)
    + `</div>`;
  if (linked) { const m = buildingSquares(g.world.n, b)[1]!; h += mapBtn(g, m % g.world.n, (m / g.world.n) | 0, MAP_R_SEA); }
  h += `<button class="act warnb" data-act="remove" data-id="${b.id}">🗑 Remove · get ${fmtMoney(refundOf(b))}</button>`;
  return h;
}


function buildingCard(g: Game, b: Building, page?: string): string {
  if (b.kind === 'dock') return dockCard(g, b, page);
  const d = INDUSTRIES[b.kind], k = d.makes, G = GOODS[k], cap = capOf(b), linked = isLinked(g, b), fac = isFactory(b.kind);
  const plan = shipPlan(g);
  const sm = fac ? 1 : specMul(g, islandOfB(g, b), b.kind);
  let h = `<div class="head"><b class="big">${d.icon}</b><div><h2>${d.name}</h2><span class="chip2">Level ${b.lvl}</span> <span class="chip2">${G.icon} ${Math.round(outputOf(g, b) * 60)}/min</span>${sm > 1 ? ' <span class="chip2">★ island specialty +50%</span>' : ''}</div></div>`;
  if (b.fire && g.s.t < b.fire.doneAt) { const c = Math.ceil(b.fire.crewAt - g.s.t); h += `<div class="warn">🔥 On fire: it makes nothing for now. ${c > 0 ? `The fire crew${b.fire.from ? ` from ${b.fire.from}` : ''} is on its way${b.fire.run ? ' along the rails' : ''}${b.fire.run?.off !== undefined ? ' (waiting beside the rails for a train to pass)' : b.fire.run?.stop ? ' (stopped behind a train)' : ''}, here in ${c} s` : `The fire crew is putting it out, ${Math.ceil(b.fire.doneAt - g.s.t)} s left`}. Nothing is lost.</div>`; }
  if (!linked) h += `<div class="warn">🔌 Not on the railway yet: join one end of its yard to your track (🛤 Rails: draw from either side)</div>`;
  if (b.closed) h += `<div class="warn">⛔ Closed: it makes nothing${fac ? ', takes nothing in' : ''} and the barriers keep trains out. Its ${G.icon} stock waits here.</div><button class="act" data-act="shut" data-id="${b.id}">✅ Open it again</button>`;
  if (fac) {
    const st = factoryState(g, b);
    if (linked && !b.closed) h += st.busy ? `<div class="gift">🟢 Working: making ${G.icon} ${G.name}</div>` : b.stock >= cap ? `<div class="warn">📦 Full: waiting for a train to collect</div>` : `<div class="warn">🟠 Waiting for ${st.waits.map(w => GOODS[w].icon + ' ' + GOODS[w].name).join(' and ')}</div>`;
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
  if (waitingForTrain(g, plan).has(b.id)) { // ⏳ plenty ready and somewhere to go, but every train on its island is busy
    const isl = railIsle(g, g.world.islandOf[b.y * g.world.n + b.x]!), f = fleetByIsland(g).find(x => x.island === isl);
    h += `<div class="warn">⏳ ${Math.floor(b.stock)} ${G.icon} ${G.name.toLowerCase()} waiting for a free train · all your trains on ${esc(railIsleName(g, isl))} are busy</div>`;
    if (f?.buyAt) h += `<button class="act" data-act="buyon" data-isl="${isl}" ${g.s.money >= f.price ? '' : 'disabled'}>🚂 Buy a train · ${fmtMoney(f.price)}</button>`;
  }
  const ship = plan.get(b.id);
  // 'extra' to a town whose order still lists this good: the trains already on their way bring all the order needs
  const covered = (to?: Ship['to']) => { const t = to?.kind === 'town' ? g.s.sites.find(s => s.id === to.id) : undefined; return !!t && (orderOf(g, t)[k] ?? 0) > (t.got?.[k] ?? 0); };
  const full = (to?: Ship['to']) => { const t = to?.kind === 'town' ? g.s.sites.find(s => s.id === to.id) : undefined; return !!t && steadyFull(g, t, k); };
  const why = (w: Ship['why'], to?: Ship['to']) => w === 'order' ? '📋 For its order (full pay)' : w === 'factory' ? '🏭 To make into a product (half pay)' : w === 'steady' ? (full(to) ? '🛒 It keeps buying this (full pay while its order waits on the outer islands)' : '🛒 It keeps buying this (part pay)') : covered(to) ? '🚂 Trains on the way already bring all its order needs: more is sold cheap' : '💸 No town needs it now: sold cheap';
  const pinned = b.pin && ship && sameDest(ship.to, b.pin);
  if (page === 'pin') { // choose where its goods go
    h = `<div class="head"><b class="big">📌</b><div><h2>Where should the ${esc(d.name)} send ${G.icon} ${G.name.toLowerCase()}?</h2></div></div>`;
    h += `<button class="act${b.pin ? ' alt' : ''}" data-act="pin" data-id="${b.id}" data-kind="" data-to="">🔄 Automatic${b.pin ? '' : ' ✓'}<br><small>the nearest place that needs it most</small></button>`;
    const ds = destinationsOf(g, b);
    if (!ds.length) h += `<div class="note">No town or factory on its railway yet</div>`;
    for (const x of ds.slice(0, 12)) {
      const on = !!b.pin && sameDest(b.pin, x.to);
      h += `<div class="row${on ? ' ok' : ''}"><b class="ico">${x.to.kind === 'town' ? '🏘' : '🏭'}</b><div class="grow"><div class="line"><span>${esc(x.to.kind === 'bld' ? 'the ' + placeName(g, g.s.buildings!.find(o => o.id === x.to.id)!) : destName(g, x.to))}</span><span>${x.d} squares</span></div><small>${why(x.why, x.to)}</small></div><button class="mini${on ? ' on' : ''}" data-act="pin" data-id="${b.id}" data-kind="${x.to.kind}" data-to="${x.to.id}">${on ? '📌 Pinned' : '📌 Send here'}</button></div>`;
    }
    return h + `<small class="why">A pinned building keeps sending there, even when somewhere else needs it more.</small><button class="act back" data-act="page" data-page="">‹ Back</button>`;
  }
  if (ship) h += `<div class="row"><b class="ico">${pinned ? '📌' : '➡'}</b><div class="grow"><div class="line"><span>Sends to <b>${esc(destName(g, ship.to))}</b></span><span>${ship.d} squares</span></div><small>${why(ship.why, ship.to)}${pinned ? ' · 📌 you chose this' : ''}</small></div><button class="mini" data-act="page" data-page="pin">📌 Choose</button></div>`;
  else if (linked && !b.closed) h += `<div class="warn">🏘 No town on the railway yet to take it</div>`;
  if (b.pin && !pinned) h += `<div class="warn">📌 It is pinned to ${esc(destName(g, b.pin as Dest))}, which its trains can't reach now: it sends automatically meanwhile</div>`;
  const tr = g.s.trains.filter(t => t.job?.src === b.id || (t.job && sameDest(t.job.to, { kind: 'bld', id: b.id })));
  if (!b.closed) h += `<div class="note">🚂 ${tr.length ? `${tr.length} train${tr.length > 1 ? 's' : ''} on this` : g.s.trains.length ? `Trains collect when ${Math.round(trainCap(g, islandOfB(g, b)) * 0.75)} are ready` : 'Buy a train at the engine shed (🚂 Train)'}</div>`;
  // grow it, sell what's piled up, or take it down
  if (b.lvl < maxLvlOf(g, b)) {
    const p = levelPrice(b), room = growsTracks(b.kind) && tracksOf(b) < 3 ? stripError(g, b) : '', can = g.s.money >= p && !room;
    h += `<button class="act" data-act="lvl" data-id="${b.id}" ${can ? '' : 'disabled'}>⬆ Level ${b.lvl + 1}: ${levelGain(b)} · ${fmtMoney(p)}</button>`;
    if (room) h += `<small class="why">🚧 No room for another loading track: ${room}</small>`;
    else if (!can) h += `<small class="why">Need ${fmtMoney(p - Math.floor(g.s.money))} more</small>`;
  } else if (lvlUnlockAt(b)) h += `<div class="gift">🔒 Level ${b.lvl + 1} opens at Railway level ${lvlUnlockAt(b)} (you are at ${g.s.rlv ?? 0}): build a second one to make more meanwhile</div>`;
  else h += `<div class="gift">⭐ Full size (level ${b.lvl}): build a second one to make more</div>`;
  if (!b.closed) h += `<button class="act alt" data-act="shut" data-id="${b.id}">⛔ Close for now</button><small class="why">Closed, it makes nothing${fac ? ' and takes nothing in' : ''}, and barriers keep trains out of its yard${yardThrough(g, b) ? ' (trains that pass through it go another way or wait)' : ''}. Open it again any time.</small>`;
  const so = sellOffer(b);
  h += `<div class="pair"><button class="act alt" data-act="sell" data-id="${b.id}" ${so.n > 0 ? '' : 'disabled'}>💸 Sell ${so.n} ${G.icon} · ${fmtMoney(so.pay)}</button>`;
  h += `<button class="act warnb" data-act="remove" data-id="${b.id}">🗑 Remove · get ${fmtMoney(refundOf(b))}</button></div>`;
  h += `<small class="why">Selling takes 3/4 of its stock at 60% of the price; deliveries pay more. Removing gives back half of what you paid${b.dep ? ' and frees the deposit' : ''}; its yard track stays.</small>`;
  return h;
}

/** Does the line run on past both ends of the yard (so trains pass through it)? */
function yardThrough(g: Game, b: Building): boolean {
  const ys = yardSquares(g.world.n, b), [a, z] = b.horizontal ? [2, 0] : [3, 1];
  return !!((g.track.get(ys[0]!)?.links ?? 0) & (1 << a)) && !!((g.track.get(ys.at(-1)!)?.links ?? 0) & (1 << z));
}

/** A small button on an order or input row: rush it (its makers send here first, paid up front), or stop rushing. */
function rushBtn(g: Game, to: Dest, k: Good): string {
  const r = rushOf(g, to, k), full = (g.s.rush ?? []).length >= MAX_RUSH;
  if (r) return `<button class="mini on" data-act="rush" data-kind="${to.kind}" data-id="${to.id}" data-good="${k}">⭐ ${r.left} to go · ✕ stop</button>`;
  if (full || !rushMakers(g, k)) return '';
  const f = rushFee(g, to, k), sea = rushBySea(g, to, k);
  return `<button class="mini" data-act="rush" data-kind="${to.kind}" data-id="${to.id}" data-good="${k}" ${g.s.money >= f ? '' : 'disabled'}>⭐ Rush · ${fmtMoney(f)}${sea ? ' 🚢' : ''}</button>`
;
}

/** ⚡ Faster ships and 📦 Bigger holds, for every ship at once. */
function shipUpRows(g: Game): string {
  let h = `<h3>🔧 Ship upgrades (every ship)</h3>`;
  for (const k of Object.keys(SHIP_UP) as ShipUpKey[]) {
    const f = SHIP_UP[k], l = shipUpLvl(g, k), p = f.price[l], top = p === undefined;
    h += `<div class="row"><b class="ico">${f.icon}</b><div class="grow"><div class="line"><span>${f.name}</span><span>${top ? 'Top level' : `Level ${l} → ${l + 1}`}</span></div>${bar(l / f.price.length, '#6bb8e8')}<small>Now: ${f.text(l)}${top ? '' : ` · next: ${f.text(l + 1)}`}</small>`;
    if (!top) h += `<button class="mini" data-act="shipup" data-k="${k}" ${g.s.money >= p ? '' : 'disabled'}>⬆ ${fmtMoney(p)}</button>`;
    h += `</div></div>`;
  }
  return h;
}

/** 🚂 Your trains: one row per island with how many trains it has, Buy 1 and Sell 1; a page lists one island's trains. */
function fleetCard(g: Game, page?: string): string {
  const all = fleetByIsland(g), cap = trainCap(g), many = fleetIsls(g).length > 1;
  if (page) { // one island's trains, each a tap away
    const f = all.find(x => String(x.island) === page); if (!f) return fleetCard(g);
    let h = `<div class="head"><b class="big">🏝</b><div><h2>${esc(f.name)}</h2><span class="chip2">🚂 ${f.trains.length} train${f.trains.length === 1 ? '' : 's'}</span></div></div>`;
    for (const t of f.trains) {
      const held = (t.stopT ?? 0) >= JAM_AFTER, st = t.sellAfter ? '💰 sold: goes after this delivery' : t.ferry ? '⛴ going to the dock for its boat' : t.moveTo !== undefined ? '⛴ crosses to another island after this delivery' : held ? '🚦 held up' : t.cargo ? `🚚 carrying ${GOODS[t.cargo.good as Good]?.icon ?? ''}` : t.job ? '🚚 on its way to load' : '💤 waiting for work';
      h += `<div class="row${held ? ' alert' : ''}"><b class="ico">🚂</b><div class="grow"><div class="line"><span>Train ${t.id}</span><span>${st}</span></div><small>${trainStatus(g, t)}</small></div><button class="mini" data-act="open" data-kind="train" data-id="${t.id}">Open ›</button></div>`;
    }
    if (!f.trains.length) h += `<div class="note">No trains here yet.</div>`;
    return h + `<button class="act back" data-act="open" data-kind="fleet" data-id="0">‹ All islands</button>`;
  }
  let h = `<div class="head"><b class="big">🚂</b><div><h2>Your trains</h2><span class="chip2">🚂 ${g.s.trains.length}</span> ${many ? '' : `<span class="chip2">📦 ${cap} per load</span>`}</div></div>`;
  h += `<button class="act alt" data-act="open" data-kind="shed" data-id="0">🔧 Fleet upgrades ›<br><small>more wagons, faster engines${many ? ', bought for each island' : ', for every train'}</small></button>`;
  for (const f of all) {
    const idle = f.trains.filter(t => !t.job).length, held = f.trains.filter(t => (t.stopT ?? 0) >= JAM_AFTER).length, busy = f.trains.length - idle;
    const sell = trainToSell(g, f.island), v = trainRefund(g);
    h += `<div class="row isl"><b class="ico">${f.island < 0 ? '🌉' : f.island === g.world.home ? '🏠' : '🏝'}</b><div class="grow">`
      + `<div class="line"><span><b>${esc(f.name)}</b></span><span>🚂 ${f.trains.length} train${f.trains.length === 1 ? '' : 's'}</span></div>`
      + `<div class="chips">${many && f.island >= 0 ? `<span class="chip2">📦 ${trainCap(g, f.island)} per load</span> ` : ''}${busy ? `<span class="chip2 ok">🚚 ${busy} working</span> ` : ''}${idle ? `<span class="chip2">💤 ${idle} waiting</span> ` : ''}${held ? `<span class="chip2 bad">🚦 ${held} held up</span>` : ''}</div>`
      + `<div class="btns">`
      + (f.buyAt ? `<button class="mini buy" data-act="buyon" data-isl="${f.island}" ${g.s.money >= f.price ? '' : 'disabled'}>＋ Buy 1 · ${fmtMoney(f.price)}</button>` : `<small>Trains come by boat: build a dock or landing here</small>`)
      + (sell ? `<button class="mini sell" data-act="sellon" data-isl="${f.island}">💰 Sell 1 · +${fmtMoney(v)}</button>` : '')
      + (f.shipTo ? `<button class="mini" data-act="open" data-kind="bld" data-id="${f.shipTo.id}" data-page="trains">⛴ Ship one here</button>` : '')
      + (f.trains.length ? `<button class="mini" data-act="open" data-kind="fleet" data-id="0" data-page="${f.island}">📋 List ›</button>` : '')
      + (many && f.island >= 0 ? `<button class="mini" data-act="open" data-kind="shed" data-id="0" data-page="${f.island}">🔧 Upgrades ›</button>` : '')
      + `</div>${f.buyAt && f.buyAt !== 'shed' ? `<small>A new train leaves the engine shed, runs to the nearest dock and sails over (+${fmtMoney(FERRY_FEE)} crossing)${(() => { const k = (g.s.ferries ?? []).filter(x => railIsle(g, x.isl) === f.island).length + g.s.trains.filter(t => t.ferry && g.s.buildings?.find(d => d.id === t.ferry!.to && railIsleOfB(g, d) === f.island)).length; return k ? ` · ⛴ ${k} on the way` : ''; })()}</small>` : ''}</div></div>`;
  }
  h += `<small class="why">Trains run themselves: each takes the best waiting load where it is needed. Sell 1 sells a train with no work first; one carrying goods delivers them, then goes.</small>`;
  return h;
}

function shedCard(g: Game, page?: string): string {
  const isls = fleetIsls(g), isl = page !== undefined && isls.includes(+page) ? +page : g.world.home;
  let h = `<div class="head"><b class="big">🏚</b><div><h2>Engine shed</h2><span class="chip2">🚂 ${g.s.trains.length} train${g.s.trains.length === 1 ? '' : 's'}</span> <span class="chip2">📦 ${trainCap(g, isl)} per load${isls.length > 1 ? ` on ${esc(railIsleName(g, isl))}` : ''}</span></div></div>`;
  if (isls.length > 1) {
    h += `<h3>🔧 Upgrades for each island</h3><div class="btns">`;
    for (const k of isls) h += `<button class="mini${k === isl ? ' buy' : ''}" data-act="open" data-kind="shed" data-id="0" data-page="${k}">${k === g.world.home ? '🏠' : '🏝'} ${esc(railIsleName(g, k))}</button> `;
    h += `</div><div class="note">Trains on <b>${esc(railIsleName(g, isl))}</b> get these. Each island buys its own: trains can't take their wagons and engines across the sea (islands joined by a 🌉 bridge share them).</div>`;
  } else h += `<h3>🔧 Fleet upgrades (every train)</h3>`;
  for (const k of Object.keys(FLEET) as FleetKey[]) {
    const f = FLEET[k], l = fleetLvl(g, k, isl), p = f.price[l], top = p === undefined;
    h += `<div class="row"><b class="ico">${f.icon}</b><div class="grow"><div class="line"><span>${f.name}</span><span>${top ? 'Top level' : `Level ${l} → ${l + 1}`}</span></div>${bar(l / f.price.length, '#5cc46a')}<small>Now: ${f.text(l)}${top ? '' : ` · next: ${f.text(l + 1)}`}</small>`;
    if (!top) h += `<button class="mini" data-act="fleet" data-k="${k}" data-isl="${isl}" ${g.s.money >= p ? '' : 'disabled'}>⬆ ${fmtMoney(p)}</button>`;
    h += `</div></div>`;
  }
  h += `<small class="why">Buy trains with 🚂 Train. ${isls.length > 1 ? 'Upgrades apply to every train on this island.' : 'Upgrades apply to the whole fleet at once. New islands start with plain trains and buy their own.'}</small>`;
  // where the trains are: trains never cross the sea by themselves, so a busy island can be short while another has spares
  const per = new Map<number, Train[]>();
  for (const t of g.s.trains) { const k = islandOfTrain(g, t); per.set(k, [...(per.get(k) ?? []), t]); }
  if (per.size > 1 || [...per.keys()].some(k => k !== g.world.home)) {
    h += `<h3>🏝 Your trains by island</h3>`;
    for (const [k, ts] of [...per].sort((a, b) => +(b[0] === g.world.home) - +(a[0] === g.world.home) || b[1].length - a[1].length)) {
      const idle = ts.filter(t => !t.job).length, held = ts.filter(t => (t.stopT ?? 0) >= JAM_AFTER).length, busy = ts.length - idle;
      const work = (g.s.buildings ?? []).filter(b => !isDock(b) && isLinked(g, b) && railIsleOfB(g, b) === k).length;
      const spare = idle >= 3 && idle > work;
      const dock = spare ? (g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b) && railIsleOfB(g, b) !== k).sort((a, b) => +(islandOfB(g, b) === g.world.home) - +(islandOfB(g, a) === g.world.home))[0] : undefined;
      h += `<div class="row${spare ? ' alert' : ''}"><b class="ico">${k < 0 ? '🌉' : '🏝'}</b><div class="grow"><div class="line"><span>${esc(railIsleName(g, k))}</span><span>🚂 ${ts.length}</span></div>`
        + `<div class="chips"><span class="chip2 ok">🚚 ${busy} working</span>${idle ? ` <span class="chip2">💤 ${idle} waiting</span>` : ''}${held ? ` <span class="chip2 bad">🚦 ${held} held up</span>` : ''}</div>`
        + (spare ? `<small>More trains than work here: ship some where they're needed</small>` : '') + `</div>`
        + (dock ? `<button class="mini" data-act="open" data-kind="bld" data-id="${dock.id}" data-page="trains">⛴ Ship ›</button>` : '') + `</div>`;
    }
  }
  { const nb = bridgeSquares(g); if (nb) h += `<div class="note">🌉 ${nb} bridge square${nb === 1 ? "" : "s"} on your railway: ${fmtMoney(nb * BRIDGE_UPKEEP)} a minute to keep up${g.s.money > 0 ? '' : ' (paused while you have no money)'}</div>`; }
  return h;
}

function trainCard(g: Game, t: Train): string {
  let h = `<div class="head"><b class="big">🚂</b><div><h2>Train ${t.id}</h2><span class="chip2">Carries ${trainCapOf(g, t)}</span></div></div>`;
  if (t.broke && g.s.t < t.broke.doneAt) { const c = Math.ceil(t.broke.crewAt - g.s.t); h += `<div class="warn">🔧 Broken down: ${c > 0 ? `the repair crew arrives in ${c} s` : `the crew is fixing it, ${Math.ceil(t.broke.doneAt - g.s.t)} s left`}. Trains behind it wait.</div>`; }
  h += `<div class="note big2">${trainStatus(g, t)}</div>`;
  if (t.lastPay) { h += `<div class="row"><b class="ico">💰</b><div class="grow">Last delivery: ${t.lastPay.n} ${GOODS[t.lastPay.good as Good]?.icon ?? ''} to ${esc(destName(g, t.lastPay.to))} paid <b>${fmtMoney(t.lastPay.pay)}</b></div></div>`; }
  h += `<small class="why">Trains run themselves: each one takes the best waiting load to the place that needs it.</small>`;
  h += t.sellAfter ? `<div class="note">💰 Sold: it goes as soon as it has delivered its load (+${fmtMoney(trainRefund(g))})</div>`
    : `<button class="act alt" data-act="selltrain" data-id="${t.id}">💰 Sell this train · +${fmtMoney(trainRefund(g))}<br><small>half its price back${t.cargo ? ' · it delivers its load first' : ''}</small></button>`;
  return h;
}

/** 🗺 Area map button: opens Map mode with the circle here (the player can move it before buying). */
function mapBtn(g: Game, x: number, y: number, r: number): string {
  const c = mapCost(g);
  return `<button class="act alt" data-act="areamap" data-x="${x}" data-y="${y}" ${g.s.money >= c ? '' : 'disabled'}>🗺 Map of the area · ${fmtMoney(c)}<br><small>marks hidden towns and landmarks in the fog within ${r} squares</small></button>`;
}

/** A landmark just spotted in the fog: how rare it is, what it gives, and a button to see it. */
function findCard(g: Game, id: number, more: number): string | null {
  const p = poisOf(g).find(x => x.id === id); if (!p) return null;
  const P = POI[p.kind], R = RARITY[POI_RARITY[p.kind]], isl = g.world.islandOf[p.y * g.world.n + p.x];
  let h = `<div class="find"><span class="rar" style="border-color:${R.col};color:${R.col}">${R.icon} ${R.name.toUpperCase()}</span><small>Spotted in the fog</small>`;
  h += `<b class="fbig">${P.icon}</b><h2>${esc(P.name)}</h2>${isl !== undefined && isl >= 0 ? `<small>on ${esc(islandName(g, isl))}</small>` : ''}</div>`;
  h += `<div class="gift">🎁 ${p.kind === 'wreck' ? 'A ship or scout boat passing by salvages it' : `Lay track into the dashed square around it (2 squares out, corners count too) to take it over: ${P.perk}`}</div>`;
  if (more) h += `<div class="note">✨ ${more} more landmark${more > 1 ? 's' : ''} spotted too: look for them on the map</div>`;
  h += `<button class="act" data-act="lookpoi" data-id="${p.id}">📍 Show me on the map</button>`;
  return h;
}
