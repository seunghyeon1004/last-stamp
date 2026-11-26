import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { ensureDailyPost } from '../core/post';

export const menu = new Hono();

menu.post('/post-today', async (c) => {
  try {
    const { postId, created } = await ensureDailyPost();
    return c.json<UiResponse>(
      {
        showToast: created ? "Today's card is posted" : "Today's card already exists",
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${postId}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create the daily post' }, 400);
  }
});
