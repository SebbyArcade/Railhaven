// Every loading/unloading stop on a save: is the whole train on the plain platform or loading track, or does part
// of it hang on a switch (fan) or outside the hall/yard? Usage: npx vite-node tools/stop-check.ts save.json [secs]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { trainLength } from '../src/trains/train.ts';

const [file = '', secs = '600'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, sq = (i: number) => `${i % n},${Math.floor(i / n)}`;
const seen = new Set<string>(), lastArea = new Map<number, number[]>(); let stops = 0, bad = 0;
for (let s = 0; s < +secs * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    if (t.area) lastArea.set(t.id, t.area);
    const ph = t.job?.phase, A = lastArea.get(t.id); if ((ph !== "loading" && ph !== "unloading") || !A || t.v > 0) continue;
    const key = `${t.id}/${t.job!.timer > 0 ? Math.round(g.s.t / 30) : ''}/${A[0]}`; if (seen.has(key)) continue; seen.add(key); stops++;
    const area = new Set(A), pcs = t.trail.map(st => g.net.pieces[st.piece]!);
    const fan = pcs.filter(p => p.kind === 'fan').length, out = pcs.filter(p => !p.squares.every(q => area.has(q))).length;
    if (fan || out) { bad++; if (process.env.V) console.log(`t${t.id} ${ph} area ${sq(A[0]!)}..${sq(A.at(-1)!)} (${A.length} sq) len ${trainLength(t)} kinds ${pcs.map(p => p.kind).join(',')} fan ${fan} out ${out}`); }
  }
}
console.log(`${file.split('/').pop()}: ${stops} stops, ${bad} with wagons on a switch or outside`);
