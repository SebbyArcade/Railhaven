import type { Network } from '../track/network.ts';
import { stepPoint, bodyPoint, type Train, trainLength } from './train.ts';
import { nextSteps } from '../track/network.ts';
import type { Step } from '../track/types.ts';

/** Fingerprint of a network: if it changes, saved piece numbers no longer mean the same rails. */
export function networkKey(net: Network): string {
  let h = net.pieces.length;
  for (const p of net.pieces) for (const c of p.a + p.b) h = (h * 31 + c.charCodeAt(0)) | 0;
  return String(h);
}

/** Where the train's head and each vehicle point is, so it can be found again on rebuilt rails. */
export function snapshot(net: Network, t: Train) {
  const h = bodyPoint(net, t, 0);
  return { x: h.x, y: h.y, tx: h.tx, ty: h.ty };
}

/**
 * Put a train back on the rails after the network was rebuilt: find the piece under its head going the same way,
 * then lay its body back along the track behind it. Returns false if no rail is there any more.
 */
export function relocate(net: Network, t: Train, at: { x: number; y: number; tx: number; ty: number }): boolean {
  const n = net.n, ids = new Set<number>();
  // the pieces of the head's square, and of the square next door when the head sits on the edge between them
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const id of net.bySquare.get(Math.floor((at.y + dy) / 32) * n + Math.floor((at.x + dx) / 32)) ?? []) ids.add(id);
  let best: { step: Step; s: number; d: number } | null = null;
  for (const id of ids) {
    const p = net.pieces[id]!;
    for (let s = 0; s <= p.len; s += 0.5) {
      for (const dir of [1, -1] as const) {
        const q = stepPoint(net, { piece: id, dir }, dir === 1 ? s : p.len - s);
        // a head standing right on a joint belongs to the piece it is leaving (s = len), not the one ahead (s = 0):
        // putting it at the start of the next piece would claim that piece too, where an oncoming train may stand
        const d = Math.hypot(q.x - at.x, q.y - at.y) + ((dir === 1 ? s : p.len - s) < 0.5 ? 0.25 : 0);
        if (q.tx * at.tx + q.ty * at.ty < 0.5 || d > 6.25) continue;
        if (!best || d < best.d) best = { step: { piece: id, dir }, s: dir === 1 ? s : p.len - s, d };
      }
    }
  }
  if (!best) return false;
  t.trail = [best.step]; t.headS = best.s; t.tailS = 0; t.plan = []; t.held = 0;
  const L = trainLength(t); let covered = t.headS;
  const rev = (s: Step): Step => ({ piece: s.piece, dir: s.dir === 1 ? -1 : 1 });
  while (covered < L) {
    const back = nextSteps(net, rev(t.trail[0]!));
    if (!back.length) break;
    const p = rev(back[0]!); t.trail.unshift(p); covered += net.pieces[p.piece]!.len;
  }
  t.tailS = t.trail.length === 1 ? Math.max(0, t.headS - L) : Math.max(0, covered - L);
  return true;
}
