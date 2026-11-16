import type { Game } from '../state.ts';
import { type Building, buildingSquares, GOODS, type Good } from '../buildings/industries.ts';
import { TILE } from '../world/terrain.ts';
import { type CargoShip, seaLanes, seaPath, shipCap, shipPlace } from '../ships/ships.ts';
import { puff } from './art.ts';

/** cargo colours by good (the same family as the train wagons' loads) */
const CRATE: Partial<Record<Good, string>> = { wood: '#8a5a2e', farm: '#d8b04a', shellfish: '#d0603a', cans: '#c0c6cc', stone: '#9a9a92', coal: '#2e2a28', iron: '#8a4a3a', wool: '#ece6da', fish: '#5a8aa8', planks: '#d6ab72', bricks: '#b05a40', flour: '#f0e8d8', steel: '#8a96a4', oil: '#2a2a32', fuel: '#a8402e', cloth: '#8a6aa8', glass: '#bfe0ee', tools: '#7a7e86', furniture: '#a87444', gold: '#e0b84a', gems: '#9ae0ff', jewellery: '#7a1e3a', cocoa: '#8a5a3a', chocolate: '#5a321e', rubber: '#e8e4d8', tyres: '#1e1e20' };
/** how each good rides on deck: heaped loose, logs, barrels and drums, bales, long bars, stacked boards, or crates */
type Stow = 'heap' | 'logs' | 'drum' | 'bale' | 'bars' | 'boards' | 'crate';
const STOW: Partial<Record<Good, Stow>> = { coal: 'heap', stone: 'heap', iron: 'heap', farm: 'heap', cocoa: 'heap', gold: 'heap', wood: 'logs', oil: 'drum', fuel: 'drum', rubber: 'drum', wool: 'bale', cloth: 'bale', steel: 'bars', planks: 'boards' };
/** zoomed in at least this far, a tag over each ship names what it carries; further out only the deck load shows */
export const SHIP_TAG_ZOOM = 0.9;

/** A cargo ship: dark hull, cream deck with a wheelhouse and a red-banded funnel, its load on deck as it really rides
 *  (coal heaped, logs, oil drums, crates…), and zoomed in a tag naming what it carries and how much. */
export function drawShips(ctx: CanvasRenderingContext2D, g: Game, tm: number, vis: (x: number, y: number) => boolean): Tag[] {
  for (const b of g.s.buildings ?? []) if (b.kind === 'dock' && b.fish && vis(b.x, b.y)) drawFishingBoats(ctx, g, b, tm);
  const tags: Tag[] = [];
  for (const s of g.s.ships ?? []) {
    const p = shipPlace(g, s); if (!vis(p.x, p.y)) continue;
    const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
    drawShip(ctx, X, Y, p.a, s, tm, false, shipCap(g));
    const text = cargoText(s.hold); if (text) tags.push({ X, Y, a: p.a, text, edge: '#6bb8e8' });
  }
  for (const f of g.s.ferries ?? []) { // ⛴ a boat taking a new train over: the train stands on deck
    const p = shipPlace(g, f); if (!vis(p.x, p.y)) continue;
    const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
    drawShip(ctx, X, Y, p.a, f, tm, true, shipCap(g));
    const goods = cargoText(f.hold); tags.push({ X, Y, a: p.a, text: `🚂 Train ${f.train}${goods ? ` · ${goods}` : ''}`, edge: '#7fd36b' });
  }
  return tags;
}

/** The cargo tags, drawn later than the ships (ships sail under bridges and trains, their tags stay on top). */
export function drawShipTags(ctx: CanvasRenderingContext2D, tags: Tag[], zoom: number) {
  if (zoom >= SHIP_TAG_ZOOM) drawCargoTags(ctx, tags, zoom);
}

/** What a hold carries, biggest load first: "🪵 40 · 🧱 20" (three goods at most, then "+2"). Empty: "". */
export function cargoText(hold: { good: Good; n: number }[]): string {
  const m = new Map<Good, number>(); for (const q of hold) m.set(q.good, (m.get(q.good) ?? 0) + q.n);
  const all = [...m].filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]); if (!all.length) return '';
  const top = all.slice(0, 3);
  return top.map(([k, v]) => `${GOODS[k].icon} ${Math.floor(v)}`).join(' · ') + (all.length > top.length ? ` +${all.length - top.length}` : '');
}

export type Tag = { X: number; Y: number; a: number; text: string; edge: string };
/** Tags over the ships, upright whatever way the ship is heading, the same size on screen at any zoom, pointing at
 *  their ship from just above it (or just below, when another ship's tag is in the way). A tag with no room left (it
 *  would cover another ship or its tag) is skipped rather than drift onto another ship: the deck still shows the load, and the ship's card names it. */
function drawCargoTags(ctx: CanvasRenderingContext2D, tags: Tag[], zoom: number) {
  const h = 20 / zoom, put: [number, number, number, number][] = tags.map(t => { // the hulls first: a tag never covers a ship
    const ew = Math.abs(Math.cos(t.a)) * 21 + Math.abs(Math.sin(t.a)) * 7, eh = Math.abs(Math.sin(t.a)) * 21 + Math.abs(Math.cos(t.a)) * 7;
    return [t.X - ew, t.Y - eh, t.X + ew, t.Y + eh];
  });
  ctx.save(); ctx.font = '700 11px system-ui';
  for (const t of tags) {
    const w = (ctx.measureText(t.text).width + 12) / zoom;
    const ext = Math.abs(Math.sin(t.a)) * 21 + Math.abs(Math.cos(t.a)) * 7; // how far the hull reaches up or down
    const free = (Y: number) => !put.some(o => t.X - w / 2 < o[2] && t.X + w / 2 > o[0] && Y - h / 2 < o[3] && Y + h / 2 > o[1]);
    const up = t.Y - ext - 12 / zoom, down = t.Y + ext + 12 / zoom, Y = free(up) ? up : free(down) ? down : NaN;
    if (Number.isNaN(Y)) continue;
    put.push([t.X - w / 2, Y - h / 2, t.X + w / 2, Y + h / 2]);
    ctx.save(); ctx.translate(t.X, Y); ctx.scale(1 / zoom, 1 / zoom);
    const W = w * zoom, f = Y < t.Y ? 1 : -1; // the pointer goes toward the ship
    ctx.fillStyle = 'rgba(20,30,42,.9)'; ctx.beginPath(); ctx.roundRect(-W / 2, -9, W, 18, 9); ctx.fill();
    ctx.strokeStyle = t.edge; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(20,30,42,.9)'; ctx.beginPath(); ctx.moveTo(-4, f * 8.5); ctx.lineTo(4, f * 8.5); ctx.lineTo(0, f * 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eef4f8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.text, 0, 0.5);
    ctx.restore();
  }
  ctx.restore();
}

/** One deck slot of cargo (about 4 x 3.2), centred at (u, v) in the ship's frame. */
function stow(ctx: CanvasRenderingContext2D, good: Good, u: number, v: number) {
  const col = CRATE[good] ?? '#8a6a40', how = STOW[good] ?? 'crate';
  ctx.lineWidth = 0.3; ctx.strokeStyle = 'rgba(0,0,0,.4)';
  switch (how) {
    case 'heap': { // loose, heaped in an open hold
      ctx.fillStyle = '#3a3026'; ctx.fillRect(u - 2, v - 1.6, 4, 3.2);
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(u, v, 1.8, 1.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(u - 0.5, v - 0.4, 0.8, 0.5, 0, 0, 7); ctx.fill();
      break;
    }
    case 'logs': // three logs lying fore and aft, cut ends showing
      for (const dv of [-1, 0, 1]) {
        ctx.fillStyle = col; ctx.fillRect(u - 2, v + dv - 0.5, 4, 1); ctx.strokeRect(u - 2, v + dv - 0.5, 4, 1);
        ctx.fillStyle = '#d8b07a'; ctx.beginPath(); ctx.arc(u + 2, v + dv, 0.48, 0, 7); ctx.fill();
      }
      break;
    case 'drum': // two barrels seen from above
      for (const du of [-0.95, 0.95]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(u + du, v, 0.95, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(u + du - 0.3, v - 0.3, 0.3, 0, 7); ctx.fill();
      }
      break;
    case 'bale': // a soft bale tied with cord
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(u - 1.8, v - 1.4, 3.6, 2.8, 1); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.beginPath(); ctx.moveTo(u - 0.6, v - 1.4); ctx.lineTo(u - 0.6, v + 1.4); ctx.moveTo(u + 0.6, v - 1.4); ctx.lineTo(u + 0.6, v + 1.4); ctx.stroke();
      break;
    case 'bars': // long bars, stacked
      for (const dv of [-0.9, 0, 0.9]) { ctx.fillStyle = col; ctx.fillRect(u - 2, v + dv - 0.35, 4, 0.7); ctx.strokeRect(u - 2, v + dv - 0.35, 4, 0.7); }
      break;
    case 'boards': // a strapped stack of boards
      ctx.fillStyle = col; ctx.fillRect(u - 2, v - 1.4, 4, 2.8); ctx.strokeRect(u - 2, v - 1.4, 4, 2.8);
      ctx.strokeStyle = 'rgba(90,60,30,.5)'; for (const dv of [-0.47, 0.47]) { ctx.beginPath(); ctx.moveTo(u - 2, v + dv); ctx.lineTo(u + 2, v + dv); ctx.stroke(); }
      ctx.strokeStyle = '#3a3026'; ctx.beginPath(); ctx.moveTo(u, v - 1.4); ctx.lineTo(u, v + 1.4); ctx.stroke();
      break;
    default: // a crate with its lid boards
      ctx.fillStyle = col; ctx.fillRect(u - 1.8, v - 1.5, 3.6, 3); ctx.strokeRect(u - 1.8, v - 1.5, 3.6, 3);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(u - 1.8, v - 1.5); ctx.lineTo(u + 1.8, v + 1.5); ctx.moveTo(u + 1.8, v - 1.5); ctx.lineTo(u - 1.8, v + 1.5); ctx.stroke();
  }
}

/**
 * Sea routes as dashed blue lines over the water (while the Ships card is open), or one ship's way ahead (while its
 * card is open). `only`: draw just this ship's path.
 */
export function drawSeaRoutes(ctx: CanvasRenderingContext2D, g: Game, tm: number, z: number, only?: CargoShip) {
  const n = g.world.n, k = 1 / Math.max(0.5, z), bld = (i: number) => g.s.buildings?.find(b => b.id === i);
  const line = (path: number[], from = 0) => {
    if (path.length < 2) return;
    ctx.beginPath();
    for (let j = Math.floor(from); j < path.length; j++) { const i = path[j]!, x = (i % n + 0.5) * TILE, y = (((i / n) | 0) + 0.5) * TILE; if (j === Math.floor(from)) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash([9 * k, 6 * k]); ctx.lineDashOffset = -tm * 14 * k;
  if (only) {
    if (only.to !== undefined && only.path) { ctx.strokeStyle = 'rgba(255,240,160,.95)'; ctx.lineWidth = 3.5 * k; line(only.path, only.pos); }
  } else for (const l of seaLanes(g)) {
    const a = bld(l.a), b = bld(l.b); if (!a || !b) continue;
    ctx.strokeStyle = 'rgba(20,50,80,.45)'; ctx.lineWidth = 5 * k; ctx.setLineDash([]); line(seaPath(g, a, b));
    ctx.strokeStyle = 'rgba(150,215,255,.95)'; ctx.lineWidth = 2.5 * k; ctx.setLineDash([9 * k, 6 * k]); line(seaPath(g, a, b));
  }
  ctx.restore();
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

function drawShip(ctx: CanvasRenderingContext2D, X: number, Y: number, a: number, s: CargoShip, tm: number, train = false, hold = 80) {
  const bob = Math.sin(tm * 1.4 + s.id) * 0.5, moving = s.to !== undefined && (s.path?.length ?? 0) - 1 > s.pos;
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
  // cargo on deck: up to 8 slots in two rows, filled as the hold fills, each good stowed its own way, biggest load first
  const load = s.hold.reduce((a, q) => a + q.n, 0), cap = Math.max(load, hold, 1);
  const slots = load > 0 ? Math.max(1, Math.min(8, Math.round(load / cap * 8))) : 0, goods: Good[] = [];
  const by = [...s.hold].sort((p, q) => q.n - p.n);
  for (const q of by) for (let k = 0; k < Math.max(1, Math.round(q.n / Math.max(1, load) * slots)) && goods.length < slots; k++) goods.push(q.good);
  if (train) { // two rails on deck, a little steam engine and its tender
    ctx.strokeStyle = '#6a6058'; ctx.lineWidth = 0.5; for (const v of [-1.6, 1.6]) { ctx.beginPath(); ctx.moveTo(-6, v); ctx.lineTo(13, v); ctx.stroke(); }
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(-5.5, -2.4, 5, 4.8); // tender
    ctx.fillStyle = '#1e1a18'; ctx.fillRect(-5, -1.6, 4, 3.2); // coal
    ctx.fillStyle = '#2f5a3a'; ctx.fillRect(0.5, -2.6, 4, 5.2); // cab
    ctx.fillStyle = '#26472f'; ctx.beginPath(); ctx.roundRect(4.5, -2, 7.5, 4, 1.8); ctx.fill(); // boiler
    ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(10.4, 0, 1, 0, 7); ctx.fill(); // chimney
    ctx.fillStyle = '#c8a040'; ctx.fillRect(4.5, -2, 0.6, 4); // brass band
  }
  if (!train) for (let k = 0; k < goods.length; k++) stow(ctx, goods[k]!, -3.6 + (k >> 1) * 4.2, (k & 1) ? 2 : -2);
  // wheelhouse and funnel at the stern
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(-16, -3.4, 8, 6.8);
  ctx.fillStyle = '#6f93a8'; for (let w = 0; w < 3; w++) ctx.fillRect(-9.4, -2.6 + w * 2, 1, 1.2);
  ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(-12, 0, 2, 0, 7); ctx.fill();
  ctx.fillStyle = '#b8402e'; ctx.beginPath(); ctx.arc(-12, 0, 1.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(-12, 0, 0.9, 0, 7); ctx.fill();
  ctx.restore();
  puff(ctx, X - Math.cos(a) * 12, Y - Math.sin(a) * 12 - 2, tm + s.id, true, 1);
}
