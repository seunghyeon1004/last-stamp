import { Hono } from 'hono';
import type { OnCommentDeleteRequest, OnPostDeleteRequest, TriggerResponse } from '@devvit/web/shared';
import { ensureDailyPost } from '../core/post';
import { forgetComment, forgetPost } from '../core/state';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const { postId } = await ensureDailyPost();
    return c.json<TriggerResponse>({ status: 'success', message: `daily post ${postId}` }, 200);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to create post' }, 400);
  }
});

// Devvit Rules: when a post or comment is deleted, drop what the app stored about it.
triggers.post('/on-post-delete', async (c) => {
  const input = await c.req.json<OnPostDeleteRequest>();
  if (input.postId) await forgetPost(input.postId);
  return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
});

triggers.post('/on-comment-delete', async (c) => {
  const input = await c.req.json<OnCommentDeleteRequest>();
  if (input.postId && input.commentId) await forgetComment(input.postId, input.commentId);
  return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
});
