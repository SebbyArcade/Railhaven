// How often a train's trip passes another whole job an order waits for (its load and its drop both near the way).
// Empty run: the train heads to its load; a job on the way = load B, drop it, then carry on to the load.
// Loaded run: the train carries its load; a job on the way would need a second good aboard.
// Usage: npx vite-node tools/way-jobs.ts save.json seconds
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { headSquare, tickTrains } from '../src/economy/dispatch.ts';
import { bldDist, bldOf, destSquares, railDist, shipPlan } from '../src/economy/shipping.ts';
import { yardSquares } from '../src/buildings/industries.ts';

const [file = '', secs = '600'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n;
const dDest = (to: { kind: 'town' | 'bld'; id: number }) => railDist(g, `w${to.kind}${to.id}`, destSquares(g, to));
let trips = 0, emptyHit = 0, loadedHit = 0, emptySq = 0, savedSq = 0;
for (let s = 0; s < +secs * 20; s++) {
  const before = new Map(g.s.trains.map(t => [t.id, t.job ? `${t.job.src}/${t.job.phase}` : '']));
  const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
  for (const t of g.s.trains) {
    const j = t.job; if (!j) continue;
    const was = before.get(t.id);
    const plan = () => [...shipPlan(g, t).entries()].filter(([, p]) => p.why === 'order' || p.feeds);
    if (j.phase === 'toLoad' && was !== `${j.src}/toLoad`) { // a new job: the empty run
      const src = bldOf(g, j.src); if (!src) continue;
      const at = headSquare(g, t), toSrc = bldDist(g, src), direct = toSrc[at]!; if (direct < 12) continue;
      trips++; emptySq += direct;
      let best = Infinity, what = '';
      for (const [sk, p] of plan()) {
        const b2 = bldOf(g, +sk); if (!b2 || b2.id === src.id || b2.stock < 10) continue;
        const a = bldDist(g, b2)[at]!, c = toSrc[destSquares(g, p.to)[0]!]!; if (a < 0 || c < 0) continue;
        const extra = a + p.d + c - direct; if (extra < best) { best = extra; what = `${b2.kind}#${b2.id}→${p.to.kind}${p.to.id} (${a}+${p.d}+${c} vs ${direct})`; }
      }
      if (process.env.ALL) console.log(`E best ${best} direct ${direct} ${what}`);
      if (best <= Math.max(4, direct * 0.2)) { emptyHit++; savedSq += a0(best, direct); console.log(`${g.s.t.toFixed(0)} train ${t.id} empty ${direct} sq: on the way ${what}, +${best}`); }
    }
    if (j.phase === 'toDrop' && was === `${j.src}/loading` && t.cargo) { // just loaded
      const src = bldOf(g, j.src)!, fromSrc = bldDist(g, src), toD = dDest(j.to), direct = t.cargo.d; if (direct < 12) continue;
      let best = Infinity, what = '';
      for (const [sk, p] of plan()) {
        const b2 = bldOf(g, +sk); if (!b2 || b2.id === src.id || b2.stock < 10 || p.to.kind === j.to.kind && p.to.id === j.to.id && b2.kind === src.kind) continue;
        const a = fromSrc[yardSquares(n, b2)[1]!]!, c = toD[destSquares(g, p.to)[0]!]!; if (a < 0 || c < 0) continue;
        const extra = a + p.d + c - direct; if (extra < best) { best = extra; what = `${b2.kind}#${b2.id}→${p.to.kind}${p.to.id}`; }
      }
      if (process.env.ALL) console.log(`L best ${best} direct ${direct} ${what}`);
      if (best <= Math.max(4, direct * 0.2)) { loadedHit++; console.log(`${g.s.t.toFixed(0)} train ${t.id} loaded ${direct} sq ${t.cargo.good}: could also carry ${what}, +${best}`); }
    }
  }
}
function a0(extra: number, direct: number) { return Math.max(0, direct - extra); }
console.log(`empty runs >=12 sq: ${trips} (${emptySq} sq) · a whole job on the way: ${emptyHit} · loaded trips with a second job on the way: ${loadedHit}`);
