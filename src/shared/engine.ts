// Last Stamp core rules: a 5x5 card, opaque inks, fixed-shape stamps (no rotation).
// A press lays one stamp's ink on every cell of its footprint, covering what was there.

export const SIZE = 5;
export const CELLS = SIZE * SIZE;

export type Ink = 'R' | 'B' | 'Y' | 'K';
export const INKS: readonly Ink[] = ['R', 'B', 'Y', 'K'];

/** A cell value on a sheet: an ink, or '.' for bare paper. */
export type Cell = Ink | '.';

/** Shape cells as [row, col] offsets, normalised so min row and min col are 0. */
export type Shape = readonly (readonly [number, number])[];

export type Stamp = {
  id: string; // stable within a day, e.g. 's0'
  ink: Ink;
  shape: string; // key into SHAPES
};

export type Press = {
  stamp: string; // Stamp.id
  row: number; // top-left of the shape's bounding box
  col: number;
};

/** Shape library. Names are internal; players only see the outline. */
export const SHAPES: Record<string, Shape> = {
  dot: [[0, 0]],
  duoH: [[0, 0], [0, 1]],
  duoV: [[0, 0], [1, 0]],
  diag: [[0, 0], [1, 1]],
  barH: [[0, 0], [0, 1], [0, 2]],
  barV: [[0, 0], [1, 0], [2, 0]],
  elbow: [[0, 0], [1, 0], [1, 1]],
  hook: [[0, 0], [0, 1], [1, 1]],
  square: [[0, 0], [0, 1], [1, 0], [1, 1]],
  tee: [[0, 0], [0, 1], [0, 2], [1, 1]],
  ell: [[0, 0], [1, 0], [2, 0], [2, 1]],
  jay: [[0, 1], [1, 1], [2, 0], [2, 1]],
  zed: [[0, 0], [0, 1], [1, 1], [1, 2]],
  ess: [[0, 1], [0, 2], [1, 0], [1, 1]],
  longH: [[0, 0], [0, 1], [0, 2], [0, 3]],
  longV: [[0, 0], [1, 0], [2, 0], [3, 0]],
  plus: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
  cup: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]],
  step: [[0, 0], [1, 0], [1, 1], [2, 1]],
  corner: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]],
  gap: [[0, 0], [0, 2]],
  chev: [[0, 0], [1, 1], [0, 2]],
};

export function shapeOf(key: string): Shape {
  const s = SHAPES[key];
  if (!s) throw new Error(`unknown shape ${key}`);
  return s;
}

export function shapeSize(shape: Shape): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  return { rows, cols };
}

export function fits(shape: Shape, row: number, col: number): boolean {
  const { rows, cols } = shapeSize(shape);
  return row >= 0 && col >= 0 && row + rows <= SIZE && col + cols <= SIZE;
}

/** Cell indices (row * SIZE + col) covered by a shape placed at row/col. */
export function footprint(shape: Shape, row: number, col: number): number[] {
  return shape.map(([r, c]) => (row + r) * SIZE + (col + c));
}

export function blankSheet(): Cell[] {
  return Array.from({ length: CELLS }, () => '.' as Cell);
}

export function applyPress(sheet: readonly Cell[], stamps: readonly Stamp[], press: Press): Cell[] {
  const stamp = stamps.find((s) => s.id === press.stamp);
  if (!stamp) throw new Error(`unknown stamp ${press.stamp}`);
  const shape = shapeOf(stamp.shape);
  if (!fits(shape, press.row, press.col)) throw new Error('press off the sheet');
  const next = sheet.slice();
  for (const i of footprint(shape, press.row, press.col)) next[i] = stamp.ink;
  return next;
}

export function simulate(stamps: readonly Stamp[], presses: readonly Press[]): Cell[] {
  let sheet = blankSheet();
  for (const p of presses) sheet = applyPress(sheet, stamps, p);
  return sheet;
}

export function sameSheet(a: readonly Cell[], b: readonly Cell[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function sheetToString(sheet: readonly Cell[]): string {
  return sheet.join('');
}

export function sheetFromString(s: string): Cell[] {
  if (s.length !== CELLS || !/^[RBYK.]+$/.test(s)) throw new Error('bad sheet string');
  return s.split('') as Cell[];
}

type Placement = { press: Press; ink: Ink; mask: number; cells: number[] };

/** All placements of all stamps that never touch bare paper in the target. */
function usefulPlacements(stamps: readonly Stamp[], target: readonly Cell[]): Placement[] {
  const out: Placement[] = [];
  for (const stamp of stamps) {
    const shape = shapeOf(stamp.shape);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (!fits(shape, row, col)) continue;
        const cells = footprint(shape, row, col);
        if (cells.some((i) => target[i] === '.')) continue;
        let mask = 0;
        for (const i of cells) mask |= 1 << i;
        out.push({ press: { stamp: stamp.id, row, col }, ink: stamp.ink, mask, cells });
      }
    }
  }
  return out;
}

export type Solution = { par: number; presses: Press[] };

/**
 * Minimum number of presses that reproduce `target`, with one optimal press order.
 * Works backwards ("peeling"): the last press must show its ink on every cell it covers
 * that a later press has not already explained. Breadth-first over the set of explained
 * cells gives the true minimum. Returns null when the target cannot be made.
 */
export function solve(stamps: readonly Stamp[], target: readonly Cell[], maxDepth = 12): Solution | null {
  let goal = 0;
  for (let i = 0; i < CELLS; i++) if (target[i] !== '.') goal |= 1 << i;
  if (goal === 0) return { par: 0, presses: [] };
  const placements = usefulPlacements(stamps, target);
  const parent = new Map<number, { prev: number; press: Press }>();
  parent.set(0, { prev: -1, press: { stamp: '', row: 0, col: 0 } });
  let frontier = [0];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const state of frontier) {
      for (const p of placements) {
        const fresh = p.mask & ~state;
        if (fresh === 0) continue;
        let ok = true;
        for (const i of p.cells) {
          if ((fresh >>> i) & 1 && target[i] !== p.ink) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const ns = (state | p.mask) >>> 0;
        if (parent.has(ns)) continue;
        parent.set(ns, { prev: state, press: p.press });
        if (ns === goal >>> 0) {
          // Walking back from the goal visits the deepest peel first. The deepest peel is
          // the earliest press on the card, so this walk is already in pressing order.
          const presses: Press[] = [];
          let s = ns;
          while (s !== 0) {
            const e = parent.get(s)!;
            presses.push(e.press);
            s = e.prev;
          }
          return { par: depth, presses };
        }
        next.push(ns);
      }
    }
    frontier = next;
  }
  return null;
}
