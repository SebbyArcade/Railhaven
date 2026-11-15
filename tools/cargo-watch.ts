// Watches every train's load on a save: reports a load that vanishes or changes without a delivery being paid.
// Usage: npx vite-node tools/cargo-watch.ts save.json trains minutes
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { buyTrain, headSquare, tickTrains } from '../src/economy/dispatch.ts';

const [file = '', want = '3', min = '15'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
g.s.money = Math.max(g.s.money, 5e4);
const was = new Map<number, { good: string; n: number; paid: number; phase?: string }>();
let bad = 0;
for (let s = 0; s < +min * 60 * 20; s++) {
  if (g.s.trains.length < +want && s % 40 === 0) buyTrain(g);
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    const w = was.get(t.id), paid = t.lastPay?.at ?? -1;
    if (w && paid === w.paid && (!t.cargo || t.cargo.good !== w.good)) {
      bad++; console.log(`${(g.s.t / 60).toFixed(1)} min T${t.id}: ${w.n} ${w.good} (${w.phase}) -> ${t.cargo ? t.cargo.n + ' ' + t.cargo.good : 'nothing'} (${t.job?.phase ?? 'no job'}) at ${xy(headSquare(g, t))}, no delivery paid`);
    }
    if (t.cargo) was.set(t.id, { good: t.cargo.good, n: t.cargo.n, paid, phase: t.job?.phase }); else was.delete(t.id);
  }
}
console.log(`${file}: ${bad} lost loads in ${min} min with ${g.s.trains.length} trains`);
