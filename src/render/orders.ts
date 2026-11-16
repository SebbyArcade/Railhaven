import type { Game, Site } from '../state.ts';
import type { Building } from '../buildings/industries.ts';
import { buildingSquares, capOf, GOODS, type Good, INDUSTRIES, inputsOf, isFactory, isLinked, yardSquares } from '../buildings/industries.ts';
import { orderDone, orderOf, townLinked } from '../economy/towns.ts';
import { type Ship, siteOf } from '../economy/shipping.ts';
import { TILE } from '../world/terrain.ts';
import { isRevealed } from '../world/fog.ts';
import { joinGap } from '../track/joins.ts';

/**
 * Above each town on the railway: its open order goods, each with a gold ring that fills as goods arrive and a
 * red dot when no building ships it there. A bouncing ⬆ when the order is filled and the town can grow.
 * For each town you've found but not linked, when your track already comes within a few squares: those missing
 * squares outlined in gold, so a near miss is plain to see.
 */
export function drawTownBadges(ctx: CanvasRenderingContext2D, g: Game, plan: Map<number, Ship>, zoom: number, tm: number) {
  const s = Math.max(1, 1 / zoom * 1.4);
  const n = g.world.n;
  for (const t of g.s.sites) {
    if (t.kind !== 'town') continue;
    if (!townLinked(g, t)) { if (isRevealed(g, t.y * n + t.x)) drawUnlinked(ctx, g, t, tm); continue; }
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

/** For a town not on the railway (its name board shows 🔌): the squares of track still missing when your line comes close. */
function drawUnlinked(ctx: CanvasRenderingContext2D, g: Game, t: Site, tm: number) {
  const n = g.world.n, p = 0.5 + 0.5 * Math.sin(tm * 3);
  const gap = joinGap(g, t);
  if (gap) {
    ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -tm * 8;
    for (const i of gap.squares) {
      const x = (i % n) * TILE, y = ((i / n) | 0) * TILE;
      ctx.fillStyle = `rgba(255,214,120,${0.14 + 0.12 * p})`; ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.strokeStyle = `rgba(255,214,120,${0.65 + 0.35 * p})`; ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    }
    ctx.setLineDash([]);
    drawGhostHall(ctx, n, gap.hall, p);
    // a gold arrow from the railway square where the new track starts into the first missing square
    const a = gap.from, b = gap.squares[0]!, ang = Math.atan2(((b / n) | 0) - ((a / n) | 0), b % n - a % n);
    ctx.translate((a % n + 0.5) * TILE + Math.cos(ang) * TILE * 0.5, (((a / n) | 0) + 0.5) * TILE + Math.sin(ang) * TILE * 0.5); ctx.rotate(ang);
    ctx.fillStyle = `rgba(255,214,120,${0.75 + 0.25 * p})`; ctx.strokeStyle = 'rgba(40,28,10,.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

/** Where a town's station will stand: a pale platform outline over its three squares with a 🚉 in the middle. */
export function drawGhostHall(ctx: CanvasRenderingContext2D, n: number, squares: readonly number[], p: number, faint = false) {
  const xs = squares.map(i => i % n), ys = squares.map(i => (i / n) | 0);
  const x0 = Math.min(...xs) * TILE + 2, y0 = Math.min(...ys) * TILE + 2, w = (Math.max(...xs) + 1) * TILE - 2 - x0, h = (Math.max(...ys) + 1) * TILE - 2 - y0;
  ctx.save();
  ctx.fillStyle = `rgba(255,236,190,${(faint ? 0.1 : 0.22) + 0.1 * p})`; ctx.strokeStyle = `rgba(255,214,120,${(faint ? 0.55 : 0.8) + 0.2 * p})`;
  ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 6); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  // two platform edges along the middle, like the real hall
  const horiz = w > h; ctx.strokeStyle = `rgba(255,214,120,${faint ? 0.35 : 0.6})`; ctx.lineWidth = 1.5; ctx.beginPath();
  if (horiz) for (const f of [0.38, 0.62]) { ctx.moveTo(x0 + 6, y0 + h * f); ctx.lineTo(x0 + w - 6, y0 + h * f); }
  else for (const f of [0.38, 0.62]) { ctx.moveTo(x0 + w * f, y0 + 6); ctx.lineTo(x0 + w * f, y0 + h - 6); }
  ctx.stroke();
  ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = faint ? 0.7 : 1;
  ctx.fillText('🚉', x0 + w / 2, y0 + h / 2 + 1);
  ctx.restore();
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

/** Where a building's tags sit: the middle of its footprint, in world pixels. */
function centreOf(g: Game, b: Building) {
  const n = g.world.n, sq = buildingSquares(n, b); let x = 0, y = 0;
  for (const i of sq) { x += i % n; y += (i / n) | 0; }
  return { X: (x / sq.length + 0.5) * TILE, Y: (y / sq.length + 0.5) * TILE };
}

/** A rounded tag of fixed size on screen, centred at X,Y (world pixels). */
function tag(ctx: CanvasRenderingContext2D, X: number, Y: number, zoom: number, text: string, edge: string, col = '#f6e7c6', bg = 'rgba(30,24,16,.88)') {
  ctx.save(); ctx.translate(X, Y); ctx.scale(1 / zoom, 1 / zoom);
  ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 12, h = 18;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 9); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = col; ctx.fillText(text, 0, 0.5);
  ctx.restore();
}

/** ⭐ A gold tag over each place with a rush on: the good and how many are still to come. */
export function drawRushTags(ctx: CanvasRenderingContext2D, g: Game, zoom: number, tm: number) {
  const seen = new Map<string, number>();
  for (const r of g.s.rush ?? []) {
    let X: number, Y: number;
    if (r.to.kind === 'town') { const t = siteOf(g, r.to.id); if (!t) continue; X = (t.x + 0.5) * TILE; Y = (t.y - 1.1) * TILE - 7.5 * Math.max(1, 1 / zoom * 1.4) - 14 / zoom; }
    else { const b = g.s.buildings?.find(x => x.id === r.to.id); if (!b) continue; ({ X, Y } = centreOf(g, b)); Y -= 1.3 * TILE; }
    const key = `${r.to.kind}${r.to.id}`, k = seen.get(key) ?? 0; seen.set(key, k + 1);
    tag(ctx, X, Y - k * 22 / zoom, zoom * (1 + 0.04 * Math.sin(tm * 4)), `⭐ ${GOODS[r.good].icon} ${Math.max(0, r.left)}`, '#ffd27a', '#ffd27a', 'rgba(42,29,12,.92)');
  }
}

/** ⏳ A small hourglass at the top corner of each building whose goods wait for a free train. */
export function drawWaitBadges(ctx: CanvasRenderingContext2D, g: Game, ids: Set<number>, zoom: number) {
  if (!ids.size) return;
  for (const b of g.s.buildings ?? []) {
    if (!ids.has(b.id)) continue;
    const n = g.world.n, sq = buildingSquares(n, b); let x1 = 0, y0 = Infinity;
    for (const i of sq) { x1 = Math.max(x1, i % n); y0 = Math.min(y0, (i / n) | 0); }
    const X = (x1 + 0.85) * TILE, Y = (y0 + 0.15) * TILE, s = 1 / zoom;
    ctx.save(); ctx.translate(X, Y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(1, 1.5, 9, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e8a33c'; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⏳', 0, 0.5);
    ctx.restore();
  }
}

/** Zoomed out, a tag on each building on the railway saying what it makes: its good and how many a minute,
 *  or "full" / what it is short of. The edge says how it is doing: green making, orange its goods wait for a
 *  train, red stuck (its card says why). Tags that would cover one another move down. */
export const MAKE_ZOOM = 0.7; // where the stock chips on buildings stop (render/buildings.ts)
export function drawMakeTags(ctx: CanvasRenderingContext2D, g: Game, rates: Map<number, number>, alerts: Set<number>, waits: Set<number>, zoom: number, vis: (x: number, y: number) => boolean) {
  const put: [number, number, number, number][] = [], h = 20 / zoom;
  ctx.font = '700 11px system-ui';
  for (const b of g.s.buildings ?? []) {
    if (b.kind === 'dock' || !isLinked(g, b) || !vis(b.x, b.y)) continue;
    const k = INDUSTRIES[b.kind].makes, ic = GOODS[k].icon, full = b.stock >= capOf(b) - 0.5;
    const short = isFactory(b.kind) ? inputsOf(b.kind).filter(i => (b.inbuf?.[i] ?? 0) < 0.01) : [];
    const rate = `${ic} +${Math.round((rates.get(b.id) ?? 0) * 60)}/min`;
    const text = b.closed ? `${ic} closed` : full && zoom >= 0.3 ? `${rate} · full` : short.length ? `${ic} needs ${short.map(i => GOODS[i].icon).join('')}` : rate;
    const edge = alerts.has(b.id) ? '#e0584a' : waits.has(b.id) || full ? '#e8a33c' : '#7fd36b';
    let { X, Y } = centreOf(g, b);
    const w = (ctx.measureText(text).width + 12) / zoom;
    while (put.some(o => X - w / 2 < o[2] && X + w / 2 > o[0] && Y - h / 2 < o[3] && Y + h / 2 > o[1])) Y += h;
    put.push([X - w / 2, Y - h / 2, X + w / 2, Y + h / 2]);
    tag(ctx, X, Y, zoom, text, edge);
    ctx.font = '700 11px system-ui';
  }
}

/** 📦 Under every dock on the railway with goods in it: the total and the top goods, readable at any zoom. */
export function drawDockTags(ctx: CanvasRenderingContext2D, g: Game, zoom: number, skip?: number) {
  const ships = (g.s.ships ?? []).length;
  for (const b of g.s.buildings ?? []) {
    if (b.kind !== 'dock' || b.id === skip || !isLinked(g, b)) continue;
    const m = new Map<Good, number>(); let out = 0;
    for (const q of b.outq ?? []) { m.set(q.good, (m.get(q.good) ?? 0) + q.n); out += q.n; }
    for (const [k, v] of Object.entries(b.landed ?? {}) as [Good, number][]) if (v >= 1) m.set(k, (m.get(k) ?? 0) + v);
    const all = [...m].filter(([, v]) => v >= 1).sort((p, q) => q[1] - p[1]); if (!all.length) continue;
    const tot = Math.floor(all.reduce((a, [, v]) => a + v, 0)), top = all.slice(0, zoom < 0.7 ? 2 : 3);
    const text = `📦 ${tot} · ${top.map(([k, v]) => `${GOODS[k].icon}${Math.floor(v)}`).join(' ')}${all.length > top.length ? ` +${all.length - top.length}` : ''}`;
    const { X, Y } = centreOf(g, b);
    tag(ctx, X, Y + 1.2 * TILE, zoom, text, out > 0 && !ships ? '#e0584a' : '#6bb8e8');
  }
}
