// Prints every trip a train plans on a save: job, from, to, length and the squares it runs over.
// Usage: npx vite-node tools/route-watch.ts save.json seconds [trainId|good]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { isRev } from '../src/track/route.ts';

const [file = '', secs = '300', who = ''] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
const seen = new Map<number, string>();
const want = (t: Game['s']['trains'][number]) => !who || String(t.id) === who || t.job?.good === who;
for (let s = 0; s < +secs * 20; s++) {
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    if (!want(t) || t.dest === undefined || !t.plan.length) continue;
    const key = `${t.job?.phase}/${t.dest}`;
    if (seen.get(t.id) === key) continue;
    seen.set(t.id, key);
    let len = 0; const sqs: string[] = []; let last = '';
    for (const m of t.plan) { if (isRev(m)) { sqs.push('⟲'); continue; } len += g.net.pieces[m.piece]!.len; const q = xy(g.net.pieces[m.piece]!.squares[0]!); if (q !== last) sqs.push(q); last = q; }
    const head = xy(g.net.pieces[t.trail.at(-1)!.piece]!.squares[0]!);
    console.log(`${g.s.t.toFixed(0)}s train ${t.id} ${t.job?.good} ${t.job?.phase} src ${t.job?.src} to ${JSON.stringify(t.job?.to)} from ${head} → ${xy(t.dest)} len ${(len / 32).toFixed(1)} sq engineAhead ${t.engineAhead}\n   ${sqs.join(' ')}`);
  }
}
