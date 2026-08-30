export type HoleCount = 9 | 18 | 27 | "other";

export type PricingPeriod = {
  monthly: number;
  yearly: number;
};

export type PricingTier = PricingPeriod & {
  year2: PricingPeriod;
};

export const PRICING_BY_HOLES: Record<Exclude<HoleCount, "other">, PricingTier> = {
  9: { monthly: 300, yearly: 3000, year2: { monthly: 100, yearly: 1000 } },
  18: { monthly: 500, yearly: 5000, year2: { monthly: 200, yearly: 2000 } },
  27: { monthly: 700, yearly: 7000, year2: { monthly: 300, yearly: 3000 } },
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

export function annualSavings(period: PricingPeriod) {
  return period.monthly * 12 - period.yearly;
}

export type PricingTerm = "year1" | "year2";

export function getStandardTier(holeCount: number) {
  if (holeCount === 9 || holeCount === 18 || holeCount === 27) {
    return PRICING_BY_HOLES[holeCount];
  }
  return null;
}

export function getListPriceCents(
  holeCount: number,
  plan: "monthly" | "annual",
  term: PricingTerm = "year1",
) {
  const tier = getStandardTier(holeCount);
  if (!tier) return null;
  const period = term === "year2" ? tier.year2 : tier;
  return plan === "monthly" ? period.monthly * 100 : period.yearly * 100;
}
