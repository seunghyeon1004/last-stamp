import type { Ink } from '../shared/engine';

// Riso-style inks. Each ink also has its own texture so layers stay readable without colour.
export const INK_HEX: Record<Ink, string> = {
  R: '#E8414A',
  B: '#1F6FB8',
  Y: '#F7D417',
  K: '#232326',
};

export const INK_NAME: Record<Ink, string> = {
  R: 'red',
  B: 'blue',
  Y: 'yellow',
  K: 'black',
};

export const INK_TEXTURE_NAME: Record<Ink, string> = {
  R: 'solid',
  B: 'stripes',
  Y: 'dots',
  K: 'crosshatch',
};

/** SVG <defs> with one pattern per ink plus a paper grain filter. Ids are prefixed per SVG. */
export function InkDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={`${id}-R`} width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill={INK_HEX.R} />
      </pattern>
      <pattern id={`${id}-B`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" fill={INK_HEX.B} />
        <rect width="5" height="14" fill="#5D9FDB" />
      </pattern>
      <pattern id={`${id}-Y`} width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
        <rect width="13" height="13" fill={INK_HEX.Y} />
        <circle cx="6.5" cy="6.5" r="3" fill="#C9A400" />
      </pattern>
      <pattern id={`${id}-K`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" fill={INK_HEX.K} />
        <rect width="2.5" height="14" fill="#6A6A70" />
        <rect width="14" height="2.5" fill="#6A6A70" />
      </pattern>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.95  0 0 0 0 0.93  0 0 0 0 0.89  0 0 0 0.55 -0.12"
        />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
  );
}

export function inkFill(svgId: string, ink: Ink): string {
  return `url(#${svgId}-${ink})`;
}

/** Small swatch used in strips and legends. */
export function InkChip({ ink, size = 18 }: { ink: Ink; size?: number }) {
  const id = `chip-${ink}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={`${INK_NAME[ink]} ink`} role="img">
      <InkDefs id={id} />
      <rect x="1" y="1" width="22" height="22" fill={inkFill(id, ink)} />
    </svg>
  );
}
