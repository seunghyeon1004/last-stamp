import { redis } from '@devvit/web/server';
import { cardKey, checkComposition, deskStamps, type DeskCard } from '../../shared/desk';
import { hashString } from '../../shared/daily';
import { sheetFromString, type Press } from '../../shared/engine';
import type { DeskEntry } from '../../shared/api';

// Redis layout for one Sunday S:
//   desk:S:rank        zset   entryId -> votes
//   desk:S:entry       hash   entryId -> JSON { target, par, presses, author, authorId, at }
//   desk:S:by          hash   userId  -> entryId          (one card per player per week)
//   desk:S:keys        hash   target  -> entryId          (no duplicate cards)
//   desk:S:votes:U     hash   entryId -> "1"              (a player's votes)
//   desk:S:winner      hash   { decided, id, target, par, author }
const k = {
  rank: (s: string) => `desk:${s}:rank`,
  entry: (s: string) => `desk:${s}:entry`,
  by: (s: string) => `desk:${s}:by`,
  keys: (s: string) => `desk:${s}:keys`,
  votes: (s: string, u: string) => `desk:${s}:votes:${u}`,
  winner: (s: string) => `desk:${s}:winner`,
};

type Stored = { target: string; par: number; presses: Press[]; author: string; authorId: string; at: number };

export async function listEntries(sunday: string, userId: string | undefined): Promise<{ entries: DeskEntry[]; mine: string | null }> {
  const [ranked, all, mine, myVotes] = await Promise.all([
    redis.zRange(k.rank(sunday), 0, 59, { by: 'rank', reverse: true }),
    redis.hGetAll(k.entry(sunday)),
    userId ? redis.hGet(k.by(sunday), userId) : Promise.resolve(undefined),
    userId ? redis.hGetAll(k.votes(sunday, userId)) : Promise.resolve({} as Record<string, string>),
  ]);
  const entries: DeskEntry[] = [];
  for (const { member, score } of ranked) {
    const raw = all[member];
    if (!raw) continue;
    const e = JSON.parse(raw) as Stored;
    entries.push({ id: member, target: e.target, par: e.par, author: e.author, votes: score, mine: member === mine, voted: !!myVotes[member], at: e.at });
  }
  return { entries, mine: mine ?? null };
}

export async function submitEntry(opts: {
  sunday: string;
  userId: string;
  username: string;
  presses: Press[];
}): Promise<{ ok: true; id: string; par: number } | { ok: false; reason: string }> {
  const { sunday, userId, username, presses } = opts;
  if (await redis.hGet(k.winner(sunday), 'decided')) return { ok: false, reason: 'This Sunday is already decided.' };
  if (await redis.hGet(k.by(sunday), userId)) return { ok: false, reason: 'You already have a card on the desk this week. Withdraw it to send another.' };
  const check = checkComposition(deskStamps(sunday), presses);
  if (!check.ok) return check;
  const key = cardKey(check.target);
  const id = `e${hashString(`${sunday}:${key}`).toString(36)}`;
  const claimed = await redis.hSetNX(k.keys(sunday), key, id);
  if (!claimed) return { ok: false, reason: 'Someone already sent this exact card.' };
  const stored: Stored = { target: key, par: check.par, presses, author: username, authorId: userId, at: Date.now() };
  await redis.hSet(k.entry(sunday), { [id]: JSON.stringify(stored) });
  await redis.hSet(k.by(sunday), { [userId]: id });
  await redis.zAdd(k.rank(sunday), { member: id, score: 0 });
  return { ok: true, id, par: check.par };
}

export async function withdrawEntry(sunday: string, userId: string): Promise<boolean> {
  if (await redis.hGet(k.winner(sunday), 'decided')) return false;
  const id = await redis.hGet(k.by(sunday), userId);
  if (!id) return false;
  const raw = await redis.hGet(k.entry(sunday), id);
  if (raw) {
    const e = JSON.parse(raw) as Stored;
    await redis.hDel(k.keys(sunday), [e.target]);
  }
  await redis.hDel(k.entry(sunday), [id]);
  await redis.hDel(k.by(sunday), [userId]);
  await redis.zRem(k.rank(sunday), [id]);
  return true;
}

/** Toggles a player's vote on an entry. Players cannot vote for their own card. */
export async function toggleVote(sunday: string, userId: string, id: string): Promise<{ ok: boolean; voted: boolean; reason?: string }> {
  if (await redis.hGet(k.winner(sunday), 'decided')) return { ok: false, voted: false, reason: 'Voting is closed.' };
  const raw = await redis.hGet(k.entry(sunday), id);
  if (!raw) return { ok: false, voted: false, reason: 'That card is gone.' };
  if ((JSON.parse(raw) as Stored).authorId === userId) return { ok: false, voted: false, reason: "That's your own card." };
  const had = await redis.hGet(k.votes(sunday, userId), id);
  if (had) {
    await redis.hDel(k.votes(sunday, userId), [id]);
    await redis.zIncrBy(k.rank(sunday), id, -1);
    return { ok: true, voted: false };
  }
  await redis.hSet(k.votes(sunday, userId), { [id]: '1' });
  await redis.zIncrBy(k.rank(sunday), id, 1);
  return { ok: true, voted: true };
}

/**
 * Sunday's community card, decided once. The top card with at least one vote wins (ties: the
 * earlier card). With no votes there is no community card and the date-seeded card is used.
 */
export async function sundayCard(sunday: string): Promise<DeskCard | null> {
  const w = await redis.hGetAll(k.winner(sunday));
  if (!w.decided) {
    const top = await redis.zRange(k.rank(sunday), 0, 19, { by: 'rank', reverse: true });
    const all = await redis.hGetAll(k.entry(sunday));
    let best: { id: string; votes: number; e: Stored } | null = null;
    for (const { member, score } of top) {
      const raw = all[member];
      if (!raw || score < 1) continue;
      const e = JSON.parse(raw) as Stored;
      if (!best || score > best.votes || (score === best.votes && e.at < best.e.at)) best = { id: member, votes: score, e };
    }
    const decided: Record<string, string> = best
      ? { decided: '1', id: best.id, target: best.e.target, par: String(best.e.par), author: best.e.author }
      : { decided: '1', id: '' };
    const first = await redis.hSetNX(k.winner(sunday), 'decided', '1');
    if (first) await redis.hSet(k.winner(sunday), decided);
    return sundayCard(sunday);
  }
  if (!w.id || !w.target) return null;
  const target = sheetFromString(w.target);
  const check = checkComposition(deskStamps(sunday), (JSON.parse((await redis.hGet(k.entry(sunday), w.id)) ?? '{"presses":[]}') as Stored).presses);
  return { target, par: Number(w.par), solution: check.ok ? check.solution : [], author: w.author ?? '' };
}
