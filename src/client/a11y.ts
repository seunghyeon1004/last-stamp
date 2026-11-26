// Keyboard play and screen-reader text, shared by the game and the Open desk.
import { SIZE, fits, shapeOf, type Cell, type Stamp } from '../shared/engine';
import { INK_NAME } from './ink';

export type Pos = { row: number; col: number };

/** Where a stamp lands when the card gets keyboard focus: roughly the middle, kept on the card. */
export function startPos(stamp: Stamp): Pos {
  const shape = shapeOf(stamp.shape);
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  return { row: Math.floor((SIZE - rows) / 2), col: Math.floor((SIZE - cols) / 2) };
}

export type KeyAction = { kind: 'move'; pos: Pos } | { kind: 'press' } | { kind: 'clear' } | { kind: 'none' };

/** Arrow keys move the outline one cell (it never leaves the card); Enter or Space presses; Escape lifts the outline. */
export function keyAction(key: string, stamp: Stamp | undefined, ghost: Pos | null): KeyAction {
  if (!stamp) return { kind: 'none' };
  if (key === 'Escape') return { kind: 'clear' };
  if (key === 'Enter' || key === ' ') return ghost ? { kind: 'press' } : { kind: 'move', pos: startPos(stamp) };
  const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  const step = d[key];
  if (!step) return { kind: 'none' };
  const from = ghost ?? startPos(stamp);
  const next = { row: from.row + (ghost ? step[0] : 0), col: from.col + (ghost ? step[1] : 0) };
  return fits(shapeOf(stamp.shape), next.row, next.col) ? { kind: 'move', pos: next } : { kind: 'move', pos: from };
}

const COLS = 'ABCDE';

/** "row 2, column C" (the card reads like a small chart). */
export function cellName(row: number, col: number): string {
  return `row ${row + 1}, column ${COLS[col]}`;
}

/** A row-by-row reading of a card, for screen readers. */
export function describeCard(cells: readonly Cell[]): string {
  const rows: string[] = [];
  for (let r = 0; r < SIZE; r++) {
    const parts = cells.slice(r * SIZE, r * SIZE + SIZE).map((c) => (c === '.' ? 'blank' : INK_NAME[c]));
    rows.push(`Row ${r + 1}: ${parts.join(', ')}.`);
  }
  return rows.join(' ');
}
