import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { TILE } from '../src/world/terrain.ts';
import { lightning, stormLife } from '../src/render/events.ts';
import { isRevealed } from '../src/world/fog.ts';

const load = (f: string) => {
  const raw = fs.readFileSync(f, 'utf8');
  return loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
};
/** every strike over 10 minutes of screen time */
const strikes = (g: Game) => { const out = []; for (let tm = 0; tm < 600; tm += 0.02) { const l = lightning(g, tm); if (l) out.push(l); } return out; };

// he reported (2026-11-16, bug reports 8 and 11): the screen flashed white with no storm in sight
describe('lightning', () => {
  it('lights only inside the storm cloud, never the whole screen', () => {
    const g = load('tests/saves/save-seb-2026-11-16c.json'), st = g.s.storm!, R = st.r * TILE;
    const all = strikes(g); expect(all.length).toBeGreaterThan(10);
    for (const l of all) for (const p of l.bolt) expect(Math.hypot(p.x - st.x * TILE, p.y - st.y * TILE)).toBeLessThan(R);
  });
  it('is as faint as the cloud while the storm fades out, and gone once it has passed', () => {
    const g = load('tests/saves/save-seb-2026-11-16c.json'), st = g.s.storm!;
    const full = Math.max(...strikes(g).map(l => l.a));
    g.s.t = st.until - 2; expect(stormLife(g)).toBeLessThan(0.15);
    expect(Math.max(0, ...strikes(g).map(l => l.a))).toBeLessThan(full * 0.15);
    g.s.t = st.until; expect(strikes(g).length).toBe(0);
  });
  it('never flashes for a storm hidden in the fog', () => {
    const g = load('tests/saves/save-seb-2026-11-16c.json'), st = g.s.storm!, n = g.world.n;
    let far = -1; // a fogged square to move the storm to
    for (let i = 0; i < n * n && far < 0; i++) if (!isRevealed(g, i)) far = i;
    expect(far).toBeGreaterThanOrEqual(0);
    st.x = far % n; st.y = (far / n) | 0;
    expect(strikes(g).length).toBe(0);
  });
});
