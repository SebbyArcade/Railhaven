// Prints the shipping plan of a save with names, each train's job and each town's order, after playing it a while.
// Usage: npx vite-node tools/order-watch.ts save.json [seconds to play first]
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import type { Good } from '../src/buildings/industries.ts';
import { tickProduction } from '../src/economy/production.ts';
import { tickTowns, orderOf } from '../src/economy/towns.ts';
import { tickTrains } from '../src/economy/dispatch.ts';
import { shipPlan } from '../src/economy/shipping.ts';

const [file = '', secs = '0'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const e0 = g.s.earned ?? 0;
for (let s = 0; s < +secs * 20; s++) { const dt = 0.05; g.s.t += dt; g.sys.tick(dt); tickProduction(g, dt); tickTowns(g, dt); tickTrains(g, dt); }
const bld = (id: number) => g.s.buildings!.find(b => b.id === id);
const name = (to: { kind: string; id: number }) => to.kind === 'town' ? g.s.sites.find(t => t.id === to.id)?.name : `${bld(to.id)?.kind}#${to.id}`;
for (const [id, s] of shipPlan(g)) console.log(`${bld(id)!.kind}#${id} stock ${Math.round(bld(id)!.stock)} -> ${name(s.to)} (${s.why}${s.feeds ? ', feeds an order' : ''}, ${s.d} sq)`);
for (const t of g.s.trains.filter(Boolean)) console.log(`train ${t.id}: ${t.job ? `${t.job.phase} ${t.job.good} from #${t.job.src} to ${name(t.job.to)}` : 'idle'}`);
for (const t of g.s.sites.filter(t => t.kind === 'town' && t.got)) console.log(`${t.name}: ${Object.entries(orderOf(g, t)).map(([k, v]) => `${k} ${Math.floor(t.got?.[k as Good] ?? 0)}/${v}`).join(', ')}`);
console.log(`earned in this run $${Math.round((g.s.earned ?? 0) - e0)} · money $${Math.round(g.s.money)}`);
