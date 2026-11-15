import { hash } from '../core/rng.ts';
import { capOf, type Building, INDUSTRIES, isLinked } from '../buildings/industries.ts';
import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';

const CRATE: Record<string, string> = { wood: '#8a5a2e', farm: '#d8b44a', stone: '#9a958c', coal: '#2e2b28', iron: '#8a5a4a', oil: '#3a3a48', wool: '#efeadf' };

/**
 * An industry in its yard, as a little model: a loading platform along the yard, the building and its props on the
 * row beside it, and crates that pile up with the stock. Drawn in the building's own frame: u along the yard,
 * v across it with the yard tracks at negative v.
 */
export function drawBuilding(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number, zoom: number) {
  const T = TILE, n = g.world.n;
  const cx = b.horizontal ? (b.x + 2) * T : (b.x + b.side + 0.5) * T, cy = b.horizontal ? (b.y + b.side + 0.5) * T : (b.y + 2) * T;
  const rot = b.horizontal ? (b.side > 0 ? 0 : Math.PI) : (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const L = 4 * T - 6, H = (k: number) => hash(g.s.seed, b.x, b.y, k);
  // loading platform along the yard
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-L / 2 + 1, -19.4 + 1.2, L, 4.4);
  ctx.fillStyle = '#d0c4a8'; ctx.fillRect(-L / 2, -19.4, L, 4.4);
  ctx.fillStyle = '#efe3a8'; ctx.fillRect(-L / 2, -19.4, L, 0.6);
  // crates on the platform, more as the stock grows
  const crates = Math.round(10 * Math.min(1, b.stock / capOf(b))), col = CRATE[b.kind] ?? '#8a6a40';
  for (let k = 0; k < crates; k++) {
    const u = -L / 2 + 6 + k * 11, row = k % 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u + 0.8, -18.6 + row * 0 + 0.8, 5, 3.2);
    ctx.fillStyle = col; ctx.fillRect(u, -18.6, 5, 3.2);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.4; ctx.strokeRect(u, -18.6, 5, 3.2);
  }
  ART[b.kind](ctx, tm, H, b.lvl);
  ctx.restore();
  // name, when close or when it is the only thing that tells you what this is
  if (zoom >= 1.6) {
    const d = INDUSTRIES[b.kind], fs = 9;
    ctx.font = `600 ${fs}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = `${d.icon} ${d.name}${b.lvl > 1 ? ' ' + b.lvl : ''}`, w = ctx.measureText(label).width + 8;
    const lx = cx, ly = cy + (b.horizontal ? b.side * 20 : 22);
    ctx.fillStyle = 'rgba(30,24,16,.8)'; ctx.fillRect(lx - w / 2, ly - 6, w, 12);
    ctx.fillStyle = '#f6e7c6'; ctx.fillText(label, lx, ly + 0.5);
  }
  if (!isLinked(g, b)) { // not on the railway yet: a small red sign on the yard end
    const ys = b.horizontal ? [(b.x + 0.5) * T, (b.y + 0.5) * T] : [(b.x + 0.5) * T, (b.y + 0.5) * T];
    const p = 0.6 + 0.4 * Math.sin(tm * 4);
    ctx.fillStyle = `rgba(220,60,40,${p})`; ctx.beginPath(); ctx.arc(ys[0]!, ys[1]!, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', ys[0]!, ys[1]! + 0.5);
  }
  void n;
}

type Art = (ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) => void;

function house(ctx: CanvasRenderingContext2D, u: number, v: number, w: number, d: number, wall: string, roof: string) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u - w / 2 + 1.5, v - d / 2 + 1.5, w, d);
  ctx.fillStyle = wall; ctx.fillRect(u - w / 2, v - d / 2, w, d);
  ctx.fillStyle = roof; ctx.fillRect(u - w / 2 - 0.8, v - d / 2 + d * 0.2, w + 1.6, d * 0.6);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(u - w / 2 - 0.8, v - d / 2 + d * 0.2, w + 1.6, 0.8);
}
function smoke(ctx: CanvasRenderingContext2D, u: number, v: number, tm: number, dark = false) {
  for (let k = 0; k < 2; k++) { const p = (tm * 0.5 + k * 0.5) % 1; ctx.fillStyle = dark ? `rgba(60,58,55,${0.45 * (1 - p)})` : `rgba(225,220,210,${0.4 * (1 - p)})`; ctx.beginPath(); ctx.arc(u + p * 3, v - p * 10, 1.4 + p * 3, 0, 7); ctx.fill(); }
}

const ART: Record<Building['kind'], Art> = {
  wood: (ctx, tm, H, lvl) => { // log cabin, stacked logs, a sawhorse
    house(ctx, -34, 0, 18, 13, '#8a5e36', '#5a3a22'); smoke(ctx, -38, -5, tm);
    for (let r = 0; r < 3 + lvl; r++) for (let k = 0; k < 4 - (r % 2); k++) { ctx.fillStyle = '#7a4e28'; ctx.beginPath(); ctx.arc(-8 + k * 4.4 + (r % 2) * 2.2, 8 - r * 3.2, 1.9, 0, 7); ctx.fill(); ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.arc(-8 + k * 4.4 + (r % 2) * 2.2, 8 - r * 3.2, 0.9, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(30, 4); ctx.moveTo(18, 4); ctx.lineTo(30, -4); ctx.stroke();
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(16, -1, 16, 2);
    void H;
  },
  farm: (ctx, tm, H) => { // barn, silo, golden field rows
    house(ctx, -36, -1, 20, 14, '#a8402e', '#6e2a20'); ctx.fillStyle = '#efe6d2'; ctx.fillRect(-38, 3, 4, 3.5);
    ctx.fillStyle = '#c9c2b0'; ctx.beginPath(); ctx.arc(-18, -2, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.arc(-18, -2, 2.4, 0, 7); ctx.fill();
    for (let r = 0; r < 5; r++) { ctx.fillStyle = r % 2 ? '#d8b44a' : '#c49a34'; ctx.fillRect(-6, -12 + r * 5, 62, 3.6); }
    const sway = Math.sin(tm * 1.5) * 0.6; ctx.fillStyle = 'rgba(255,240,170,.35)'; for (let k = 0; k < 10; k++) ctx.fillRect(-4 + k * 6 + sway, -12 + (k % 5) * 5, 1, 3.6);
    void H;
  },
  stone: (ctx, tm, H, lvl) => { // a stepped quarry pit and a little crane
    ctx.fillStyle = '#6f6a62'; ctx.beginPath(); ctx.ellipse(10, 2, 30, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a857b'; ctx.beginPath(); ctx.ellipse(10, 2, 22, 7.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#a19b90'; ctx.beginPath(); ctx.ellipse(10, 2, 13, 4, 0, 0, 7); ctx.fill();
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = '#b8b2a6'; ctx.fillRect(-46 + k * 6, 6 - (k % 2) * 3, 4.5, 3.5); }
    const a = Math.sin(tm * 0.8) * 0.5; ctx.strokeStyle = '#d0a020'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(-30 + Math.cos(a) * 18, -6 + Math.sin(a) * 6); ctx.stroke();
    house(ctx, -40, -6, 9, 7, '#c8bfae', '#5b6066');
    void H;
  },
  coal: (ctx, tm, _H, lvl) => headframe(ctx, tm, '#2e2b28', lvl),
  iron: (ctx, tm, _H, lvl) => headframe(ctx, tm, '#7a4a3a', lvl),
  oil: (ctx, tm) => { // pumpjack nodding, a storage tank
    ctx.fillStyle = '#5b6066'; ctx.fillRect(-14, 6, 26, 3);
    const a = Math.sin(tm * 2) * 0.35; ctx.save(); ctx.translate(-2, 0); ctx.rotate(a);
    ctx.fillStyle = '#2b2b38'; ctx.fillRect(-14, -1.5, 26, 3); ctx.fillStyle = '#d0a020'; ctx.fillRect(10, -3, 4, 6); ctx.restore();
    ctx.fillStyle = '#3a3a48'; ctx.fillRect(-3, -1, 2, 8);
    ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.arc(32, 0, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a8d92'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(32, 0, 6, 0, 7); ctx.stroke();
  },
  wool: (ctx, tm, H) => { // barn and grazing sheep
    house(ctx, -38, 0, 18, 12, '#9c7a52', '#5e4a36');
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 0.7; ctx.strokeRect(-22, -11, 76, 22);
    for (let k = 0; k < 7; k++) {
      const u = -16 + H(k) * 64 + Math.sin(tm * 0.3 + k) * 1.5, v = -8 + H(k + 9) * 16;
      ctx.fillStyle = '#f2eee4'; ctx.beginPath(); ctx.ellipse(u, v, 2.6, 1.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2622'; ctx.beginPath(); ctx.arc(u + 2.4, v, 0.9, 0, 7); ctx.fill();
    }
  },
};

function headframe(ctx: CanvasRenderingContext2D, tm: number, heap: string, lvl: number) {
  // winding house, a pithead frame with a turning wheel, and a heap of what it digs
  house(ctx, -34, 2, 16, 12, '#8c3f2c', '#4c3b33'); smoke(ctx, -30, -6, tm, true);
  ctx.strokeStyle = '#3a3532'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(-6, -8); ctx.lineTo(0, 8); ctx.stroke();
  ctx.save(); ctx.translate(-6, -8); ctx.rotate(tm * 2); ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 7); ctx.moveTo(-3.2, 0); ctx.lineTo(3.2, 0); ctx.moveTo(0, -3.2); ctx.lineTo(0, 3.2); ctx.stroke(); ctx.restore();
  ctx.fillStyle = heap; ctx.beginPath(); ctx.ellipse(26, 3, 16 + lvl * 3, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.ellipse(23, 0, 8, 3, 0, 0, 7); ctx.fill();
}
