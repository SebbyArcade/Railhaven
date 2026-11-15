// Traces trains on a save: every N seconds, where each train is, its phase and speed, and who holds the piece it waits for.
// Usage: npx vite-node tools/jam-trace.ts save.json seconds [every=2]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { isRev } from '../src/track/route.ts';

const [file = '', secs = '120', every = '2'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
const sys = g.sys as any;
let revs = 0; const was = g.sys.onMidReverse; g.sys.onMidReverse = (t, sq) => { revs++; console.log(`   ↩ T${t.id} reverses mid-trip at ${xy(sq)}`); was?.(t, sq); };
for (let s = 0; s < +secs; s++) {
  for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
  if (s % 5 === 0) checkStuck(g);
  if (s % +every) continue;
  const row = g.s.trains.map(t => {
    const head = t.trail.at(-1)!, p = g.net.pieces[head.piece]!, side = g.net.side[head.piece]! * head.dir;
    let wait = '';
    if (t.v < 0.5 && t.job && (t.job.phase === 'toLoad' || t.job.phase === 'toDrop')) {
      let c = 0; for (const m of t.plan) { if (isRev(m)) { wait = 'rev'; break; } if (c++ < t.held) continue;
        const hs = [m.piece, ...g.net.conflicts[m.piece]!].map(q => sys.holder.get(q)).filter((h: number | undefined) => h !== undefined && h !== t.id);
        wait = hs.length ? `waits T${hs[0]}` : 'free?'; break; }
    }
    return `T${t.id} ${t.job?.phase ?? 'idle'}@${xy(p.squares[0]!)}${side > 0 ? '(L)' : side < 0 ? '(R)' : ''} v${t.v.toFixed(0)} ${wait}${t.refuge !== undefined ? ' aside' : ''}`;
  });
  console.log(String(s).padStart(4), row.join(' | '));
}
console.log('mid-trip reversals', revs);
