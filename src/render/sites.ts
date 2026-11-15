import { sizeName, stepOf } from '../economy/towns.ts';
import { looks } from './looks.ts';
import { hash } from '../core/rng.ts';
import type { Game, Site } from '../state.ts';
import type { Hall } from '../buildings/stations.ts';
import { buildingSide, stationDoor } from './stations.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';
import { bush, cottage, fence, person } from './art.ts';

const RES_ICON: Record<string, string> = { coal: '⚫', stone: '🪨', iron: '🧲', oil: '🛢', wood: '🪵', farm: '🌾' };

/** Town size name: its step on the order ladder. */
export function townSize(s: Site): string {
  return (s.pop ?? 0) <= 0 ? 'Ruins' : sizeName(stepOf(s));
}

function drawTown(ctx: CanvasRenderingContext2D, g: Game, s: Site, tm: number, zoom: number, hall?: Hall) {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE, pop = s.pop ?? 0, H = (a: number, b: number, k: number) => hash(g.s.seed, a, b, k);
  const houses = pop <= 0 ? 4 : Math.min(18, 4 + Math.floor(Math.sqrt(pop)));
  const { roofs, walls } = looks.theme; // the town theme picked in Looks (red roofs by default)
  const L = s.lvl ?? 0, ruin = pop <= 0;
  type Spot = { hx: number; hy: number; w: number; d: number; k: number };
  const spots: Spot[] = [];
  // a station beside the town: a lane from its door, along the station and across to the town square; the houses
  // gather toward the station
  const door = hall && !hall.squares.includes(s.y * g.world.n + s.x) ? stationDoor(g.s.seed, hall) : null;
  const path = door ? (hall!.horizontal ? [door, { x: X, y: door.y }, { x: X, y: Y }] : [door, { x: door.x, y: Y }, { x: X, y: Y }]) : [];
  const CX = door ? X + (door.x - X) * 0.4 : X, CY = door ? Y + (door.y - Y) * 0.4 : Y;
  const onLane = (hx: number, hy: number, w: number) => {
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i]!, b = path[i + 1]!, vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((hx - a.x) * vx + (hy - a.y) * vy) / l2));
      if (Math.abs(a.x + vx * t - hx) < w / 2 + 4 && Math.abs(a.y + vy * t - hy) < 10) return true;
    }
    return false;
  };
  if (door) lane(ctx, path, ruin);
  for (let k = 0; k < houses; k++) {
    const a = H(s.x, s.y, k) * 6.283, r = 12 + H(s.y, s.x, k) * (14 + houses * 1.3);
    const big = !ruin && H(k, s.y, 5) < 0.15 + L * 0.12; // more two-storey houses as the town grows
    const w = (big ? 11 : 9) + H(k, s.x, 3) * 3, d = big ? 12 : 9.5;
    let hx = 0, hy = 0, ok = false;
    for (let tries = 0; tries < 8 && !ok; tries++) { // houses keep off the rails, the station and each other
      const rr = r + tries * 12; hx = CX + Math.cos(a) * rr; hy = CY + Math.sin(a) * rr * 0.8;
      ok = !blockedAt(g, hx, hy, w, hall) && !onLane(hx, hy, w) && !spots.some(o => Math.abs(o.hx - hx) < (o.w + w) / 2 + 2.5 && Math.abs(o.hy - hy) < (o.d + d) / 2 + 2.5);
    }
    if (ok) spots.push({ hx, hy, w, d, k });
  }
  spots.sort((p, q) => p.hy - q.hy); // back to front
  for (const { hx, hy, w, d, k } of spots) {
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
    cottage(ctx, hx, hy, w, d, {
      wall: walls[(k * 7 + s.x) % walls.length]!, roof: roofs[(k * 3 + s.y) % roofs.length]!,
      walls: walls[(k * 7 + s.x) % walls.length] === '#c98a68' ? 'brick' : 'plain', storeys: big ? 2 : 1,
      chimney: H(k, 2, 2) < 0.5 ? -0.7 : 0.7, tm, smoke: k % 3 === 0 && zoom > 1,
    });
    if (zoom > 1.4 && k % 4 === 1) person(ctx, hx + w / 2 + 2, hy + d / 2 + 3, ['#a8402e', '#3f5a7a', '#5a7a3a'][k % 3]!);
  }
  // name board
  const fs = Math.max(11, 12 / Math.min(1, zoom));
  ctx.font = `700 ${fs}px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = s.name ?? '', tw = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(58,40,24,.92)'; ctx.fillRect(X - tw / 2, Y + 22, tw, fs + 6);
  ctx.strokeStyle = '#c99a5b'; ctx.lineWidth = 1; ctx.strokeRect(X - tw / 2, Y + 22, tw, fs + 6);
  ctx.fillStyle = '#ffe9c4'; ctx.fillText(label, X, Y + 22 + (fs + 6) / 2 + 1);
  if (zoom >= 1.15) {
    ctx.font = `600 ${fs * 0.75}px system-ui`; ctx.fillStyle = 'rgba(20,18,14,.75)';
    const sz = townSize(s) + (pop > 0 ? ' · 👥 ' + Math.floor(pop) : ''), sw = ctx.measureText(sz).width + 10;
    ctx.fillRect(X - sw / 2, Y + 22 + fs + 8, sw, fs * 0.75 + 5);
    ctx.fillStyle = '#f3e6c8'; ctx.fillText(sz, X, Y + 22 + fs + 8 + (fs * 0.75 + 5) / 2 + 1);
  }
}

/** A sandy lane (overgrown while the town is in ruins) from the station door to the town square. */
function lane(ctx: CanvasRenderingContext2D, path: { x: number; y: number }[], ruin: boolean) {
  const line = () => { ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.save(); ctx.translate(0, 1); ctx.strokeStyle = 'rgba(70,60,40,.25)'; ctx.lineWidth = 7; line(); ctx.restore();
  ctx.strokeStyle = ruin ? '#a89a72' : '#d6c290'; ctx.lineWidth = 5.5; line();
  if (ruin) { ctx.strokeStyle = 'rgba(90,122,58,.55)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 4]); line(); ctx.setLineDash([]); }
  const e = path.at(-1)!; ctx.fillStyle = ruin ? '#a89a72' : '#d6c290'; ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, 7); ctx.fill(); // a little square in the middle of town
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}

/** true when a house here would sit on track or on the station (hall, platforms, building) */
function blockedAt(g: Game, hx: number, hy: number, w: number, hall?: Hall): boolean {
  const n = g.world.n;
  for (const [ox, oy] of [[-w / 2, -7], [w / 2, -7], [-w / 2, 11], [w / 2, 11], [0, 2]]) {
    const x = Math.floor((hx + ox!) / TILE), y = Math.floor((hy + oy!) / TILE);
    if (g.track.has(y * n + x)) return true;
    if (g.s.parks?.some(q => q.x === x && q.y === y)) return true; // a park or town project stands here
  }
  if (hall) {
    const X = (hall.cx + 0.5) * TILE, Y = (hall.cy + 0.5) * TILE, side = buildingSide(g.s.seed, hall);
    const u = hall.horizontal ? hx - X : hy - Y, v = (hall.horizontal ? hy - Y : X - hx) * side; // v as drawHall turns it
    if (Math.abs(u) < 1.5 * TILE + w / 2 && v > -30 && v < 36) return true;
  }
  return false;
}

function drawPlot(ctx: CanvasRenderingContext2D, s: Site) {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE;
  ctx.strokeStyle = '#5a3e24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y + 8); ctx.lineTo(X, Y - 12); ctx.stroke();
  ctx.fillStyle = '#e8603c'; ctx.beginPath(); ctx.moveTo(X, Y - 12); ctx.lineTo(X + 11, Y - 8); ctx.lineTo(X, Y - 4); ctx.fill();
  ctx.font = 'italic 10px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,240,210,.85)'; ctx.fillText('settlement site', X, Y + 18);
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
    else if (s.kind === 'plot') drawPlot(ctx, s);
    else if (!s.hidden) drawDeposit(ctx, s);
  }
}
