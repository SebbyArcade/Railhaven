import type { Game } from '../state.ts';
import { buildingSquares, GOODS, type Good, INDUSTRIES, yardSquares } from '../buildings/industries.ts';
import { orderDone, orderOf, townLinked } from '../economy/towns.ts';
import { type Ship, siteOf } from '../economy/shipping.ts';
import { TILE } from '../world/terrain.ts';

/**
 * Above each town on the railway: its open order goods, each with a gold ring that fills as goods arrive and a
 * red dot when no building ships it there. A bouncing ⬆ when the order is filled and the town can grow.
 */
export function drawTownBadges(ctx: CanvasRenderingContext2D, g: Game, plan: Map<number, Ship>, zoom: number, tm: number) {
  const s = Math.max(1, 1 / zoom * 1.4);
  for (const t of g.s.sites) {
    if (t.kind !== 'town' || !townLinked(g, t)) continue;
    const X = (t.x + 0.5) * TILE, Y = (t.y - 1.1) * TILE;
    if (orderDone(g, t)) {
      const b = Math.sin(tm * 4) * 3;
      ctx.fillStyle = '#2f8f8a'; ctx.beginPath(); ctx.arc(X, Y + b, 9 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffe2a8'; ctx.lineWidth = 1.6 * s; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${12 * s}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⬆', X, Y + b + 0.5);
      continue;
    }
    const o = orderOf(g, t), ks = (Object.keys(o) as Good[]).filter(k => (t.got?.[k] ?? 0) < o[k]!);
    const w = 17 * s, x0 = X - (ks.length - 1) * w / 2;
    ks.forEach((k, j) => {
      const x = x0 + j * w, f = Math.min(1, (t.got?.[k] ?? 0) / o[k]!), r = 7.5 * s;
      ctx.fillStyle = 'rgba(28,22,16,.85)'; ctx.beginPath(); ctx.arc(x, Y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.4 * s; ctx.stroke();
      if (f > 0) { ctx.strokeStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(x, Y, r, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke(); }
      ctx.font = `${9 * s}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(GOODS[k].icon, x, Y + 0.5);
      const fed = (g.s.buildings ?? []).some(b => INDUSTRIES[b.kind].makes === k && plan.get(b.id)?.to.kind === 'town' && plan.get(b.id)?.to.id === t.id);
      if (!fed) { ctx.fillStyle = '#e0584a'; ctx.beginPath(); ctx.arc(x + r * 0.75, Y - r * 0.75, 2.4 * s, 0, 7); ctx.fill(); }
    });
  }
}

/** A dashed arrow from a building to where it sends its goods (shown while its card is open). */
export function drawShipArrow(ctx: CanvasRenderingContext2D, g: Game, plan: Map<number, Ship>, id: number, tm: number) {
  const b = g.s.buildings?.find(x => x.id === id), ship = plan.get(id);
  const to = ship && (ship.to.kind === 'town' ? siteOf(g, ship.to.id) : (() => { const f = g.s.buildings?.find(x => x.id === ship.to.id); if (!f) return undefined; const m = yardSquares(g.world.n, f)[1]!; return { x: m % g.world.n, y: (m / g.world.n) | 0 }; })());
  if (!b || !to) return;
  const n = g.world.n, ys = yardSquares(n, b), m = ys[1]!, ax = (m % n + (b.horizontal ? 1 : 0.5)) * TILE, ay = ((m / n | 0) + (b.horizontal ? 0.5 : 1)) * TILE;
  const bx = (to.x + 0.5) * TILE, by = (to.y + 0.5) * TILE, cx = (ax + bx) / 2 - (by - ay) * 0.2, cy = (ay + by) / 2 + (bx - ax) * 0.2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,214,120,.9)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -tm * 20;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(by - cy, bx - cx);
  ctx.fillStyle = 'rgba(255,214,120,.95)'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 12 * Math.cos(a - 0.45), by - 12 * Math.sin(a - 0.45)); ctx.lineTo(bx - 12 * Math.cos(a + 0.45), by - 12 * Math.sin(a + 0.45)); ctx.fill();
  ctx.restore();
}

/** A small red ❗ over each building that is stuck (off the railway, waiting for a good, full with nowhere to send). Its card says why. */
export function drawAlerts(ctx: CanvasRenderingContext2D, g: Game, ids: Set<number>, zoom: number, tm: number) {
  if (!ids.size) return;
  const n = g.world.n, s = Math.max(1, 1 / zoom * 1.3), b0 = Math.sin(tm * 3) * 1.5;
  for (const b of g.s.buildings ?? []) {
    if (!ids.has(b.id)) continue;
    const sq = buildingSquares(n, b); let x = 0, y = 0; for (const i of sq) { x += i % n; y += (i / n) | 0; }
    const X = (x / sq.length + 0.5) * TILE, Y = (y / sq.length - 0.2) * TILE + b0, r = 7.5 * s;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(X + 1, Y + 1.5, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff4e8'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d8442f'; ctx.lineWidth = 1.8 * s; ctx.stroke();
    ctx.fillStyle = '#d8442f'; ctx.font = `800 ${11 * s}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', X, Y + 0.5);
  }
}
