// How much trains hold each other up. Loads a save (or makes one with the bot), optionally doubles all open-line track and
// adds trains, runs it and reports time spent held up, step-asides and mid-trip reversals.
// Usage: npx vite-node tools/jam-run.ts save.json minutes [double=1] [trains=6]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import type { Game } from '../src/state.ts';
import { trackChanged } from '../src/game.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { buyTrain, tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { yardSquares } from '../src/buildings/industries.ts';
import { isRev } from '../src/track/route.ts';
import { passingLoop } from '../src/track/loops.ts';

const [file = '', min = '10', dbl = '1', want = '6'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = (raw.includes('"version":') ? loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage) : null) ?? importLegacy(await decodeLegacy(raw)).g as Game; // his old-game saves are imported
if (want !== '0') g.s.money = Math.max(g.s.money, 1e5);
if (dbl === '1') {
  const yard = new Set<number>(); for (const b of g.s.buildings ?? []) for (const i of yardSquares(g.world.n, b)) yard.add(i);
  for (const [i, s] of g.track) if (!yard.has(i)) s.dbl = true;
  trackChanged(g);
}
// LOOPS="x,y;x,y": add passing loops there first (as a tap in Double mode would)
for (const xy of (process.env.LOOPS ?? '').split(';').filter(Boolean)) {
  const [x, y] = xy.split(',').map(Number), l = passingLoop(g, y! * g.world.n + x!);
  if (typeof l === 'string') console.log('loop', xy, l); else { for (const i of l) g.track.get(i)!.dbl = true; trackChanged(g); console.log('loop', xy, l.length, 'squares'); }
}
while (g.s.trains.length < +want) { const t = buyTrain(g); if (typeof t === 'string') { console.log('buy', t); break; } }
let held = 0, moving = 0, asides = 0, midRev = 0, faceoff = 0;
/** whom a stopped train waits for: the holder of the first piece it could not clear */
const waitsOn = (t: any): number | undefined => {
  let c = 0; for (const m of t.plan) { if (isRev(m)) return; if (c++ < t.held) continue;
    for (const q of [m.piece, ...g.net.conflicts[m.piece]!]) { const h = (g.sys as any).holder.get(q); if (h !== undefined && h !== t.id) return h; }
    return; }
};
const was = g.sys.onMidReverse; g.sys.onMidReverse = (t, sq) => { midRev++; was?.(t, sq); };
const ref = new Map<number, boolean>();
const e0 = g.s.earned ?? 0;
const stuck = new Map<number, number>();
for (let s = 0; s < +min * 60; s++) {
  for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
  if (s % 5 === 0) checkStuck(g);
  const w = new Map<number, number | undefined>(); for (const t of g.s.trains) if (t.v < 0.5 && t.plan.length) w.set(t.id, waitsOn(t));
  for (const [a, b] of w) if (b !== undefined && w.get(b) === a) faceoff++;
  for (const t of g.s.trains) {
    const j = t.job, travelling = j && (j.phase === 'toLoad' || j.phase === 'toDrop');
    if (travelling) { moving++; if (t.v < 0.5 && t.pause <= 0 && !t.broke && !t.rr) { held++; stuck.set(t.id, (stuck.get(t.id) ?? 0) + 1); } }
    const r = t.refuge !== undefined; if (r && !ref.get(t.id)) asides++; ref.set(t.id, r);
  }
}
console.log(`${file.split('/').pop()} double=${dbl} trains=${g.s.trains.length} ${min} min: held ${(100 * held / Math.max(1, moving)).toFixed(1)}% of travel time · step-asides ${asides} · mid-trip reversals ${midRev} · face-off s ${faceoff} · earned +$${Math.round((g.s.earned ?? 0) - e0)}`);
console.log('  held seconds per train', JSON.stringify(Object.fromEntries(stuck)));
