import { hash } from '../core/rng.ts';
import { type Building, fieldSquares } from '../buildings/industries.ts';
import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';

type Crop = 'ripe' | 'green' | 'ploughed' | 'stubble';
const CROPS: Crop[] = ['ripe', 'ripe', 'ripe', 'green', 'green', 'ploughed', 'stubble'];
const BASE: Record<Crop, [string, string, string]> = { // ground, row, highlight
  ripe: ['#d9b54e', '#b8902e', '#f3dc8a'],
  green: ['#7fa94a', '#5e8a34', '#a5c96c'],
  ploughed: ['#8a6440', '#6b4a2c', '#a07a52'],
  stubble: ['#cdb27a', '#a88d58', '#e2cf9c'],
};

/**
 * A farm's fields on the squares it really works: each its own crop (ripe wheat, young green shoots, fresh
 * ploughed furrows or stubble with hay bales), rows running one way or the other, hedges along the outer edges,
 * and wheat ears that sway in the wind. Pasture for sheep farms: rough grass with a fence and a few sheep.
 */
export function drawFields(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number, zoom: number) {
  const sq = fieldSquares(g, b); if (!sq.length) return;
  const n = g.world.n, T = TILE, own = new Set(sq), H = (i: number, k: number) => hash(g.s.seed, i, b.id, k);
  for (const i of sq) {
    const x0 = (i % n) * T, y0 = ((i / n) | 0) * T;
    if (b.kind === 'wool') { pasture(ctx, x0, y0, i, H, tm); continue; }
    const crop = CROPS[Math.floor(H(i, 1) * CROPS.length)]!, [ground, row, hi] = BASE[crop], across = H(i, 2) < 0.5;
    ctx.fillStyle = ground; ctx.fillRect(x0 + 1, y0 + 1, T - 2, T - 2);
    // rows (furrows) a little wavy, like a hand-ploughed field
    ctx.strokeStyle = row; ctx.lineWidth = crop === 'ploughed' ? 1.6 : 1.1;
    for (let k = 3; k < T - 1; k += 3.2) {
      ctx.beginPath();
      for (let u = 1; u <= T - 1; u += 5) { const w = Math.sin((u + i) * 0.35) * 0.4; if (across) ctx.lineTo(x0 + u, y0 + k + w); else ctx.lineTo(x0 + k + w, y0 + u); }
      ctx.stroke();
    }
    if (zoom >= 1.2) {
      if (crop === 'ripe') { // ears catching the light, swaying in waves across the field
        ctx.fillStyle = hi;
        for (let k = 0; k < 18; k++) {
          const u = 2 + H(i, 10 + k) * (T - 4), v = 2 + H(i, 40 + k) * (T - 4), sway = Math.sin(tm * 1.8 + (x0 + u) * 0.08 + (y0 + v) * 0.05) * 0.9;
          ctx.fillRect(x0 + u + sway, y0 + v, 0.9, 2);
        }
      } else if (crop === 'green') { // shoots in the rows
        ctx.fillStyle = hi;
        for (let k = 3; k < T - 1; k += 3.2) for (let u = 2; u < T - 2; u += 2.6) { if (across) ctx.fillRect(x0 + u, y0 + k - 0.8, 0.9, 1.4); else ctx.fillRect(x0 + k - 0.8, y0 + u, 1.4, 0.9); }
      } else if (crop === 'stubble') { // round hay bales
        for (let k = 0; k < 2 + Math.floor(H(i, 5) * 2); k++) {
          const u = 6 + H(i, 60 + k) * (T - 12), v = 6 + H(i, 70 + k) * (T - 12);
          ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.arc(x0 + u + 0.8, y0 + v + 0.8, 2.6, 0, 7); ctx.fill();
          ctx.fillStyle = '#e9cf7a'; ctx.beginPath(); ctx.arc(x0 + u, y0 + v, 2.6, 0, 7); ctx.fill();
          ctx.strokeStyle = '#b8963e'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(x0 + u, y0 + v, 1.4, 0, 5); ctx.stroke();
        }
      }
      if (crop === 'ripe' && H(i, 6) < 0.25) { // a scarecrow
        const u = x0 + 8 + H(i, 7) * (T - 16), v = y0 + 8 + H(i, 8) * (T - 16);
        ctx.strokeStyle = '#5b4330'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(u - 3, v); ctx.lineTo(u + 3, v); ctx.moveTo(u, v - 2); ctx.lineTo(u, v + 3); ctx.stroke();
        ctx.fillStyle = '#8a3a2a'; ctx.beginPath(); ctx.arc(u, v - 2.4, 1.3, 0, 7); ctx.fill();
      }
    }
    hedges(ctx, g, x0, y0, i, own, H);
  }
}

/** Hedges with little bushes along the field edges that don't touch another of this farm's fields. */
function hedges(ctx: CanvasRenderingContext2D, g: Game, x0: number, y0: number, i: number, own: Set<number>, H: (i: number, k: number) => number) {
  const n = g.world.n, T = TILE;
  const sides: [number, number, number, number, number][] = [[i - n, x0, y0, x0 + T, y0], [i + n, x0, y0 + T, x0 + T, y0 + T], [i - 1, x0, y0, x0, y0 + T], [i + 1, x0 + T, y0, x0 + T, y0 + T]];
  for (const [j, ax, ay, bx, by] of sides) {
    if (own.has(j)) continue;
    ctx.strokeStyle = '#3f6a2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const f = (k + 0.3 + H(j, 80 + k) * 0.4) / 4, x = ax + (bx - ax) * f, y = ay + (by - ay) * f;
      ctx.fillStyle = k % 2 ? '#4f7f38' : '#3b6329'; ctx.beginPath(); ctx.arc(x, y, 1.6 + H(j, 90 + k) * 0.8, 0, 7); ctx.fill();
    }
  }
}

function pasture(ctx: CanvasRenderingContext2D, x0: number, y0: number, i: number, H: (i: number, k: number) => number, tm: number) {
  const T = TILE;
  ctx.fillStyle = '#8fb35c'; ctx.fillRect(x0 + 1, y0 + 1, T - 2, T - 2);
  ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 0.7; ctx.strokeRect(x0 + 1.5, y0 + 1.5, T - 3, T - 3);
  for (let k = 0; k < 2; k++) {
    const u = 6 + H(i, 20 + k) * (T - 12) + Math.sin(tm * 0.3 + k + i) * 1.5, v = 6 + H(i, 30 + k) * (T - 12);
    ctx.fillStyle = '#f4f0e4'; ctx.beginPath(); ctx.ellipse(x0 + u, y0 + v, 2.6, 1.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2622'; ctx.beginPath(); ctx.arc(x0 + u + 2.4, y0 + v, 0.9, 0, 7); ctx.fill();
  }
}
