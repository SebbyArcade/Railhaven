import { describe, expect, it } from 'vitest';
import { aName, INDUSTRIES } from '../src/buildings/industries.ts';

describe('building names in sentences', () => {
  it('uses "an" before a vowel and "a" otherwise', () => {
    expect(aName(INDUSTRIES.iron.name)).toBe('an Iron Mine');
    expect(aName(INDUSTRIES.oil.name, true)).toBe('An Oil Well');
    expect(aName('Sawmill')).toBe('a Sawmill');
    expect(aName('Sawmill', true)).toBe('A Sawmill');
  });
});
