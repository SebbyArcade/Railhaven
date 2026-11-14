import { hash } from '../core/rng.ts';
import type { Game, Site } from '../state.ts';
import type { Hall } from '../buildings/stations.ts';
import { buildingSide } from './stations.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';

const RES_ICON: Record<string, string> = { coal: '⚫', stone: '🪨', iron: '🧲', oil: '🛢', wood: '🪵', farm: '🌾' };

/** Town size names on the order ladder. */
export function townSize(pop: number): string {
  return pop <= 0 ? 'Ruins' : pop < 100 ? 'Hamlet' : pop < 250 ? 'Village' : pop < 600 ? 'Town' : pop < 1500 ? 'City' : pop < 4000 ? 'Metropolis' : 'Megacity';
}

function drawTown(ctx: CanvasRenderingContext2D, g: Game, s: Site, tm: number, zoom: number, hall?: Hall) {
  const X = (s.x + 0.5) * TILE, Y = (s.y + 0.5) * TILE, pop = s.pop ?? 0, H = (a: number, b: number, k: number) => hash(g.s.seed, a, b, k);
  const houses = pop <= 0 ? 4 : Math.min(18, 4 + Math.floor(Math.sqrt(pop)));
  const roofs = ['#b5523b', '#9c4a36', '#c46a3a', '#7a4f3a', '#a85d48'];
  for (let k = 0; k < houses; k++) {
    const a = H(s.x, s.y, k) * 6.283, r = 10 + H(s.y, s.x, k) * (14 + houses * 1.2);
    const w = 7 + H(k, s.x, 3) * 4;
    let hx = 0, hy = 0, ok = false;
    for (let tries = 0; tries < 8 && !ok; tries++) { // houses keep off the rails and the station: move further out
      const rr = r + tries * 12; hx = X + Math.cos(a) * rr; hy = Y + Math.sin(a) * rr * 0.8;
      ok = !blockedAt(g, hx, hy, w, hall);
    }
    if (!ok) continue;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(hx - w / 2 + 1.5, hy - 2 + 1.5, w, 6);
    ctx.fillStyle = pop <= 0 ? '#8a8378' : '#e8dcc0'; ctx.fillRect(hx - w / 2, hy - 2, w, 6);
    ctx.fillStyle = pop <= 0 ? '#5a554d' : roofs[k % roofs.length]!;
    ctx.beginPath(); ctx.moveTo(hx - w / 2 - 1, hy - 2); ctx.lineTo(hx, hy - 7); ctx.lineTo(hx + w / 2 + 1, hy - 2); ctx.closePath(); ctx.fill();
    if (pop > 0 && k % 4 === 0 && zoom > 1) {
      ctx.fillStyle = 'rgba(225,220,210,.35)';
      const p = (tm * 0.6 + k) % 1; ctx.beginPath(); ctx.arc(hx + 2, hy - 9 - p * 8, 1.5 + p * 2.5, 0, 7); ctx.fill();
    }
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
    const sz = townSize(pop) + (pop > 0 ? ' · ' + pop : ''), sw = ctx.measureText(sz).width + 10;
    ctx.fillRect(X - sw / 2, Y + 22 + fs + 8, sw, fs * 0.75 + 5);
    ctx.fillStyle = '#f3e6c8'; ctx.fillText(sz, X, Y + 22 + fs + 8 + (fs * 0.75 + 5) / 2 + 1);
  }
}

/** true when a house here would sit on track or on the station (hall, platforms, building) */
function blockedAt(g: Game, hx: number, hy: number, w: number, hall?: Hall): boolean {
  const n = g.world.n;
  for (const [ox, oy] of [[-w / 2, -6], [w / 2, -6], [-w / 2, 4], [w / 2, 4]]) {
    const x = Math.floor((hx + ox!) / TILE), y = Math.floor((hy + oy!) / TILE);
    if (g.track.has(y * n + x)) return true;
  }
  if (hall) {
    const t = hall.town, X = (t.x + 0.5) * TILE, Y = (t.y + 0.5) * TILE, side = buildingSide(g.s.seed, hall);
    const u = hall.horizontal ? hx - X : hy - Y, v = (hall.horizontal ? hy - Y : hx - X) * side;
    if (Math.abs(u) < 1.5 * TILE + w / 2 && v > -24 && v < 34) return true;
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
