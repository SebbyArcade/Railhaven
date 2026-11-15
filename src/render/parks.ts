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
  else if (p.k === 'foundry') {
    // ⛰ a brick foundry: a long hall with a glowing furnace door, a tall smoking chimney, pig iron stacked outside
    cottage(ctx, u - 2, y + 11, 20, 13, { wall: '#9c4a34', roof: '#3e3a38', walls: 'brick', storeys: 1, door: false });
    const glow = 0.65 + 0.35 * Math.sin(tm * 5 + p.x);
    ctx.fillStyle = '#2a1e16'; ctx.fillRect(u - 5, y + 13.5, 6, 4.5); // the furnace doorway
    ctx.fillStyle = `rgba(255,${140 + 60 * glow},50,${0.8 * glow})`; ctx.fillRect(u - 4.4, y + 14.6, 4.8, 3.4);
    ctx.fillStyle = `rgba(255,170,60,${0.2 * glow})`; ctx.beginPath(); ctx.arc(u - 2, y + 19, 5, 0, 7); ctx.fill(); // light on the ground
    ctx.fillStyle = '#7a3a2a'; ctx.fillRect(u + 7, y + 1, 3.6, 13); ctx.fillStyle = '#2e2a26'; ctx.fillRect(u + 6.6, y + 0.4, 4.4, 1.4); // chimney
    if (zoom > 0.8) for (let k = 0; k < 3; k++) puff(ctx, u + 8.8, y - 1 - k * 2, tm * 0.7 + k * 0.33, true, 0.8);
    for (let k = 0; k < 3; k++) for (let j = 0; j <= k % 2; j++) { // pig iron bars
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 5 + k * 5 + 0.5, y + TILE - 7 - j * 1.4 + 0.5, 4, 1.2);
      ctx.fillStyle = j ? '#6e6a68' : '#5a5654'; ctx.fillRect(x + 5 + k * 5, y + TILE - 7 - j * 1.4, 4, 1.2);
    }
    if (zoom > 1.2) person(ctx, u + 4, y + TILE - 4, '#4a4440');
  }
  else if (p.k === 'bridgeworks') {
    // 🌉 the bridge works: a little stone railway viaduct over a pond, with rails and a wagon of stone on it, and the
    // masons' brick workshop behind with cut stone blocks stacked by the door. It should read as "they build bridges here".
    cottage(ctx, u - 5, y + 8, 15, 11, { wall: '#b5523b', roof: '#5a4a42', walls: 'brick', storeys: 1, door: true });
    for (let k = 0; k < 3; k++) for (let j = 0; j <= (k === 1 ? 1 : 0); j++) { // cut stone blocks
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(u + 5 + k * 3.4 + 0.5, y + 10 - j * 2.4 + 0.5, 3, 2.2);
      ctx.fillStyle = j ? '#d8d0c0' : '#c4baa8'; ctx.fillRect(u + 5 + k * 3.4, y + 10 - j * 2.4, 3, 2.2);
    }
    // the pond under the viaduct
    const py = y + 25;
    ctx.fillStyle = '#4f8fbf'; ctx.beginPath(); ctx.ellipse(u, py, 14, 5.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(u - 8, py + 4); ctx.lineTo(u - 4, py + 4); ctx.moveTo(u + 3, py + 5); ctx.lineTo(u + 7, py + 5); ctx.stroke();
    // the viaduct: a stone deck on three arches
    const bx = x + 2.5, bw = TILE - 5, deck = py - 7;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bx + 1, deck + 1, bw, 9);
    ctx.fillStyle = '#cbbfa6'; ctx.fillRect(bx, deck, bw, 8.5);
    ctx.fillStyle = '#4f8fbf'; // water seen through the arches
    for (let k = 0; k < 3; k++) { const ax = bx + 2.2 + k * (bw - 4.4) / 3 + (bw - 4.4) / 6; ctx.beginPath(); ctx.moveTo(ax - 3.2, deck + 8.5); ctx.lineTo(ax - 3.2, deck + 6); ctx.arc(ax, deck + 6, 3.2, Math.PI, 0); ctx.lineTo(ax + 3.2, deck + 8.5); ctx.fill(); }
    ctx.strokeStyle = 'rgba(90,76,58,.55)'; ctx.lineWidth = 0.35; ctx.beginPath(); // stone courses
    for (const yy of [deck + 1.6, deck + 3]) { ctx.moveTo(bx, yy); ctx.lineTo(bx + bw, yy); }
    ctx.stroke();
    ctx.fillStyle = '#9a8f7a'; ctx.fillRect(bx, deck - 0.6, bw, 0.9); // parapet edge
    // rails on top, with sleepers, and a small wagon carrying stone
    ctx.fillStyle = '#6b4a2e'; for (let k = 0; k < 9; k++) ctx.fillRect(bx + 1 + k * (bw - 2) / 8 - 0.5, deck - 2.6, 1, 2.6);
    ctx.fillStyle = '#5a5654'; ctx.fillRect(bx, deck - 2.3, bw, 0.5); ctx.fillRect(bx, deck - 0.9, bw, 0.5);
    const wx = bx + 5 + ((Math.sin(tm * 0.4 + p.x) + 1) / 2) * (bw - 14); // the wagon rolls slowly to and fro
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(wx + 0.6, deck - 5.4, 6, 3.4);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(wx, deck - 6, 6, 3.2);
    ctx.fillStyle = '#d8d0c0'; ctx.fillRect(wx + 0.8, deck - 7.2, 2, 1.4); ctx.fillRect(wx + 3.2, deck - 7.4, 2, 1.6);
    if (zoom > 1.2) { person(ctx, u - 9, y + 15, '#3a5a8a'); person(ctx, u + 8, y + 15.5, '#8a5a2a'); }
  }
  else if (p.k === 'grandstation') {
    // 🚉 the Grand Station: a long glass train shed with iron ribs, two tracks running in under it with a train at the
    // platform, and a cream stone front with a clock, a flag and passengers waiting outside
    const sx = x + 3, sw = TILE - 6, sy = y + 3, sh = 17;
    ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(sx + 1.5, sy + 1.5, sw, sh);
    ctx.fillStyle = '#6b6f74'; ctx.fillRect(sx, sy, sw, sh); // floor seen through the glass
    ctx.fillStyle = '#6b4a2e'; for (let k = 0; k < 10; k++) for (const ty of [sy + 5, sy + 11]) ctx.fillRect(sx + 1 + k * 2.6, ty - 1.4, 0.9, 2.8);
    ctx.fillStyle = '#3e3a38'; for (const ty of [sy + 5, sy + 11]) { ctx.fillRect(sx, ty - 1, sw, 0.45); ctx.fillRect(sx, ty + 0.6, sw, 0.45); }
    ctx.fillStyle = '#2f5d3a'; ctx.fillRect(sx + 4, sy + 3.6, 14, 2.8); ctx.fillStyle = '#d9b44a'; ctx.fillRect(sx + 4, sy + 4.6, 14, 0.5); // a train in
    ctx.fillStyle = '#d8d0c0'; ctx.fillRect(sx, sy + 7.4, sw, 1.8); // the platform between
    const gl = ctx.createLinearGradient(0, sy, 0, sy + sh);
    gl.addColorStop(0, 'rgba(200,230,245,.55)'); gl.addColorStop(0.5, 'rgba(235,248,255,.25)'); gl.addColorStop(1, 'rgba(170,205,225,.5)');
    ctx.fillStyle = gl; ctx.fillRect(sx, sy, sw, sh); // the glass roof
    ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 0.45;
    for (let k = 0; k <= 8; k++) { const xx = sx + k * sw / 8; ctx.beginPath(); ctx.moveTo(xx, sy); ctx.lineTo(xx, sy + sh); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(sx, sy + sh / 2); ctx.lineTo(sx + sw, sy + sh / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(sx + 1, sy + 2); ctx.lineTo(sx + sw - 1, sy + 2); ctx.stroke();
    // the stone front with its arched entrance and clock
    const fy = sy + sh;
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(sx - 0.5, fy - 1, sw + 1, 7);
    ctx.fillStyle = '#c9b892'; ctx.fillRect(sx - 0.5, fy - 1.6, sw + 1, 1);
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(u - 6, fy - 1.6); ctx.lineTo(u, fy - 5); ctx.lineTo(u + 6, fy - 1.6); ctx.fill();
    ctx.fillStyle = '#f6efdc'; ctx.beginPath(); ctx.arc(u, fy - 1.8, 1.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a2e22'; ctx.lineWidth = 0.3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(u, fy - 1.8); ctx.lineTo(u + Math.sin(tm / 60 * 6.283) * 1.2, fy - 1.8 - Math.cos(tm / 60 * 6.283) * 1.2); ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(u + dx - 1.5, fy + 5); ctx.lineTo(u + dx - 1.5, fy + 2.4); ctx.arc(u + dx, fy + 2.4, 1.5, Math.PI, 0); ctx.lineTo(u + dx + 1.5, fy + 5); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,214,120,.8)'; for (const dx of [-11, -4, 4, 11]) ctx.fillRect(u + dx - 0.6, fy + 1.2, 1.2, 1.6);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(u - 0.2, fy - 9, 0.4, 4); // the flag
    ctx.fillStyle = '#c0392b'; ctx.fillRect(u + 0.2, fy - 9 + Math.sin(tm * 3) * 0.2, 2.6, 1.6);
    if (zoom > 1.2) { person(ctx, u - 9, y + TILE - 3, '#2c4f8a'); person(ctx, u + 3, y + TILE - 3, '#a8402e'); person(ctx, u + 9, y + TILE - 2.5, '#5a7a3a'); }
    if (zoom > 1) puff(ctx, sx + 6, sy + 2, tm * 0.6, false, 0.6);
  }
  else if (p.k === 'cathedral') {
    // ⛪ a stone cathedral seen from above: a long nave with a slate roof, short transepts, a round rose window over
    // the door, and a tall spire at the front with a gold cross; a lawn and two yews beside it
    ctx.fillStyle = '#7fb85a'; ctx.fillRect(x + 2, y + 2, 7, TILE - 4); ctx.fillRect(x + TILE - 9, y + 2, 7, TILE - 4);
    const nx = u - 5, nw = 10, ny = y + 4, nh = 20;
    ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(nx + 2, ny + 2, nw, nh); ctx.fillRect(u - 10 + 2, ny + 6 + 2, 20, 6);
    ctx.fillStyle = '#4e5a66'; ctx.fillRect(nx, ny, nw, nh); ctx.fillRect(u - 10, ny + 6, 20, 6); // slate roofs (nave and transepts)
    ctx.fillStyle = '#3a444e'; ctx.fillRect(u - 0.4, ny, 0.8, nh); ctx.fillRect(u - 10, ny + 8.6, 20, 0.8); // ridges
    ctx.fillStyle = '#5c6874'; ctx.beginPath(); ctx.arc(u, ny + 1, 5, Math.PI, 0); ctx.fill(); // the round apse at the back
    ctx.fillStyle = '#cfc4a8'; ctx.fillRect(nx - 0.5, ny + nh, nw + 1, 4); // the stone front wall
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(u, ny + nh + 1.4, 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#2c4f8a'; ctx.beginPath(); ctx.arc(u, ny + nh + 1.4, 0.8, 0, 7); ctx.fill(); // the rose window
    ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.moveTo(u - 1.3, ny + nh + 4); ctx.lineTo(u - 1.3, ny + nh + 3); ctx.arc(u, ny + nh + 3, 1.3, Math.PI, 0); ctx.lineTo(u + 1.3, ny + nh + 4); ctx.fill();
    // the spire, rising from the front corner and leaning back over the roof as seen from above
    const bx = nx + nw - 1, by = ny + nh - 2;
    ctx.fillStyle = '#bfb397'; ctx.fillRect(bx - 2.5, by - 1, 5, 7);
    ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.moveTo(bx - 2.8, by - 1); ctx.lineTo(bx, by - 13); ctx.lineTo(bx + 2.8, by - 1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(bx - 2.8, by - 1); ctx.lineTo(bx, by - 13); ctx.lineTo(bx - 0.6, by - 1); ctx.fill();
    ctx.fillStyle = '#e8c25a'; ctx.fillRect(bx - 0.25, by - 16, 0.5, 3); ctx.fillRect(bx - 1, by - 15.2, 2, 0.5);
    tree(ctx, x + 5, y + 9, 2.6, '#2f5a30'); tree(ctx, x + TILE - 5, y + 20, 2.6, '#2f5a30');
    if (zoom > 1.2) { person(ctx, u - 4, y + TILE - 2.5, '#2e2a26'); person(ctx, u + 5, y + TILE - 2, '#7a3a8a'); }
  }
  else if (p.k === 'exhibition') {
    // 🏛 the Royal Exhibition Hall: a crystal palace of glass and white iron with a great dome in the middle, red and
    // gold banners on top, a fountain in front and visitors walking about
    const hx = x + 2.5, hw = TILE - 5, hy = y + 7, hh = 13;
    ctx.fillStyle = 'rgba(20,16,10,.3)'; ctx.fillRect(hx + 1.5, hy + 1.5, hw, hh);
    const gl = ctx.createLinearGradient(0, hy, 0, hy + hh);
    gl.addColorStop(0, '#d6eef8'); gl.addColorStop(1, '#9cc6dc');
    ctx.fillStyle = gl; ctx.fillRect(hx, hy, hw, hh);
    ctx.strokeStyle = '#f6f4ee'; ctx.lineWidth = 0.5;
    for (let k = 0; k <= 10; k++) { const xx = hx + k * hw / 10; ctx.beginPath(); ctx.moveTo(xx, hy); ctx.lineTo(xx, hy + hh); ctx.stroke(); }
    for (const yy of [hy + hh * 0.4, hy + hh * 0.7]) { ctx.beginPath(); ctx.moveTo(hx, yy); ctx.lineTo(hx + hw, yy); ctx.stroke(); }
    ctx.strokeRect(hx, hy, hw, hh);
    // the great dome over the middle
    ctx.fillStyle = 'rgba(20,16,10,.25)'; ctx.beginPath(); ctx.ellipse(u + 1, hy + 3, 8, 7, 0, Math.PI, 0); ctx.fill();
    const dg = ctx.createRadialGradient(u - 3, hy - 3, 1, u, hy + 2, 9);
    dg.addColorStop(0, '#f4fbff'); dg.addColorStop(1, '#8cbad4');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(u, hy + 2, 7.5, 7, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f6f4ee'; ctx.lineWidth = 0.4;
    for (const a of [0.2, 0.4, 0.6, 0.8]) { ctx.beginPath(); ctx.moveTo(u, hy - 5); ctx.quadraticCurveTo(u + (a - 0.5) * 18, hy - 2, u + (a - 0.5) * 15, hy + 2); ctx.stroke(); }
    ctx.fillStyle = '#e8c25a'; ctx.beginPath(); ctx.arc(u, hy - 5.2, 0.9, 0, 7); ctx.fill();
    // banners along the roof
    for (const [dx, col] of [[-11, '#c0392b'], [-7, '#e8c25a'], [7, '#e8c25a'], [11, '#c0392b']] as const) {
      ctx.fillStyle = '#5a4630'; ctx.fillRect(u + dx - 0.2, hy - 4, 0.4, 4);
      ctx.fillStyle = col; ctx.fillRect(u + dx + 0.2, hy - 4 + Math.sin(tm * 3 + dx) * 0.2, 2.2, 1.3);
    }
    // the grand doorway and the fountain in front
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(u - 3.5, hy + hh - 4, 7, 4);
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(u - 1.2, hy + hh - 2.6, 2.4, 2.6);
    const fy = y + TILE - 6;
    ctx.fillStyle = '#c9bfa8'; ctx.beginPath(); ctx.ellipse(u, fy, 5, 2.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a9ac8'; ctx.beginPath(); ctx.ellipse(u, fy, 4, 1.7, 0, 0, 7); ctx.fill();
    const jet = 1.6 + Math.sin(tm * 4) * 0.4;
    ctx.fillStyle = 'rgba(235,248,255,.85)'; ctx.fillRect(u - 0.3, fy - jet - 1, 0.6, jet + 1); ctx.beginPath(); ctx.arc(u, fy - jet - 1, 0.8, 0, 7); ctx.fill();
    if (zoom > 1.2) { person(ctx, u - 9, fy + 1, '#7a3a8a'); person(ctx, u + 8, fy, '#2c4f8a'); person(ctx, u - 6, fy + 3.5, '#a8402e'); person(ctx, u + 10, fy + 3.5, '#e8c25a'); }
  }
  if (zoom > 1.6) { fence(ctx, x + 2, y + TILE - 2, x + 9, y + TILE - 2); fence(ctx, x + TILE - 9, y + TILE - 2, x + TILE - 2, y + TILE - 2); }
  void pine;
}
