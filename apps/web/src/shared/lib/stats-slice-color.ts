/** Shared with the pie chart so table swatches match slice fills exactly. */
export interface StatsSliceColorInput {
  hue?: number;
  shadeIndex?: number;
  fillColor?: string;
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
