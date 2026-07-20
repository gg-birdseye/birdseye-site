import {
  PRICING_BY_HOLES,
  type HoleCount,
  formatPrice,
} from "@/lib/pricing";
import { RECURRING_PAYMENT_AFTER_DELIVERY_LABEL } from "@/lib/onboarding/billing-copy";
import {
  computeInvitePaymentSummary,
  type InvitePaymentSummary,
  type PaymentSummaryCourseLine,
} from "@/lib/pricing/invite-payment-summary";
import { calculateMultiCourseQuote } from "@/lib/pricing/multi-course";
import {
  resolveTravelMobilizationFeeCents,
} from "@/lib/pricing/travel";
import type { Client, ClientCourse, ClientWithCourses, PlanInterval } from "@/lib/db/schema";

export function resolveHoleCount(
  client: Client,
  course?: ClientCourse | null,
): number {
  if (course) {
    if (course.customHoleCount) return course.customHoleCount;
    return course.holeCount;
  }
  if (client.customHoleCount) return client.customHoleCount;
  if (client.holeCount) return client.holeCount;
  return 18;
}

export function resolvePlan(client: Client): PlanInterval {
  return client.plan === "monthly" ? "monthly" : "annual";
}

export function resolvePriceCents(client: Client): number | null {
  if (client.customPriceCents) return client.customPriceCents;

  if (
    client.quotedSubtotalCents != null &&
    client.multiCourseDiscountCents != null
  ) {
    return client.quotedSubtotalCents - client.multiCourseDiscountCents;
  }

  const holes = client.holeCount as HoleCount | null;
  if (!holes || holes === ("other" as HoleCount)) return null;

  const tier = PRICING_BY_HOLES[holes as 9 | 18 | 27];
  if (!tier) return null;

  return resolvePlan(client) === "monthly" ? tier.monthly * 100 : tier.yearly * 100;
}

export function resolvePriceLabel(client: Client) {
  const cents = resolvePriceCents(client);
  if (cents == null) return "Contact for custom pricing";
  return formatPrice(cents / 100);
}

export function buildPaymentSummaryFromClient(
  client: ClientWithCourses | Client,
): InvitePaymentSummary | null {
  const subscriptionCents = resolvePriceCents(client);
  if (subscriptionCents == null) return null;

  const plan = resolvePlan(client);
  const withCourses = client as ClientWithCourses;
  let courseLines: PaymentSummaryCourseLine[] | undefined;

  if (withCourses.courses?.length && !client.customPriceCents) {
    const quote = calculateMultiCourseQuote(
      withCourses.courses.map((course) => ({
        courseName: course.courseName,
        holeCount: course.holeCount,
        customHoleCount: course.customHoleCount,
        customUnitPriceCents: course.customUnitPriceCents,
      })),
      plan,
    );
    courseLines = quote?.courses.map((line) => ({
      courseName: line.courseName,
      resolvedHoleCount: line.resolvedHoleCount,
      unitPriceCents: line.unitPriceCents,
    }));
  }

  return computeInvitePaymentSummary({
    plan,
    subscriptionCents,
    quotedSubtotalCents: client.quotedSubtotalCents,
    multiCourseDiscountCents: client.multiCourseDiscountCents ?? 0,
    multiCourseDiscountPercent: client.multiCourseDiscountPercent ?? 0,
    isCustomPrice: client.customPriceCents != null,
    travelRequired: client.travelMobilizationFeeRequired,
    tradeOutElected: client.tradeOutElected,
    tradeOutCreditAmountRaw: client.tradeOutCreditAmount,
    courseLines,
  });
}

export function resolveRecurringChargeCents(client: Client): number | null {
  const summary = buildPaymentSummaryFromClient(client);
  if (summary) return summary.recurringChargeCents;

  const listCents = resolvePriceCents(client);
  return listCents;
}

export function resolveInitialCheckoutCents(client: Client): number | null {
  const summary = buildPaymentSummaryFromClient(client);
  if (summary) return summary.firstPaymentCents;

  const subscriptionCents = resolvePriceCents(client);
  if (subscriptionCents == null) return null;
  return subscriptionCents + resolveTravelMobilizationFeeCents(client);
}

export function resolveCourseCount(client: ClientWithCourses | Client) {
  const withCourses = client as ClientWithCourses;
  if (withCourses.courses?.length) return withCourses.courses.length;
  return 1;
}

export function resolveAccountLabel(client: ClientWithCourses | Client) {
  const count = resolveCourseCount(client);
  if (client.organizationName?.trim()) return client.organizationName.trim();
  if (count > 1) return `${count} courses`;
  return client.courseName ?? "Course";
}

export type BillingSummary = {
  amountLabel: string;
  /** List subscription before trade-out credit. */
  listSubscriptionAmountLabel: string;
  /** Net recurring charge after trade-out credit. */
  subscriptionAmountLabel: string;
  dueTodayLabel: string;
  frequencyLabel: string;
  checkoutNote: string;
  isCustomPrice: boolean;
  planLabel: "Monthly" | "Annual";
  subtotalLabel?: string;
  discountLabel?: string;
  discountPercent?: number;
  courseCount: number;
  travelFeeRequired: boolean;
  travelFeeStatusLabel: "Applied" | "Not applied";
  travelFeeLabel?: string;
  checkoutTotalLabel?: string;
  secondPaymentLabel?: string;
};

export function resolveBillingSummary(
  client: ClientWithCourses | Client,
): BillingSummary | null {
  const listCents = resolvePriceCents(client);
  if (listCents == null) return null;

  const paymentSummary = buildPaymentSummaryFromClient(client);
  const recurringCents = paymentSummary?.recurringChargeCents ?? listCents;
  const firstPaymentCents = paymentSummary?.firstPaymentCents ?? listCents;

  const listSubscriptionAmountLabel = formatPrice(listCents / 100);
  const subscriptionAmountLabel = formatPrice(recurringCents / 100);
  const travelFeeCents = resolveTravelMobilizationFeeCents(client);
  const travelFeeRequired = travelFeeCents > 0;
  const travelFeeStatusLabel = travelFeeRequired ? "Applied" : "Not applied";
  const travelFeeLabel = travelFeeRequired
    ? formatPrice(travelFeeCents / 100)
    : undefined;
  const checkoutTotalLabel = formatPrice(firstPaymentCents / 100);
  const amountLabel = checkoutTotalLabel;
  const plan = resolvePlan(client);
  const planLabel = plan === "monthly" ? "Monthly" : "Annual";
  const isCustomPrice = client.customPriceCents != null;
  const courseCount = resolveCourseCount(client);
  const hasDiscount = (client.multiCourseDiscountCents ?? 0) > 0;

  const subtotalLabel = client.quotedSubtotalCents
    ? formatPrice(client.quotedSubtotalCents / 100)
    : undefined;
  const discountLabel = hasDiscount
    ? formatPrice((client.multiCourseDiscountCents ?? 0) / 100)
    : undefined;

  if (plan === "monthly") {
    const dueTodayLabel = `${amountLabel} due today`;
    const nextPaymentTiming = RECURRING_PAYMENT_AFTER_DELIVERY_LABEL;

    return {
      amountLabel,
      listSubscriptionAmountLabel,
      subscriptionAmountLabel,
      dueTodayLabel,
      frequencyLabel: `First month due today; subsequent payments due ${nextPaymentTiming}.`,
      checkoutNote: travelFeeRequired
        ? `You will be charged ${checkoutTotalLabel} today (first month deposit plus ${travelFeeLabel} travel fee). Your next payment of ${subscriptionAmountLabel} is due ${nextPaymentTiming}, then each month thereafter.`
        : `You will be charged ${subscriptionAmountLabel} today (first month deposit). Your next payment of ${subscriptionAmountLabel} is due ${nextPaymentTiming}, then each month thereafter.`,
      isCustomPrice,
      planLabel,
      subtotalLabel,
      discountLabel,
      discountPercent: client.multiCourseDiscountPercent ?? 0,
      courseCount,
      travelFeeRequired,
      travelFeeStatusLabel,
      travelFeeLabel,
      checkoutTotalLabel,
    };
  }

  const dueTodayLabel = `${amountLabel} due today`;
  const secondPaymentLabel =
    paymentSummary?.secondPaymentLabel &&
    paymentSummary.secondPaymentCents != null
      ? formatPrice(paymentSummary.secondPaymentCents / 100)
      : undefined;

  return {
    amountLabel,
    listSubscriptionAmountLabel,
    subscriptionAmountLabel,
    dueTodayLabel,
    frequencyLabel: `Annual plan — 50% deposit due today, remaining 50% due ${RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}.`,
    checkoutNote: travelFeeRequired
      ? `You will be charged ${checkoutTotalLabel} today (50% annual deposit plus ${travelFeeLabel} travel fee). The remaining ${secondPaymentLabel ?? "balance"} is due ${RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}. After year one, your subscription renews at ${subscriptionAmountLabel} per year.`
      : `You will be charged ${checkoutTotalLabel} today (50% annual deposit). The remaining ${secondPaymentLabel ?? "balance"} is due ${RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}. After year one, your subscription renews at ${subscriptionAmountLabel} per year.`,
    isCustomPrice,
    planLabel,
    subtotalLabel,
    discountLabel,
    discountPercent: client.multiCourseDiscountPercent ?? 0,
    courseCount,
    travelFeeRequired,
    travelFeeStatusLabel,
    travelFeeLabel,
    checkoutTotalLabel,
    secondPaymentLabel,
  };
}

export function getOnboardingStep(client: Client): 1 | 2 | 3 | 4 {
  if (client.onboardingStatus === "active") return 4;
  if (
    client.onboardingStatus === "payment_pending" ||
    client.onboardingStatus === "contract_signed"
  ) {
    return 3;
  }
  if (client.onboardingStatus === "intake_complete") return 2;
  return 1;
}

export function canAccessPaymentStep(client: Client) {
  return (
    client.onboardingStatus === "contract_signed" ||
    client.onboardingStatus === "payment_pending" ||
    client.onboardingStatus === "active"
  );
}

export function getManualPaymentInstructions() {
  return (
    process.env.MANUAL_PAYMENT_INSTRUCTIONS?.trim() ||
    "If paying by check, please make check payable to Birdseye Golf. Checks can be mailed to:\nBirdseye Golf\n625 N Cherry Creek Pkwy\nRichmond, UT 84333"
  );
}
