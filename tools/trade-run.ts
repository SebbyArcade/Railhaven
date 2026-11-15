// Run a save and report regions, capitals and trade orders every 5 game minutes. Usage: npx vite-node tools/trade-run.ts save.json minutes
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { checkStuck } from '../src/economy/nofail.ts';
import { capitalOf, regions, tradeWhy } from '../src/economy/trade.ts';
import { islandName } from '../src/ships/docks.ts';

const [file = 'shots/s14.json', min = '20'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)!;
const e0 = g.s.earned ?? 0, o0 = g.s.orders ?? 0;
const show = (m: number) => {
  const R = regions(g);
  const rows = [...R.keys()].map(k => {
    const c = capitalOf(g, k), o = g.s.trade?.[k];
    return `${islandName(g, k)} 👑 ${c?.name}${o ? ` · round ${o.n}: ${o.good} ${o.got}/${o.need} from ${islandName(g, o.from)}${c && o.got < o.need ? ' ' + tradeWhy(g, c, o) : ''}` : ''}`;
  });
  console.log(`min ${m}: ${R.size} regions, trade orders filled ${g.s.tradeDone ?? 0}\n  ` + rows.join('\n  '));
};
for (let s = 0; s < +min! * 60; s++) {
  for (let k = 0; k < 20; k++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
  if (s % 5 === 0) checkStuck(g);
  if (s % 300 === 0) show(s / 60);
}
show(+min!);
console.log(`earned +$${Math.round((g.s.earned ?? 0) - e0)} · orders +${(g.s.orders ?? 0) - o0}`);
