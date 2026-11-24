import { hash } from '../core/rng.ts';
import { buildingSquares, buildingUp, capOf, type Building, GOODS, type Good, INDUSTRIES, isLinked, tracksOf, yardLen, yardSquares } from '../buildings/industries.ts';
import type { Game } from '../state.ts';
import { barriersDown } from '../buildings/closing.ts';
import { TILE } from '../world/terrain.ts';
import { clipBuilt, drawSiteGround, drawSiteWork } from './construction.ts';
import { upright, barrel, bush, cart, cottage, crate, dog, flowers, hayBale, hen, lamp, logEnd, logSide, person, pine, puff, sack, stoneWall } from './art.ts';

const CRATE: Record<string, string> = { wood: '#8a5a2e', farm: '#d8b44a', stone: '#9a958c', coal: '#2e2b28', iron: '#8a5a4a', oil: '#3a3a48', wool: '#efeadf', sawmill: '#e0b878', brickworks: '#b5523b', gristmill: '#f4efe2', mill: '#9aa0a8', refinery: '#4a4a58', textile: '#5a7ab0', cannery: '#c0c6cc' , glassworks: '#bfe0ee', toolworks: '#7a7e86', furniture: '#a87444', gold: '#e0b84a', gems: '#9ae0ff', jeweller: '#7a1e3a', cocoa: '#8a5a3a', chocolate: '#5a321e', rubber: '#e8e4d8', tyreworks: '#1e1e20' };

/** Goods that look like heaps of stone or ore rather than crates. */
const HEAPED = new Set(['stone', 'coal', 'iron', 'gold', 'gems']);

/** Up to 30 goods on the loading platform (10 along it, three layers high), drawn as the good itself. */
function stockPile(ctx: CanvasRenderingContext2D, b: Building, L: number) {
  const n = Math.round(30 * Math.min(1, Math.max(0, b.stock) / capOf(b))), col = CRATE[b.kind] ?? '#8a6a40';
  for (let k = 0; k < n; k++) {
    const layer = Math.floor(k / 10), i = k % 10;
    // each layer sits a little higher (toward the building) and is a little narrower, like a heap
    const u = -L / 2 + 7 + i * 11 + layer * 2.2, v = -17.2 - layer * 1.3;
    if (i >= 10 - layer) continue; // the top layers are shorter
    if (b.kind === 'wood') logSide(ctx, u - 3.4, u + 3.4, v, 1.15);
    else if (b.kind === 'farm') sack(ctx, u, v, '#e2c060');
    else if (b.kind === 'wool') sack(ctx, u, v, '#f4f0e6');
    else if (HEAPED.has(b.kind)) {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(u + 0.6, v + 0.7, 2.6, 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(u, v, 2.6, 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(u - 0.9, v - 0.5, 0.7, 0, 7); ctx.fill();
    } else crate(ctx, u - 1.6, v - 1.6, 3.2, col);
  }
}

/** How much is in store: [have, cap, full]. */
function stockOf(b: Building): [number, number, boolean] {
  const cap = capOf(b), have = Math.min(cap, Math.floor(Math.max(0, b.stock)));
  return [have, cap, have >= cap];
}

/**
 * Zoomed out (no name label): "🪵 64" in a small, soft tag at the far end of the building, so it doesn't sit on the
 * art. The number turns amber when the store is full. Constant size on screen.
 */
function stockChip(ctx: CanvasRenderingContext2D, b: Building, cx: number, cy: number, zoom: number) {
  const [have, , full] = stockOf(b);
  const k = 1 / zoom, icon = GOODS[INDUSTRIES[b.kind].makes as Good]?.icon ?? '📦';
  const e = (yardLen(b) / 2 - 0.4) * TILE, ex = b.horizontal ? cx + e : cx, ey = b.horizontal ? cy : cy + e;
  ctx.save(); ctx.translate(ex, ey); ctx.scale(k, k);
  ctx.font = '600 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = `${icon}${have}`, w = ctx.measureText(text).width + 8, h = 13;
  ctx.fillStyle = 'rgba(30,24,16,.55)';
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6.5); ctx.fill();
  ctx.fillStyle = full ? '#ffc35a' : '#f6e7c6'; ctx.fillText(text, 0, 0.5);
  ctx.restore();
}

/**
 * A dock's quay: where its yard track runs on a thin strip of land (one square wide, or the tip of a spit), the shore
 * is built up into a stone quay wall, so the rails stand on solid ground instead of seeming to float on the sea.
 * Drawn under the rails.
 */
export function drawQuay(ctx: CanvasRenderingContext2D, g: Game, b: Building) {
  if (b.kind !== 'dock') return;
  const n = g.world.n, T = TILE, t = g.world.terr, pier = new Set(buildingSquares(n, b)), yard = yardSquares(n, b);
  const water = (j: number) => j >= 0 && j < n * n && t[j] === 0 && !pier.has(j);
  for (const i of yard) {
    const x = i % n, y = (i / n) | 0, X = x * T, Y = y * T;
    // E S W N: the sides of this square that face open water (not the pier, which stands over it anyway)
    const sides = [[x < n - 1 && water(i + 1), 0], [water(i + n), 1], [x > 0 && water(i - 1), 2], [water(i - n), 3]].filter(s => s[0]).map(s => s[1] as number);
    if (!sides.length) continue;
    // packed gravel over the whole square (the sand strips would show the sea through)
    ctx.fillStyle = '#a39276'; ctx.fillRect(X, Y, T, T);
    ctx.fillStyle = 'rgba(70,56,36,.18)';
    for (let k = 0; k < 10; k++) ctx.fillRect(X + 2 + hash(g.s.seed, x, y, 300 + k) * (T - 4), Y + 2 + hash(g.s.seed, y, x, 310 + k) * (T - 4), 1, 1);
    for (const d of sides) {
      // the wall: dressed stone blocks along the water side, a little out over the water, with its shadow on the sea
      const W = 4, horiz = d === 1 || d === 3, out = d === 0 || d === 1 ? 1 : -1;
      const wx = d === 0 ? X + T - 1 : d === 2 ? X - W + 1 : X, wy = d === 1 ? Y + T - 1 : d === 3 ? Y - W + 1 : Y;
      const ww = horiz ? T : W, wh = horiz ? W : T;
      ctx.fillStyle = 'rgba(8,28,58,.35)'; ctx.fillRect(wx + (horiz ? 0 : out * 2), wy + (horiz ? out * 2 : 0), ww, wh);
      ctx.fillStyle = '#8e877a'; ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#b3ad9f'; if (horiz) ctx.fillRect(wx, d === 1 ? wy : wy + wh - 1, ww, 1); else ctx.fillRect(d === 0 ? wx : wx + ww - 1, wy, 1, wh);
      ctx.strokeStyle = 'rgba(40,36,30,.45)'; ctx.lineWidth = 0.4; ctx.beginPath();
      for (let u = 0; u <= T; u += 5.4) { if (horiz) { ctx.moveTo(wx + u, wy); ctx.lineTo(wx + u, wy + wh); } else { ctx.moveTo(wx, wy + u); ctx.lineTo(wx + ww, wy + u); } }
      ctx.stroke();
    }
  }
}

/**
 * The loading platforms: a raised stone loading bank along the yard on the building's side (where the goods pile up),
 * and a narrow loading bank between each pair of loading tracks, so every track a train may stand on has a platform
 * beside it. Stone edging, a yellow line along the track edge, ramps at the ends and lamps; drawn under the trains.
 * In the building's frame: tracks at v = -24, -40, -56, -72 (nearest first).
 */
function loadingPlatforms(ctx: CanvasRenderingContext2D, g: Game, b: Building, L0: number, tm: number, zoom: number) {
  let a = -L0 / 2, z = L0 / 2;
  const bank = (v0: number, w: number, edges: number[], lamps: boolean) => {
    const L = z - a; ctx.save(); ctx.translate((a + z) / 2, 0);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(-L / 2 + 1, v0 + 1.2, L, w);
    ctx.fillStyle = '#8f8576'; ctx.fillRect(-L / 2, v0, L, w); // stone face
    ctx.fillStyle = '#d6cbb2'; ctx.fillRect(-L / 2 + 0.5, v0 + 0.5, L - 1, w - 1); // paving
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-L / 2 + 0.5, v0 + 0.5, 2, w - 1); ctx.fillRect(L / 2 - 2.5, v0 + 0.5, 2, w - 1); // ramps
    ctx.fillStyle = '#e8c84a'; for (const e of edges) ctx.fillRect(-L / 2 + 2.5, e, L - 5, 0.5); // safety lines
    if (zoom > 1.2) { ctx.fillStyle = 'rgba(120,108,88,.35)'; for (let u = -L / 2 + 5; u < L / 2 - 2; u += 4) ctx.fillRect(u, v0 + 1, 0.3, w - 2); } // paving joints
    if (lamps && zoom >= 0.5) for (const u of [-L / 2 + 3.5, L / 2 - 3.5]) {
      ctx.fillStyle = '#2e2a26'; ctx.beginPath(); ctx.arc(u, v0 + w / 2, 0.55, 0, 7); ctx.fill();
      const gl = 0.7 + 0.3 * Math.sin(tm * 2 + u);
      ctx.fillStyle = `rgba(255,214,120,${0.18 * gl})`; ctx.beginPath(); ctx.arc(u, v0 + w / 2, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(u, v0 + w / 2, 0.35, 0, 7); ctx.fill();
    }
    ctx.restore();
  };
  // along the building, from just off the nearest track's rail to the building's row
  bank(-19.6, 6.2, [-19.0], true);
  if (b.kind === 'dock') return; // the dock's other tracks run on the quay
  // the banks between tracks stop where the tracks fan out to their switches (an end square with a switch on it)
  const n = g.world.n, T = TILE, sq = yardSquares(n, b), h = sq.length / 2;
  const dir = b.horizontal ? (b.side > 0 ? 1 : -1) : (b.side > 0 ? -1 : 1);
  const us = sq.map((i, k) => ({ u: dir * (k + 0.5 - h) * T, fan: (g.net.bySquare.get(i) ?? []).some(id => g.net.pieces[id]!.kind === 'fan') })).filter(q => !q.fan).map(q => q.u);
  if (!us.length) return;
  a = Math.max(-L0 / 2, Math.min(...us) - T / 2 + 1.5); z = Math.min(L0 / 2, Math.max(...us) + T / 2 - 1.5);
  // between each pair of tracks, clear of the rails (±3.4 either side of a track's middle)
  for (let k = 1; k < tracksOf(b); k++) { const mid = -24 - 16 * (k - 1) - 8; bank(mid - 2.6, 5.2, [mid - 2.1, mid + 1.6], false); }
}

/**
 * An industry in its yard, as a little model: a loading platform along the yard, the building and its props on the
 * row beside it, and crates that pile up with the stock. Drawn in the building's own frame: u along the yard,
 * v across it with the yard tracks at negative v.
 */
export function drawBuilding(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number, zoom: number) {
  const T = TILE, n = g.world.n;
  const h = yardLen(b) / 2, cx = b.horizontal ? (b.x + h) * T : (b.x + b.side + 0.5) * T, cy = b.horizontal ? (b.y + b.side + 0.5) * T : (b.y + h) * T;
  const rot = b.horizontal ? (b.side > 0 ? 0 : Math.PI) : (b.side > 0 ? -Math.PI / 2 : Math.PI / 2);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const L = yardLen(b) * T - 6, H = (k: number) => hash(g.s.seed, b.x, b.y, k);
  loadingPlatforms(ctx, g, b, L, tm, zoom);
  // the goods pile up on the platform as the stock grows: a row along it, then a second and third layer on top
  if (b.kind !== 'dock') stockPile(ctx, b, L);
  // half of all buildings are laid out the other way round along their yard (docks keep their pier and office as built)
  if (b.kind !== 'dock' && H(1) < 0.5) ctx.scale(-1, 1);
  const up = buildingUp(g, b);
  if (up === null) ART[b.kind](ctx, tm, H, b.lvl, yardLen(b));
  else { // just put up: the builders' scene, with the building rising from one end of its row to the other
    if (b.kind !== 'dock') drawSiteGround(ctx, L, up);
    ctx.save(); clipBuilt(ctx, L, up); ART[b.kind](ctx, tm, H, b.lvl, yardLen(b)); ctx.restore();
    drawSiteWork(ctx, L, up, tm, zoom);
  }
  ctx.restore();
  if (b.id < 0) drawBuildingTags(ctx, g, b, tm, zoom); // the placement preview carries its name; real buildings get theirs over the trains
  void n;
}

/**
 * Far out (zoom under FAR_ZOOM) a building is a few pixels wide but still hundreds of little shapes: with seventy of
 * them panning lagged. Each is drawn into a picture that is refreshed about four times a second (a few a frame, so no frame
 * stutters; at once when its level or building work changes), and the picture is drawn each frame. Close up buildings are drawn live as before.
 */
export const FAR_ZOOM = 0.45;
type Pic = { c: HTMLCanvasElement; x: number; y: number; s: number; key: string; stock: number; at: number; used: number };
const pics = new Map<number, Pic>();
let budget = { tm: -1, left: 0 };
const SCALES = [0.25, 0.375, 0.5, 0.75, 1, 1.5, 2];
export function drawBuildingFar(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number, zoom: number) {
  if (zoom >= FAR_ZOOM || b.id < 0 || typeof document === 'undefined') { drawBuilding(ctx, g, b, tm, zoom); return; }
  const m = ctx.getTransform(), px = Math.hypot(m.a, m.b), sc = SCALES.find(k => k >= px) ?? SCALES.at(-1)!;
  const up = buildingUp(g, b), key = `${b.kind}/${b.x},${b.y},${+b.horizontal},${b.side},${b.lvl},${b.len ?? ''},${b.tracks ?? ''},${b.closed ? 1 : 0},${up === null ? '' : Math.round(up * 40)},${sc}`;
  let p = pics.get(b.id);
  const slot = Math.floor(tm * 4 + (b.id % 7) / 7); // four times a second, not every building on the same frame
  if (tm !== budget.tm) budget = { tm, left: 6 }; // at most a few timed refreshes a frame, so no frame stutters
  if (!p || p.key !== key || ((p.at !== slot || p.stock !== b.stock) && budget.left-- > 0)) { // stock and smoke: within the budget
    const n = g.world.n; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const i of [...yardSquares(n, b), ...buildingSquares(n, b)]) { const x = i % n, y = (i / n) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    const P = 24; x0 = x0 * TILE - P; y0 = y0 * TILE - P * 2; x1 = x1 * TILE + P; y1 = y1 * TILE + P; // room for smoke, shadows and carts
    const c = p?.c ?? document.createElement('canvas'), w = Math.ceil((x1 - x0) * sc), h = Math.ceil((y1 - y0) * sc);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const cx = c.getContext('2d'); if (!cx) { drawBuilding(ctx, g, b, tm, zoom); return; }
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h); cx.setTransform(sc, 0, 0, sc, -x0 * sc, -y0 * sc);
    drawBuilding(cx, g, b, tm, zoom);
    p = { c, x: x0, y: y0, s: sc, key, stock: b.stock, at: slot, used: 0 }; pics.set(b.id, p);
  }
  p.used = tm;
  ctx.drawImage(p.c, p.x, p.y, p.c.width / p.s, p.c.height / p.s);
  if (pics.size > 40 && Math.random() < 0.02) for (const [k, v] of pics) if (tm - v.used > 4) pics.delete(k); // let go of ones off screen
}

/** A building's name and stock, its warning signs: drawn after the trains so a train in the yard never hides them. */
export function drawBuildingTags(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number, zoom: number) {
  const T = TILE;
  const h = yardLen(b) / 2, cx = b.horizontal ? (b.x + h) * T : (b.x + b.side + 0.5) * T, cy = b.horizontal ? (b.y + b.side + 0.5) * T : (b.y + h) * T;
  // how much is waiting: a small soft tag at the building's end when zoomed out (none when zoomed far out);
  // close up the count joins the name label below instead
  const shows = b.kind !== 'dock' && b.id >= 0;
  if (shows && zoom >= 0.7 && zoom < 1.6) stockChip(ctx, b, cx, cy, zoom);
  // name, when close or when it is the only thing that tells you what this is
  if (zoom >= 1.6) {
    const d = INDUSTRIES[b.kind], fs = 9;
    ctx.font = `600 ${fs}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = `${d.icon} ${d.name}${b.lvl > 1 ? ' ' + b.lvl : ''}${b.closed ? ' · closed' : ''}`;
    const [have, , full] = shows ? stockOf(b) : [0, 0, false], count = shows ? ` · ${have}` : '';
    const lw = ctx.measureText(label).width, w = lw + ctx.measureText(count).width + 8;
    const lx = cx, ly = cy + (b.horizontal ? b.side * 20 : 22);
    ctx.fillStyle = 'rgba(30,24,16,.8)'; ctx.fillRect(lx - w / 2, ly - 6, w, 12);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f6e7c6'; ctx.fillText(label, lx - w / 2 + 4, ly + 0.5);
    if (count) { ctx.fillStyle = full ? '#ffc35a' : '#bfe0a8'; ctx.fillText(count, lx - w / 2 + 4 + lw, ly + 0.5); }
  }
  if (b.id >= 0) drawClosed(ctx, g, b, tm, zoom, cx, cy);
  if (b.id >= 0 && !isLinked(g, b)) { // not on the railway yet: a small red sign on the yard end (not on the placement preview)
    const ys = b.horizontal ? [(b.x + 0.5) * T, (b.y + 0.5) * T] : [(b.x + 0.5) * T, (b.y + 0.5) * T];
    const p = 0.6 + 0.4 * Math.sin(tm * 4);
    ctx.fillStyle = `rgba(220,60,40,${p})`; ctx.beginPath(); ctx.arc(ys[0]!, ys[1]!, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 9px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', ys[0]!, ys[1]! + 0.5);
  }
}

/** How far down each building's barrier arms are (0 up, 1 down), eased frame by frame. Drawing only. */
const arms = new Map<number, { v: number; tm: number }>();

/**
 * ⛔ A closed building: red and white boom barriers across both ends of its yard (they swing down once the last train
 * has left, and up again when it opens), and a no-entry sign on a post over the building.
 */
function drawClosed(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number, zoom: number, cx: number, cy: number) {
  let a = arms.get(b.id);
  if (!b.closed && !a) return;
  a ??= { v: 0, tm }; arms.set(b.id, a);
  const want = barriersDown(g, b) ? 1 : 0, dt = Math.min(0.1, Math.max(0, tm - a.tm)); a.tm = tm;
  a.v = want > a.v ? Math.min(1, a.v + dt / 1.4) : Math.max(0, a.v - dt / 1.4);
  if (!b.closed && a.v <= 0) { arms.delete(b.id); return; }
  const T = TILE, e = 1 - (1 - a.v) * (1 - a.v); // eased swing
  const wide = (b.tracks ?? 2) > 2 ? 2 : 1; // the arm spans the loading tracks (and the strip once it has more)
  for (const end of [0, 1] as const) {
    // in yard terms: u along the yard (0..4 squares), s across it; the post stands on the building's side
    const u = end === 0 ? 0.12 : 3.88, s0 = 0.5 + b.side * 0.42;
    const px = b.horizontal ? (b.x + u) * T : (b.x + s0) * T, py = b.horizontal ? (b.y + s0) * T : (b.y + u) * T;
    const len = (wide * T - 6) * (0.14 + 0.86 * e), dx = b.horizontal ? 0 : -b.side, dy = b.horizontal ? -b.side : 0;
    // the arm: a pole with red and white bands, a counterweight behind the post
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px + 1, py + 1.5); ctx.lineTo(px + dx * len + 1, py + dy * len + 1.5); ctx.stroke();
    const seg = 5;
    for (let k = 0; k * seg < len; k++) {
      ctx.strokeStyle = k % 2 ? '#f4f1ea' : '#d8382c'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(px + dx * k * seg, py + dy * k * seg); ctx.lineTo(px + dx * Math.min(len, (k + 1) * seg), py + dy * Math.min(len, (k + 1) * seg)); ctx.stroke();
    }
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(px - dx * 4 - 1.6, py - dy * 4 - 1.6, 3.2, 3.2); // counterweight
    ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 7); ctx.fill(); // post
    if (b.closed && Math.sin(tm * 6 + end * Math.PI) > 0) { ctx.fillStyle = '#ff4a3a'; ctx.beginPath(); ctx.arc(px + dx * len, py + dy * len, 1.4, 0, 7); ctx.fill(); } // tip lamp
  }
  if (!b.closed) return;
  // the no-entry sign on a post above the building
  const k = Math.max(1, 1.3 / zoom), bob = Math.sin(tm * 2 + b.id) * 0.8, X = cx, Y = cy - 0.7 * TILE + bob; // where the ❗ of a stuck building would be
  ctx.fillStyle = '#5a4a3a'; ctx.fillRect(X - 0.8 * k, Y, 1.6 * k, 10 * k);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(X + 1 * k, Y + 1 * k, 7.2 * k, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X, Y, 7.2 * k, 0, 7); ctx.fill();
  ctx.fillStyle = '#d8382c'; ctx.beginPath(); ctx.arc(X, Y, 6.2 * k, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(X - 4 * k, Y - 1.2 * k, 8 * k, 2.4 * k);
}

type Art = (ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number, len: number) => void;

/** Pick one of a few looks from a building's own random number (0..1). */
const pick = <T,>(r: number, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))]!;

/** Wall and roof colours a factory hall may have: each factory gets one, so no two look quite alike. */
const HALL_LOOKS: Record<string, readonly (readonly [string, string])[]> = {
  sawmill: [['#b07a48', '#8a6a52'], ['#9a6a40', '#5e5a56'], ['#c09060', '#6e4a36']],
  brickworks: [['#9a4a36', '#5e3428'], ['#a85a40', '#4a4848'], ['#8a3e2e', '#6a4a3a']],
  gristmill: [['#d8cdb4', '#7a6a50'], ['#e6dcc4', '#5e6a72'], ['#cbbf9e', '#8a5a40']],
  mill: [['#5a4e56', '#3a343a'], ['#6a5a50', '#3a3e44'], ['#4e5660', '#2e3238']],
  refinery: [['#7a7e86', '#4a4e56'], ['#8a8478', '#4e4a44'], ['#6e7680', '#3e5266']],
  textile: [['#a8705a', '#5e4038'], ['#b8805e', '#4a4e58'], ['#9a6050', '#6a4a3e']],
  cannery: [['#e6e2d6', '#3f6a8a'], ['#e8dcc8', '#8a3a30'], ['#d8e0e2', '#4a5a4a']],
  glassworks: [['#b8a890', '#4a5a66'], ['#a89880', '#5e4a3e'], ['#c4b8a0', '#3e4a52']],
  toolworks: [['#6a5a52', '#33302e'], ['#7a6a5e', '#3e4248'], ['#5e5650', '#2e3036']],
  furniture: [['#b8865a', '#5e4436'], ['#c49468', '#4a4e52'], ['#a87850', '#6a3a30']],
  jeweller: [['#efe6d2', '#2f4a6e'], ['#f4efe2', '#6a2a3a'], ['#e8dcc0', '#2e4a3a']],
  chocolate: [['#8a5a3e', '#4a3226'], ['#9a6a4a', '#5a3e30'], ['#7a4e36', '#3e3a38']],
  tyreworks: [['#7a7268', '#2e2c2a'], ['#8a7e70', '#3a3836'], ['#6e6860', '#26272a']],
};

/**
 * A factory hall: brick walls with a front wall of arched windows and a big door, a sawtooth roof of north lights,
 * a loading bay with a canopy toward the yard tracks, a tall chimney (busy factories smoke).
 */
function hall(ctx: CanvasRenderingContext2D, tm: number, u: number, w: number, wall: string, roof: string, busy: boolean, lvl: number) {
  // always drawn front wall down on screen; turned a quarter (a yard running up the screen) it is narrow and deep
  upright(ctx, u, 0, (sw, yard) => hall0(ctx, tm, sw ? 22 : w, sw ? w : 22, yard, wall, roof, busy, lvl));
}
function hall0(ctx: CanvasRenderingContext2D, tm: number, w: number, d: number, yard: [number, number], wall: string, roof: string, busy: boolean, lvl: number) {
  const u = 0, v = 0, x0 = u - w / 2, y0 = v - d / 2, fw = 4.6; // fw: the front wall seen below the roof
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x0 + 2, y0 + 2, w, d);
  // front wall: brick courses, arched windows, the works door
  ctx.fillStyle = wall; ctx.fillRect(x0, y0 + d - fw, w, fw);
  ctx.strokeStyle = 'rgba(255,230,210,.16)'; ctx.lineWidth = 0.25;
  for (let y = y0 + d - fw + 1; y < y0 + d; y += 1) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); }
  const wins = Math.max(3, Math.round(w / 5.5)), door = Math.floor(wins / 2);
  for (let k = 0; k < wins; k++) {
    const xx = x0 + (w / wins) * (k + 0.5);
    if (k === door) { ctx.fillStyle = '#4a3424'; ctx.fillRect(xx - 2.2, y0 + d - fw + 0.8, 4.4, fw - 0.8); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(xx - 0.1, y0 + d - fw + 0.8, 0.2, fw - 0.8); continue; }
    ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.roundRect(xx - 1.2, y0 + d - fw + 0.9, 2.4, 2.6, [1.2, 1.2, 0, 0]); ctx.fill();
    ctx.fillStyle = busy ? '#e8c070' : '#6f93a8'; ctx.beginPath(); ctx.roundRect(xx - 0.9, y0 + d - fw + 1.2, 1.8, 2.2, [0.9, 0.9, 0, 0]); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x0, y0 + d - 0.6, w, 0.6);
  // the roof: teeth of dark slope and glass catching the light
  const rd = d - fw, teeth = Math.max(3, Math.round(w / 7)), tw = w / teeth;
  for (let k = 0; k < teeth; k++) {
    const x = x0 + k * tw;
    ctx.fillStyle = roof; ctx.fillRect(x + 0.3, y0, tw - 0.6, rd);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + 0.3, y0, (tw - 0.6) * 0.45, rd);
    ctx.fillStyle = 'rgba(200,225,240,.9)'; ctx.fillRect(x + tw - 2.4, y0 + 0.6, 1.8, rd - 1.2);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x + tw - 2.4, y0 + 0.6, 0.5, rd - 1.2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + tw - 0.6, y0, 0.6, rd);
  }
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x0, y0 + rd - 0.5, w, 0.6); // gutter
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.6; ctx.strokeRect(x0, y0, w, d);
  // loading bay toward the yard tracks: a canopy over a doorway on the side that faces them
  if (yard[1] < 0) {
    const lu = u - w * 0.15;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(lu - 5 + 0.8, y0 - 3.4 + 0.8, 10, 3.4);
    ctx.fillStyle = '#5b6066'; ctx.fillRect(lu - 5, y0 - 3.4, 10, 3.4);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(lu - 5, y0 - 3.4, 10, 0.8);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.25; for (let x = lu - 4; x < lu + 5; x += 1.6) { ctx.beginPath(); ctx.moveTo(x, y0 - 3.4); ctx.lineTo(x, y0); ctx.stroke(); }
  } else if (yard[0] !== 0) { // a side canopy over the roof edge
    const cx0 = yard[0] < 0 ? x0 - 3.4 : x0 + w, lv = v - d * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx0 + 0.8, lv - 5 + 0.8, 3.4, 10);
    ctx.fillStyle = '#5b6066'; ctx.fillRect(cx0, lv - 5, 3.4, 10);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(cx0, lv - 5, 3.4, 0.8);
  }
  // chimney: taller by level, banded
  const cx = u + w / 2 - 4, cy = y0 + 3, r = 2.6 + lvl * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(cx + 2 + lvl * 0.6, cy + 2 + lvl * 0.6, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a3a2a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, 7); ctx.stroke();
  ctx.fillStyle = '#2a211c'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 7); ctx.fill();
  if (busy) puff(ctx, cx, cy - 2, tm, true, 0.9 + lvl * 0.15);
}

/** The ground of a works: packed gravel with a kerb, puddles, weeds at the edge, a fence with a gate at the front. */
function worksGround(ctx: CanvasRenderingContext2D, H: (k: number) => number, col: string) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-59, -14, 118, 28, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-59, -14, 118, 0.7);
  for (let k = 0; k < 60; k++) { ctx.fillStyle = k % 3 ? 'rgba(40,36,30,.35)' : 'rgba(255,250,235,.3)'; ctx.fillRect(-57 + H(300 + k) * 114, -12 + H(400 + k) * 24, 0.7, 0.6); }
  for (let k = 0; k < 2; k++) { ctx.fillStyle = 'rgba(120,150,170,.45)'; ctx.beginPath(); ctx.ellipse(-40 + H(450 + k) * 90, 11 + H(460 + k) * 1.5, 2.2 + H(470 + k) * 2, 0.8, 0, 0, 7); ctx.fill(); }
  for (let k = 0; k < 14; k++) { ctx.fillStyle = k % 2 ? '#5f8a3a' : '#4e7a30'; ctx.fillRect(-58 + H(480 + k) * 116, H(490 + k) > 0.5 ? 12.6 : -13.6, 1, 0.8); }
  // fence along the front, with a gate
  const gate = -20 + H(495) * 50;
  ctx.strokeStyle = '#3a3532'; ctx.lineWidth = 0.35;
  for (const [a, b] of [[-58, gate - 4], [gate + 4, 58]] as const) {
    ctx.beginPath(); ctx.moveTo(a, 14); ctx.lineTo(b, 14); ctx.stroke();
    for (let x = a; x <= b; x += 2.2) { ctx.fillStyle = '#3a3532'; ctx.fillRect(x - 0.25, 13.6, 0.5, 0.8); }
  }
  ctx.fillStyle = '#6a5a4a'; ctx.fillRect(gate - 4.4, 13, 0.9, 2); ctx.fillRect(gate + 3.5, 13, 0.9, 2);
}

/**
 * Small things that make each building its own: chosen by its random numbers from a pool, set down at the free spots
 * its layout leaves (u, v in the building's frame). A spot may stay empty.
 */
function extras(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, spots: readonly (readonly [number, number])[], pool: readonly string[]) {
  spots.forEach(([u, v], k) => {
    const r = H(800 + k); if (r < 0.2) return;
    const what = pick(H(820 + k), pool), s = (j: number) => H(840 + k * 10 + j);
    switch (what) {
      case 'barrels': for (let j = 0; j < 3; j++) barrel(ctx, u + (j % 2) * 3.2 - 1.6, v + (j > 1 ? 2.8 : 0) - 1.4, pick(s(j), ['#7a5230', '#5a5a62', '#8a3a2e'])); break;
      case 'sacks': for (let j = 0; j < 4; j++) sack(ctx, u + (j % 2) * 3 - 1.5, v + (j > 1 ? 2.2 : 0) - 1.1); break;
      case 'crates': crate(ctx, u - 3, v - 1.4); crate(ctx, u + 0.2, v - 1.4); crate(ctx, u - 1.4, v - 3.6, 2.6, '#b08a54'); break;
      case 'worker': person(ctx, u, v, pick(s(1), ['#3f5a7a', '#a8402e', '#5a6a3a', '#6a5a4a']), pick(s(2), ['#3a2a1e', '#d0a020', '#2e2a26'])); break;
      case 'workers': person(ctx, u - 1.6, v, pick(s(1), ['#3f5a7a', '#a8402e', '#5a6a3a'])); person(ctx, u + 1.6, v + 0.6, pick(s(2), ['#6a5a4a', '#2e4a6a', '#8a6a3a'])); break;
      case 'lamp': lamp(ctx, u, v, tm); break;
      case 'tree': bush(ctx, u, v, 3 + s(1) * 1.4, pick(s(2), ['#3f6f30', '#4a7a36', '#356228'])); break;
      case 'pine': pine(ctx, u, v, 3 + s(1) * 1.2); break;
      case 'cart': cart(ctx, u, v, '#8a6038', pick(s(1), ['#c99a5b', '#9a958c', '#d8c8a0', undefined])); break;
      case 'flowers': flowers(ctx, u, v, s); break;
      case 'hens': for (let j = 0; j < 3; j++) hen(ctx, u + s(j) * 6 - 3, v + s(j + 3) * 3 - 1.5, tm, pick(s(j + 6), ['#f4efe2', '#b8763a', '#2e2a26'])); break;
      case 'dog': dog(ctx, u, v, pick(s(1), ['#3a2c22', '#c89858', '#2a2624'])); break;
      case 'bales': hayBale(ctx, u - 2, v); hayBale(ctx, u + 2, v + 0.6); break;
    }
  });
}

const WORKS = ['barrels', 'crates', 'worker', 'workers', 'lamp', 'tree', 'cart', 'sacks'] as const;

const FACTORY_ART = {
  sawmill: (ctx, tm, H, lvl) => { // timber hall, a log pile going in and stacked planks coming out
    worksGround(ctx, H, '#8f8270');
    const [w, r] = pick(H(2), HALL_LOOKS.sawmill!);
    hall(ctx, tm, -28, 34, w, r, true, lvl);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - (row % 2); k++) logEnd(ctx, 4 + k * 4.4 + (row % 2) * 2.2, 8 - row * 3.2, 1.9);
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = k % 2 ? '#e0b878' : '#d2a868'; ctx.fillRect(28, 7 - k * 3, 20, 2.4); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(28, 9.4 - k * 3, 20, 0.6); ctx.fillStyle = 'rgba(160,110,60,.6)'; for (let x = 30; x < 48; x += 5) ctx.fillRect(x, 7 - k * 3, 0.4, 2.4); }
    const a = tm * 6; ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-6, -8, 3, a, a + 5); ctx.stroke();
    for (let k = 0; k < 10; k++) { ctx.fillStyle = 'rgba(240,210,150,.8)'; ctx.fillRect(-2 + H(900 + k) * 10, -10 + H(910 + k) * 6, 0.6, 0.5); } // sawdust
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [22, -8], [53, -9], [16, 11]], WORKS);
  },
  brickworks: (ctx, tm, H, lvl) => { // a round kiln glowing, a drying shed, stacks of red bricks, a clay heap
    worksGround(ctx, H, '#94806c');
    const [w, r] = pick(H(2), HALL_LOOKS.brickworks!);
    hall(ctx, tm, -32, 26, w, r, false, lvl);
    const glow = 0.5 + 0.5 * Math.sin(tm * 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(2, 2, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#a0583c'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,200,.2)'; ctx.lineWidth = 0.3; for (let rr = 7; rr < 10; rr += 1.2) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#7a3a28'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,${140 + 60 * glow},60,.9)`; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
    for (let k = 0; k < 4; k++) { const a = k * 1.571 + 0.4; ctx.fillStyle = `rgba(255,${150 + 60 * glow},70,.8)`; ctx.fillRect(Math.cos(a) * 9 - 0.7, Math.sin(a) * 9 - 0.7, 1.4, 1.4); } // fire holes
    puff(ctx, 0, -3, tm, true);
    for (let k = 0; k < 3 + lvl; k++) { const x = 18 + (k % 3) * 9, y = 6 - Math.floor(k / 3) * 7; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 0.8, y - 2.2, 7, 5); ctx.fillStyle = '#b5523b'; ctx.fillRect(x, y - 3, 7, 5); ctx.strokeStyle = 'rgba(60,20,10,.5)'; ctx.lineWidth = 0.4; ctx.strokeRect(x, y - 3, 7, 5); ctx.beginPath(); ctx.moveTo(x, y - 0.5); ctx.lineTo(x + 7, y - 0.5); ctx.moveTo(x + 3.5, y - 3); ctx.lineTo(x + 3.5, y - 0.5); ctx.stroke(); }
    ctx.fillStyle = '#9a6a4a'; ctx.beginPath(); ctx.ellipse(-12, 9, 5, 2.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b07a56'; ctx.beginPath(); ctx.ellipse(-13, 8.4, 2.6, 1.2, 0, 0, 7); ctx.fill(); // clay heap
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [14, -9], [53, -9], [52, 9]], WORKS);
  },
  gristmill: (ctx, tm, H, lvl) => { // a windmill with turning sails, the mill house and flour sacks
    worksGround(ctx, H, '#988a72');
    const [w, r] = pick(H(2), HALL_LOOKS.gristmill!);
    hall(ctx, tm, -30, 28, w, r, false, lvl);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(15, 2, 8, 0, 7); ctx.fill();
    ctx.fillStyle = pick(H(3), ['#efe6d2', '#d8cfc0', '#e8d8b8']); ctx.beginPath(); ctx.arc(12, 0, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 0.3; for (let rr = 5.5; rr < 8; rr += 1.2) { ctx.beginPath(); ctx.arc(12, 0, rr, 0, 7); ctx.stroke(); }
    ctx.fillStyle = pick(H(4), ['#6e5a44', '#4a5a6a', '#8a4a36']); ctx.beginPath(); ctx.arc(12, 0, 4.5, 0, 7); ctx.fill();
    const a = tm * 1.4; ctx.save(); ctx.translate(12, 0); ctx.rotate(a);
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(1.6, 3, 3.2, 13); ctx.fillStyle = '#5b4330'; ctx.fillRect(-0.6, 2, 1.2, 14); ctx.fillStyle = 'rgba(240,232,214,.92)'; ctx.fillRect(0.6, 5, 3.2, 10); ctx.strokeStyle = 'rgba(90,70,50,.5)'; ctx.lineWidth = 0.2; for (let y = 6; y < 15; y += 1.8) { ctx.beginPath(); ctx.moveTo(0.6, y); ctx.lineTo(3.8, y); ctx.stroke(); } }
    ctx.restore();
    for (let k = 0; k < 2 + lvl * 2; k++) sack(ctx, 32 + (k % 4) * 4, 8 - Math.floor(k / 4) * 3, '#efe9d8');
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [36, -9], [53, -9], [52, 2]], ['sacks', 'cart', 'worker', 'hens', 'tree', 'flowers', 'lamp']);
  },
  mill: (ctx, tm, H, lvl) => { // a steel works: two smoking stacks, furnace glow, steel beams, an ore bin
    worksGround(ctx, H, '#7a7268');
    const [w, r] = pick(H(2), HALL_LOOKS.mill!);
    hall(ctx, tm, -24, 38, w, r, true, lvl);
    const glow = 0.5 + 0.5 * Math.sin(tm * 3);
    ctx.fillStyle = `rgba(255,${120 + 80 * glow},40,.85)`; ctx.fillRect(-32, 8.2, 10, 1.8);
    for (const x of [8, 16]) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(x + 1.6, -4.4, 3.4, 0, 7); ctx.fill(); ctx.fillStyle = '#4a4248'; ctx.beginPath(); ctx.arc(x, -6, 3.2, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a8288'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(x, -6, 2.6, 0, 7); ctx.stroke(); ctx.fillStyle = '#1e1a1c'; ctx.beginPath(); ctx.arc(x, -6, 1.6, 0, 7); ctx.fill(); puff(ctx, x, -8, tm + x, true, 1.1); }
    ctx.fillStyle = '#5a3a30'; ctx.fillRect(4, 3, 14, 7); ctx.fillStyle = '#7a4a3a'; for (let k = 0; k < 14; k++) ctx.fillRect(5 + H(930 + k) * 12, 4 + H(940 + k) * 5, 1, 0.8); // ore bin
    for (let k = 0; k < 2 + lvl; k++) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(26.6, 8.6 - k * 3, 22, 2); ctx.fillStyle = '#9aa0a8'; ctx.fillRect(26, 8 - k * 3, 22, 2); ctx.fillStyle = '#c8ccd2'; ctx.fillRect(26, 8 - k * 3, 22, 0.5); ctx.fillStyle = '#6a7078'; ctx.fillRect(26, 9.4 - k * 3, 22, 0.6); }
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [24, -9], [53, -9], [52, 10]], ['barrels', 'crates', 'worker', 'workers', 'lamp', 'cart']);
  },
  refinery: (ctx, tm, H, lvl) => { // round tanks with ladders, pipes, a cracking tower and a gas flare
    worksGround(ctx, H, '#7e786c');
    const [w, r] = pick(H(2), HALL_LOOKS.refinery!);
    hall(ctx, tm, -34, 22, w, r, false, lvl);
    const tank = pick(H(3), [['#d6d9de', '#9a9ea6'], ['#e8e2d0', '#a89a7a'], ['#d6dcd2', '#8a9a8a']]);
    const tanks = [[-8, -2, 8], [10, 3, 7], [26, -3, 6], [40, 5, 5]].slice(0, 2 + Math.min(2, lvl));
    ctx.strokeStyle = '#8a8d92'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-22, 7); ctx.lineTo(44, 7); ctx.stroke(); ctx.strokeStyle = '#6a6d72'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-22, 9); ctx.lineTo(44, 9); ctx.stroke();
    for (const [x, y, rr] of tanks) {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x! + 1.5, y! + 1.5, rr!, 0, 7); ctx.fill();
      ctx.fillStyle = tank[0]!; ctx.beginPath(); ctx.arc(x!, y!, rr!, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x! - rr! * 0.3, y! - rr! * 0.3, rr! * 0.45, 0, 7); ctx.fill();
      ctx.strokeStyle = tank[1]!; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x!, y!, rr! * 0.6, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#5a5d62'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(x! + rr! * 0.7, y! - rr! * 0.7); ctx.lineTo(x!, y!); ctx.stroke(); // ladder to the top
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-19, -9, 5, 5); ctx.fillStyle = '#6a6e74'; ctx.fillRect(-20, -10, 4, 4); ctx.strokeStyle = '#a0a4aa'; ctx.lineWidth = 0.3; ctx.strokeRect(-20, -10, 4, 4); // cracking tower
    ctx.fillStyle = '#5b6066'; ctx.fillRect(50, -10, 2, 14);
    const f = Math.sin(tm * 9) * 0.8; ctx.fillStyle = 'rgba(255,170,40,.9)'; ctx.beginPath(); ctx.moveTo(49, -10); ctx.quadraticCurveTo(51 + f, -18, 53, -10); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,150,.9)'; ctx.beginPath(); ctx.moveTo(50, -10); ctx.quadraticCurveTo(51 + f * 0.6, -14, 52, -10); ctx.fill();
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [-14, 10], [52, 9]], ['barrels', 'barrels', 'worker', 'lamp', 'crates']);
  },
  textile: (ctx, tm, H, lvl) => { // a long weaving shed, wool bales in, rolls of coloured cloth out
    worksGround(ctx, H, '#928472');
    const [w, r] = pick(H(2), HALL_LOOKS.textile!);
    hall(ctx, tm, -12, 48, w, r, true, lvl);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(-50.4 + (k % 2) * 5, 6.6 - (k > 1 ? 4 : 0), 2.4, 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f2eee4'; ctx.beginPath(); ctx.ellipse(-51 + (k % 2) * 5, 6 - (k > 1 ? 4 : 0), 2.4, 2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#b8a888'; ctx.lineWidth = 0.3; ctx.stroke(); }
    const cols = ['#c0392b', '#2f6f9a', '#e8a33c', '#5a9a4a', '#8a4aa8'], o = Math.floor(H(3) * 5);
    for (let k = 0; k < 2 + lvl; k++) { const x = 20 + (k % 3) * 8, y = 6 - Math.floor(k / 3) * 5; ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 0.6, y + 0.6, 7, 3.4); ctx.fillStyle = cols[(k + o) % 5]!; ctx.fillRect(x, y, 7, 3.4); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x, y, 7, 0.8); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 6.2, y, 0.8, 3.4); }
    extras(ctx, tm, H, [[-52, -9], [46, -9], [50, 8], [16, -9]], ['crates', 'worker', 'workers', 'lamp', 'tree', 'flowers', 'cart']);
  },
  cannery: (ctx, tm, H, lvl) => { // a white-washed packing shed by the water, a steam boiler, fish boxes in, stacks of tins out
    worksGround(ctx, H, '#8e8a80');
    const [w, r] = pick(H(2), HALL_LOOKS.cannery!);
    hall(ctx, tm, -16, 42, w, r, true, lvl);
    for (let k = 0; k < 4; k++) { const x = -52 + (k % 2) * 5, y = 6 - (k > 1 ? 4 : 0); ctx.fillStyle = '#5a8aa8'; ctx.fillRect(x, y, 4, 3); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x, y, 4, 0.8); ctx.fillStyle = '#c0c6cc'; ctx.fillRect(x + 0.8, y + 1.2, 2.4, 0.8); }
    for (let k = 0; k < 3 + lvl * 2; k++) { const uu = 20 + (k % 4) * 4, vv = 7 - Math.floor(k / 4) * 3; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.arc(uu + 0.5, vv + 0.5, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = '#c0c6cc'; ctx.beginPath(); ctx.arc(uu, vv, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = pick(H(3), ['#c0392b', '#2f6f9a', '#e8a33c']); ctx.fillRect(uu - 1.5, vv - 0.4, 3, 0.8); }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(41, -6, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#4a4e56'; ctx.beginPath(); ctx.ellipse(40, -7, 6, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#6a6e76'; ctx.fillRect(34, -8, 12, 0.6); puff(ctx, 45, -9, tm, false); // steam boiler
    extras(ctx, tm, H, [[-52, -9], [52, 2], [52, 10], [10, 11]], ['crates', 'barrels', 'worker', 'workers', 'lamp', 'cart']);
  },
  glassworks: (ctx, tm, H, lvl) => { // a brick cone over the glowing glass furnace, stone and coal heaps in, crates of window panes out
    worksGround(ctx, H, '#8e8676');
    const [w, r] = pick(H(2), HALL_LOOKS.glassworks!);
    hall(ctx, tm, -30, 28, w, r, false, lvl);
    const glow = 0.55 + 0.45 * Math.sin(tm * 2.6);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(8, 1.5, 9.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#9a5038'; ctx.beginPath(); ctx.arc(6, 0, 9.5, 0, 7); ctx.fill(); // the cone, seen from above
    ctx.fillStyle = '#b8603e'; ctx.beginPath(); ctx.arc(5, -1, 6.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a3a28'; ctx.beginPath(); ctx.arc(6, 0, 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,${150 + 70 * glow},70,.95)`; ctx.beginPath(); ctx.arc(6, 0, 2, 0, 7); ctx.fill();
    puff(ctx, 6, -2, tm, false, 1.1);
    ctx.fillStyle = '#9a958c'; ctx.beginPath(); ctx.ellipse(-12, 8, 4, 2.2, 0, 0, 7); ctx.fill(); // stone heap
    ctx.fillStyle = '#2e2b28'; ctx.beginPath(); ctx.ellipse(-4, 9, 3.4, 2, 0, 0, 7); ctx.fill(); // coal heap
    for (let k = 0; k < 2 + lvl; k++) { // crates of window panes, the glass catching the light
      const x = 22 + (k % 3) * 9, y = 6 - Math.floor(k / 3) * 7;
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + 0.7, y - 2.3, 7, 5); ctx.fillStyle = '#a07a4a'; ctx.fillRect(x, y - 3, 7, 5);
      ctx.fillStyle = 'rgba(190,225,240,.9)'; for (let j = 0; j < 3; j++) ctx.fillRect(x + 1 + j * 2, y - 2.4, 1.4, 3.8);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x + 1.2, y - 2.2, 0.4, 1.6);
    }
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [20, -9], [53, -9], [53, 10]], WORKS);
  },
  toolworks: (ctx, tm, H, lvl) => { // a dark forge shop with a glowing hearth, a steam hammer, steel bars and planks in, racks of tools out
    worksGround(ctx, H, '#7c7468');
    const [w, r] = pick(H(2), HALL_LOOKS.toolworks!);
    hall(ctx, tm, -26, 34, w, r, true, lvl);
    const glow = 0.5 + 0.5 * Math.sin(tm * 4);
    ctx.fillStyle = `rgba(255,${120 + 80 * glow},40,.85)`; ctx.fillRect(-34, 8.2, 8, 1.8);
    const hit = Math.abs(Math.sin(tm * 3)); // the steam hammer going up and down
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(3, -6, 9, 9); ctx.fillStyle = '#4a4e56'; ctx.fillRect(2, -7, 8, 8);
    ctx.fillStyle = '#2e3036'; ctx.fillRect(4.5, -6 + hit * 2, 3, 3); ctx.fillStyle = '#c8ccd2'; ctx.fillRect(4.5, -6 + hit * 2, 3, 0.5);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(-12, 6 - k * 1.6, 12, 1.2); } // steel bars
    for (let k = 0; k < 2; k++) { ctx.fillStyle = '#d2a868'; ctx.fillRect(-12, 1 - k * 1.8, 12, 1.4); } // planks
    for (let k = 0; k < 2 + lvl; k++) { // racks of tools: hammers, saws and shovels in crates
      const x = 22 + (k % 3) * 9, y = 6 - Math.floor(k / 3) * 7;
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + 0.7, y - 2.3, 7, 5); ctx.fillStyle = '#8a6038'; ctx.fillRect(x, y - 3, 7, 5);
      ctx.fillStyle = '#c8ccd2'; ctx.fillRect(x + 1, y - 4, 1.2, 2); ctx.fillRect(x + 3, y - 4.4, 1.2, 2.4); ctx.fillRect(x + 5, y - 3.8, 1.2, 1.8);
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x + 1.3, y - 2.2, 0.6, 3); ctx.fillRect(x + 3.3, y - 2.2, 0.6, 3); ctx.fillRect(x + 5.3, y - 2.2, 0.6, 3);
    }
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [20, -9], [53, -9], [53, 10]], ['crates', 'worker', 'workers', 'lamp', 'cart', 'barrels']);
  },
  furniture: (ctx, tm, H, lvl) => { // a timber workshop, planks and cloth bolts in, chairs, tables and a sofa waiting to go out
    worksGround(ctx, H, '#928670');
    const [w, r] = pick(H(2), HALL_LOOKS.furniture!);
    hall(ctx, tm, -22, 36, w, r, true, lvl);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#e0b878' : '#d2a868'; ctx.fillRect(4, 7 - k * 2.6, 12, 2); }
    const cols = ['#c0392b', '#2f6f9a', '#e8a33c', '#5a9a4a'];
    for (let k = 0; k < 3; k++) { ctx.fillStyle = cols[(k + Math.floor(H(5) * 4)) % 4]!; ctx.beginPath(); ctx.ellipse(8 + k * 4, -4, 1.8, 1.4, 0, 0, 7); ctx.fill(); } // bolts of cloth
    const wood = pick(H(6), ['#8a5a32', '#6e4426', '#a87444']);
    for (let k = 0; k < 2 + lvl; k++) {
      const x = 24 + (k % 3) * 9, y = 5 - Math.floor(k / 3) * 7, kind = (k + Math.floor(H(7) * 3)) % 3;
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x + 0.6, y - 1.4, 6, 4.4);
      ctx.fillStyle = wood;
      if (kind === 0) { ctx.fillRect(x, y - 2, 6, 4); ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(x, y - 2, 6, 0.6); } // a table
      else if (kind === 1) { ctx.fillRect(x + 1, y - 2, 4, 4); ctx.fillRect(x + 1, y - 3.2, 4, 1.2); } // a chair
      else { ctx.fillStyle = cols[k % 4]!; ctx.fillRect(x, y - 1, 6.4, 3.4); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x, y - 1.8, 6.4, 1); } // a sofa
    }
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [20, -9], [53, -9], [53, 10]], ['crates', 'worker', 'workers', 'lamp', 'tree', 'cart']);
  },
  jeweller: (ctx, tm, H, lvl) => { // a fine stone workshop with a gilded roof edge, a guard and an iron strongbox, little velvet boxes out
    worksGround(ctx, H, '#a0988a');
    const [w, r] = pick(H(2), HALL_LOOKS.jeweller!);
    hall(ctx, tm, -24, 30, w, r, false, lvl);
    ctx.fillStyle = '#e8c25a'; ctx.fillRect(-39, -11.4, 30, 0.8); // gilded roof edge
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(3, -2, 9, 7); ctx.fillStyle = '#3a3e44'; ctx.fillRect(2, -3, 9, 7); // strongbox
    ctx.fillStyle = '#d9a43a'; ctx.beginPath(); ctx.arc(6.5, 0.5, 1.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2c230'; for (let k = 0; k < 4; k++) ctx.fillRect(-12 + (k % 2) * 3, 6 - Math.floor(k / 2) * 1.6, 2.6, 1.2); // gold bars
    const sp = 0.5 + 0.5 * Math.sin(tm * 5);
    for (let k = 0; k < 2 + lvl; k++) {
      const x = 22 + (k % 4) * 6, y = 6 - Math.floor(k / 4) * 5;
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + 0.5, y - 1.5, 4.4, 3.4); ctx.fillStyle = pick(H(20 + k), ['#7a1e3a', '#2a3a7a', '#1e5a3a']); ctx.fillRect(x, y - 2, 4.4, 3.4);
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * sp})`; ctx.beginPath(); ctx.arc(x + 2.2, y - 0.4, 0.7, 0, 7); ctx.fill(); // a gem catching the light
    }
    person(ctx, -6, 10, '#2c3e6a', '#1e1e24'); // the guard
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [53, -9], [53, 10]], ['lamp', 'flowers', 'tree', 'worker']);
  },
  chocolate: (ctx, tm, H, lvl) => { // a whimsical sweet works: pastel towers, candy-striped chimneys puffing coloured smoke, a chocolate river and waterfall, lollipop trees
    worksGround(ctx, H, '#c9a7a0');
    // the chocolate river: a pool fed by a little waterfall, winding off across the yard
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(14.6, 2.8, 12, 6.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b3a1f'; ctx.beginPath(); ctx.ellipse(14, 2, 12, 6.4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6b3a1f'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, 3); ctx.bezierCurveTo(30, 9, 36, -2, 44, 6); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,220,180,.35)'; ctx.lineWidth = 0.5;
    for (let k = 0; k < 4; k++) { const p = (tm * 0.4 + k / 4) % 1; ctx.beginPath(); ctx.ellipse(14 + (p - 0.5) * 14, 2 + Math.sin(k * 2) * 2.5, 2 + p, 0.6, 0, 0, 7); ctx.stroke(); } // slow ripples
    ctx.fillStyle = '#a0603a'; ctx.beginPath(); ctx.ellipse(14, 2, 12, 6.4, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(14, 2); ctx.fill(); // the pool's far bank catches the light
    ctx.fillStyle = '#6b3a1f'; ctx.beginPath(); ctx.ellipse(14, 2.6, 11, 5.6, 0, 0, 7); ctx.fill();
    // the waterfall pouring from the works into the pool
    upright(ctx, 6, -2, () => {
      ctx.fillStyle = '#7a4424'; ctx.fillRect(-2.2, -6, 4.4, 6);
      for (let k = 0; k < 3; k++) { const y = -6 + ((tm * 8 + k * 2) % 6); ctx.fillStyle = 'rgba(255,225,190,.5)'; ctx.fillRect(-1.6 + k * 1.4, y, 0.5, 1.2); }
      ctx.fillStyle = 'rgba(255,240,220,.6)'; ctx.beginPath(); ctx.ellipse(0, 0.4, 3, 1, 0, 0, 7); ctx.fill(); // froth
    });
    // a little pink boat drifting round the pool
    const ba = tm * 0.35; upright(ctx, 14 + Math.cos(ba) * 6, 2.6 + Math.sin(ba) * 2.6, () => {
      ctx.fillStyle = '#e86aa0'; ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd1e4'; ctx.fillRect(-1.6, -0.6, 3.2, 0.6);
    });
    // the works: a pastel castle of a factory with a scalloped roof, round windows and a golden door
    upright(ctx, -30, 0, (sw) => {
      const w = sw ? 24 : 40, d = sw ? 40 : 24, x0 = -w / 2, y0 = -d / 2, fw = 7;
      ctx.fillStyle = 'rgba(20,16,10,.16)'; ctx.fillRect(x0 + 1.5, y0 + 1.5, w, d);
      ctx.fillStyle = '#f6c6d8'; ctx.fillRect(x0, y0 + d - fw, w, fw); // pink front wall
      ctx.fillStyle = '#ffffff55'; ctx.fillRect(x0, y0 + d - fw, w, 0.6);
      const nw = Math.max(2, Math.round(w / 8));
      for (let k = 0; k < nw; k++) { // porthole windows glowing warm
        const x = x0 + (w / nw) * (k + 0.5); if (k === Math.floor(nw / 2)) continue;
        ctx.fillStyle = '#e8b04a'; ctx.beginPath(); ctx.arc(x, y0 + d - fw + 2.8, 1.7, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x, y0 + d - fw + 2.8, 1.15, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#d9a520'; ctx.beginPath(); ctx.roundRect(-2.6, y0 + d - 5.4, 5.2, 5.4, [2.6, 2.6, 0, 0]); ctx.fill(); // golden door
      ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(0, y0 + d - 2.9, 1.2, 0, 5.5); ctx.stroke(); // a swirl on it
      // roof in stripes of mint and lilac, a scalloped edge over the front
      const rd = d - fw, n = Math.max(4, Math.round(w / 5));
      for (let k = 0; k < n; k++) { ctx.fillStyle = k % 2 ? '#9fe0c8' : '#c6a8e8'; ctx.fillRect(x0 + (w / n) * k, y0, w / n + 0.1, rd); }
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x0, y0, w, rd * 0.4);
      ctx.fillStyle = '#f0e6ff';
      for (let x = x0 + 1.5; x < x0 + w; x += 3) { ctx.beginPath(); ctx.arc(x, y0 + rd, 1.5, 0, Math.PI); ctx.fill(); }
      ctx.strokeStyle = 'rgba(80,40,90,.35)'; ctx.lineWidth = 0.5; ctx.strokeRect(x0, y0, w, d);
      // a round tower with a cone roof at one corner, a flag on top
      const tx = x0 + w - 4, ty = y0 + 4;
      ctx.fillStyle = 'rgba(20,16,10,.16)'; ctx.beginPath(); ctx.arc(tx + 1.2, ty + 1.2, 4.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd56a'; ctx.beginPath(); ctx.arc(tx, ty, 4.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8577a'; ctx.beginPath(); ctx.arc(tx, ty, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(tx - 1, ty - 1, 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe9f0'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 6); ctx.lineTo(tx + 3 + Math.sin(tm * 5) * 0.5, ty - 5); ctx.lineTo(tx, ty - 4); ctx.fill();
      ctx.strokeStyle = '#5a3a3a'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 6); ctx.stroke();
      // candy-striped chimneys, more with each level, puffing pink, mint and lilac smoke
      const cols = ['#ff9ec4', '#a8f0d4', '#d4b8ff'];
      for (let k = 0; k < 1 + Math.min(2, lvl); k++) {
        const cx = x0 + 5 + k * 7, cy = y0 + 4, h = 7;
        ctx.fillStyle = 'rgba(20,16,10,.16)'; ctx.fillRect(cx - 1, cy - h + 1.5, 3.4, h);
        ctx.save(); ctx.beginPath(); ctx.rect(cx - 1.6, cy - h, 3.2, h); ctx.clip();
        ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1.6, cy - h, 3.2, h);
        ctx.fillStyle = '#e03a4a'; for (let y = -h - 4; y < 4; y += 2.4) { ctx.beginPath(); ctx.moveTo(cx - 1.6, cy + y); ctx.lineTo(cx + 1.6, cy + y - 2); ctx.lineTo(cx + 1.6, cy + y - 0.8); ctx.lineTo(cx - 1.6, cy + y + 1.2); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = '#5a2a3a'; ctx.beginPath(); ctx.ellipse(cx, cy - h, 1.6, 0.6, 0, 0, 7); ctx.fill();
        for (let j = 0; j < 3; j++) { // coloured puffs rising
          const p = (tm * 0.4 + j / 3 + k * 0.2) % 1;
          ctx.fillStyle = cols[(j + k) % 3]!.replace(')', '') + Math.round(200 * (1 - p)).toString(16).padStart(2, '0');
          ctx.beginPath(); ctx.arc(cx + p * 3 + Math.sin(p * 6 + j) * 0.8, cy - h - 1 - p * 11, 1.2 + p * 2.6, 0, 7); ctx.fill();
        }
      }
    });
    // lollipop trees and a candy cane by the gate
    for (const [x, y, c] of [[-4, 9, '#ff6aa8'], [36, -8, '#6ad4ff'], [52, 8, '#ffb43a'], [50, -6, '#9a6aff']] as const) upright(ctx, x, y, () => {
      ctx.fillStyle = 'rgba(20,16,10,.16)'; ctx.beginPath(); ctx.ellipse(1.2, 0.6, 3, 1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f6efe2'; ctx.fillRect(-0.35, -5, 0.7, 5);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -7, 3, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let a = 0; a < 12; a += 0.3) { const r = a / 12 * 2.6, px = Math.cos(a) * r, py = -7 + Math.sin(a) * r; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(-1, -8, 0.8, 0, 7); ctx.fill();
    });
    upright(ctx, 30, -9, () => { // a candy cane
      ctx.lineCap = 'round'; ctx.lineWidth = 1.4; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.arc(1.6, -6, 1.6, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#e03a4a'; ctx.setLineDash([0.8, 0.8]); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
    });
    // gift boxes of chocolate with ribbons, more by level
    for (let k = 0; k < 2 + lvl; k++) {
      const x = 28 + (k % 3) * 6, y = 10 - Math.floor(k / 3) * 5;
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x + 0.6, y - 1.4, 4.6, 3.6);
      ctx.fillStyle = pick(H(30 + k), ['#e8577a', '#8ad0ff', '#ffd56a', '#b48aff']); ctx.fillRect(x, y - 2, 4.6, 3.6);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 2, y - 2, 0.6, 3.6); ctx.fillRect(x, y - 0.5, 4.6, 0.6);
    }
    for (let k = 0; k < 4; k++) sack(ctx, -6 + (k % 2) * 4, -8 + Math.floor(k / 2) * 3, k < 2 ? '#8a5a3a' : '#efe9d8'); // cocoa and flour in
    person(ctx, 20, 11, '#e86aa0', '#3aa070'); person(ctx, -12, 11, '#3aa0e8', '#e8b030'); // workers in bright overalls
    extras(ctx, tm, H, [[-55, -8], [-55, 8]], ['lamp', 'flowers']);
  },
  tyreworks: (ctx, tm, H, lvl) => { // a long rubber works with a smoking stack, rubber bales and steel in, stacks of black tyres out
    worksGround(ctx, H, '#7a746a');
    const [w, r] = pick(H(2), HALL_LOOKS.tyreworks!);
    hall(ctx, tm, -22, 38, w, r, true, lvl);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = '#d8d0b0'; ctx.fillRect(4 + (k % 2) * 5, 5 - Math.floor(k / 2) * 4, 4, 3); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(4 + (k % 2) * 5, 7.4 - Math.floor(k / 2) * 4, 4, 0.6); } // rubber bales
    for (let k = 0; k < 2; k++) { ctx.fillStyle = '#9aa0a8'; ctx.fillRect(4, -4 - k * 1.6, 12, 1.2); } // steel
    for (let k = 0; k < 2 + lvl; k++) { // stacks of tyres, seen from above: black rings
      const x = 26 + (k % 3) * 9, y = 4 - Math.floor(k / 3) * 8;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(x + 1, y + 1, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#1e1e20'; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, 7); ctx.stroke();
      ctx.fillStyle = '#7a746a'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); // the hole
    }
    extras(ctx, tm, H, [[-53, -6], [-53, 6], [53, -9], [53, 10]], ['barrels', 'crates', 'worker', 'workers', 'lamp', 'cart']);
  },
} satisfies Record<string, Art>;

/** Farm: farmhouse, a barn with its doors open, a silo or two, the home field of ripe wheat, hens and hay bales. */
function farmArt(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) {
  const [bw, br] = pick(H(2), [['#a8402e', '#5e5048'], ['#e8e0cc', '#7a3a30'], ['#8a6a4a', '#4a4e52'], ['#a8402e', '#3e3a38']] as const);
  const [hw, hr] = pick(H(3), [['#efe6d2', '#8a3a30'], ['#e8d8b8', '#4a5a6a'], ['#d8c8a8', '#5e4a36']] as const);
  // farmyard
  ctx.fillStyle = '#9a8a66'; ctx.beginPath(); ctx.roundRect(-58, -13, 48, 26, 4); ctx.fill();
  for (let k = 0; k < 24; k++) { ctx.fillStyle = 'rgba(60,50,30,.35)'; ctx.fillRect(-56 + H(300 + k) * 44, -11 + H(310 + k) * 22, 0.7, 0.6); }
  cottage(ctx, -50, 5, 12, 11, { wall: hw, roof: hr, chimney: 0.5, tm, smoke: true });
  cottage(ctx, -33, -3, 15, 16, { wall: bw, roof: br, door: true });
  ctx.fillStyle = '#3a2a1e'; ctx.fillRect(-35.6, 3.2, 5.2, 1.6); // the barn doors open
  // silos, more with level
  for (let s = 0; s < Math.min(2, lvl); s++) {
    const u = -18 + s * -0.0, v = -6 + s * 9;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(u + 1.6, v + 1.8, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = pick(H(4), ['#c9c2b0', '#b8bcc0', '#a8402e']); ctx.beginPath(); ctx.arc(u, v, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(u - 1.2, v - 1.2, 2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(u, v, 2.8, 0, 7); ctx.stroke();
    ctx.fillStyle = '#6a6458'; ctx.beginPath(); ctx.arc(u, v, 0.9, 0, 7); ctx.fill();
  }
  // the home field by the barn: ripe wheat in rows, ears swaying, a hedge along its far side
  ctx.fillStyle = '#d9b54e'; ctx.fillRect(-9, -13, 66, 26);
  ctx.strokeStyle = '#b8902e'; ctx.lineWidth = 1.1;
  for (let r = -10; r < 13; r += 3.2) { ctx.beginPath(); for (let u = -9; u <= 57; u += 5) ctx.lineTo(u, r + Math.sin(u * 0.35) * 0.4); ctx.stroke(); }
  ctx.fillStyle = '#f3dc8a';
  for (let k = 0; k < 44; k++) { const u = -7 + H(100 + k) * 62, v = -11 + H(200 + k) * 22; ctx.fillRect(u + Math.sin(tm * 1.8 + u * 0.08) * 0.9, v, 0.9, 2); }
  // a harvested strip with bales, on some farms
  if (H(5) > 0.4) { const u0 = 20 + H(6) * 24; ctx.fillStyle = '#c8a860'; ctx.fillRect(u0, -13, 10, 26); for (let k = 0; k < 3; k++) hayBale(ctx, u0 + 3 + (k % 2) * 4, -8 + k * 7); }
  ctx.strokeStyle = '#3f6a2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 13.4); ctx.lineTo(57, 13.4); ctx.stroke();
  for (let k = 0; k < 9; k++) bush(ctx, -7 + k * 7.6, 13.4, 1.8, k % 2 ? '#4f7f38' : '#3b6329');
  extras(ctx, tm, H, [[-50, -7], [-22, 9], [-44, 11], [-56, -2]], ['hens', 'hens', 'dog', 'cart', 'tree', 'flowers', 'worker', 'bales']);
}

/** Sheep farm: farmhouse, a shearing shed, a pasture inside dry-stone walls, sheep grazing, a dog and the shepherd. */
function woolArt(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) {
  const [hw, hr] = pick(H(3), [['#efe6d2', '#5e4a36'], ['#d8cfc0', '#4a5a6a'], ['#c8b898', '#7a3a30']] as const);
  ctx.fillStyle = '#8a8a5e'; ctx.beginPath(); ctx.roundRect(-58, -13, 32, 26, 4); ctx.fill();
  cottage(ctx, -50, -4, 12, 11, { wall: hw, roof: hr, chimney: -0.5, tm, smoke: true });
  cottage(ctx, -36, 6, 14, 10, { wall: '#9c7a52', roof: '#5e4a36', walls: 'logs', door: true });
  // pasture walls
  stoneWall(ctx, -22, -12, 56, -12); stoneWall(ctx, -22, 12, 56, 12); stoneWall(ctx, -22, -12, -22, 3); stoneWall(ctx, 56, -12, 56, 12);
  // a water trough and a tree for shade
  ctx.fillStyle = '#5a4630'; ctx.fillRect(-16, 6, 7, 2.4); ctx.fillStyle = '#6fa0c0'; ctx.fillRect(-15.4, 6.5, 5.8, 1.4);
  bush(ctx, 46 - H(7) * 50, -6 + H(8) * 4, 4.2, '#3f6f30');
  const sheep = 6 + Math.floor(H(9) * 4) + lvl * 2;
  for (let k = 0; k < sheep; k++) {
    const u = -16 + H(k) * 68 + Math.sin(tm * 0.3 + k) * 1.5, v = -8 + H(k + 30) * 17;
    const black = H(k + 60) > 0.9;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(u + 0.6, v + 0.7, 2.6, 1.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = black ? '#3a3632' : '#f2eee4'; ctx.beginPath(); ctx.ellipse(u, v, 2.6, 1.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(u - 0.8, v - 0.5, 0.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2622'; ctx.beginPath(); ctx.arc(u + 2.4, v, 0.9, 0, 7); ctx.fill();
  }
  dog(ctx, -6 + H(10) * 20, 9, '#2a2624');
  person(ctx, -10 + H(11) * 10, -9, '#5a6a3a', '#3a2a1e');
  extras(ctx, tm, H, [[-52, 9], [-30, -9]], ['hens', 'flowers', 'cart', 'tree', 'sacks']);
}

/** Oil well: a lattice derrick, nodding pumpjacks (more with level), storage tanks with ladders, pipes and drums. */
function oilArt(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number) {
  worksGround(ctx, H, '#6e675a');
  for (let k = 0; k < 4; k++) { ctx.fillStyle = 'rgba(20,18,16,.35)'; ctx.beginPath(); ctx.ellipse(-40 + H(950 + k) * 80, -8 + H(960 + k) * 16, 3 + H(970 + k) * 3, 1.4 + H(980 + k), 0, 0, 7); ctx.fill(); } // oil stains
  // derrick: four legs, cross bracing, the crown block on top
  const du = -42, dv = -1, s = 8;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(du - s + 3, dv - s + 3, s * 2, s * 2);
  ctx.strokeStyle = '#3a3e44'; ctx.lineWidth = 0.7; ctx.strokeRect(du - s, dv - s, s * 2, s * 2);
  ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 0.4;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { ctx.beginPath(); ctx.moveTo(du + a * s, dv + b * s); ctx.lineTo(du + a * 1.6, dv + b * 1.6); ctx.stroke(); }
  for (let k = 1; k < 4; k++) { const t = k / 4, q = s - (s - 1.6) * t; ctx.strokeRect(du - q, dv - q, q * 2, q * 2); }
  ctx.fillStyle = '#d0a020'; ctx.fillRect(du - 1.8, dv - 1.8, 3.6, 3.6);
  // pumpjacks
  for (let p = 0; p < Math.min(3, lvl); p++) {
    const pu = -20 + p * 16, pv = p % 2 ? 6 : -4;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(pu - 7, pv + 2, 15, 2.4);
    ctx.fillStyle = '#5b6066'; ctx.fillRect(pu - 8, pv + 1, 15, 2.4);
    const a = Math.sin(tm * 2 + p * 1.7) * 0.35; ctx.save(); ctx.translate(pu, pv); ctx.rotate(a);
    ctx.fillStyle = pick(H(12), ['#2b2b38', '#3a2a2a', '#2a3a2e']); ctx.fillRect(-8, -1.3, 14, 2.6); ctx.fillStyle = '#d0a020'; ctx.fillRect(5, -2.6, 3.4, 5.2); ctx.restore();
    ctx.fillStyle = '#3a3a48'; ctx.fillRect(pu - 1, pv - 1, 2, 4);
  }
  // storage tanks
  const tc = pick(H(13), ['#c9ccd1', '#e8e2d0', '#c84a3a']);
  for (let t = 0; t < 1 + Math.min(2, lvl); t++) {
    const tu = 30 + (t % 2) * 16, tv = t < 2 ? -3 + t * 2 : 8, rr = t < 2 ? 8 : 4.5;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(tu + 1.6, tv + 1.6, rr, 0, 7); ctx.fill();
    ctx.fillStyle = tc; ctx.beginPath(); ctx.arc(tu, tv, rr, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(tu - rr * 0.3, tv - rr * 0.3, rr * 0.45, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(tu, tv, rr * 0.65, 0, 7); ctx.stroke();
  }
  ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-34, 10); ctx.lineTo(26, 10); ctx.stroke();
  extras(ctx, tm, H, [[-54, 9], [12, -10], [-6, 10], [54, 10]], ['barrels', 'barrels', 'worker', 'lamp', 'crates', 'workers']);
}

const ART: Record<Building['kind'], Art> = {
  ...FACTORY_ART,
  wood: (ctx, tm, H, lvl) => lumberCamp(ctx, tm, H, lvl),
  dock: (ctx, tm, H, lvl, len) => dockArt(ctx, tm, H, lvl, len),
  farm: (ctx, tm, H, lvl) => farmArt(ctx, tm, H, lvl),
  stone: (ctx, tm, H, lvl) => quarry(ctx, tm, H, lvl),
  coal: (ctx, tm, H, lvl) => pithead(ctx, tm, H, lvl, ['#2a2725', '#3e3a36', '#14120f']),
  iron: (ctx, tm, H, lvl) => pithead(ctx, tm, H, lvl, ['#7a4a3a', '#9a5e48', '#5a3328']),
  oil: (ctx, tm, H, lvl) => oilArt(ctx, tm, H, lvl),
  wool: (ctx, tm, H, lvl) => woolArt(ctx, tm, H, lvl),
  gold: (ctx, tm, H, lvl) => { pithead(ctx, tm, H, lvl, ['#b8923a', '#e0b84a', '#7a5e22']); sparkle(ctx, tm, H, '#ffe68a'); },
  gems: (ctx, tm, H, lvl) => { pithead(ctx, tm, H, lvl, ['#6a6e78', '#8a8e98', '#3e424a']); sparkle(ctx, tm, H, '#9ae0ff'); },
  cocoa: (ctx, tm, H, lvl) => grove(ctx, tm, H, lvl, '#3f6a2e', '#c0782e', '#8a5a3a'),
  rubber: (ctx, tm, H, lvl) => grove(ctx, tm, H, lvl, '#2f5a2a', '#e8e4d8', '#d8d0b0'),
};

/** Glints on a gold or gem mine's heap. */
function sparkle(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, col: string) {
  for (let k = 0; k < 6; k++) {
    const a = 0.5 + 0.5 * Math.sin(tm * 3 + k * 1.7); if (a < 0.6) continue;
    ctx.fillStyle = col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(10 + H(700 + k) * 40, -8 + H(710 + k) * 16, 0.8, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A plantation grove on the far islands: rows of trees bearing pods or tapped for latex, a drying shed, baskets of the crop, pickers. */
function grove(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number, leaf: string, pod: string, basket: string) {
  ctx.fillStyle = '#7a8a4e'; ctx.beginPath(); ctx.roundRect(-58, -13, 116, 26, 4); ctx.fill();
  cottage(ctx, -46, 2, 18, 13, { wall: '#c8a878', roof: '#6e5a3a', walls: 'logs', door: true }); // the drying shed
  for (let k = 0; k < 3 + lvl; k++) sack(ctx, -32 + (k % 3) * 4, 9 - Math.floor(k / 3) * 3, basket);
  for (let row = 0; row < 2; row++) for (let k = 0; k < 7; k++) {
    const u = -22 + k * 11 + (row % 2) * 5, v = -6 + row * 11;
    ctx.fillStyle = '#5a3e24'; ctx.fillRect(u - 0.5, v, 1, 3);
    bush(ctx, u, v, 3.6 + H(k + row * 10) * 0.8, leaf);
    ctx.fillStyle = pod; for (let j = 0; j < 3; j++) ctx.fillRect(u - 2 + H(k * 3 + j + row * 40) * 4, v - 1.5 + H(k * 3 + j + 20 + row * 40) * 3, 1, 1.4);
  }
  const pu = -16 + ((tm * 4) % 70);
  person(ctx, pu, 2, '#e8c25a', '#8a5a2a'); person(ctx, 40 - ((tm * 3) % 50), 1.5, '#c0392b', '#3a2a1e');
}

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
  const [cw, cr] = pick(H(3), [['#8a5e36', '#5a4030'], ['#7a5234', '#4a5048'], ['#9a6a40', '#6a3a2e'], ['#6e4a2e', '#3e4a3a']] as const);
  cottage(ctx, -44, 1, 22, 18, { wall: cw, roof: cr, walls: 'logs', chimney: -0.8, tm, smoke: true });
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
  const [qw, qr] = pick(H(3), [['#c8bfae', '#5b6066'], ['#d8cdb4', '#7a3a30'], ['#b8b0a0', '#4a5a6a']] as const);
  cottage(ctx, -38, 6, 12, 10, { wall: qw, roof: qr, chimney: 0.6, tm, smoke: true });
  person(ctx, -30, -6, '#7a4a3a');
}

/**
 * Coal or iron mine: a brick engine house with a tall chimney, a steel headframe over the shaft with two turning
 * winding wheels and cables to the engine house, a narrow track where a tub runs to the heap, and miners in helmets.
 */
function pithead(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number, heap: [string, string, string]) {
  yardGround(ctx, -58, 58, '#6e665a', H, 'rgba(30,26,22,.55)');
  // engine house with its round chimney
  const [mw, mr] = pick(H(3), [['#9a4a34', '#3e3a38'], ['#8a5a44', '#4a4e56'], ['#a85a3a', '#5a4a40'], ['#8e8478', '#3e3a38']] as const);
  cottage(ctx, -44, 3, 20, 15, { wall: mw, roof: mr, walls: 'brick', storeys: 2, door: true });
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
 * and bollards for mooring (the cargo ships themselves are drawn where they are).
 */
function dockArt(ctx: CanvasRenderingContext2D, tm: number, H: (k: number) => number, lvl: number, len = 4) {
  // the same pier at any length: hl = half the deck; the crane, crates and office keep their size and move in with it
  const hl = len * 16 - 4, s = hl / 60;
  // pilings showing under the deck edge, with ripples
  for (let u = -hl + 4; u <= hl - 4; u += 8) {
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(u, 9.5 + Math.sin(tm * 2 + u) * 0.3, 2.6, 0.9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3424'; ctx.fillRect(u - 0.9, 6, 1.8, 3.4);
  }
  // the deck: planks across, a darker edge beam
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-hl + 1, -13, 2 * hl - 2, 21);
  ctx.fillStyle = '#9a7a52'; ctx.fillRect(-hl, -14, 2 * hl, 20);
  ctx.strokeStyle = 'rgba(60,40,20,.35)'; ctx.lineWidth = 0.35;
  for (let u = -hl; u <= hl; u += 2.2) { ctx.beginPath(); ctx.moveTo(u, -14); ctx.lineTo(u, 6); ctx.stroke(); }
  for (let k = 0; k < 12; k++) { ctx.fillStyle = 'rgba(40,26,12,.35)'; ctx.fillRect(-hl + 2 + H(700 + k) * (2 * hl - 4), -13 + H(710 + k) * 18, 0.6, 0.6); } // nail heads
  ctx.fillStyle = '#5a4030'; ctx.fillRect(-hl, 5, 2 * hl, 1.6);
  // bollards with ropes out to the boat
  for (const u of [-44 * s, -8 * s, 26 * s]) { ctx.fillStyle = '#2e2a26'; ctx.beginPath(); ctx.arc(u, 4, 1.2, 0, 7); ctx.fill(); }
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
  void boat; // cargo ships are drawn on their own (they come and go)
  // crates and barrels waiting on the quay
  for (let k = 0; k < Math.min(9, 3 + 3 * lvl); k++) { const u = 8 * s + (k % 3) * 4, v = -12 + ((k / 3) | 0) * 4; ctx.fillStyle = '#8a6a40'; ctx.fillRect(u, v, 3.4, 3.4); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.3; ctx.strokeRect(u, v, 3.4, 3.4); ctx.beginPath(); ctx.moveTo(u, v); ctx.lineTo(u + 3.4, v + 3.4); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { const u = 24 * s - (1 - s) * 6 + k * 3.2; ctx.fillStyle = '#6a4a2e'; ctx.beginPath(); ctx.arc(u, -10, 1.4, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(u, -10, 1, 0, 7); ctx.stroke(); }
  // harbour office
  cottage(ctx, hl - 14, -5, 14, 11, { wall: '#e8e0cc', roof: '#3f5a7a', chimney: 0.6, tm, smoke: true });
  // quay crane: a turning jib over the water with a hook and a sling of crates
  const a = Math.PI / 2 + Math.sin(tm * 0.5) * 0.9, cu = -hl + 20, cv = -6, L = 16;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(cu - 2.5, cv - 1.5, 6, 6);
  ctx.fillStyle = '#b8862e'; ctx.fillRect(cu - 3, cv - 2, 6, 6);
  const ju = cu + Math.cos(a) * L, jv = cv + Math.sin(a) * L * 0.8;
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cu + 1.5, cv + 2); ctx.lineTo(ju + 1.5, jv + 2); ctx.stroke();
  ctx.strokeStyle = '#d0a020'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cu, cv); ctx.lineTo(ju, jv); ctx.stroke();
  ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 0.3; for (let k = 1; k < 6; k++) { const p = k / 6; ctx.beginPath(); ctx.moveTo(cu + (ju - cu) * p - 0.6, cv + (jv - cv) * p); ctx.lineTo(cu + (ju - cu) * p + 0.6, cv + (jv - cv) * p + 0.8); ctx.stroke(); }
  ctx.fillStyle = '#8a6a40'; ctx.fillRect(ju - 1.6, jv + 1.4, 3.2, 2.4);
  ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(ju, jv); ctx.lineTo(ju, jv + 1.4); ctx.stroke();
  person(ctx, -hl + 30, -10, '#3f5a7a', '#2a3a4a'); person(ctx, 18 * s, -2, '#a8402e');
}
