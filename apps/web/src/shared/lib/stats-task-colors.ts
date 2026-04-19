/**
 * Deterministic, high-contrast colors for stats pie/table.
 * Same taskId always maps to the same hex across refreshes and filter toggles.
 */

/** FNV-1a 32-bit */
export function fnv1aHash(taskId: string): number {
  let h = 2166136261;
  for (let i = 0; i < taskId.length; i++) {
    h ^= taskId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** HSL (0-360, 0-100, 0-100) to #rrggbb */
export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return `#${[R, G, B].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * D3 schemeCategory10 (accessible qualitative scale) + extra hues for larger sets.
 * @see https://github.com/d3/d3-scale-chromatic
 */
const CATEGORY10 = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
] as const;

/** ColorBrewer Set3-style extras (distinct hues) */
const SET3_EXTRAS = [
  '#8dd3c7',
  '#ffffb3',
  '#bebada',
  '#fb8072',
  '#80b1d3',
  '#fdb462',
  '#b3de69',
  '#fccde5',
  '#d9d9d9',
  '#bc80bd',
  '#ccebc5',
  '#ffed6f',
] as const;

/** Evenly spaced hues (15° steps) at two lightness bands → separation from neighbors */
function buildWheelVariants(): string[] {
  const out: string[] = [];
  for (const L of [46, 54] as const) {
    for (let i = 0; i < 24; i++) {
      const hue = (i * 360) / 24;
      out.push(hslToHex(hue, 72, L));
    }
  }
  return out;
}

/**
 * Interleave qualitative (D3 / ColorBrewer-style) with evenly spaced hues so
 * consecutive palette indices tend to differ strongly (helps adjacent pie slices).
 * Index selection remains hash-based (deterministic per taskId).
 */
const TASK_COLOR_PALETTE: readonly string[] = (() => {
  const wheel = buildWheelVariants();
  const qual = [...CATEGORY10, ...SET3_EXTRAS];
  const out: string[] = [];
  const m = Math.max(qual.length, wheel.length);
  for (let i = 0; i < m; i++) {
    if (i < qual.length) {
      out.push(qual[i]!);
    }
    if (i < wheel.length) {
      out.push(wheel[i]!);
    }
  }
  return out;
})();

const PALETTE_LEN = TASK_COLOR_PALETTE.length;

/**
 * Returns a stable hex color for a task. Untracked should use STATS_UNTRACKED_SLICE_COLOR instead.
 * Uses hash → palette index with a prime step to reduce consecutive-index collisions for similar ids.
 */
export function statsColorHexForTaskId(taskId: string): string {
  const h = fnv1aHash(taskId);
  /** Knuth-style mix for better spread before modulo (reduces similar ids → adjacent palette slots). */
  const idx = (Math.imul(h >>> 0, 2654435761) >>> 0) % PALETTE_LEN;
  return TASK_COLOR_PALETTE[idx]!;
}
