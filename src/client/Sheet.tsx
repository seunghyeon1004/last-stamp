import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { SIZE, footprint, shapeOf, type Cell, type Ink, type Press, type Stamp } from '../shared/engine';
import { INK_VAR, InkDefs, inkFill } from './ink';

const U = 100; // viewBox units per cell
const VB = SIZE * U;
const M = 14; // paper margin around the 5x5 bed, in viewBox units

/** Small, deterministic misregistration per press: layers land a hair off, like a real drum. */
function jitter(i: number): [number, number] {
  const h = Math.imul(i + 1, 0x9e3779b1) >>> 0;
  return [((h & 7) - 3.5) * 0.9, (((h >>> 3) & 7) - 3.5) * 0.9];
}

/** Outline of a set of cells: only the edges that face outside the set. */
export function outlinePath(cells: readonly number[]): string {
  const set = new Set(cells);
  const d: string[] = [];
  for (const i of cells) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const x = c * U;
    const y = r * U;
    if (r === 0 || !set.has(i - SIZE)) d.push(`M${x} ${y}H${x + U}`);
    if (r === SIZE - 1 || !set.has(i + SIZE)) d.push(`M${x} ${y + U}H${x + U}`);
    if (c === 0 || !set.has(i - 1)) d.push(`M${x} ${y}V${y + U}`);
    if (c === SIZE - 1 || !set.has(i + 1)) d.push(`M${x + U} ${y}V${y + U}`);
  }
  return d.join('');
}

/** One inked region: an opaque body and a multiplied rim, so where it crosses another ink a
 *  thin overprint fringe shows (the riso third colour), while the body stays opaque. */
function InkRegion({ svgId, ink, cells }: { svgId: string; ink: Ink; cells: readonly number[] }) {
  return (
    <>
      {cells.map((i) => (
        <rect key={i} x={(i % SIZE) * U} y={Math.floor(i / SIZE) * U} width={U + 0.6} height={U + 0.6} fill={inkFill(svgId, ink)} />
      ))}
      <path d={outlinePath(cells)} className="ink-rim" style={{ stroke: INK_VAR[ink].edge }} />
    </>
  );
}

function CropMarks() {
  const L = 10;
  const marks: [number, number, number, number][] = [];
  for (const [x, y] of [
    [0, 0],
    [VB, 0],
    [0, VB],
    [VB, VB],
  ] as const) {
    const sx = x === 0 ? -1 : 1;
    const sy = y === 0 ? -1 : 1;
    marks.push([x + sx * 3, y, x + sx * (3 + L), y], [x, y + sy * 3, x, y + sy * (3 + L)]);
  }
  return (
    <g className="crop-marks" aria-hidden="true">
      {marks.map(([x1, y1, x2, y2], k) => (
        <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </g>
  );
}

function Guides({ strong }: { strong?: boolean }) {
  const lines = [];
  for (let k = 1; k < SIZE; k++) {
    lines.push(<line key={`h${k}`} x1={0} y1={k * U} x2={VB} y2={k * U} />);
    lines.push(<line key={`v${k}`} x1={k * U} y1={0} x2={k * U} y2={VB} />);
  }
  return (
    <g className={strong ? 'guides guides-strong' : 'guides'} aria-hidden="true">
      {lines}
    </g>
  );
}

type Props = {
  id: string;
  label: string;
  stamps: readonly Stamp[];
  /** Flat rendering of a finished sheet (used for the proof). */
  flat?: readonly Cell[] | undefined;
  /** Rendering from presses, oldest first (used for the working sheet). */
  presses?: readonly Press[] | undefined;
  /** Index of a press that has just landed, to play the stamp coming down once. */
  fresh?: number | null | undefined;
  ghost?: { stamp: Stamp; row: number; col: number } | null | undefined;
  overlay?: readonly Cell[] | null | undefined;
  onPointerCell?: ((row: number, col: number, phase: 'down' | 'move' | 'up') => void) | undefined;
  className?: string | undefined;
  /** Stronger cell lines so a flat print reads as a puzzle grid. */
  grid?: boolean | undefined;
};

function flatRegions(svgId: string, cells: readonly Cell[]) {
  return (['R', 'B', 'Y', 'K'] as const).map((ink) => {
    const idx = cells.flatMap((c, i) => (c === ink ? [i] : []));
    return idx.length ? <InkRegion key={ink} svgId={svgId} ink={ink} cells={idx} /> : null;
  });
}

export function Sheet({ id, label, stamps, flat, presses, fresh, ghost, overlay, onPointerCell, className, grid }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toCell = (e: ReactPointerEvent<SVGSVGElement>): [number, number] | null => {
    const el = ref.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const scale = box.width / (VB + 2 * M);
    const col = Math.floor((e.clientX - box.left - M * scale) / (U * scale));
    const row = Math.floor((e.clientY - box.top - M * scale) / (U * scale));
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
  const ghostCells = ghost ? footprint(shapeOf(ghost.stamp.shape), ghost.row, ghost.col) : [];

  // the wooden block that comes down for the press that just landed
  let block: { x: number; y: number; w: number; h: number; ink: Ink } | null = null;
  if (presses && fresh != null && fresh === presses.length - 1) {
    const p = presses[fresh]!;
    const s = byId.get(p.stamp);
    if (s) {
      const cells = footprint(shapeOf(s.shape), p.row, p.col);
      const rows = cells.map((i) => Math.floor(i / SIZE));
      const cols = cells.map((i) => i % SIZE);
      const x = Math.min(...cols) * U;
      const y = Math.min(...rows) * U;
      block = { x: x - 10, y: y - 10, w: (Math.max(...cols) + 1) * U - x + 20, h: (Math.max(...rows) + 1) * U - y + 20, ink: s.ink };
    }
  }

  return (
    <svg
      ref={ref}
      className={className}
      viewBox={`${-M} ${-M} ${VB + 2 * M} ${VB + 2 * M}`}
      role="img"
      aria-label={label}
      style={{ touchAction: 'none' }}
      {...handlers}
    >
      <InkDefs id={id} />
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style={{ stopColor: 'var(--wood-hi)' }} />
        <stop offset="1" style={{ stopColor: 'var(--wood-lo)' }} />
      </linearGradient>
      <pattern id={`${id}-grainlines`} width="22" height="400" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
        <rect x="9" width="1.6" height="400" style={{ fill: 'var(--wood-grain)' }} />
        <rect x="16" width="1" height="400" style={{ fill: 'var(--wood-grain)' }} />
      </pattern>

      <rect x={-M} y={-M} width={VB + 2 * M} height={VB + 2 * M} className="sheet-paper" />
      <rect x={-M} y={-M} width={VB + 2 * M} height={VB + 2 * M} filter={`url(#${id}-fibre)`} className="sheet-fibre" />
      <Guides strong={!!grid} />

      {flat && flatRegions(id, flat)}

      {presses?.map((p, i) => {
        const s = byId.get(p.stamp);
        if (!s) return null;
        const [dx, dy] = jitter(i);
        return (
          <g key={i} transform={`translate(${dx} ${dy})`}>
            <g className={i === fresh ? 'fresh-press' : undefined}>
              <InkRegion svgId={id} ink={s.ink} cells={footprint(shapeOf(s.shape), p.row, p.col)} />
            </g>
          </g>
        );
      })}

      {overlay && (
        <g className="proof-overlay">
          <rect x={0} y={0} width={VB} height={VB} className="sheet-paper" />
          {flatRegions(id, overlay)}
        </g>
      )}

      {ghost && (
        <g className="ghost" pointerEvents="none">
          {ghostCells.map((i) => (
            <rect key={i} x={(i % SIZE) * U} y={Math.floor(i / SIZE) * U} width={U} height={U} fill={inkFill(id, ghost.stamp.ink)} />
          ))}
          <path d={outlinePath(ghostCells)} className="ghost-edge" />
        </g>
      )}

      <rect x={-M} y={-M} width={VB + 2 * M} height={VB + 2 * M} filter={`url(#${id}-grain)`} className="sheet-grain" />
      <CropMarks />

      {block && (
        <g className="press-block" key={`block-${fresh}`} pointerEvents="none" aria-hidden="true">
          <rect x={block.x + 6} y={block.y + 10} width={block.w} height={block.h} rx="8" className="press-block-shadow" />
          <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="8" fill={`url(#${id}-wood)`} className="press-block-wood" />
          <rect x={block.x + 3} y={block.y + 3} width={block.w - 6} height={block.h - 16} rx="6" fill={`url(#${id}-grainlines)`} />
          <rect x={block.x} y={block.y + block.h - 10} width={block.w} height="10" rx="4" style={{ fill: INK_VAR[block.ink].edge }} />
        </g>
      )}
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
