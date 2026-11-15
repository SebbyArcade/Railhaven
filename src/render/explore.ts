import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { isRevealed } from '../world/fog.ts';
import type { Tools } from '../ui/tools.ts';
import { poisOf, POI, type Poi, scoutPlace, scoutStarts } from '../world/explore.ts';
import { puff } from './art.ts';

/** Landmarks and wrecks that are out of the fog, scouts on their way, and in Scout mode the start rings and the route. */
export function drawExplore(ctx: CanvasRenderingContext2D, g: Game, t: Tools | undefined, tm: number, vis: (x: number, y: number) => boolean, z: number) {
  const n = g.world.n;
  for (const p of poisOf(g)) if (p.seen && !(p.kind === 'wreck' && p.got) && vis(p.x, p.y) && isRevealed(g, p.y * n + p.x)) drawPoi(ctx, p, tm, z);
  for (const s of g.s.scouts ?? []) {
    // the route still ahead, dotted, and the walker or boat
    ctx.strokeStyle = 'rgba(255,240,200,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath();
    s.path.forEach((i, k) => { if (k < Math.floor(s.pos)) return; const X = (i % n + 0.5) * TILE, Y = (((i / n) | 0) + 0.5) * TILE; if (k === Math.floor(s.pos)) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
    ctx.stroke(); ctx.setLineDash([]);
    const p = scoutPlace(g, s), X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
    marker(ctx, X, Y, s.boat ? '⛵' : '🚶', s.boat ? '#2f6f9a' : '#c07a2a', z);
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

/** Small hand-made landmarks: tumbled columns, a striped lighthouse with a turning beam, a cairn and flag on a hill, a half-sunk hull. */
function drawPoi(ctx: CanvasRenderingContext2D, p: Poi, tm: number, z: number) {
  const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
  ctx.save(); ctx.translate(X, Y);
  if (p.kind === 'ruins') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-11, 2, 24, 7);
    ctx.fillStyle = '#cfc6b0'; ctx.fillRect(-12, 0, 24, 5);
    for (const [u, h] of [[-9, 12], [-3, 7], [3, 14], [9, 5]] as const) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(u - 1, 1 - h, 4, h); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(u - 2, -h, 4, h); ctx.fillStyle = '#b8ae96'; ctx.fillRect(u - 2.5, -h - 1, 5, 1.5); }
    ctx.fillStyle = '#e0d8c2'; ctx.fillRect(-14, 5, 6, 2.5); ctx.fillStyle = '#6a8a4a'; ctx.beginPath(); ctx.arc(12, 4, 3, 0, 7); ctx.fill();
  } else if (p.kind === 'lighthouse') {
    const a = tm * 1.2; ctx.fillStyle = 'rgba(255,240,170,.18)'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.arc(0, -20, 60, a - 0.25, a + 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(2, 4, 7, 3, 0, 0, 7); ctx.fill();
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#c0392b' : '#f4efe2'; ctx.beginPath(); ctx.moveTo(-5 + k * 0.6, 3 - k * 5); ctx.lineTo(5 - k * 0.6, 3 - k * 5); ctx.lineTo(4.4 - k * 0.6, -2 - k * 5); ctx.lineTo(-4.4 + k * 0.6, -2 - k * 5); ctx.fill(); }
    ctx.fillStyle = '#ffe680'; ctx.fillRect(-2.5, -22, 5, 4); ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.moveTo(-3.5, -22); ctx.lineTo(0, -26); ctx.lineTo(3.5, -22); ctx.fill();
  } else if (p.kind === 'lookout') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(1, 4, 8, 3, 0, 0, 7); ctx.fill();
    for (const [u, v, r] of [[-4, 2, 4], [3, 2, 4], [0, -3, 3.5], [0, -7, 2.5]] as const) { ctx.fillStyle = '#9a9488'; ctx.beginPath(); ctx.arc(u, v, r, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(u - 1, v - 1, r * 0.5, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, -20); ctx.stroke();
    const f = Math.sin(tm * 5) * 1.5; ctx.fillStyle = '#e8a33c'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(8, -18 + f * 0.3); ctx.lineTo(0, -15); ctx.fill();
  } else {
    const bob = Math.sin(tm * 1.2) * 0.4; ctx.rotate(-0.5);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(0, 2 + bob, 14, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3424'; ctx.beginPath(); ctx.moveTo(-12, 0 + bob); ctx.lineTo(8, -2 + bob); ctx.quadraticCurveTo(14, 1 + bob, 8, 4 + bob); ctx.lineTo(-12, 3 + bob); ctx.fill();
    ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2, 1 + bob); ctx.lineTo(1, -12 + bob); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,230,200,.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(1, -12 + bob); ctx.lineTo(7, -6 + bob); ctx.stroke();
  }
  ctx.restore();
  if (!p.got && p.kind !== 'wreck' && z >= 0.7) { // not yet taken over: a small question flag
    ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(28,22,16,.75)'; ctx.beginPath(); ctx.arc(X + 12, Y - 14, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd27a'; ctx.textBaseline = 'middle'; ctx.fillText(POI[p.kind].icon, X + 12, Y - 13.5);
  }
  void puff;
}
