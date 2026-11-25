import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BANDS, acceptable, addDays, isDateKey, puzzleFor, utcDateKey } from './daily';
import { simulate, solve } from './engine';

const START = utcDateKey();

describe('daily generator', () => {
  it('is deterministic for a date', () => {
    const a = puzzleFor('2026-12-01');
    const b = JSON.parse(JSON.stringify(puzzleFor('2026-12-01')));
    expect(b).toEqual(a);
  });

  it('validates date keys', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-11-26')).toBe(true);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('every day for the next 60 days is solvable at par, inside its weekday band', () => {
    const report: string[] = [];
    for (let i = 0; i < 60; i++) {
      const date = addDays(START, i);
      const p = puzzleFor(date);
      const band = BANDS[p.weekday]!;
      // stored solution prints the target
      expect(simulate(p.stamps, p.solution)).toEqual(p.target);
      expect(p.solution).toHaveLength(p.par);
      // an independent solve finds exactly par: nothing shorter exists
      const again = solve(p.stamps, p.target, 12);
      expect(again?.par).toBe(p.par);
      expect(p.par).toBeGreaterThanOrEqual(band.par[0]);
      expect(p.par).toBeLessThanOrEqual(band.par[1]);
      expect(acceptable({ stamps: p.stamps, target: p.target, par: p.par, solution: p.solution }, band)).toBe(true);
      report.push(`${date} wd${p.weekday} stamps=${p.stamps.length} par=${p.par}`);
    }
    expect(report).toHaveLength(60);
  });

  it('property: any date in the next three years generates a day solvable at par', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 * 365 }), (offset) => {
        const p = puzzleFor(addDays('2026-11-23', offset));
        expect(simulate(p.stamps, p.solution)).toEqual(p.target);
        expect(solve(p.stamps, p.target, 12)?.par).toBe(p.par);
      }),
      { numRuns: 120 }
    );
  });
});
