import type { Press } from './engine';

export type DayStats = {
  solvers: number;
  atPar: number;
  histogram: Record<string, number>; // presses -> players
};

export type MyResult = {
  presses: number;
  par: number;
  ms: number;
  undos: number;
  strip: string; // inks in press order, e.g. "BRY"
  log?: Press[]; // the player's presses, to redraw their sheet
};

export type PlayerStats = {
  streak: number; // current daily streak (0 if broken)
  best: number;
  solved: number;
  pars: number;
  lastDay: string | null;
  flair: string | null; // flair text the player chose to wear, if any
};

export type StateResponse = {
  type: 'state';
  date: string; // the puzzle date this post plays
  today: string; // server's current UTC date
  username: string | null;
  result: MyResult | null; // this player's result for `date`, if any
  player: PlayerStats | null; // null when logged out
  stats: DayStats;
};

export type CompleteRequest = {
  date: string;
  presses: Press[];
  ms: number;
  undos: number;
};

export type CompleteResponse = {
  type: 'complete';
  result: MyResult;
  player: PlayerStats | null;
  stats: DayStats;
  countedForStreak: boolean;
};

export type ErrorResponse = { status: 'error'; message: string };

export type ShareResponse = { type: 'share'; commentId: string };

export type FlairResponse = { type: 'flair'; text: string };
