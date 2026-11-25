import { context, reddit } from '@devvit/web/server';
import { puzzleFor, utcDateKey } from '../../shared/daily';
import { getDaily, linkPost, setDailyComment } from './state';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function postTitle(date: string): string {
  const p = puzzleFor(date);
  const d = new Date(`${date}T00:00:00Z`);
  return `Overprint No. ${p.number} · ${WEEKDAY[p.weekday]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} · par ${p.par}`;
}

/** Creates the daily post for `date` once; returns the existing post id when already made. */
export async function ensureDailyPost(date: string = utcDateKey()): Promise<{ postId: string; created: boolean }> {
  const existing = await getDaily(date);
  if (existing.postId) return { postId: existing.postId, created: false };
  const post = await reddit.submitCustomPost({
    title: postTitle(date),
    entry: 'default',
    postData: { date },
    textFallback: { text: `Overprint daily print for ${date}. Open this post in the Reddit app or on reddit.com to play.` },
  });
  await linkPost(post.id, date);
  try {
    const comment = await reddit.submitComment({
      id: post.id,
      text:
        `Today's print is up. Reply here with your result (the game has a button for it), ` +
        `and argue about which ink went down first.`,
    });
    await comment.distinguish(true);
    await setDailyComment(date, comment.id);
  } catch (err) {
    console.error('sticky comment failed', err);
  }
  return { postId: post.id, created: true };
}

export function subredditName(): string {
  return context.subredditName ?? '';
}
