import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkComposition, deskStamps, deskSunday, DESK_RULES } from './desk';
import { addDays, puzzleFor } from './daily';
import { simulate, solve, SIZE, fits, shapeOf, type Press } from './engine';

describe('open desk', () => {
  it('composes for the coming Sunday', () => {
    expect(deskSunday('2026-11-26')).toBe('2026-11-29'); // Thu -> Sun
    expect(deskSunday('2026-11-28')).toBe('2026-11-29'); // Sat -> Sun
    expect(deskSunday('2026-11-29')).toBe('2026-12-06'); // Sun -> next Sun
  });

  it("the generated Sunday card is itself a valid composition", () => {
    for (let k = 0; k < 8; k++) {
      const sunday = deskSunday(addDays('2026-11-26', k * 7));
      const p = puzzleFor(sunday);
      const check = checkComposition(p.stamps, p.solution);
      expect(check.ok).toBe(true);
      if (check.ok) expect(check.par).toBe(p.par);
    }
  });

  it('rejects empty, tiny and off-card compositions', () => {
    const stamps = deskStamps('2026-11-29');
    expect(checkComposition(stamps, []).ok).toBe(false);
    expect(checkComposition(stamps, [{ stamp: stamps[0]!.id, row: 0, col: 0 }]).ok).toBe(false);
    expect(checkComposition(stamps, [{ stamp: stamps[0]!.id, row: 9, col: 9 }]).ok).toBe(false);
  });

  it('property: any accepted composition is solvable at its par, inside the desk band', () => {
    const stamps = deskStamps('2026-11-29');
    const press = fc.tuple(fc.integer({ min: 0, max: stamps.length - 1 }), fc.integer({ min: 0, max: SIZE - 1 }), fc.integer({ min: 0, max: SIZE - 1 }));
    fc.assert(
      fc.property(fc.array(press, { minLength: 1, maxLength: 9 }), (raw) => {
        const presses: Press[] = [];
        for (const [i, row, col] of raw) {
          const s = stamps[i]!;
          if (fits(shapeOf(s.shape), row, col)) presses.push({ stamp: s.id, row, col });
        }
        const c = checkComposition(stamps, presses);
        if (!c.ok) return;
        expect(c.par).toBeGreaterThanOrEqual(DESK_RULES.minPar);
        expect(c.par).toBeLessThanOrEqual(DESK_RULES.maxPar);
        expect(simulate(stamps, c.solution)).toEqual(c.target);
        expect(solve(stamps, c.target, 12)?.par).toBe(c.par);
      }),
      { numRuns: 150 }
    );
  });
});
