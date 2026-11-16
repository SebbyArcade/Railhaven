import { hash } from '../core/rng.ts';
import type { Hall } from '../buildings/stations.ts';
import { TILE } from '../world/terrain.ts';
import { person, puff, upright } from './art.ts';

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
 * Where a town's name board goes, in world pixels: below the town square, or among the houses round a station
 * beside it. tw = board width, Hb = board height. Shared with park placement so big landmarks keep clear of it.
 */
export function labelAt(seed: number, s: { x: number; y: number }, hall: Hall | undefined, n: number, tw: number, Hb: number): { LX: number; BT: number } {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE;
  const door = hall && !hall.squares.includes(s.y * n + s.x) ? stationDoor(seed, hall) : null;
  if (!door || !hall) return { LX: X, BT: Y + 22 };
  const hx = (hall.cx + 0.5) * TILE, hy = (hall.cy + 0.5) * TILE, ax = Math.sign(Math.round(door.x - hx)), ay = Math.sign(Math.round(door.y - hy));
  return { LX: door.x + ax * (tw / 2 + 26), BT: ay < 0 ? door.y - 24 - Hb : ay > 0 ? door.y + 24 : door.y - Hb / 2 };
}

/**
 * Platforms on both sides of the two hall tracks, with benches, lamps and people; canopies on posts from Town size
 * up (glazed with iron columns for the biggest); and the station building on one side, as a little model building
 * with its roof seen from above and its front wall showing, like the houses. Drawn in the hall's own frame: u runs
 * along the line, v across it. (Drawn under the trains, so nothing covers the tracks.)
 */
export function drawHall(ctx: CanvasRenderingContext2D, seed: number, h: Hall, zoom: number, tm = 0) {
  const T = TILE, n = h.town, lv = stationLevel(n.pop ?? 0), side = buildingSide(seed, h);
  const H = (k: number) => hash(seed, n.x, n.y, 300 + k);
  ctx.save();
  ctx.translate((h.cx + 0.5) * T, (h.cy + 0.5) * T);
  if (!h.horizontal) ctx.rotate(Math.PI / 2);
  ctx.scale(1, side); // the building's side is +v from here on
  const L = 3 * T - 6; // platform length
  // platforms either side of the tracks (rails sit at ±8 ± 3.4): paving, a yellow safety line, a ramp at each end
  for (const s of [-1, 1]) {
    const v0 = s > 0 ? 12.6 : -16.6;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(-L / 2 + 1, v0 + 1.2, L, 4);
    ctx.fillStyle = lv >= 3 ? '#cfc6b4' : '#d7ccb4'; ctx.fillRect(-L / 2, v0, L, 4);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-L / 2, v0, 1.6, 4); ctx.fillRect(L / 2 - 1.6, v0, 1.6, 4); // ramps
    ctx.fillStyle = '#e8c84a'; ctx.fillRect(-L / 2 + 1.6, s > 0 ? v0 + 0.2 : v0 + 3.2, L - 3.2, 0.5); // safety line
    if (zoom > 1.2) { ctx.fillStyle = 'rgba(120,108,88,.35)'; for (let u = -L / 2 + 4; u < L / 2; u += 4) ctx.fillRect(u, v0 + 1.2, 0.3, 2.4); } // paving joints
  }
  // canopies on posts over each platform from Town size up: a valanced wooden roof, glazed with iron columns for
  // the biggest; posts along the back of the platform so the tracks stay clear
  if (lv >= 2) for (const s of [-1, 1]) {
    const v0 = s > 0 ? 12.4 : -17.2, cw = L - (lv >= 4 ? 8 : 18), cv = 4.8;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-cw / 2 + 1.2, v0 + 1.4, cw, cv);
    if (lv >= 4) {
      ctx.fillStyle = 'rgba(200,225,235,.85)'; ctx.fillRect(-cw / 2, v0, cw, cv);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-cw / 2, v0 + 0.4, cw, 1); // glint
      ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 0.4;
      for (let u = -cw / 2; u <= cw / 2 + 0.1; u += 4) { ctx.beginPath(); ctx.moveTo(u, v0); ctx.lineTo(u, v0 + cv); ctx.stroke(); } // glazing bars
      ctx.strokeRect(-cw / 2, v0, cw, cv);
    } else {
      ctx.fillStyle = lv >= 3 ? '#7a6a5c' : '#8a4a3a'; ctx.fillRect(-cw / 2, v0, cw, cv);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-cw / 2, v0, cw, cv * 0.45);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.3;
      for (let u = -cw / 2 + 1.5; u < cw / 2; u += 1.5) { ctx.beginPath(); ctx.moveTo(u, v0); ctx.lineTo(u, v0 + cv); ctx.stroke(); } // corrugation
    }
    // valance: a scalloped edge on the track side
    const ev = s > 0 ? v0 : v0 + cv;
    ctx.fillStyle = lv >= 4 ? '#3c4650' : '#efe3c8';
    for (let u = -cw / 2; u < cw / 2; u += 1.6) { ctx.beginPath(); ctx.arc(u + 0.8, ev, 0.8, s > 0 ? Math.PI : 0, s > 0 ? 0 : Math.PI); ctx.fill(); }
    // posts
    ctx.fillStyle = lv >= 4 ? '#2e3840' : '#5a3e28';
    for (let u = -cw / 2 + 3; u < cw / 2 - 1; u += 9) { ctx.beginPath(); ctx.arc(u, s > 0 ? v0 + cv - 1 : v0 + 1, 0.7, 0, 7); ctx.fill(); }
  }
  // benches, lamps and a few people waiting (below the canopies, so seen from above only at the ends)
  for (const s of [-1, 1]) {
    const v0 = s > 0 ? 14.6 : -14.6;
    for (const u of lv >= 2 ? [-L / 2 + 4, L / 2 - 4] : [-L / 2 + 6, 0, L / 2 - 6]) lampPost(ctx, u, v0, tm);
    if (lv < 2) { bench(ctx, -L / 4, v0); if (lv >= 1) bench(ctx, L / 4, v0); }
    const folk = Math.min(4, 1 + lv);
    for (let k = 0; k < folk; k++) if (H(k + s * 10) < 0.7) person(ctx, -L / 2 + 6 + H(20 + k + s * 10) * (L - 12), v0 + (H(40 + k) - 0.5), COATS[(k + (s > 0 ? 2 : 0)) % COATS.length]!);
  }
  // the station building, beside the outer platform, the right way up whichever way the line runs
  const w = [12, 18, 24, 30, 40][lv]!, d = [6, 8, 9, 10, 12][lv]!;
  upright(ctx, 0, 17 + d / 2, sw => building(ctx, sw ? d : w, sw ? w : d, lv, sw, tm));
  ctx.restore();
}

const COATS = ['#3f5a7a', '#8a3a2e', '#4a6a3a', '#6a4a7a', '#7a6a3a'];

function lampPost(ctx: CanvasRenderingContext2D, u: number, v: number, tm: number) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u + 0.3, v + 0.3, 2.2, 0.4);
  ctx.fillStyle = '#2e2a26'; ctx.beginPath(); ctx.arc(u, v, 0.55, 0, 7); ctx.fill();
  const g = 0.7 + 0.3 * Math.sin(tm * 2 + u);
  ctx.fillStyle = `rgba(255,214,120,${0.18 * g})`; ctx.beginPath(); ctx.arc(u, v, 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(u, v, 0.35, 0, 7); ctx.fill();
}

function bench(ctx: CanvasRenderingContext2D, u: number, v: number) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(u - 2.2, v - 0.2, 4.6, 1.3);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(u - 2.4, v - 0.6, 4.8, 1.1);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(u - 2.4, v - 0.6, 4.8, 0.3);
}

/**
 * The station building, w wide and d deep, centred: roof seen from above, the front wall below it, like the town's
 * houses. Wooden halt, village station, brick station with a canopy, stone station with a clock tower, grand terminus
 * with two towers and a tall entrance hall. sw: the line runs up and down the screen (the building is turned).
 */
function building(ctx: CanvasRenderingContext2D, w: number, d: number, lv: number, sw: boolean, tm: number) {
  const wall = ['#a77a52', '#eadfc6', '#a8553c', '#d6cdb8', '#e2d8c2'][lv]!, roof = ['#6e4a30', '#b5523b', '#4c3b33', '#56606a', '#4a5866'][lv]!;
  const x0 = -w / 2, y0 = -d / 2, fh = Math.min(d * 0.42, sw ? 3.2 : 4.6), ry = y0, rh = d - fh, fy = y0 + rh; // roof above, front wall below
  ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(x0 + 1.8, y0 + 2.2, w, d);
  // front wall: plaster/logs/brick/stone, arched windows, a double door in the middle
  ctx.fillStyle = wall; ctx.fillRect(x0, fy, w, fh);
  if (lv === 0) { ctx.strokeStyle = 'rgba(40,24,10,.45)'; ctx.lineWidth = 0.35; for (let y = fy + 1.1; y < fy + fh; y += 1.2) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); } }
  if (lv === 2) { ctx.strokeStyle = 'rgba(255,230,210,.22)'; ctx.lineWidth = 0.25; for (let y = fy + 0.9; y < fy + fh; y += 0.9) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); } }
  if (lv >= 3) { ctx.fillStyle = 'rgba(0,0,0,.08)'; for (let y = fy + 1.2; y < fy + fh; y += 1.2) ctx.fillRect(x0, y, w, 0.25); } // stone courses
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0, fy + fh - 0.6, w, 0.6); // plinth
  const wn = Math.max(2, Math.round(w / 4)), ww = Math.min(1.7, w / wn * 0.4), wh = fh * 0.5;
  for (let k = 0; k < wn; k++) {
    if (k === Math.floor(wn / 2)) continue;
    const xx = x0 + (w / wn) * (k + 0.5) - ww / 2, yy = fy + fh * 0.22;
    ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.roundRect(xx - 0.3, yy - 0.3, ww + 0.6, wh + 0.6, [ww / 2 + 0.3, ww / 2 + 0.3, 0, 0]); ctx.fill();
    ctx.fillStyle = '#6f93a8'; ctx.beginPath(); ctx.roundRect(xx, yy, ww, wh, [ww / 2, ww / 2, 0, 0]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(xx, yy + ww / 2, ww * 0.4, wh * 0.3);
  }
  const dw = Math.min(3, w * 0.14), dh = fh * 0.72, dx = -dw / 2;
  ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.roundRect(dx - 0.4, fy + fh - dh - 0.4, dw + 0.8, dh + 0.4, [dw / 2 + 0.4, dw / 2 + 0.4, 0, 0]); ctx.fill();
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.roundRect(dx, fy + fh - dh, dw, dh, [dw / 2, dw / 2, 0, 0]); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-0.15, fy + fh - dh + dw / 2, 0.3, dh - dw / 2);
  // roof: hipped, the back slope in light, the front in shade, slate or shingle courses, a ridge
  const ov = 0.9;
  ctx.fillStyle = roof; ctx.fillRect(x0 - ov, ry, w + ov * 2, rh);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x0 - ov, ry, w + ov * 2, rh * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x0 - ov, ry + rh * 0.5, w + ov * 2, rh * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; // hips at the ends
  ctx.beginPath(); ctx.moveTo(x0 - ov, ry); ctx.lineTo(x0 - ov + rh * 0.5, ry + rh * 0.5); ctx.lineTo(x0 - ov, ry + rh); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x0 + w + ov, ry); ctx.lineTo(x0 + w + ov - rh * 0.5, ry + rh * 0.5); ctx.lineTo(x0 + w + ov, ry + rh); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 0.3;
  for (let y = ry + 1.1; y < ry + rh - 0.4; y += 1.1) { ctx.beginPath(); ctx.moveTo(x0 - ov, y); ctx.lineTo(x0 + w + ov, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 - ov + rh * 0.5, ry + rh * 0.5 - 0.35, w + ov * 2 - rh, 0.7); // ridge
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x0 - ov, ry + rh - 0.5, w + ov * 2, 0.5); // eaves shadow
  // chimneys with a wisp of smoke
  if (lv >= 1) for (const f of lv >= 3 ? [-0.32, 0.32] : [0.3]) {
    const cx = f * w, cy = ry + rh * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(cx - 0.6, cy + 0.6, 2.4, 2.4);
    ctx.fillStyle = '#8a4a36'; ctx.fillRect(cx - 1.2, cy - 1, 2.4, 2.8);
    ctx.fillStyle = '#2a2420'; ctx.fillRect(cx - 0.7, cy - 0.8, 1.4, 0.8);
    puff(ctx, cx, cy - 2, tm + 2 + f * 3);
  }
  // a little awning over the door from brick stations up
  if (lv >= 2) { ctx.fillStyle = lv >= 4 ? '#3c4650' : '#7a3a2e'; ctx.fillRect(-dw * 1.1, fy + fh - dh - 1.4, dw * 2.2, 1.2); }
  // clock tower in the middle (stone station), two towers and a tall entrance hall with a big clock (terminus)
  // a tower standing on the roof, its front face down to `base` (the front wall line, or partway along a turned roof)
  const tower = (u: number, tw: number, th: number, spire: string, base = ry + rh) => {
    const bh = th * 0.65 + Math.min(rh, 6), tx = u - tw / 2, ty = base - bh - th * 0.35;
    ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(tx + 1.5, ty + 2, tw, th * 0.35 + bh);
    ctx.fillStyle = wall; ctx.fillRect(tx, ty + th * 0.35, tw, bh);
    ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(tx + tw * 0.7, ty + th * 0.35, tw * 0.3, bh);
    ctx.fillStyle = spire; ctx.beginPath(); ctx.moveTo(tx - 0.6, ty + th * 0.38); ctx.lineTo(u, ty - 1.5); ctx.lineTo(tx + tw + 0.6, ty + th * 0.38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(tx - 0.6, ty + th * 0.38); ctx.lineTo(u, ty - 1.5); ctx.lineTo(u, ty + th * 0.38); ctx.closePath(); ctx.fill();
    // clock face
    const cy = ty + th * 0.35 + bh * 0.4, r = Math.min(1.5, tw * 0.3);
    ctx.fillStyle = '#f6efd8'; ctx.beginPath(); ctx.arc(u, cy, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.arc(u, cy, r, 0, 7); ctx.stroke();
    const a = tm * 0.05; ctx.beginPath(); ctx.moveTo(u, cy); ctx.lineTo(u + Math.sin(a) * r * 0.75, cy - Math.cos(a) * r * 0.75); ctx.moveTo(u, cy); ctx.lineTo(u + Math.sin(a * 12) * r * 0.5, cy - Math.cos(a * 12) * r * 0.5); ctx.stroke();
  };
  if (lv === 3) tower(0, sw ? 3.6 : 4.4, 5, roof, sw ? y0 + d * 0.55 : ry + rh);
  if (lv >= 4 && sw) { // turned: towers along the long roof, the entrance at the front end
    tower(0, 5, 7, '#3a6a6a', y0 + d * 0.28);
    tower(0, 5, 7, '#3a6a6a', y0 + d * 0.72);
  }
  if (lv >= 4 && !sw) {
    tower(x0 + 3, 5, 7, '#3a6a6a');
    tower(x0 + w - 3, 5, 7, '#3a6a6a');
    // the entrance hall: a taller block with a big arched window over the door
    const ew = Math.min(w * 0.36, 12), ex = -ew / 2, eh = 3;
    ctx.fillStyle = 'rgba(20,16,10,.25)'; ctx.fillRect(ex + 1.2, ry - eh + 1.5, ew, rh + eh);
    ctx.fillStyle = roof; ctx.fillRect(ex - 0.6, ry - eh, ew + 1.2, rh);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(ex - 0.6, ry - eh, ew + 1.2, rh * 0.45);
    ctx.fillStyle = wall; ctx.fillRect(ex, ry - eh + rh, ew, eh);
    ctx.fillStyle = '#9ec4e0'; ctx.beginPath(); ctx.roundRect(-ew * 0.3, ry - eh + rh + 0.4, ew * 0.6, eh - 0.4, [ew * 0.3, ew * 0.3, 0, 0]); ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,60,.6)'; ctx.lineWidth = 0.25;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * ew * 0.12, ry - eh + rh + 0.4); ctx.lineTo(k * ew * 0.12, ry + rh); ctx.stroke(); }
  }
  if (lv === 0) { ctx.fillStyle = '#5a3e24'; ctx.fillRect(x0 - 3, fy + 0.5, 0.8, 3); ctx.fillRect(x0 + w + 2.2, fy + 0.5, 0.8, 3); } // fence posts
}
