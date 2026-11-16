import { foundPrice } from '../economy/towns.ts';
import { sizeName, stepOf, townLinked } from '../economy/towns.ts';
import { isCapital, tradeOf } from '../economy/trade.ts';
import { GOODS } from '../buildings/industries.ts';
import { looks } from './looks.ts';
import { hash } from '../core/rng.ts';
import type { Game, Site } from '../state.ts';
import type { Hall } from '../buildings/stations.ts';
import { buildingSide, labelAt, stationDoor } from './stations.ts';
import { isRevealed } from '../world/fog.ts';
import { footprint } from '../buildings/industries.ts';
import { TILE } from '../world/terrain.ts';
import { bestSpot, joinGap } from '../track/joins.ts';
import { bush, cottage, fence, person } from './art.ts';

const RES_ICON: Record<string, string> = { coal: '⚫', stone: '🪨', iron: '🧲', oil: '🛢', wood: '🪵', farm: '🌾', gold: '🪙', gems: '💎', cocoa: '🫘', rubber: '🌿' };

/** Town size name: its step on the order ladder. */
export function townSize(s: Site): string {
  return (s.pop ?? 0) <= 0 ? 'Ruins' : sizeName(stepOf(s));
}

function drawTown(ctx: CanvasRenderingContext2D, g: Game, s: Site, tm: number, zoom: number, hall?: Hall) {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE, pop = s.pop ?? 0, H = (a: number, b: number, k: number) => hash(g.s.seed, a, b, k);
  const L = s.lvl ?? 0, ruin = pop <= 0;
  // the town spreads as it climbs the ladder: up to 18 houses for a Town, then more for each step after (a Megacity
  // of 100,000 people once looked like a village)
  const houses = ruin ? 4 : Math.min(18 + Math.max(0, L - 2) * 7, 64, 4 + Math.floor(Math.sqrt(pop)));
  const { roofs, walls } = looks.theme; // the town theme picked in Looks (red roofs by default)
  type Spot = { hx: number; hy: number; w: number; d: number; k: number; tall?: boolean; kind?: 'church' | 'hall' };
  const spots: Spot[] = [];
  // a station beside the town: the town gathers round the station's forecourt, like a real railway town
  const door = hall && !hall.squares.includes(s.y * g.world.n + s.x) ? stationDoor(g.s.seed, hall) : null;
  const CX = door ? door.x : X, CY = door ? door.y : Y;
  const onLane = (hx: number, hy: number, w: number) => !!door && Math.abs(hx - door.x) < w / 2 + 12 && Math.abs(hy - door.y) < 14; // the forecourt stays clear
  if (door) forecourt(ctx, hall!, door, ruin);
  const place = (k: number, w: number, d: number, r: number, a: number): Spot | null => {
    for (let tries = 0; tries < 8; tries++) { // houses keep off the rails, the station and each other
      const rr = r + tries * 12, hx = CX + Math.cos(a) * rr, hy = CY + Math.sin(a) * rr * 0.8;
      if (!blockedAt(g, hx, hy, w, hall) && !onLane(hx, hy, w) && !spots.some(o => Math.abs(o.hx - hx) < (o.w + w) / 2 + 2.5 && Math.abs(o.hy - hy) < (o.d + d) / 2 + 2.5)) return { hx, hy, w, d, k };
    }
    return null;
  };
  // a church from City size, a town hall with a clock from Megacity: placed first, near the middle
  // landmarks try a few directions so the station, the rails and the name board never crowd them out
  const mark = (k: number, w: number, d: number, a0: number) => { for (let i = 0; i < 6; i++) { const c = place(k, w, d, 26, a0 + i * 1.047); if (c && Math.abs(c.hy - (Y + 30)) > 20) return c; } return null; };
  if (!ruin && L >= 3) { const c = mark(-1, 13, 12, H(s.x, 1, 77) * 6.283); if (c) spots.push({ ...c, kind: 'church' }); }
  if (!ruin && L >= 5) { const c = mark(-2, 20, 14, H(s.y, 2, 78) * 6.283); if (c) spots.push({ ...c, kind: 'hall' }); }
  for (let k = 0; k < houses; k++) {
    const a = H(s.x, s.y, k) * 6.283, r = 12 + H(s.y, s.x, k) * (14 + houses * 1.3);
    // tall brick townhouses in the middle of a City and bigger; more two-storey houses as the town grows
    const tall = !ruin && L >= 3 && r < 30 + L * 4 && H(k, s.x, 11) < 0.75;
    const big = !ruin && !tall && H(k, s.y, 5) < 0.15 + L * 0.12;
    const w = tall ? 12 + H(k, s.x, 3) * 3 : (big ? 11 : 9) + H(k, s.x, 3) * 3, d = tall ? 14 : big ? 12 : 9.5;
    const p = place(k, w, d, r, a); if (p) spots.push(tall ? { ...p, tall } : p);
  }
  spots.sort((p, q) => p.hy - q.hy); // back to front
  for (const { hx, hy, w, d, k, tall, kind } of spots) {
    if (kind) { landmark(ctx, kind, hx, hy, w, d, tm, zoom); continue; }
    const big = d > 10;
    if (ruin) { // tumbled walls, no roof, weeds
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(hx - w / 2 + 1.5, hy - d / 2 + 1.5, w, d);
      ctx.strokeStyle = '#8a8378'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx - w / 2, hy + d / 2 - 2); ctx.lineTo(hx - w / 2, hy - d / 2); ctx.lineTo(hx + w / 4, hy - d / 2); ctx.moveTo(hx + w / 2, hy - d / 4); ctx.lineTo(hx + w / 2, hy + d / 2); ctx.lineTo(hx, hy + d / 2); ctx.stroke();
      bush(ctx, hx + 1, hy + 1, 1.6, '#5a7a3a');
      continue;
    }
    // a front garden with a picket fence on some, a tree beside others
    if (zoom > 1 && H(k, 9, s.x) < 0.55) {
      const gy = hy + d / 2, gh = 5;
      ctx.fillStyle = '#6a9a48'; ctx.fillRect(hx - w / 2 - 1, gy, w + 2, gh);
      for (let f = 0; f < 3; f++) { ctx.fillStyle = ['#e85a7a', '#f0d040', '#f4f0f0'][(k + f) % 3]!; ctx.fillRect(hx - w / 2 + 1 + f * (w / 3), gy + 1.4 + (f % 2), 1, 1); }
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(hx - 0.7, gy, 1.4, gh); // garden path to the door
      fence(ctx, hx - w / 2 - 1, gy + gh, hx - 1.2, gy + gh); fence(ctx, hx + 1.2, gy + gh, hx + w / 2 + 1, gy + gh);
      fence(ctx, hx - w / 2 - 1, gy, hx - w / 2 - 1, gy + gh); fence(ctx, hx + w / 2 + 1, gy, hx + w / 2 + 1, gy + gh);
    }
    if (H(k, 4, s.y) < 0.45) bush(ctx, hx + (H(k, 6, 1) < 0.5 ? -1 : 1) * (w / 2 + 3), hy - d / 4, 2.6 + H(k, 7, 2) * 1.2, H(k, 8, 3) < 0.5 ? '#3f6f30' : '#4f8038');
    cottage(ctx, hx, hy, w, d, tall ? {
      wall: ['#b5523b', '#c98a68', '#9c4a34', '#d8c8a8'][(k + s.x) % 4]!, roof: ['#4a5560', '#5a4a42', '#3e3a38'][(k + s.y) % 3]!,
      walls: (k + s.x) % 4 === 3 ? 'plain' : 'brick', storeys: 3,
      chimney: H(k, 2, 2) < 0.5 ? -0.7 : 0.7, tm, smoke: k % 3 === 0 && zoom > 1,
    } : {
      wall: walls[(k * 7 + s.x) % walls.length]!, roof: roofs[(k * 3 + s.y) % roofs.length]!,
      walls: walls[(k * 7 + s.x) % walls.length] === '#c98a68' ? 'brick' : 'plain', storeys: big ? 2 : 1,
      chimney: H(k, 2, 2) < 0.5 ? -0.7 : 0.7, tm, smoke: k % 3 === 0 && zoom > 1,
    });
    if (zoom > 1.4 && k % 4 === 1) person(ctx, hx + w / 2 + 2, hy + d / 2 + 3, ['#a8402e', '#3f5a7a', '#5a7a3a'][k % 3]!);
  }
  // name board
  const fs = Math.max(11, 12 / Math.min(1, zoom));
  ctx.font = `700 ${fs}px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // 👑 region capitals, once there is more than one region
  const cap = !!g.s.caps && Object.keys(g.s.caps).length > 0 && isCapital(g, s);
  const off = !townLinked(g, s); // found but not on the railway: a 🔌 and a dashed orange edge on its board
  const label = (off ? '🔌 ' : cap ? '👑 ' : '') + (s.name ?? ''), tw = ctx.measureText(label).width + 12;
  // the board sits in the middle of the town: below the town square, or among the houses round a station beside it
  const Hb = fs * 1.75 + 14;
  let { LX, BT } = labelAt(g.s.seed, s, hall, g.world.n, tw, Hb);
  if (off) { // the gold squares and the station outline that would link it: keep the board off them (above the town when they run below)
    const gap = joinGap(g, s), n = g.world.n, way = gap ? [...gap.squares, ...gap.hall] : bestSpot(g, s)?.spot.squares ?? [];
    const under = (dy: number) => way.some(i => Math.abs(i % n - s.x) <= 3 && ((i / n) | 0) - s.y === dy);
    if (under(1) || under(2)) { if (!under(-1) && !under(-2)) BT = s.y * TILE - 8 - Hb; }
  }
  ctx.fillStyle = 'rgba(58,40,24,.92)'; ctx.fillRect(LX - tw / 2, BT, tw, fs + 6);
  if (off) { ctx.strokeStyle = '#f08c3c'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.strokeRect(LX - tw / 2, BT, tw, fs + 6); ctx.setLineDash([]); }
  else { ctx.strokeStyle = '#c99a5b'; ctx.lineWidth = 1; ctx.strokeRect(LX - tw / 2, BT, tw, fs + 6); }
  ctx.fillStyle = '#ffe9c4'; ctx.fillText(label, LX, BT + (fs + 6) / 2 + 1);
  if (zoom >= 1.15) {
    ctx.font = `600 ${fs * 0.75}px system-ui`; ctx.fillStyle = 'rgba(20,18,14,.75)';
    const tr = tradeOf(g, s);
    const sz = townSize(s) + (off ? ' · not on the railway' : (pop > 0 ? ' · 👥 ' + Math.floor(pop) : '') + (tr ? ` · 🤝 ${GOODS[tr.good].icon} ${tr.got}/${tr.need}` : '')), sw = ctx.measureText(sz).width + 10;
    ctx.fillRect(LX - sw / 2, BT + fs + 8, sw, fs * 0.75 + 5);
    ctx.fillStyle = off ? '#ffb070' : '#f3e6c8'; ctx.fillText(sz, LX, BT + fs + 8 + (fs * 0.75 + 5) / 2 + 1);
  }
}

/** A stone church with a spired tower, or a brick town hall with a clock tower, in the miniature style. */
function landmark(ctx: CanvasRenderingContext2D, kind: 'church' | 'hall', u: number, v: number, w: number, d: number, tm: number, zoom: number) {
  if (kind === 'church') {
    cottage(ctx, u + 2, v, w - 4, d, { wall: '#d8d0c0', roof: '#5a5a62', walls: 'plain', storeys: 1, door: false });
    const tx = u - w / 2 - 1, base = v + d / 2, tw = 5.5, th = d + 6;
    ctx.fillStyle = 'rgba(20,16,10,.28)'; ctx.fillRect(tx + 1.8, base - th + 2, tw, th);
    ctx.fillStyle = '#cfc6b4'; ctx.fillRect(tx, base - th, tw, th);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(tx + tw * 0.6, base - th, tw * 0.4, th);
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(tx + tw / 2 - 1, base - 3.4, 2, 3.4); // the door at the foot of the tower
    ctx.fillStyle = '#3a3028'; ctx.fillRect(tx + tw / 2 - 0.8, base - th + 2.2, 1.6, 2.2); // belfry window
    ctx.fillStyle = '#4a4a52'; ctx.beginPath(); ctx.moveTo(tx - 0.6, base - th); ctx.lineTo(tx + tw / 2, base - th - 9); ctx.lineTo(tx + tw + 0.6, base - th); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(tx - 0.6, base - th); ctx.lineTo(tx + tw / 2, base - th - 9); ctx.lineTo(tx + tw / 2, base - th); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8b060'; ctx.fillRect(tx + tw / 2 - 0.3, base - th - 11.5, 0.6, 2.6); ctx.fillRect(tx + tw / 2 - 1, base - th - 10.8, 2, 0.6); // the cross
    if (zoom > 1.2) person(ctx, u + w / 2 + 2, v + d / 2 + 3, '#3f5a7a');
    return;
  }
  // town hall: a wide brick front, steps, a clock tower in the middle and a flag
  cottage(ctx, u, v, w, d, { wall: '#c98a68', roof: '#4a5560', walls: 'brick', storeys: 2, door: true });
  const cx = u, top = v - d / 2, tw = 6, th = 9;
  ctx.fillStyle = 'rgba(20,16,10,.25)'; ctx.fillRect(cx - tw / 2 + 1.5, top - th + 1.5, tw, th);
  ctx.fillStyle = '#d8c8a8'; ctx.fillRect(cx - tw / 2, top - th, tw, th);
  ctx.fillStyle = '#f4ead6'; ctx.beginPath(); ctx.arc(cx, top - th + 3.4, 2, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#3a3028'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(cx, top - th + 3.4, 2, 0, 6.283); ctx.stroke();
  const hr = (tm / 720) % 1 * 6.283, mn = (tm / 60) % 1 * 6.283; // the hands turn slowly
  ctx.beginPath(); ctx.moveTo(cx, top - th + 3.4); ctx.lineTo(cx + Math.sin(hr) * 1.2, top - th + 3.4 - Math.cos(hr) * 1.2); ctx.moveTo(cx, top - th + 3.4); ctx.lineTo(cx + Math.sin(mn) * 1.7, top - th + 3.4 - Math.cos(mn) * 1.7); ctx.stroke();
  ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.moveTo(cx - tw / 2 - 0.6, top - th); ctx.lineTo(cx, top - th - 4); ctx.lineTo(cx + tw / 2 + 0.6, top - th); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx, top - th - 4); ctx.lineTo(cx, top - th - 9); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(cx, top - th - 9); ctx.lineTo(cx + 3.6 + Math.sin(tm * 3) * 0.4, top - th - 8); ctx.lineTo(cx, top - th - 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d7ccb4'; ctx.fillRect(u - 4, v + d / 2, 8, 2); // front steps
  if (zoom > 1.2) { person(ctx, u - 6, v + d / 2 + 3, '#a8402e'); person(ctx, u + 5, v + d / 2 + 4, '#5a7a3a'); }
}

/** A small paved forecourt in front of the station door, in the platform's colours (weedy while the town is in ruins). */
function forecourt(ctx: CanvasRenderingContext2D, hall: Hall, door: { x: number; y: number }, ruin: boolean) {
  const w = hall.horizontal ? 22 : 9, h = hall.horizontal ? 9 : 22;
  const x = door.x - w / 2 + (hall.horizontal ? 0 : door.x < (hall.cx + 0.5) * TILE ? -w / 2 : w / 2), y = door.y - h / 2 + (hall.horizontal ? (door.y < (hall.cy + 0.5) * TILE ? -h / 2 : h / 2) : 0);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + 1, y + 1, w, h);
  ctx.fillStyle = ruin ? '#b8ad94' : '#d7ccb4'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ruin ? 'rgba(90,122,58,.6)' : 'rgba(120,108,88,.35)';
  for (let i = 2; i < w - 1; i += 3) for (let j = 2; j < h - 1; j += 3) if ((i + j) % 2 === 0) ctx.fillRect(x + i, y + j, ruin ? 1 : 0.6, ruin ? 1 : 0.6);
}

/** true when a house here would sit on track or on the station (hall, platforms, building) */
function blockedAt(g: Game, hx: number, hy: number, w: number, hall?: Hall): boolean {
  const n = g.world.n;
  for (const [ox, oy] of [[-w / 2, -7], [w / 2, -7], [-w / 2, 11], [w / 2, 11], [0, 2]]) {
    const x = Math.floor((hx + ox!) / TILE), y = Math.floor((hy + oy!) / TILE);
    if (g.track.has(y * n + x)) return true;
    if (g.s.buildings?.some(b => footprint(n, b).includes(y * n + x))) return true; // nor on an industry
    const tr = g.world.terr[y * n + x]; if (tr === undefined || tr === 0 || tr === 2 || tr === 4) return true; // never in the water, in a forest (it sat on the treetops) or on a mountain
    if (g.s.parks?.some(q => q.x === x && q.y === y)) return true; // a park or town project stands here
  }
  if (hall) {
    const X = (hall.cx + 0.5) * TILE, Y = (hall.cy + 0.5) * TILE, side = buildingSide(g.s.seed, hall);
    const u = hall.horizontal ? hx - X : hy - Y, v = (hall.horizontal ? hy - Y : X - hx) * side; // v as drawHall turns it
    if (Math.abs(u) < 1.5 * TILE + w / 2 && v > -30 && v < 36) return true;
  }
  return false;
}

function drawPlot(ctx: CanvasRenderingContext2D, g: Game, s: Site) {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE;
  ctx.strokeStyle = '#5a3e24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y + 8); ctx.lineTo(X, Y - 12); ctx.stroke();
  ctx.fillStyle = '#e8603c'; ctx.beginPath(); ctx.moveTo(X, Y - 12); ctx.lineTo(X + 11, Y - 8); ctx.lineTo(X, Y - 4); ctx.fill();
  ctx.font = 'italic 10px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,210,.85)'; ctx.fillText('settlement site', X, Y + 18);
  // what to do with it, in plain words (it is a card behind a tap)
  ctx.font = 'bold 8px system-ui'; ctx.fillStyle = 'rgba(255,226,168,.95)'; ctx.fillText(`tap to found a town · $${foundPrice(g, s).toLocaleString('en-US')}`, X, Y + 28);
}

function drawDeposit(ctx: CanvasRenderingContext2D, s: Site) {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE;
  ctx.fillStyle = 'rgba(20,18,14,.55)'; ctx.beginPath(); ctx.arc(X, Y, 10, 0, 7); ctx.fill();
  ctx.strokeStyle = s.rich ? '#ffd27a' : 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(RES_ICON[s.res ?? ''] ?? '?', X, Y + 1);
}

export function drawSites(ctx: CanvasRenderingContext2D, g: Game, x0: number, y0: number, x1: number, y1: number, zoom: number, tm: number, halls: Hall[] = []) {
  const n = g.world.n;
  for (const s of g.s.sites) {
    if (s.x < x0 - 3 || s.x > x1 + 3 || s.y < y0 - 3 || s.y > y1 + 3) continue;
    if (!isRevealed(g, s.y * n + s.x)) continue;
    if (s.kind === 'town') drawTown(ctx, g, s, tm, zoom, halls.find(h => h.town === s));
    else if (s.kind === 'plot') drawPlot(ctx, g, s);
    else if (!s.hidden) drawDeposit(ctx, s);
  }
}
