// A small new game for the discovery screenshots: track out of Ashford and a dock with a landing on another island.
// Usage: npx vite-node tools/discover-save.ts [seed] [out]
import fs from 'node:fs';
import { saveJson } from '../src/save/save.ts';
import { dockAndLanding } from '../tests/sea.ts';
import { emptyFog, reveal } from '../src/world/fog.ts';
import { trackChanged } from '../src/game.ts';

const [seed = '4242', out = 'shots/discover.json'] = process.argv.slice(2);
const { g } = dockAndLanding(+seed);
// dockAndLanding uncovers the whole map to pick spots: put the fog back, keeping only what the railway would see
g.s.fog = emptyFog(g.world.n);
for (const i of g.linked ?? []) reveal(g, i % g.world.n, (i / g.world.n) | 0, 3);
reveal(g, g.world.cx, g.world.cy, 9);
g.s.pois = undefined; g.s.poiV = undefined; g.s.isles = undefined;
trackChanged(g);
g.s.money = 60000;
fs.mkdirSync('shots', { recursive: true }); fs.writeFileSync(out, saveJson(g));
console.log('saved', out, 'linked squares', g.linked?.size);
