import './styles.css';

import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { canRunAsUser, showToast } from '@devvit/web/client';
import { createRoot } from 'react-dom/client';
import { puzzleFor, utcDateKey, isDateKey } from '../shared/daily';
import { INKS, sameSheet, simulate, type Cell, type Ink, type Press, type Stamp } from '../shared/engine';
import type { DayStats, MyResult, PlayerStats, StateResponse } from '../shared/api';
import { nextTitle, titleFor } from '../shared/titles';
import { clearDraft, fetchState, loadDraft, saveDraft, sendComplete, shareResult, wearFlair } from './api';
import { journey } from './journey';
import { Sheet, placeAt } from './Sheet';
import { StampButton } from './StampButton';
import { InkChip } from './ink';
import { duration, longDate, parLine, untilNextPrint } from './format';
import { postDate } from './context';

const isInk = (x: string): x is Ink => (INKS as readonly string[]).includes(x);

type Draft = { presses: Press[]; undos: number; startedAt: number | null };
type Busy = 'idle' | 'busy' | 'done';

function cellsToGo(sheet: readonly Cell[], target: readonly Cell[]): number {
  let n = 0;
  for (let i = 0; i < target.length; i++) if (sheet[i] !== target[i]) n++;
  return n;
}

function seenBefore(): boolean {
  try {
    const seen = localStorage.getItem('overprint:seen') === '1';
    localStorage.setItem('overprint:seen', '1');
    return seen;
  } catch {
    return false;
  }
}
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
  onFlair,
  flairState,
  now,
}: {
  result: MyResult;
  player: PlayerStats | null;
  stats: DayStats | null;
  countedForStreak: boolean;
  offline: boolean;
  onClose: () => void;
  onShare: (e: MouseEvent<HTMLButtonElement>) => void;
  shareState: Busy;
  onFlair: () => void;
  flairState: Busy;
  now: number;
}) {
  const title = player ? titleFor(player) : null;
  const next = player ? nextTitle(player) : null;
  const wearing = player?.flair ?? null;
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
          <dt>Time at press</dt>
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
      {title && (
        <div className="title-row">
          <div>
            <p className="title-label">Your title</p>
            <p className="title-name">{title.name}</p>
            {next && (
              <p className="title-next">
                Next: {next.name} at {next.solved} prints, {next.pars} on par
              </p>
            )}
          </div>
          {!offline && (
            <button type="button" className="btn btn-quiet btn-small" onClick={onFlair} disabled={flairState !== 'idle'}>
              {flairState === 'done' || (wearing && wearing.startsWith(title.name)) ? 'Wearing it' : flairState === 'busy' ? 'Setting…' : 'Wear as flair'}
            </button>
          )}
        </div>
      )}
      {now > 0 && <p className="result-next">Next print in {untilNextPrint(now)}.</p>}
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
        <p className="result-fine">
          Comment my result replies as you, under the pinned results comment. Wear as flair sets your user flair in this
          community. Both are optional.
        </p>
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
  const [shareState, setShareState] = useState<Busy>('idle');
  const [flairState, setFlairState] = useState<Busy>('idle');
  const [firstVisit] = useState(() => !seenBefore());

  const onFlair = () => {
    setFlairState('busy');
    journey.interaction('flair');
    void wearFlair().then((r) => {
      setFlairState(r.ok ? 'done' : 'idle');
      try {
        showToast(r.ok ? `Flair set: ${r.text}` : r.message);
      } catch {
        /* no toast outside Reddit */
      }
    });
  };

  const onShare = (e: MouseEvent<HTMLButtonElement>) => {
    setShareState('busy');
    journey.interaction('comment');
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
      journey.ready();
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
    const next = [...draft.presses, press];
    journey.start();
    const inked = puzzle.target.filter((c) => c !== '.').length || 1;
    const left = cellsToGo(simulate(puzzle.stamps, next), puzzle.target);
    journey.progress(1 - left / Math.max(inked, left), next.length);
    setDraft((d) => ({
      presses: [...d.presses, press],
      undos: d.undos,
      startedAt: d.startedAt ?? Date.now(),
    }));
    setGhost(null);
  }, [stamp, ghost, finished, draft.presses, puzzle]);

  // Completion: verify on the server, then show the card once.
  useEffect(() => {
    if (!solvedNow || finished) return;
    const ms = draft.startedAt ? Date.now() - draft.startedAt : 0;
    const body = { date: puzzle.date, presses: draft.presses, ms, undos: draft.undos };
    void sendComplete(body, journey.id()).then((res) => {
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
    journey.interaction('lift');
    setDraft((d) => ({ ...d, presses: d.presses.slice(0, -1), undos: d.undos + 1 }));
  };
  const restart = () => {
    if (finished || draft.presses.length === 0) return;
    journey.interaction('new_sheet');
    setDraft((d) => ({ ...d, presses: [], undos: d.undos + d.presses.length }));
    setGhost(null);
  };

  const uses = (id: string) => draft.presses.filter((p) => p.stamp === id).length;
  const elapsed = draft.startedAt && !finished ? Math.max(0, now - draft.startedAt) : 0;

  const left = cellsToGo(sheet, puzzle.target);
  let hint = firstVisit
    ? 'Copy the proof onto your sheet. Start by picking a stamp from the tray.'
    : 'Pick a stamp from the tray.';
  if (finished) hint = 'Printed. Come back tomorrow for a new sheet.';
  else if (stamp && !ghost) hint = draft.presses.length === 0 ? 'Tap the sheet where this stamp should print.' : 'Tap the sheet where it should go.';
  else if (stamp && ghost) hint = 'Tap the same spot again, or hit Press.';
  else if (draft.presses.length === 1) hint = 'Ink is opaque: a later press covers an earlier one.';
  else if (draft.presses.length >= 2 && !stamp) hint = 'Hold Proof to compare with the target.';
  else if (draft.presses.length === 0 && draft.startedAt) hint = 'Fresh sheet. The clock keeps running: it counts all your time at the press.';

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
          <p className="clock">
            {finished
              ? `Done in ${duration(finished.result.ms)}`
              : `${left} ${left === 1 ? 'cell' : 'cells'} to go${elapsed ? ` · ${duration(elapsed)}` : ''}`}
          </p>
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
          className={`work-sheet ${solvedNow || finished ? 'is-done' : ''} ${stamp && !ghost && !finished && draft.presses.length === 0 ? 'coach' : ''}`}
        />
      </section>

      <section className={`tray ${!finished && !stamp && draft.presses.length === 0 ? 'coach' : ''}`} aria-label="Stamps">
        {puzzle.stamps.map((s) => (
          <StampButton
            key={s.id}
            stamp={s}
            uses={uses(s.id)}
            selected={selected === s.id}
            onSelect={() => {
              // Re-tapping the selected stamp keeps it selected, so "tap stamp, tap sheet" never loses a press.
              if (finished || selected === s.id) return;
              setSelected(s.id);
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
          onPointerDown={() => {
            setComparing(true);
            journey.interaction('proof');
          }}
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
              onFlair={onFlair}
              flairState={flairState}
              now={now}
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
