import type { Game } from '../state.ts';
import { TILE } from '../world/terrain.ts';
import { isRevealed } from '../world/fog.ts';
import { fr } from '../frontier/frontier.ts';

/**
 * 🧭 Frontier Village marks, over the fog: the 🏁 golden spike glowing on the far coast (always in sight, it is the
 * goal), the names of set pieces already seen, and a gold thread from each wishing town toward the town it wants.
 */
export function drawFrontier(ctx: CanvasRenderingContext2D, g: Game, tm: number, z: number) {
  const f = fr(g); if (!f) return;
  const n = g.world.n, s = 1 / Math.max(0.12, Math.min(1.4, z)), pulse = 0.5 + 0.5 * Math.sin(tm * 2.4);
  // wishes: a dashed gold line from the town to its wish (only as far as the fog allows: it fades past the edge)
  for (const w of f.wishes) {
    const a = g.s.sites.find(x => x.id === w.town), b = w.to !== undefined ? g.s.sites.find(x => x.id === w.to) : undefined; if (!a || !b) continue;
    const A = [(a.x + 0.5) * TILE, (a.y + 0.5) * TILE] as const, B = [(b.x + 0.5) * TILE, (b.y + 0.5) * TILE] as const;
    const seen = isRevealed(g, b.y * n + b.x), L = Math.hypot(B[0] - A[0], B[1] - A[1]), k = seen ? 1 : Math.min(1, 7 * TILE / L);
    const gr = ctx.createLinearGradient(A[0], A[1], A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k);
    gr.addColorStop(0, 'rgba(255,214,110,.85)'); gr.addColorStop(1, seen ? 'rgba(255,214,110,.85)' : 'rgba(255,214,110,0)');
    ctx.strokeStyle = gr; ctx.lineWidth = 2.5 * s; ctx.setLineDash([8 * s, 7 * s]); ctx.lineDashOffset = -tm * 14 * s;
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k); ctx.stroke(); ctx.setLineDash([]);
    if (seen) { ctx.font = `${Math.round(16 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✨', B[0], B[1] - 20 * s); }
  }
  // set pieces seen: their names in carved gold
  f.pieces.forEach((p, k) => {
    if (!f.seen.includes(k)) return;
    const X = (p.x + 0.5) * TILE, Y = (p.y + 0.5) * TILE;
    ctx.font = `italic 700 ${Math.round(15 * s)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4 * s; ctx.strokeStyle = 'rgba(30,20,10,.75)'; ctx.strokeText(`${p.kind === 'ridge' ? '⛰' : '🌊'} ${p.name}`, X, Y);
    ctx.fillStyle = '#ffe3a0'; ctx.fillText(`${p.kind === 'ridge' ? '⛰' : '🌊'} ${p.name}`, X, Y);
    if (p.kind === 'ridge' && p.px !== undefined && isRevealed(g, p.py! * n + p.px)) {
      const PX = (p.px + 0.5) * TILE, PY = (p.py! + 0.5) * TILE;
      ctx.font = `italic 700 ${Math.round(12 * s)}px Georgia, serif`;
      ctx.strokeText('🥾 the pass', PX, PY); ctx.fillStyle = '#d8f0c0'; ctx.fillText('🥾 the pass', PX, PY);
    }
  });
  // spikes already driven: small gold markers
  for (const i of f.spikes ?? []) {
    const X = (i % n + 0.5) * TILE, Y = (((i / n) | 0) + 0.5) * TILE;
    ctx.font = `${Math.round(15 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏁', X, Y);
    ctx.font = `800 ${Math.round(11 * s)}px system-ui`; ctx.lineWidth = 3 * s; ctx.strokeStyle = 'rgba(30,20,10,.8)';
    ctx.strokeText('✅', X + 10 * s, Y - 9 * s); ctx.fillStyle = '#ffd27a'; ctx.fillText('✅', X + 10 * s, Y - 9 * s);
  }
  // the golden spike: a beacon on the far coast
  const X = (f.spike % n + 0.5) * TILE, Y = (((f.spike / n) | 0) + 0.5) * TILE, r = 14 * s;
  const glow = ctx.createRadialGradient(X, Y, 0, X, Y, r * (3.2 + pulse));
  glow.addColorStop(0, `rgba(255,220,120,${f.done !== undefined ? 0.75 : 0.45 + 0.25 * pulse})`); glow.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(X, Y, r * (3.2 + pulse), 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(40,28,14,.9)'; ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2 * s; ctx.stroke();
  ctx.font = `${Math.round(17 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏁', X, Y + 1 * s);
  ctx.font = `800 ${Math.round(12 * s)}px system-ui`; ctx.lineWidth = 3.5 * s; ctx.strokeStyle = 'rgba(30,20,10,.8)';
  const label = f.done !== undefined ? 'Golden spike ✅' : 'Golden spike';
  ctx.strokeText(label, X, Y + r + 11 * s); ctx.fillStyle = '#ffd27a'; ctx.fillText(label, X, Y + r + 11 * s);
}
