import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { newGame, trackChanged } from '../src/game.ts';
import { linkSquares } from '../src/track/edit.ts';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { Tools } from '../src/ui/tools.ts';
import { loadFrom } from '../src/save/save.ts';
import type { Game } from '../src/state.ts';

(globalThis as any).document ??= { getElementById: () => ({ style: {} }) };
(globalThis as any).window ??= { setTimeout: () => 0 };

/** a straight line of 8 squares east of Ashford, joined square to square */
function setup() {
  const g = newGame(4242), a = g.s.sites[0]!, n = g.world.n, tools = new Tools(() => g), A = a.y * n + a.x;
  for (let k = 1; k <= 8; k++) linkSquares(g.track, n, A + k - 1, A + k);
  trackChanged(g);
  tools.mode = 'remove';
  return { g, n, tools, A };
}

describe('Remove: pick many track squares, remove them in one go', () => {
  it('taps pick and drop squares; one ✂ removes them all for no money', () => {
    const { g, tools, A } = setup();
    for (const k of [6, 7, 8]) { tools.dragStart(A + k); tools.tapSquare(A + k); } // a tap is a press then a release
    expect([...tools.rm].sort()).toEqual([A + 6, A + 7, A + 8]);
    tools.dragStart(A + 7); tools.tapSquare(A + 7); // tap a picked square: it drops
    expect(tools.rm.has(A + 7)).toBe(false);
    tools.dragStart(A + 7); tools.tapSquare(A + 7);
    const bar = tools.bar()!;
    expect(bar.text).toBe('Remove these 3 track squares?');
    expect(bar.ok).toBe('✂ Remove 3');
    const m = g.s.money; tools.confirm();
    expect(g.s.money).toBe(m); // same as one at a time: no money back
    for (const k of [6, 7, 8]) expect(g.track.has(A + k)).toBe(false);
    expect(g.track.has(A + 5)).toBe(true);
    expect(tools.rm.size).toBe(0);
    expect(tools.mode).toBe('remove'); // the tool stays open for more
  });

  it('a drag along the track picks every square, even ones the finger skipped', () => {
    const { tools, A } = setup();
    expect(tools.dragStart(A + 2)).toBe(true); tools.dragOver(A + 3); tools.dragOver(A + 6); // skipped 4 and 5
    tools.tapSquare(A + 6); // the release right after a short drag: not a toggle
    expect([...tools.rm].sort()).toEqual([A + 2, A + 3, A + 4, A + 5, A + 6]);
    // a drag that starts on a picked square drops squares instead
    tools.dragStart(A + 5); tools.dragOver(A + 6);
    expect([...tools.rm].sort()).toEqual([A + 2, A + 3, A + 4]);
  });

  it('a drag that starts off the track pans and picks nothing', () => {
    const { g, n, tools, A } = setup();
    const off = A + 3 * n; expect(g.track.has(off)).toBe(false);
    expect(tools.dragStart(off)).toBe(false);
    tools.dragOver(A + 3);
    expect(tools.rm.size).toBe(0);
  });

  it('nothing is removed while a train stands on any picked square', () => {
    const { g, tools, A } = setup();
    for (const k of [7, 8]) { tools.dragStart(A + k); tools.tapSquare(A + k); }
    const sq = A + 8, piece = g.net.pieces.findIndex(p => p.squares.includes(sq));
    g.s.trains.push({ trail: [{ piece }] } as any);
    tools.confirm();
    expect(g.track.has(A + 7)).toBe(true); expect(g.track.has(A + 8)).toBe(true);
    expect(tools.rm.size).toBe(2); // the picks stay, to try again
  });

  it.each(['save-seb-2026-11-14.json', 'save-seb-2026-11-16i.json'])('warns once for everything the picks would cut off (%s)', async f => {
    const raw = fs.readFileSync(`tests/saves/${f}`, 'utf8');
    const g = raw.startsWith('{"version"') ? loadFrom({ getItem: () => raw, setItem: () => {} } as unknown as Storage)! as Game : importLegacy(await decodeLegacy(raw)).g;
    const tools = new Tools(() => g); tools.mode = 'remove';
    const busy = new Set(g.s.trains.flatMap(t => t.trail.flatMap(s => g.net.pieces[s.piece]!.squares)));
    const before = g.track.size, picks = [...g.track.keys()].filter(i => !busy.has(i)).slice(0, 40);
    for (const i of picks) { tools.dragStart(i); tools.tapSquare(i); }
    const bar = tools.bar()!;
    expect(bar.text).toMatch(/^(⚠ Removing these 40 track squares cuts .+ off the railway|Remove these 40 track squares\?)$/);
    expect(g.track.size).toBe(before); // working out the warning never changes the real track
    tools.confirm();
    for (const i of picks) expect(g.track.has(i)).toBe(false);
  });
});
