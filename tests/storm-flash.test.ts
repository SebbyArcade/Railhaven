import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';
import { TILE } from '../src/world/terrain.ts';
import { stormInView } from '../src/render/events.ts';

// he reported (2026-11-16, bug report 8): the screen flashed white with no storm in sight
describe('lightning', () => {
  it('flashes only when the storm is on screen, not just past the edge', () => {
    const raw = fs.readFileSync('tests/saves/save-seb-2026-11-16c.json', 'utf8');
    const g = loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game;
    const st = g.s.storm!, cam = g.s.camera, phone = { w: 412, h: 860 };
    // his view: the storm sits below the bottom edge (the old rule flashed: within the screen's longer side)
    expect(Math.hypot(st.x * TILE - cam.x, st.y * TILE - cam.y) * cam.z).toBeLessThan(phone.h);
    expect(stormInView(g, cam, phone)).toBe(false);
    // looking straight at it: it flashes
    expect(stormInView(g, { x: st.x * TILE, y: st.y * TILE, z: cam.z }, phone)).toBe(true);
  });
});
