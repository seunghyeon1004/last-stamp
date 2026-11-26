import { context, reddit } from '@devvit/web/server';
import { puzzleFor, utcDateKey } from '../../shared/daily';
import { getDailyPostId, getPostComment, linkPost, setPostComment } from './state';
import { isT3 } from './ids';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function postTitle(date: string): string {
  const p = puzzleFor(date);
  const d = new Date(`${date}T00:00:00Z`);
  return `Last Stamp #${p.number}: ${WEEKDAY[p.weekday]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}, par ${p.par}`;
}

/** Creates the daily post for `date` once; returns the existing post id when already made. */
export async function ensureDailyPost(date: string = utcDateKey()): Promise<{ postId: string; created: boolean }> {
  const existing = await getDailyPostId(date);
  if (existing) return { postId: existing, created: false };
  const post = await reddit.submitCustomPost({
    title: postTitle(date),
    entry: 'default',
    postData: { date },
    textFallback: { text: `Last Stamp, the daily stamp puzzle for ${date}. Open this post in the Reddit app or on reddit.com to play.` },
  });
  await linkPost(post.id, date);
  const sticky = await ensureSticky(post.id);
  console.log(`daily post created: ${date} ${post.id} ${post.url} pinned=${sticky ?? 'none'}`);
  return { postId: post.id, created: true };
}

/** The one pinned comment per daily post that score replies go under. Created by the app account. */
export async function ensureSticky(postId: string): Promise<string | null> {
  const existing = await getPostComment(postId);
  if (existing) return existing;
  if (!isT3(postId)) return null;
  try {
    const comment = await reddit.submitComment({
      id: postId,
      text:
        `Results go here. Use "Comment my result" in the game to reply with your press count, ` +
        `or reply with the order you stamped in.`,
    });
    try {
      await comment.distinguish(true);
    } catch (err) {
      console.error('could not sticky the results comment', err);
    }
    await setPostComment(postId, comment.id);
    return comment.id;
  } catch (err) {
    console.error('results comment failed', err);
    return null;
  }
}

export function subredditName(): string {
  return context.subredditName ?? '';
}
