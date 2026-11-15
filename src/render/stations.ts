import { hash } from '../core/rng.ts';
import type { Hall } from '../buildings/stations.ts';
import { TILE } from '../world/terrain.ts';

/** Station size step from the town's people: wooden halt, village station, brick station, stone terminus, grand terminus. */
export function stationLevel(pop: number): number {
  return pop < 100 ? 0 : pop < 250 ? 1 : pop < 600 ? 2 : pop < 1500 ? 3 : 4;
}

/**
 * Which side of the hall the station building stands on, in the hall's frame (v > 0: south for an east-west hall,
 * west for a north-south one, as drawHall turns it). A station beside its town faces the town; one built across the
 * town square picks a side of its own.
 */
export function buildingSide(seed: number, h: Hall): 1 | -1 {
  const t = h.town, off = h.horizontal ? t.y - h.cy : h.cx - t.x;
  if (off) return off > 0 ? 1 : -1;
  return hash(seed, t.x, t.y, 77) < 0.5 ? 1 : -1;
}

/** Where the station building's front door is (toward the town), in world pixels. */
export function stationDoor(seed: number, h: Hall): { x: number; y: number } {
  const side = buildingSide(seed, h), lv = stationLevel(h.town.pop ?? 0), v = 17 + [6, 8, 9, 10, 12][lv]!;
  const X = (h.cx + 0.5) * TILE, Y = (h.cy + 0.5) * TILE;
  return h.horizontal ? { x: X, y: Y + side * v } : { x: X - side * v, y: Y };
}

/**
 * Platforms on both sides of the two hall tracks, canopies from Town size up, and the station building on one side.
 * Drawn in the hall's own frame: u runs along the line, v across it.
 */
export function drawHall(ctx: CanvasRenderingContext2D, seed: number, h: Hall, zoom: number) {
  const T = TILE, n = h.town, lv = stationLevel(n.pop ?? 0), side = buildingSide(seed, h);
  ctx.save();
  ctx.translate((h.cx + 0.5) * T, (h.cy + 0.5) * T);
  if (!h.horizontal) ctx.rotate(Math.PI / 2);
  const L = 3 * T - 6; // platform length
  // platforms either side of the tracks (rails sit at ±8 ± 3.4)
  for (const s of [-1, 1]) {
    const v0 = s > 0 ? 12.6 : -16.6;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(-L / 2 + 1, v0 + 1.2, L, 4);
    ctx.fillStyle = '#d7ccb4'; ctx.fillRect(-L / 2, v0, L, 4);
    ctx.fillStyle = '#efe3a8'; ctx.fillRect(-L / 2, s > 0 ? v0 : v0 + 3.4, L, 0.6); // edge line
    if (zoom > 1.2) { ctx.fillStyle = 'rgba(120,108,88,.5)'; for (let u = -L / 2 + 4; u < L / 2; u += 6) ctx.fillRect(u, v0 + 1.6, 3, 0.5); }
  }
  // canopies over the platforms from Town size up; a glass roof over the whole hall for the biggest
  if (lv >= 4) {
    ctx.fillStyle = 'rgba(190,215,225,.28)'; ctx.fillRect(-L / 2 + 4, -17, L - 8, 34);
    ctx.strokeStyle = 'rgba(70,80,90,.55)'; ctx.lineWidth = 0.7;
    for (let u = -L / 2 + 6; u < L / 2 - 4; u += 6) { ctx.beginPath(); ctx.moveTo(u, -17); ctx.lineTo(u, 17); ctx.stroke(); }
    ctx.strokeRect(-L / 2 + 4, -17, L - 8, 34);
  } else if (lv >= 2) {
    for (const s of [-1, 1]) {
      const v0 = s > 0 ? 12.2 : -17;
      ctx.fillStyle = lv >= 3 ? '#6d5a4a' : '#7f4a3a'; ctx.fillRect(-L / 2 + 10, v0, L - 20, 4.8);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-L / 2 + 10, v0, L - 20, 1);
    }
  }
  // the station building, beside the platform on one side, facing the tracks
  ctx.scale(1, side);
  drawBuilding(ctx, lv);
  ctx.restore();
}

function drawBuilding(ctx: CanvasRenderingContext2D, lv: number) {
  const w = [12, 18, 24, 30, 40][lv]!, d = [6, 8, 9, 10, 12][lv]!, v = 17;
  const wall = ['#a77a52', '#eadfc6', '#9c4a34', '#c9bfaa', '#d8cdb5'][lv]!, roof = ['#6e4a30', '#b5523b', '#4c3b33', '#5b6066', '#4f5a62'][lv]!;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-w / 2 + 1.5, v + 1.5, w, d);
  ctx.fillStyle = wall; ctx.fillRect(-w / 2, v, w, d);
  // roof: a pitched strip seen from above
  ctx.fillStyle = roof; ctx.fillRect(-w / 2 - 1, v + d * 0.25, w + 2, d * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(-w / 2 - 1, v + d * 0.25, w + 2, 1);
  // windows/doors facing the platform
  ctx.fillStyle = 'rgba(40,30,22,.7)';
  for (let u = -w / 2 + 3; u < w / 2 - 2; u += 4) ctx.fillRect(u, v + 0.6, 1.6, 1.2);
  if (lv >= 3) { // clock tower (two for the grand terminus)
    for (const u of lv >= 4 ? [-w / 2 + 3, w / 2 - 3] : [0]) {
      ctx.fillStyle = wall; ctx.fillRect(u - 3, v - 1, 6, d + 3);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(u - 3.5, v + d * 0.5); ctx.lineTo(u, v - 3); ctx.lineTo(u + 3.5, v + d * 0.5); ctx.fill();
      ctx.fillStyle = '#f4ecd2'; ctx.beginPath(); ctx.arc(u, v + d * 0.55, 1.5, 0, 7); ctx.fill();
    }
  }
  if (lv === 0) { ctx.fillStyle = '#5a3e24'; ctx.fillRect(-w / 2 - 3, v + 1, 1, 3); ctx.fillRect(w / 2 + 2, v + 1, 1, 3); } // fence posts
}
