import fs from 'node:fs';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { loadGame, newGame } from '../src/game.ts';
import { deserialize } from '../src/save/save.ts';
import { BOOM_FIRST, BOOM_LEN, BOOM_PAY, boomBonus, boomMul, boomSpots, startBoom, tickBooms } from '../src/world/booms.ts';
import { isRevealed } from '../src/world/fog.ts';

const SAVE = 'tests/saves/save-seb-2026-11-21-report20.txt';
const read = () => { const t = fs.readFileSync(SAVE, 'utf8').trim(); return deserialize(zlib.gunzipSync(Buffer.from(t.slice(11), 'base64')).toString('utf8')); };
const tickFor = (g: ReturnType<typeof loadGame>, secs: number, linked = () => false) => { for (let k = 0; k < secs; k++) { g.s.t += 1; tickBooms(g, linked); } };

describe('🔥 boom towns', () => {
  it('no booms before the first order is filled', () => {
    const g = newGame(7); tickFor(g, 30 * 60); expect(g.s.booms ?? []).toHaveLength(0);
  });

  it('on his save a boom starts at an unlinked town or site within reach, out of the fog, with a countdown', () => {
    const g = loadGame(read()); expect(boomSpots(g).length).toBeGreaterThan(0);
    tickFor(g, BOOM_FIRST + 2);
    const b = g.s.booms![0]!, t = g.s.sites.find(s => s.id === b.town)!;
    expect(t.kind).toBe('town');
    expect(isRevealed(g, t.y * g.world.n + t.x)).toBe(1);
    expect(b.until - g.s.t).toBeGreaterThan(5 * 60);
    expect(g.news?.some(m => m.startsWith('🔥'))).toBe(true);
  });

  it('missing it costs nothing: the rush moves on, the town stays, and another comes later', () => {
    const g = loadGame(read()); const m0 = g.s.money; const b = startBoom(g)!;
    tickFor(g, Math.ceil(b.until - g.s.t) + 1);
    expect(g.s.booms).toHaveLength(0); expect(g.s.money).toBe(m0);
    expect(g.s.sites.find(s => s.id === b.town)!.kind).toBe('town');
    expect(g.s.nextBoom!).toBeGreaterThan(g.s.t);
    tickFor(g, Math.ceil(g.s.nextBoom! - g.s.t) + 1); expect(g.s.booms!.length).toBe(1);
  });

  it('linking it in time pays the bonus, then deliveries there pay double for the boom', () => {
    const g = loadGame(read()); const b = startBoom(g)!, t = g.s.sites.find(s => s.id === b.town)!;
    const m0 = g.s.money, v = boomBonus(g, b.d);
    tickFor(g, 30, () => true);
    expect(g.s.money - m0).toBe(v); expect(v).toBeGreaterThanOrEqual(1500);
    expect(boomMul(g, t)).toBe(BOOM_PAY); expect(g.s.boomsWon).toBe(1);
    tickFor(g, BOOM_LEN, () => true);
    expect(boomMul(g, t)).toBe(1); expect(g.s.booms).toHaveLength(0);
  });
});
