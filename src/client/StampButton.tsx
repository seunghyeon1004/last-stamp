import { shapeOf, type Stamp } from '../shared/engine';
import { INK_NAME, INK_TEXTURE_NAME, INK_VAR, InkDefs, inkFill } from './ink';

export function shapeDims(stamp: Stamp): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shapeOf(stamp.shape)) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  return { rows, cols };
}

/**
 * The rubber face: one square per cell, the same proportions as a cell on the sheet, so the
 * number of cells reads at a glance. Its size comes from the CSS variable --cell.
 */
export function StampFace({ stamp, idPrefix }: { stamp: Stamp; idPrefix: string }) {
  const { rows, cols } = shapeDims(stamp);
  const u = 100;
  const gap = 7;
  const id = `${idPrefix}-${stamp.id}`;
  return (
    <svg
      viewBox={`0 0 ${cols * u} ${rows * u}`}
      aria-hidden="true"
      className="stamp-face"
      style={{ width: `calc(var(--cell) * ${cols})`, height: `calc(var(--cell) * ${rows})` }}
    >
      <InkDefs id={id} />
      {shapeOf(stamp.shape).map(([r, c], i) => (
        <rect
          key={i}
          x={c * u + gap / 2}
          y={r * u + gap / 2}
          width={u - gap}
          height={u - gap}
          rx="6"
          fill={inkFill(id, stamp.ink)}
          strokeWidth="5"
          style={{ stroke: INK_VAR[stamp.ink].edge }}
        />
      ))}
    </svg>
  );
}

export function stampLabel(stamp: Stamp): string {
  return `${INK_NAME[stamp.ink]} stamp, ${INK_TEXTURE_NAME[stamp.ink]}, ${shapeOf(stamp.shape).length} cells`;
}

/**
 * A rubber stamp seen from above: the inked rubber face mounted on a wooden block, with the
 * rubber's edge showing under the front of the block. `slot` sizes the block (in cells) so a
 * set of blocks can share one size; without it the block hugs its own face.
 */
export function StampBlock({
  stamp,
  idPrefix,
  slot,
}: {
  stamp: Stamp;
  idPrefix: string;
  slot?: { rows: number; cols: number };
}) {
  const own = shapeDims(stamp);
  const s = slot ?? own;
  return (
    <span
      className="block"
      style={{
        ['--rubber' as string]: INK_VAR[stamp.ink].edge,
        ['--slot-cols' as string]: s.cols,
        ['--slot-rows' as string]: s.rows,
      }}
    >
      <span className="block-top">
        <StampFace stamp={stamp} idPrefix={idPrefix} />
      </span>
      <span className="block-lip" aria-hidden="true" />
    </span>
  );
}

/** A stamp in the tray. Picking it up lifts the block. */
export function StampButton({
  stamp,
  selected,
  uses,
  slot,
  onSelect,
}: {
  stamp: Stamp;
  selected: boolean;
  uses: number;
  slot: { rows: number; cols: number };
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`stamp ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={`${stampLabel(stamp)}${uses ? `, pressed ${uses} times` : ''}`}
      onClick={onSelect}
    >
      <StampBlock stamp={stamp} idPrefix="tray" slot={slot} />
      {uses > 0 && <span className="stamp-uses">{uses}</span>}
    </button>
  );
}
