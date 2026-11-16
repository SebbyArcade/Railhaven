import type { Game } from '../state.ts';
import { FIREFIGHTER, FITTER, GANG, worker } from './art.ts';
import { buildingSquares } from '../buildings/industries.ts';
import { bodyPoint } from '../trains/train.ts';
import { TILE } from '../world/terrain.ts';
import { hash } from '../core/rng.ts';
import { type CrewRun, runPoint, runValid } from '../world/crews.ts';

/**
 * A crew's rail vehicle, on the rails at p: the fire crew's little red engine (ladder, flashing blue lamp, two
 * firefighters in yellow helmets riding on it) or the repair crew's handcar (two workers pumping the see-saw lever).
 * `riding` = the crew is on board (on the way out or home); parked, the vehicle stands empty.
 */
export function drawCrewCar(ctx: CanvasRenderingContext2D, kind: CrewRun['kind'], p: { x: number; y: number; tx: number; ty: number }, tm: number, riding: boolean) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.ty, p.tx));
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-6, -2.6, 13, 6.6);
  if (kind === 'fire') {
    ctx.fillStyle = '#c8322a'; ctx.fillRect(-6.5, -3.2, 13, 6.4); // body
    ctx.fillStyle = '#7e1a14'; ctx.fillRect(3, -3.2, 3.5, 6.4); // cab roof at the front
    ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 0.6; // the ladder along the top
    ctx.beginPath(); ctx.moveTo(-5.5, -1.2); ctx.lineTo(2.2, -1.2); ctx.moveTo(-5.5, 1.2); ctx.lineTo(2.2, 1.2);
    for (let x = -5; x <= 2; x += 1.6) { ctx.moveTo(x, -1.2); ctx.lineTo(x, 1.2); } ctx.stroke();
    ctx.fillStyle = Math.floor(tm * 4) % 2 ? '#5aa8ff' : '#1e4a9a'; ctx.beginPath(); ctx.arc(4.8, 0, 1.1, 0, 7); ctx.fill(); // blue lamp
    if (riding) for (const [x, y, f] of [[-3.8, -3.6, -1], [-0.8, 3.6, 1]] as const) worker(ctx, x, y, { ...FIREFIGHTER, tool: 'none' }, f, 0, 0.75); // firefighters on the running boards
  } else {
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(-5, -3, 10, 6); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-0.5, -3, 1, 6); // deck and lever post
    if (riding) {
      const sw = Math.sin(tm * 8); // the see-saw pump lever going up and down, one worker at each end
      ctx.strokeStyle = '#2a211c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-sw * 2.2 - 3, 0); ctx.lineTo(sw * 2.2 + 3, 0); ctx.stroke();
      worker(ctx, -3.2, 1.5, { ...GANG, tool: 'pump' }, 1, sw, 0.75); worker(ctx, 3.2, 1.5, { ...GANG, hat: '#f2f2ee', tool: 'pump' }, -1, -sw, 0.75);
    }
  }
  ctx.restore();
}

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
    const run = b.fire.run && runValid(g, b.fire.run) ? b.fire.run : null;
    if (run && t < b.fire.crewAt) { const p = runPoint(g, run, t); if (p) drawCrewCar(ctx, 'fire', p, tm, true); } // on its way along the rails
    if (t >= b.fire.crewAt) { // the fire engine stands on the loading track; two firefighters climb down and spray water
      const tgt = sq[2]!, tx = (tgt % n + 0.5) * TILE, ty = (((tgt / n) | 0) + 0.5) * TILE;
      let ex: number, ey: number;
      const p = run ? runPoint(g, run, b.fire.crewAt) : null;
      if (p) { drawCrewCar(ctx, 'fire', p, tm, false); const k = Math.hypot(tx - p.x, ty - p.y) || 1; ex = p.x + (tx - p.x) / k * 9; ey = p.y + (ty - p.y) / k * 9; } // they stand between the engine and the fire
      else {
        const e = sq[3]!; ex = (e % n + 0.5) * TILE; ey = (((e / n) | 0) + 0.5) * TILE;
        ctx.fillStyle = '#c8322a'; ctx.fillRect(ex - 7, ey + 2, 14, 7); ctx.fillStyle = '#e8c070'; ctx.fillRect(ex - 6, ey + 1, 12, 1.5);
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(ex - 4, ey + 9.5, 1.8, 0, 7); ctx.arc(ex + 4, ey + 9.5, 1.8, 0, 7); ctx.fill();
      }
      for (const [dx, ph] of [[-4, 0], [4, 1.3]] as const) {
        const f = tx >= ex + dx ? 1 : -1, k = 0.9;
        worker(ctx, ex + dx, ey + 2, FIREFIGHTER, f, 0, k);
        const fx = ex + dx + f * 3.6 * k, fy = ey + 2 - 5.6 * k; // the nozzle
        ctx.strokeStyle = 'rgba(150,200,255,.75)'; ctx.lineWidth = 1.4; ctx.setLineDash([2, 2]); ctx.lineDashOffset = -tm * 30 - ph * 4;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo((fx + tx) / 2, Math.min(fy, ty) - 12, tx + dx, ty - 4); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  for (const b of g.s.breaks ?? []) { // the repair crew pumping its handcar along the rails to the break
    if (!b.run || t >= b.crewAt || !runValid(g, b.run)) continue;
    const p = runPoint(g, b.run, t); if (p && vis(Math.floor(p.y / TILE) * n + Math.floor(p.x / TILE))) drawCrewCar(ctx, 'repair', p, tm, true);
  }
  for (const r of g.s.crews ?? []) { // crews riding home after the job
    if (!runValid(g, r)) continue;
    const p = runPoint(g, r, t); if (p && !p.arrived && vis(Math.floor(p.y / TILE) * n + Math.floor(p.x / TILE))) drawCrewCar(ctx, r.kind, p, tm, true);
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
    } else { // the crew's handcar with a tool box; a fitter turning a spanner on the engine, a mate handing tools
      const hx = p.x + ox * 1.45, hy = p.y + oy * 1.45;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(hx - 3.4, hy - 1.9, 8, 5);
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(hx - 4, hy - 2.5, 8, 5); ctx.fillStyle = '#b8402c'; ctx.fillRect(hx - 3, hy - 2, 3.2, 2);
      const wx = p.x + ox * 0.75, wy = p.y + oy * 0.75 + 3, f = p.x >= wx ? 1 : -1;
      worker(ctx, wx, wy, FITTER, f, Math.sin(tm * 7), 1.1);
      if (Math.sin(tm * 7) > 0.9) { ctx.fillStyle = '#ffe27a'; ctx.fillRect(wx + f * 4, wy - 6, 0.8, 0.8); }
      worker(ctx, hx + 2, hy + 4, { ...GANG, tool: 'spanner' }, f, Math.sin(tm * 1.5) * 0.5, 1.1);
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
