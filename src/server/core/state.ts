import { redis } from '@devvit/web/server';
import { liveStreak, nextStreak } from '../../shared/streak';
import type { DayStats, MyResult, PlayerStats } from '../../shared/api';

// Redis layout (all small hashes):
//   post:{postId}        { date, commentId (the pinned results comment) }
//   daily:{date}         { postId }
//   user:{userId}        { streak, best, solved, pars, last, flair }
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

export async function getDailyPostId(date: string): Promise<string | undefined> {
  return (await redis.hGet(k.daily(date), 'postId')) ?? undefined;
}

export async function getPostComment(postId: string): Promise<string | undefined> {
  return (await redis.hGet(k.post(postId), 'commentId')) ?? undefined;
}

export async function setPostComment(postId: string, commentId: string): Promise<void> {
  await redis.hSet(k.post(postId), { commentId });
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
    flair: h.flair ?? null,
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

export async function getWornFlair(userId: string): Promise<string | undefined> {
  return (await redis.hGet(k.user(userId), 'flair')) ?? undefined;
}

export async function setWornFlair(userId: string, flair: string): Promise<void> {
  await redis.hSet(k.user(userId), { flair });
}

/** Post deleted: drop everything keyed by that post (date link, pinned comment id, daily pointer). */
export async function forgetPost(postId: string): Promise<void> {
  const date = await getPostDate(postId);
  if (date && (await getDailyPostId(date)) === postId) await redis.hDel(k.daily(date), ['postId']);
  await redis.del(k.post(postId));
}

/** Pinned results comment deleted: forget it so a new one can be made. */
export async function forgetComment(postId: string, commentId: string): Promise<void> {
  if ((await getPostComment(postId)) === commentId) await redis.hDel(k.post(postId), ['commentId']);
}
