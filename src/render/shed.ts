import { DX, DY } from '../core/grid.ts';
import type { Game } from '../state.ts';
import type { Break } from '../track/breaks.ts';
import { TILE } from '../world/terrain.ts';

/** The engine shed: brick stalls with gabled roofs and arched doors; its siding (real track) runs out of the middle door to the line. */
export function drawShed(ctx: CanvasRenderingContext2D, g: Game, tm: number) {
  const sh = g.s.shed; if (!sh) return;
  const T = TILE;
  ctx.save();
  ctx.translate((sh.x + 0.5) * T, (sh.y + 0.5) * T);
  ctx.rotate(Math.atan2(DY[sh.side], DX[sh.side]) - Math.PI / 2); // the track is now towards +y
  const stalls = 3, w = 28, d = 22, top = -15;
  // building
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-w / 2 + 2, top + 2, w, d);
  ctx.fillStyle = '#8c3f2c'; ctx.fillRect(-w / 2, top, w, d);
  for (let k = 0; k < stalls; k++) { // one gabled roof per stall, ridge along the stall
    const u0 = -w / 2 + k * (w / stalls), sw = w / stalls;
    ctx.fillStyle = '#4c3b33'; ctx.fillRect(u0 + 0.4, top, sw / 2, d - 3);
    ctx.fillStyle = '#5e4a40'; ctx.fillRect(u0 + sw / 2, top, sw / 2 - 0.4, d - 3);
    ctx.fillStyle = '#3a2e28'; ctx.fillRect(u0 + sw / 2 - 1, top + 3, 2, 3); // smoke vent
    // arched door facing the track
    ctx.fillStyle = '#2a211c'; ctx.fillRect(u0 + sw / 2 - 2.6, top + d - 3, 5.2, 3);
  }
  // a wisp of smoke from one vent
  const p = (tm * 0.4) % 1;
  ctx.fillStyle = `rgba(220,215,205,${0.4 * (1 - p)})`; ctx.beginPath(); ctx.arc(-w / 2 + w / stalls * 1.5, top + 2 - p * 10, 1.5 + p * 3, 0, 7); ctx.fill();
  ctx.restore();
}

/** A broken rail: debris by cause, a bent rail and a warning flag; then the repair crew at work. */
export function drawBreak(ctx: CanvasRenderingContext2D, g: Game, b: Break, tm: number) {
  const n = g.world.n, x = (b.square % n + 0.5) * TILE, y = ((b.square / n | 0) + 0.5) * TILE;
  ctx.save(); ctx.translate(x, y);
  // bent rail and a loose sleeper
  ctx.strokeStyle = '#3d3a36'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(0, -8, 6, -2); ctx.stroke();
  ctx.fillStyle = '#5b4330'; ctx.save(); ctx.rotate(0.6); ctx.fillRect(-1, -6, 2.2, 11); ctx.restore();
  if (b.kind === 'rockslide') { ctx.fillStyle = '#7d766b'; for (const [a, c, r] of [[-3, 2, 3.2], [3, 0, 2.6], [0, -1, 2.2], [5, 4, 1.8]]) { ctx.beginPath(); ctx.arc(a!, c!, r!, 0, 7); ctx.fill(); } }
  else if (b.kind === 'washout') { ctx.fillStyle = 'rgba(70,110,140,.75)'; ctx.beginPath(); ctx.ellipse(0, 2, 9, 4.5, 0.3, 0, 7); ctx.fill(); }
  else if (b.kind === 'fallen tree') { ctx.fillStyle = '#6b4a2e'; ctx.save(); ctx.rotate(-0.5); ctx.fillRect(-11, -1.6, 20, 3.2); ctx.restore(); ctx.fillStyle = '#3f6b32'; ctx.beginPath(); ctx.arc(8, -6, 5, 0, 7); ctx.fill(); }
  else { ctx.strokeStyle = '#d4d7dc'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-7, 3); ctx.bezierCurveTo(-2, -2, 2, 8, 7, 3); ctx.stroke(); }
  if (g.s.t < b.crewAt) { // warning flag until the crew arrives
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, 8); ctx.lineTo(-10, -6); ctx.stroke();
    ctx.fillStyle = Math.floor(tm * 2) % 2 ? '#e8503c' : '#ff7a5c'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-3, -4); ctx.lineTo(-10, -2); ctx.fill();
  } else { // handcar and two workers swinging hammers, with sparks
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-15, 6, 8, 5); ctx.fillStyle = '#2a211c'; ctx.fillRect(-14, 10.5, 2, 1.5); ctx.fillRect(-9, 10.5, 2, 1.5);
    for (const [wx, ph] of [[-5, 0], [7, Math.PI]] as const) {
      const sw = Math.sin(tm * 6 + ph);
      ctx.fillStyle = '#f0a020'; ctx.beginPath(); ctx.arc(wx, 7, 1.8, 0, 7); ctx.fill(); // hi-vis worker from above
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(wx, 7); ctx.lineTo(wx + sw * 3, 7 - 4); ctx.stroke();
      if (sw > 0.9) { ctx.fillStyle = '#ffe27a'; for (let k = 0; k < 3; k++) ctx.fillRect(wx + 3 + k, 2 - k, 0.8, 0.8); }
    }
  }
  ctx.restore();
}
