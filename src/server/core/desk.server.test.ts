// Server tests for the Open desk vote/winner path and the Sunday post, against an in-memory
// Redis fake (exactly the hash and sorted-set calls the code uses) and a stubbed Reddit client.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRedis } from './fakeRedis';
import { checkComposition, deskStamps } from '../../shared/desk';
import { puzzleFor } from '../../shared/daily';
import { SIZE, fits, shapeOf, sheetToString, type Press } from '../../shared/engine';

const fake = { redis: new FakeRedis() };
const posts: { title: string; postData: unknown }[] = [];
const comments: { id: string; text: string; stickied: boolean }[] = [];

vi.mock('@devvit/web/server', () => ({
  get redis() {
    return fake.redis;
  },
  context: { subredditName: 'LastStamp' },
  reddit: {
    submitCustomPost: async (opts: { title: string; postData: unknown }) => {
      posts.push({ title: opts.title, postData: opts.postData });
      return { id: `t3_p${posts.length}`, url: `https://reddit.test/p${posts.length}` };
    },
    submitComment: async (opts: { id: string; text: string }) => {
      const c = { id: `t1_c${comments.length + 1}`, text: opts.text, stickied: false };
      comments.push(c);
      return { id: c.id, distinguish: async (sticky: boolean) => void (c.stickied = sticky) };
    },
  },
}));

const { submitEntry, toggleVote, withdrawEntry, sundayCard, listEntries } = await import('./desk');
const { serverPuzzle } = await import('./puzzle');
const { ensureDailyPost } = await import('./post');

const SUNDAY = '2026-11-29';
const stamps = deskStamps(SUNDAY);

/** Distinct valid compositions: the generated Sunday card, then variants with one extra press. */
function compositions(n: number): Press[][] {
  const base = puzzleFor(SUNDAY).solution;
  const out: Press[][] = [base];
  const seen = new Set([sheetToString(puzzleFor(SUNDAY).target)]);
  for (const s of stamps)
    for (let row = 0; row < SIZE && out.length < n; row++)
      for (let col = 0; col < SIZE && out.length < n; col++) {
        if (!fits(shapeOf(s.shape), row, col)) continue;
        const presses = [...base, { stamp: s.id, row, col }];
        const c = checkComposition(stamps, presses);
        if (c.ok && !seen.has(sheetToString(c.target))) {
          seen.add(sheetToString(c.target));
          out.push(presses);
        }
      }
  if (out.length < n) throw new Error('not enough compositions');
  return out;
}

async function send(user: string, presses: Press[], at: string) {
  vi.setSystemTime(new Date(at));
  const r = await submitEntry({ sunday: SUNDAY, userId: `t2_${user}`, username: user, presses });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}

beforeEach(() => {
  fake.redis = new FakeRedis();
  posts.length = 0;
  comments.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('open desk votes', () => {
  it('vote, unvote, and the rank follows', async () => {
    const [a] = compositions(1);
    const id = await send('maker', a!, '2026-11-26T10:00:00Z');
    expect(await toggleVote(SUNDAY, 't2_fan', id)).toEqual({ ok: true, voted: true });
    let list = await listEntries(SUNDAY, 't2_fan');
    expect(list.entries[0]).toMatchObject({ id, votes: 1, voted: true, mine: false });
    expect(await toggleVote(SUNDAY, 't2_fan', id)).toEqual({ ok: true, voted: false });
    list = await listEntries(SUNDAY, 't2_fan');
    expect(list.entries[0]).toMatchObject({ votes: 0, voted: false });
  });

  it('rejects a vote on your own card', async () => {
    const [a] = compositions(1);
    const id = await send('maker', a!, '2026-11-26T10:00:00Z');
    const r = await toggleVote(SUNDAY, 't2_maker', id);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/own card/);
  });

  it('rejects a vote on a withdrawn card', async () => {
    const [a] = compositions(1);
    const id = await send('maker', a!, '2026-11-26T10:00:00Z');
    expect(await withdrawEntry(SUNDAY, 't2_maker')).toBe(true);
    const r = await toggleVote(SUNDAY, 't2_fan', id);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/gone/);
    expect((await listEntries(SUNDAY, 't2_fan')).entries).toHaveLength(0);
  });

  it('allows one card per player and no duplicates', async () => {
    const [a, b] = compositions(2);
    await send('maker', a!, '2026-11-26T10:00:00Z');
    const again = await submitEntry({ sunday: SUNDAY, userId: 't2_maker', username: 'maker', presses: b! });
    expect(again.ok).toBe(false);
    const dup = await submitEntry({ sunday: SUNDAY, userId: 't2_other', username: 'other', presses: a! });
    expect(dup.ok).toBe(false);
  });
});

describe('sunday winner', () => {
  it('the top card wins and becomes the Sunday puzzle', async () => {
    const [a, b] = compositions(2);
    const idA = await send('alice', a!, '2026-11-26T10:00:00Z');
    const idB = await send('bob', b!, '2026-11-27T10:00:00Z');
    await toggleVote(SUNDAY, 't2_v1', idB);
    await toggleVote(SUNDAY, 't2_v2', idB);
    await toggleVote(SUNDAY, 't2_v3', idA);
    vi.setSystemTime(new Date('2026-11-29T00:01:00Z'));
    const card = await sundayCard(SUNDAY);
    expect(card?.author).toBe('bob');
    const { puzzle, override } = await serverPuzzle(SUNDAY, SUNDAY);
    const expected = checkComposition(stamps, b!);
    expect(expected.ok).toBe(true);
    if (expected.ok) {
      expect(puzzle.target).toEqual(expected.target);
      expect(puzzle.par).toBe(expected.par);
    }
    expect(override).toMatchObject({ author: 'bob', par: puzzle.par });
  });

  it('a tie goes to the earlier card', async () => {
    const [a, b] = compositions(2);
    const late = await send('late', b!, '2026-11-28T10:00:00Z');
    const early = await send('early', a!, '2026-11-26T09:00:00Z');
    await toggleVote(SUNDAY, 't2_v1', late);
    await toggleVote(SUNDAY, 't2_v2', early);
    expect((await sundayCard(SUNDAY))?.author).toBe('early');
  });

  it('no votes falls back to the seeded card', async () => {
    const [a] = compositions(1);
    await send('maker', a!, '2026-11-26T10:00:00Z');
    expect(await sundayCard(SUNDAY)).toBeNull();
    const { puzzle, override } = await serverPuzzle(SUNDAY, SUNDAY);
    expect(override).toBeNull();
    expect(puzzle).toEqual(puzzleFor(SUNDAY));
  });

  it('no submissions at all falls back to the seeded card', async () => {
    const { puzzle, override } = await serverPuzzle(SUNDAY, SUNDAY);
    expect(override).toBeNull();
    expect(puzzle.target).toEqual(puzzleFor(SUNDAY).target);
  });

  it('a future Sunday is never decided early', async () => {
    const [a] = compositions(1);
    const id = await send('maker', a!, '2026-11-26T10:00:00Z');
    await toggleVote(SUNDAY, 't2_v1', id);
    const { override } = await serverPuzzle(SUNDAY, '2026-11-28');
    expect(override).toBeNull();
    expect(await toggleVote(SUNDAY, 't2_v2', id)).toMatchObject({ ok: true }); // voting still open
  });
});

describe('the Sunday post', () => {
  it('carries the credit, and a second run of the job is idempotent', async () => {
    const [a, b] = compositions(2);
    const idA = await send('alice', a!, '2026-11-26T10:00:00Z');
    await send('bob', b!, '2026-11-27T10:00:00Z');
    await toggleVote(SUNDAY, 't2_v1', idA);

    vi.setSystemTime(new Date('2026-11-29T00:02:00Z'));
    const first = await ensureDailyPost(SUNDAY);
    expect(first.created).toBe(true);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.title).toMatch(/^Last Stamp #7: Sun 29 Nov, par \d, a card by u\/alice$/);
    expect(comments.filter((c) => c.stickied)).toHaveLength(1);

    // late votes after the decision change nothing; the job runs again
    const bobId = (await listEntries(SUNDAY, undefined)).entries.find((e) => e.author === 'bob')!.id;
    expect((await toggleVote(SUNDAY, 't2_v2', bobId)).ok).toBe(false); // voting closed
    const second = await ensureDailyPost(SUNDAY);
    expect(second).toEqual({ postId: first.postId, created: false });
    expect(posts).toHaveLength(1);
    expect((await sundayCard(SUNDAY))?.author).toBe('alice');
  });

  it('a weekday post has no credit', async () => {
    vi.setSystemTime(new Date('2026-11-26T00:02:00Z'));
    await ensureDailyPost('2026-11-26');
    expect(posts[0]!.title).toBe(`Last Stamp #4: Thu 26 Nov, par ${puzzleFor('2026-11-26').par}`);
  });
});
