# Last Stamp

A daily stamp puzzle for Reddit, built on Devvit Web.

Every day there is one target card: a 5x5 picture in up to four inks. You get the rubber stamps that can make it, each a fixed shape in one ink. A stamp can be pressed as often as you like, anywhere it fits, and the ink is opaque: **the last stamp wins** wherever stamps overlap. Plan the order and copy the card in as few presses as you can. Par is the true minimum, found by a solver.

## How to play

1. Pick a stamp from the tray.
2. Tap your card to place it (a dashed outline shows where it will land).
3. Tap the same spot again, or hit **Press**.
4. **Lift** undoes the last press, **New card** starts over, hold **Target** to compare.
5. Match the target. The result card shows your presses against par, your streak and how the day went for everyone. Commenting your result and wearing your earned title as flair are optional buttons there.

## How the daily content is made

- Each UTC date is hashed (FNV-1a, `last-stamp:v3:YYYY-MM-DD`) into a seed for a small deterministic PRNG (mulberry32).
- The weekday sets the difficulty: Monday 2 stamps and par 2 to 3, rising to Saturday 4 stamps and par 6 to 8.
- The generator picks stamp shapes from a fixed library, presses them at seeded positions and keeps the card only if it passes the day's rules: every stamp is needed, the presses form one connected picture, at least half of them are partly covered by a later press, and there is enough ink on the card.
- A solver works backwards ("peeling": the last press must show its ink everywhere a later press does not cover it) with a breadth-first search, so the par it reports is the provable minimum.
- Tests check the next 60 days, plus a property test over random dates for three years, that every day is solvable at exactly par. Code: `src/shared/engine.ts`, `src/shared/daily.ts`.

## Reddit features used

- A daily post made by the scheduler, with one pinned results comment.
- Optional "Comment my result" (posted as the player, as a reply to the pinned comment) and optional "Wear as flair" for earned titles (Apprentice, Inker, Stampsmith, Master Stamper).
- Streaks and day statistics in Redis.
- Devvit Journeys events (they only report once the app has passed Reddit's review).
- Post and comment delete triggers that forget stored data.

## Development

Uses a project-local Node (no global install): `source env.sh` puts `.tools/node/bin` first on `PATH` (place Node 24.18+ in `.tools/node` first).

```
npm install
npm test            # vitest: engine, generator, 60-day solvability, streaks, titles
npx playwright test # local UI checks against the built client (offline preview)
npm run dev         # devvit playtest
```

## Use of AI in development

This game was designed and written with an AI coding agent (Claude) working under the direction of the developer: the agent proposed the mechanic, wrote the code, tests and this README, and the developer chose the design, played it on Reddit and reviewed the result. No AI-generated images are used; every visual is drawn with SVG and CSS.

## Licence

BSD-3-Clause (inherited from the Devvit React template). Fonts: Bricolage Grotesque and IBM Plex Mono, SIL Open Font License, bundled via Fontsource.
