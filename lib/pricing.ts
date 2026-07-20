export type HoleCount = 9 | 18 | 27 | "other";

export type PricingTier = {
  monthly: number;
  yearly: number;
};

export const PRICING_BY_HOLES: Record<Exclude<HoleCount, "other">, PricingTier> = {
  9: { monthly: 300, yearly: 3000 },
  18: { monthly: 500, yearly: 5000 },
  27: { monthly: 700, yearly: 7000 },
};

export const HOLE_OPTIONS: { value: HoleCount; label: string }[] = [
  { value: 9, label: "9" },
  { value: 18, label: "18" },
  { value: 27, label: "27" },
  { value: "other", label: "Other" },
];

export function parseHoleCount(value: string | undefined): HoleCount {
  switch (value) {
    case "9":
      return 9;
    case "18":
      return 18;
    case "27":
      return 27;
    case "other":
      return "other";
    default:
      return 18;
  }
}

export function formatPrice(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}

export function annualSavings(tier: PricingTier) {
  return tier.monthly * 12 - tier.yearly;
}
