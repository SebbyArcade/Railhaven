// Plays a save with frequent fires and broken rails and saves the first moments where a train waits behind a crew car
// and where a crew stands beside the rails letting a train by, printing the world point to centre a picture on.
// Usage: npx vite-node tools/crew-wait-moments.ts save.json outPrefix
import fs from 'node:fs';
import { loadFrom, saveJson } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';
import { crewPoint, type CrewRun, runDist } from '../src/world/crews.ts';
import { bodyPoint } from '../src/trains/train.ts';

const [file = '', out = 'crewwait'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
const runs = (): CrewRun[] => [
  ...(g.s.buildings ?? []).filter(b => b.fire?.run && g.s.t < b.fire.doneAt).map(b => b.fire!.run!),
  ...(g.s.breaks ?? []).filter(b => b.run).map(b => b.run!), ...(g.s.crews ?? [])];
const got = new Set<string>();
for (let s = 0; s < 20 * 60 && got.size < 2; s++) {
  if (s % 45 === 0) g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: g.s.t };
  if (s % 60 === 30 && breakRail(g)) breaksChanged(g);
  for (let k = 0; k < 20; k++) {
    const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
    if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g);
    for (const r of runs()) {
      if (runDist(r, g.s.t) >= r.len - 1 || g.s.t < r.t0) continue;
      const p = crewPoint(g, r, g.s.t)!;
      const near = g.s.trains.find(t => t.trail.length && Math.hypot(bodyPoint(g.net, t, 0).x - p.x, bodyPoint(g.net, t, 0).y - p.y) < 40);
      if (!near) continue;
      const kind = r.off !== undefined ? 'aside' : Math.abs(near.v) < 1 && near.plan.some(m => !('rev' in m) && g.sys.crew.has(m.piece)) ? 'behind' : '';
      if (kind && !got.has(kind) && (kind !== 'aside' || r.off! > 1)) {
        got.add(kind); fs.writeFileSync(`${out}-${kind}.json`, saveJson(g));
        const h = bodyPoint(g.net, near, 0); console.log(kind, ((p.x + h.x) / 2).toFixed(0), ((p.y + h.y) / 2).toFixed(0));
      }
    }
  }
}
