// Serve dist/ on localhost and check the installable web app: manifest, offline copy, install readiness, offline reload.
// Usage: npm run build && node tools/pwa-check.mjs [out folder]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
const out = process.argv[2] ?? 'shots';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const root = resolve('dist');
const server = createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname.replace(/^\/Railhaven/, '')); if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p); if (!f.startsWith(root) || !existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' }); r.end(readFileSync(f));
}).listen(4173);
const browser = await chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
const url = 'http://localhost:4173/Railhaven/?home';
await page.goto(url); await page.waitForTimeout(1500);
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
const cdp = await ctx.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
const man = await cdp.send('Page.getAppManifest');
await page.reload(); await page.waitForTimeout(800); // now controlled by the offline copy
await ctx.setOffline(true);
await page.reload(); await page.waitForTimeout(1500);
const offline = await page.evaluate(() => !!window.railhaven?.game && !!document.querySelector('#card.home'));
await page.click('[data-page="settings"]'); await page.waitForTimeout(300); await page.click('[data-page="app"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/pwa-install-page.png` });
console.log(JSON.stringify({ serviceWorker: sw, installErrors: inst.installabilityErrors, manifestErrors: man.errors, offlineReloadWorks: offline, errs }));
await browser.close(); server.close();
