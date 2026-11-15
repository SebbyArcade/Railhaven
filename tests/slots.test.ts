import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { newGame } from '../src/game.ts';
import { decodeLegacy, importLegacy } from '../src/save/legacy.ts';
import { loadFrom, onSave, SAVE_KEY, saveJson, saveTo } from '../src/save/save.ts';
import { addSlot, copySlot, deleteSlot, INDEX_KEY, MAX_SLOTS, openSlot, readIndex, renameSlot, slotKey, sortedSlots, touchActive } from '../src/save/slots.ts';

class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }

describe('save slots', () => {
  it("turns the game already in this browser into slot 1 (Sébastien's Nov 14 game)", async () => {
    const { g } = importLegacy(await decodeLegacy(fs.readFileSync('tests/saves/save-seb-2026-11-14.json', 'utf8')));
    const st = new Mem(); saveTo(st, g);
    const ix = readIndex(st);
    expect(ix.list.length).toBe(1);
    expect(ix.list[0]!.name).toBe(`Ashford Isle ${g.s.seed}`);
    expect(ix.list[0]!.towns).toBeGreaterThan(3);
    expect(ix.list[0]!.money).toBe(g.s.money);
    expect(loadFrom(st)?.s.seed).toBe(g.s.seed); // the live save is untouched
  });

  it('keeps up to five games and switches between them without losing any', () => {
    const st = new Mem();
    const a = newGame(111); a.s.money = 1111; saveTo(st, a); readIndex(st);
    const seeds = [222, 333, 444, 555];
    for (const s of seeds) { const g = newGame(s); expect(addSlot(st, saveJson(g), g)).toBeNull(); }
    expect(readIndex(st).list.length).toBe(MAX_SLOTS);
    const extra = newGame(666);
    expect(addSlot(st, saveJson(extra), extra)).toMatch(/All 5/);
    // the playing game is the last one added; game 111 waits under its slot key with its money
    const ix = readIndex(st), first = ix.list.find(m => m.seed === 111)!;
    expect(loadFrom(st)?.s.seed).toBe(555);
    const back = openSlot(st, first.id);
    expect(typeof back).toBe('object');
    expect((back as any).s.money).toBe(1111);
    expect(loadFrom(st)?.s.seed).toBe(111);
    expect(st.getItem(slotKey(first.id))).toBeNull();
    // every other game is still there
    for (const m of readIndex(st).list.filter(m => m.id !== first.id)) expect(st.getItem(slotKey(m.id))).toBeTruthy();
    expect(sortedSlots(readIndex(st))[0]!.id).toBe(first.id);
  });

  it('copies, renames and deletes; deleting the playing game opens the last one played', () => {
    const st = new Mem();
    const a = newGame(7); saveTo(st, a); readIndex(st);
    const b = newGame(8); addSlot(st, saveJson(b), b);
    const ids = readIndex(st).list.map(m => m.id);
    expect(copySlot(st, ids[0]!)).toBeNull();
    const ix = readIndex(st);
    expect(ix.list.length).toBe(3);
    expect(ix.list[2]!.name).toBe('Ashford Isle 7 (copy)');
    expect(renameSlot(st, ix.list[2]!.id, '  My test map  ')).toBeNull();
    expect(readIndex(st).list[2]!.name).toBe('My test map');
    expect(renameSlot(st, ix.list[2]!.id, '   ')).toBe('Type a name first');
    // delete a waiting game
    expect(deleteSlot(st, ix.list[2]!.id)).toEqual({ ok: 'gone' });
    expect(st.getItem(slotKey(ix.list[2]!.id))).toBeNull();
    // delete the playing game (seed 8): game 7 opens
    const r = deleteSlot(st, readIndex(st).active);
    expect(typeof r === 'object' && r.ok).toBe('switch');
    expect(loadFrom(st)?.s.seed).toBe(7);
    // delete the last game: nothing left
    expect(deleteSlot(st, readIndex(st).active)).toEqual({ ok: 'empty' });
    expect(readIndex(st).list.length).toBe(0);
    expect(st.getItem(SAVE_KEY)).toBeNull();
  });

  it('keeps the stats line fresh with every save', () => {
    const st = new Mem();
    onSave((s, g) => touchActive(s as Mem, g));
    const g = newGame(99); saveTo(st, g);
    g.s.money = 4321; g.s.t = 3600; saveTo(st, g);
    const m = readIndex(st).list[0]!;
    expect(m.money).toBe(4321); expect(m.t).toBe(3600);
    onSave(null);
    expect(JSON.parse(st.getItem(INDEX_KEY)!).active).toBe(m.id);
  });
});
