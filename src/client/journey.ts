import { telemetry } from '@devvit/analytics/client/reddit';

// Devvit Journeys instrumentation. Every call is fire-and-forget and can never break play.
// Events only reach Reddit's analytics after the app is approved in review (server-side allowlist).

let started = false;

function safe(fn: () => Promise<unknown>): void {
  try {
    void fn().catch(() => undefined);
  } catch {
    /* outside Reddit (local preview) */
  }
}

export const journey = {
  ready(): void {
    safe(() => telemetry.appReady());
  },
  /** Explicit start: the player's first committed press on today's sheet. */
  start(): void {
    if (started) return;
    started = true;
    safe(() => telemetry.startJourney());
  },
  /** After each committed press: share of inked cells that already match the target. */
  progress(fraction: number, presses: number): void {
    safe(() =>
      telemetry.progress({ progress: Math.max(0, Math.min(1, fraction)), action: 'press', actionDetails: `presses=${presses}` })
    );
  },
  interaction(action: 'lift' | 'new_sheet' | 'target' | 'comment' | 'flair'): void {
    safe(() => telemetry.interaction({ action }));
  },
  id(): string | undefined {
    try {
      return telemetry.getActiveJourneyId();
    } catch {
      return undefined;
    }
  },
};
