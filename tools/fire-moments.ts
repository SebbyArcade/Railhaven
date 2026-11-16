// Starts a fire on a save and writes saves at three moments (crew on the way, crew at work, crew riding home), and
// prints the square to centre each picture on. Usage: npx vite-node tools/fire-moments.ts save.json outPrefix
import fs from 'node:fs';
import { loadFrom, saveJson } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickEvents } from '../src/world/events.ts';
import { tickBreaks } from '../src/track/breaks.ts';
import { runPoint, runTime } from '../src/world/crews.ts';
import { buildingSquares } from '../src/buildings/industries.ts';
import { TILE } from '../src/world/terrain.ts';

const [file = '', out = 'fire'] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, sq = (p: { x: number; y: number }) => Math.floor(p.y / TILE) * n + Math.floor(p.x / TILE);
const run = (secs: number) => { for (let s = 0; s < secs * 20; s++) { g.s.t += 0.05; tickBreaks(g); tickEvents(g, 0.05); } };
g.s.nextEvent = { storm: 1e9, breakdown: 1e9, fire: g.s.t };
tickEvents(g, 0.05);
const b = (g.s.buildings ?? []).find(x => x.fire)!, f = b.fire!, r = f.run;
console.log('fire at', b.kind, 'from', f.from, 'ride', r ? runTime(r).toFixed(1) + ' s' : 'none');
const at = (name: string, centre: number) => { fs.writeFileSync(`${out}-${name}.json`, saveJson(g)); console.log(name, centre); };
run((f.crewAt - g.s.t) * 0.6); at('way', r ? sq(runPoint(g, r, g.s.t)!) : buildingSquares(n, b)[1]!);
run(f.crewAt - g.s.t + 8); at('work', buildingSquares(n, b)[1]!);
run(f.doneAt - g.s.t + 0.5); const back = g.s.crews![0]!; run(runTime(back) * 0.4); at('home', sq(runPoint(g, back, g.s.t)!));
