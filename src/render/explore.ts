import { FAR_ZOOM } from './buildings.ts';
import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { isRevealed } from '../world/fog.ts';
import type { Tools } from '../ui/tools.ts';
import { CLAIM_R, poisOf, POI, POI_REACH, type Poi, scoutPlace, scoutStarts } from '../world/explore.ts';
import { drawLandmark } from './landmarks.ts';
import { rumours } from '../world/maps.ts';
import { crewSpots } from '../world/landfall.ts';

/** Landmarks and wrecks that are out of the fog, scouts on their way, and in Scout mode the start rings and the route. */
export function drawExplore(ctx: CanvasRenderingContext2D, g: Game, _t: Tools | undefined, tm: number, vis: (x: number, y: number) => boolean, z: number) {
  const n = g.world.n;
  for (const p of poisOf(g)) if (p.seen && !(p.kind === 'wreck' && p.got) && vis(p.x, p.y) && isRevealed(g, p.y * n + p.x)) drawPoi(ctx, p, tm, z);
}

/** Over the fog (so the fog never hides them): each landmark's take-over square, and the reach of the one just tapped. */
export function drawPoiZones(ctx: CanvasRenderingContext2D, g: Game, t: Tools | undefined, tm: number, vis: (x: number, y: number) => boolean, z: number) {
  const sel = t?.poiSel && performance.now() < t.poiSel.until ? t.poiSel.id : -1;
  for (const p of poisOf(g)) if (p.seen && !(p.kind === 'wreck' && p.got) && vis(p.x, p.y)) {
    if (!p.got && p.kind !== 'wreck' && z >= 0.7) drawClaimZone(ctx, p, tm, z);
    if (p.id === sel) drawReach(ctx, p, z);
  }
}

/** Not yet yours: the dashed square that track must enter to take it over (CLAIM_R squares out, corners included). */
function drawClaimZone(ctx: CanvasRenderingContext2D, p: Poi, tm: number, z: number) {
  const x0 = (p.x - CLAIM_R) * TILE, y0 = (p.y - CLAIM_R) * TILE, w = (2 * CLAIM_R + 1) * TILE, k = 1 / Math.max(0.7, z);
  ctx.fillStyle = 'rgba(255,214,110,.10)'; ctx.fillRect(x0, y0, w, w);
  ctx.strokeStyle = `rgba(255,214,110,${0.7 + 0.25 * Math.sin(tm * 3)})`; ctx.lineWidth = 2 * k; ctx.setLineDash([6 * k, 4 * k]);
  ctx.strokeRect(x0, y0, w, w); ctx.setLineDash([]);
  if (z < 1) return;
  const text = '🛤 Track in here takes it over';
  ctx.save(); ctx.translate(x0 + w / 2, y0 + w); ctx.scale(k, k);
  ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(40,30,18,.85)'; ctx.beginPath(); ctx.roundRect(-tw / 2, 4, tw, 17, 8); ctx.fill();
  ctx.fillStyle = '#ffd27a'; ctx.fillText(text, 0, 12.5);
  ctx.restore();
}

/** Just tapped: how far its gift reaches, as a green circle with a note. */
function drawReach(ctx: CanvasRenderingContext2D, p: Poi, z: number) {
  const r = POI_REACH[p.kind]; if (!r) return;
  const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE, R = (r + 0.5) * TILE, k = 1 / Math.max(0.4, z);
  ctx.fillStyle = 'rgba(120,210,110,.12)'; ctx.beginPath(); ctx.arc(X, Y, R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(140,230,120,.9)'; ctx.lineWidth = 2 * k; ctx.setLineDash([8 * k, 5 * k]); ctx.stroke(); ctx.setLineDash([]);
  const text = `${POI[p.kind].icon} ${POI[p.kind].perk}`;
  ctx.save(); ctx.translate(X, Y + R); ctx.scale(k, k); // the note sits at the bottom of the circle
  ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width + 12;
  ctx.fillStyle = 'rgba(24,52,22,.9)'; ctx.beginPath(); ctx.roundRect(-tw / 2, -9, tw, 18, 8); ctx.fill();
  ctx.fillStyle = '#d8ffc8'; ctx.fillText(text, 0, 0.5);
  ctx.restore();
}

/** Scouts on their way and the route being drawn: over the fog, since that is where they go. */
export function drawScouting(ctx: CanvasRenderingContext2D, g: Game, t: Tools | undefined, tm: number, z: number) {
  const n = g.world.n;
  for (const s of g.s.scouts ?? []) {
    // the route still ahead, dotted, and the walker or boat
    ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath();
    s.path.forEach((i, k) => { if (k < Math.floor(s.pos)) return; const X = (i % n + 0.5) * TILE, Y = (((i / n) | 0) + 0.5) * TILE; if (k === Math.floor(s.pos)) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
    ctx.stroke(); ctx.setLineDash([]);
    const p = scoutPlace(g, s), X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
    marker(ctx, X, Y, s.boat ? '⛵' : '🚶', s.boat ? '#2f6f9a' : '#c07a2a', z);
  }
  // 🏕 landing crews mapping an island: their camp where they came ashore and walkers on the edge of the mapped land
  for (const s of g.s.sweeps ?? []) {
    marker(ctx, (s.x + 0.5) * TILE, (s.y + 0.5) * TILE, '🏕', '#3c7a3a', z);
    for (const p of crewSpots(g, s)) marker(ctx, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE, '🚶', '#c07a2a', z);
  }
  if (t?.mode !== 'scout') return;
  const pulse = 0.5 + 0.5 * Math.sin(tm * 4);
  if (!t.scout) for (const s of scoutStarts(g)) {
    const X = (s.sq % n + 0.5) * TILE, Y = (((s.sq / n) | 0) + 0.5) * TILE;
    ctx.strokeStyle = s.boat ? `rgba(90,170,255,${0.6 + 0.4 * pulse})` : `rgba(255,170,60,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 3 / Math.max(0.6, z);
    ctx.beginPath(); ctx.arc(X, Y, TILE * 1.2, 0, 7); ctx.stroke();
    marker(ctx, X, Y - TILE * 1.2, s.boat ? '⛵' : '🚶', s.boat ? '#2f6f9a' : '#c07a2a', z);
  }
  if (t.scout) {
    const path = t.scout.path;
    ctx.strokeStyle = t.scout.boat ? 'rgba(120,200,255,.95)' : 'rgba(255,190,90,.95)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([6, 5]);
    ctx.beginPath(); path.forEach((i, k) => { const X = (i % n + 0.5) * TILE, Y = (((i / n) | 0) + 0.5) * TILE; if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); ctx.setLineDash([]);
    const e = path.at(-1)!; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc((e % n + 0.5) * TILE, (((e / n) | 0) + 0.5) * TILE, TILE * 3.3, 0, 7); ctx.fill(); ctx.stroke();
  }
}

function marker(ctx: CanvasRenderingContext2D, X: number, Y: number, icon: string, col: string, z: number) {
  const r = 9 / Math.max(0.7, z) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(X + 1, Y + 1.5, r, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.font = `${Math.round(r * 1.2)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, X, Y + 0.5);
}

/**
 * Far out a landmark is drawn into a small picture refreshed about four times a second, like the buildings (see
 * drawBuildingFar): its many little shapes made panning a big map slow.
 */
const lpics = new Map<Poi, { c: HTMLCanvasElement; s: number; at: number; got: boolean }>();
let lbudget = { tm: -1, left: 0 };
const LSCALES = [0.25, 0.375, 0.5, 0.75, 1, 1.5, 2];
function farLandmark(ctx: CanvasRenderingContext2D, p: Poi, X: number, Y: number, tm: number): boolean {
  if (typeof document === 'undefined') return false;
  const m = ctx.getTransform(), px = Math.hypot(m.a, m.b), sc = LSCALES.find(k => k >= px) ?? LSCALES.at(-1)!;
  const slot = Math.floor(tm * 4 + (p.x % 7) / 7), W = 144, H = 144; // the landmark spans about two squares round its middle (a lighthouse's turning beam is drawn live)
  if (tm !== lbudget.tm) lbudget = { tm, left: 4 };
  let q = lpics.get(p);
  if (!q || q.s !== sc || q.got !== !!p.got || (q.at !== slot && lbudget.left-- > 0)) {
    const c = q?.c ?? document.createElement('canvas'), w = Math.ceil(W * sc), h = Math.ceil(H * sc);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const cx = c.getContext('2d'); if (!cx) return false;
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h); cx.setTransform(sc, 0, 0, sc, W / 2 * sc, H * 0.6 * sc);
    drawLandmark(cx, p, tm);
    q = { c, s: sc, at: slot, got: !!p.got }; lpics.set(p, q);
  }
  ctx.drawImage(q.c, X - W / 2, Y - H * 0.6, W, H);
  return true;
}

/** A hand-made miniature landmark (see landmarks.ts), with a question flag until it is taken over. */
function drawPoi(ctx: CanvasRenderingContext2D, p: Poi, tm: number, z: number) {
  const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
  if (!(z < FAR_ZOOM && p.kind !== 'lighthouse' && farLandmark(ctx, p, X, Y, tm))) { ctx.save(); ctx.translate(X, Y); drawLandmark(ctx, p, tm); ctx.restore(); }
  if (!p.got && p.kind !== 'wreck' && z >= 0.7) { // not yet taken over: a small question flag
    ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(28,22,16,.75)'; ctx.beginPath(); ctx.arc(X + 18, Y - 22, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd27a'; ctx.textBaseline = 'middle'; ctx.fillText(POI[p.kind].icon, X + 18, Y - 21.5);
  }
}

/** 🗺 Over the fog: the ? of every find a bought map marked, and in Map mode the circle a map would cover. */
export function drawMaps(ctx: CanvasRenderingContext2D, g: Game, t: Tools | undefined, tm: number, z: number) {
  const s = 1 / Math.max(0.1, Math.min(1.4, z)), pulse = 0.5 + 0.5 * Math.sin(tm * 3);
  for (const f of rumours(g)) {
    const X = (f.x + 0.5) * TILE, Y = (f.y + 0.5) * TILE, r = 11 * s;
    ctx.fillStyle = `rgba(255,214,110,${0.18 + 0.16 * pulse})`; ctx.beginPath(); ctx.arc(X, Y, r * 1.9, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(40,30,18,.85)'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.6 * s; ctx.stroke();
    ctx.fillStyle = '#ffd27a'; ctx.font = `800 ${Math.round(12 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', X, Y + 0.5 * s);
  }
  // nothing else is marked over the fog: a surveyed iron or oil deposit shows only once track or a scout uncovers it
  // (he saw an oil barrel deep in the fog and called it a spoiler, 2026-11-16)
  if (t?.mode !== 'map') return;
  // maps you already bought: green circles, so you don't pay twice for the same land
  for (const b of g.s.maps ?? []) {
    const X = (b.x + 0.5) * TILE, Y = (b.y + 0.5) * TILE, R = b.r * TILE;
    ctx.fillStyle = 'rgba(120,220,140,.10)'; ctx.beginPath(); ctx.arc(X, Y, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(140,230,150,.75)'; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.fillStyle = 'rgba(140,230,150,.95)'; ctx.font = `700 ${Math.round(13 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✅ mapped', X, Y - R + 16 * s);
  }
  const m = t.mapPv; if (!m) return;
  const X = (m.x + 0.5) * TILE, Y = (m.y + 0.5) * TILE, R = m.r * TILE;
  ctx.fillStyle = 'rgba(255,231,168,.10)'; ctx.beginPath(); ctx.arc(X, Y, R, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgba(255,214,120,${0.7 + 0.3 * pulse})`; ctx.lineWidth = 3 * s; ctx.setLineDash([10 * s, 8 * s]); ctx.lineDashOffset = -tm * 20 * s;
  ctx.beginPath(); ctx.arc(X, Y, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `${Math.round(26 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🗺', X, Y);
}
