// Why trains turn back partway along a trip: runs a save with the full game tick and counts every reversal that is
// not at a stop, by what gave the train the plan it was following. Also earnings over the run.
// Usage: npx vite-node tools/turnback-stats.ts save.json minutes [examples]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';
import { isRev } from '../src/track/route.ts';
import { TrainSystem, trainLength } from '../src/trains/train.ts';

const [file = '', mins = '30', ex = '0'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
type T = any;
let seq = 0;
const P = TrainSystem.prototype as any;
for (const name of ['sendTo', 'unstick', 'untangle', 'tryHold', 'reverse', 'runRound', 'aside', 'move']) {
  const f = P[name];
  P[name] = function (this: TrainSystem, ...a: unknown[]) {
    const at = ++seq, before = this.trains.map(t => t.plan);
    let caller = '';
    if (name === 'sendTo') { const st = new Error().stack!.split('\n'); caller = (st.slice(2).find(l => !/train\.ts|turnback-stats/.test(l)) ?? '').replace(/.*\/(src|tools)\//, '').replace(/:\d+\)?$/, '').trim(); }
    const r = f.apply(this, a);
    this.trains.forEach((t: T, k) => { if (t.plan !== before[k] && (t.__at ?? 0) < at) { t.__at = ++seq; t.__why = name === 'sendTo' ? `sendTo<${caller}>` : name; t.__moving = t.v; } });
    return r;
  };
}
const why = new Map<string, number>(); let total = 0, shown = 0;
const origRev = P.reverse;
P.reverse = function (this: TrainSystem, t: T) {
  const m = t.plan[0];
  if (t.dest !== undefined && m && isRev(m)) {
    let left = 0; for (const x of t.plan) if (!isRev(x)) left += this.net.pieces[x.piece]!.len;
    const stop = m.clear === null && String(t.__why).startsWith('sendTo<economy/dispatch') && t.__moving < 0.5;
    if (!stop && left > trainLength(t) * 2 + 4 * 32) {
      const k = `${t.__why} clear=${m.clear === null ? 'now' : m.clear === 'end' ? 'end' : 'jn'}`;
      why.set(k, (why.get(k) ?? 0) + 1); total++;
      if (shown++ < +ex) console.log(`${(g.s.t / 60).toFixed(1)}m train ${t.id} ${t.job?.phase} ${k} at ${xy(this.net.pieces[t.trail.at(-1)!.piece]!.squares[0]!)} dest ${xy(t.dest)} left ${Math.round(left / 32)}sq`);
    }
  }
  return origRev.call(this, t);
};
const e0 = (g.s as any).earned ?? 0, m0 = g.s.money, l0 = g.s.loads ?? 0, o0 = g.s.orders ?? 0;
const t0 = Date.now();
for (let s = 0; s < +mins * 60 * 20; s++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g); }
console.log(`${file}: ${mins} min, ${g.s.trains.length} trains, turn-backs ${total} (${(total / +mins * 60).toFixed(0)}/h), earned $${Math.round(((g.s as any).earned ?? 0) - e0)} money ${Math.round(m0)}→${Math.round(g.s.money)} loads ${(g.s.loads ?? 0) - l0} orders ${(g.s.orders ?? 0) - o0} untangled ${g.sys.untangled} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (process.env.NEWS) for (const m of g.news ?? []) if (/✅|🤝|⭐/u.test(m)) console.log("  news", m);
for (const [k, v] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  ${v}  ${k}`);
