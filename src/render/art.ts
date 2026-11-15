/**
 * Small hand-made model pieces shared by buildings and towns: cottages with real roofs, windows and chimneys,
 * log piles with end grain, tiny people, chimney smoke. Seen from above with the front wall showing at +v,
 * lit from the top left, like a model railway layout.
 */

export type Ctx = CanvasRenderingContext2D;

/** soft chimney smoke rising and fading */
export function puff(ctx: Ctx, u: number, v: number, tm: number, dark = false, big = 1) {
  for (let k = 0; k < 3; k++) {
    const p = (tm * 0.45 + k / 3) % 1, a = (dark ? 0.5 : 0.42) * (1 - p);
    ctx.fillStyle = dark ? `rgba(58,55,52,${a})` : `rgba(232,228,220,${a})`;
    ctx.beginPath(); ctx.arc(u + p * 4 * big + Math.sin(p * 6 + k) * 0.8, v - p * 12 * big, (1.3 + p * 3.2) * big, 0, 7); ctx.fill();
  }
}

export interface CottageOpts {
  wall: string; roof: string;
  /** log cabin walls, brick, or plain plaster */
  walls?: 'logs' | 'brick' | 'plain';
  storeys?: 1 | 2;
  chimney?: number; // chimney position along the roof, -1..1 (omit for none)
  door?: boolean;
  lit?: boolean; // warm windows
  tm?: number; smoke?: boolean; darkSmoke?: boolean;
}

/** A little house w wide and d deep centred on (u, v): the roof seen from above, the front wall below it. */
export function cottage(ctx: Ctx, u: number, v: number, w: number, d: number, o: CottageOpts) {
  const st = o.storeys ?? 1, wh = d * (st === 2 ? 0.46 : 0.34), rh = d - wh;
  const x0 = u - w / 2, y0 = v - d / 2, wy = y0 + rh;
  // shadow on the ground
  ctx.fillStyle = 'rgba(20,16,10,.28)'; ctx.fillRect(x0 + 1.8, y0 + 2.2, w, d);
  // front wall
  ctx.fillStyle = o.wall; ctx.fillRect(x0, wy, w, wh);
  if (o.walls === 'logs') {
    ctx.strokeStyle = 'rgba(40,24,10,.45)'; ctx.lineWidth = 0.35;
    for (let y = wy + 1.1; y < wy + wh; y += 1.3) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(210,170,110,.8)'; // log ends at the corners
    for (let y = wy + 0.5; y < wy + wh - 0.3; y += 1.3) { ctx.fillRect(x0 - 0.6, y, 0.9, 0.9); ctx.fillRect(x0 + w - 0.3, y, 0.9, 0.9); }
  } else if (o.walls === 'brick') {
    ctx.strokeStyle = 'rgba(255,230,210,.22)'; ctx.lineWidth = 0.25;
    for (let y = wy + 0.9, r = 0; y < wy + wh; y += 0.9, r++) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
      for (let x = x0 + (r % 2) * 1.1; x < x0 + w; x += 2.2) { ctx.beginPath(); ctx.moveTo(x, y - 0.9); ctx.lineTo(x, y); ctx.stroke(); }
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x0, wy + wh - 0.6, w, 0.6); // plinth
  // windows and door
  const rows = st, ww = Math.min(1.8, w * 0.14), wn = Math.max(2, Math.round(w / 4.2));
  for (let r = 0; r < rows; r++) {
    const yy = wy + (wh / rows) * (r + 0.32);
    for (let k = 0; k < wn; k++) {
      const xx = x0 + (w / wn) * (k + 0.5) - ww / 2;
      if (o.door !== false && r === rows - 1 && k === Math.floor(wn / 2)) continue;
      ctx.fillStyle = '#f4ead6'; ctx.fillRect(xx - 0.3, yy - 0.3, ww + 0.6, wh / rows * 0.42 + 0.6);
      ctx.fillStyle = o.lit ? '#ffd27a' : '#6f93a8'; ctx.fillRect(xx, yy, ww, wh / rows * 0.42);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(xx, yy, ww * 0.4, wh / rows * 0.2);
    }
  }
  if (o.door !== false) {
    const dw = Math.min(2.2, w * 0.16), dh = (wh / rows) * 0.7, dx = x0 + (w / wn) * (Math.floor(wn / 2) + 0.5) - dw / 2;
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(dx, wy + wh - dh, dw, dh);
    ctx.fillStyle = '#d8b060'; ctx.fillRect(dx + dw * 0.7, wy + wh - dh * 0.5, 0.4, 0.4);
  }
  // roof: back slope catches the light, front slope in shade, shingle courses, a ridge
  const ov = 0.9;
  ctx.fillStyle = o.roof; ctx.fillRect(x0 - ov, y0, w + ov * 2, rh);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x0 - ov, y0, w + ov * 2, rh * 0.5);
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(x0 - ov, y0 + rh * 0.5, w + ov * 2, rh * 0.5);
  ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 0.3;
  for (let y = y0 + 1.1; y < y0 + rh - 0.4; y += 1.1) {
    ctx.beginPath(); ctx.moveTo(x0 - ov, y); ctx.lineTo(x0 + w + ov, y); ctx.stroke();
    const off = ((y - y0) / 1.1) % 2 < 1 ? 0 : 0.9;
    for (let x = x0 - ov + off; x < x0 + w + ov; x += 1.8) { ctx.beginPath(); ctx.moveTo(x, y - 1.1); ctx.lineTo(x, y); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 - ov, y0 + rh * 0.5 - 0.35, w + ov * 2, 0.7); // ridge
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x0 - ov, y0 + rh - 0.5, w + ov * 2, 0.5); // eaves shadow
  if (o.chimney !== undefined) {
    const cx = u + o.chimney * w * 0.35, cy = y0 + rh * 0.18;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(cx - 0.6, cy + 0.6, 2.4, 2.6);
    ctx.fillStyle = o.walls === 'logs' ? '#8a857b' : '#8a4a36'; ctx.fillRect(cx - 1.2, cy - 1, 2.4, 3);
    ctx.fillStyle = '#2a2420'; ctx.fillRect(cx - 0.7, cy - 0.8, 1.4, 0.9);
    if (o.smoke && o.tm !== undefined) puff(ctx, cx, cy - 2, o.tm, o.darkSmoke);
  }
}

/** a tiny person seen from above: hat or hair, shoulders, a shadow */
export function person(ctx: Ctx, u: number, v: number, coat: string, hat = '#3a2a1e') {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(u + 0.8, v + 1.2, 1.4, 0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = coat; ctx.fillRect(u - 1, v - 0.6, 2, 2);
  ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(u, v - 1.3, 0.85, 0, 7); ctx.fill();
  ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(u, v - 1.55, 0.7, Math.PI, 0); ctx.fill();
}

/** one log seen end-on: bark, pale wood, growth rings */
export function logEnd(ctx: Ctx, u: number, v: number, r: number) {
  ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.arc(u, v, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9ab6a'; ctx.beginPath(); ctx.arc(u, v, r * 0.78, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(140,90,40,.7)'; ctx.lineWidth = 0.25;
  ctx.beginPath(); ctx.arc(u, v, r * 0.52, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(u, v, r * 0.26, 0, 7); ctx.stroke();
}

/** a log lying lengthwise from u0 to u1: bark with streaks, a cut end */
export function logSide(ctx: Ctx, u0: number, u1: number, v: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u0 + 0.8, v - r + 1, u1 - u0, r * 2);
  ctx.fillStyle = '#6e4626'; ctx.fillRect(u0, v - r, u1 - u0, r * 2);
  ctx.fillStyle = 'rgba(255,220,170,.18)'; ctx.fillRect(u0, v - r, u1 - u0, r * 0.6);
  ctx.strokeStyle = 'rgba(30,18,8,.45)'; ctx.lineWidth = 0.25;
  for (let x = u0 + 2; x < u1 - 1; x += 3.1) { ctx.beginPath(); ctx.moveTo(x, v - r * 0.7); ctx.lineTo(x + 1.6, v + r * 0.5); ctx.stroke(); }
  logEnd(ctx, u1, v, r);
}

/** a round tree crown with a shadow, for gardens */
export function bush(ctx: Ctx, u: number, v: number, r: number, col = '#3f6f30') {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(u + r * 0.35, v + r * 0.45, r, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(u, v, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(u - r * 0.3, v - r * 0.3, r * 0.55, 0, 7); ctx.fill();
}

/** a picket fence along a line */
export function fence(ctx: Ctx, u0: number, v0: number, u1: number, v1: number, col = '#efe6d2') {
  const len = Math.hypot(u1 - u0, v1 - v0), n = Math.max(2, Math.round(len / 1.6));
  ctx.strokeStyle = col; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.stroke();
  ctx.fillStyle = col;
  for (let k = 0; k <= n; k++) { const t = k / n; ctx.fillRect(u0 + (u1 - u0) * t - 0.3, v0 + (v1 - v0) * t - 0.3, 0.6, 0.6); }
}
