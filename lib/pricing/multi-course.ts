import {
  PRICING_BY_HOLES,
  formatPrice,
  type HoleCount,
} from "@/lib/pricing";
import type { PlanInterval } from "@/lib/db/schema";

export type CourseLineInput = {
  courseName: string;
  holeCount: number;
  customHoleCount?: number | null;
  customUnitPriceCents?: number | null;
  courseAddressLine1?: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  courseZip?: string | null;
};

export type CourseLinePricing = CourseLineInput & {
  resolvedHoleCount: number;
  unitPriceCents: number;
  unitPriceLabel: string;
};

export type MultiCourseQuote = {
  courses: CourseLinePricing[];
  courseCount: number;
  subtotalCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
  subtotalLabel: string;
  discountLabel: string;
  totalLabel: string;
  plan: PlanInterval;
};

/** 10% off when two or more courses share one subscription. */
export function getMultiCourseDiscountPercent(courseCount: number): number {
  return courseCount >= 2 ? 10 : 0;
}

export function resolveLineHoleCount(line: CourseLineInput): number {
  if (line.customHoleCount) return line.customHoleCount;
  return line.holeCount;
}

export function getTierPriceCents(
  holeCount: number,
  plan: PlanInterval,
): number | null {
  if (![9, 18, 27].includes(holeCount)) return null;
  const tier = PRICING_BY_HOLES[holeCount as Exclude<HoleCount, "other">];
  return plan === "monthly" ? tier.monthly * 100 : tier.yearly * 100;
}

export function getLineUnitPriceCents(
  line: CourseLineInput,
  plan: PlanInterval,
): number | null {
  if (line.customUnitPriceCents != null && line.customUnitPriceCents >= 0) {
    return line.customUnitPriceCents;
  }
  return getTierPriceCents(resolveLineHoleCount(line), plan);
}

export function isStandardHoleTier(holeCount: number) {
  return [9, 18, 27].includes(holeCount);
}

export function calculateMultiCourseQuote(
  courses: CourseLineInput[],
  plan: PlanInterval,
): MultiCourseQuote | null {
  if (courses.length === 0) return null;

  const pricedLines: CourseLinePricing[] = [];
  for (const line of courses) {
    const resolvedHoleCount = resolveLineHoleCount(line);
    const unitPriceCents = getLineUnitPriceCents(line, plan);
    if (unitPriceCents == null) return null;

    pricedLines.push({
      ...line,
      resolvedHoleCount,
      unitPriceCents,
      unitPriceLabel: formatPrice(unitPriceCents / 100),
    });
  }

  const subtotalCents = pricedLines.reduce(
    (sum, line) => sum + line.unitPriceCents,
    0,
  );
  const discountPercent = getMultiCourseDiscountPercent(pricedLines.length);
  const discountCents = Math.round(subtotalCents * (discountPercent / 100));
  const totalCents = subtotalCents - discountCents;

  return {
    courses: pricedLines,
    courseCount: pricedLines.length,
    subtotalCents,
    discountPercent,
    discountCents,
    totalCents,
    subtotalLabel: formatPrice(subtotalCents / 100),
    discountLabel: formatPrice(discountCents / 100),
    totalLabel: formatPrice(totalCents / 100),
    plan,
  };
}
