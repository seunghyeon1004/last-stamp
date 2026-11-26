import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { isDateKey, puzzleFor, utcDateKey } from '../../shared/daily';
import { CELLS, SIZE, sameSheet, simulate, type Press } from '../../shared/engine';
import type { CompleteRequest, CompleteResponse, DeskResponse, ErrorResponse, FlairResponse, ShareResponse, StateResponse } from '../../shared/api';
import { getPlayer, getPostDate, getResult, getStats, linkPost, recordResult, setWornFlair } from '../core/state';
import { endJourney } from './telemetry';
import { flairText, titleFor } from '../../shared/titles';
import { ensureSticky } from '../core/post';
import { serverPuzzle } from '../core/puzzle';
import { listEntries, submitEntry, toggleVote, withdrawEntry } from '../core/desk';
import { deskSunday } from '../../shared/desk';
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
  const { override } = await serverPuzzle(date, today);
  const [username, stats, result, player] = await Promise.all([
    reddit.getCurrentUsername(),
    getStats(date),
    userId ? getResult(date, userId) : Promise.resolve(null),
    userId ? getPlayer(userId, today) : Promise.resolve(null),
  ]);
  return c.json<StateResponse>({ type: 'state', date, today, username: username ?? null, result, player, stats, override });
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

  const { puzzle } = await serverPuzzle(date, today);
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

  // Journey.End carries the verified result (score = presses; win = finished at or under par).
  await endJourney(c.req.header('x-devvit-journey-id'), result.presses <= puzzle.par, result.presses);

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
  if (!result) return c.json(fail('finish the card first'), 400);
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

// Explicit, player-pressed action: wear the earned title as user flair in this community.
api.post('/flair', async (c) => {
  const { userId, subredditName } = context;
  if (!userId || !subredditName) return c.json(fail('log in to wear a title'), 400);
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('log in to wear a title'), 400);
  const player = await getPlayer(userId, utcDateKey());
  const title = titleFor(player);
  if (!title) return c.json(fail('finish a card first'), 400);
  const text = flairText(title, player.streak);
  await reddit.setUserFlair({
    subredditName,
    username,
    text,
    backgroundColor: title.bg,
    textColor: title.text,
  });
  await setWornFlair(userId, text);
  return c.json<FlairResponse>({ type: 'flair', text });
});

// ---------- Open Desk ----------

api.get('/desk', async (c) => {
  const { userId } = context;
  const sunday = deskSunday(utcDateKey());
  const { entries, mine } = await listEntries(sunday, userId);
  return c.json<DeskResponse>({ type: 'desk', sunday, open: true, loggedIn: !!userId, entries, mine });
});

api.post('/desk/submit', async (c) => {
  const { userId } = context;
  if (!userId) return c.json(fail('Log in to send a card.'), 400);
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to send a card.'), 400);
  const body = await c.req.json<{ presses: unknown }>();
  if (!validPresses(body.presses)) return c.json(fail('Bad presses.'), 400);
  const r = await submitEntry({ sunday: deskSunday(utcDateKey()), userId, username, presses: body.presses });
  if (!r.ok) return c.json(fail(r.reason), 400);
  return c.json({ type: 'submitted', id: r.id, par: r.par });
});

api.post('/desk/withdraw', async (c) => {
  const { userId } = context;
  if (!userId) return c.json(fail('Log in first.'), 400);
  const ok = await withdrawEntry(deskSunday(utcDateKey()), userId);
  return ok ? c.json({ type: 'withdrawn' }) : c.json(fail('Nothing to withdraw.'), 400);
});

api.post('/desk/vote', async (c) => {
  const { userId } = context;
  if (!userId) return c.json(fail('Log in to vote.'), 400);
  const { id } = await c.req.json<{ id: string }>();
  if (typeof id !== 'string' || id.length > 40) return c.json(fail('Bad card.'), 400);
  const r = await toggleVote(deskSunday(utcDateKey()), userId, id);
  if (!r.ok) return c.json(fail(r.reason ?? 'Could not vote.'), 400);
  return c.json({ type: 'voted', voted: r.voted });
});
