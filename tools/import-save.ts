// Bring an old save over and write it as a rebuild save, for tools/save-shot.mjs. Usage: npx vite-node tools/import-save.ts <old save> <out.json>
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { prepareSave } from '../src/game.ts';
import { serialize } from '../src/save/save.ts';
const { g } = importLegacy(await decodeLegacy(fs.readFileSync(process.argv[2]!, 'utf8')));
prepareSave(g); fs.writeFileSync(process.argv[3]!, serialize(g.s));
const n = g.world.n, b = (g.s.buildings ?? []).filter(b => b.kind === 'sawmill' || b.kind === 'farm')[0]!;
console.log('square near a', b.kind, b.y * n + b.x);
