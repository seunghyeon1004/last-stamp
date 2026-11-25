# Overprint

A daily print-shop puzzle for Reddit, built on Devvit Web.

Every day there is one finished print: a 5x5 sheet of red, blue, yellow (and on hard days black) ink. You get the rubber stamps that made it. Ink is opaque, so a later press covers an earlier one. Work out which stamp went where, and in what order, and pull the same print in as few presses as you can. Par is the true minimum, found by a solver.

## How to play

1. Pick a stamp from the tray.
2. Tap the sheet to place it (a dashed outline shows where it will land).
3. Tap the same spot again, or hit **Press**, to print it.
4. **Lift** undoes the last press, **New sheet** starts over, hold **Proof** to compare with the target.
5. Match the proof. The result card shows your presses against par, your streak and how the day went for everyone.

## How the daily content is made

- Each UTC date is hashed (FNV-1a, `overprint:v1:YYYY-MM-DD`) into a seed for a small deterministic PRNG (mulberry32).
- The weekday sets the difficulty band: Monday 2 stamps / par 2-3, rising to Saturday 4 stamps / par 6-8.
- The generator picks stamp shapes from a fixed library, presses them at seeded positions and keeps the sheet only if it passes the band and quality rules (every stamp needed, something is buried, enough ink on the sheet).
- A solver works backwards ("peeling": the last press must show its ink everywhere it is not covered later) with a breadth-first search, so the par it reports is the provable minimum.
- Tests check the next 60 days, plus a property test over random dates for three years, that every day is solvable at exactly par. Code: `src/shared/engine.ts`, `src/shared/daily.ts`.

## Development

Uses a project-local Node (no global install): `source env.sh` puts `.tools/node/bin` first on `PATH` (fetch Node 24.18+ into `.tools/node` first).

```
npm install
npm test            # vitest: engine, generator, 60-day solvability
npx playwright test # local UI checks against the built client (offline preview)
npm run dev         # devvit playtest
```

## Use of AI in development

This game was designed and written with an AI coding agent (Claude) working under the direction of the developer: the agent proposed the mechanic, wrote the code, tests and this README, and the developer chose the design and reviewed the result. No AI-generated images are used; all visuals are drawn with SVG and CSS.

## Licence

BSD-3-Clause (inherited from the Devvit React template). Fonts: Bricolage Grotesque and IBM Plex Mono, SIL Open Font License, bundled via Fontsource.
