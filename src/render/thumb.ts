import type { Game } from '../state.ts';
import { isRevealed } from '../world/fog.ts';

const COL = ['#2a6f92', '#6a9444', '#4b7a32', '#8c8160', '#7a7470'];

/** A small picture of the explored map for the Your games page: terrain, rails and towns, framed on what was explored. */
export function mapThumb(g: Game, size = 72): string {
  const n = g.world.n;
  let x0 = n, y0 = n, x1 = 0, y1 = 0;
  for (let i = 0; i < n * n; i++) if (isRevealed(g, i)) { const x = i % n, y = (i / n) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) { x0 = y0 = 0; x1 = y1 = n - 1; }
  const side = Math.max(x1 - x0, y1 - y0, 24) + 3, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sx = Math.round(cx - side / 2), sy = Math.round(cy - side / 2);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!, k = size / side;
  ctx.fillStyle = '#1c1912'; ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const X = sx + x, Y = sy + y; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
    const i = Y * n + X; if (!isRevealed(g, i)) continue;
    ctx.fillStyle = g.track.has(i) ? '#2a1d10' : COL[g.world.terr[i]!]!;
    ctx.fillRect(x * k, y * k, k + 0.5, k + 0.5);
  }
  ctx.fillStyle = '#ffd27a';
  for (const s of g.s.sites) if (s.kind === 'town' && isRevealed(g, s.y * n + s.x)) ctx.fillRect((s.x - sx - 0.5) * k, (s.y - sy - 0.5) * k, Math.max(3, 2 * k), Math.max(3, 2 * k));
  return c.toDataURL('image/png');
}
