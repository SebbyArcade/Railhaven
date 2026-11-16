import type { Poi } from '../world/explore.ts';
import { puff } from './art.ts';

type C = CanvasRenderingContext2D;

/**
 * Hand-made miniature landmarks, drawn at the origin about two squares across: a ground patch, soft shadows and
 * small details (people, weeds, smoke, spray) in the model-village style of the towns and industries.
 */
const sh = 'rgba(20,16,10,.28)';
const ell = (c: C, x: number, y: number, rx: number, ry: number, col: string) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); };
const rect = (c: C, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const poly = (c: C, col: string, ...pts: number[]) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i]!, pts[i + 1]!); c.closePath(); c.fill(); };
const person = (c: C, x: number, y: number, shirt: string, tm = 0, sway = 0) => {
  const b = Math.sin(tm * 3 + x) * sway;
  ell(c, x + 0.8, y + 2.2, 1.6, 0.7, sh); rect(c, x - 0.9, y - 1.5 + b, 1.8, 3, shirt); ell(c, x, y - 2.4 + b, 1.05, 1.05, '#f0c8a0');
};
const pine = (c: C, x: number, y: number, s = 1) => {
  ell(c, x + 2 * s, y + 1.5 * s, 4 * s, 1.6 * s, sh);
  poly(c, '#2f5a2c', x, y - 11 * s, x + 5 * s, y, x - 5 * s, y); poly(c, '#3d6e36', x, y - 13 * s, x + 3.8 * s, y - 5 * s, x - 3.8 * s, y - 5 * s);
  rect(c, x - 0.8 * s, y, 1.6 * s, 2 * s, '#5a3c22');
};
const bush = (c: C, x: number, y: number, r: number, col = '#5f8a44') => { ell(c, x + 1, y + 1, r, r * 0.6, sh); ell(c, x, y, r, r * 0.8, col); ell(c, x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.35, 'rgba(255,255,255,.15)'); };
const grassPatch = (c: C, rx: number, ry: number, col = 'rgba(120,150,80,.45)') => ell(c, 0, 4, rx, ry, col);

export function drawLandmark(c: C, p: Poi, tm: number) {
  switch (p.kind) {
    case 'ruins': { // a temple floor with broken columns, a fallen drum, moss and ivy
      grassPatch(c, 20, 9, 'rgba(150,140,110,.35)');
      poly(c, sh, -16, 6, 18, 6, 20, 10, -14, 10);
      poly(c, '#d9d0b8', -17, 2, 17, 2, 19, 7, -15, 7); poly(c, '#bfb59a', -15, 7, 19, 7, 19, 8.5, -15, 8.5);
      for (let k = -14; k < 17; k += 6) rect(c, k, 2.2, 0.5, 4.6, 'rgba(120,110,90,.35)');
      for (const [u, h, br] of [[-12, 17, 1], [-5, 10, 0], [2, 20, 1], [9, 6, 0], [14, 13, 0]] as const) {
        rect(c, u + 1.5, 4 - h, 3, h, 'rgba(0,0,0,.18)');
        rect(c, u - 2, 3 - h, 4, h, '#eee7d4'); rect(c, u - 2, 3 - h, 1, h, '#fff8e8'); rect(c, u + 1, 3 - h, 1, h, '#cfc6ae');
        for (let f = 3 - h + 2; f < 3; f += 3) rect(c, u - 2, f, 4, 0.4, 'rgba(150,140,115,.4)');
        if (br) { rect(c, u - 3, 2 - h, 6, 1.8, '#d8cfb6'); rect(c, u - 3, 2 - h, 6, 0.6, '#f6efdc'); }
        else poly(c, '#eee7d4', u - 2, 3 - h, u + 2, 3 - h, u + 0.5, 1 - h, u - 1, 2 - h);
      }
      rect(c, -12, -15, 18, 2.2, '#e6dec8'); rect(c, -12, -15, 18, 0.7, '#fff8e8'); // a lintel still standing on two columns
      ell(c, -4, 9.5, 4.5, 2, '#e3dbc4'); ell(c, -8, 9.5, 2.2, 2, '#d0c7ad'); // fallen drum
      for (const [u, v] of [[-12, -1], [2, -10], [14, -2], [-5, -3]]) { ell(c, u, v, 1.6, 2.4, '#5f8a3a'); ell(c, u + 0.5, v + 1.5, 1.2, 1.6, '#4c7530'); } // ivy
      bush(c, 19, 5, 3.5); bush(c, -19, 6, 2.6, '#6e9a4c');
      person(c, 8, 8, '#7b5ea8', tm, 0.2);
      break;
    }
    case 'lighthouse': { // a striped tower on rocks with a gallery, a glowing lamp and its turning beam, the keeper's cottage
      const a = tm * 1.1;
      c.fillStyle = 'rgba(255,240,170,.16)'; c.beginPath(); c.moveTo(0, -30); c.arc(0, -30, 80, a - 0.18, a + 0.18); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,240,170,.08)'; c.beginPath(); c.moveTo(0, -30); c.arc(0, -30, 80, a + Math.PI - 0.18, a + Math.PI + 0.18); c.closePath(); c.fill();
      for (const [u, v, r] of [[-8, 6, 6], [6, 7, 7], [-1, 9, 5], [12, 4, 4]] as const) { ell(c, u + 1, v + 1, r, r * 0.6, sh); ell(c, u, v, r, r * 0.65, '#8d877c'); ell(c, u - 1, v - 1, r * 0.5, r * 0.3, '#a9a397'); }
      ell(c, 4, 6, 7, 2.6, sh);
      for (let k = 0; k < 5; k++) { // tapered bands
        const y0 = 4 - k * 6, w0 = 6 - k * 0.7, w1 = 6 - (k + 1) * 0.7;
        poly(c, k % 2 ? '#c0392b' : '#f6f1e4', -w0, y0, w0, y0, w1, y0 - 6, -w1, y0 - 6);
        poly(c, 'rgba(0,0,0,.12)', w0 * 0.3, y0, w0, y0, w1, y0 - 6, w1 * 0.3, y0 - 6);
      }
      rect(c, -1, -4, 2, 3, '#3a2a1e'); rect(c, -0.8, -15, 1.6, 2, '#2b3a4a');
      rect(c, -5, -27, 10, 1.5, '#2e2e2e'); for (let k = -4; k <= 4; k += 2) rect(c, k, -29, 0.5, 2, '#2e2e2e'); // gallery and railing
      const glow = 0.75 + 0.25 * Math.sin(tm * 4);
      ell(c, 0, -32, 6 * glow, 5 * glow, 'rgba(255,230,120,.25)');
      rect(c, -2.6, -34, 5.2, 5, `rgba(255,${210 + Math.round(30 * glow)},110,1)`); rect(c, -2.6, -34, 1, 5, '#fff6c8');
      poly(c, '#333', -3.6, -34, 0, -38.5, 3.6, -34); rect(c, -0.3, -40.5, 0.6, 2, '#333');
      // keeper's cottage
      poly(c, sh, 9, 2, 21, 2, 22, 4, 10, 4); rect(c, 9, -5, 11, 7, '#f1e9d6'); poly(c, '#9b4a33', 8, -5, 14.5, -10, 21, -5); rect(c, 12, -2, 2, 4, '#5a3c22'); rect(c, 16, -3, 2.2, 2, '#9ec4e0');
      rect(c, 18, -11, 1.6, 4, '#7a6a5a'); puff(c as never, 18.8, -12, tm, false, 0.6);
      person(c, 6, 5, '#2b4a7a', tm, 0.2);
      break;
    }
    case 'lookout': { // a grassy knoll with a wooden lookout tower, a ladder, a flag and a walker with a telescope
      ell(c, 2, 7, 18, 6, sh); ell(c, 0, 4, 18, 8, '#8fa860'); ell(c, -2, 1, 13, 6, '#9cb56a'); ell(c, -4, -1, 7, 3, '#aac478');
      for (const [u, v, r] of [[-12, 6, 2.2], [12, 6, 2.6], [8, 9, 1.8]] as const) { ell(c, u, v, r, r * 0.7, '#8a857a'); ell(c, u - 0.5, v - 0.5, r * 0.5, r * 0.3, '#a7a296'); }
      // tower: four legs, cross braces, a platform with a roof
      c.strokeStyle = '#6b4a2e'; c.lineWidth = 1.3;
      for (const u of [-5, 5]) { c.beginPath(); c.moveTo(u, 3); c.lineTo(u * 0.6, -20); c.stroke(); }
      c.lineWidth = 0.7; c.beginPath(); c.moveTo(-5, 3); c.lineTo(3, -8); c.moveTo(5, 3); c.lineTo(-3, -8); c.moveTo(-4, -8); c.lineTo(3.5, -19); c.moveTo(4, -8); c.lineTo(-3.5, -19); c.stroke();
      rect(c, -6, -21, 12, 2, '#8a6440'); rect(c, -6, -21, 12, 0.6, '#a87e54');
      for (let k = -5; k <= 5; k += 2.5) rect(c, k, -25, 0.6, 4, '#6b4a2e'); rect(c, -6, -25, 12, 0.7, '#6b4a2e');
      poly(c, '#a5442e', -7.5, -26, 7.5, -26, 0, -31);
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -31); c.lineTo(0, -38); c.stroke();
      const f = Math.sin(tm * 5); poly(c, '#e8a33c', 0, -38, 7, -36.5 + f * 0.6, 0, -34.5);
      // ladder
      c.strokeStyle = '#7a5434'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(7, 3); c.lineTo(5, -20); c.moveTo(9, 3); c.lineTo(7, -20); c.stroke();
      for (let v = 1; v > -19; v -= 3) { c.beginPath(); c.moveTo(7 - (1 - v) * 0.09, v); c.lineTo(9 - (1 - v) * 0.09, v); c.stroke(); }
      person(c, -2, -22.5, '#c0392b', tm, 0); rect(c, -1, -25, 4, 0.9, '#3a3a3a'); // someone on top with a telescope
      person(c, -10, 2, '#3b7a57', tm, 0.3);
      break;
    }
    case 'wreck': { // a half-sunk hull with ribs showing, a broken mast with torn sail, foam, floating crates and a gull
      const bob = Math.sin(tm * 1.2) * 0.5;
      for (let k = 0; k < 3; k++) { const ph = (tm * 0.4 + k / 3) % 1; c.strokeStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 3, 14 + ph * 10, 5 + ph * 4, -0.4, 0, 7); c.stroke(); }
      c.save(); c.rotate(-0.4); c.translate(0, bob);
      ell(c, 0, 3, 16, 5.5, 'rgba(20,50,70,.35)');
      c.fillStyle = '#4a3424'; c.beginPath(); c.moveTo(-15, 0); c.lineTo(9, -3); c.quadraticCurveTo(17, 0, 9, 4); c.lineTo(-15, 3); c.closePath(); c.fill();
      rect(c, -15, -0.5, 24, 1, '#6b4a30');
      for (let k = -12; k < 8; k += 3.2) { c.strokeStyle = '#2e2018'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(k, -2.5 + k * 0.02); c.lineTo(k + 0.8, -5.5); c.stroke(); } // ribs where the deck is gone
      ell(c, -15, 1.5, 2.5, 2.2, 'rgba(255,255,255,.55)'); ell(c, 12, 1, 2, 1.6, 'rgba(255,255,255,.45)');
      c.strokeStyle = '#3a2a1e'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-2, 0); c.lineTo(2, -16); c.stroke();
      c.lineWidth = 0.8; c.beginPath(); c.moveTo(-1, -9); c.lineTo(6, -11); c.stroke();
      poly(c, 'rgba(236,226,196,.85)', 2, -15, 7, -11, 5, -8, 3, -10, 1.5, -7);
      c.restore();
      for (const [u, v, r] of [[-16, -8, 0], [14, 8, 0.6]] as const) { const b2 = Math.sin(tm * 1.5 + u) * 0.6; c.save(); c.translate(u, v + b2); c.rotate(r); rect(c, -2, -2, 4, 4, '#8a6440'); rect(c, -2, -0.3, 4, 0.6, '#5a3c22'); c.restore(); }
      const gx = Math.cos(tm * 0.7) * 12, gy = -18 + Math.sin(tm * 1.4) * 3, w = Math.sin(tm * 8) * 2;
      c.strokeStyle = '#f4f4f4'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(gx - 3, gy - w); c.quadraticCurveTo(gx - 1.5, gy - 1.5, gx, gy); c.quadraticCurveTo(gx + 1.5, gy - 1.5, gx + 3, gy - w); c.stroke();
      break;
    }
    case 'halt': { // an abandoned station: weedy platform, a building with a broken canopy and nameboard, rusty rails, a leaning lamp
      grassPatch(c, 20, 9);
      for (const v of [8, 11.5]) { c.strokeStyle = '#7a5a40'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-20, v); c.lineTo(20, v + 0.4); c.stroke(); }
      for (let u = -18; u < 20; u += 3) rect(c, u, 7, 1.4, 6, 'rgba(90,70,50,.55)');
      for (let u = -16; u < 18; u += 5) { c.strokeStyle = '#6e8f44'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(u, 12); c.lineTo(u - 1, 9); c.moveTo(u + 0.6, 12); c.lineTo(u + 1.6, 9.5); c.stroke(); }
      poly(c, sh, -18, 6, 18, 6, 19, 7.5, -17, 7.5);
      rect(c, -18, 1, 36, 5, '#c9bfa8'); rect(c, -18, 5, 36, 1, '#e8d890'); // platform with its yellow edge
      for (let u = -15; u < 16; u += 7) rect(c, u, 2, 3, 0.6, 'rgba(110,100,80,.3)');
      poly(c, sh, -10, 1, 9, 1, 11, 3, -8, 3);
      rect(c, -10, -9, 18, 10, '#a98b6a'); rect(c, -10, -9, 18, 1.2, '#8e7254');
      for (const u of [-7, -1, 4]) { rect(c, u, -6, 2.5, 3.5, '#2b241e'); c.strokeStyle = '#6a5640'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(u, -6); c.lineTo(u + 2.5, -2.5); c.stroke(); } // boarded windows
      rect(c, -4.2, -4.5, 2.4, 5.5, '#4a3a2c');
      poly(c, '#6a5040', -12, -9, -1, -15, 10, -9); poly(c, '#4e3a2e', -1, -15, 10, -9, 6, -9, 2, -12); // roof, one side sagging
      rect(c, 1.5, -12, 2, 1.5, '#2b241e'); // a hole
      poly(c, '#5a4a3c', -12, 1, 1, 1, 3, -1, -14, -1); rect(c, -11, -1, 0.6, 2, '#4a3a2c'); // fallen canopy
      rect(c, -7, -12.5, 9, 2.2, '#f0e6cc'); rect(c, -6.5, -11.8, 8, 0.6, '#7a6a5a'); // nameboard
      c.save(); c.translate(14, 4); c.rotate(0.25); rect(c, -0.4, -12, 0.8, 12, '#3a3a3a'); rect(c, -1.5, -13.5, 3, 2, '#2a2a2a'); c.restore();
      rect(c, 5, 2, 5, 1, '#7a5434'); rect(c, 5.5, 3, 0.6, 1.5, '#5a3c22'); rect(c, 9, 3, 0.6, 1.5, '#5a3c22'); // bench
      bush(c, -16, -2, 3.2); bush(c, 16, -4, 2.6, '#6e9a4c');
      break;
    }
    case 'falls': { // layered cliffs, a ribbon of falling water, a pool with rings, spray, ferns and a little footbridge
      ell(c, 2, 12, 20, 6, sh);
      poly(c, '#6f685d', -18, -4, -10, -16, 0, -19, 11, -15, 18, -5, 16, 2, -16, 2);
      poly(c, '#857e72', -15, -6, -8, -14, 0, -17, 9, -13, 14, -6, 0, -7);
      for (const [u, v, w] of [[-12, -3, 8], [4, -4, 10], [-6, -10, 6]] as const) rect(c, u, v, w, 0.8, 'rgba(60,55,48,.6)');
      ell(c, 0, -17, 7, 2.6, '#5f8fb8'); // the stream at the top
      ell(c, 1, 9, 15, 5.5, '#4f81ab'); ell(c, 0, 8, 12, 4, '#5f93bf'); // pool
      for (let k = 0; k < 2; k++) { const ph = (tm * 0.6 + k / 2) % 1; c.strokeStyle = `rgba(230,244,255,${0.5 * (1 - ph)})`; c.lineWidth = 0.8; c.beginPath(); c.ellipse(0, 8, 3 + ph * 10, 1 + ph * 3.5, 0, 0, 7); c.stroke(); }
      rect(c, -4.5, -17, 9, 25, '#7fb0d8');
      for (let k = -4; k <= 4; k += 1.6) { const ph = (tm * 2.4 + k * 0.37) % 1; rect(c, k, -17, 0.7, 25, `rgba(240,250,255,${0.35 + 0.25 * Math.sin(tm * 7 + k * 3)})`); ell(c, k + 0.3, -17 + ph * 25, 0.6, 1.4, 'rgba(255,255,255,.9)'); }
      for (let k = 0; k < 6; k++) { const ph = (tm * 0.9 + k / 6) % 1; ell(c, Math.sin(k * 2.1) * 6 * ph, 7 - ph * 7, 2 + ph * 3, 1.5 + ph * 2, `rgba(255,255,255,${0.45 * (1 - ph)})`); } // spray
      for (const [u, v] of [[-14, 3], [14, 4], [-10, 9], [12, -10]]) { c.strokeStyle = '#4f8a3a'; c.lineWidth = 0.8; for (let f = -2; f <= 2; f++) { c.beginPath(); c.moveTo(u, v); c.lineTo(u + f * 1.5, v - 3.5 + Math.abs(f) * 0.6); c.stroke(); } }
      pine(c, -17, -2, 0.8); pine(c, 18, -1, 0.9);
      rect(c, -12, 13, 9, 1.5, '#8a6440'); for (let u = -12; u <= -3; u += 2.2) rect(c, u, 12, 0.5, 1.5, '#6b4a2e'); // footbridge
      person(c, -7, 11.5, '#d06a9a', tm, 0.25);
      break;
    }
    case 'ranger': { // a log cabin with a porch and smoking chimney, a woodpile, a chopping stump, pines and a ranger
      grassPatch(c, 19, 9, 'rgba(90,120,60,.45)');
      pine(c, -15, -6, 1.1); pine(c, 15, -8, 1.2); pine(c, 18, 2, 0.8);
      poly(c, sh, -9, 4, 10, 4, 12, 6, -7, 6);
      rect(c, -9, -6, 18, 10, '#8a5a36');
      for (let v = -5; v < 4; v += 2) { rect(c, -9, v, 18, 1.2, '#7a4e2e'); ell(c, -9, v + 0.6, 0.8, 0.6, '#c8a070'); ell(c, 9, v + 0.6, 0.8, 0.6, '#c8a070'); }
      rect(c, -2, -1, 3.5, 5, '#4a3020'); rect(c, -7, -3, 3, 2.5, '#ffd88a'); rect(c, 4, -3, 3, 2.5, '#ffd88a'); rect(c, -5.6, -3, 0.3, 2.5, '#4a3020'); rect(c, 5.4, -3, 0.3, 2.5, '#4a3020');
      poly(c, '#4c6b3a', -11, -6, 0, -14, 11, -6); poly(c, '#3d5a2f', 0, -14, 11, -6, 6, -6); for (let u = -9; u < 10; u += 3) rect(c, u, -6.8, 1.5, 0.6, 'rgba(0,0,0,.15)');
      rect(c, 5, -14, 2.6, 6, '#6b6460'); puff(c as never, 6.3, -15, tm, false, 0.8);
      rect(c, -10, 4, 20, 1.4, '#a07a52'); for (const u of [-9, -3, 3, 9]) rect(c, u, 4, 0.7, 2.5, '#6b4a2e'); // porch
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) { ell(c, -17 + k * 2.4 + r * 1.2, 8 - r * 2, 1.2, 1.1, '#9a7048'); ell(c, -17 + k * 2.4 + r * 1.2, 8 - r * 2, 0.6, 0.5, '#d8b07a'); } // woodpile
      ell(c, 13, 9, 2.4, 1.4, '#8a6440'); ell(c, 13, 8.5, 2, 1, '#c89a68'); c.strokeStyle = '#5a5a5a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(13, 8.5); c.lineTo(15, 5.5); c.stroke();
      rect(c, 10.5, 1, 0.5, 2, '#3a3a3a'); ell(c, 10.75, 1, 1, 1, `rgba(255,210,120,${0.6 + 0.3 * Math.sin(tm * 3)})`); // lantern
      person(c, 6, 8, '#3b6b3a', tm, 0.3);
      break;
    }
    case 'mill': { // an old stone tower windmill with lattice sails, a cap, a door, sacks, a fence and a strip of wheat
      grassPatch(c, 19, 9);
      for (let k = 0; k < 7; k++) { const u = -18 + k * 2.2; c.strokeStyle = '#d8b44a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(u, 12); c.lineTo(u + Math.sin(tm * 2 + k) * 0.6, 7); c.stroke(); ell(c, u + Math.sin(tm * 2 + k) * 0.6, 6.6, 0.6, 1.2, '#e8c860'); }
      c.strokeStyle = '#8a6a48'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(8, 10); c.lineTo(20, 10); c.moveTo(8, 8); c.lineTo(20, 8); c.stroke(); for (let u = 8; u <= 20; u += 3) rect(c, u, 7, 0.6, 4, '#7a5a3a');
      ell(c, 2, 6, 9, 3, sh);
      poly(c, '#d9cdb2', -7, 5, 7, 5, 5, -16, -5, -16); poly(c, '#c2b597', 2, 5, 7, 5, 5, -16, 1.5, -16);
      for (let v = 3; v > -15; v -= 3.4) rect(c, -6.5 + (5 - v) * 0.09, v, 13 - (5 - v) * 0.18, 0.5, 'rgba(140,125,100,.4)');
      rect(c, -1.6, -1, 3.2, 6, '#5a3c22'); poly(c, '#5a3c22', -1.6, -1, 0, -2.6, 1.6, -1); rect(c, -3.5, -9, 2, 2.4, '#3a3028'); rect(c, 1.5, -12, 2, 2.4, '#3a3028');
      poly(c, '#7a4a32', -6, -16, 0, -22, 6, -16); poly(c, '#5f3826', 0, -22, 6, -16, 3, -16);
      c.save(); c.translate(0, -17); c.rotate(tm * 0.7);
      for (let k = 0; k < 4; k++) {
        c.rotate(Math.PI / 2);
        rect(c, 0, -0.6, 16, 1.2, '#6a5038');
        c.fillStyle = 'rgba(240,232,212,.92)'; c.fillRect(3, 0.6, 12, 3.6);
        c.strokeStyle = '#6a5038'; c.lineWidth = 0.35; for (let u = 3; u <= 15; u += 3) { c.beginPath(); c.moveTo(u, 0.6); c.lineTo(u, 4.2); c.stroke(); } c.beginPath(); c.moveTo(3, 2.4); c.lineTo(15, 2.4); c.stroke();
      }
      ell(c, 0, 0, 1.4, 1.4, '#3a2a1e'); c.restore();
      for (const [u, v] of [[8, 4], [10.5, 4.5], [9, 2]] as const) { ell(c, u + 0.6, v + 1.2, 1.6, 0.6, sh); ell(c, u, v, 1.5, 1.8, '#e6d8b0'); rect(c, u - 0.8, v - 1.8, 1.6, 0.5, '#b89a6a'); }
      person(c, -10, 5, '#b8603a', tm, 0.3);
      break;
    }
    case 'shaft': { // an old timber headframe over a mine shaft: a winding wheel, a spoil heap, a rusty ore cart on a bit of track, lamps
      grassPatch(c, 20, 9, 'rgba(130,115,90,.45)');
      ell(c, -12, 6, 9, 4, '#8a7d6a'); ell(c, -13, 4.5, 6.5, 3, '#9c8f7a'); for (const [u, v] of [[-16, 5], [-10, 3.5], [-13, 7], [-8, 6]]) ell(c, u, v, 1.1, 0.8, '#6e6456'); // spoil heap
      poly(c, sh, -4, 6, 12, 6, 14, 8.5, -2, 8.5);
      rect(c, -3, 3, 12, 4, '#3a2f26'); rect(c, -2, 4, 10, 2.5, '#16120e'); // the shaft mouth with a dark hole
      c.strokeStyle = '#6b4a2e'; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-2, 4); c.lineTo(3, -18); c.lineTo(8, 4); c.moveTo(0, -4); c.lineTo(6, -4); c.moveTo(1, -11); c.lineTo(5, -11); c.moveTo(-1, 0); c.lineTo(5, -11); c.stroke(); // headframe legs and braces
      c.lineCap = 'butt';
      const a = tm * 1.5; c.save(); c.translate(3, -18); // the winding wheel, turning slowly
      c.strokeStyle = '#4a4440'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.stroke();
      for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(b) * 4, Math.sin(b) * 4); c.lineTo(-Math.cos(b) * 4, -Math.sin(b) * 4); c.stroke(); }
      c.restore(); ell(c, 3, -18, 1, 1, '#2e2a26');
      c.strokeStyle = 'rgba(60,55,50,.9)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(3, -14); c.lineTo(3, 4); c.stroke(); // the rope down the shaft
      for (const u of [10, 14, 18, 22]) rect(c, u - 1, 9.5, 0.8, 2.6, '#6b4a2e'); rect(c, 9, 10, 14, 0.5, '#7a7570'); rect(c, 9, 11.5, 14, 0.5, '#7a7570'); // a stub of track
      poly(c, '#8a4f2c', 12, 5, 19, 5, 18, 9, 13, 9); poly(c, '#6e3d22', 12, 5, 19, 5, 19, 6, 12, 6); ell(c, 14, 9.6, 1, 1, '#2e2a26'); ell(c, 17.5, 9.6, 1, 1, '#2e2a26'); // ore cart
      for (const [u, v] of [[14, 4.4], [16, 4], [17.6, 4.5]]) ell(c, u, v, 1.3, 1, '#4a4a52');
      rect(c, -5, -1, 0.5, 3, '#3a3a3a'); ell(c, -4.75, -1.2, 1, 1, `rgba(255,210,120,${0.6 + 0.3 * Math.sin(tm * 3)})`); // lamp
      pine(c, 19, -3, 0.8); bush(c, -19, -1, 2.6, '#6e8a4c');
      person(c, 9, 13, '#5a5a6a', tm, 0.25);
      break;
    }
    case 'camp': { // an explorer's camp: a canvas tent, a camp fire with smoke, a map table with a spyglass, crates and a flag
      grassPatch(c, 20, 9, 'rgba(120,140,80,.45)');
      poly(c, sh, -14, 5, 3, 5, 5, 8, -12, 8);
      poly(c, '#e8dcc0', -15, 5, -6, -10, 3, 5); poly(c, '#cfc2a2', -6, -10, 3, 5, -2, 5); // tent
      poly(c, '#5a4630', -9, 5, -6, -3, -3, 5); // its open door
      c.strokeStyle = '#8a7a5a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-6, -10); c.lineTo(-18, 7); c.moveTo(-6, -10); c.lineTo(6, 7); c.stroke(); // guy ropes
      rect(c, -6.3, -15, 0.6, 6, '#6b4a2e'); const f = Math.sin(tm * 4) * 0.8; poly(c, '#c0392b', -5.7, -15, 0.5, -14 + f, -5.7, -12); // flag
      for (const [u, v, w] of [[8, 0, 5], [12, 1, 4]] as const) { ell(c, u + 1, v + 4, w / 2 + 1, 1, sh); rect(c, u - w / 2, v, w, 3.5, '#a07a4a'); rect(c, u - w / 2, v, w, 0.7, '#c49a64'); rect(c, u - 0.2, v, 0.4, 3.5, '#6b4a2e'); } // crates
      rect(c, 6, 6, 9, 0.8, '#7a5a3a'); rect(c, 7, 6.8, 0.6, 3, '#5a3c22'); rect(c, 13.4, 6.8, 0.6, 3, '#5a3c22'); // map table
      rect(c, 7, 4.8, 6, 1.4, '#efe2be'); c.strokeStyle = 'rgba(160,90,50,.8)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(7.5, 5.8); c.lineTo(9.5, 5.2); c.lineTo(12, 5.6); c.stroke(); // the map on it
      rect(c, 12.6, 4.4, 3, 0.6, '#b8902a');
      for (let k = 0; k < 5; k++) ell(c, -1 + Math.cos(k * 1.26) * 2.6, 11 + Math.sin(k * 1.26) * 1.2, 0.9, 0.6, '#7a7068'); // fire ring
      const fl = 0.8 + 0.2 * Math.sin(tm * 9); poly(c, '#e8742a', -2.2, 11, -1, 11 - 3 * fl, 0.2, 11); poly(c, '#ffd25a', -1.6, 11, -1, 11 - 1.8 * fl, -0.4, 11);
      puff(c as never, -1, 7, tm, false, 0.6);
      person(c, 4, 12, '#6a7a3a', tm, 0.25); person(c, 16, 10, '#8a5a3a', tm, 0.2);
      pine(c, 20, -4, 0.9); bush(c, -19, 2, 3, '#5f8a44');
      break;
    }
  }
}
