// Prints a train's planned moves (squares, lanes, reversals) each time it starts a new trip on a save.
// Usage: npx vite-node tools/plan-dump.ts save.json trainId seconds
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { isRev } from '../src/track/route.ts';

const [file = '', id = '5', secs = '60'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
let last = '';
for (let s = 0; s < +secs * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  const t = g.s.trains.find(x => x.id === +id)!;
  const key = `${t.job?.phase}:${t.dest}`;
  if (key !== last && t.plan.length) {
    last = key;
    const sq = t.plan.map(m => isRev(m) ? `⟲${m.clear === null ? 'now' : ''}` : xy(g.net.pieces[m.piece]!.squares[0]!) + (g.net.side[m.piece]! * m.dir > 0 ? 'L' : ''));
    console.log(`${(s / 20).toFixed(1)}s ${key} engineAhead=${t.engineAhead} head=${xy(g.net.pieces[t.trail.at(-1)!.piece]!.squares[0]!)} tail=${xy(g.net.pieces[t.trail[0]!.piece]!.squares[0]!)}\n   ${sq.join(' ')}`);
  }
}
