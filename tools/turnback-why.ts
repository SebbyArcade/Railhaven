// Each time a train turns back partway on a save: where, its job, the squares just behind it and the route ahead.
// Usage: npx vite-node tools/turnback-why.ts save.json seconds [x,y to watch]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { isRev } from '../src/track/route.ts';

const [file = '', secs = '600', watch] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
const was = g.sys.onMidReverse;
g.sys.onMidReverse = (t, sq) => {
  was?.(t, sq);
  if (watch && xy(sq) !== watch) return;
  const back = t.trail.slice(-6).map(s => xy(g.net.pieces[s.piece]!.squares[0]!)).join(' ');
  const ahead = t.plan.slice(0, 14).map(m => isRev(m) ? '⟲' : xy(g.net.pieces[m.piece]!.squares[0]!)).join(' ');
  console.log(`${g.s.t.toFixed(0)} train ${t.id} ${t.job?.phase} ${t.job?.good} dest ${t.dest !== undefined ? xy(t.dest) : '-'} refuge ${t.refuge ?? '-'} at ${xy(sq)}\n   behind: ${back}\n   ahead: ${ahead}`);
};
for (let s = 0; s < +secs * 20; s++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
