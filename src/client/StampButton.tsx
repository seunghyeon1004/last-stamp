import { shapeOf, type Stamp } from '../shared/engine';
import { INK_NAME, INK_TEXTURE_NAME, INK_VAR, InkDefs, inkFill } from './ink';

/** The index label on top of a stamp block: the design, printed once in its ink. */
export function StampGlyph({ stamp, idPrefix }: { stamp: Stamp; idPrefix: string }) {
  const shape = shapeOf(stamp.shape);
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  const u = 20;
  const span = Math.max(rows, cols) * u + 6;
  const ox = (span - cols * u) / 2;
  const oy = (span - rows * u) / 2;
  const id = `${idPrefix}-${stamp.id}`;
  const set = new Set(shape.map(([r, c]) => `${r},${c}`));
  // outline of the printed design, so it reads as one rubber face rather than tiles
  const d: string[] = [];
  for (const [r, c] of shape) {
    const x = ox + c * u;
    const y = oy + r * u;
    if (!set.has(`${r - 1},${c}`)) d.push(`M${x} ${y}H${x + u}`);
    if (!set.has(`${r + 1},${c}`)) d.push(`M${x} ${y + u}H${x + u}`);
    if (!set.has(`${r},${c - 1}`)) d.push(`M${x} ${y}V${y + u}`);
    if (!set.has(`${r},${c + 1}`)) d.push(`M${x + u} ${y}V${y + u}`);
  }
  return (
    <svg viewBox={`-3 -3 ${span + 6} ${span + 6}`} aria-hidden="true" className="stamp-glyph">
      <InkDefs id={id} />
      {shape.map(([r, c], i) => (
        <rect key={i} x={ox + c * u} y={oy + r * u} width={u + 0.3} height={u + 0.3} fill={inkFill(id, stamp.ink)} />
      ))}
      <path d={d.join('')} fill="none" strokeWidth="2" strokeLinecap="square" style={{ stroke: INK_VAR[stamp.ink].edge }} />
    </svg>
  );
}

export function stampLabel(stamp: Stamp): string {
  return `${INK_NAME[stamp.ink]} stamp, ${INK_TEXTURE_NAME[stamp.ink]}, ${shapeOf(stamp.shape).length} cells`;
}

/** A rubber stamp seen from above: a wooden block, its paper index label, and the inked rubber lip. */
export function StampBlock({ stamp, idPrefix }: { stamp: Stamp; idPrefix: string }) {
  return (
    <span className="block" style={{ ['--rubber' as string]: INK_VAR[stamp.ink].edge }}>
      <span className="block-top">
        <span className="block-label">
          <StampGlyph stamp={stamp} idPrefix={idPrefix} />
        </span>
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
  onSelect,
}: {
  stamp: Stamp;
  selected: boolean;
  uses: number;
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
      <StampBlock stamp={stamp} idPrefix="tray" />
      {uses > 0 && <span className="stamp-uses">{uses}</span>}
    </button>
  );
}
