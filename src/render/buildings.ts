import { hash } from '../core/rng.ts';
import { capOf, type Building, INDUSTRIES, isLinked } from '../buildings/industries.ts';
import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';

const CRATE: Record<string, string> = { wood: '#8a5a2e', farm: '#d8b44a', stone: '#9a958c', coal: '#2e2b28', iron: '#8a5a4a', oil: '#3a3a48', wool: '#efeadf', sawmill: '#e0b878', brickworks: '#b5523b', gristmill: '#f4efe2', mill: '#9aa0a8', refinery: '#4a4a58', textile: '#5a7ab0' };

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

/** A factory hall: brick walls, a sawtooth roof of north lights, a tall chimney (busy factories smoke). */
function hall(ctx: CanvasRenderingContext2D, tm: number, u: number, w: number, wall: string, roof: string, busy: boolean, lvl: number) {
  const d = 22, v = 0;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(u - w / 2 + 2, v - d / 2 + 2, w, d);
  ctx.fillStyle = wall; ctx.fillRect(u - w / 2, v - d / 2, w, d);
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.8; ctx.strokeRect(u - w / 2, v - d / 2, w, d);
  const teeth = Math.max(3, Math.round(w / 7));
  for (let k = 0; k < teeth; k++) { // each tooth: dark slope and a strip of glass catching the light
    const x = u - w / 2 + k * (w / teeth);
    const tw = w / teeth;
    ctx.fillStyle = roof; ctx.fillRect(x + 0.5, v - d / 2 + 1, tw - 1, d - 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 0.5, v - d / 2 + 1, (tw - 1) * 0.45, d - 2); // the slope facing the light
    ctx.fillStyle = 'rgba(200,225,240,.9)'; ctx.fillRect(x + tw - 2.4, v - d / 2 + 1, 1.8, d - 2); // north-light glazing
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + tw - 0.6, v - d / 2 + 1, 0.6, d - 2);
  }
  // chimney: taller by level
  const cx = u + w / 2 - 4, cy = v - d / 2 + 3, r = 2.6 + lvl * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(cx + 2, cy + 2, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a3a2a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a211c'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 7); ctx.fill();
  if (busy) smoke(ctx, cx, cy - 2, tm, true);
}

const FACTORY_ART = {
  sawmill: (ctx, tm, H, lvl) => { // timber hall, a log pile going in and stacked planks coming out
    hall(ctx, tm, -26, 36, '#b07a48', '#8a6a52', true, lvl);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - (r % 2); k++) { const x = 4 + k * 4.4 + (r % 2) * 2.2, y = 8 - r * 3.2; ctx.fillStyle = '#7a4e28'; ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 7); ctx.fill(); ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill(); }
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = k % 2 ? '#e0b878' : '#d2a868'; ctx.fillRect(28, 7 - k * 3, 20, 2.4); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(28, 9.4 - k * 3, 20, 0.6); }
    const a = tm * 6; ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-4, -8, 3, a, a + 5); ctx.stroke(); // the saw blade
    void H;
  },
  brickworks: (ctx, tm, H, lvl) => { // a round kiln glowing, a drying shed, stacks of red bricks
    hall(ctx, tm, -30, 28, '#9a4a36', '#5e3428', false, lvl);
    const glow = 0.5 + 0.5 * Math.sin(tm * 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(2, 2, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#a0583c'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a3a28'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,${140 + 60 * glow},60,.9)`; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
    smoke(ctx, 0, -3, tm, true);
    for (let k = 0; k < 3 + lvl; k++) { const x = 18 + (k % 3) * 9, y = 6 - Math.floor(k / 3) * 7; ctx.fillStyle = '#b5523b'; ctx.fillRect(x, y - 3, 7, 5); ctx.strokeStyle = 'rgba(60,20,10,.5)'; ctx.lineWidth = 0.4; ctx.strokeRect(x, y - 3, 7, 5); ctx.beginPath(); ctx.moveTo(x, y - 0.5); ctx.lineTo(x + 7, y - 0.5); ctx.stroke(); }
    void H;
  },
  gristmill: (ctx, tm, H, lvl) => { // a windmill with turning sails, the mill house and flour sacks
    hall(ctx, tm, -28, 30, '#d8cdb4', '#7a6a50', false, lvl);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(14, 2, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.arc(12, 0, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#6e5a44'; ctx.beginPath(); ctx.arc(12, 0, 4.5, 0, 7); ctx.fill();
    const a = tm * 1.4; ctx.save(); ctx.translate(12, 0); ctx.rotate(a);
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = '#5b4330'; ctx.fillRect(-0.6, 2, 1.2, 14); ctx.fillStyle = 'rgba(240,232,214,.9)'; ctx.fillRect(0.6, 5, 3.2, 10); }
    ctx.restore();
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = '#efe9d8'; ctx.beginPath(); ctx.ellipse(32 + (k % 3) * 6, 7 - Math.floor(k / 3) * 5, 2.6, 2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#b8a888'; ctx.lineWidth = 0.4; ctx.stroke(); }
    void H;
  },
  mill: (ctx, tm, H, lvl) => { // a steel works: two smoking stacks, furnace glow, steel beams
    hall(ctx, tm, -22, 40, '#5a4e56', '#3a343a', true, lvl);
    const glow = 0.5 + 0.5 * Math.sin(tm * 3);
    ctx.fillStyle = `rgba(255,${120 + 80 * glow},40,.85)`; ctx.fillRect(-30, 8, 10, 2.4);
    for (const x of [8, 16]) { ctx.fillStyle = '#4a4248'; ctx.beginPath(); ctx.arc(x, -6, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#1e1a1c'; ctx.beginPath(); ctx.arc(x, -6, 1.6, 0, 7); ctx.fill(); smoke(ctx, x, -8, tm + x, true); }
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(26, 8 - k * 3, 22, 2); ctx.fillStyle = '#6a7078'; ctx.fillRect(26, 9.4 - k * 3, 22, 0.6); }
    void H;
  },
  refinery: (ctx, tm, H, lvl) => { // round tanks, pipes and a gas flare
    hall(ctx, tm, -32, 24, '#7a7e86', '#4a4e56', false, lvl);
    for (const [x, y, r] of [[-6, -2, 8], [12, 3, 7], [28, -2, 6]] as const) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x + 1.5, y + 1.5, r, 0, 7); ctx.fill(); ctx.fillStyle = '#d6d9de'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#9a9ea6'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = '#8a8d92'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-20, 6); ctx.lineTo(40, 6); ctx.stroke();
    ctx.fillStyle = '#5b6066'; ctx.fillRect(42, -8, 2, 14);
    const f = Math.sin(tm * 9) * 0.8; ctx.fillStyle = 'rgba(255,170,40,.9)'; ctx.beginPath(); ctx.moveTo(41, -8); ctx.quadraticCurveTo(43 + f, -16, 45, -8); ctx.fill();
    void lvl; void H;
  },
  textile: (ctx, tm, H, lvl) => { // a long weaving shed, wool bales in, rolls of coloured cloth out
    hall(ctx, tm, -14, 52, '#a8705a', '#5e4038', true, lvl);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#f2eee4'; ctx.beginPath(); ctx.ellipse(-50 + k * 5, 8, 2.4, 2, 0, 0, 7); ctx.fill(); }
    const cols = ['#c0392b', '#2f6f9a', '#e8a33c', '#5a9a4a'];
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = cols[k % 4]!; ctx.fillRect(18 + (k % 3) * 8, 6 - Math.floor(k / 3) * 5, 7, 3.4); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(18 + (k % 3) * 8, 6 - Math.floor(k / 3) * 5, 7, 0.8); }
    void H;
  },
} satisfies Record<string, Art>;

const ART: Record<Building['kind'], Art> = {
  ...FACTORY_ART,
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
    // the home field by the barn: ripe wheat in rows, ears swaying, a hedge along its far side
    ctx.fillStyle = '#d9b54e'; ctx.fillRect(-7, -13, 64, 26);
    ctx.strokeStyle = '#b8902e'; ctx.lineWidth = 1.1;
    for (let r = -10; r < 13; r += 3.2) { ctx.beginPath(); for (let u = -7; u <= 57; u += 5) ctx.lineTo(u, r + Math.sin(u * 0.35) * 0.4); ctx.stroke(); }
    ctx.fillStyle = '#f3dc8a';
    for (let k = 0; k < 40; k++) { const u = -5 + H(100 + k) * 60, v = -11 + H(200 + k) * 22; ctx.fillRect(u + Math.sin(tm * 1.8 + u * 0.08) * 0.9, v, 0.9, 2); }
    ctx.strokeStyle = '#3f6a2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, 13); ctx.lineTo(57, 13); ctx.stroke();
    for (let k = 0; k < 9; k++) { ctx.fillStyle = k % 2 ? '#4f7f38' : '#3b6329'; ctx.beginPath(); ctx.arc(-5 + k * 7.5, 13, 1.8, 0, 7); ctx.fill(); }
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
