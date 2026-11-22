import type { Network } from '../track/network.ts';
import type { Piece } from '../track/types.ts';

/** Rails are drawn from the very pieces trains drive on, so wheels never leave a drawn rail. */
const GAUGE = 3.4;

function strokeOffset(ctx: CanvasRenderingContext2D, p: Piece, off: number) {
  ctx.beginPath(); pathOffset(ctx, p, off, 0); ctx.stroke();
}
/**
 * Adds a piece's line, shifted sideways by `off`, to the current path. Points closer than `minD` to the last one
 * are skipped (zoomed far out a curve needs only a few), but the ends are always kept so pieces still meet.
 */
function pathOffset(ctx: CanvasRenderingContext2D | Path2D, p: Piece, off: number, minD: number) {
  const q = p.pts, n = q.length / 2;
  let lx = 0, ly = 0;
  for (let i = 0; i < n; i++) {
    if (i && i < n - 1 && minD && Math.abs(q[i * 2]! - lx) + Math.abs(q[i * 2 + 1]! - ly) < minD) continue;
    lx = q[i * 2]!; ly = q[i * 2 + 1]!;
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = q[b * 2]! - q[a * 2]!, ty = q[b * 2 + 1]! - q[a * 2 + 1]!, l = Math.hypot(tx, ty) || 1;
    const x = lx - (ty / l) * off, y = ly + (tx / l) * off;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
}
/** Zoomed out (below this) the rails of every piece go into one path per colour: one stroke for the whole network
 * instead of six per piece (a 2,000-square railway made zooming out lag on a phone, bug report 20). */
const BATCH_BELOW = 0.6;
/** Zoomed out: [ballast bed, both rails] of the whole network as two paths, made once per network and zoom step
 * (a new network is made whenever track or a building changes). Fewer points the further out: a pixel apart. */
const farCache = new WeakMap<Network, { step: number; paths: Path2D[] }>();
function farPaths(net: Network, bridge: (p: Piece) => number, zoom: number): Path2D[] | null {
  if (typeof Path2D === 'undefined') return null;
  const step = 2 ** Math.floor(Math.log2(zoom)), c = farCache.get(net);
  if (c && c.step === step) return c.paths;
  const bed = new Path2D(), rails = new Path2D(), minD = 1.5 / step;
  for (const p of net.pieces) {
    if (!bridge(p)) pathOffset(bed, p, 0, minD); // bridges have their own deck
    pathOffset(rails, p, GAUGE, minD); pathOffset(rails, p, -GAUGE, minD);
  }
  const paths = [bed, rails]; farCache.set(net, { step, paths }); return paths;
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
  // ballast bed (bridges have their own deck), then rails: a dark under-line, then bright steel
  const far = zoom < BATCH_BELOW ? farPaths(net, bridge, zoom) : null;
  const pass = (style: string, width: number, offs: number[], all: boolean, k: number) => {
    ctx.strokeStyle = style; ctx.lineWidth = width;
    if (far) { ctx.stroke(far[k]!); return; } // the whole network in one path, kept until the track changes
    for (const p of list) if (all || !kinds.has(p.id)) for (const o of offs) strokeOffset(ctx, p, o);
  };
  pass('rgba(70,58,44,.55)', 14, [0], false, 0);
  pass('#9a8c74', 11.5, [0], false, 0);
  if (zoom >= 0.6) {
    ctx.lineCap = 'butt'; ctx.strokeStyle = '#5b4330'; ctx.lineWidth = 2.2;
    for (const p of list) sleepers(ctx, p);
    ctx.lineCap = 'round';
  }
  pass('#3d3a36', 1.9, [GAUGE, -GAUGE], true, 1);
  pass('#d4d7dc', 0.9, [GAUGE, -GAUGE], true, 1);
  for (const p of list) if (kinds.get(p.id) === 3) trussOver(ctx, p);
  // buffer stops at dead ends
  for (const p of list) if (p.endB) {
    const x = p.pts[p.pts.length - 2]!, y = p.pts[p.pts.length - 1]!, [tx, ty] = p.tb;
    ctx.fillStyle = '#7a3b2a'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(ty, tx));
    ctx.fillRect(-1, -6, 3.5, 12); ctx.fillStyle = '#e8c35a'; ctx.fillRect(2, -4.5, 1.2, 9); ctx.restore();
  }
}
