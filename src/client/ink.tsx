import type { Ink } from '../shared/engine';

// Four riso drums. Every ink also carries its own screen (solid, stripes, dots, hatch) so the
// layers stay readable without colour. Colours come from CSS tokens (styles.css :root).
export const INK_VAR: Record<Ink, { fill: string; mark: string; edge: string }> = {
  R: { fill: 'var(--ink-red)', mark: 'var(--ink-red-mark)', edge: 'var(--ink-red-edge)' },
  B: { fill: 'var(--ink-blue)', mark: 'var(--ink-blue-mark)', edge: 'var(--ink-blue-edge)' },
  Y: { fill: 'var(--ink-yellow)', mark: 'var(--ink-yellow-mark)', edge: 'var(--ink-yellow-edge)' },
  K: { fill: 'var(--ink-green)', mark: 'var(--ink-green-mark)', edge: 'var(--ink-green-edge)' },
};

export const INK_NAME: Record<Ink, string> = {
  R: 'red',
  B: 'blue',
  Y: 'yellow',
  K: 'green',
};

export const INK_TEXTURE_NAME: Record<Ink, string> = {
  R: 'solid',
  B: 'stripes',
  Y: 'dots',
  K: 'crosshatch',
};

const st = (v: string) => ({ fill: v });

/** SVG <defs>: one screen per ink and the paper grain. Ids are prefixed per SVG. */
export function InkDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-R`} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" style={st(INK_VAR.R.fill)} />
      </pattern>
      <pattern id={`${id}-B`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" style={st(INK_VAR.B.fill)} />
        <rect width="4.5" height="14" style={st(INK_VAR.B.mark)} />
      </pattern>
      <pattern id={`${id}-Y`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
        <rect width="12" height="12" style={st(INK_VAR.Y.fill)} />
        <circle cx="6" cy="6" r="2.6" style={st(INK_VAR.Y.mark)} />
      </pattern>
      <pattern id={`${id}-K`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="12" height="12" style={st(INK_VAR.K.fill)} />
        <rect width="2.2" height="12" style={st(INK_VAR.K.mark)} />
        <rect width="12" height="2.2" style={st(INK_VAR.K.mark)} />
      </pattern>
      {/* Paper: discrete specks where the ink skipped (texture.md, speck grain), never animated. */}
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 9 -4.2" />
      </filter>
      <filter id={`${id}-fibre`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.12" numOctaves="2" seed="4" />
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.25  0 0 0 0.9 -0.35" />
      </filter>
    </defs>
  );
}

export function inkFill(svgId: string, ink: Ink): string {
  return `url(#${svgId}-${ink})`;
}

/** A small printed swatch, for the press strip on the result card. */
export function InkChip({ ink, size = 20 }: { ink: Ink; size?: number }) {
  const id = `chip-${ink}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={`${INK_NAME[ink]} ink`} role="img">
      <InkDefs id={id} />
      <rect x="1.5" y="1.5" width="21" height="21" rx="1" fill={inkFill(id, ink)} style={{ stroke: INK_VAR[ink].edge }} strokeWidth="1.5" />
    </svg>
  );
}
