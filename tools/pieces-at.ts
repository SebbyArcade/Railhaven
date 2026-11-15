// Lists the rail pieces on some squares of a save: id, kind, length, lane side, squares and conflicts.
// Usage: npx vite-node tools/pieces-at.ts save.json "x,y;x,y;..."
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';

const [file = '', list = ''] = process.argv.slice(2);
const raw = fs.readFileSync(file, 'utf8');
const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
const n = g.world.n, xy = (i: number) => `${i % n},${(i / n) | 0}`;
for (const p of list.split(';').filter(Boolean)) {
  const [x, y] = p.split(',').map(Number), i = y! * n + x!;
  for (const id of g.net.bySquare.get(i) ?? []) {
    const q = g.net.pieces[id]!;
    console.log(`${p} piece ${id} ${q.kind} len ${q.len.toFixed(0)} side ${g.net.side[id]} squares ${q.squares.map(xy).join(' ')} conflicts ${g.net.conflicts[id]!.join(',')} anyLane ${g.sys.anyLane?.has(id) ?? ''}`);
  }
}
