// Where trains wait on a save: buys trains up to N, runs M minutes, and counts held seconds by the square the
// blocking train's head stands on and its phase. Usage: npx vite-node tools/wait-where.ts save.json trains minutes
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { buyTrain, headSquare, tickTrains } from '../src/economy/dispatch.ts';
import { isRev } from '../src/track/route.ts';

const [file = '', want = '2', min = '10'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`, sys = g.sys as any;
g.s.money = 1e5;
const by = new Map<string, number>();
let held = 0, total = 0;
for (let s = 0; s < +min * 60 * 20; s++) {
  if (g.s.trains.length < +want && s % 40 === 0) buyTrain(g);
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    const j = t.job; if (!j || (j.phase !== 'toLoad' && j.phase !== 'toDrop')) continue;
    total += dt; if (t.v > 0.5 || !t.plan.length) continue;
    let c = 0, who: number | undefined;
    for (const m of t.plan) { if (isRev(m)) break; if (c++ < t.held) continue; who = [m.piece, ...g.net.conflicts[m.piece]!].map(q => sys.holder.get(q)).find((h: number | undefined) => h !== undefined && h !== t.id); break; }
    if (who === undefined) continue;
    held += dt;
    const o = g.s.trains.find(x => x.id === who)!, k = `${o.job?.phase ?? 'idle'} at ${xy(headSquare(g, o))}`;
    by.set(k, (by.get(k) ?? 0) + dt);
  }
}
console.log(`trains ${g.s.trains.length}: held ${(100 * held / total).toFixed(1)}% · earned $${Math.round(g.s.earned ?? 0)}`);
for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${v.toFixed(0)} s waiting for a train ${k}`);
