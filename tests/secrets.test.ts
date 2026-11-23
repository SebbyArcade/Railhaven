import fs from 'node:fs';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { loadGame, newGame } from '../src/game.ts';
import { deserialize } from '../src/save/save.ts';
import { secretCardHtml, secretHint, secretMarks, secretTapAt, trailNext, CLUE_R, secretMade, secretPay, tickSecrets, treasureCash } from '../src/world/secrets.ts';
import { reachedIslands } from '../src/progress/missions.ts';

const SAVE = 'tests/saves/save-seb-2026-11-21-report20.txt';
const read = () => { const t = fs.readFileSync(SAVE, 'utf8').trim(); return deserialize(zlib.gunzipSync(Buffer.from(t.slice(11), 'base64')).toString('utf8')); };

describe('🗝 island secrets', () => {
  it('track already past a clue reads it quietly when the secret is placed: one note for many islands', () => {
    const g = loadGame(read()); tickSecrets(g);
    expect(g.news!.filter(m => m.startsWith('📜'))).toHaveLength(0);
    expect(g.news!.filter(m => m.startsWith('🗝') && !m.startsWith('🗝 Secret found')).length).toBe(1); // a trail your track already covers can pay out at once
    expect((g.secretCards ?? []).filter(c => c.ev !== 'found')).toHaveLength(0); // many islands at once: no card storm
  });

  it('none before the first order is filled', () => {
    const g = newGame(7); tickSecrets(g); expect(g.s.secrets ?? []).toHaveLength(0);
  });

  it('every big island the railway reaches hides one, with a trail of 3 clues on its land, off mountains; same map, same secrets', () => {
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

  it('a trail: only the next clue counts, each one points to the next, the ✖ comes last and gives the reward', () => {
    const g = loadGame(read()), n = g.world.n; tickSecrets(g);
    const s = g.s.secrets!.find(x => x.kind === 'treasure' && x.clues.every(c => !c.got))!;
    const lay = (x: number, y: number) => { g.linked = new Set([...g.linked!, y * n + x]); };
    expect(trailNext(s)).toEqual({ ...s.clues[0]!, spot: false });
    expect(secretHint(g, s)).toMatch(/^From .+, head (north|south|east|west|north-east|north-west|south-east|south-west), about \d+ squares, /);
    expect(secretMarks(g).find((_, i) => g.s.secrets![i] === s)!.read).toHaveLength(0); // nothing on the map shows where it is
    lay(s.clues[1]!.x, s.clues[1]!.y); tickSecrets(g);
    expect(s.clues.some(c => c.got)).toBe(false); // the second clue waits for the first
    lay(s.clues[0]!.x + CLUE_R, s.clues[0]!.y); tickSecrets(g);
    expect(s.clues.map(c => !!c.got)).toEqual([true, true, false]); // track already at the 2nd reads it right after
    expect(secretHint(g, s)).toMatch(/^From clue 2 \(the glowing 📜2 on the map\), head /);
    expect(g.secretCards?.at(-1)).toEqual({ id: s.id, ev: 'clue' });
    expect(secretCardHtml(g, s.id, 'clue')).toMatch(/Clue 2 of 3 read/);
    expect(secretTapAt(g, s.clues[1]!.y * n + s.clues[1]!.x)?.id).toBe(s.id); expect(secretTapAt(g, s.clues[2]!.y * n + s.clues[2]!.x)).toBeUndefined();
    lay(s.clues[2]!.x, s.clues[2]!.y); tickSecrets(g);
    expect(trailNext(s)).toEqual({ x: s.x, y: s.y, spot: true });
    const m0 = g.s.money; lay(s.x, s.y); tickSecrets(g);
    expect(s.found).toBeDefined(); expect(g.s.money - m0).toBeCloseTo(treasureCash(g));
    expect(g.news?.some(m => m.startsWith('🗝 Secret found'))).toBe(true);
    expect(g.secretCards?.at(-1)).toEqual({ id: s.id, ev: 'found' }); expect(secretCardHtml(g, s.id)).toMatch(/Secret found/);
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
