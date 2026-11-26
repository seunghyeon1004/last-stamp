import { describe, expect, it } from 'vitest';
import { cellName, describeCard, keyAction, startPos } from './a11y';
import type { Cell, Stamp } from '../shared/engine';

const bar: Stamp = { id: 's0', ink: 'R', shape: 'barH' }; // 1x3

describe('keyboard play', () => {
  it('does nothing without a stamp', () => {
    expect(keyAction('Enter', undefined, null).kind).toBe('none');
  });
  it('Enter first shows the outline in the middle, then presses', () => {
    expect(keyAction('Enter', bar, null)).toEqual({ kind: 'move', pos: startPos(bar) });
    expect(keyAction('Enter', bar, { row: 2, col: 1 })).toEqual({ kind: 'press' });
    expect(keyAction(' ', bar, { row: 2, col: 1 })).toEqual({ kind: 'press' });
  });
  it('arrows move one cell and never leave the card', () => {
    expect(keyAction('ArrowDown', bar, { row: 2, col: 1 })).toEqual({ kind: 'move', pos: { row: 3, col: 1 } });
    expect(keyAction('ArrowRight', bar, { row: 0, col: 2 })).toEqual({ kind: 'move', pos: { row: 0, col: 2 } });
    expect(keyAction('ArrowUp', bar, { row: 0, col: 0 })).toEqual({ kind: 'move', pos: { row: 0, col: 0 } });
  });
  it('Escape lifts the outline', () => {
    expect(keyAction('Escape', bar, { row: 1, col: 1 }).kind).toBe('clear');
  });
});

describe('screen-reader text', () => {
  it('names cells and reads a card row by row', () => {
    expect(cellName(1, 2)).toBe('row 2, column C');
    const card = 'RR...'.concat('.'.repeat(20)).split('') as Cell[];
    expect(describeCard(card)).toMatch(/^Row 1: red, red, blank, blank, blank\. Row 2: blank/);
  });
});
