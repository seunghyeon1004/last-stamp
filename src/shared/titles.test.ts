import { describe, expect, it } from 'vitest';
import { flairText, nextTitle, titleFor } from './titles';

describe('titles', () => {
  it('climbs the ladder by solves and pars', () => {
    expect(titleFor({ solved: 0, pars: 0 })).toBeNull();
    expect(titleFor({ solved: 1, pars: 0 })?.name).toBe('Apprentice');
    expect(titleFor({ solved: 3, pars: 2 })?.name).toBe('Apprentice');
    expect(titleFor({ solved: 3, pars: 3 })?.name).toBe('Inker');
    expect(titleFor({ solved: 40, pars: 25 })?.name).toBe('Master Stamper');
    expect(nextTitle({ solved: 3, pars: 3 })?.name).toBe('Stampsmith');
    expect(nextTitle({ solved: 99, pars: 99 })).toBeNull();
  });
  it('builds flair text without commas', () => {
    const t = titleFor({ solved: 3, pars: 3 })!;
    expect(flairText(t, 1)).toBe('Inker');
    expect(flairText(t, 5)).toBe('Inker | 5-day streak');
    expect(flairText(t, 5)).not.toContain(',');
  });
});
