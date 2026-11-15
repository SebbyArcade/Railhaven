import { hash } from '../core/rng.ts';
import { capOf, type Building, INDUSTRIES, isLinked } from '../buildings/industries.ts';
import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { bush, cottage, logEnd, logSide, person, puff } from './art.ts';

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
  wood: (ctx, tm, H, lvl) => lumberCamp(ctx, tm, H, lvl),
  dock: (ctx, tm, H, lvl) => dockArt(ctx, tm, H, lvl),
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
  stone: (ctx, tm, H, lvl) => quarry(ctx, tm, H, lvl),
  coal: (ctx, tm, H, lvl) => pithead(ctx, tm, H, lvl, ['#2a2725', '#3e3a36', '#14120f']),
  iron: (ctx, tm, H, lvl) => pithead(ctx, tm, H, lvl, ['#7a4a3a', '#9a5e48', '#5a3328']),
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

/** Wood chips, sawdust and a trodden earth yard under a building's props. */
function yardGround(ctx: CanvasRenderingContext2D, u0: number, u1: number, col: string, H: (k: number) => number, specks: string) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(u0, -13, u1 - u0, 26, 5); ctx.fill();
  ctx.fillStyle = specks;
  for (let k = 0; k < 40; k++) ctx.fillRect(u0 + 2 + H(300 + k) * (u1 - u0 - 4), -11 + H(400 + k) * 22, 0.8, 0.6);
}

/**
 * Lumber camp: a log cabin with a stone chimney, a woodcutter at the chopping block, end-on log stacks with growth
 * rings, long trunks waiting on skids, a sawbuck and a handcart, stumps all around.
 */
function lumberCamp(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) {
  yardGround(ctx, -58, 58, '#8a7350', H, 'rgba(235,205,150,.7)');
  // stumps of felled trees around the edge
  for (let k = 0; k < 6; k++) { const u = -52 + H(10 + k) * 104, v = k % 2 ? -11 : 11; logEnd(ctx, u, v, 1.6); }
  cottage(ctx, -44, 1, 22, 18, { wall: '#8a5e36', roof: '#5a4030', walls: 'logs', chimney: -0.8, tm, smoke: true });
  // a lean-to woodshed on the cabin's side, split firewood under it
  ctx.fillStyle = '#4a3424'; ctx.fillRect(-32, -6, 6, 13);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) { ctx.fillStyle = r % 2 ? '#c99a5b' : '#b8864a'; ctx.fillRect(-31.5 + k * 2.6, -5 + r * 3, 2.2, 2.4); }
  // chopping block and a woodcutter swinging his axe
  logEnd(ctx, -20, 7, 2.4);
  const sw = Math.sin(tm * 5) > 0 ? 1 : 0;
  person(ctx, -16, 8, '#a8402e', '#2e2a26');
  ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-16.5, 7); ctx.lineTo(sw ? -19.5 : -17.5, sw ? 6.2 : 3.8); ctx.stroke();
  ctx.fillStyle = '#c9ccd1'; ctx.fillRect(sw ? -20.6 : -18.6, sw ? 5.6 : 3, 1.4, 1.1);
  if (sw) { ctx.fillStyle = '#e8c890'; ctx.fillRect(-22.5, 5.5, 0.8, 0.6); ctx.fillRect(-21.8, 9, 0.7, 0.7); }
  // end-on log stacks between posts, more with each level
  const stacks = 1 + Math.min(2, lvl - 1);
  for (let s = 0; s < stacks; s++) {
    const u0 = -10 + s * 13;
    ctx.fillStyle = '#4a3424'; ctx.fillRect(u0 - 1.5, -12, 1.2, 25); ctx.fillRect(u0 + 10.3, -12, 1.2, 25);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) logEnd(ctx, u0 + 1.6 + k * 3.4 + (r % 2) * 1.2, 10 - r * 3.1 - (k % 2) * 0.2, 1.6);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) logEnd(ctx, u0 + 1.6 + k * 3.4 + (r % 2) * 1.2, -2 - r * 3.1, 1.6);
  }
  // long trunks on skids, waiting to be loaded
  const tu = -10 + stacks * 13 + 2;
  ctx.fillStyle = '#4a3424'; ctx.fillRect(tu + 2, -12, 1.4, 24); ctx.fillRect(tu + 22, -12, 1.4, 24);
  for (let k = 0; k < 4; k++) logSide(ctx, tu, tu + 28 - (k % 2) * 3, -8 + k * 4.4, 1.9);
  // sawbuck with a log on it, and a handcart
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(50, -10); ctx.lineTo(54, -4); ctx.moveTo(54, -10); ctx.lineTo(50, -4); ctx.stroke();
  logSide(ctx, 44, 58, -7, 1.4);
  ctx.fillStyle = '#7a5530'; ctx.fillRect(46, 4, 9, 6); ctx.fillStyle = '#2e2a26'; ctx.fillRect(45.2, 9.4, 2.4, 1.2); ctx.fillRect(53.4, 9.4, 2.4, 1.2);
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(46, 7); ctx.lineTo(42, 7); ctx.stroke();
  for (let k = 0; k < 3; k++) logEnd(ctx, 48.2 + k * 2.4, 6.6, 1);
  person(ctx, 40, -2, '#3f5a7a');
}

/**
 * Quarry: a pit cut into stepped benches of pale rock, a wooden derrick crane lifting a block, cut blocks stacked by
 * the platform, a workers' hut, rubble and a few quarrymen.
 */
function quarry(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) {
  yardGround(ctx, -58, 58, '#7d776c', H, 'rgba(50,46,40,.5)');
  // the pit: benches stepping down, each lit on its top edge and shaded on the cut face
  const steps = 4 + Math.min(1, lvl - 1), cols = ['#c4bdae', '#a39a8a', '#857d70', '#696257', '#4f4943'];
  for (let k = 0; k < steps; k++) {
    const w = 64 - k * 11, d = 25 - k * 4.4, u = 18 + k * 1.2, v = 0.5 + k * 0.7;
    ctx.fillStyle = cols[k]!; ctx.beginPath(); ctx.roundRect(u - w / 2, v - d / 2, w, d, 3); ctx.fill();
    ctx.fillStyle = 'rgba(40,34,28,.55)'; ctx.fillRect(u - w / 2 + 2, v - d / 2, w - 4, 2.4); // the cut face below the bench
    ctx.fillStyle = 'rgba(40,34,28,.35)'; ctx.fillRect(u - w / 2, v - d / 2 + 2, 1.6, d - 4);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(u - w / 2 + 2, v + d / 2 - 0.8, w - 4, 0.6);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 0.3; // drill lines in the rock
    for (let x = u - w / 2 + 4; x < u + w / 2 - 3; x += 3.5) { ctx.beginPath(); ctx.moveTo(x, v - d / 2 + 1.4); ctx.lineTo(x + 0.6, v - d / 2 + 3.4); ctx.stroke(); }
  }
  // loose blocks on the benches, rubble
  for (let k = 0; k < 8; k++) { const u = -6 + H(50 + k) * 48, v = -8 + H(60 + k) * 16; ctx.fillStyle = '#c8c2b4'; ctx.fillRect(u, v, 2.4, 1.8); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(u, v + 1.8, 2.4, 0.5); }
  for (let k = 0; k < 20; k++) { ctx.fillStyle = 'rgba(70,66,60,.6)'; ctx.fillRect(-4 + H(80 + k) * 50, -10 + H(90 + k) * 20, 0.8, 0.8); }
  // quarrymen in the pit
  person(ctx, 14, 2, '#c8a040', '#d0a020'); person(ctx, 26, -3, '#5a6a7a', '#d0a020');
  // derrick: a mast with guy ropes, a boom swinging over the pit, a block hanging from it
  const a = -0.25 + Math.sin(tm * 0.6) * 0.45, mu = -16, mv = 0, bl = 24;
  ctx.strokeStyle = 'rgba(60,50,40,.45)'; ctx.lineWidth = 0.3;
  for (const [gu, gv] of [[-26, -12], [-26, 12], [-6, 12]]) { ctx.beginPath(); ctx.moveTo(mu, mv); ctx.lineTo(gu!, gv!); ctx.stroke(); }
  const bu = mu + Math.cos(a) * bl, bv = mv + Math.sin(a) * bl * 0.5;
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(mu + 1, mv + 1.5); ctx.lineTo(bu + 1, bv + 1.5); ctx.stroke();
  ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mu, mv); ctx.lineTo(bu, bv); ctx.stroke();
  ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.arc(mu, mv, 1.8, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a3532'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(bu, bv); ctx.lineTo(bu, bv + 3); ctx.stroke();
  ctx.fillStyle = '#d4cec0'; ctx.fillRect(bu - 1.8, bv + 3, 3.6, 2.6); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bu - 1.8, bv + 5.2, 3.6, 0.5);
  // cut blocks stacked for loading, more with each level
  const piles = 2 + Math.min(2, lvl - 1);
  for (let p = 0; p < piles; p++) for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
    const u = -56 + p * 7 + k * 3, v = -11 + r * 3.4 + (p % 2) * 13;
    ctx.fillStyle = '#9a958a'; ctx.fillRect(u, v + 2.4, 2.8, 0.8);
    ctx.fillStyle = '#d6d0c2'; ctx.fillRect(u, v, 2.8, 2.4);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(u, v, 2.8, 0.5);
  }
  cottage(ctx, -38, 6, 12, 10, { wall: '#c8bfae', roof: '#5b6066', chimney: 0.6, tm, smoke: true });
  person(ctx, -30, -6, '#7a4a3a');
}

/**
 * Coal or iron mine: a brick engine house with a tall chimney, a steel headframe over the shaft with two turning
 * winding wheels and cables to the engine house, a narrow track where a tub runs to the heap, and miners in helmets.
 */
function pithead(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number, heap: [string, string, string]) {
  yardGround(ctx, -58, 58, '#6e665a', H, 'rgba(30,26,22,.55)');
  // engine house with its round chimney
  cottage(ctx, -44, 3, 20, 15, { wall: '#9a4a34', roof: '#3e3a38', walls: 'brick', storeys: 2, door: true });
  const cu = -52, cv = -8;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(cu + 2.4, cv + 2.6, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a3c2a'; ctx.beginPath(); ctx.arc(cu, cv, 3.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#6a2c1e'; ctx.beginPath(); ctx.arc(cu, cv, 2.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(cu, cv, 1.6, 0, 7); ctx.fill();
  puff(ctx, cu, cv - 2, tm, true, 1.3);
  // the shaft: a timber collar round a dark hole, the cage just visible
  const su = -18, sv = 4;
  ctx.fillStyle = '#5a4630'; ctx.fillRect(su - 5, sv - 4, 10, 8);
  ctx.fillStyle = '#141210'; ctx.fillRect(su - 3.6, sv - 2.6, 7.2, 5.2);
  const cage = (Math.sin(tm * 0.9) + 1) / 2;
  ctx.fillStyle = `rgba(160,150,130,${0.25 + cage * 0.6})`; ctx.fillRect(su - 2.6, sv - 1.8, 5.2, 3.6);
  // headframe: two lattice legs leaning back to the engine house, the wheels on top
  const top = sv - 13;
  const lattice = (u0: number, v0: number, u1: number, v1: number) => {
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(u0 + 2, v0 + 2); ctx.lineTo(u1 + 2, v1 + 2); ctx.stroke();
    ctx.strokeStyle = '#3a4a52'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.stroke();
    ctx.strokeStyle = '#6a7a84'; ctx.lineWidth = 0.3;
    const steps = 6;
    for (let k = 0; k < steps; k++) { const t0 = k / steps, t1 = (k + 1) / steps; ctx.beginPath(); ctx.moveTo(u0 + (u1 - u0) * t0 - 0.8, v0 + (v1 - v0) * t0); ctx.lineTo(u0 + (u1 - u0) * t1 + 0.8, v0 + (v1 - v0) * t1); ctx.stroke(); }
  };
  lattice(su - 4, sv + 3, su - 2, top); lattice(su + 4, sv + 3, su + 2, top);
  lattice(su - 14, sv + 2, su - 1, top + 1); // back stay toward the engine house
  ctx.fillStyle = '#3a4a52'; ctx.fillRect(su - 4, top - 1, 8, 2);
  for (const k of [-1, 1]) {
    ctx.save(); ctx.translate(su + k * 2.4, top); ctx.rotate(tm * 2.4 * k);
    ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.stroke();
    ctx.lineWidth = 0.3; for (let s = 0; s < 3; s++) { const r = s * 1.047; ctx.beginPath(); ctx.moveTo(Math.cos(r) * -2.6, Math.sin(r) * -2.6); ctx.lineTo(Math.cos(r) * 2.6, Math.sin(r) * 2.6); ctx.stroke(); }
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(30,30,30,.7)'; ctx.lineWidth = 0.25; // winding cables to the engine house
  ctx.beginPath(); ctx.moveTo(su - 2.4, top); ctx.lineTo(-36, -2); ctx.moveTo(su + 2.4, top); ctx.lineTo(-36, 0); ctx.stroke();
  // the heap of what it digs, lumpy, growing with level
  const hu = 34, hw = 16 + lvl * 3, hd = 10;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(hu + 2, 3, hw, hd, 0, 0, 7); ctx.fill();
  ctx.fillStyle = heap[0]; ctx.beginPath(); ctx.ellipse(hu, 1, hw, hd, 0, 0, 7); ctx.fill();
  ctx.fillStyle = heap[1]; ctx.beginPath(); ctx.ellipse(hu - hw * 0.25, -2, hw * 0.55, hd * 0.5, 0, 0, 7); ctx.fill();
  for (let k = 0; k < 30; k++) {
    const a = H(500 + k) * 6.283, r = Math.sqrt(H(600 + k));
    ctx.fillStyle = k % 3 ? heap[2] : heap[1]; ctx.fillRect(hu + Math.cos(a) * hw * r * 0.9, 1 + Math.sin(a) * hd * r * 0.9, 1.1, 0.9);
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(hu - hw * 0.35, -3, hw * 0.25, hd * 0.2, 0, 0, 7); ctx.fill();
  // narrow track from the shaft up onto the heap, a tub running along it
  ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 0.6;
  for (let u = su + 6; u < hu - 4; u += 2) { ctx.beginPath(); ctx.moveTo(u, 7.6); ctx.lineTo(u, 10.4); ctx.stroke(); }
  ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(su + 5, 8.2); ctx.lineTo(hu - 4, 8.2); ctx.moveTo(su + 5, 9.8); ctx.lineTo(hu - 4, 9.8); ctx.stroke();
  const p = (Math.sin(tm * 0.7) + 1) / 2, tu = su + 7 + p * (hu - su - 14);
  ctx.fillStyle = '#4a4440'; ctx.fillRect(tu - 2.4, 7.4, 4.8, 3.2);
  ctx.fillStyle = heap[1]; ctx.fillRect(tu - 1.8, 7.8, 3.6, 2.2);
  person(ctx, tu - 4.5, 9, '#4a5a6a', '#e0c040');
  // lamp room and a miner at the shaft
  cottage(ctx, -4, -8, 9, 8, { wall: '#c8bfae', roof: '#4c4844', door: true });
  person(ctx, -12, 9, '#3a3a40', '#e0c040');
  void bush;
}

/**
 * Dock: a plank pier on pilings over the water, a quayside crane swinging, crates and barrels, a harbour office,
 * bollards with mooring ropes, and a little steamer bobbing at the berth (a second one from level 2).
 */
function dockArt(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) {
  // pilings showing under the deck edge, with ripples
  for (let u = -56; u <= 56; u += 8) {
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(u, 9.5 + Math.sin(tm * 2 + u) * 0.3, 2.6, 0.9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3424'; ctx.fillRect(u - 0.9, 6, 1.8, 3.4);
  }
  // the deck: planks across, a darker edge beam
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-59, -13, 118, 21);
  ctx.fillStyle = '#9a7a52'; ctx.fillRect(-60, -14, 120, 20);
  ctx.strokeStyle = 'rgba(60,40,20,.35)'; ctx.lineWidth = 0.35;
  for (let u = -60; u <= 60; u += 2.2) { ctx.beginPath(); ctx.moveTo(u, -14); ctx.lineTo(u, 6); ctx.stroke(); }
  for (let k = 0; k < 12; k++) { ctx.fillStyle = 'rgba(40,26,12,.35)'; ctx.fillRect(-58 + H(700 + k) * 116, -13 + H(710 + k) * 18, 0.6, 0.6); } // nail heads
  ctx.fillStyle = '#5a4030'; ctx.fillRect(-60, 5, 120, 1.6);
  // bollards with ropes out to the boat
  for (const u of [-44, -8, 26]) { ctx.fillStyle = '#2e2a26'; ctx.beginPath(); ctx.arc(u, 4, 1.2, 0, 7); ctx.fill(); }
  // the steamer at the berth: hull, deck, funnel with a red band, smoke
  const boat = (u0: number, k: number) => {
    const bob = Math.sin(tm * 1.6 + k) * 0.6, v0 = 13 + bob;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(u0 + 1, v0 + 1.5, 15, 4.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2e3a4a'; ctx.beginPath(); ctx.moveTo(u0 - 15, v0 - 3); ctx.lineTo(u0 + 11, v0 - 3); ctx.quadraticCurveTo(u0 + 17, v0, u0 + 11, v0 + 3); ctx.lineTo(u0 - 15, v0 + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8cdb4'; ctx.fillRect(u0 - 13, v0 - 2, 22, 4);
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(u0 - 6, v0 - 1.6, 8, 3.2);
    ctx.fillStyle = '#6f93a8'; for (let w = 0; w < 3; w++) ctx.fillRect(u0 - 5 + w * 2.6, v0 - 0.4, 1.2, 0.9);
    ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.arc(u0 + 4, v0, 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8402e'; ctx.beginPath(); ctx.arc(u0 + 4, v0, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(u0 + 4, v0, 0.8, 0, 7); ctx.fill();
    puff(ctx, u0 + 4, v0 - 2, tm + k, true, 0.8);
    ctx.strokeStyle = 'rgba(220,200,160,.8)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(u0 - 12, v0 - 3); ctx.lineTo(u0 - 14, 4); ctx.moveTo(u0 + 9, v0 - 3); ctx.lineTo(u0 + 12, 4); ctx.stroke();
  };
  boat(-26, 0); if (lvl >= 2) boat(30, 2);
  // crates and barrels waiting on the quay
  for (let k = 0; k < 6; k++) { const u = 8 + (k % 3) * 4, v = -12 + ((k / 3) | 0) * 4; ctx.fillStyle = '#8a6a40'; ctx.fillRect(u, v, 3.4, 3.4); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.3; ctx.strokeRect(u, v, 3.4, 3.4); ctx.beginPath(); ctx.moveTo(u, v); ctx.lineTo(u + 3.4, v + 3.4); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { const u = 24 + k * 3.2; ctx.fillStyle = '#6a4a2e'; ctx.beginPath(); ctx.arc(u, -10, 1.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(u, -10, 1, 0, 7); ctx.stroke(); }
  // harbour office
  cottage(ctx, 46, -5, 14, 11, { wall: '#e8e0cc', roof: '#3f5a7a', chimney: 0.6, tm, smoke: true });
  // quay crane: a turning jib over the water with a hook and a sling of crates
  const a = Math.PI / 2 + Math.sin(tm * 0.5) * 0.9, cu = -40, cv = -6, L = 16;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(cu - 2.5, cv - 1.5, 6, 6);
  ctx.fillStyle = '#b8862e'; ctx.fillRect(cu - 3, cv - 2, 6, 6);
  const ju = cu + Math.cos(a) * L, jv = cv + Math.sin(a) * L * 0.8;
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cu + 1.5, cv + 2); ctx.lineTo(ju + 1.5, jv + 2); ctx.stroke();
  ctx.strokeStyle = '#d0a020'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cu, cv); ctx.lineTo(ju, jv); ctx.stroke();
  ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 0.3; for (let k = 1; k < 6; k++) { const p = k / 6; ctx.beginPath(); ctx.moveTo(cu + (ju - cu) * p - 0.6, cv + (jv - cv) * p); ctx.lineTo(cu + (ju - cu) * p + 0.6, cv + (jv - cv) * p + 0.8); ctx.stroke(); }
  ctx.fillStyle = '#8a6a40'; ctx.fillRect(ju - 1.6, jv + 1.4, 3.2, 2.4);
  ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(ju, jv); ctx.lineTo(ju, jv + 1.4); ctx.stroke();
  person(ctx, -30, -10, '#3f5a7a', '#2a3a4a'); person(ctx, 18, -2, '#a8402e');
}
