// Emits today's puzzle taps for docs/video/record.mjs (run with VIDEO_OUT set).
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { puzzleFor, utcDateKey } from '../src/shared/daily';
import { SIZE } from '../src/shared/engine';
import { placeAt } from '../src/client/Sheet';
import { deskSunday } from '../src/shared/desk';

it.skipIf(!process.env.VIDEO_OUT)('video puzzle', () => {
  const p = puzzleFor(utcDateKey());
  const tapsFor = (pz: typeof p) => pz.solution.map((press) => {
    const stampIndex = pz.stamps.findIndex((s) => s.id === press.stamp);
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++) {
        const q = placeAt(pz.stamps[stampIndex]!, row, col);
        if (q.row === press.row && q.col === press.col) return { stampIndex, row, col };
      }
    throw new Error('no tap');
  });
  const taps = tapsFor(p);
  // the desk clip composes next Sunday's generated card, so its par is real
  const sun = puzzleFor(deskSunday(p.date));
  const strip = p.solution.map((s) => p.stamps.find((x) => x.id === s.stamp)!.ink).join('');
  writeFileSync(process.env.VIDEO_OUT!, JSON.stringify({ date: p.date, par: p.par, strip, taps, deskSunday: sun.date, deskPar: sun.par, deskTaps: tapsFor(sun) }));
});
