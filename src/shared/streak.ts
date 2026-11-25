import { addDays } from './daily';

/** Streak as the player sees it today: a streak whose last day is before yesterday is broken. */
export function liveStreak(raw: { streak: number; last: string | null }, today: string): number {
  if (!raw.last) return 0;
  if (raw.last === today || raw.last === addDays(today, -1)) return raw.streak;
  return 0;
}

/** Next streak value when a player completes today's puzzle `date`. */
export function nextStreak(prev: { streak: number; last: string | null }, date: string): number {
  if (prev.last === date) return prev.streak;
  if (prev.last === addDays(date, -1)) return prev.streak + 1;
  return 1;
}
