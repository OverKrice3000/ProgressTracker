/** Fallback when a slice has no hex fill (stats always passes fillColor). */
export interface StatsSliceColorInput {
  fillColor?: string;
  hue?: number;
  shadeIndex?: number;
}

export function colorForStatsSlice(node: StatsSliceColorInput, fallbackIndex: number): string {
  if (node.fillColor) {
    return node.fillColor;
  }
  const h = node.hue ?? (30 + fallbackIndex * 41) % 360;
  const shade = node.shadeIndex ?? 0;
  const l = Math.min(76, 34 + shade * 8);
  return `hsl(${h} 65% ${l}%)`;
}

export const STATS_UNTRACKED_SLICE_COLOR = '#94a3b8';
