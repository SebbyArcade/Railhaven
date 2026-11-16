// Sea reach on saves: for every dock on the railway, the named islands it reaches and whether a landing fits on
// their shore now (out of the fog, in reach). Usage: npx vite-node tools/sea-reach-check.ts tests/saves/*.json
import { readFileSync } from 'node:fs';
import { loadGame } from '../src/game.ts';
import { loadFrom } from '../src/save/save.ts';
import { isRevealed } from '../src/world/fog.ts';
import { dockRange, islandOfB, linkedDocks, seaDist } from '../src/ships/docks.ts';
import { bestPlacement } from '../src/buildings/industries.ts';

for (const f of process.argv.slice(2)) {
  const txt = readFileSync(f, 'utf8');
  const g = loadFrom({ getItem: () => txt, setItem: () => {} }) ?? loadGame(JSON.parse(txt));
  if (!g) { console.log(f, 'no game'); continue; }
  const w = g.world, n = w.n, docks = linkedDocks(g);
  let fog = 0; for (let i = 0; i < n * n; i++) if (isRevealed(g, i)) fog++;
  const reach = new Map<number, number>(); // island -> best sea distance from any dock
  for (const b of docks) {
    const d = seaDist(g, b), R = dockRange(b), own = islandOfB(g, b);
    for (let i = 0; i < n * n; i++) { const v = d[i]!; if (v < 0 || v > R) continue; for (const j of [i + 1, i - 1, i + n, i - n]) { const k = w.islandOf[j]!; if (k < 0 || k === own || !w.islands[k]?.name) continue; if (!reach.has(k) || reach.get(k)! > v) reach.set(k, v); } }
  }
  const has = new Set((g.s.buildings ?? []).filter(b => b.kind === 'dock').map(b => islandOfB(g, b)));
  const rows: string[] = []; let fits = 0, open = 0;
  for (const [k, v] of [...reach].sort((a, b) => a[1] - b[1])) {
    if (has.has(k)) continue; open++;
    let ok = false;
    for (let i = 0; i < n * n && !ok; i++) if (w.islandOf[i] === k && w.terr[i] && [i + 1, i - 1, i + n, i - n].some(j => w.ocean[j])) ok = !!bestPlacement(g, 'dock', i % n, (i / n) | 0).place;
    if (ok) fits++;
    rows.push(`${w.islands[k]!.name}:${v}${ok ? '✓' : '✗'}`);
  }
  console.log(`${f.split('/').pop()}: docks ${docks.length} · revealed ${Math.round(100 * fog / (n * n))}% · islands in reach without a landing ${open}, landing fits on ${fits} · ${rows.join(' ')}`);
}
