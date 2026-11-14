import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateWorld, T } from '../src/world/terrain.ts';
import { newGame, loadGame } from '../src/game.ts';
import { serialize, deserialize } from '../src/save/save.ts';
import { isRevealed } from '../src/world/fog.ts';

/** Run the old game's terrain code (base90.html lines with hash/vn/terr/deep/ocean) for a seed. */
function legacyTerrain(seed: number) {
  const src = readFileSync(new URL('../legacy/live/base90.html', import.meta.url), 'utf8').split('\n');
  const start = src.findIndex(l => l.startsWith('function hash(')), end = src.findIndex(l => l.startsWith('let LANDN='));
  const body = 'const N=208;' + src.slice(start, end).join('\n') + '\nreturn {terr,deep,ocean};';
  return new Function('S', body)({ seed }) as { terr: Uint8Array; deep: Uint8Array; ocean: Uint8Array };
}

describe('world generation', () => {
  for (const seed of [1, 4242, 987654]) {
    it(`matches the old game's terrain for seed ${seed}`, () => {
      const old = legacyTerrain(seed), w = generateWorld(seed);
      expect(Buffer.from(w.terr).equals(Buffer.from(old.terr))).toBe(true);
      expect(Buffer.from(w.deep).equals(Buffer.from(old.deep))).toBe(true);
      expect(Buffer.from(w.ocean).equals(Buffer.from(old.ocean))).toBe(true);
    });
  }

  it('keeps open land around Ashford (no water or mountain within 8 squares)', () => {
    for (const seed of [3, 77, 500]) {
      const w = generateWorld(seed);
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
        if (Math.hypot(x, y) >= 8) continue;
        const t = w.terr[(w.cy + y) * w.n + w.cx + x];
        expect(t === T.Water || t === T.Mountain).toBe(false);
      }
    }
  });

  it('names the home island Ashford Isle', () => {
    const w = generateWorld(12);
    expect(w.islands[w.home]!.name).toBe('Ashford Isle');
  });
});

describe('new game', () => {
  it('is the same for the same seed', () => {
    expect(serialize(newGame(321).s)).toBe(serialize(newGame(321).s));
  });

  it('starts with Ashford, four more home towns, a coal seam near Ashford, and iron/oil only on outer islands', () => {
    for (const seed of [5, 6, 7, 8, 9]) {
      const g = newGame(seed), w = g.world, s = g.s.sites;
      expect(s[0]!.name).toBe('Ashford');
      const home = (x: number, y: number) => w.islandOf[y * w.n + x] === w.home;
      expect(s.filter(o => o.kind === 'town' && home(o.x, o.y)).length).toBe(5);
      expect(s.some(o => o.res === 'coal' && Math.hypot(o.x - w.cx, o.y - w.cy) <= 22)).toBe(true);
      for (const o of s) if (o.res === 'iron' || o.res === 'oil') expect(home(o.x, o.y)).toBe(false);
      const towns = s.filter(o => o.kind === 'town' || o.kind === 'plot');
      for (const a of towns) for (const b of towns) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(11);
    }
  });

  it('reveals the land around Ashford', () => {
    const g = newGame(10);
    expect(isRevealed(g, g.world.cy * g.world.n + g.world.cx)).toBe(1);
    expect(isRevealed(g, (g.world.cy + 9) * g.world.n + g.world.cx)).toBe(1);
    expect(isRevealed(g, (g.world.cy + 20) * g.world.n + g.world.cx)).toBe(0);
  });

  it('survives a save and load round trip', () => {
    const g = newGame(11), back = loadGame(deserialize(serialize(g.s)));
    expect(serialize(back.s)).toBe(serialize(g.s));
    expect(Buffer.from(back.world.terr).equals(Buffer.from(g.world.terr))).toBe(true);
  });
});
