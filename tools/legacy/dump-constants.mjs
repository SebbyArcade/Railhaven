// Dump the old game's economy constants by running it headless. Usage: node tools/legacy/dump-constants.mjs > out.json
import { chromium } from 'playwright';
import { resolve } from 'node:path';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 412, height: 915 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + resolve('legacy/railhaven-v283-preview.html'));
await p.waitForTimeout(2500);
const out = await p.evaluate(() => {
  const g = n => { try { return eval(n); } catch (e) { return 'ERR ' + e.message; } };
  const names = ['LADDER','LREW','TLIM','TCOST','LPOP','RLV','RUNL','PAY','FACP','FAC','FACT','IND','TYPES','BUILD','COST','MATS','GOOD','DEP','SELLP','UPG','SHUP','RUSH','FISH','SPEC','RISL','BRG','LM','CARGO','TIERCAP'];
  const o = {};
  for (const n of names) { const v = g(n); try { o[n] = JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'function' ? 'fn:' + String(x).slice(0, 300) : x)); } catch (e) { o[n] = String(v).slice(0, 300); } }
  o.LADDER_EXT = []; for (let L = 0; L < 12; L++) { try { o.LADDER_EXT.push(LADDER[L]); } catch (e) {} }
  o.globals = Object.keys(window).filter(k => /^[A-Z][A-Z0-9_]{1,8}$/.test(k)).join(' ');
  return o;
});
console.log(JSON.stringify(out, null, 1));
console.error(errs.slice(0, 5).join('\n'));
await b.close();
