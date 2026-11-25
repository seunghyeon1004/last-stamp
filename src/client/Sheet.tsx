import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { SIZE, footprint, shapeOf, type Cell, type Press, type Stamp } from '../shared/engine';
import { InkDefs, inkFill } from './ink';

const U = 100; // viewBox units per cell
const VB = SIZE * U;

/** Small, deterministic misregistration per press so layers peek out at the edges like a real print. */
function jitter(i: number): [number, number] {
  const h = Math.imul(i + 1, 0x9e3779b1) >>> 0;
  return [((h & 7) - 3.5) * 0.9, (((h >>> 3) & 7) - 3.5) * 0.9];
}

function CellRects({ cells, fill }: { cells: number[]; fill: string }) {
  return (
    <>
      {cells.map((i) => (
        <rect key={i} x={(i % SIZE) * U} y={Math.floor(i / SIZE) * U} width={U + 0.5} height={U + 0.5} fill={fill} />
      ))}
    </>
  );
}

function RegistrationMarks() {
  const marks = [];
  for (let r = 1; r < SIZE; r++)
    for (let c = 1; c < SIZE; c++)
      marks.push(
        <g key={`${r}-${c}`} stroke="#B9AF9E" strokeWidth="2">
          <line x1={c * U - 7} y1={r * U} x2={c * U + 7} y2={r * U} />
          <line x1={c * U} y1={r * U - 7} x2={c * U} y2={r * U + 7} />
        </g>
      );
  return <>{marks}</>;
}

type Props = {
  id: string;
  label: string;
  stamps: readonly Stamp[];
  /** Flat rendering of a finished sheet (used for the proof). */
  flat?: readonly Cell[] | undefined;
  /** Rendering from presses, oldest first (used for the working sheet). */
  presses?: readonly Press[] | undefined;
  ghost?: { stamp: Stamp; row: number; col: number } | null | undefined;
  overlay?: readonly Cell[] | null | undefined;
  onPointerCell?: ((row: number, col: number, phase: 'down' | 'move' | 'up') => void) | undefined;
  className?: string | undefined;
};

export function Sheet({ id, label, stamps, flat, presses, ghost, overlay, onPointerCell, className }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toCell = (e: ReactPointerEvent<SVGSVGElement>): [number, number] | null => {
    const el = ref.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const col = Math.floor(((e.clientX - box.left) / box.width) * SIZE);
    const row = Math.floor(((e.clientY - box.top) / box.height) * SIZE);
    if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return null;
    return [row, col];
  };

  const handlers = onPointerCell
    ? {
        onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const rc = toCell(e);
          if (rc) onPointerCell(rc[0], rc[1], 'down');
        },
        onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => {
          if (!dragging.current) return;
          const rc = toCell(e);
          if (rc) onPointerCell(rc[0], rc[1], 'move');
        },
        onPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => {
          if (!dragging.current) return;
          dragging.current = false;
          const rc = toCell(e);
          if (rc) onPointerCell(rc[0], rc[1], 'up');
        },
        onPointerCancel: () => {
          dragging.current = false;
        },
      }
    : {};

  const byId = new Map(stamps.map((s) => [s.id, s]));

  return (
    <svg
      ref={ref}
      className={className}
      viewBox={`-12 -12 ${VB + 24} ${VB + 24}`}
      role="img"
      aria-label={label}
      style={{ touchAction: 'none' }}
      {...handlers}
    >
      <InkDefs id={id} />
      <rect x="-12" y="-12" width={VB + 24} height={VB + 24} fill="#F7F3EA" />
      <RegistrationMarks />

      {flat &&
        (['R', 'B', 'Y', 'K'] as const).map((ink) => (
          <CellRects
            key={ink}
            cells={flat.flatMap((c, i) => (c === ink ? [i] : []))}
            fill={inkFill(id, ink)}
          />
        ))}

      {presses?.map((p, i) => {
        const s = byId.get(p.stamp);
        if (!s) return null;
        const [dx, dy] = jitter(i);
        return (
          <g key={i} transform={`translate(${dx} ${dy})`} className={i === presses.length - 1 ? 'fresh-press' : undefined}>
            <CellRects cells={footprint(shapeOf(s.shape), p.row, p.col)} fill={inkFill(id, s.ink)} />
          </g>
        );
      })}

      {overlay && (
        <g opacity="0.88">
          <rect x="0" y="0" width={VB} height={VB} fill="#F7F3EA" />
          {(['R', 'B', 'Y', 'K'] as const).map((ink) => (
            <CellRects key={ink} cells={overlay.flatMap((c, i) => (c === ink ? [i] : []))} fill={inkFill(id, ink)} />
          ))}
        </g>
      )}

      {ghost && (
        <g className="ghost" pointerEvents="none">
          {footprint(shapeOf(ghost.stamp.shape), ghost.row, ghost.col).map((i) => (
            <rect
              key={i}
              x={(i % SIZE) * U + 6}
              y={Math.floor(i / SIZE) * U + 6}
              width={U - 12}
              height={U - 12}
              fill={inkFill(id, ghost.stamp.ink)}
              fillOpacity="0.45"
              stroke="#1D1D1F"
              strokeWidth="4"
              strokeDasharray="10 8"
            />
          ))}
        </g>
      )}

      <rect x="-12" y="-12" width={VB + 24} height={VB + 24} filter={`url(#${id}-grain)`} pointerEvents="none" />
    </svg>
  );
}

/** Where to put a shape so the tapped cell sits under its "handle" (the cell nearest its middle). */
export function placeAt(stamp: Stamp, row: number, col: number): { row: number; col: number } {
  const shape = shapeOf(stamp.shape);
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  const cy = (rows - 1) / 2;
  const cx = (cols - 1) / 2;
  let handle = shape[0]!;
  let best = Infinity;
  for (const cell of shape) {
    const d = (cell[0] - cy) ** 2 + (cell[1] - cx) ** 2;
    if (d < best) {
      best = d;
      handle = cell;
    }
  }
  const r0 = Math.min(Math.max(row - handle[0], 0), SIZE - rows);
  const c0 = Math.min(Math.max(col - handle[1], 0), SIZE - cols);
  return { row: r0, col: c0 };
}
