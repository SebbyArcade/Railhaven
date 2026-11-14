import type { Network } from '../track/network.ts';
import type { Piece } from '../track/types.ts';

/** Rails are drawn from the very pieces trains drive on, so wheels never leave a drawn rail. */
const GAUGE = 3.4;

function strokeOffset(ctx: CanvasRenderingContext2D, p: Piece, off: number) {
  const q = p.pts, n = q.length / 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = q[b * 2]! - q[a * 2]!, ty = q[b * 2 + 1]! - q[a * 2 + 1]!, l = Math.hypot(tx, ty) || 1;
    const x = q[i * 2]! - (ty / l) * off, y = q[i * 2 + 1]! + (tx / l) * off;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

function sleepers(ctx: CanvasRenderingContext2D, p: Piece) {
  const step = 5.5, half = 5.2;
  ctx.beginPath();
  for (let s = step / 2; s < p.len; s += step) {
    // point and tangent by walking the samples
    let i = 1; while (i < p.cum.length - 1 && p.cum[i]! < s) i++;
    const f = (s - p.cum[i - 1]!) / ((p.cum[i]! - p.cum[i - 1]!) || 1);
    const x0 = p.pts[i * 2 - 2]!, y0 = p.pts[i * 2 - 1]!, x1 = p.pts[i * 2]!, y1 = p.pts[i * 2 + 1]!;
    const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
    ctx.moveTo(x - nx * half, y - ny * half); ctx.lineTo(x + nx * half, y + ny * half);
  }
  ctx.stroke();
}

/** Piers or arches under a bridge piece, by kind: 1 wooden trestle, 2 stone viaduct, 3 steel truss. */
function bridgeUnder(ctx: CanvasRenderingContext2D, p: Piece, kind: number) {
  ctx.strokeStyle = 'rgba(10,30,45,.35)'; ctx.lineWidth = 16; ctx.save(); ctx.translate(3, 5); strokeOffset(ctx, p, 0); ctx.restore(); // shadow on the water
  if (kind === 2) {
    ctx.strokeStyle = '#6f675c'; ctx.lineWidth = 16; strokeOffset(ctx, p, 0);
    ctx.strokeStyle = '#a99f8e'; ctx.lineWidth = 13; strokeOffset(ctx, p, 0);
  } else if (kind === 3) {
    ctx.strokeStyle = '#3f444a'; ctx.lineWidth = 13; strokeOffset(ctx, p, 0);
  } else {
    ctx.strokeStyle = '#4e3a28'; ctx.lineWidth = 2; ctx.setLineDash([2, 6]); strokeOffset(ctx, p, 6.5); strokeOffset(ctx, p, -6.5); ctx.setLineDash([]); // piles
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 11; strokeOffset(ctx, p, 0);
  }
}

/** Truss sides above the deck (steel bridges). */
function trussOver(ctx: CanvasRenderingContext2D, p: Piece) {
  ctx.strokeStyle = '#8d3b2b'; ctx.lineWidth = 1.4;
  strokeOffset(ctx, p, 6.6); strokeOffset(ctx, p, -6.6);
  ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]); strokeOffset(ctx, p, 5.8); strokeOffset(ctx, p, -5.8); ctx.setLineDash([]);
}

export function drawTrack(ctx: CanvasRenderingContext2D, net: Network, visible: (p: Piece) => boolean, zoom: number, bridge: (p: Piece) => number = () => 0) {
  const list = net.pieces.filter(visible), kinds = new Map<number, number>();
  for (const p of list) { const k = bridge(p); if (k) kinds.set(p.id, k); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const p of list) { const k = kinds.get(p.id); if (k) bridgeUnder(ctx, p, k); }
  // ballast bed (bridges have their own deck)
  ctx.strokeStyle = 'rgba(70,58,44,.55)'; ctx.lineWidth = 14;
  for (const p of list) if (!kinds.has(p.id)) strokeOffset(ctx, p, 0);
  ctx.strokeStyle = '#9a8c74'; ctx.lineWidth = 11.5;
  for (const p of list) if (!kinds.has(p.id)) strokeOffset(ctx, p, 0);
  if (zoom >= 0.6) {
    ctx.lineCap = 'butt'; ctx.strokeStyle = '#5b4330'; ctx.lineWidth = 2.2;
    for (const p of list) sleepers(ctx, p);
    ctx.lineCap = 'round';
  }
  // rails: a dark under-line, then bright steel
  ctx.strokeStyle = '#3d3a36'; ctx.lineWidth = 1.9;
  for (const p of list) { strokeOffset(ctx, p, GAUGE); strokeOffset(ctx, p, -GAUGE); }
  ctx.strokeStyle = '#d4d7dc'; ctx.lineWidth = 0.9;
  for (const p of list) { strokeOffset(ctx, p, GAUGE); strokeOffset(ctx, p, -GAUGE); }
  for (const p of list) if (kinds.get(p.id) === 3) trussOver(ctx, p);
  // buffer stops at dead ends
  for (const p of list) if (p.endB) {
    const x = p.pts[p.pts.length - 2]!, y = p.pts[p.pts.length - 1]!, [tx, ty] = p.tb;
    ctx.fillStyle = '#7a3b2a'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ty, tx));
    ctx.fillRect(-1, -6, 3.5, 12); ctx.fillStyle = '#e8c35a'; ctx.fillRect(2, -4.5, 1.2, 9); ctx.restore();
  }
}
