// Full sea trip check: camp at home → train → dock → ship → landing → island train → Sawmill. Usage: npx vite-node tools/sea-trip.ts
import { trackChanged } from '../src/game.ts';
import { buyTrain, buyTrainAt, tickTrains } from '../src/economy/dispatch.ts';
import { tickProduction } from '../src/economy/production.ts';
import { orderOf } from '../src/economy/towns.ts';
import { yardSquares, placementsAt, placeError, build, type Building, type IndustryKind } from '../src/buildings/industries.ts';
import { islandOfB } from '../src/ships/docks.ts';
import { buyShip } from '../src/ships/ships.ts';
import type { Game } from '../src/state.ts';
import { dockAndLanding, linkB } from '../tests/sea.ts';

function buildNear(g: Game, kind: IndustryKind, isl: number, cx: number, cy: number): Building | null {
  const n = g.world.n, spots: { q: ReturnType<typeof placementsAt>[number]; d: number }[] = [];
  for (let y = cy - 25; y <= cy + 25; y++) for (let x = cx - 25; x <= cx + 25; x++) for (const q of placementsAt(kind, x, y)) if (g.world.islandOf[yardSquares(n, q)[0]!] === isl && !placeError(g, q)) spots.push({ q, d: Math.hypot(x - cx, y - cy) });
  spots.sort((p, q) => p.d - q.d);
  for (const s of spots.slice(0, 80)) { if (placeError(g, s.q)) continue; const b = build(g, s.q); if (typeof b === 'string') continue; trackChanged(g); if (linkB(g, b)) return b; }
  return null;
}
const { g, dock, landing } = dockAndLanding(4242), n = g.world.n, a = g.s.sites[0]!;
g.s.rlv = 3;
const camp = buildNear(g, 'wood', g.world.home, a.x, a.y)!, ly = yardSquares(n, landing)[1]!;
const mill = buildNear(g, 'sawmill', islandOfB(g, landing), ly % n, (ly / n) | 0)!;
a.got = { ...orderOf(g, a) };
console.log('shed', !!g.s.shed, 'train', typeof buyTrain(g), 'island train', typeof buyTrainAt(g, landing), 'ship', typeof buyShip(g, dock));
const T = +(process.env.T ?? 600);
for (let s = 0; s < T; s++) {
  for (let k = 0; k < 20; k++) { g.s.t += 0.05; g.sys.tick(0.05); tickProduction(g, 0.05); a.got = { ...orderOf(g, a) }; tickTrains(g, 0.05); }
  if (s % 60 === 59) console.log(`t=${s + 1}s camp ${Math.floor(camp.stock)} dockQ ${JSON.stringify(dock.outq ?? [])} ship ${JSON.stringify(g.s.ships!.map(x => ({ at: x.at, to: x.to, hold: x.hold })))} landed ${JSON.stringify(landing.landed ?? {})} mill in ${JSON.stringify(mill.inbuf ?? {})} trains ${g.s.trains.map(t => t.job?.phase ?? '-').join(',')}`);
}
// SAVE=file writes the game as it stands (for tools/save-shot.mjs), and prints where the ship is
if (process.env.SAVE) {
  const { saveTo } = await import('../src/save/save.ts');
  const { shipPlace } = await import('../src/ships/ships.ts');
  const { writeFileSync } = await import('node:fs');
  saveTo({ getItem: () => null, setItem: (_k, v) => writeFileSync(process.env.SAVE!, v) }, g);
  const p = shipPlace(g, g.s.ships![0]!); console.log('ship square', Math.round(p.y) * n + Math.round(p.x), 'dock square', yardSquares(n, dock)[1]);
}
