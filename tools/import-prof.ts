// Time an old-save import: npx vite-node tools/import-prof.ts tests/saves/<file>
import fs from 'node:fs';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
const o = await decodeLegacy(fs.readFileSync(process.argv[2]!, 'utf8'));
const t0 = performance.now();
importLegacy(o);
console.log('import', Math.round(performance.now() - t0), 'ms');
