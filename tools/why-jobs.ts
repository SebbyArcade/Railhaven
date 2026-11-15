// Prints each phase change of train T: job source, destination, the shipping plan and the last pay.
// Usage: npx vite-node tools/why-jobs.ts save.json trainId seconds
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';

const [file = '', id = '3', secs = '120'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
let last = '';
for (let s = 0; s < +secs * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  const t = g.s.trains.find(x => x.id === +id)!, j = t.job;
  const k = `${j?.phase}:${j?.src}->${j?.to?.kind}${j?.to?.id}`;
  if (k === last) continue;
  last = k;
  const plan = [...shipPlan(g)].map(([b, p]) => `${b}>${p.to.id}:${p.why}`).join(' ');
  const lp = t.lastPay ? `last ${t.lastPay.pay} ${t.lastPay.good}>${t.lastPay.to.id}` : '';
  console.log((s / 20).toFixed(1), k, '| plan', plan, '|', lp);
}
