import './styles.css';

import { StrictMode, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import { isDateKey, puzzleFor, utcDateKey } from '../shared/daily';
import type { StateResponse } from '../shared/api';
import { fetchState } from './api';
import { Sheet } from './Sheet';
import { StampGlyph, stampLabel } from './StampButton';
import { longDate, parLine } from './format';
import { postDate } from './context';

const COUNT = ['zero', 'one', 'two', 'three', 'four'];

/** Inline post: the puzzle itself is the headline. Target print = these stamps, in par presses. */
export function Splash() {
  const [server, setServer] = useState<StateResponse | null>(null);
  useEffect(() => {
    void fetchState().then(setServer);
  }, []);
  const date = server?.date ?? postDate() ?? utcDateKey();
  const puzzle = useMemo(() => puzzleFor(isDateKey(date) ? date : utcDateKey()), [date]);
  const done = server?.result ?? null;
  const n = puzzle.stamps.length;

  const open = (e: MouseEvent<HTMLButtonElement>) => {
    try {
      requestExpandedMode(e.nativeEvent, 'game');
    } catch {
      window.location.href = 'game.html';
    }
  };

  const meta = [
    server?.stats.solvers ? `${server.stats.solvers} ${server.stats.solvers === 1 ? 'printer' : 'printers'} today` : null,
    server?.stats.solvers ? `${Math.round((server.stats.atPar / server.stats.solvers) * 100)}% on par` : null,
    server?.player && server.player.streak > 0 ? `your streak ${server.player.streak}` : null,
  ].filter(Boolean);

  return (
    <main className="splash">
      <header className="splash-mast">
        <span className="wordmark wordmark-sm">Overprint</span>
        <span className="issue">
          No. {puzzle.number} · {longDate(puzzle.date)}
        </span>
      </header>

      <h1 className="splash-challenge">
        {done ? (
          <>You printed it in {done.presses}, {parLine(done.presses, done.par)}.</>
        ) : (
          <>
            Rebuild this print with {COUNT[n] ?? n} stamps.
            <span className="splash-par">Par {puzzle.par}</span>
          </>
        )}
      </h1>

      <div className="equation" aria-label={`Target print, made from ${n} stamps in ${puzzle.par} presses`}>
        <Sheet id="splash" label="Today's print" stamps={puzzle.stamps} flat={puzzle.target} grid className="splash-sheet" />
        <span className="eq-op" aria-hidden="true">
          =
        </span>
        <div className="eq-right">
          <ul className={`eq-stamps n${n}`}>
            {puzzle.stamps.map((s) => (
              <li key={s.id} className="eq-stamp" aria-label={stampLabel(s)}>
                <StampGlyph stamp={s} idPrefix="splash-stamp" />
              </li>
            ))}
          </ul>
          <p className="eq-presses">
            × <b>{puzzle.par}</b> presses
          </p>
        </div>
      </div>

      <button type="button" className="btn btn-ink btn-big" onClick={open}>
        {done ? 'See my sheet' : 'Start printing'}
      </button>
      <p className="splash-meta">{meta.length ? meta.join(' · ') : 'Ink is opaque: later presses cover earlier ones.'}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
