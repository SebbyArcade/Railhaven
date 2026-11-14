import { hash } from '../core/rng.ts';
import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';

/** Old-game fog: solid dark inside, soft drifting blobs along the edge of the known map. */
let tex: { cv: HTMLCanvasElement | OffscreenCanvas; key: string } | null = null;

/** Far zoom: one pixel per square, smoothed, so the fog edge is soft and costs one draw. */
function drawFogFar(ctx: CanvasRenderingContext2D, g: Game) {
  const n = g.world.n, key = g.s.seed + ':' + g.s.fog.reduce((a, b) => (a * 31 + b) | 0, 0);
  if (!tex || tex.key !== key) {
    const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(n, n) : Object.assign(document.createElement('canvas'), { width: n, height: n });
    const c = cv.getContext('2d') as CanvasRenderingContext2D, img = c.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { img.data[i * 4] = 46; img.data[i * 4 + 1] = 39; img.data[i * 4 + 2] = 30; img.data[i * 4 + 3] = isRevealed(g, i) ? 0 : 255; }
    c.putImageData(img, 0, 0); tex = { cv, key };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tex.cv as CanvasImageSource, 0, 0, n * TILE, n * TILE);
}

export function drawFog(ctx: CanvasRenderingContext2D, g: Game, x0: number, y0: number, x1: number, y1: number, zoom: number, tm: number) {
  if (zoom < 0.6) { drawFogFar(ctx, g); return; }
  const n = g.world.n, far = false, rgb = far ? '48,40,30' : '30,27,22', H = (p: number, q: number, s = 0) => hash(g.s.seed, p, q, s);
  for (let y = Math.max(0, y0); y <= Math.min(n - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) {
    if (isRevealed(g, y * n + x)) continue;
    let edge = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < n && ny < n && isRevealed(g, ny * n + nx)) edge = true;
    }
    if (edge && !far) {
      ctx.fillStyle = `rgba(${rgb},.38)`; ctx.fillRect(x * TILE, y * TILE, TILE + 0.6, TILE + 0.6);
      for (let k = 0; k < 3; k++) {
        const bx = x * TILE + 6 + H(x, y, k + 11) * 20, by = y * TILE + 6 + H(y, x, k + 11) * 20, br = (11 + H(x, y, k + 20) * 6) * 1.25;
        const gb = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        gb.addColorStop(0, `rgba(${rgb},.6)`); gb.addColorStop(0.55, `rgba(${rgb},.42)`); gb.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle = far ? '#2e271e' : '#1e1b16'; ctx.fillRect(x * TILE, y * TILE, TILE + 0.6, TILE + 0.6);
      if (!far && H(x, y, 5) < 0.1) { ctx.fillStyle = 'rgba(255,240,210,.04)'; ctx.beginPath(); ctx.arc(x * TILE + 16 + Math.sin(tm * 0.3 + x) * 6, y * TILE + 16, 14, 0, 7); ctx.fill(); }
    }
  }
}
