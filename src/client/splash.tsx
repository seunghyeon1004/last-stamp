import './styles.css';

import { StrictMode, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import { isDateKey, puzzleFor, utcDateKey } from '../shared/daily';
import type { StateResponse } from '../shared/api';
import { fetchState } from './api';
import { Sheet } from './Sheet';
import { longDate, parLine } from './format';
import { postDate } from './context';

export function Splash() {
  const [server, setServer] = useState<StateResponse | null>(null);
  useEffect(() => {
    void fetchState().then(setServer);
  }, []);
  const date = server?.date ?? postDate() ?? utcDateKey();
  const puzzle = useMemo(() => puzzleFor(isDateKey(date) ? date : utcDateKey()), [date]);
  const done = server?.result ?? null;

  const open = (e: MouseEvent<HTMLButtonElement>) => {
    try {
      requestExpandedMode(e.nativeEvent, 'game');
    } catch {
      window.location.href = 'game.html';
    }
  };

  return (
    <main className="splash">
      <header className="splash-head">
        <h1 className="wordmark wordmark-lg">Overprint</h1>
        <p className="issue">
          No. {puzzle.number} · {longDate(puzzle.date)}
        </p>
      </header>
      <figure className="splash-proof">
        <Sheet id="splash" label="Today's print" stamps={puzzle.stamps} flat={puzzle.target} className="splash-sheet" />
      </figure>
      <p className="splash-line">
        {done
          ? `You printed it in ${done.presses}, ${parLine(done.presses, done.par)}.`
          : `Rebuild today's print with ${puzzle.stamps.length} stamps. Par ${puzzle.par}.`}
      </p>
      <button type="button" className="btn btn-ink btn-big" onClick={open}>
        {done ? 'See my sheet' : 'Pull a sheet'}
      </button>
      <p className="splash-meta">
        {[
          server?.stats.solvers ? `${server.stats.solvers} ${server.stats.solvers === 1 ? 'printer' : 'printers'} today` : null,
          server?.stats.solvers ? `${Math.round((server.stats.atPar / server.stats.solvers) * 100)}% on par` : null,
          server?.player && server.player.streak > 0 ? `your streak ${server.player.streak}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Ink is opaque. Work out which press went first.'}
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
