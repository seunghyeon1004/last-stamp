import { shapeOf, type Stamp } from '../shared/engine';
import { INK_NAME, INK_TEXTURE_NAME, InkDefs, inkFill } from './ink';

/** A rubber stamp in the tray: the shape drawn as a block on a wooden mount. */
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
  const id = `tray-${stamp.id}`;
  return (
    <button
      type="button"
      className={`stamp ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={`${INK_NAME[stamp.ink]} stamp, ${INK_TEXTURE_NAME[stamp.ink]}, ${shape.length} cells${uses ? `, pressed ${uses} times` : ''}`}
      onClick={onSelect}
    >
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
      {uses > 0 && <span className="stamp-uses">×{uses}</span>}
    </button>
  );
}
