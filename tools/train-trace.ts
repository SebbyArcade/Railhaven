// Follows one train on a save: every few seconds, where its head is, its job, speed, wait, and why it re-plans
// (step aside, new route). Usage: npx vite-node tools/train-trace.ts save.json trainId fromSec toSec
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';

const [file = '', id = '1', from = '0', to = '120'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, sq = (i: number) => `${i % n},${Math.floor(i / n)}`;
const t0 = g.s.t;
let lastPlan = '';
for (let s = 0; s < +to * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  const t = g.s.trains.find(x => x.id === +id); if (!t) break;
  const at = (g.s.t - t0);
  if (at < +from) continue;
  const head = g.net.pieces[t.trail.at(-1)!.piece]!.squares[0]!;
  const end = t.plan.filter(m => !('rev' in m)).at(-1) as { piece: number } | undefined;
  const planKey = `${t.plan.length && end ? sq(g.net.pieces[end.piece]!.squares.at(-1)!) : '-'}/${t.refuge ?? ''}/${t.dest ?? ''}`;
  if (planKey !== lastPlan || s % 60 === 0) {
    const blockers = g.s.trains.filter(o => o !== t && o.trail.some(st => t.plan.slice(0, 6).some(m => 'piece' in m && m.piece === st.piece))).map(o => o.id);
    console.log(`${at.toFixed(1)}s head ${sq(head)} ${t.job?.phase ?? '-'} v${t.v.toFixed(0)} wait${t.wait.toFixed(1)} plan ${t.plan.length} → ${planKey}${t.refuge !== undefined ? ' REFUGE' : ''}${blockers.length ? ' blocked by ' + blockers.join(',') : ''}`);
    lastPlan = planKey;
  }
}
