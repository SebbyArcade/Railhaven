// A new game with a town found far beyond the railway (more than a dozen squares of track away), for the 🚉
// station-spot screenshots. Usage: npx vite-node tools/station-spots-save.ts [out]
import fs from 'node:fs';
import { newGame, trackChanged } from '../src/game.ts';
import { saveJson } from '../src/save/save.ts';
import { layPath } from '../src/track/edit.ts';
import { reveal } from '../src/world/fog.ts';
import { joinGap, stationSpots } from '../src/track/joins.ts';

const [out = 'shots/spots.json'] = process.argv.slice(2);
for (let seed = 1; seed < 200; seed++) {
  const g = newGame(seed), n = g.world.n, a = g.s.sites[0]!;
  for (const t of g.s.sites.slice(1)) {
    const d = Math.abs(t.x - a.x) + Math.abs(t.y - a.y);
    if (t.kind !== 'town' || d < 18 || d > 26) continue;
    layPath(g.track, n, [a.y * n + a.x, a.y * n + a.x + 1, a.y * n + a.x + 2]); reveal(g, t.x, t.y, 5); trackChanged(g);
    if (joinGap(g, t) || stationSpots(g, t).length < 3) { g.track.clear(); trackChanged(g); continue; }
    g.s.money = 20000;
    fs.mkdirSync('shots', { recursive: true }); fs.writeFileSync(out, saveJson(g));
    console.log('seed', seed, 'town', t.name, 'square', t.y * n + t.x, 'spots', stationSpots(g, t).length);
    process.exit(0);
  }
}
console.log('no spot');
