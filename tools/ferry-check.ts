// Check on saves: a new train bought for each landing runs to a dock, sails, and lands (or says why it can't).
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { buyTrainAt, islandOfTrain, shipNewWhy, tickTrains } from '../src/economy/dispatch.ts';
import { isDock, islandName, islandOfB } from '../src/ships/docks.ts';
import { isLinked } from '../src/buildings/industries.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
for (const file of process.argv.slice(2)) {
  const raw = fs.readFileSync(file, 'utf8');
  let g; try { g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage); } catch (e) { console.log(file, 'load failed', String(e)); continue; }
  if (!g) { console.log(file, 'not a rebuild save'); continue; }
  const lands = (g.s.buildings ?? []).filter(b => isDock(b) && isLinked(g, b) && islandOfB(g, b) !== g.world.home);
  g.s.money += 1e5; const bought: { id: number; isl: number; t0: number }[] = [];
  const todo = [...lands];
  const tryBuy = () => { for (const l of [...todo]) { const w = shipNewWhy(g, l); const t = buyTrainAt(g, l); if (typeof t === 'string') { if (w || !/shed siding/.test(t)) { console.log(' ', islandName(g, islandOfB(g, l)), 'refused:', t); todo.splice(todo.indexOf(l), 1); } } else { bought.push({ id: t.id, isl: islandOfB(g, l), t0: g.s.t }); todo.splice(todo.indexOf(l), 1); } } };
  const done = new Map<number, number>(), boarded = new Map<number, number>();
  for (let k = 0; k < 15 * 60 * 10; k++) { const dt = 0.1; if (k % 10 === 0 && todo.length) tryBuy(); g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt);
    for (const b of bought) { if (!boarded.has(b.id) && g.s.ferries?.some(f => f.train === b.id)) boarded.set(b.id, g.s.t - b.t0);
      const t = g.s.trains.find(x => x.id === b.id); if (t && !t.ferry && !done.has(b.id)) done.set(b.id, g.s.t - b.t0); }
    if (!todo.length && done.size === bought.length && k > 3000) break; }
  console.log(file.split('/').pop(), 'landings', lands.length, 'bought', bought.length);
  for (const b of bought) { const t = g.s.trains.find(x => x.id === b.id); console.log('  train', b.id, '→', islandName(g, b.isl), 'boarded after', boarded.get(b.id)?.toFixed(0), 's, done after', done.get(b.id)?.toFixed(0), 's, now on', t ? islandName(g, islandOfTrain(g, t)) : 'at sea'); }
  console.log('  news:', (g.news ?? []).filter(s => /⛴|landed/.test(s)).slice(0, 8).join(' | '));
}
