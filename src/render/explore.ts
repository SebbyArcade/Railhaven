import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { isRevealed } from '../world/fog.ts';
import type { Tools } from '../ui/tools.ts';
import { poisOf, POI, type Poi, scoutPlace, scoutStarts } from '../world/explore.ts';
import { drawLandmark } from './landmarks.ts';

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

/** A hand-made miniature landmark (see landmarks.ts), with a question flag until it is taken over. */
function drawPoi(ctx: CanvasRenderingContext2D, p: Poi, tm: number, z: number) {
  const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
  ctx.save(); ctx.translate(X, Y);
  drawLandmark(ctx, p, tm);
  ctx.restore();
  if (!p.got && p.kind !== 'wreck' && z >= 0.7) { // not yet taken over: a small question flag
    ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(28,22,16,.75)'; ctx.beginPath(); ctx.arc(X + 18, Y - 22, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd27a'; ctx.textBaseline = 'middle'; ctx.fillText(POI[p.kind].icon, X + 18, Y - 21.5);
  }
}
