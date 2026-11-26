import './styles.css';

import { StrictMode, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import { isDateKey, puzzleFor, utcDateKey } from '../shared/daily';
import { sheetFromString } from '../shared/engine';
import type { StateResponse } from '../shared/api';
import { fetchState } from './api';
import { Sheet } from './Sheet';
import { StampBlock, stampLabel } from './StampButton';
import { longDate, parLine } from './format';
import { postDate } from './context';

const COUNT = ['zero', 'one', 'two', 'three', 'four'];

/** Inline post: the puzzle itself is the headline. Target card = these stamps, in par presses. */
export function Splash() {
  const [server, setServer] = useState<StateResponse | null>(null);
  useEffect(() => {
    void fetchState().then(setServer);
  }, []);
  const date = server?.date ?? postDate() ?? utcDateKey();
  const override = server?.override ?? null;
  const puzzle = useMemo(() => {
    const base = puzzleFor(isDateKey(date) ? date : utcDateKey());
    return override ? { ...base, target: sheetFromString(override.target), par: override.par } : base;
  }, [date, override]);
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
    server?.stats.solvers ? `${server.stats.solvers} ${server.stats.solvers === 1 ? 'player' : 'players'} today` : null,
    server?.stats.solvers ? `${Math.round((server.stats.atPar / server.stats.solvers) * 100)}% on par` : null,
    server?.player && server.player.streak > 0 ? `your streak ${server.player.streak}` : null,
  ].filter((x): x is string => Boolean(x));

  return (
    <main className="splash">
      <header className="splash-mast">
        <span className="wordmark wordmark-sm">Last Stamp</span>
        <span className="issue">
          <span>No. {puzzle.number}</span>
          <span>{longDate(puzzle.date)}</span>
        </span>
      </header>

      <h1 className="splash-challenge">
        {done ? (
          <>You stamped it in {done.presses}, {parLine(done.presses, done.par)}.</>
        ) : (
          <>
            Stamp this card with {COUNT[n] ?? n} stamps.
            <span className="splash-par">Par {puzzle.par}</span>
          </>
        )}
      </h1>

      <div className="equation" aria-label={`Target card, made from ${n} stamps in ${puzzle.par} presses`}>
        <Sheet id="splash" label="Today's card" stamps={puzzle.stamps} flat={puzzle.target} grid className="splash-sheet" />
        <span className="eq-op" aria-hidden="true">
          =
        </span>
        <div className="eq-right">
          <ul className={`eq-stamps n${n}`}>
            {puzzle.stamps.map((s) => (
              <li key={s.id} className="eq-stamp" aria-label={stampLabel(s)}>
                <StampBlock stamp={s} idPrefix="splash-stamp" />
              </li>
            ))}
          </ul>
          <p className="eq-presses">
            × <b>{puzzle.par}</b> presses
          </p>
        </div>
      </div>

      {override && <p className="splash-credit">Chosen at the Open desk: a card by u/{override.author}</p>}
      <button type="button" className="btn btn-primary btn-big" onClick={open}>
        {done ? 'See my card' : 'Start stamping'}
      </button>
      <button
        type="button"
        className="link-btn"
        onClick={(e) => {
          try {
            requestExpandedMode(e.nativeEvent, 'desk');
          } catch {
            window.location.href = 'desk.html';
          }
        }}
      >
        Make next Sunday's card
      </button>
      <p className="splash-meta">
        {meta.length ? meta.map((m) => <span key={m}>{m}</span>) : <span>The last stamp wins: a later press covers what is under it.</span>}
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
