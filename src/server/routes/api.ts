import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { isDateKey, puzzleFor, utcDateKey } from '../../shared/daily';
import { CELLS, SIZE, sameSheet, simulate, type Press } from '../../shared/engine';
import type { CompleteRequest, CompleteResponse, ErrorResponse, ShareResponse, StateResponse } from '../../shared/api';
import { getPlayer, getPostDate, getResult, getStats, linkPost, recordResult } from '../core/state';
import { ensureSticky } from '../core/post';
import { isT1 } from '../core/ids';
import { shareText } from '../../shared/share';

export const api = new Hono();

const fail = (message: string) => ({ status: 'error', message }) satisfies ErrorResponse;

/** The puzzle date a post plays. Posts made before linking default to the day they are first opened. */
async function dateForPost(postId: string, today: string): Promise<string> {
  const d = await getPostDate(postId);
  if (d && isDateKey(d)) return d;
  await linkPost(postId, today);
  return today;
}

api.get('/state', async (c) => {
  const { postId, userId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  const today = utcDateKey();
  const date = await dateForPost(postId, today);
  const [username, stats, result, player] = await Promise.all([
    reddit.getCurrentUsername(),
    getStats(date),
    userId ? getResult(date, userId) : Promise.resolve(null),
    userId ? getPlayer(userId, today) : Promise.resolve(null),
  ]);
  return c.json<StateResponse>({ type: 'state', date, today, username: username ?? null, result, player, stats });
});

function validPresses(x: unknown): x is Press[] {
  return (
    Array.isArray(x) &&
    x.length <= 60 &&
    x.every(
      (p) =>
        p &&
        typeof p.stamp === 'string' &&
        Number.isInteger(p.row) &&
        Number.isInteger(p.col) &&
        p.row >= 0 &&
        p.col >= 0 &&
        p.row < SIZE &&
        p.col < SIZE
    )
  );
}

api.post('/complete', async (c) => {
  const { postId, userId } = context;
  if (!postId) return c.json(fail('postId missing'), 400);
  const body = await c.req.json<CompleteRequest>();
  const today = utcDateKey();
  const date = await dateForPost(postId, today);
  if (body.date !== date) return c.json(fail('wrong puzzle date'), 400);
  if (!validPresses(body.presses)) return c.json(fail('bad presses'), 400);

  const puzzle = puzzleFor(date);
  let sheet;
  try {
    sheet = simulate(puzzle.stamps, body.presses);
  } catch {
    return c.json(fail('invalid press'), 400);
  }
  if (sheet.length !== CELLS || !sameSheet(sheet, puzzle.target)) return c.json(fail('sheet does not match'), 400);

  const ink = new Map(puzzle.stamps.map((s) => [s.id, s.ink]));
  const result = {
    presses: body.presses.length,
    par: puzzle.par,
    ms: Math.max(0, Math.min(Number(body.ms) || 0, 86_400_000)),
    undos: Math.max(0, Math.min(Number(body.undos) || 0, 9999)),
    strip: body.presses.map((p) => ink.get(p.stamp) ?? '?').join(''),
    log: body.presses.map((p) => ({ stamp: p.stamp, row: p.row, col: p.col })),
  };

  if (!userId) {
    return c.json<CompleteResponse>({
      type: 'complete',
      result,
      player: null,
      stats: await getStats(date),
      countedForStreak: false,
    });
  }
  const { countedForStreak } = await recordResult({ userId, date, today, result });
  const [stored, player, stats] = await Promise.all([getResult(date, userId), getPlayer(userId, today), getStats(date)]);
  return c.json<CompleteResponse>({
    type: 'complete',
    result: stored ?? result,
    player,
    stats,
    countedForStreak,
  });
});

// Explicit, player-pressed action: reply to the pinned results comment as the player.
api.post('/share', async (c) => {
  const { postId, userId } = context;
  if (!postId || !userId) return c.json(fail('log in to comment'), 400);
  const today = utcDateKey();
  const date = await dateForPost(postId, today);
  const result = await getResult(date, userId);
  if (!result) return c.json(fail('finish the print first'), 400);
  const stickyId = await ensureSticky(postId);
  if (!stickyId || !isT1(stickyId)) return c.json(fail('no results thread on this post'), 500);
  const puzzle = puzzleFor(date);
  const comment = await reddit.submitComment({
    id: stickyId,
    text: shareText(puzzle.number, result),
    runAs: 'USER',
  });
  return c.json<ShareResponse>({ type: 'share', commentId: comment.id });
});
