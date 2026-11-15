// Run a save for N game minutes with no player input. Usage: npx vite-node tools/save-run.ts [save] [minutes]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { tickEvents } from '../src/world/events.ts';
import { breaksChanged } from '../src/game.ts';

const [file = 'shots/s14.json', min = '15'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
const e0 = g.s.earned ?? 0, o0 = g.s.orders ?? 0;
for (let s = 0; s < +min! * 60; s++) {
  for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); if (+tickBreaks(g) + +tickEvents(g, dt)) breaksChanged(g); }
  if (s % 5 === 0) checkStuck(g);
}
const idle = g.s.trains.filter(t => !t.job).length;
console.log(`${file}: ${min} min · level ${g.s.rlv} · earned +$${Math.round((g.s.earned ?? 0) - e0)} · orders +${(g.s.orders ?? 0) - o0} · trains ${g.s.trains.length} (${idle} idle)`);
