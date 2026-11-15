// Contact sheet of every building and its variations. Needs `npx vite --port 5199` running. Usage: node tools/gallery-shot.mjs [kinds] [out]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const [kinds = '', out = 'shots/gallery.png', cols = '4'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:5199/tools/gallery/index.html?z=${process.env.Z ?? 2.2}&cols=${cols}${kinds ? '&kinds=' + kinds : ''}`);
await page.waitForFunction(() => window.done, null, { timeout: 30000 });
await page.locator('#c').screenshot({ path: out });
console.log(errors.join('\n') || 'no page errors');
await browser.close();
