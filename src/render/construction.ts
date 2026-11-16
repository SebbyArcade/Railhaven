import { BUILDER, type Ctx, crate, logSide, upright, worker, type WorkerLook } from './art.ts';

/**
 * The builders' scene for a building just put up (about 5 seconds, see BUILD_SHOW): the ground is cleared in a cloud
 * of dust, a tower crane swings beams in, builders hammer, saw and carry planks along a scaffold, and the building goes
 * up from one end of its row to the other. Drawn in the building's own frame (u along the yard, v across it with the
 * yard at negative v), like drawBuilding. Only for show: the building already works.
 */

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const k = clamp(x); return k * k * (3 - 2 * k); };

/** How much of the row is built at progress p (0-1): the building goes up between 12% and 85%. */
export const builtShare = (p: number) => ease((p - 0.12) / 0.73);

/** Ground under the building row while it is a building site: bare earth, pegs and string, a foundation outline. */
export function drawSiteGround(ctx: Ctx, L: number, p: number) {
  const a = 1 - clamp((p - 0.85) / 0.15); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = '#9a7a52'; ctx.fillRect(-L / 2, -14.6, L, 29);
  ctx.fillStyle = 'rgba(70,50,30,.28)';
  for (let k = 0; k < 46; k++) { const u = ((((k * 53) % 97) / 97 - 0.5) * (L - 4)), v = (((k * 29) % 61) / 61 - 0.5) * 26; ctx.fillRect(u, v, 1.2, 0.8); }
  ctx.fillStyle = 'rgba(255,240,210,.18)';
  for (let k = 0; k < 20; k++) { const u = (((k * 71) % 89) / 89 - 0.5) * (L - 6), v = (((k * 43) % 53) / 53 - 0.5) * 24; ctx.fillRect(u, v, 1.6, 0.6); }
  // foundation: pale stone footings in a grid where the walls will stand
  ctx.strokeStyle = 'rgba(225,215,195,.85)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(-L / 2 + 6, -10, L - 12, 21);
  ctx.beginPath(); for (let u = -L / 2 + 6 + (L - 12) / 3; u < L / 2 - 7; u += (L - 12) / 3) { ctx.moveTo(u, -10); ctx.lineTo(u, 11); } ctx.stroke();
  // corner pegs and string line
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.3; ctx.strokeRect(-L / 2 + 3, -12.5, L - 6, 26);
  ctx.fillStyle = '#e8d8a8'; for (const [u, v] of [[-L / 2 + 3, -12.5], [L / 2 - 3, -12.5], [-L / 2 + 3, 13.5], [L / 2 - 3, 13.5]] as const) ctx.fillRect(u - 0.6, v - 0.6, 1.2, 1.2);
  ctx.restore();
}

/** Clip to the part of the row that is already built, so the building rises from one end to the other. */
export function clipBuilt(ctx: Ctx, L: number, p: number) {
  const r = builtShare(p), u0 = -L / 2 - 6;
  ctx.beginPath(); ctx.rect(u0, -15, (L + 12) * r, 90); ctx.clip();
}

/** Brown dust rising and spreading, drawn the right way up. */
function dust(ctx: Ctx, u: number, v: number, tm: number, seed: number, big = 1, a0 = 1) {
  upright(ctx, u, v, () => {
    for (let k = 0; k < 3; k++) {
      const ph = (tm * 0.7 + seed * 0.37 + k / 3) % 1, a = 0.62 * (1 - ph) * a0;
      ctx.fillStyle = `rgba(206,178,132,${a})`;
      ctx.beginPath(); ctx.arc((k - 1) * 2.4 * big + Math.sin(ph * 5 + seed) * 1.5, -ph * 7 * big, (2 + ph * 5) * big, 0, 7); ctx.fill();
    }
  });
}

/** A yellow tower crane standing on the ground at (u, v): its jib swings slowly, a beam sways on the hook. */
function crane(ctx: Ctx, u: number, v: number, tm: number, p: number, a: number) {
  upright(ctx, u, v, () => {
    ctx.save(); ctx.globalAlpha = a;
    const H = 44 * ease(p / 0.08), Y = '#f2b630', D = '#9a6a10';
    // base and shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(3, 1, 7, 2.2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a7e86'; ctx.fillRect(-3.2, -1.6, 6.4, 2.4);
    if (H < 2) { ctx.restore(); return; }
    // the mast: a lattice tower
    ctx.fillStyle = Y; ctx.fillRect(-1.9, -H, 0.9, H); ctx.fillRect(1, -H, 0.9, H);
    ctx.strokeStyle = D; ctx.lineWidth = 0.35; ctx.beginPath();
    for (let y = 0; y < H - 2; y += 2.4) { ctx.moveTo(-1.2, -y); ctx.lineTo(1.2, -y - 2.4); ctx.moveTo(-1.2, -y - 2.4); ctx.lineTo(1.2, -y - 2.4); }
    ctx.stroke();
    if (H < 43) { ctx.restore(); return; }
    // the jib swings: seen from the front, its length on screen shrinks as it turns toward or away from us
    const th = Math.sin(tm * 0.55) * 1.15 + 0.2, c = Math.cos(th), s = Math.sin(th);
    const R = 52, top = -H - 1, jx = c * R, jy = top + s * R * 0.28, cx = -c * 11, cy = top - s * 11 * 0.28;
    const near = s > 0; // swung toward the viewer: the jib draws over the mast
    const jib = () => {
      ctx.strokeStyle = Y; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(jx, jy); ctx.stroke();
      ctx.strokeStyle = D; ctx.lineWidth = 0.3; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const f0 = k / 10, f1 = (k + 1) / 10; ctx.moveTo(f0 * jx, top + f0 * (jy - top) - 0.6); ctx.lineTo(f1 * jx, top + f1 * (jy - top) + 0.6); }
      ctx.stroke();
      ctx.fillStyle = '#8a8e96'; ctx.fillRect(cx - 2.2, cy - 1.2, 4.4, 2.8); // counterweight
      // the trolley runs in and out, the cable hangs from it with a swaying beam
      const f = 0.45 + 0.3 * Math.sin(tm * 0.8), tx = f * jx, ty = top + f * (jy - top);
      const drop = 16 + 5 * Math.sin(tm * 0.9 + 1), sw = Math.sin(tm * 1.7) * 1.6, bx = tx + sw, by = ty + drop;
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(tx - 1, ty - 0.2, 2, 1.2);
      ctx.strokeStyle = 'rgba(40,40,40,.8)'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(tx, ty + 1); ctx.lineTo(bx, by - 1.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by - 1.2); ctx.lineTo(bx - 3.6, by); ctx.moveTo(bx, by - 1.2); ctx.lineTo(bx + 3.6, by); ctx.stroke();
      ctx.fillStyle = '#b8743a'; ctx.fillRect(bx - 4.2, by, 8.4, 1.3); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bx - 4.2, by + 1, 8.4, 0.3);
    };
    if (!near) jib();
    // the cab on top
    ctx.fillStyle = Y; ctx.fillRect(-2.2, top - 1.4, 4.4, 3); ctx.fillStyle = '#9ad0e8'; ctx.fillRect(-1.6, top - 0.9, 1.8, 1.4);
    ctx.fillStyle = Y; ctx.fillRect(-0.4, top - 6, 0.8, 4.8); // the peak
    ctx.strokeStyle = 'rgba(60,60,60,.7)'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(0, top - 6); ctx.lineTo(jx * 0.7, top + (jy - top) * 0.7); ctx.moveTo(0, top - 6); ctx.lineTo(cx, cy); ctx.stroke();
    if (near) jib();
    ctx.restore();
  });
}

/** A scaffold of poles and boards along the building's front edge, where the builders work. */
function scaffold(ctx: Ctx, f: number, a: number) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(f - 4, -12, 9, 25);
  ctx.fillStyle = '#c89a62'; for (const v of [-11, -4, 3, 10]) ctx.fillRect(f - 4.5, v, 9, 1.6); // boards
  ctx.fillStyle = 'rgba(80,50,20,.35)'; for (const v of [-11, -4, 3, 10]) ctx.fillRect(f - 4.5, v + 1.3, 9, 0.3);
  ctx.fillStyle = '#8e939a'; for (const u of [f - 4, f + 4]) for (let v = -12; v <= 12; v += 6) { ctx.beginPath(); ctx.arc(u, v, 0.7, 0, 7); ctx.fill(); } // poles seen from above
  ctx.strokeStyle = 'rgba(130,135,140,.8)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(f - 4, -12); ctx.lineTo(f + 4, 12); ctx.moveTo(f + 4, -12); ctx.lineTo(f - 4, 12); ctx.stroke();
  ctx.restore();
}

const SAWYER: WorkerLook = { ...BUILDER, tool: 'chainsaw' }, CARRIER: WorkerLook = { ...BUILDER, coat: '#4a78a8', tool: 'plank' }, LEVER: WorkerLook = { ...BUILDER, coat: '#8a5a3a', tool: 'bar' };

/** Everything over the building: scaffold at the build front, materials, builders, the crane and the dust. */
export function drawSiteWork(ctx: Ctx, L: number, p: number, tm: number, zoom: number) {
  const end = 1 - clamp((p - 0.88) / 0.12), r = builtShare(p), f = -L / 2 + 2 + (L - 4) * r;
  // materials waiting at the far end: timber, bricks, a crate of nails (used up as the building goes up)
  if (end > 0) {
    ctx.save(); ctx.globalAlpha = end;
    const mu = L / 2 - 14, left = 1 - r;
    for (let k = 0; k < Math.ceil(5 * left + 0.01); k++) logSide(ctx, mu - 8, mu + 4, 6 - k * 1.4, 0.8);
    ctx.fillStyle = '#b5523b'; for (let k = 0; k < Math.ceil(6 * left); k++) ctx.fillRect(mu - 8 + (k % 3) * 4, -9 + Math.floor(k / 3) * 3, 3.6, 2.4);
    crate(ctx, mu + 6, -2, 3.4);
    ctx.restore();
  }
  if (p > 0.1 && p < 0.92) scaffold(ctx, f, Math.min(1, (p - 0.1) / 0.05) * end);
  if (zoom >= 0.9 && end > 0) {
    const s1 = Math.sin(tm * 9), s2 = Math.sin(tm * 8 + 2);
    worker(ctx, f + 2, -4, BUILDER, -1, s1 > 0 ? 1 : -1 + (s1 + 1) * 0.3, 0.9);  // hammering at the front
    worker(ctx, f - 1, 9, { ...BUILDER, coat: '#a8743a' }, 1, s2 > 0.3 ? 1 : -1, 0.9);
    worker(ctx, Math.min(L / 2 - 6, f + 12), 12, SAWYER, -1, Math.sin(tm * 40), 0.9); // cutting timber to length
    // one carries planks from the stack to the front and back again
    const leg = (tm * 0.35) % 1, k = leg < 0.5 ? leg * 2 : 2 - leg * 2, mu = L / 2 - 16;
    worker(ctx, mu + (f + 6 - mu) * k, 1, leg < 0.5 ? CARRIER : { ...CARRIER, tool: 'none' }, leg < 0.5 ? -1 : 1, 0, 0.9);
    if (p > 0.5) worker(ctx, f - 10, -9, LEVER, 1, Math.sin(tm * 3), 0.9);
  }
  // the crane stands just in front of the row, near the middle, and is taken down at the end
  if (end > 0) crane(ctx, -L * 0.18, 17, tm, p, end);
  // dust: a big cloud as the ground is cleared, puffs at the build front, and a last cloud as the scaffold comes down
  const clear = 1 - clamp(p / 0.15);
  if (clear > 0) for (let k = 0; k < 5; k++) dust(ctx, -L / 2 + (k + 0.5) * L / 5, ((k * 7) % 3 - 1) * 6, tm, k, 2.2, clear);
  if (p > 0.1 && p < 0.9) { dust(ctx, f, 4, tm, 9, 1.1); dust(ctx, f - 3, -7, tm, 11, 0.9); }
  const last = clamp((p - 0.84) / 0.08) * (1 - clamp((p - 0.94) / 0.06));
  if (last > 0) for (let k = 0; k < 4; k++) dust(ctx, -L / 2 + (k + 0.5) * L / 4, 2, tm, 20 + k, 1.4, last);
}
