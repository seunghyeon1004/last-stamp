import { redis } from '@devvit/web/server';
import { addDays } from '../../shared/daily';
import type { DayStats, MyResult, PlayerStats } from '../../shared/api';

// Redis layout (all small hashes):
//   post:{postId}        { date }
//   daily:{date}         { postId, commentId }
//   user:{userId}        { streak, best, solved, pars, last }
//   res:{date}           { [userId]: JSON MyResult }
//   hist:{date}          { [presses]: count }
//   stat:{date}          { solvers, atPar }

const k = {
  post: (postId: string) => `post:${postId}`,
  daily: (date: string) => `daily:${date}`,
  user: (userId: string) => `user:${userId}`,
  res: (date: string) => `res:${date}`,
  hist: (date: string) => `hist:${date}`,
  stat: (date: string) => `stat:${date}`,
};

export async function getPostDate(postId: string): Promise<string | undefined> {
  return (await redis.hGet(k.post(postId), 'date')) ?? undefined;
}

export async function linkPost(postId: string, date: string): Promise<void> {
  await redis.hSet(k.post(postId), { date });
  await redis.hSet(k.daily(date), { postId });
}

export async function getDaily(date: string): Promise<{ postId?: string; commentId?: string }> {
  const h = await redis.hGetAll(k.daily(date));
  const out: { postId?: string; commentId?: string } = {};
  if (h.postId) out.postId = h.postId;
  if (h.commentId) out.commentId = h.commentId;
  return out;
}

export async function setDailyComment(date: string, commentId: string): Promise<void> {
  await redis.hSet(k.daily(date), { commentId });
}

/** Streak as the player sees it today: a streak whose last day is before yesterday is broken. */
export function liveStreak(raw: { streak: number; last: string | null }, today: string): number {
  if (!raw.last) return 0;
  if (raw.last === today || raw.last === addDays(today, -1)) return raw.streak;
  return 0;
}

export async function getPlayer(userId: string, today: string): Promise<PlayerStats> {
  const h = await redis.hGetAll(k.user(userId));
  const last = h.last ?? null;
  const streak = Number(h.streak ?? 0);
  return {
    streak: liveStreak({ streak, last }, today),
    best: Number(h.best ?? 0),
    solved: Number(h.solved ?? 0),
    pars: Number(h.pars ?? 0),
    lastDay: last,
  };
}

export async function getResult(date: string, userId: string): Promise<MyResult | null> {
  const raw = await redis.hGet(k.res(date), userId);
  return raw ? (JSON.parse(raw) as MyResult) : null;
}

export async function getStats(date: string): Promise<DayStats> {
  const [stat, hist] = await Promise.all([redis.hGetAll(k.stat(date)), redis.hGetAll(k.hist(date))]);
  const histogram: Record<string, number> = {};
  for (const [presses, n] of Object.entries(hist)) histogram[presses] = Number(n);
  return { solvers: Number(stat.solvers ?? 0), atPar: Number(stat.atPar ?? 0), histogram };
}

/** Next streak value when a player completes `date` (only called for today's puzzle). */
export function nextStreak(prev: { streak: number; last: string | null }, date: string): number {
  if (prev.last === date) return prev.streak;
  if (prev.last === addDays(date, -1)) return prev.streak + 1;
  return 1;
}

/**
 * Records a verified completion once per player per day. Returns false when the player
 * already had a result for this date (first result stands).
 */
export async function recordResult(opts: {
  userId: string;
  date: string;
  today: string;
  result: MyResult;
}): Promise<{ fresh: boolean; countedForStreak: boolean }> {
  const { userId, date, today, result } = opts;
  const created = await redis.hSetNX(k.res(date), userId, JSON.stringify(result));
  if (!created) return { fresh: false, countedForStreak: false };

  await Promise.all([
    redis.hIncrBy(k.stat(date), 'solvers', 1),
    result.presses <= result.par ? redis.hIncrBy(k.stat(date), 'atPar', 1) : Promise.resolve(0),
    redis.hIncrBy(k.hist(date), String(result.presses), 1),
  ]);

  const h = await redis.hGetAll(k.user(userId));
  const prev = { streak: Number(h.streak ?? 0), last: h.last ?? null };
  const update: Record<string, string> = {
    solved: String(Number(h.solved ?? 0) + 1),
    pars: String(Number(h.pars ?? 0) + (result.presses <= result.par ? 1 : 0)),
  };
  // Streaks count the day's own puzzle only; playing an old post is archive play.
  const countedForStreak = date === today;
  if (countedForStreak) {
    const streak = nextStreak(prev, date);
    update.streak = String(streak);
    update.last = date;
    update.best = String(Math.max(Number(h.best ?? 0), streak));
  }
  await redis.hSet(k.user(userId), update);
  return { fresh: true, countedForStreak };
}
