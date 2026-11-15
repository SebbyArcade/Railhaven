import { hash } from '../core/rng.ts';
import { type World, TILE } from '../world/terrain.ts';

/** Season 0 spring, 1 summer, 2 autumn, 3 winter. Colours carried over from the old game. */
export const GRASS = [['#5f8a3c', '#618c3d', '#5d883b'], ['#5d7a3a', '#5f7c3b', '#5b7839'], ['#76773a', '#78793b', '#747539'], ['#7d8f78', '#7f917a', '#7b8d76']];
const FOREST_BASE = ['#557f35', '#557a35', '#6a6a34', '#62775f'];
const CANOPY = [['#2f5a24', '#3f7330'], ['#2f5a24', '#3f7330'], ['#9a4e22', '#d48a2c'], ['#2b4630', '#3b5a3f']];
const TERRAIN_COL: Record<number, string> = { 0: '#2a7a9e', 2: '#4b6a32', 3: '#7d7356', 4: '#6f6a66' };

type C2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Distance-from-coast darkening of the sea. */
export function seaDepthMap(w: World): Float32Array {
  const n = w.n, D = new Int16Array(n * n).fill(-1), Q: number[] = [];
  for (let j = 0; j < n * n; j++) if (w.terr[j]) { D[j] = 0; Q.push(j); }
  for (let q = 0; q < Q.length; q++) {
    const j = Q[q]!, x = j % n, y = (j / n) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= n || Y >= n) continue;
      const k = Y * n + X; if (D[k]! < 0) { D[k] = D[j]! + 1; Q.push(k); }
    }
  }
  const out = new Float32Array(n * n);
  for (let j = 0; j < n * n; j++) out[j] = D[j]! <= 2 ? 0 : Math.min(0.32, (D[j]! - 2) * 0.045);
  return out;
}

export interface ArtCtx { w: World; se: number; depth: Float32Array; hasTrack(i: number): boolean; /** 0 forest, 1 stumps, 2 saplings */ stump?(i: number): number }

/** Draw the still parts of one square at (X, Y): ground, grass tufts, shores, trees, hills and mountains. */
export function drawSquare(c: C2D, a: ArtCtx, x: number, y: number, X: number, Y: number, detail: boolean) {
  const { w, se } = a, n = w.n, i = y * n + x, t = w.terr[i]!, H = (p: number, q: number, s = 0) => hash(w.seed, p, q, s);
  const water = (p: number, q: number) => p >= 0 && q >= 0 && p < n && q < n && w.terr[q * n + p] === 0;
  const hv = H(x, y, 9), cutDown = t === 2 ? a.stump?.(i) ?? 0 : 0;
  if (cutDown) { // a cut-down forest square: cleared ground with stumps, then saplings
    c.fillStyle = GRASS[se]![Math.floor(hv * 3)]!; c.fillRect(X, Y, TILE + 0.6, TILE + 0.6);
    c.fillStyle = 'rgba(90,62,36,.18)'; c.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
    if (!detail) return;
    for (let k = 0; k < 4; k++) {
      const tx = X + 6 + H(x, y, k) * 20, ty = Y + 8 + H(y, x, k) * 18;
      if (cutDown === 1) {
        c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(tx + 1, ty + 1.5, 3.2, 1.6, 0, 0, 7); c.fill();
        c.fillStyle = '#7a5532'; c.beginPath(); c.ellipse(tx, ty, 2.6, 1.6, 0, 0, 7); c.fill();
        c.fillStyle = '#d7b98a'; c.beginPath(); c.ellipse(tx, ty - 0.4, 1.8, 1, 0, 0, 7); c.fill();
      } else {
        c.fillStyle = '#5a3e24'; c.fillRect(tx - 0.5, ty - 1, 1, 3);
        c.fillStyle = se === 2 ? '#d48a2c' : se === 3 ? '#9fb3a6' : '#6fae44'; c.beginPath(); c.arc(tx, ty - 2.5, 2.6, 0, 7); c.fill();
      }
    }
    if (k3(H(x, y, 5))) { c.fillStyle = '#8a6440'; c.fillRect(X + 8, Y + 22, 9, 2.2); c.fillRect(X + 9, Y + 19.6, 8, 2.2); } // a small log pile
    return;
  }
  c.fillStyle = t === 1 ? GRASS[se]![Math.floor(hv * 3)]! : t === 2 ? FOREST_BASE[se]! : t === 0 && w.deep[i] ? '#1d5f83' : TERRAIN_COL[t]!;
  c.fillRect(X, Y, TILE + 0.6, TILE + 0.6);
  if (t === 0) {
    const dd = a.depth[i]!; if (dd > 0) { c.fillStyle = `rgba(8,28,58,${dd})`; c.fillRect(X, Y, TILE + 0.6, TILE + 0.6); }
    return;
  }
  if (!detail) {
    if (t === 2) { c.fillStyle = CANOPY[se]![0]!; c.beginPath(); c.arc(X + 16, Y + 16, 9, 0, 7); c.fill(); }
    if (t >= 3) { c.fillStyle = t === 4 ? '#8c8782' : '#968a64'; c.beginPath(); c.moveTo(X + 3, Y + TILE - 4); c.lineTo(X + TILE / 2, Y + (t === 4 ? 2 : 9)); c.lineTo(X + TILE - 3, Y + TILE - 4); c.fill(); }
    return;
  }
  if (t === 1) {
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const gx = X + 5 + H(x, y, k) * 22, gy = Y + 6 + H(y, x, k) * 20; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 1.5, gy - 4); c.moveTo(gx + 2, gy); c.lineTo(gx + 3.5, gy - 3.5); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(X + 4 + H(x, y, 7) * 24, Y + 4 + H(y, x, 7) * 24, 2, 2);
  }
  // shores: a strip of warm sand where land meets water
  c.fillStyle = se === 3 ? '#d8d4c4' : '#c8ae78';
  if (water(x, y - 1)) c.fillRect(X, Y, TILE + 0.6, 4);
  if (water(x, y + 1)) c.fillRect(X, Y + TILE - 4, TILE + 0.6, 4);
  if (water(x - 1, y)) c.fillRect(X, Y, 4, TILE + 0.6);
  if (water(x + 1, y)) c.fillRect(X + TILE - 4, Y, 4, TILE + 0.6);
  if (t === 2 && !a.hasTrack(i)) for (let k = 0; k < 3; k++) drawTree(c, a, X + 6 + H(x, y, k) * 20, Y + 8 + H(y, x, k) * 18, x, y, k);
  if (t === 4) drawMountain(c, a, X, Y, x, y);
  else if (t === 3) {
    c.fillStyle = '#968a64'; c.beginPath(); c.moveTo(X + 3, Y + TILE - 4); c.lineTo(X + TILE / 2, Y + 9); c.lineTo(X + TILE - 3, Y + TILE - 4); c.fill();
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.moveTo(X + TILE / 2, Y + 9); c.lineTo(X + TILE - 3, Y + TILE - 4); c.lineTo(X + TILE / 2, Y + TILE - 4); c.fill();
  }
}

const k3 = (v: number) => v < 0.35;

/** Round, pine and birch trees; pines next to hills and mountains. */
function drawTree(c: C2D, a: ArtCtx, tx: number, ty: number, x: number, y: number, k: number) {
  const { w, se } = a, n = w.n, H = (p: number, q: number, s = 0) => hash(w.seed, p, q, s);
  const hv = H(x * 3 + k, y * 5 + k, 71);
  const hill = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([p, q]) => w.terr[(y + q!) * n + x + p!]! >= 3);
  const kind = (hill && hv < 0.75) || hv < 0.22 ? 'pine' : hv < 0.36 ? 'birch' : 'round';
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(tx + 2, ty + 6, kind === 'pine' ? 5 : 7, 2.6, 0, 0, 7); c.fill();
  if (kind === 'pine') {
    const g1 = se === 3 ? '#3d5a45' : '#2c5530', g2 = se === 3 ? '#567a62' : '#3f7240';
    c.fillStyle = '#5a3e24'; c.fillRect(tx - 0.8, ty + 2, 1.6, 4);
    for (let j = 0; j < 3; j++) { const wd = 6 - j * 1.6, yy = ty + 3 - j * 3.6; c.fillStyle = j % 2 ? g2 : g1; c.beginPath(); c.moveTo(tx - wd, yy); c.lineTo(tx, yy - 5.5); c.lineTo(tx + wd, yy); c.closePath(); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(tx - 1, ty - 8); c.lineTo(tx, ty - 10); c.lineTo(tx - 3, ty - 5); c.fill();
  } else if (kind === 'birch') {
    c.fillStyle = '#ece6da'; c.fillRect(tx - 0.9, ty - 1, 1.8, 7); c.fillStyle = '#3a3a3a'; c.fillRect(tx - 0.9, ty + 1, 1, 0.6); c.fillRect(tx, ty + 3.5, 0.9, 0.6);
    c.fillStyle = se === 2 ? '#e0b040' : se === 3 ? '#cfd6cc' : '#7fae4a';
    for (const [dx, dy, r] of [[-2.5, -2, 3.2], [2, -3, 3], [0, -5, 3.2]] as const) { c.beginPath(); c.arc(tx + dx, ty + dy, r, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(tx - 1.5, ty - 5.5, 1.4, 0, 7); c.fill();
  } else {
    const CAN = CANOPY[se]!;
    c.fillStyle = '#5a3e24'; c.fillRect(tx - 1, ty + 1, 2, 5);
    c.fillStyle = se === 2 && k === 1 ? '#b8742a' : CAN[0]!; c.beginPath(); c.arc(tx, ty, 7, 0, 7); c.fill();
    c.fillStyle = CAN[1]!; c.beginPath(); c.arc(tx - 2, ty - 2, 4, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(tx + 2.5, ty + 2, 4, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.arc(tx - 3, ty - 3, 1.6, 0, 7); c.fill();
    if (se === 0 && H(x, y, k + 3) < 0.5) { c.fillStyle = '#ff9ec4'; for (let b = 0; b < 3; b++) { c.beginPath(); c.arc(tx - 4 + H(x, k, b) * 8, ty - 4 + H(k, y, b) * 8, 1.3, 0, 7); c.fill(); } }
  }
  if (se === 3) { c.fillStyle = 'rgba(245,248,250,.9)'; c.beginPath(); c.arc(tx - 2, ty - 3, 3.5, Math.PI, 0); c.fill(); }
}

/** Each mountain square gets its own height, one or two peaks, a shaded east face and snow on tall ones. */
function drawMountain(c: C2D, a: ArtCtx, X: number, Y: number, x: number, y: number) {
  const H = (p: number, q: number, s = 0) => hash(a.w.seed, p, q, s);
  const h1 = H(x, y, 91), h2 = H(y, x, 92), two = h2 > 0.62, peaks: [number, number, number][] = [];
  if (two) peaks.push([X + TILE * 0.32, Y + 5 + h1 * 6, TILE * 0.32], [X + TILE * 0.7, Y + 9 + h2 * 5, TILE * 0.28]);
  else peaks.push([X + TILE * (0.42 + h2 * 0.16), Y + 2 + h1 * 8, TILE * (0.42 + h1 * 0.08)]);
  for (const [px, py, hw] of peaks) {
    const base = Y + TILE - 3, tall = py < Y + 6;
    c.fillStyle = '#8c8782'; c.beginPath(); c.moveTo(px - hw, base); c.lineTo(px, py); c.lineTo(px + hw, base); c.closePath(); c.fill();
    c.fillStyle = 'rgba(30,28,35,.28)'; c.beginPath(); c.moveTo(px, py); c.lineTo(px + hw, base); c.lineTo(px + hw * 0.15, base); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(px, py); c.lineTo(px - hw * 0.45, py + (base - py) * 0.55); c.stroke();
    if (tall || a.se === 3) {
      const sh = (base - py) * (tall ? 0.32 : 0.2);
      c.fillStyle = '#f2f4f6'; c.beginPath(); c.moveTo(px, py); c.lineTo(px - (hw * sh) / (base - py) * 1.05, py + sh); c.lineTo(px - hw * 0.12, py + sh * 0.8);
      c.lineTo(px + hw * 0.1, py + sh * 1.05); c.lineTo(px + (hw * sh) / (base - py), py + sh); c.closePath(); c.fill();
    }
  }
}

/** Moving water: foam along the coast, ripples and glints. Drawn every frame when zoomed in. */
export function drawWaterLive(c: CanvasRenderingContext2D, w: World, x: number, y: number, tm: number) {
  const n = w.n, X = x * TILE, Y = y * TILE, H = (p: number, q: number, s = 0) => hash(w.seed, p, q, s);
  const L = (p: number, q: number) => p >= 0 && q >= 0 && p < n && q < n && w.terr[q * n + p]! > 0;
  const f = 0.16 + 0.14 * Math.sin(tm * 2 + x * 1.3 + y * 0.7), o = 3 + Math.sin(tm * 1.6 + x + y) * 1.2;
  c.fillStyle = `rgba(255,255,255,${f})`;
  for (let k = 0; k < 3; k++) {
    const u = 3 + k * 10 + H(x, y, k) * 3;
    if (L(x, y - 1)) c.fillRect(X + u, Y + o, 6, 1.5);
    if (L(x, y + 1)) c.fillRect(X + u, Y + TILE - o - 1.5, 6, 1.5);
    if (L(x - 1, y)) c.fillRect(X + o, Y + u, 1.5, 6);
    if (L(x + 1, y)) c.fillRect(X + TILE - o - 1.5, Y + u, 1.5, 6);
  }
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5; c.beginPath();
  const q = Math.sin(tm * 1.5 + x * 0.7 + y) * 3; c.moveTo(X + 6, Y + 14 + q); c.quadraticCurveTo(X + 16, Y + 10 + q, X + 26, Y + 14 + q); c.stroke();
  if (H(x, y, 13) < 0.35) { c.fillStyle = `rgba(255,255,255,${0.18 + 0.12 * Math.sin(tm * 2 + x + y)})`; c.beginPath(); c.arc(X + 8 + H(x, y, 14) * 16, Y + 8 + H(y, x, 14) * 16, 1.6, 0, 7); c.fill(); }
}
