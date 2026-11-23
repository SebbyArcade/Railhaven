import type { Game, Site } from '../state.ts';
import { GOODS, INDUSTRIES, type IndustryKind } from '../buildings/industries.ts';
import { townLinked } from '../economy/towns.ts';
import { compass, reachedIslands } from '../progress/missions.ts';
import { islandName } from '../ships/docks.ts';
import { isRevealed } from '../world/fog.ts';
import { islandSpec, SPEC_TEXT } from '../world/specialty.ts';
import { POI, poisOf, toldIslands, type Poi, type ScoutReport } from '../world/explore.ts';
import { fmtMoney } from './hud.ts';
import { islandGoalsHtml } from './atlas.ts';

/**
 * 🧭 Scout reports and 🏝 island arrival cards: what a scout saw on its trip (with how far each town is from your
 * railway), and what is known about an island your railway just reached.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const look = (x: number, y: number, label = '📍', cls = 'mini') => `<button class="${cls}" data-act="lookxy" data-x="${x}" data-y="${y}">${label}</button>`;
const DEP: Record<string, string> = { stone: 'rock outcrop', coal: 'coal seam', iron: 'iron deposit', oil: 'oil seep', gold: 'gold seam', gems: 'gem vein', cocoa: 'cocoa grove', rubber: 'rubber grove', wood: 'forest', farm: 'farmland' };
const depName = (r: string, k: number) => DEP[r] ? DEP[r] + (k > 1 ? (DEP[r]!.endsWith('s') ? '' : 's') : '') : r;
const icon = (r: string) => (GOODS as Record<string, { icon: string }>)[r]?.icon ?? '⛏';
const islOf = (g: Game, o: { x: number; y: number }) => g.world.islandOf[o.y * g.world.n + o.x]!;

/** Deposits as chips: "🪨 2 rock outcrops". */
function depChips(deps: Site[]): string {
  const by = new Map<string, number>(); for (const d of deps) by.set(d.res!, (by.get(d.res!) ?? 0) + 1);
  return `<div class="chips">${[...by].map(([r, k]) => `<span class="chip2">${icon(r)} ${k} ${depName(r, k)}</span>`).join(' ')}</div>`;
}

/** A row for a landmark: its icon, name and what it gives, and where it is. */
const poiRow = (p: Poi) => `<div class="row"><b class="ico">${POI[p.kind].icon}</b><div class="grow"><div class="line"><span>${esc(POI[p.kind].name)}${p.got ? ' · ✅ yours' : ''}</span></div><small>${p.kind === 'wreck' ? 'A ship or scout boat passing by salvages it' : esc(POI[p.kind].perk)}</small></div>${look(p.x, p.y)}</div>`;

/** The one thing to do next, from a report: the cheapest town to link, else a landmark, else an island, else a map. */
function nextStep(g: Game, r: ScoutReport, towns: Site[], pois: Poi[]): string {
  const near = towns.filter(t => !townLinked(g, t) && r.link?.[t.id]).sort((a, b) => r.link![a.id]!.cost - r.link![b.id]!.cost)[0];
  if (near) { const e = r.link![near.id]!; return `🛤 Lay track to ${esc(near.name ?? 'the town')}: about ${e.sq} squares, ${fmtMoney(e.cost)} from your nearest line`; }
  const far = towns.find(t => !townLinked(g, t));
  if (far) return reachedIslands(g).has(islOf(g, far)) ? `🌫 ${esc(far.name ?? 'The town')} is behind fog, mountains or water from your line: scout the land between, or go round` : `⚓ ${esc(far.name ?? 'The town')} is across the sea: build a ⚓ Dock within reach and a landing on its island`;
  const p = pois.find(q => !q.got && q.kind !== 'wreck');
  if (p) return `${POI[p.kind].icon} Bring track into the dashed square around the ${esc(POI[p.kind].name.toLowerCase())} to take it over`;
  const isl = r.isl.find(k => !reachedIslands(g).has(k));
  if (isl !== undefined) return `🏝 New shores: build a ⚓ Dock that reaches ${esc(islandName(g, isl))}`;
  return '🗺 Nothing new this way. An area map from a town or dock on your railway marks what hides in the fog with a ?, so the next scout knows where to go';
}

/** 🧭 A scout's report: where it went, what it found, and the next step. */
export function scoutCard(g: Game, id: number): string | null {
  const r = (g.s.reports ?? []).find(x => x.id === id); if (!r) return null;
  const n = g.world.n, sx = r.start % n, sy = (r.start / n) | 0, ex = r.end % n, ey = (r.end / n) | 0;
  const way = r.steps ? compass(ex - sx, ey - sy) : '';
  const sites = r.sites.map(i => g.s.sites.find(s => s.id === i)).filter((s): s is Site => !!s);
  const towns = sites.filter(s => s.kind === 'town'), plots = sites.filter(s => s.kind === 'plot'), deps = sites.filter(s => s.kind === 'dep' && !s.hidden);
  const pois = r.pois.map(i => poisOf(g).find(p => p.id === i)).filter((p): p is Poi => !!p);
  const total = towns.length + plots.length + deps.length + pois.length + r.isl.length;
  let h = `<div class="find"><span class="rar" style="border-color:#e8a33c;color:#ffc46a">🧭 SCOUT REPORT</span><small>minute ${r.min}</small>`;
  h += `<b class="fbig">${r.boat ? '⛵' : '🚶'}</b><h2>${r.boat ? 'The boat' : 'The scout'} is back</h2><small>${r.steps} squares${way ? ` ${way}` : ''} from ${esc(r.from)}</small></div>`;
  if (r.back) h += `<div class="note">↩ Met ${r.boat ? 'land' : 'water'} under the fog and turned back early: ${fmtMoney(r.back)} paid back</div>`;
  h += `<div class="chips" style="justify-content:center">${[
    towns.length && `🏘 ${towns.length} town${towns.length > 1 ? 's' : ''}`, plots.length && `🚩 ${plots.length} site${plots.length > 1 ? 's' : ''}`,
    deps.length && `⛏ ${deps.length} deposit${deps.length > 1 ? 's' : ''}`, pois.length && `🗝 ${pois.length} landmark${pois.length > 1 ? 's' : ''}`, r.isl.length && `🏝 ${r.isl.length} island${r.isl.length > 1 ? 's' : ''}`,
  ].filter(Boolean).map(t => `<span class="chip2">${t}</span>`).join(' ') || '<span class="chip2">🌾 Open country, nothing new</span>'}</div>`;
  if (towns.length) {
    h += `<h3>🏘 Towns</h3>`;
    for (const t of towns) {
      const e = r.link?.[t.id], on = townLinked(g, t), isl = islOf(g, t);
      const say = on ? '✅ On your railway now' : e ? `📏 About ${e.sq} squares of track from your line · ${fmtMoney(e.cost)}` : reachedIslands(g).has(isl) ? '🌫 No clear way yet from your line (fog, mountains or deep water between)' : `⚓ On ${esc(islandName(g, isl))}, across the sea`;
      h += `<div class="row${on ? ' ok' : ''}"><b class="ico">🏘</b><div class="grow"><div class="line"><span>${esc(t.name ?? 'Town')}</span></div><small>${say}</small></div>${look(t.x, t.y)}</div>`;
    }
  }
  if (plots.length) { h += `<h3>🚩 Settlement sites</h3>`; for (const p of plots) h += `<div class="row"><b class="ico">🚩</b><div class="grow"><div class="line"><span>${esc(p.name ?? 'Open land')}</span></div><small>Open land where you can found a new town</small></div>${look(p.x, p.y)}</div>`; }
  if (deps.length) h += `<h3>⛏ Deposits</h3>${depChips(deps)}`;
  if (sites.some(s => s.kind === 'dep' && s.hidden)) h += `<div class="note">🔎 The ${r.boat ? 'crew' : 'scout'} saw signs of ore in the hills: a landing crew on that island can survey it</div>`;
  if (pois.length) { h += `<h3>🗝 Landmarks</h3>`; for (const p of pois) h += poiRow(p); }
  if (r.isl.length) {
    const reached = reachedIslands(g);
    h += `<h3>🏝 Shores sighted</h3>`;
    for (const k of r.isl) { const isl = g.world.islands[k]!; h += `<div class="row${reached.has(k) ? ' ok' : ''}"><b class="ico">🏝</b><div class="grow"><div class="line"><span>${esc(islandName(g, k))}</span></div><small>${reached.has(k) ? '⚓ Your railway reaches it' : k === g.world.home ? 'Your home island' : 'Not reached yet: a ⚓ Dock with the reach can land there'}</small></div>${look(isl.cx, isl.cy)}</div>`; }
  }
  if (!total) h += `<div class="note">🌾 Only open country this way: no towns, deposits or landmarks.</div>`;
  h += `<div class="gift">💡 ${nextStep(g, r, towns, pois)}</div>`;
  h += `<div class="pair">${look(ex, ey, '📍 Where it went', 'act')}<button class="act alt" data-act="reports">📜 All reports</button></div>`;
  return h;
}

/** 📜 The journal of scout reports, newest first. */
export function reportsHtml(g: Game): string {
  const list = [...(g.s.reports ?? [])].reverse();
  let h = `<div class="head"><b class="big">🧭</b><div><h2>Scout reports</h2><span class="chip2">${list.length} kept</span></div></div>`;
  if (!list.length) return h + `<div class="note">🔭 Send a scout from a town or dock on your railway (Explore → 🔭 Scout): when it is back, its report is written here.</div>`;
  for (const r of list) {
    const n = g.world.n, way = r.steps ? compass(r.end % n - r.start % n, ((r.end / n) | 0) - ((r.start / n) | 0)) : '';
    const towns = r.sites.filter(i => g.s.sites.find(s => s.id === i)?.kind === 'town').length, k = r.sites.length + r.pois.length + r.isl.length;
    h += `<div class="row"><b class="ico">${r.boat ? '⛵' : '🚶'}</b><div class="grow"><div class="line"><span>${r.steps} squares${way ? ' ' + way : ''} from ${esc(r.from)}</span><span>min ${r.min}</span></div><small>${k ? `${towns ? `🏘 ${towns} town${towns > 1 ? 's' : ''} · ` : ''}${k} find${k > 1 ? 's' : ''}` : 'Nothing new'}</small></div><button class="mini" data-act="report" data-id="${r.id}">Read ›</button></div>`;
  }
  return h;
}

/** 🏝 An island your railway reaches: its specialty, towns, deposits and landmarks known, and what still hides there. */
export function isleCard(g: Game, k: number, fresh: boolean): string | null {
  const isl = g.world.islands[k]; if (!isl?.name) return null;
  const n = g.world.n, on = (o: { x: number; y: number }) => islOf(g, o) === k, seen = (o: { x: number; y: number }) => isRevealed(g, o.y * n + o.x);
  const sp = islandSpec(g, k), told = toldIslands(g).has(k);
  const towns = g.s.sites.filter(s => s.kind === 'town' && on(s)), plots = g.s.sites.filter(s => s.kind === 'plot' && on(s));
  const deps = g.s.sites.filter(s => s.kind === 'dep' && on(s) && seen(s) && !s.hidden);
  const pois = poisOf(g).filter(p => p.kind !== 'wreck' && on(p)), known = pois.filter(p => p.seen), hidPois = pois.length - known.length;
  const hidTowns = towns.filter(t => !seen(t)).length + plots.filter(p => !seen(p)).length;
  let h = `<div class="find"><span class="rar" style="border-color:#5cc46a;color:#8fe39a">${fresh ? '🏝 NEW ISLAND REACHED' : '🏝 ISLAND'}</span><b class="fbig">🏝</b><h2>${esc(isl.name)}</h2>${sp ? `<small>${SPEC_TEXT[sp]}: ${sp === 'fish' ? 'fishing boats from its docks catch' : `${esc(INDUSTRIES[sp as IndustryKind]?.name ?? 'its industries')}s here make`} 50% more</small>` : `<small>${isl.size} squares of land</small>`}</div>`;
  if (fresh) h += `<div class="mira">Mira: “${esc(isl.name)}! The islanders have heard of your railway. ${hidTowns + hidPois ? 'They talk of places in the fog nobody has mapped yet.' : 'They’ll be glad of the trade.'}”</div>`;
  h += islandGoalsHtml(g, k);
  h += `<h3>🏘 Towns</h3>`;
  const vis = towns.filter(seen);
  for (const t of vis) h += `<div class="row${townLinked(g, t) ? ' ok' : ''}"><b class="ico">🏘</b><div class="grow"><div class="line"><span>${esc(t.name ?? 'Town')}</span></div><small>${townLinked(g, t) ? '✅ On your railway' : '🛤 Lay track to it'}</small></div>${look(t.x, t.y)}</div>`;
  for (const p of plots.filter(seen)) h += `<div class="row"><b class="ico">🚩</b><div class="grow"><div class="line"><span>${esc(p.name ?? 'Open land')}</span></div><small>A settlement site: found a town here</small></div>${look(p.x, p.y)}</div>`;
  if (!vis.length && !plots.some(seen)) h += `<div class="note">🌫 No town seen yet</div>`;
  if (hidTowns) h += `<div class="note">🌫 ${hidTowns} more town${hidTowns > 1 ? 's' : ''} or site${hidTowns > 1 ? 's' : ''} still in the fog${told ? ' (marked with a ? from the explorer’s notes)' : ': 🔭 scout from a town here'}</div>`;
  if (deps.length) h += `<h3>⛏ Deposits found</h3>${depChips(deps)}`;
  h += `<h3>🗝 Landmarks</h3>`;
  for (const p of known) h += poiRow(p);
  if (!known.length) h += `<div class="note">None found yet</div>`;
  if (hidPois) h += `<div class="note">✨ Islanders talk of ${hidPois} more landmark${hidPois > 1 ? 's' : ''} in the fog${pois.some(p => p.kind === 'camp' && !p.seen) ? ', an old explorer’s camp among them: its notes would mark everything still hidden here' : ''}</div>`;
  h += `<div class="pair">${look(isl.cx, isl.cy, '📍 Show the island', 'act')}<button class="act alt" data-act="close">${fresh ? '🚂 Let’s explore' : 'Close'}</button></div>`;
  return h;
}
