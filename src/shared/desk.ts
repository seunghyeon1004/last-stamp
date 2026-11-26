// The Open Desk: during the week players compose a card from next Sunday's stamps (presses only,
// no text), everyone votes, and the top card becomes Sunday's puzzle, credited to its maker.
// If there is no community card, Sunday falls back to the date-seeded card as usual.
import { addDays, puzzleFor } from './daily';
import { CELLS, fits, shapeOf, simulate, solve, type Cell, type Press, type Stamp } from './engine';

export const DESK_RULES = {
  minInked: 8,
  maxPresses: 12,
  minPar: 3,
  maxPar: 8,
  minStamps: 2,
} as const;

/** The Sunday a composition made on `date` is for: the coming Sunday (a Sunday composes for the next one). */
export function deskSunday(date: string): string {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, wd === 0 ? 7 : 7 - wd);
}

/** The stamps players may use for that Sunday: the generated Sunday card's own stamp set. */
export function deskStamps(sunday: string): Stamp[] {
  return puzzleFor(sunday).stamps;
}

export type DeskCheck = { ok: true; target: Cell[]; par: number; solution: Press[] } | { ok: false; reason: string };

/** Validates a composition and computes its true par. Shared by the composer (live) and the server (authoritative). */
export function checkComposition(stamps: readonly Stamp[], presses: readonly Press[]): DeskCheck {
  if (presses.length === 0) return { ok: false, reason: 'Press some stamps first.' };
  if (presses.length > DESK_RULES.maxPresses) return { ok: false, reason: `Use at most ${DESK_RULES.maxPresses} presses.` };
  for (const p of presses) {
    const s = stamps.find((x) => x.id === p.stamp);
    if (!s || !Number.isInteger(p.row) || !Number.isInteger(p.col) || !fits(shapeOf(s.shape), p.row, p.col))
      return { ok: false, reason: 'That press is off the card.' };
  }
  const target = simulate(stamps, presses);
  const inked = target.filter((c) => c !== '.').length;
  if (inked < DESK_RULES.minInked) return { ok: false, reason: `Cover at least ${DESK_RULES.minInked} cells.` };
  if (inked > CELLS - 2) return { ok: false, reason: 'Leave a little paper showing.' };
  const inks = new Set(target.filter((c) => c !== '.'));
  if (inks.size < DESK_RULES.minStamps) return { ok: false, reason: 'Show at least two inks.' };
  const sol = solve(stamps, target, DESK_RULES.maxPar + 1);
  if (!sol) return { ok: false, reason: `Too long: par must be ${DESK_RULES.maxPar} or less.` };
  if (sol.par < DESK_RULES.minPar) return { ok: false, reason: `Too easy: make it need at least ${DESK_RULES.minPar} presses.` };
  return { ok: true, target, par: sol.par, solution: sol.presses };
}

export type DeskCard = { target: Cell[]; par: number; solution: Press[]; author: string };

export const cardKey = (target: readonly Cell[]) => target.join('');
