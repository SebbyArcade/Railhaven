import type { Network } from '../track/network.ts';
import { looks } from './looks.ts';
import { bodyPoint, CAR_LEN, COUPLING, ENGINE_LEN, type Train, trainLength } from '../trains/train.ts';

function vehicle(ctx: CanvasRenderingContext2D, net: Network, t: Train, from: number, len: number, draw: (l: number) => void) {
  // two bogies a little in from each end: the body sits between them, like the real thing
  const a = bodyPoint(net, t, from + len * 0.2), b = bodyPoint(net, t, from + len * 0.8);
  ctx.save(); ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2); ctx.rotate(Math.atan2(a.y - b.y, a.x - b.x));
  draw(len); ctx.restore();
}

const CARGO_COL: Record<string, string> = { wood: '#a0703f', farm: '#e6c35a', stone: '#a8a39a', coal: '#2b2b2b', iron: '#8a5a44', oil: '#1b1b22', wool: '#f1ede2', planks: '#e0b878', bricks: '#b5523b', flour: '#f4efe2', steel: '#9aa0a8', fuel: '#2a2a34', cloth: '#5a7ab0' };
const WAGON_COLS = ['#7a4f33', '#6b5a3a', '#5d4a3a', '#7a6248'];

export function drawTrains(ctx: CanvasRenderingContext2D, net: Network, trains: Train[], tm: number) {
  for (const t of trains) {
    const L = trainLength(t);
    // vehicle order from the head: engine first unless it is pushing from the back
    const parts: { at: number; len: number; engine: boolean; k: number }[] = [];
    let at = 0;
    const order = t.engineAhead ? ['E', ...Array(t.cars).fill('W')] : [...Array(t.cars).fill('W'), 'E'];
    order.forEach((kind, k) => { const len = kind === 'E' ? ENGINE_LEN : CAR_LEN; parts.push({ at, len, engine: kind === 'E', k }); at += len + COUPLING; });
    void L;
    for (const p of parts) vehicle(ctx, net, t, p.at, p.len, l => {
      // the body's +x points toward the train's head
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-l / 2 + 1, -3.2, l, 7.4);
      if (p.engine) {
        const fwd = t.engineAhead ? 1 : -1;
        ctx.fillStyle = looks.paint.body; ctx.fillRect(-l / 2, -3.4, l, 6.8);              // boiler and cab
        ctx.fillStyle = '#1d1d1d'; ctx.fillRect(fwd > 0 ? l / 2 - 4 : -l / 2, -2.8, 4, 5.6); // smokebox
        ctx.fillStyle = looks.paint.beam; ctx.fillRect(fwd > 0 ? l / 2 - 0.8 : -l / 2, -3.4, 0.8, 6.8); // buffer beam
        ctx.fillStyle = looks.paint.roof; ctx.fillRect(fwd > 0 ? -l / 2 : l / 2 - 5, -3.6, 5, 7.2); // cab roof
        ctx.fillStyle = looks.paint.band; ctx.fillRect(-1, -3.5, 1.2, 7); // brass band
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(fwd > 0 ? l / 2 - 5.5 : -l / 2 + 5.5, 0, 1.6, 0, 7); ctx.fill(); // chimney
      } else {
        ctx.fillStyle = WAGON_COLS[(t.id + p.k) % WAGON_COLS.length]!; ctx.fillRect(-l / 2, -3.2, l, 6.4);
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.6; ctx.strokeRect(-l / 2, -3.2, l, 6.4);
        ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.lineTo(0, 3.2); ctx.stroke();
        if (t.cargo) { // the load, heaped in each half of the wagon
          ctx.fillStyle = CARGO_COL[t.cargo.good] ?? '#c9b48a';
          for (const u of [-l / 4, l / 4]) { ctx.beginPath(); ctx.ellipse(u, 0, l / 4 - 0.8, 2.2, 0, 0, 7); ctx.fill(); }
        }
      }
    });
    // smoke from the chimney while moving
    if (t.v > 2) {
      const e = parts.find(p => p.engine)!, c = bodyPoint(net, t, e.at + (t.engineAhead ? 4 : e.len - 4));
      for (let k = 0; k < 3; k++) {
        const ph = (tm * 1.6 + k / 3 + t.id * 0.37) % 1;
        ctx.fillStyle = `rgba(235,232,225,${0.45 * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(c.x - c.tx * ph * 10, c.y - c.ty * ph * 10 - ph * 6, 1.8 + ph * 3.5, 0, 7); ctx.fill();
      }
    }
  }
}
