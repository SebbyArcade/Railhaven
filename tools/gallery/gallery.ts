// Every building kind at level 1-3 and in several spots (so its variations show), drawn on grass. Opened by tools/gallery-shot.mjs.
import { newGame } from '../../src/game.ts';
import { INDUSTRIES, type Building, type IndustryKind } from '../../src/buildings/industries.ts';
import { drawBuilding } from '../../src/render/buildings.ts';
import { TILE } from '../../src/world/terrain.ts';

const params = new URLSearchParams(location.search);
const kinds = (params.get('kinds')?.split(',') ?? Object.keys(INDUSTRIES)) as IndustryKind[];
const cols = +(params.get('cols') ?? 4), scale = +(params.get('z') ?? 2.2), tm = +(params.get('t') ?? 3);
const g = newGame(4242), n = g.world.n;
g.linked = new Set(Array.from({ length: n * n }, (_, i) => i));
const cw = 5 * TILE, ch = 3 * TILE;
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = cols * cw * scale; c.height = kinds.length * ch * scale;
const ctx = c.getContext('2d')!;
ctx.scale(scale, scale);
kinds.forEach((kind, r) => {
  for (let k = 0; k < cols; k++) {
    ctx.save(); ctx.translate(k * cw, r * ch);
    ctx.fillStyle = (k + r) % 2 ? '#6a9444' : '#638c40'; ctx.fillRect(0, 0, cw, ch);
    // two yard rails
    ctx.fillStyle = '#7a6a58'; ctx.fillRect(TILE * 0.5, TILE * 0.5 - 6, TILE * 4, 12);
    const b = { id: 100 + k, kind, x: 20 + k * 40 + r * 3, y: 20 + r * 12 + k * 5, horizontal: true, side: 1, lvl: kind === 'dock' ? 1 : 1 + (k % 3), stock: k * 10, paid: 0 } as unknown as Building;
    // draw at our cell: drawBuilding places by b.x/b.y, so shift the canvas to match
    ctx.translate(-(b.x - 0.5) * TILE, -(b.y - 0.5) * TILE);
    if (kind === 'dock') { ctx.fillStyle = '#3f7fa8'; ctx.fillRect((b.x - 0.5) * TILE, (b.y + 1.5) * TILE, 5 * TILE, TILE * 1.5); }
    drawBuilding(ctx, g, b, tm + k, 1);
    ctx.restore();
  }
});
(window as any).done = true;
