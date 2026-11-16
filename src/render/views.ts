import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { type View, toScreen } from './camera.ts';
import { fogEdges, type Mark, type MapView, viewMarks } from '../ui/mapviews.ts';

/** A map view on top of the map: dims it, then rings and labels what matters. Drawn in screen pixels. */
export function drawView(ctx: CanvasRenderingContext2D, g: Game, v: MapView, view: View, marks: Mark[], tm: number, arrows: { sx: number; sy: number; m: Mark }[] = []) {
  arrows.length = 0;
  const cam = g.s.camera, W = view.w, H = view.h, s = TILE * cam.z;
  const on = (x: number, y: number) => x > -80 && y > -40 && x < W + 80 && y < H + 40;
  ctx.fillStyle = 'rgba(12,14,18,.55)'; ctx.fillRect(0, 0, W, H);
  if (v === 'exp') { // the edge of the explored land
    const [ax, ay] = [cam.x - W / 2 / cam.z, cam.y - H / 2 / cam.z], n = g.world.n;
    const x0 = Math.floor(ax / TILE), y0 = Math.floor(ay / TILE), x1 = Math.ceil((cam.x + W / 2 / cam.z) / TILE), y1 = Math.ceil((cam.y + H / 2 / cam.z) / TILE);
    ctx.fillStyle = 'rgba(140,210,255,.5)';
    for (const i of fogEdges(g, x0, y0, x1, y1)) { const [X, Y] = toScreen(cam, view, (i % n) * TILE, ((i / n) | 0) * TILE); ctx.fillRect(X + s * 0.3, Y + s * 0.3, s * 0.4, s * 0.4); }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // zoomed out, rings shrink and deposits (places you could build) drop their words so stock labels stay readable
  const far = cam.z < 0.75, tiny = cam.z < 0.45, R = far ? 11 : 15;
  type Box = [number, number, number, number];
  const boxes: Box[] = [];
  const hits = (b: Box) => boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const pillBox = (x: number, y: number, t: string, big?: boolean) => {
    ctx.font = `${big ? 700 : 600} ${big ? 13 : 11.5}px system-ui`;
    const txt = t.length > 54 ? t.slice(0, 52) + '…' : t, w = ctx.measureText(txt).width + 14, h = big ? 22 : 19;
    const xx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
    return { txt, w, h, xx, box: [xx - w / 2 - 2, y - h / 2 - 1, xx + w / 2 + 2, y + h / 2 + 1] as Box };
  };
  const pill = (x: number, y: number, t: string, c: string, big?: boolean) => {
    const { txt, w, h, xx } = pillBox(x, y, t, big);
    ctx.fillStyle = '#0f1216ee'; ctx.beginPath(); ctx.roundRect(xx - w / 2, y - h / 2, w, h, 9); ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = c; ctx.fillText(txt, xx, y + 0.5);
  };
  // the same place may hold several marks: one ring, labels stacked under it
  const byPlace = new Map<string, Mark[]>();
  for (const m of marks) { const k = `${m.x},${m.y}`; (byPlace.get(k) ?? byPlace.set(k, []).get(k)!).push(m); }
  const p = 0.5 + 0.5 * Math.sin(tm * 3), off: { X: number; Y: number; m: Mark; d: number }[] = [];
  const shown: { X: number; Y: number; ms: Mark[] }[] = [];
  for (const ms of byPlace.values()) {
    const [X, Y] = toScreen(cam, view, (ms[0]!.x + 0.5) * TILE, (ms[0]!.y + 0.5) * TILE);
    if (!on(X, Y)) { off.push({ X, Y, m: ms[0]!, d: Math.hypot(X - W / 2, Y - H / 2) }); continue; }
    shown.push({ X, Y, ms });
  }
  // rings first (low ones under the rest), and every ring keeps its own space so no label covers it
  shown.sort((a, b) => +!a.ms[0]!.low - +!b.ms[0]!.low);
  for (const { X, Y, ms } of shown) {
    const m0 = ms[0]!, r = m0.low ? R - 3 : R;
    ctx.strokeStyle = m0.col; ctx.globalAlpha = (m0.low ? 0.5 : 0.7) + 0.3 * p; ctx.lineWidth = m0.low ? 2 : 3; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.font = `${m0.low ? r + 1 : r}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText(m0.icon, X, Y + 1);
    const bar = ms.find(m => m.bar !== undefined)?.bar;
    if (bar !== undefined) { const bw = far ? 30 : 46, f = Math.min(1, Math.max(0, bar)); ctx.fillStyle = '#000c'; ctx.fillRect(X - bw / 2, Y - r - 12, bw, 6); ctx.fillStyle = f > 0.9 ? '#ffd27a' : '#7fd36b'; ctx.fillRect(X - bw / 2, Y - r - 12, bw * f, 6); boxes.push([X - bw / 2, Y - r - 12, X + bw / 2, Y - r - 6]); }
    boxes.push([X - r - 1, Y - r - 1, X + r + 1, Y + r + 1]);
  }
  // then the labels, most useful first (buildings before deposits): each takes the first free spot round its ring, or stays hidden
  shown.reverse();
  for (const { X, Y, ms } of shown) {
    const m0 = ms[0]!, r = m0.low ? R - 3 : R;
    if (m0.low && far) continue;
    const full = ms.map(m => ({ m, t: (m === m0 ? '' : m.icon + ' ') + m.text }));
    const fit = (lines: typeof full) => {
      const tall = lines.reduce((a, l) => a + (l.m.big ? 23 : 20) + 1, 0), top = ms.some(m => m.bar !== undefined) ? r + 16 : r + 4;
      for (const y0 of [Y + r + 13, Y - top - tall + 10, Y + r + 34, Y - top - tall - 11]) {
        let y = y0, ok = true;
        for (const l of lines) { const { box, h } = pillBox(X, y, l.t, l.m.big); if (hits(box)) { ok = false; break; } y += h + 2; }
        if (ok) return y0;
      }
      return null;
    };
    // far out a building says just its rate; if the full words have no room, try the short ones
    const brief = m0.short ? [{ m: m0, t: m0.short }] : null;
    let lines = tiny && brief ? brief : full, at = fit(lines);
    if (at === null && brief && lines !== brief) { lines = brief; at = fit(lines); }
    if (at === null) continue; // no room: the ring and its fill bar still show, zoom in for the words
    let y = at;
    for (const l of lines) { const { box, h } = pillBox(X, y, l.t, l.m.big); boxes.push(box); pill(X, y, l.t, l.m.col, l.m.big); y += h + 2; }
  }
  // the nearest places off the screen: an arrow at the edge pointing to each
  off.sort((a, b) => a.d - b.d);
  const top = 150, bot = 150, used: [number, number][] = [];
  for (const o of off.slice(0, 8)) {
    const a = Math.atan2(o.Y - H / 2, o.X - W / 2), c = Math.cos(a), sn = Math.sin(a);
    const t = Math.min((W / 2 - 26) / Math.max(0.01, Math.abs(c)), (H / 2 - (sn < 0 ? top : bot)) / Math.max(0.01, Math.abs(sn)));
    const ex = W / 2 + c * t, ey = H / 2 + sn * t;
    if (used.some(u => Math.hypot(u[0] - ex, u[1] - ey) < 34)) continue; used.push([ex, ey]); arrows.push({ sx: ex, sy: ey, m: o.m });
    const P = (u: number, v: number): [number, number] => [ex + u * c - v * sn, ey + u * sn + v * c];
    ctx.fillStyle = o.m.col; ctx.beginPath(); ctx.moveTo(...P(20, 0)); ctx.lineTo(...P(6, -9)); ctx.lineTo(...P(6, 9)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0f1216ee'; ctx.beginPath(); ctx.arc(ex - c * 4, ey - sn * 4, 13, 0, 7); ctx.fill(); ctx.strokeStyle = o.m.col; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '13px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText(o.m.icon, ex - c * 4, ey - sn * 4 + 1);
  }
  if (!marks.length) pill(W / 2, H / 2, v === 'prob' ? '✓ Nothing stuck right now' : v === 'exp' ? '✓ Nothing left to find nearby: scout into the fog' : 'Nothing to show yet', '#7fd36b', true);
}

/** Marks for the view, recomputed at most once a second. */
export class ViewCache {
  private at = -9; private key = ''; marks: Mark[] = [];
  get(g: Game, v: MapView, tm: number): Mark[] {
    if (v !== this.key || tm - this.at > 1) { this.key = v; this.at = tm; this.marks = viewMarks(g, v); }
    return this.marks;
  }
}
