import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  SHAPES,
  SIZE,
  fits,
  sheetFromString,
  sheetToString,
  shapeOf,
  simulate,
  solve,
  type Ink,
  type Press,
  type Stamp,
} from './engine';

const st = (id: string, ink: Ink, shape: string): Stamp => ({ id, ink, shape });
const at = (stamp: string, pos: string): Press => ({
  stamp,
  row: Number(pos[0]) - 1,
  col: 'abcde'.indexOf(pos[1]!),
});

// The five paper-playtest days from docs/GATE0.md.
const PAPER = [
  { stamps: [st('R', 'R', 'square'), st('B', 'B', 'barH')], presses: [at('R', '1a'), at('B', '2b')], par: 2 },
  {
    stamps: [st('R', 'R', 'elbow'), st('B', 'B', 'square'), st('Y', 'Y', 'barV')],
    presses: [at('B', '2b'), at('R', '1c'), at('Y', '3c')],
    par: 3,
  },
  {
    stamps: [st('R', 'R', 'square'), st('B', 'B', 'barH')],
    presses: [at('R', '1a'), at('B', '2a'), at('R', '3b'), at('B', '4c')],
    par: 4,
  },
  {
    stamps: [st('R', 'R', 'tee'), st('B', 'B', 'square'), st('Y', 'Y', 'barV')],
    presses: [at('Y', '1b'), at('R', '2a'), at('B', '3b'), at('Y', '3d'), at('R', '4c')],
    par: 5,
  },
  {
    stamps: [st('R', 'R', 'barH'), st('B', 'B', 'square'), st('Y', 'Y', 'ell'), st('K', 'K', 'diag')],
    presses: [at('B', '1a'), at('Y', '1b'), at('R', '3a'), at('K', '2c'), at('B', '4c'), at('K', '4b'), at('R', '5c')],
    par: 7,
  },
];

/** Exhaustive forward search, only for tiny cases: is there a solution with <= n presses? */
function bruteForceMin(stamps: Stamp[], target: string, limit: number): number | null {
  const moves: Press[] = [];
  for (const s of stamps)
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++) if (fits(shapeOf(s.shape), row, col)) moves.push({ stamp: s.id, row, col });
  for (let n = 0; n <= limit; n++) {
    const seq: Press[] = [];
    const rec = (k: number): boolean => {
      if (k === n) return sheetToString(simulate(stamps, seq)) === target;
      for (const m of moves) {
        seq.push(m);
        if (rec(k + 1)) return true;
        seq.pop();
      }
      return false;
    };
    if (rec(0)) return n;
  }
  return null;
}

describe('engine', () => {
  it('reproduces the Gate 0 paper playtest pars', () => {
    for (const day of PAPER) {
      const target = simulate(day.stamps, day.presses);
      const sol = solve(day.stamps, target);
      expect(sol?.par).toBe(day.par);
      expect(simulate(day.stamps, sol!.presses)).toEqual(target);
    }
  });

  it('round-trips sheet strings', () => {
    const s = 'RR...RBBB................';
    expect(sheetToString(sheetFromString(s))).toBe(s);
    expect(() => sheetFromString('xx')).toThrow();
  });

  it('solver agrees with exhaustive search on small random prints', () => {
    const shapeKeys = Object.keys(SHAPES);
    fc.assert(
      fc.property(
        fc.constantFrom(...shapeKeys),
        fc.constantFrom(...shapeKeys),
        fc.array(fc.tuple(fc.integer({ min: 0, max: 1 }), fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 })), {
          minLength: 1,
          maxLength: 2,
        }),
        (a, b, raw) => {
          const stamps = [st('a', 'R', a), st('b', 'B', b)];
          const presses: Press[] = [];
          for (const [which, row, col] of raw) {
            const s = stamps[which]!;
            if (fits(shapeOf(s.shape), row, col)) presses.push({ stamp: s.id, row, col });
          }
          const target = simulate(stamps, presses);
          const sol = solve(stamps, target)!;
          expect(sol).not.toBeNull();
          expect(sol.par).toBeLessThanOrEqual(presses.length);
          expect(simulate(stamps, sol.presses)).toEqual(target);
          expect(bruteForceMin(stamps, sheetToString(target), 2)).toBe(sol.par);
        }
      ),
      { numRuns: 60 }
    );
  });

  it('any random print is solvable at or under the presses that made it', () => {
    const shapeKeys = Object.keys(SHAPES);
    const press = fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 }));
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...shapeKeys), { minLength: 4, maxLength: 4 }), fc.array(press, { maxLength: 7 }), (shapes, raw) => {
        const inks: Ink[] = ['R', 'B', 'Y', 'K'];
        const stamps = shapes.map((s, i) => st(`s${i}`, inks[i]!, s));
        const presses: Press[] = [];
        for (const [which, row, col] of raw) {
          const s = stamps[which]!;
          if (fits(shapeOf(s.shape), row, col)) presses.push({ stamp: s.id, row, col });
        }
        const target = simulate(stamps, presses);
        const sol = solve(stamps, target, 8);
        expect(sol).not.toBeNull();
        expect(sol!.par).toBeLessThanOrEqual(presses.length);
        expect(sol!.presses).toHaveLength(sol!.par);
        expect(simulate(stamps, sol!.presses)).toEqual(target);
      }),
      { numRuns: 300 }
    );
  });
});
