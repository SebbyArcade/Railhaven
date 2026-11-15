import { describe, expect, it } from 'vitest';
import { seasonOf, YEAR } from '../src/world/season.ts';

describe('seasons', () => {
  it('turn every two minutes in an 8-minute year', () => {
    expect([0, 119, 120, 240, 360, 479, YEAR].map(seasonOf)).toEqual([0, 0, 1, 2, 3, 3, 0]);
  });
});
