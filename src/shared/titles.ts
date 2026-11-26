// Earned print-shop titles, worn as user flair only when the player asks for it.
export type Title = { name: string; pars: number; solved: number; bg: string; text: 'dark' | 'light' };

// Ordered from lowest to highest. A title needs both counts.
export const TITLES: readonly Title[] = [
  { name: 'Apprentice', solved: 1, pars: 0, bg: '#F2EDE4', text: 'dark' },
  { name: 'Inker', solved: 3, pars: 3, bg: '#F7D417', text: 'dark' },
  { name: 'Compositor', solved: 10, pars: 7, bg: '#1F6FB8', text: 'light' },
  { name: 'Master Printer', solved: 30, pars: 20, bg: '#E8414A', text: 'light' },
];

export function titleFor(stats: { solved: number; pars: number }): Title | null {
  let best: Title | null = null;
  for (const t of TITLES) if (stats.solved >= t.solved && stats.pars >= t.pars) best = t;
  return best;
}

export function nextTitle(stats: { solved: number; pars: number }): Title | null {
  for (const t of TITLES) if (stats.solved < t.solved || stats.pars < t.pars) return t;
  return null;
}

/** Flair text: the title, plus the streak when it is worth showing. No commas (Reddit flair CSV limit). */
export function flairText(title: Title, streak: number): string {
  return streak >= 3 ? `${title.name} | ${streak}-day streak` : title.name;
}
