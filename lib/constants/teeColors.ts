export const DEFAULT_TEE_COLORS = [
  "#39496B",
  "#D9523C",
  "#CCA353",
  "#3E6237",
  "#1a1a1a",
  "#6E6E6E",
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
