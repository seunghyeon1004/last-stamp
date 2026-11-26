import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';

// Devvit Journeys, served at the paths the @devvit/analytics client calls (/api/telemetry/journey/*).
// Journey.End is sent by /api/complete after the server has verified the finished sheet.
// Note: Reddit only records these events once the app has passed review and is allowlisted.
export const journeys = new Hono();

const str = (x: unknown, max = 64): string | undefined =>
  typeof x === 'string' && x.length > 0 ? x.slice(0, max) : undefined;

async function body(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

journeys.post('/journey/app-ready', async (c) => c.json(await telemetry.appReady()));

journeys.post('/journey/start', async (c) => c.json(await telemetry.startJourney()));

journeys.post('/journey/progress', async (c) => {
  const b = await body(c);
  const journeyId = str(b.journeyId, 128);
  const progress = typeof b.progress === 'number' && Number.isFinite(b.progress) ? Math.min(1, Math.max(0, b.progress)) : null;
  if (!journeyId || progress === null) return c.json({ error: 'bad progress request' }, 400);
  return c.json(
    await telemetry.journeyProgress({
      journeyId,
      progress,
      action: str(b.action) ?? 'press',
      actionDetails: str(b.actionDetails) ?? '',
    })
  );
});

journeys.post('/journey/interaction', async (c) => {
  const b = await body(c);
  const action = str(b.action);
  if (!action) return c.json({ error: 'bad interaction request' }, 400);
  return c.json(
    await telemetry.journeyInteraction({
      journeyId: str(b.journeyId, 128) ?? '',
      action,
      actionDetails: str(b.actionDetails) ?? '',
    })
  );
});

/** Ends the player's journey with the verified result. Failures never block the game. */
export async function endJourney(journeyId: string | undefined, win: boolean, score: number): Promise<void> {
  if (!journeyId) return;
  try {
    await telemetry.endJourney({ journeyId, complete: true, game: { win, score } });
  } catch (err) {
    console.error('journey end failed', err);
  }
}
