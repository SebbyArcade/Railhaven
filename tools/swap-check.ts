// Finds crossed supply in the shipping plan: two makers of the same good where swapping their destinations would
// shorten both trips together (e.g. a full farm beside a mill ships far away while a far farm feeds the mill).
// Usage: npx vite-node tools/swap-check.ts save.json [seconds]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { bldDist, bldOf, destSquares, goodOf, shipPlan } from '../src/economy/shipping.ts';

const [file = '', secs = '600'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const name = (to: { kind: string; id: number }) => to.kind === 'town' ? g.s.sites.find(t => t.id === to.id)?.name : `${bldOf(g, to.id)?.kind}#${to.id}`;
const seen = new Set<string>();
let checks = 0, crossed = 0;
for (let s = 0; s <= +secs * 20; s++) {
  if (s % 200 === 0) { // every 10 s
    checks++;
    const plan = [...shipPlan(g).entries()].filter(([, p]) => p.sea === undefined);
    for (const [a, pa] of plan) for (const [b, pb] of plan) {
      if (a >= b) continue;
      const A = bldOf(g, a)!, B = bldOf(g, b)!; if (goodOf(A) !== goodOf(B)) continue;
      const dA = bldDist(g, A), dB = bldDist(g, B);
      const ab = dA[destSquares(g, pb.to)[1] ?? destSquares(g, pb.to)[0]!]!, ba = dB[destSquares(g, pa.to)[1] ?? destSquares(g, pa.to)[0]!]!;
      if (ab < 0 || ba < 0) continue;
      const gain = pa.d + pb.d - ab - ba; if (gain < 8) continue;
      crossed++;
      const k = `${a}/${b}/${pa.to.kind}${pa.to.id}/${pb.to.kind}${pb.to.id}`; if (seen.has(k)) continue; seen.add(k);
      console.log(`${g.s.t.toFixed(0)}s ${A.kind}#${a} (stock ${Math.round(A.stock)}) → ${name(pa.to)} ${pa.d} sq (${pa.why}) and ${B.kind}#${b} (stock ${Math.round(B.stock)}) → ${name(pb.to)} ${pb.d} sq (${pb.why}); swapped: ${ab} + ${ba}, saves ${gain} sq`);
    }
  }
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
}
console.log(`plans checked ${checks} · crossed pairs seen ${crossed}`);
