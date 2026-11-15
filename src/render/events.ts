import type { Game } from '../state.ts';
import { buildingSquares } from '../buildings/industries.ts';
import { bodyPoint } from '../trains/train.ts';
import { TILE } from '../world/terrain.ts';
import { hash } from '../core/rng.ts';

/** Fires on buildings and broken-down trains, with their crews. Drawn over buildings and trains, in world space. */
export function drawMishaps(ctx: CanvasRenderingContext2D, g: Game, tm: number, vis: (sq: number) => boolean) {
  const n = g.world.n, t = g.s.t;
  for (const b of g.s.buildings ?? []) {
    if (!b.fire || t >= b.fire.doneAt) continue;
    const sq = buildingSquares(n, b); if (!sq.some(vis)) continue;
    const out = Math.max(0, Math.min(1, (t - b.fire.crewAt) / (b.fire.doneAt - b.fire.crewAt))); // how far the crew has got
    sq.forEach((i, k) => {
      if (k === 3 && out > 0) return; // the crew works from this end
      const x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE, size = (1 - out * 0.8) * (k === 1 || k === 2 ? 1 : 0.6);
      if (size < 0.15) return;
      for (let f = 0; f < 5; f++) { // flickering flames
        const h = hash(b.id, k, f, 71), fx = x + (h - 0.5) * 18, fl = Math.sin(tm * (9 + f) + f * 2) * 0.25 + 0.75, r = (5 + h * 4) * size * fl;
        ctx.fillStyle = 'rgba(255,140,30,.85)'; ctx.beginPath(); ctx.ellipse(fx, y - r * 0.4, r * 0.55, r, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,90,.9)'; ctx.beginPath(); ctx.ellipse(fx, y - r * 0.2, r * 0.28, r * 0.55, 0, 0, 7); ctx.fill();
      }
      for (let s = 0; s < 3; s++) { // dark smoke rising
        const ph = (tm * 0.4 + s / 3 + k * 0.17) % 1, sx = x + Math.sin(ph * 5 + k) * 4 + ph * 10, sy = y - 8 - ph * 30;
        ctx.fillStyle = `rgba(60,55,52,${0.45 * (1 - ph) * Math.max(0.3, 1 - out)})`; ctx.beginPath(); ctx.arc(sx, sy, 4 + ph * 9, 0, 7); ctx.fill();
      }
    });
    if (t >= b.fire.crewAt) { // the fire cart and two firefighters spraying water
      const e = sq[3]!, ex = (e % n + 0.5) * TILE, ey = (((e / n) | 0) + 0.5) * TILE, tgt = sq[2]!, tx = (tgt % n + 0.5) * TILE, ty = (((tgt / n) | 0) + 0.5) * TILE;
      ctx.fillStyle = '#c8322a'; ctx.fillRect(ex - 7, ey + 2, 14, 7); ctx.fillStyle = '#e8c070'; ctx.fillRect(ex - 6, ey + 1, 12, 1.5);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(ex - 4, ey + 9.5, 1.8, 0, 7); ctx.arc(ex + 4, ey + 9.5, 1.8, 0, 7); ctx.fill();
      for (const [dx, ph] of [[-4, 0], [4, 1.3]] as const) {
        const fx = ex + dx, fy = ey - 3; ctx.fillStyle = '#2b3d6b'; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 7); ctx.fill(); ctx.fillStyle = '#f0c030'; ctx.beginPath(); ctx.arc(fx, fy - 1, 1.2, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(150,200,255,.75)'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 2]); ctx.lineDashOffset = -tm * 30 - ph * 4;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + tx) / 2, Math.min(fy, ty) - 12, tx + dx, ty - 4); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  for (const tr of g.s.trains) {
    if (!tr.broke || t >= tr.broke.doneAt || !tr.trail.length) continue;
    const p = bodyPoint(g.net, tr, 4); if (!vis(Math.floor(p.y / TILE) * n + Math.floor(p.x / TILE))) continue;
    for (let s = 0; s < 3; s++) { // white steam leaking from the engine
      const ph = (tm * 0.8 + s / 3) % 1;
      ctx.fillStyle = `rgba(245,245,245,${0.6 * (1 - ph)})`; ctx.beginPath(); ctx.arc(p.x + ph * 8, p.y - 4 - ph * 14, 2.5 + ph * 5, 0, 7); ctx.fill();
    }
    const ox = -p.ty * 11, oy = p.tx * 11; // beside the line
    if (t < tr.broke.crewAt) { // a red warning lamp until the crew comes
      ctx.fillStyle = Math.floor(tm * 3) % 2 ? '#ff4a3a' : '#a02018'; ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, 2.6, 0, 7); ctx.fill();
    } else { // the crew's handcar and a fitter with a spanner
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(p.x + ox * 1.4 - 4, p.y + oy * 1.4 - 2.5, 8, 5);
      const sw = Math.sin(tm * 7); ctx.fillStyle = '#f0a020'; ctx.beginPath(); ctx.arc(p.x + ox * 0.7, p.y + oy * 0.7, 1.9, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(p.x + ox * 0.7, p.y + oy * 0.7); ctx.lineTo(p.x + ox * 0.35 + sw * 2, p.y + oy * 0.35 - 2); ctx.stroke();
      if (sw > 0.9) { ctx.fillStyle = '#ffe27a'; ctx.fillRect(p.x + ox * 0.3, p.y + oy * 0.3 - 3, 1, 1); }
    }
  }
}

/** The storm: a dark cloud shadow drifting over the land, with rain. */
export function drawStorm(ctx: CanvasRenderingContext2D, g: Game, tm: number) {
  const st = g.s.storm; if (!st || g.s.t >= st.until) return;
  const life = Math.max(0, Math.min(1, (st.until - g.s.t) / 20, (g.s.t - (st.t0 ?? st.until - 150)) / 20)); // fade in and out
  const x = st.x * TILE, y = st.y * TILE, R = st.r * TILE;
  const gr = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 1.1);
  gr.addColorStop(0, `rgba(30,38,52,${0.38 * life})`); gr.addColorStop(1, 'rgba(30,38,52,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R * 1.1, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgba(190,210,235,${0.45 * life})`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 160; k++) { // falling rain streaks
    const a = hash(k, 1, 2, 72) * Math.PI * 2, d = Math.sqrt(hash(k, 3, 4, 73)) * R, fall = (tm * 1.6 + hash(k, 5, 6, 74)) % 1;
    const rx = x + Math.cos(a) * d - fall * 6, ry = y + Math.sin(a) * d + fall * 14 - 7;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 2, ry + 6);
  }
  ctx.stroke();
}

/** A lightning flash over the whole screen now and then while the storm is on screen. */
export function stormFlash(g: Game, tm: number): number {
  const st = g.s.storm; if (!st || g.s.t >= st.until) return 0;
  const k = Math.floor(tm / 7), at = k * 7 + hash(g.s.seed, k, 9, 75) * 5, dt = tm - at;
  return hash(g.s.seed, k, 8, 76) < 0.5 && dt >= 0 && dt < 0.25 ? (dt < 0.08 || dt > 0.15 ? 0.35 : 0.1) : 0;
}
