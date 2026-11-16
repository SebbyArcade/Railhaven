// A plain line west of Ashford with one train and a repair handcar: saves the moment the train waits behind the
// handcar, and the moment the handcar stands beside the rails letting the train by. Prints the point to centre on.
// Usage: npx vite-node tools/crew-line-moments.ts outPrefix
import fs from 'node:fs';
import { newGame, trackChanged } from '../src/game.ts';
import { saveJson } from '../src/save/save.ts';
import { buildPlan, extendPlan, startPlan } from '../src/track/paint.ts';
import { bodyPoint, placeTrain } from '../src/trains/train.ts';
import { crewPoint, crewRun, moveCrews, railPath } from '../src/world/crews.ts';

const [out = 'shots/crewline'] = process.argv.slice(2);
for (const kind of ['behind', 'aside'] as const) {
  const g = newGame(4242); g.s.money = 1e6; g.s.fog.fill(255);
  const n = g.world.n, a = g.s.sites[0]!, at = (k: number) => a.y * n + a.x - k;
  const p = startPlan(g, at(0))!; extendPlan(g, p, at(18)); buildPlan(g, p); trackChanged(g);
  let far = 8; while (g.track.has(at(far + 1))) far++;
  const id = g.net.bySquare.get(at(3))!.find(i => g.net.pieces[i]!.squares.length === 1)!;
  const t = placeTrain(g.net, 1, { piece: id, dir: g.net.pieces[id]!.ta[0] > 0 ? 1 : -1 }, 3);
  g.s.trains.push(t); g.sys.rebuildHolds();
  const r = kind === 'behind' ? crewRun(g, 'repair', railPath(g, [at(7)], [at(far)]), g.s.t)! : crewRun(g, 'repair', railPath(g, [at(far - 1)], [at(1)]), g.s.t)!;
  (g.s.crews ??= []).push(r);
  g.sys.sendTo(t, at(far));
  for (let k = 0; k < 20 * 60; k++) {
    g.s.t += 0.05; g.sys.tick(0.05); moveCrews(g, 0.05);
    const ok = kind === 'behind' ? t.plan.length > 0 && Math.abs(t.v) < 0.5 && k > 100 && Math.hypot(bodyPoint(g.net, t, 0).x - crewPoint(g, r, g.s.t)!.x, bodyPoint(g.net, t, 0).y - crewPoint(g, r, g.s.t)!.y) < 150 : r.off !== undefined && Math.abs(t.v) > 20 && Math.abs(bodyPoint(g.net, t, 30).x - crewPoint(g, r, g.s.t)!.x) < 8;
    if (ok) {
      g.s.tut = undefined; fs.writeFileSync(`${out}-${kind}.json`, saveJson(g));
      const c = crewPoint(g, r, g.s.t)!, h = bodyPoint(g.net, t, 0);
      console.log(kind, ((c.x + h.x) / 2).toFixed(0), ((c.y + h.y) / 2).toFixed(0)); break;
    }
  }
}
