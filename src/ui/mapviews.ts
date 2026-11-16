import type { Game } from '../state.ts';
import { aName, capOf, footprint, GOODS, type Good, INDUSTRIES, inputsOf, isFactory, isLinked, outputOf } from '../buildings/industries.ts';
import { factoryState } from '../economy/production.ts';
import { orderDone, orderOf, sizeName, stepOf, townLinked } from '../economy/towns.ts';
import { isRevealed } from '../world/fog.ts';
import { poisOf, POI } from '../world/explore.ts';
import { reachedIslands, rumourOf } from '../progress/missions.ts';
import { placeName, stuckList } from './orders.ts';
export { placeName };

/** The map views: each dims the map and labels what matters. */
export type MapView = 'prob' | 'dem' | 'res' | 'exp';
export const VIEWS: { k: MapView; b: string; d: string }[] = [
  { k: 'prob', b: '⚠ Problems', d: 'What is stuck and why. Tap the place to fix it.' },
  { k: 'dem', b: '📦 Demand', d: 'What each town still needs for its next size.' },
  { k: 'res', b: '⛏ Resources', d: 'Every building with its stock, and the deposits you have found.' },
  { k: 'exp', b: '🧭 Exploration', d: 'The edge of the fog, landmarks to reach, islands not reached yet.' },
];

/** One label on a map view, at a square (x, y). A bar shows a stock filling up. */
export interface Mark { x: number; y: number; icon: string; text: string; col: string; bar?: number; big?: boolean; low?: boolean; short?: string }

const lc = (k: Good) => GOODS[k].name.toLowerCase();
const seen = (g: Game, x: number, y: number) => !!isRevealed(g, y * g.world.n + x);
const C = { bad: '#ff8a70', warn: '#ffc08a', ok: '#a8f0a0', gold: '#ffd27a', pale: '#ffe9b8', dep: '#c9b6ff', sea: '#8fd0ff' };

export function viewMarks(g: Game, v: MapView): Mark[] {
  const out: Mark[] = [], n = g.world.n;
  if (v === 'prob') {
    for (const s of stuckList(g)) out.push({ x: s.x, y: s.y, icon: s.icon, text: s.text.replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c)), col: s.icon === '⬆' ? C.ok : C.bad });
    for (const t of g.s.trains) if (t.job && t.wait > 12 && t.v < 1) { // stuck in a queue for a while
      const c = t.trail.at(-1)!, p = g.net.pieces[c.piece]!.squares[0]!;
      out.push({ x: p % n, y: (p / n) | 0, icon: '🚦', text: `Train ${t.id} waits for the way to clear: a second track or a passing place helps`, col: C.warn });
    }
    // where trains keep turning back partway (the last 5 minutes): a missing curve or a loop would let them run on
    for (const [sq, r] of revMarks(g)) out.push({ x: sq % n, y: (sq / n) | 0, icon: '⤺', text: `Trains turn back here (${r.n}× lately): a curve the other way or a loop lets them keep going engine-first`, col: C.warn });
    return out;
  }
  if (v === 'dem') {
    for (const t of g.s.sites) {
      if (t.kind !== 'town' || !townLinked(g, t)) continue;
      out.push({ x: t.x, y: t.y, icon: '🏘', text: `${t.name ?? 'Town'} · ${sizeName(stepOf(t))}`, col: C.gold, big: true });
      if (orderDone(g, t)) { out.push({ x: t.x, y: t.y, icon: '⬆', text: 'Order filled: tap the town to grow it', col: C.ok }); continue; }
      const o = orderOf(g, t), left = (Object.keys(o) as Good[]).filter(k => (t.got?.[k] ?? 0) < o[k]!);
      out.push({ x: t.x, y: t.y, icon: '📦', text: left.map(k => `${GOODS[k].icon} ${Math.ceil(o[k]! - (t.got?.[k] ?? 0))} ${lc(k)}`).join(' · '), col: C.pale });
    }
    return out;
  }
  if (v === 'res') {
    for (const b of g.s.buildings ?? []) {
      if (!seen(g, b.x, b.y)) continue;
      if (b.kind === 'dock') { if (b.fish) { const l = b.landed ?? {}; const t = Math.floor((l.fish ?? 0) + (l.shellfish ?? 0)); out.push({ x: b.x, y: b.y, icon: '🎣', text: `Catch ${t}/${capOf(b)}`, col: C.sea, bar: t / capOf(b) }); } continue; }
      const k = INDUSTRIES[b.kind].makes, st = Math.floor(b.stock), cap = capOf(b);
      if (!isLinked(g, b)) { out.push({ x: b.x, y: b.y, icon: '🔌', text: `${INDUSTRIES[b.kind].name}: not on the railway`, col: C.bad }); continue; }
      if (isFactory(b.kind)) {
        const f = factoryState(g, b), ins = inputsOf(b.kind).map(i => `${GOODS[i].icon} ${Math.floor(b.inbuf?.[i] ?? 0)}`).join(' ');
        out.push({ x: b.x, y: b.y, icon: f.busy ? '🏭' : '⏳', text: `${ins} → ${GOODS[k].icon} ${st}/${cap}${f.busy ? '' : f.waits.length ? ' · waiting' : ' · full'}`, col: f.busy ? C.ok : C.warn, bar: st / cap, short: `${GOODS[k].icon} ${st}/${cap}` });
      } else out.push({ x: b.x, y: b.y, icon: GOODS[k].icon, text: `${st}/${cap} · +${Math.round(outputOf(g, b) * 60)}/min`, col: st >= cap ? C.gold : C.ok, bar: st / cap, short: `+${Math.round(outputOf(g, b) * 60)}/min` });
    }
    // a deposit with a building on it is in use: only the building shows
    const usedDep = new Set<number>(), usedSq = new Set<number>();
    for (const b of g.s.buildings ?? []) { if (b.dep !== undefined) usedDep.add(b.dep); for (const q of footprint(n, b)) usedSq.add(q); }
    for (const d of g.s.sites) {
      if (d.kind !== 'dep' || d.hidden || !seen(g, d.x, d.y) || usedDep.has(d.id) || usedSq.has(d.y * n + d.x)) continue;
      const kind = (d.res ?? 'stone') as keyof typeof INDUSTRIES, I = INDUSTRIES[kind];
      if (!I) continue;
      out.push({ x: d.x, y: d.y, icon: GOODS[I.makes].icon, text: `${GOODS[I.makes].name}${d.rich ? ' ★ rich' : ''}: build ${aName(I.name)} here`, col: C.dep, low: true });
    }
    return out;
  }
  // exploration
  for (const p of poisOf(g)) if (p.seen && !p.got && seen(g, p.x, p.y)) out.push({ x: p.x, y: p.y, icon: POI[p.kind].icon, text: `${POI[p.kind].name}: ${p.kind === 'wreck' ? 'send a ship or scout boat' : 'bring track next to it'}`, col: C.gold });
  for (const s of g.s.sites) if (s.kind === 'plot' && !s.hidden && seen(g, s.x, s.y)) out.push({ x: s.x, y: s.y, icon: '🚩', text: 'Open land: found a town here', col: C.ok });
  for (const s of g.s.sites) if (s.kind === 'town' && (s.pop ?? 0) > 0 && seen(g, s.x, s.y) && !townLinked(g, s)) out.push({ x: s.x, y: s.y, icon: '🏘', text: `${s.name ?? 'A town'}: not on your railway yet`, col: C.pale });
  const reached = reachedIslands(g);
  g.world.islands.forEach((isl, j) => {
    if (!isl.name || reached.has(j) || !seen(g, isl.cx, isl.cy)) return;
    out.push({ x: isl.cx, y: isl.cy, icon: '🏝', text: `${isl.name}: not reached · ${rumourOf(g, j)}`, col: '#ffd24a', big: true });
  });
  return out;
}

/** Explored squares that touch the fog, in the window (for the fog edge line). */
export function fogEdges(g: Game, x0: number, y0: number, x1: number, y1: number): number[] {
  const n = g.world.n, out: number[] = [];
  for (let y = Math.max(1, y0); y <= Math.min(n - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(n - 2, x1); x++) {
    const i = y * n + x; if (!isRevealed(g, i)) continue;
    if (!isRevealed(g, i + 1) || !isRevealed(g, i - 1) || !isRevealed(g, i + n) || !isRevealed(g, i - n)) out.push(i);
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** The 👁 Map card: the views, then 📍 Go to any town, dock, factory or industry by name. */
export function mapHtml(g: Game, view: MapView | null): string {
  const chip = (k: MapView | '', b: string) => `<button class="vchip${(view ?? '') === k ? ' on' : ''}" data-act="view" data-v="${k}">${b}</button>`;
  let h = `<div class="head"><b class="big">👁</b><div><h2>Map</h2><small>Show on the map</small></div></div>`;
  h += `<div class="vchips">${chip('', '🗺 Normal')}${VIEWS.map(v => chip(v.k, v.b)).join('')}</div>`;
  h += `<h3>📍 Go to</h3><input id="mapQ" placeholder="Search a name or island…" autocomplete="off">`;
  const n = g.world.n, isl = (x: number, y: number) => { const j = g.world.islandOf[y * n + x]!; return g.world.islands[j]?.name ?? ''; };
  const rows: Record<string, { label: string; isl: string; kind: string; id: number }[]> = { '🏘 Towns': [], '⚓ Docks': [], '🏭 Factories': [], '⛏ Industries': [] };
  for (const t of g.s.sites) if (t.kind === 'town' && (t.pop ?? 0) > 0 && seen(g, t.x, t.y)) rows['🏘 Towns']!.push({ label: `${t === g.s.sites[0] ? '👑' : '🏘'} ${t.name ?? 'Town'}`, isl: isl(t.x, t.y), kind: 'town', id: t.id });
  for (const b of g.s.buildings ?? []) {
    const grp = b.kind === 'dock' ? '⚓ Docks' : isFactory(b.kind) ? '🏭 Factories' : '⛏ Industries';
    rows[grp]!.push({ label: `${INDUSTRIES[b.kind].icon} ${placeName(g, b)}`, isl: isl(b.x, b.y), kind: 'bld', id: b.id });
  }
  for (const [head, r] of Object.entries(rows)) {
    if (!r.length) continue;
    r.sort((a, b) => a.label.localeCompare(b.label));
    h += `<div class="ggrp"><div class="ghead">${head} <span>${r.length}</span></div>`;
    for (const x of r) h += `<button class="goto" data-act="open" data-kind="${x.kind}" data-id="${x.id}" data-q="${esc((x.label + ' ' + x.isl).toLowerCase())}">${esc(x.label)} <span>· ${esc(x.isl)}</span></button>`;
    h += `</div>`;
  }
  return h;
}

/** Squares where trains reversed partway at least 3 times in the last 5 game minutes, busiest first, nearby ones merged. */
export function revMarks(g: Game): [number, { n: number; at: number }][] {
  const n = g.world.n, out: [number, { n: number; at: number }][] = [];
  for (const [sq, r] of g.revs ?? []) if (g.s.t - r.at > 300) g.revs!.delete(sq);
  const list = [...(g.revs ?? [])].filter(([, r]) => r.n >= 3).sort((a, b) => b[1].n - a[1].n);
  for (const [sq, r] of list) {
    const near = out.find(([q]) => Math.abs(q % n - sq % n) <= 2 && Math.abs(((q / n) | 0) - ((sq / n) | 0)) <= 2);
    if (near) near[1] = { n: near[1].n + r.n, at: Math.max(near[1].at, r.at) }; else out.push([sq, { ...r }]);
  }
  return out.slice(0, 12);
}
