// Print the source of named functions from the running old game. Usage: node tools/legacy/dump-functions.mjs name1 name2 ...
import { chromium } from 'playwright';
import { resolve } from 'node:path';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 412, height: 915 } });
await p.goto('file://' + resolve('legacy/railhaven-v283-preview.html'));
await p.waitForTimeout(2500);
const out = await p.evaluate(names => names.map(n => { try { const v = eval(n); return '=== ' + n + '\n' + (typeof v === 'function' ? String(v) : JSON.stringify(v)); } catch (e) { return '=== ' + n + ' ERR ' + e.message; } }).join('\n\n'), process.argv.slice(2));
console.log(out);
await b.close();
