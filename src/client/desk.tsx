import './styles.css';

import { StrictMode, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { showToast } from '@devvit/web/client';
import { checkComposition, deskStamps, deskSunday, DESK_RULES } from '../shared/desk';
import { utcDateKey } from '../shared/daily';
import { sheetFromString, simulate, type Press, type Stamp } from '../shared/engine';
import { cellName, describeCard, keyAction } from './a11y';
import { INK_NAME } from './ink';
import type { DeskEntry, DeskResponse } from '../shared/api';
import { Sheet, placeAt } from './Sheet';
import { StampButton, shapeDims } from './StampButton';
import { longDate } from './format';

type Tab = 'make' | 'vote';

function toast(text: string) {
  try {
    showToast(text);
  } catch {
    /* outside Reddit */
  }
}

async function post<T>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json()) as T & { message?: string };
    return res.ok ? { ok: true, data } : { ok: false, message: data.message ?? 'Something went wrong.' };
  } catch {
    return { ok: false, message: 'Could not reach the server.' };
  }
}

function EntryCard({ entry, stamps, onVote, busy }: { entry: DeskEntry; stamps: readonly Stamp[]; onVote: () => void; busy: boolean }) {
  return (
    <li className="desk-entry">
      <Sheet id={`e-${entry.id}`} label={`Card by u/${entry.author}, par ${entry.par}`} stamps={stamps} flat={sheetFromString(entry.target)} grid className="desk-entry-sheet" />
      <p className="desk-entry-author">u/{entry.author}</p>
      <p className="desk-entry-meta">par {entry.par}</p>
      {entry.mine ? (
        <p className="desk-entry-votes">Your card: {entry.votes} {entry.votes === 1 ? 'vote' : 'votes'}</p>
      ) : (
        <button type="button" className={`btn btn-small ${entry.voted ? 'btn-primary' : 'btn-quiet'}`} aria-pressed={entry.voted} onClick={onVote} disabled={busy}>
          {entry.voted ? 'Voted' : 'Vote'} ({entry.votes})
        </button>
      )}
    </li>
  );
}

export function Desk() {
  const [desk, setDesk] = useState<DeskResponse | null>(null);
  const sunday = desk?.sunday ?? deskSunday(utcDateKey());
  const stamps = useMemo(() => deskStamps(sunday), [sunday]);
  const [tab, setTab] = useState<Tab>('make');
  const [presses, setPresses] = useState<Press[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ row: number; col: number } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState('');
  const ghostBeforeDown = useRef<{ row: number; col: number } | null>(null);

  const load = () =>
    fetch('/api/desk')
      .then((r) => (r.ok ? (r.json() as Promise<DeskResponse>) : null))
      .then((d) => setDesk(d))
      .catch(() => setDesk(null));

  useEffect(() => {
    void load();
  }, []);

  const stamp = stamps.find((s) => s.id === selected);
  const check = useMemo(() => checkComposition(stamps, presses), [stamps, presses]);
  const slot = Math.max(2, ...stamps.map((s) => Math.max(shapeDims(s).rows, shapeDims(s).cols)));
  const mineEntry = desk?.entries.find((e) => e.mine) ?? null;

  const press = () => {
    if (!stamp || !ghost) return;
    setPresses((p) => [...p, { stamp: stamp.id, row: ghost.row, col: ghost.col }]);
    setFresh(presses.length);
    setAnnounce(`Pressed ${INK_NAME[stamp.ink]} at ${cellName(ghost.row, ghost.col)}.`);
    setGhost(null);
  };

  // A second tap on the same spot presses; compare with where the ghost was before this tap began.
  const onCell = (row: number, col: number, phase: 'down' | 'move' | 'up') => {
    if (!stamp) return;
    const pos = placeAt(stamp, row, col);
    if (phase === 'down') ghostBeforeDown.current = ghost;
    if (phase === 'up') {
      const before = ghostBeforeDown.current;
      if (before && before.row === pos.row && before.col === pos.col) {
        press();
        return;
      }
    }
    setGhost(pos);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const a = keyAction(e.key, stamp, ghost);
    if (a.kind === 'none') return;
    e.preventDefault();
    if (a.kind === 'clear') return setGhost(null);
    if (a.kind === 'press') return press();
    setGhost(a.pos);
    if (stamp) setAnnounce(`${INK_NAME[stamp.ink]} stamp at ${cellName(a.pos.row, a.pos.col)}. Enter to press.`);
  };

  const submit = async () => {
    setBusy(true);
    const r = await post<{ par: number }>('/api/desk/submit', { presses });
    setBusy(false);
    if (!r.ok) return toast(r.message);
    toast(`Your card is on the desk, par ${r.data.par}`);
    setPresses([]);
    await load();
    setTab('vote');
  };

  const withdraw = async () => {
    setBusy(true);
    const r = await post('/api/desk/withdraw');
    setBusy(false);
    toast(r.ok ? 'Card withdrawn' : r.message);
    await load();
  };

  const vote = async (id: string) => {
    setBusy(true);
    const r = await post('/api/desk/vote', { id });
    setBusy(false);
    if (!r.ok) toast(r.message);
    await load();
  };

  let info: string;
  if (presses.length === 0) info = `Make any picture with next Sunday's stamps. It needs par ${DESK_RULES.minPar} to ${DESK_RULES.maxPar}.`;
  else if (check.ok) info = `${check.target.filter((c) => c !== '.').length} cells inked. Par ${check.par}.`;
  else info = check.reason;

  return (
    <main className="app desk">
      <header className="masthead">
        <div>
          <h1 className="wordmark">Open desk</h1>
          <p className="issue">
            <span>For {longDate(sunday)}</span>
          </p>
        </div>
        <nav className="desk-tabs" aria-label="Desk">
          <button type="button" className={`btn btn-small ${tab === 'make' ? 'btn-primary' : 'btn-quiet'}`} aria-pressed={tab === 'make'} onClick={() => setTab('make')}>
            Make
          </button>
          <button type="button" className={`btn btn-small ${tab === 'vote' ? 'btn-primary' : 'btn-quiet'}`} aria-pressed={tab === 'vote'} onClick={() => setTab('vote')}>
            Vote ({desk?.entries.length ?? 0})
          </button>
        </nav>
      </header>

      {tab === 'make' ? (
        mineEntry ? (
          <section className="desk-mine">
            <p className="desk-note">
              Your card is on the desk with {mineEntry.votes} {mineEntry.votes === 1 ? 'vote' : 'votes'}. The most voted card becomes Sunday's puzzle, credited to you.
            </p>
            <Sheet id="mine" label="Your card" stamps={stamps} flat={sheetFromString(mineEntry.target)} grid className="desk-mine-sheet" />
            <button type="button" className="btn btn-quiet" onClick={withdraw} disabled={busy}>
              Withdraw my card
            </button>
          </section>
        ) : (
          <>
            <section className="bench desk-bench">
              <p className="hint" aria-live="polite">
                {info}
              </p>
            </section>
            <p className="sr-only" aria-live="assertive">
              {announce}
            </p>
            <section className="press-bed">
              <Sheet
                id="compose"
                label="Your card. Arrow keys move the stamp, Enter presses."
                stamps={stamps}
                presses={presses}
                fresh={fresh}
                ghost={stamp && ghost ? { stamp, ...ghost } : null}
                onPointerCell={onCell}
                onKey={onKey}
                description={describeCard(simulate(stamps, presses))}
                className="work-sheet"
              />
            </section>
            <section className={`tray n${stamps.length}`} aria-label="Next Sunday's stamps" style={{ ['--slot' as string]: slot }}>
              {stamps.map((s) => (
                <StampButton
                  key={s.id}
                  stamp={s}
                  uses={presses.filter((p) => p.stamp === s.id).length}
                  slot={{ rows: slot, cols: slot }}
                  selected={selected === s.id}
                  onSelect={() => {
                    if (selected === s.id) return;
                    setSelected(s.id);
                    setGhost(null);
                  }}
                />
              ))}
            </section>
            <nav className="controls">
              <button type="button" className="btn btn-quiet" onClick={() => setPresses((p) => p.slice(0, -1))} disabled={presses.length === 0}>
                Lift
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setPresses([])} disabled={presses.length === 0}>
                Clear
              </button>
              <button type="button" className="btn btn-quiet" onClick={press} disabled={!stamp || !ghost}>
                Press
              </button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={!check.ok || busy || !desk?.loggedIn}>
                Send
              </button>
            </nav>
          </>
        )
      ) : (
        <section className="desk-vote">
          {desk && desk.entries.length > 0 ? (
            <ul className="desk-grid">
              {desk.entries.map((e) => (
                <EntryCard key={e.id} entry={e} stamps={stamps} busy={busy} onVote={() => void vote(e.id)} />
              ))}
            </ul>
          ) : (
            <p className="hint">No cards yet. Be the first: make one on the Make tab.</p>
          )}
          <p className="desk-fine">One card per player per week, made only from stamp presses. Voting closes when Sunday starts (00:00 UTC). With no votes, Sunday uses the regular daily card.</p>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Desk />
  </StrictMode>
);
