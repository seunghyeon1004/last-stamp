import { shapeOf, type Stamp } from '../shared/engine';
import { INK_NAME, INK_TEXTURE_NAME, InkDefs, inkFill } from './ink';

/** The stamp's face: its shape in its ink, centred in a square. */
export function StampGlyph({ stamp, idPrefix }: { stamp: Stamp; idPrefix: string }) {
  const shape = shapeOf(stamp.shape);
  let rows = 0;
  let cols = 0;
  for (const [r, c] of shape) {
    rows = Math.max(rows, r + 1);
    cols = Math.max(cols, c + 1);
  }
  const u = 20;
  const span = Math.max(rows, cols, 3) * u;
  const ox = (span - cols * u) / 2;
  const oy = (span - rows * u) / 2;
  const id = `${idPrefix}-${stamp.id}`;
  return (
    <svg viewBox={`-4 -4 ${span + 8} ${span + 8}`} aria-hidden="true">
      <InkDefs id={id} />
      {shape.map(([r, c], i) => (
        <rect
          key={i}
          x={ox + c * u}
          y={oy + r * u}
          width={u - 1.5}
          height={u - 1.5}
          rx="1.5"
          fill={inkFill(id, stamp.ink)}
          stroke="#1D1D1F"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

export function stampLabel(stamp: Stamp): string {
  return `${INK_NAME[stamp.ink]} stamp, ${INK_TEXTURE_NAME[stamp.ink]}, ${shapeOf(stamp.shape).length} cells`;
}

/** A rubber stamp in the tray: the face on a wooden mount. */
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
      <StampGlyph stamp={stamp} idPrefix="tray" />
      {uses > 0 && <span className="stamp-uses">×{uses}</span>}
    </button>
  );
}
