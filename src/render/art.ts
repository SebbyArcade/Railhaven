/**
 * Small hand-made model pieces shared by buildings and towns: cottages with real roofs, windows and chimneys,
 * log piles with end grain, tiny people, chimney smoke. Seen from above with the front wall showing at +v,
 * lit from the top left, like a model railway layout.
 */

export type Ctx = CanvasRenderingContext2D;

/**
 * Draw something that has a front, people or rising smoke the right way up on screen, whichever way the building
 * around it is turned. (u, v) is its anchor in the current (maybe rotated or mirrored) frame; draw() runs in an
 * unrotated frame centred there, at the same scale. sw tells it the frame is turned a quarter, so a long building can
 * swap its width and depth and keep its footprint; yard is the screen direction of the frame's -v side (the yard).
 */
export function upright(ctx: Ctx, u: number, v: number, draw: (sw: boolean, yard: [number, number]) => void) {
  const m = ctx.getTransform(), s = Math.hypot(m.a, m.b) || 1;
  const x = m.a * u + m.c * v + m.e, y = m.b * u + m.d * v + m.f;
  ctx.save(); ctx.setTransform(s, 0, 0, s, x, y);
  draw(Math.abs(m.b) > Math.abs(m.a), [Math.sign(-m.c) * +(Math.abs(m.c) > Math.abs(m.d)), Math.sign(-m.d) * +(Math.abs(m.d) >= Math.abs(m.c))]);
  ctx.restore();
}

/** soft chimney smoke rising and fading */
export function puff(ctx: Ctx, u: number, v: number, tm: number, dark = false, big = 1) {
  upright(ctx, u, v, () => puff0(ctx, 0, 0, tm, dark, big));
}
function puff0(ctx: Ctx, u: number, v: number, tm: number, dark: boolean, big: number) {
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
  storeys?: 1 | 2 | 3;
  chimney?: number; // chimney position along the roof, -1..1 (omit for none)
  door?: boolean;
  lit?: boolean; // warm windows
  tm?: number; smoke?: boolean; darkSmoke?: boolean;
}

/** A little house w wide and d deep centred on (u, v): the roof seen from above, the front wall below it. */
export function cottage(ctx: Ctx, u: number, v: number, w: number, d: number, o: CottageOpts) {
  upright(ctx, u, v, sw => cottage0(ctx, 0, 0, sw ? d : w, sw ? w : d, o));
}
function cottage0(ctx: Ctx, u: number, v: number, w: number, d: number, o: CottageOpts) {
  const st = o.storeys ?? 1, wh = d * (st === 3 ? 0.58 : st === 2 ? 0.46 : 0.34), rh = d - wh;
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
  upright(ctx, u, v, () => person0(ctx, 0, 0, coat, hat));
}
function person0(ctx: Ctx, u: number, v: number, coat: string, hat: string) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(u + 0.8, v + 1.2, 1.4, 0.8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = coat; ctx.fillRect(u - 1, v - 0.6, 2, 2);
  ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(u, v - 1.3, 0.85, 0, 7); ctx.fill();
  ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(u, v - 1.55, 0.7, Math.PI, 0); ctx.fill();
}

export type Tool = 'hammer' | 'spanner' | 'bar' | 'hose' | 'pump' | 'none';
export interface WorkerLook { coat: string; trim: string; legs: string; hat: string; brim?: string; tool: Tool }
/** Rail repair gang: orange hi-vis jacket with silver bands, navy work trousers, yellow hard hat. */
export const GANG: WorkerLook = { coat: '#f08a1c', trim: '#e8eef2', legs: '#2c3550', hat: '#f4c628', tool: 'hammer' };
/** Fitter in blue overalls with an orange hi-vis vest and a white hard hat. */
export const FITTER: WorkerLook = { coat: '#2f5c9a', trim: '#f08a1c', legs: '#2f5c9a', hat: '#f2f2ee', tool: 'spanner' };
/** Firefighter: dark turnout coat with yellow bands, yellow helmet with a long back brim. */
export const FIREFIGHTER: WorkerLook = { coat: '#2a2f3a', trim: '#e8d040', legs: '#2a2f3a', hat: '#f0c030', brim: '#d8a820', tool: 'hose' };

/**
 * A worker standing on the ground, seen from the side like the model village's people but a little larger:
 * boots, work trousers, a jacket with reflective bands, arms, a face and a hard hat, holding a tool.
 * Feet at (u, v). `f` = facing (1 right, -1 left); `a` = the working arm's swing from -1 (raised) to 1 (struck).
 */
export function worker(ctx: Ctx, u: number, v: number, look: WorkerLook, f: 1 | -1, a: number, k = 1) {
  upright(ctx, u, v, () => { ctx.save(); ctx.scale(f * k, k); worker0(ctx, look, a); ctx.restore(); });
}
function worker0(ctx: Ctx, L: WorkerLook, a: number) {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0.6, 0.2, 2.6, 0.9, 0, 0, 7); ctx.fill(); // shadow
  // legs apart in a working stance, boots
  ctx.fillStyle = L.legs; ctx.fillRect(-1.25, -3.2, 1.05, 3); ctx.fillRect(0.25, -3.2, 1.05, 3);
  ctx.fillStyle = '#1e1a16'; ctx.fillRect(-1.45, -0.55, 1.35, 0.7); ctx.fillRect(0.2, -0.55, 1.45, 0.7);
  // the arm at the back
  ctx.strokeStyle = L.coat; ctx.lineCap = 'round'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-0.6, -5.6); ctx.lineTo(-1.5, -3.9); ctx.stroke();
  // jacket with reflective bands
  ctx.fillStyle = L.coat; ctx.beginPath(); ctx.roundRect(-1.5, -6.6, 3, 3.6, 0.6); ctx.fill();
  ctx.fillStyle = L.trim; ctx.fillRect(-1.5, -4.4, 3, 0.45); ctx.fillRect(-1.5, -5.6, 3, 0.35);
  if (L === FITTER) { ctx.fillStyle = L.trim; ctx.fillRect(-1.5, -6.6, 0.7, 2.2); ctx.fillRect(0.8, -6.6, 0.7, 2.2); } // hi-vis vest over overalls
  // head
  ctx.fillStyle = '#e8bf98'; ctx.beginPath(); ctx.arc(0.15, -7.55, 0.95, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1e16'; ctx.fillRect(0.75, -7.7, 0.25, 0.25); // eye
  // hard hat: dome and brim (a firefighter's helmet has a long brim at the back)
  ctx.fillStyle = L.hat; ctx.beginPath(); ctx.arc(0.1, -8.05, 1.1, Math.PI, 0); ctx.fill();
  ctx.fillStyle = L.brim ?? L.hat; ctx.fillRect(-1.25, -8.15, 2.75, 0.45);
  if (L.brim) ctx.fillRect(-1.9, -8.15, 0.8, 0.9);
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-0.4, -8.95, 0.7, 0.3); // shine
  // the working arm and its tool
  const ang = L.tool === 'hammer' || L.tool === 'bar' ? -1.9 + (a + 1) * 1.05 : L.tool === 'spanner' ? 0.2 + a * 0.35 : L.tool === 'pump' ? -0.3 + a * 0.5 : 0.15;
  const sx = 0.6, sy = -5.9, hx = sx + Math.cos(ang) * 2.2, hy = sy + Math.sin(ang) * 2.2 + 1.2;
  ctx.strokeStyle = L.coat; ctx.lineWidth = 0.95; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.fillStyle = L.tool === 'hose' ? '#1a1a1a' : '#e8bf98'; ctx.beginPath(); ctx.arc(hx, hy, 0.45, 0, 7); ctx.fill(); // hand / glove
  const tx = Math.cos(ang + 0.25), ty = Math.sin(ang + 0.25);
  if (L.tool === 'hammer') { // sledgehammer: wooden shaft, steel head
    const ex = hx + tx * 3.6, ey = hy + ty * 3.6;
    ctx.strokeStyle = '#a07040'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(hx - tx * 0.6, hy - ty * 0.6); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(ang + 0.25); ctx.fillStyle = '#4a4e54'; ctx.fillRect(-0.55, -0.9, 1.1, 1.8); ctx.restore();
  } else if (L.tool === 'bar') { // long crowbar
    ctx.strokeStyle = '#5a5e64'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(hx - tx, hy - ty); ctx.lineTo(hx + tx * 3.8, hy + ty * 3.8); ctx.stroke();
  } else if (L.tool === 'spanner') { // big spanner held out
    const ex = hx + tx * 2.2, ey = hy + ty * 2.2;
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(ex, ey, 0.55, ang + 0.25 - 1.3, ang + 0.25 + 1.3); ctx.stroke();
  } else if (L.tool === 'hose') { // nozzle held forward
    ctx.strokeStyle = '#b8b8b0'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + tx * 1.6, hy + ty * 1.6 - 0.3); ctx.stroke();
  }
  ctx.lineCap = 'butt';
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

/** a wooden barrel seen from above: staves, two iron hoops */
export function barrel(ctx: Ctx, u: number, v: number, col = '#7a5230') {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(u + 0.7, v + 0.8, 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(u, v, 1.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2e2620'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(u, v, 1.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(u, v, 0.9, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(u - 0.5, v - 0.5, 0.6, 0, 7); ctx.fill();
}

/** a full sack, tied at the neck */
export function sack(ctx: Ctx, u: number, v: number, col = '#d8c8a0') {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(u + 0.6, v + 0.7, 1.7, 1.2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(u, v, 1.7, 1.25, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(u + 1, v - 0.3, 0.5, 0.6);
}

/** a wooden crate with a cross brace */
export function crate(ctx: Ctx, u: number, v: number, s = 2.8, col = '#9a7444') {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(u + 0.6, v + 0.7, s, s);
  ctx.fillStyle = col; ctx.fillRect(u, v, s, s);
  ctx.strokeStyle = 'rgba(40,26,12,.55)'; ctx.lineWidth = 0.25; ctx.strokeRect(u, v, s, s);
  ctx.beginPath(); ctx.moveTo(u, v); ctx.lineTo(u + s, v + s); ctx.stroke();
}

/** a street lamp: a post and a glowing lantern */
export function lamp(ctx: Ctx, u: number, v: number, tm: number) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u + 0.4, v + 0.4, 3, 0.5);
  ctx.fillStyle = '#2e2a26'; ctx.beginPath(); ctx.arc(u, v, 0.7, 0, 7); ctx.fill();
  const g = 0.75 + 0.25 * Math.sin(tm * 3 + u);
  ctx.fillStyle = `rgba(255,214,120,${0.25 * g})`; ctx.beginPath(); ctx.arc(u, v, 2.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.arc(u, v, 0.45, 0, 7); ctx.fill();
}

/** a two-wheeled handcart, maybe loaded */
export function cart(ctx: Ctx, u: number, v: number, col = '#8a6038', load?: string) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(u - 3 + 0.7, v - 2 + 0.8, 6, 4);
  ctx.fillStyle = col; ctx.fillRect(u - 3, v - 2, 6, 4);
  ctx.strokeStyle = 'rgba(40,26,12,.6)'; ctx.lineWidth = 0.3; ctx.strokeRect(u - 3, v - 2, 6, 4);
  if (load) { ctx.fillStyle = load; ctx.fillRect(u - 2.4, v - 1.4, 4.8, 2.8); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(u - 2.4, v - 1.4, 4.8, 0.7); }
  ctx.fillStyle = '#2e2a26'; ctx.fillRect(u - 1.6, v - 2.7, 3.2, 0.8); ctx.fillRect(u - 1.6, v + 1.9, 3.2, 0.8);
  ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(u + 3, v - 1); ctx.lineTo(u + 6, v - 1); ctx.moveTo(u + 3, v + 1); ctx.lineTo(u + 6, v + 1); ctx.stroke();
}

/** a pointed conifer seen from above */
export function pine(ctx: Ctx, u: number, v: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(u + r * 0.4, v + r * 0.5, r, 0, 7); ctx.fill();
  for (const [s, c] of [[1, '#2c5a2a'], [0.68, '#3a7034'], [0.36, '#4f8a42']] as const) {
    ctx.fillStyle = c; ctx.beginPath();
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, rr = r * s * (k % 2 ? 0.72 : 1); ctx.lineTo(u + Math.cos(a) * rr, v + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
}

/** a little bed of flowers */
export function flowers(ctx: Ctx, u: number, v: number, seed: (k: number) => number) {
  ctx.fillStyle = '#4a7a34'; ctx.beginPath(); ctx.ellipse(u, v, 3.2, 1.6, 0, 0, 7); ctx.fill();
  const cols = ['#e8505a', '#f2d24a', '#f4f0e6', '#c46ad8', '#ff9a3c'];
  for (let k = 0; k < 7; k++) { ctx.fillStyle = cols[Math.floor(seed(k) * cols.length)]!; ctx.fillRect(u - 2.6 + seed(k + 10) * 5, v - 1 + seed(k + 20) * 2, 0.7, 0.7); }
}

/** a dry-stone wall along a line */
export function stoneWall(ctx: Ctx, u0: number, v0: number, u1: number, v1: number) {
  const len = Math.hypot(u1 - u0, v1 - v0), n = Math.max(2, Math.round(len / 1.3));
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(u0 + 0.5, v0 + 0.6); ctx.lineTo(u1 + 0.5, v1 + 0.6); ctx.stroke();
  ctx.strokeStyle = '#9a948a'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(u0, v0); ctx.lineTo(u1, v1); ctx.stroke();
  for (let k = 0; k <= n; k++) { const t = k / n; ctx.fillStyle = k % 3 ? '#b8b2a6' : '#7e786e'; ctx.fillRect(u0 + (u1 - u0) * t - 0.45, v0 + (v1 - v0) * t - 0.45, 0.9, 0.8); }
}

/** a hen pecking */
export function hen(ctx: Ctx, u: number, v: number, tm: number, col = '#f4efe2') {
  const p = Math.sin(tm * 4 + u * 3) > 0.6 ? 0.4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(u + 0.4, v + 0.5, 0.9, 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(u, v, 0.9, 0.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#d8402e'; ctx.fillRect(u + 0.7 + p, v - 0.4, 0.4, 0.3);
}

/** a dog lying or trotting */
export function dog(ctx: Ctx, u: number, v: number, col = '#3a2c22') {
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(u + 0.5, v + 0.6, 1.6, 0.7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(u, v, 1.5, 0.65, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(u + 1.5, v - 0.2, 0.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(u + 1.4, v + 0.1, 0.5, 0.3);
}

/** a round hay bale */
export function hayBale(ctx: Ctx, u: number, v: number) {
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(u + 0.7, v + 0.8, 1.9, 0, 7); ctx.fill();
  ctx.fillStyle = '#d8b45a'; ctx.beginPath(); ctx.arc(u, v, 1.9, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(140,100,30,.6)'; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.arc(u, v, 1.2, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(u, v, 0.5, 0, 7); ctx.stroke();
}
