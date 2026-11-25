// Deterministic daily puzzle: the same UTC date always gives the same sheet, stamps and par.
import {
  CELLS,
  SHAPES,
  SIZE,
  fits,
  footprint,
  shapeOf,
  simulate,
  solve,
  type Cell,
  type Ink,
  type Press,
  type Stamp,
} from './engine';

export const GENERATOR_VERSION = 2;

export type Puzzle = {
  date: string; // YYYY-MM-DD (UTC)
  number: number; // issue number, 1 = launch day
  weekday: number; // 0 Sunday .. 6 Saturday
  stamps: Stamp[];
  target: Cell[];
  par: number;
  solution: Press[]; // one optimal press order
};

export const LAUNCH_DATE = '2026-11-23';

/** Difficulty band per weekday (UTC). */
export type Band = { stamps: [number, number]; par: [number, number]; minInked: number };
export const BANDS: Record<number, Band> = {
  1: { stamps: [2, 2], par: [2, 3], minInked: 6 }, // Mon
  2: { stamps: [3, 3], par: [3, 4], minInked: 8 }, // Tue
  3: { stamps: [2, 3], par: [4, 4], minInked: 9 }, // Wed
  4: { stamps: [3, 3], par: [5, 5], minInked: 10 }, // Thu
  5: { stamps: [3, 4], par: [5, 6], minInked: 11 }, // Fri
  6: { stamps: [4, 4], par: [6, 8], minInked: 12 }, // Sat
  0: { stamps: [3, 4], par: [5, 6], minInked: 11 }, // Sun
};

// Shapes that read clearly at small size; the 1-cell dot is excluded because it trivialises deduction.
const SHAPE_POOL = Object.keys(SHAPES).filter((k) => k !== 'dot');

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: small, fast, deterministic across JS engines. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!;
}

function int(r: () => number, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1));
}

function shuffle<T>(r: () => number, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}

export type Candidate = { stamps: Stamp[]; target: Cell[]; par: number; solution: Press[] };

/** Rules a generated day must satisfy to be published. Exported for tests. */
export function acceptable(c: Candidate, band: Band): boolean {
  if (c.par < band.par[0] || c.par > band.par[1]) return false;
  const inked = c.target.filter((x) => x !== '.').length;
  if (inked < band.minInked || inked > CELLS - 3) return false;
  // every stamp in the tray is needed by the optimal solution (no decoys yet)
  const used = new Set(c.solution.map((p) => p.stamp));
  if (used.size !== c.stamps.length) return false;
  // something must be buried: the optimal presses cover more cells than are visible
  let covered = 0;
  for (const p of c.solution) covered += shapeOf(c.stamps.find((s) => s.id === p.stamp)!.shape).length;
  if (covered <= inked) return false;
  // every ink in the tray shows on the sheet
  for (const s of c.stamps) if (!c.target.includes(s.ink)) return false;
  // the presses form one connected composition (no stray island that is solved on its own)
  const foot = c.solution.map((p) => footprint(shapeOf(c.stamps.find((s) => s.id === p.stamp)!.shape), p.row, p.col));
  const touches = (a: number[], b: number[]) =>
    a.some((i) => b.some((j) => i === j || (Math.abs(i - j) === 1 && Math.floor(i / SIZE) === Math.floor(j / SIZE)) || Math.abs(i - j) === SIZE));
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const a = queue.pop()!;
    for (let b = 0; b < foot.length; b++)
      if (!seen.has(b) && touches(foot[a]!, foot[b]!)) {
        seen.add(b);
        queue.push(b);
      }
  }
  if (seen.size !== foot.length) return false;
  // enough layering to deduce: at least half the presses are partly covered by a later press
  let buried = 0;
  for (let i = 0; i < foot.length; i++) {
    const later = new Set(foot.slice(i + 1).flat());
    if (foot[i]!.some((x) => later.has(x))) buried++;
  }
  if (buried < Math.floor(c.par / 2)) return false;
  return true;
}

function candidate(r: () => number, band: Band): Candidate | null {
  const nStamps = int(r, band.stamps[0], band.stamps[1]);
  const inks = shuffle(r, ['R', 'B', 'Y', 'K'] as Ink[]).slice(0, nStamps);
  // black only on 4-stamp days; keep the three bright inks first otherwise
  if (nStamps < 4 && inks.includes('K')) return null;
  const shapes = shuffle(r, SHAPE_POOL.slice()).slice(0, nStamps);
  const stamps: Stamp[] = inks.map((ink, i) => ({ id: `s${i}`, ink, shape: shapes[i]! }));
  const nPresses = int(r, band.par[0], band.par[1] + 1);
  const presses: Press[] = [];
  for (let k = 0; k < nPresses; k++) {
    // make sure each stamp is pressed at least once
    const stamp = k < stamps.length ? stamps[k]! : pick(r, stamps);
    const shape = shapeOf(stamp.shape);
    const spots: [number, number][] = [];
    for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) if (fits(shape, row, col)) spots.push([row, col]);
    const [row, col] = pick(r, spots);
    presses.push({ stamp: stamp.id, row, col });
  }
  shuffle(r, presses);
  const target = simulate(stamps, presses);
  const sol = solve(stamps, target, band.par[1] + 1);
  if (!sol) return null;
  return { stamps, target, par: sol.par, solution: sol.presses };
}

const cache = new Map<string, Puzzle>();

export function puzzleFor(date: string): Puzzle {
  if (!isDateKey(date)) throw new Error(`bad date ${date}`);
  const hit = cache.get(date);
  if (hit) return hit;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const band = BANDS[weekday]!;
  const base = hashString(`overprint:v${GENERATOR_VERSION}:${date}`);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const r = rng((base + Math.imul(attempt, 0x9e3779b1)) >>> 0);
    const c = candidate(r, band);
    if (c && acceptable(c, band)) {
      const p: Puzzle = {
        date,
        number: dayDiff(LAUNCH_DATE, date) + 1,
        weekday,
        stamps: c.stamps,
        target: c.target,
        par: c.par,
        solution: c.solution,
      };
      cache.set(date, p);
      return p;
    }
  }
  throw new Error(`no acceptable puzzle for ${date}`);
}
