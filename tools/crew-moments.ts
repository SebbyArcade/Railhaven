// Starts a fire, a broken rail and a train breakdown on a save, and writes saves with the crews at work and riding,
// printing the square to centre each picture on. Usage: npx vite-node tools/crew-moments.ts save.json outPrefix [breakSquare]
import fs from 'node:fs';
import { loadFrom, saveJson } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { tickEvents } from '../src/world/events.ts';
import { breakRail, tickBreaks } from '../src/track/breaks.ts';
import { runPoint, runTime } from '../src/world/crews.ts';
import { buildingSquares } from '../src/buildings/industries.ts';
import { TILE } from '../src/world/terrain.ts';

const [file = '', out = 'crew', bsq] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, sq = (p: { x: number; y: number }) => Math.floor(p.y / TILE) * n + Math.floor(p.x / TILE);
const run = (secs: number) => { for (let s = 0; s < secs * 20; s++) { g.s.t += 0.05; tickBreaks(g); tickEvents(g, 0.05); } };
const at = (name: string, centre: number) => { fs.writeFileSync(`${out}-${name}.json`, saveJson(g)); console.log(name, centre); };
// a broken rail: the gang rides out on its handcar, then works on it
const br = breakRail(g, bsq ? +bsq : 87 * n + 98)!;
g.s.nextEvent = { storm: 1e9, breakdown: g.s.t, fire: g.s.t };
tickEvents(g, 0.05);
const b = (g.s.buildings ?? []).find(x => x.fire)!, tr = g.s.trains.find(t => t.broke);
if (br.run) { run(Math.max(0.5, (br.crewAt - g.s.t) * 0.5)); at('handcar', sq(runPoint(g, br.run, g.s.t)!)); }
run(Math.max(br.crewAt, b.fire!.crewAt, tr?.broke?.crewAt ?? 0) - g.s.t + 2);
at('rail', br.square);
at('fire', buildingSquares(n, b)[1]!);
if (tr) at('train', tr.trail.length ? g.net.pieces[tr.trail.at(-1)!.piece]!.squares[0]! : br.square);
console.log('times', g.s.t.toFixed(1), 'rail', br.crewAt.toFixed(1), br.doneAt.toFixed(1), 'fire', b.fire!.crewAt.toFixed(1), b.fire!.doneAt.toFixed(1), 'train', tr?.broke?.crewAt.toFixed(1), tr?.broke?.doneAt.toFixed(1), 'ride', br.run ? runTime(br.run).toFixed(1) : '-');
