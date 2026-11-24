// Every loading/unloading stop on a save: is the whole train on the plain platform or loading track, or does part
// of it hang on a switch (fan) or outside the hall/yard? And does it stand in the middle (free track ahead vs behind)? Usage: npx vite-node tools/stop-check.ts save.json [secs]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { trainLength } from '../src/trains/train.ts';
import { nextSteps } from '../src/track/network.ts';
import type { Step } from '../src/track/types.ts';

const [file = '', secs = '600'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, sq = (i: number) => `${i % n},${Math.floor(i / n)}`;
const seen = new Set<string>(), lastArea = new Map<number, number[]>(); let stops = 0, bad = 0; const offs: number[] = [];
for (let s = 0; s < +secs * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    if (t.area) lastArea.set(t.id, t.area);
    const ph = t.job?.phase, A = lastArea.get(t.id); if ((ph !== "loading" && ph !== "unloading") || !A || t.v > 0) continue;
    const key = `${t.id}/${t.job!.timer > 0 ? Math.round(g.s.t / 30) : ''}/${A[0]}`; if (seen.has(key)) continue; seen.add(key); stops++;
    const area = new Set(A), pcs = t.trail.map(st => g.net.pieces[st.piece]!);
    const fan = pcs.filter(p => p.kind === 'fan').length, out = pcs.filter(p => !p.squares.every(q => area.has(q))).length;
    // plain track left free ahead of the head and behind the tail, inside the area
    const plainIn = (st: Step) => { const p = g.net.pieces[st.piece]!; return p.kind !== 'fan' && p.squares.every(q => area.has(q)); };
    const rv = (st: Step): Step => ({ piece: st.piece, dir: st.dir === 1 ? -1 : 1 }), L = (st: Step) => g.net.pieces[st.piece]!.len;
    const free = (from: Step, d: number) => { let c = from; for (let k = 0; k < 40; k++) { const nx = nextSteps(g.net, c).filter(plainIn); if (nx.length !== 1) break; c = nx[0]!; d += L(c); } return d; };
    const head = t.trail.at(-1)!, tail = t.trail[0]!;
    const ahead = plainIn(head) ? free(head, L(head) - t.headS) : 0, behind = plainIn(tail) ? free(rv(tail), t.tailS) : 0;
    offs.push(Math.abs(ahead - behind));
    if (process.env.V) console.log(`t${t.id} ${ph} free ahead ${ahead.toFixed(0)} behind ${behind.toFixed(0)} len ${trainLength(t)}`);
    if (fan || out) { bad++; if (process.env.V) console.log(`t${t.id} ${ph} area ${sq(A[0]!)}..${sq(A.at(-1)!)} (${A.length} sq) len ${trainLength(t)} kinds ${pcs.map(p => p.kind).join(',')} fan ${fan} out ${out}`); }
  }
}
const off = offs.sort((a, b) => a - b), cen = off.filter(x => x <= 4).length;
console.log(`${file.split('/').pop()}: ${stops} stops, ${bad} with wagons on a switch or outside; ${cen} centred (within 2 px), median off-centre ${(off[off.length >> 1] ?? 0).toFixed(0)} px`);
