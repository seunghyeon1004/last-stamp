// Emits today's puzzle taps for docs/video/record.mjs (run with VIDEO_OUT set).
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { puzzleFor, utcDateKey } from '../src/shared/daily';
import { SIZE } from '../src/shared/engine';
import { placeAt } from '../src/client/Sheet';

it.skipIf(!process.env.VIDEO_OUT)('video puzzle', () => {
  const p = puzzleFor(utcDateKey());
  const taps = p.solution.map((press) => {
    const stampIndex = p.stamps.findIndex((s) => s.id === press.stamp);
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++) {
        const q = placeAt(p.stamps[stampIndex]!, row, col);
        if (q.row === press.row && q.col === press.col) return { stampIndex, row, col };
      }
    throw new Error('no tap');
  });
  const strip = p.solution.map((s) => p.stamps.find((x) => x.id === s.stamp)!.ink).join('');
  writeFileSync(process.env.VIDEO_OUT!, JSON.stringify({ date: p.date, par: p.par, strip, taps }));
});
