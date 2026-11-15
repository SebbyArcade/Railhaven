import type { Game } from '../state.ts';
import type { Park } from '../buildings/parks.ts';
import { hash } from '../core/rng.ts';
import { isRevealed } from '../world/fog.ts';
import { TILE } from '../world/terrain.ts';
import { bush, cottage, fence, flowers, lamp, person, pine, puff } from './art.ts';

type Ctx = CanvasRenderingContext2D;

/**
 * 🌳 Parks and 🏛 town projects, each on its own square beside the town: a lawn with paths, trees, a pond and
 * benches; a stone clock tower; a market hall with stalls; a tram depot with a little tram; a columned theatre.
 * Same model-village style as the houses: seen from above, front wall showing, lit from the top left.
 */
export function drawParks(ctx: Ctx, g: Game, x0: number, y0: number, x1: number, y1: number, zoom: number, tm: number) {
  const n = g.world.n;
  for (const p of g.s.parks ?? []) {
    if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1 || !isRevealed(g, p.y * n + p.x)) continue;
    drawPark(ctx, g, p, zoom, tm);
  }
}

const H = (g: Game, p: Park, k: number) => hash(g.s.seed, p.x, p.y, 40 + k);

/** a stone-paved square under a project building */
function paving(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#c9bfa8'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.strokeStyle = 'rgba(90,80,64,.25)'; ctx.lineWidth = 0.3;
  for (let k = 4; k < TILE - 2; k += 3) { ctx.beginPath(); ctx.moveTo(x + 2, y + k); ctx.lineTo(x + TILE - 2, y + k); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(90,80,64,.5)'; ctx.lineWidth = 0.6; ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
}

function bench(ctx: Ctx, u: number, v: number) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(u - 2 + 0.5, v + 0.5, 4, 1.4);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(u - 2, v, 4, 1.2);
  ctx.fillStyle = '#5a3a20'; ctx.fillRect(u - 2, v - 0.6, 4, 0.5);
}

function tree(ctx: Ctx, u: number, v: number, r: number, col: string) {
  ctx.fillStyle = '#5a3e24'; ctx.fillRect(u - 0.5, v, 1, r * 0.8);
  bush(ctx, u, v, r, col);
}

function drawPark(ctx: Ctx, g: Game, p: Park, zoom: number, tm: number) {
  const x = p.x * TILE, y = p.y * TILE, u = x + TILE / 2, v = y + TILE / 2, h = (k: number) => H(g, p, k);
  if (p.k === 'park') {
    // lawn with a hedge, crossing gravel paths, a round pond, trees, flowers, benches and a stroller or two
    ctx.fillStyle = '#6fae4c'; ctx.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    ctx.strokeStyle = '#3f6f30'; ctx.lineWidth = 1.6; ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#e2d4b0'; ctx.fillRect(u - 1.2, y + 2.5, 2.4, TILE - 5); ctx.fillRect(x + 2.5, v - 1.2, TILE - 5, 2.4);
    ctx.fillStyle = '#e2d4b0'; ctx.beginPath(); ctx.arc(u, v, 5.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a9ac8'; ctx.beginPath(); ctx.arc(u, v, 3.8, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(u - 1.2, v - 1.2, 1, 0, 7); ctx.fill();
    if (zoom > 1) { ctx.fillStyle = '#f4f0e6'; const a = tm * 0.4; ctx.beginPath(); ctx.ellipse(u + Math.cos(a) * 2, v + Math.sin(a) * 2, 0.9, 0.6, a, 0, 7); ctx.fill(); } // a duck
    const cols = ['#3f7a34', '#4f8a3a', '#6a9a40', '#c2703a'];
    for (const [cx, cy, k] of [[x + 8, y + 8, 0], [x + TILE - 8, y + 8, 1], [x + 8, y + TILE - 8, 2], [x + TILE - 8, y + TILE - 8, 3]] as const)
      if (h(k) < 0.8) tree(ctx, cx, cy - 1, 3.2 + h(k + 4) * 1.2, cols[Math.floor(h(k + 8) * cols.length)]!);
      else flowers(ctx, cx, cy, j => hash(g.s.seed, p.x + j, p.y, k));
    bench(ctx, u + 5, y + 6); bench(ctx, u - 5, y + TILE - 6);
    if (zoom > 1.2) { person(ctx, u + 1.5, v + 8, '#a8402e'); if (h(9) < 0.6) person(ctx, x + 7, v + 1.5, '#3f5a7a'); }
    if (zoom > 1.4) lamp(ctx, u + 3, v - 7, tm);
    return;
  }
  paving(ctx, x, y);
  if (p.k === 'clock') {
    // a tall stone tower with a clock face on its front and a pointed slate cap
    const w = 9, top = y + 4, base = y + TILE - 6;
    ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(u - w / 2 + 3, base - 6, w + 4, 8);
    ctx.fillStyle = '#b8ad98'; ctx.fillRect(u - w / 2, top + 6, w, base - top - 6);
    ctx.strokeStyle = 'rgba(70,60,48,.35)'; ctx.lineWidth = 0.3;
    for (let yy = top + 8; yy < base; yy += 2) { ctx.beginPath(); ctx.moveTo(u - w / 2, yy); ctx.lineTo(u + w / 2, yy); ctx.stroke(); }
    ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.moveTo(u - w / 2 - 1, top + 6); ctx.lineTo(u, top - 3); ctx.lineTo(u + w / 2 + 1, top + 6); ctx.fill();
    ctx.fillStyle = '#d8b04a'; ctx.fillRect(u - 0.4, top - 5, 0.8, 2.5);
    ctx.fillStyle = '#f6efdc'; ctx.beginPath(); ctx.arc(u, top + 10, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 0.4; ctx.stroke();
    const mins = (tm / 4) % 1, hrs = (tm / 48) % 1; // the hands turn slowly
    ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(u, top + 10); ctx.lineTo(u + Math.sin(mins * 6.283) * 2.4, top + 10 - Math.cos(mins * 6.283) * 2.4); ctx.stroke();
    ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(u, top + 10); ctx.lineTo(u + Math.sin(hrs * 6.283) * 1.5, top + 10 - Math.cos(hrs * 6.283) * 1.5); ctx.stroke();
    ctx.fillStyle = '#5a4630'; ctx.fillRect(u - 1.3, base - 4, 2.6, 4); // door
    flowers(ctx, x + 7, base, j => hash(g.s.seed, p.x, p.y + j, 3)); flowers(ctx, x + TILE - 7, base, j => hash(g.s.seed, p.x, p.y + j, 4));
    if (zoom > 1.2) person(ctx, x + 6, y + 8, '#5a7a3a');
  } else if (p.k === 'market') {
    // a long open hall on columns, striped awnings and stalls of produce in front
    cottage(ctx, u, v - 3, 22, 14, { wall: '#d8c8a8', roof: '#8a4a3a', walls: 'brick', storeys: 1, door: true, chimney: 0.6, tm, smoke: zoom > 1 });
    const cols = ['#e85a5a', '#f2d24a', '#5aa0e8'];
    for (let k = 0; k < 3; k++) {
      const sx = x + 6 + k * 8, sy = y + TILE - 7;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(sx - 3 + 0.5, sy + 0.5, 6, 3);
      ctx.fillStyle = cols[k]!; ctx.fillRect(sx - 3, sy - 1.5, 6, 1.6);
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(sx - 1, sy - 1.5, 2, 1.6);
      ctx.fillStyle = '#9a7444'; ctx.fillRect(sx - 2.6, sy + 0.2, 5.2, 2);
      for (let j = 0; j < 3; j++) { ctx.fillStyle = ['#e8603c', '#7ac24a', '#f2c040'][(j + k) % 3]!; ctx.beginPath(); ctx.arc(sx - 1.6 + j * 1.6, sy + 0.9, 0.6, 0, 7); ctx.fill(); }
    }
    if (zoom > 1.2) { person(ctx, x + 10, y + TILE - 3, '#3f5a7a'); person(ctx, x + 21, y + TILE - 3, '#a8402e'); }
  } else if (p.k === 'tram') {
    // a tram depot with a short line out front and a little green-and-cream tram on it
    cottage(ctx, u, y + 10, 20, 12, { wall: '#c98a68', roof: '#4a5560', walls: 'brick', storeys: 1, door: false });
    ctx.fillStyle = '#3a3026'; ctx.fillRect(u - 4, y + 12, 8, 4); // big doorway
    ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = 0.6;
    for (const o of [-1.3, 1.3]) { ctx.beginPath(); ctx.moveTo(x + 3, y + 23 + o); ctx.lineTo(x + TILE - 3, y + 23 + o); ctx.stroke(); }
    const tx = x + 6 + ((tm * 3) % (TILE - 16));
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(tx + 0.6, y + 21, 10, 4.4);
    ctx.fillStyle = '#3f7a4a'; ctx.fillRect(tx, y + 20.4, 10, 2); ctx.fillStyle = '#f0e6c8'; ctx.fillRect(tx, y + 22.4, 10, 1.8);
    ctx.fillStyle = '#6f93a8'; for (let k = 0; k < 4; k++) ctx.fillRect(tx + 1 + k * 2.3, y + 22.7, 1.4, 1.1);
    ctx.strokeStyle = '#2e2a26'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(tx + 5, y + 20.4); ctx.lineTo(tx + 6.5, y + 18.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,36,30,.6)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(x + 2, y + 18.6); ctx.lineTo(x + TILE - 2, y + 18.6); ctx.stroke(); // overhead wire
  } else if (p.k === 'theatre') {
    // a grand theatre: pale stone front with columns, a pediment, a green dome and lit posters
    const w = 24, top = y + 5;
    ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(u - w / 2 + 2, top + 2, w, 22);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(u - w / 2, top + 6, w, 18);
    ctx.fillStyle = '#5a8a74'; ctx.beginPath(); ctx.ellipse(u, top + 6, 6, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(u - 2, top + 3.5, 1.6, 1.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8b04a'; ctx.fillRect(u - 0.4, top - 2, 0.8, 2.4);
    ctx.fillStyle = '#d4c6a6'; ctx.beginPath(); ctx.moveTo(u - w / 2 - 1, top + 12); ctx.lineTo(u, top + 8); ctx.lineTo(u + w / 2 + 1, top + 12); ctx.fill();
    ctx.fillStyle = '#f6efdc'; for (let k = 0; k < 6; k++) ctx.fillRect(u - w / 2 + 2 + k * 4, top + 12, 1.4, 10);
    ctx.fillStyle = '#7a2a2a'; ctx.fillRect(u - 2, top + 17, 4, 5); // red door
    const glow = 0.7 + 0.3 * Math.sin(tm * 2);
    ctx.fillStyle = `rgba(255,210,110,${glow})`; ctx.fillRect(u - w / 2 + 0.5, top + 16, 1.2, 3); ctx.fillRect(u + w / 2 - 1.7, top + 16, 1.2, 3);
    if (zoom > 1.2) { person(ctx, u - 6, y + TILE - 3, '#7a3a8a'); person(ctx, u + 6, y + TILE - 3, '#2e2a26'); }
    if (zoom > 1) puff(ctx, u + 9, top + 6, tm * 0.6, false, 0.6);
  }
  if (zoom > 1.6) { fence(ctx, x + 2, y + TILE - 2, x + 9, y + TILE - 2); fence(ctx, x + TILE - 9, y + TILE - 2, x + TILE - 2, y + TILE - 2); }
  void pine;
}
