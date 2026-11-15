// Runs a save until a train reaches a phase (loading/unloading) with its head on a square, then writes the game
// to a save file (for tools/save-shot.mjs). Usage: npx vite-node tools/run-until.ts save.json phase "x,y" out.json [max seconds]
import fs from 'node:fs';
import { loadFrom, saveJson } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { headSquare, tickTrains } from '../src/economy/dispatch.ts';

const [file = '', phase = 'loading', at = '', out = 'run.json', max = '300'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, [x, y] = at.split(',').map(Number), near = (i: number) => Math.abs(i % n - x!) <= 3 && Math.abs(((i / n) | 0) - y!) <= 3;
for (let s = 0; s < +max * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  const t = g.s.trains.find(q => q.job?.phase === phase && near(headSquare(g, q)));
  if (t) { fs.writeFileSync(out, saveJson(g)); console.log(`T${t.id} ${phase} at ${headSquare(g, t) % n},${(headSquare(g, t) / n) | 0} after ${(s / 20).toFixed(1)} s`); process.exit(0); }
}
console.log('not reached');
