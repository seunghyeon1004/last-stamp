import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { ensureDailyPost } from '../core/post';

export const scheduler = new Hono();

// Runs shortly after 00:00 UTC: posts the new day's card and its sticky reply thread.
scheduler.post('/daily-post', async (c) => {
  try {
    const { postId, created } = await ensureDailyPost();
    console.log(`daily-post: ${created ? 'created' : 'exists'} ${postId}`);
  } catch (error) {
    console.error('daily-post failed', error);
  }
  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
