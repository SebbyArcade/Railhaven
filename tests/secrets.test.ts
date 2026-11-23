import fs from 'node:fs';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { loadGame, newGame } from '../src/game.ts';
import { deserialize } from '../src/save/save.ts';
import { CLUE_R, secretMade, secretPay, tickSecrets, treasureCash } from '../src/world/secrets.ts';
import { reachedIslands } from '../src/progress/missions.ts';

const SAVE = 'tests/saves/save-seb-2026-11-21-report20.txt';
const read = () => { const t = fs.readFileSync(SAVE, 'utf8').trim(); return deserialize(zlib.gunzipSync(Buffer.from(t.slice(11), 'base64')).toString('utf8')); };

describe('🗝 island secrets', () => {
  it('track already past a clue reads it quietly when the secret is placed: one note for many islands', () => {
    const g = loadGame(read()); tickSecrets(g);
    expect(g.news!.filter(m => m.startsWith('📜'))).toHaveLength(0);
    expect(g.news!.filter(m => m.startsWith('🗝')).length).toBe(1);
  });

  it('none before the first order is filled', () => {
    const g = newGame(7); tickSecrets(g); expect(g.s.secrets ?? []).toHaveLength(0);
  });

  it('every big island the railway reaches hides one, with 3 clues apart on its land, off mountains; same map, same secrets', () => {
    const g = loadGame(read()), n = g.world.n; tickSecrets(g);
    const list = g.s.secrets!; expect(list.length).toBeGreaterThan(5);
    for (const s of list) {
      const k = g.world.islandOf[s.y * n + s.x];
      expect(reachedIslands(g).has(k!)).toBe(true);
      for (const c of s.clues) { expect(g.world.islandOf[c.y * n + c.x]).toBe(k); expect(g.world.terr[c.y * n + c.x]).not.toBe(4); }
    }
    const h = loadGame(read()); tickSecrets(h);
    expect(h.s.secrets!.map(s => [s.x, s.y, s.kind])).toEqual(list.map(s => [s.x, s.y, s.kind]));
  });

  it('track past each clue narrows the circle; track to the spot finds it and gives its reward', () => {
    const g = loadGame(read()), n = g.world.n; tickSecrets(g);
    const s = g.s.secrets!.find(x => x.kind === 'treasure' && x.clues.every(c => !c.got))!;
    const lay = (x: number, y: number) => { g.linked = new Set([...g.linked!, y * n + x]); };
    lay(s.clues[0]!.x + CLUE_R, s.clues[0]!.y); tickSecrets(g);
    expect(s.clues.map(c => !!c.got)).toEqual([true, false, false]); expect(s.r).toBe(10);
    expect(Math.hypot(s.cx! - s.x, s.cy! - s.y)).toBeLessThanOrEqual(10);
    lay(s.x, s.y); tickSecrets(g); expect(s.found).toBeUndefined(); // the spot needs all 3 clues first
    lay(s.clues[1]!.x, s.clues[1]!.y); lay(s.clues[2]!.x, s.clues[2]!.y);
    const m0 = g.s.money; tickSecrets(g);
    expect(s.r).toBe(0); expect(s.found).toBeDefined(); expect(g.s.money - m0).toBe(treasureCash(g));
    expect(g.news?.some(m => m.startsWith('🗝 Secret found'))).toBe(true);
  });

  it('standing stones and hidden valley bonuses apply only on their island once found', () => {
    const g = loadGame(read()), n = g.world.n; tickSecrets(g);
    for (const kind of ['stones', 'valley'] as const) {
      const s = g.s.secrets!.find(x => x.kind === kind); if (!s) continue;
      const k = g.world.islandOf[s.y * n + s.x]!, town = g.s.sites.find(t => t.kind === 'town' && g.world.islandOf[t.y * n + t.x] === k)!;
      expect(kind === 'stones' ? secretPay(g, town) : secretMade(g, k)).toBe(1);
      s.found = 1;
      expect(kind === 'stones' ? secretPay(g, town) : secretMade(g, k)).toBe(1.2);
    }
  });
});
