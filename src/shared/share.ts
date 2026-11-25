import type { MyResult } from './api';

const SQUARE: Record<string, string> = { R: '🟥', B: '🟦', Y: '🟨', K: '⬛' };

/** The text of a player's result comment. Plain text, no links. */
export function shareText(number: number, r: MyResult): string {
  const strip = r.strip
    .split('')
    .map((ink) => SQUARE[ink] ?? '')
    .join('');
  const verdict = r.presses <= r.par ? 'on par' : `${r.presses - r.par} over par`;
  return `Overprint No. ${number}: ${r.presses} presses, ${verdict}\n\n${strip}`;
}
