export const DEFAULT_TEE_COLORS = [
  "#39496B",
  "#D9523C",
  "#CCA353",
  "#3E6237",
  "#1a1a1a",
  "#6E6E6E",
  "#8B5A2B",
  "#4A6FA5",
  "#C45C26",
  "#5C7A3A",
] as const;

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function resolveTeeColor(
  color: string | undefined | null,
  index: number,
  fallback = "#CF8018",
): string {
  const trimmed = color?.trim();
  if (trimmed && HEX_COLOR.test(trimmed)) return trimmed;
  return DEFAULT_TEE_COLORS[index] ?? fallback;
}

/**
 * Diagonal split for combo tees: lower tee # color top-left,
 * higher tee # color bottom-right (line from bottom-left to top-right).
 */
export function teeSplitBackground(
  colorLow: string,
  colorHigh: string,
): string {
  return `linear-gradient(to bottom right, ${colorLow} 50%, ${colorHigh} 50%)`;
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0–1) for a #RRGGBB color; null when unparsable. */
export function teeColorLuminance(color: string): number | null {
  const hex = color.trim();
  if (!HEX_COLOR.test(hex)) return null;
  const r = srgbChannelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const g = srgbChannelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const b = srgbChannelToLinear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Label color for a selected tee tab filled with `color` (and optional
 * combo `colorSecondary`). Uses the lighter fill so text stays readable on
 * both halves of a split (e.g. white/silver → black, never white-on-white).
 */
export function teeSelectedLabelColor(
  color: string,
  colorSecondary?: string | null,
): "#111111" | "#ffffff" {
  const primary = teeColorLuminance(color);
  const secondary = colorSecondary
    ? teeColorLuminance(colorSecondary)
    : null;
  const luminance =
    primary == null
      ? secondary
      : secondary == null
        ? primary
        : Math.max(primary, secondary);
  if (luminance == null) return "#ffffff";
  // Prefer white text when it still meets ~3:1 contrast against the lightest fill.
  const contrastWithWhite = (1.0 + 0.05) / (luminance + 0.05);
  return contrastWithWhite >= 3 ? "#ffffff" : "#111111";
}
