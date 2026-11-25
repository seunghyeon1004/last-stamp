import './styles.css';

import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { canRunAsUser, showToast } from '@devvit/web/client';
import { createRoot } from 'react-dom/client';
import { puzzleFor, utcDateKey, isDateKey } from '../shared/daily';
import { INKS, sameSheet, simulate, type Ink, type Press, type Stamp } from '../shared/engine';

const isInk = (x: string): x is Ink => (INKS as readonly string[]).includes(x);
import type { DayStats, MyResult, PlayerStats, StateResponse } from '../shared/api';
import { clearDraft, fetchState, loadDraft, saveDraft, sendComplete, shareResult } from './api';
import { Sheet, placeAt } from './Sheet';
import { StampButton } from './StampButton';
import { InkChip } from './ink';
import { duration, longDate, parLine } from './format';
import { postDate } from './context';

type Draft = { presses: Press[]; undos: number; startedAt: number | null };
type Finished = { result: MyResult; player: PlayerStats | null; stats: DayStats | null; countedForStreak: boolean };

function Hint({ text }: { text: string }) {
  return (
    <p className="hint" aria-live="polite">
      {text}
    </p>
  );
}

function ResultCard({
  result,
  player,
  stats,
  countedForStreak,
  offline,
  onClose,
  onShare,
  shareState,
}: {
  result: MyResult;
  player: PlayerStats | null;
  stats: DayStats | null;
  countedForStreak: boolean;
  offline: boolean;
  onClose: () => void;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
  shareState: 'idle' | 'busy' | 'done';
}) {
  const atParPct = stats && stats.solvers > 0 ? Math.round((stats.atPar / stats.solvers) * 100) : null;
  return (
    <section className="result" role="dialog" aria-label="Result">
      <p className="result-kicker">Pulled from the press</p>
      <h2 className="result-title">
        {result.presses} {result.presses === 1 ? 'press' : 'presses'}
        <span className={`result-par ${result.presses <= result.par ? 'is-par' : ''}`}>{parLine(result.presses, result.par)}</span>
      </h2>
      <div className="strip" aria-label="Your press order">
        {result.strip.split('').map((ink, i) => (
          isInk(ink) ? <InkChip key={i} ink={ink} size={22} /> : null
        ))}
      </div>
      <dl className="result-stats">
        <div>
          <dt>Time</dt>
          <dd>{duration(result.ms)}</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>{player ? player.streak : '–'}</dd>
        </div>
        <div>
          <dt>Best</dt>
          <dd>{player ? player.best : '–'}</dd>
        </div>
        <div>
          <dt>On par today</dt>
          <dd>{atParPct === null ? '–' : `${atParPct}%`}</dd>
        </div>
      </dl>
      <p className="result-note">
        {offline
          ? 'Offline preview: results are not saved.'
          : !player
            ? 'Log in to keep a streak.'
            : countedForStreak
              ? `${stats?.solvers ?? 1} ${stats?.solvers === 1 ? 'printer has' : 'printers have'} pulled today's sheet.`
              : "This is an older print, so it doesn't change your streak."}
      </p>
      <div className="result-actions">
        {!offline && player && (
          <button type="button" className="btn btn-quiet" onClick={onShare} disabled={shareState !== 'idle'}>
            {shareState === 'done' ? 'Commented' : shareState === 'busy' ? 'Posting…' : 'Comment my result'}
          </button>
        )}
        <button type="button" className="btn btn-ink" onClick={onClose}>
          See my sheet
        </button>
      </div>
      {!offline && player && shareState === 'idle' && (
        <p className="result-fine">Comment my result replies as you, under the pinned results comment on this post.</p>
      )}
    </section>
  );
}

export function App() {
  const [server, setServer] = useState<StateResponse | null>(null);
  const date = server?.date ?? postDate() ?? utcDateKey();
  const puzzle = useMemo(() => puzzleFor(isDateKey(date) ? date : utcDateKey()), [date]);

  const [draft, setDraft] = useState<Draft>({ presses: [], undos: 0, startedAt: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const ghostBeforeDown = useRef<{ row: number; col: number } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [now, setNow] = useState(0);
  const [shareState, setShareState] = useState<'idle' | 'busy' | 'done'>('idle');

  const onShare = (e: MouseEvent<HTMLButtonElement>) => {
    setShareState('busy');
    const native = e.nativeEvent;
    void (async () => {
      try {
        await canRunAsUser(native);
      } catch {
        /* older clients: the server call below still decides */
      }
      const r = await shareResult();
      setShareState(r.ok ? 'done' : 'idle');
      try {
        showToast(r.ok ? 'Your result is in the comments' : r.message);
      } catch {
        /* no toast outside Reddit */
      }
    })();
  };

  // Load the server state, then restore a finished sheet or an unfinished draft.
  useEffect(() => {
    void fetchState().then((s) => {
      setServer(s);
      if (s?.result) {
        setFinished({ result: s.result, player: s.player, stats: s.stats, countedForStreak: s.date === s.today });
        setDraft({ presses: s.result.log ?? [], undos: 0, startedAt: null });
        return;
      }
      const d = loadDraft<Draft>(s?.date ?? postDate() ?? utcDateKey());
      if (d && Array.isArray(d.presses)) setDraft(d);
    });
  }, []);

  useEffect(() => {
    if (!finished && draft.presses.length > 0) saveDraft(puzzle.date, draft);
  }, [draft, finished, puzzle.date]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sheet = useMemo(() => simulate(puzzle.stamps, draft.presses), [puzzle, draft.presses]);
  const stamp: Stamp | undefined = puzzle.stamps.find((s) => s.id === selected);
  const solvedNow = draft.presses.length > 0 && sameSheet(sheet, puzzle.target);

  const doPress = useCallback(() => {
    if (!stamp || !ghost || finished) return;
    const press: Press = { stamp: stamp.id, row: ghost.row, col: ghost.col };
    setDraft((d) => ({
      presses: [...d.presses, press],
      undos: d.undos,
      startedAt: d.startedAt ?? Date.now(),
    }));
    setGhost(null);
  }, [stamp, ghost, finished]);

  // Completion: verify on the server, then show the card once.
  useEffect(() => {
    if (!solvedNow || finished) return;
    const ms = draft.startedAt ? Date.now() - draft.startedAt : 0;
    const body = { date: puzzle.date, presses: draft.presses, ms, undos: draft.undos };
    void sendComplete(body).then((res) => {
      const local: Finished = res ?? {
        result: {
          presses: draft.presses.length,
          par: puzzle.par,
          ms,
          undos: draft.undos,
          strip: draft.presses.map((p) => puzzle.stamps.find((s) => s.id === p.stamp)?.ink ?? '').join(''),
          log: draft.presses,
        },
        player: null,
        stats: null,
        countedForStreak: false,
      };
      setFinished(local);
      setShowCard(true);
      setSelected(null);
      clearDraft(puzzle.date);
    });
  }, [solvedNow, finished, draft, puzzle]);

  const onCell = (row: number, col: number, phase: 'down' | 'move' | 'up') => {
    if (!stamp || finished) return;
    const pos = placeAt(stamp, row, col);
    if (phase === 'down') ghostBeforeDown.current = ghost;
    if (phase === 'up') {
      const before = ghostBeforeDown.current;
      if (before && before.row === pos.row && before.col === pos.col) {
        doPress();
        return;
      }
    }
    setGhost(pos);
  };

  const undo = () => {
    if (finished || draft.presses.length === 0) return;
    setDraft((d) => ({ ...d, presses: d.presses.slice(0, -1), undos: d.undos + 1 }));
  };
  const restart = () => {
    if (finished || draft.presses.length === 0) return;
    setDraft((d) => ({ ...d, presses: [], undos: d.undos + d.presses.length }));
    setGhost(null);
  };

  const uses = (id: string) => draft.presses.filter((p) => p.stamp === id).length;
  const elapsed = draft.startedAt && !finished ? Math.max(0, now - draft.startedAt) : 0;

  let hint = 'Pick a stamp below.';
  if (finished) hint = 'Printed. Come back tomorrow for a new sheet.';
  else if (stamp && !ghost) hint = 'Tap the sheet where it should go.';
  else if (stamp && ghost) hint = 'Tap the same spot again, or hit Press.';
  else if (draft.presses.length === 1) hint = 'Ink is opaque: a later press covers an earlier one.';
  else if (draft.presses.length >= 2 && !stamp) hint = 'Hold Proof to compare with the target.';

  const presses = draft.presses;
  const offline = !server;

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <h1 className="wordmark">Overprint</h1>
          <p className="issue">
            No. {puzzle.number} · {longDate(puzzle.date)}
          </p>
        </div>
        <div className="counter" aria-label={`${draft.presses.length} presses, par ${puzzle.par}`}>
          <span className="counter-now">{finished ? finished.result.presses : draft.presses.length}</span>
          <span className="counter-par">par {puzzle.par}</span>
        </div>
      </header>

      <section className="bench">
        <figure className="proof">
          <Sheet id="proof" label="Target print" stamps={puzzle.stamps} flat={puzzle.target} className="proof-sheet" />
          <figcaption>Proof</figcaption>
        </figure>
        <div className="bench-side">
          <Hint text={hint} />
          <p className="clock">{finished ? duration(finished.result.ms) : elapsed ? duration(elapsed) : ''}</p>
        </div>
      </section>

      <section className="press-bed">
        <Sheet
          id="work"
          label={finished ? 'Your finished sheet' : 'Your sheet'}
          stamps={puzzle.stamps}
          presses={presses}
          ghost={stamp && ghost && !finished ? { stamp, ...ghost } : null}
          overlay={comparing ? puzzle.target : null}
          onPointerCell={finished ? undefined : onCell}
          className={`work-sheet ${solvedNow || finished ? 'is-done' : ''}`}
        />
      </section>

      <section className="tray" aria-label="Stamps">
        {puzzle.stamps.map((s) => (
          <StampButton
            key={s.id}
            stamp={s}
            uses={uses(s.id)}
            selected={selected === s.id}
            onSelect={() => {
              if (finished) return;
              setSelected((cur) => (cur === s.id ? null : s.id));
              setGhost(null);
            }}
          />
        ))}
      </section>

      <nav className="controls">
        <button type="button" className="btn btn-quiet" onClick={undo} disabled={!!finished || draft.presses.length === 0}>
          Lift
        </button>
        <button type="button" className="btn btn-quiet" onClick={restart} disabled={!!finished || draft.presses.length === 0}>
          New sheet
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onPointerDown={() => setComparing(true)}
          onPointerUp={() => setComparing(false)}
          onPointerLeave={() => setComparing(false)}
          onKeyDown={(e) => e.key === ' ' && setComparing(true)}
          onKeyUp={() => setComparing(false)}
        >
          Proof
        </button>
        {finished ? (
          <button type="button" className="btn btn-ink" onClick={() => setShowCard(true)}>
            Result
          </button>
        ) : (
          <button type="button" className="btn btn-ink" onClick={doPress} disabled={!stamp || !ghost}>
            Press
          </button>
        )}
      </nav>

      {showCard && finished && (
        <div className="scrim" onClick={() => setShowCard(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ResultCard
              result={finished.result}
              player={finished.player}
              stats={finished.stats}
              countedForStreak={finished.countedForStreak}
              offline={offline}
              onClose={() => setShowCard(false)}
              onShare={onShare}
              shareState={shareState}
            />
          </div>
        </div>
      )}

    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
