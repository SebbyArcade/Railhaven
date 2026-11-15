import type { Game } from '../state.ts';
import { type Building, buildingSquares, GOODS, type Good } from '../buildings/industries.ts';
import { TILE } from '../world/terrain.ts';
import { type CargoShip, shipPlace } from '../ships/ships.ts';
import { puff } from './art.ts';

/** crate colours by good */
const CRATE: Partial<Record<Good, string>> = { wood: '#8a5a2e', farm: '#d8b04a', shellfish: '#d0603a', cans: '#c0c6cc', stone: '#9a9a92', coal: '#2e2a28', iron: '#8a4a3a', wool: '#ece6da', fish: '#5a8aa8', planks: '#c09060', bricks: '#b05a40', flour: '#f0e8d8', steel: '#7a8a9a', oil: '#3a3a40', fuel: '#a8402e', cloth: '#8a6aa8' };

/** A cargo ship: dark hull, cream deck with a wheelhouse and a red-banded funnel, crates coloured by what it carries. */
export function drawShips(ctx: CanvasRenderingContext2D, g: Game, tm: number, vis: (x: number, y: number) => boolean) {
  for (const b of g.s.buildings ?? []) if (b.kind === 'dock' && b.fish && vis(b.x, b.y)) drawFishingBoats(ctx, g, b, tm);
  for (const s of g.s.ships ?? []) {
    const p = shipPlace(g, s); if (!vis(p.x, p.y)) continue;
    drawShip(ctx, (p.x + 0.5) * TILE, (p.y + 0.5) * TILE, p.a, s, tm);
  }
}

/** Little fishing boats working the water off a dock: one per fishing level, drifting in slow loops, nets out. */
function drawFishingBoats(ctx: CanvasRenderingContext2D, g: Game, b: Building, tm: number) {
  const n = g.world.n, sea = buildingSquares(n, b).filter(i => !g.world.terr[i]); if (!sea.length) return;
  // out from the pier, away from the yard
  const ox = b.horizontal ? 0 : b.side, oy = b.horizontal ? b.side : 0;
  for (let k = 0; k < (b.fish ?? 0); k++) {
    const i = sea[(k * 2 + 1) % sea.length]!, ph = tm * 0.25 + k * 2.1 + b.id;
    const X = ((i % n) + 0.5 + ox * (1.3 + 0.4 * Math.sin(ph))) * TILE + Math.cos(ph) * 10, Y = (((i / n) | 0) + 0.5 + oy * (1.3 + 0.4 * Math.sin(ph))) * TILE + Math.sin(ph * 1.3) * 8;
    const a = ph + Math.PI / 2, bob = Math.sin(tm * 2 + k) * 0.4;
    ctx.save(); ctx.translate(X, Y + bob); ctx.rotate(a);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(1, 1, 7, 2.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = k === 2 ? '#a8402e' : '#2f6f9a'; ctx.beginPath(); ctx.moveTo(-6, -2.2); ctx.lineTo(4, -2.2); ctx.quadraticCurveTo(8, 0, 4, 2.2); ctx.lineTo(-6, 2.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-5, -1.4, 7, 2.8);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(-4, -1, 2.6, 2);
    ctx.strokeStyle = 'rgba(240,240,230,.6)'; ctx.lineWidth = 0.35; ctx.setLineDash([0.8, 0.8]); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-11, 3, -14, 0); ctx.stroke(); ctx.setLineDash([]); // the net
    ctx.restore();
  }
}

function drawShip(ctx: CanvasRenderingContext2D, X: number, Y: number, a: number, s: CargoShip, tm: number) {
  const bob = Math.sin(tm * 1.4 + s.id) * 0.5, moving = s.to !== undefined;
  ctx.save(); ctx.translate(X, Y + bob); ctx.rotate(a);
  if (moving) { // wake
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
    for (const k of [1, -1]) { ctx.beginPath(); ctx.moveTo(-18, k * 4); ctx.quadraticCurveTo(-26, k * 7, -34, k * 11); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 22, 7, 0, 0, 7); ctx.fill();
  // hull: pointed bow forward (+x)
  ctx.fillStyle = '#2e3a4a'; ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(12, -6); ctx.quadraticCurveTo(22, 0, 12, 6); ctx.lineTo(-20, 6); ctx.quadraticCurveTo(-22, 0, -20, -6); ctx.fill();
  ctx.fillStyle = '#a8402e'; ctx.fillRect(-20, 4.6, 32, 1.4); ctx.fillRect(-20, -6, 32, 1.4);
  ctx.fillStyle = '#d8cdb4'; ctx.beginPath(); ctx.moveTo(-18, -4.4); ctx.lineTo(11, -4.4); ctx.quadraticCurveTo(18, 0, 11, 4.4); ctx.lineTo(-18, 4.4); ctx.closePath(); ctx.fill();
  // cargo: crates in two rows, coloured by good, as many as the hold is full
  const goods: Good[] = []; for (const q of s.hold) for (let k = 0; k < Math.ceil(q.n / 10); k++) goods.push(q.good);
  for (let k = 0; k < Math.min(8, goods.length); k++) {
    const u = -4 + (k >> 1) * 4, v = (k & 1) ? 0.4 : -3.4;
    ctx.fillStyle = CRATE[goods[k]!] ?? '#8a6a40'; ctx.fillRect(u, v, 3.4, 3);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.3; ctx.strokeRect(u, v, 3.4, 3);
  }
  // wheelhouse and funnel at the stern
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(-16, -3.4, 8, 6.8);
  ctx.fillStyle = '#6f93a8'; for (let w = 0; w < 3; w++) ctx.fillRect(-9.4, -2.6 + w * 2, 1, 1.2);
  ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(-12, 0, 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#b8402e'; ctx.beginPath(); ctx.arc(-12, 0, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(-12, 0, 0.9, 0, 7); ctx.fill();
  ctx.restore();
  puff(ctx, X - Math.cos(a) * 12, Y - Math.sin(a) * 12 - 2, tm + s.id, true, 1);
  void GOODS;
}
