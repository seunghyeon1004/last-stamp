import { puzzleFor, type Puzzle } from '../../shared/daily';
import { sheetToString } from '../../shared/engine';
import type { CardOverride } from '../../shared/api';
import { sundayCard } from './desk';

/** The puzzle the server plays for a date: the generated card, or the community card on a decided Sunday. */
export async function serverPuzzle(date: string, today: string): Promise<{ puzzle: Puzzle; override: CardOverride | null }> {
  const base = puzzleFor(date);
  if (base.weekday !== 0 || date > today) return { puzzle: base, override: null };
  const card = await sundayCard(date);
  if (!card) return { puzzle: base, override: null };
  return {
    puzzle: { ...base, target: card.target, par: card.par, solution: card.solution },
    override: { target: sheetToString(card.target), par: card.par, author: card.author },
  };
}
