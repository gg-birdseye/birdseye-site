import { formatPrice } from "@/lib/pricing";
import { isStandardHoleTier } from "@/lib/pricing/multi-course";
import { TRAVEL_MOBILIZATION_FEE_CENTS } from "@/lib/pricing/travel";
import { parseTradeOutCreditAmountDollars } from "@/lib/onboarding/trade-out-merge";
import type { PlanInterval } from "@/lib/db/schema";

export type PaymentSummaryCourseLine = {
  courseName: string;
  resolvedHoleCount: number;
  unitPriceCents: number;
};

export type PaymentSummaryBreakdownLine = {
  label: string;
  amountCents: number | null;
  isDeduction?: boolean;
  oneTime?: boolean;
  informational?: boolean;
};

export type InvitePaymentSummaryInput = {
  plan: PlanInterval;
  /** Gross year-1 subscription per billing period (after multi-course discount, before trade-out). */
  subscriptionCents: number;
  /** Gross year-2+ subscription per billing period (after multi-course discount, before trade-out). */
  renewalSubscriptionCents?: number | null;
  quotedSubtotalCents?: number | null;
  multiCourseDiscountCents?: number;
  multiCourseDiscountPercent?: number;
  isCustomPrice?: boolean;
  isCustomRenewal?: boolean;
  travelRequired: boolean;
  tradeOutElected: boolean;
  tradeOutCreditAmountRaw?: string | null;
  courseLines?: PaymentSummaryCourseLine[];
};

export type InvitePaymentSummary = {
  breakdownLines: PaymentSummaryBreakdownLine[];
  subscriptionCents: number;
  renewalSubscriptionCents: number | null;
  tradeOutCreditCents: number;
  recurringChargeCents: number;
  /** Net year-2+ charge after trade-out credit. */
  renewalRecurringChargeCents: number | null;
  /** Annual plans: first 50% installment (subscription portion only). */
  annualFirstInstallmentCents: number | null;
  /** Annual plans: second 50% installment due on the 1st of the month after delivery. */
  annualSecondInstallmentCents: number | null;
  travelFeeCents: number;
  firstPaymentCents: number;
  secondPaymentCents: number | null;
  recurringChargeLabel: string;
  renewalRecurringChargeLabel: string | null;
  firstPaymentLabel: string;
  secondPaymentLabel: string | null;
  tradeOutCreditPending: boolean;
  plan: PlanInterval;
};

export function resolveAnnualInstallmentCents(recurringChargeCents: number) {
  const firstInstallmentCents = Math.floor(recurringChargeCents / 2);
  const secondInstallmentCents = recurringChargeCents - firstInstallmentCents;
  return { firstInstallmentCents, secondInstallmentCents };
}

export function resolveTradeOutPeriodCreditCents(
  plan: PlanInterval,
  tradeOutElected: boolean,
  tradeOutCreditAmountRaw: string | null | undefined,
): { creditCents: number; pending: boolean } {
  if (!tradeOutElected) {
    return { creditCents: 0, pending: false };
  }

  const annualDollars = parseTradeOutCreditAmountDollars(tradeOutCreditAmountRaw);
  if (annualDollars == null) {
    return { creditCents: 0, pending: true };
  }

  const annualCents = Math.round(annualDollars * 100);
  const creditCents =
    plan === "monthly" ? Math.round(annualCents / 12) : annualCents;

  return { creditCents, pending: false };
}

export function formatPaymentSummaryAmount(
  cents: number,
  options?: { isDeduction?: boolean; oneTime?: boolean },
) {
  const prefix = options?.isDeduction ? "−" : "";
  const suffix = options?.oneTime ? " (one-time)" : "";
  return `${prefix}${formatPrice(cents / 100)}${suffix}`;
}

export function computeInvitePaymentSummary(
  input: InvitePaymentSummaryInput,
): InvitePaymentSummary | null {
  if (input.subscriptionCents <= 0) return null;

  const periodSuffix = input.plan === "monthly" ? "/mo" : "/yr";
  const { creditCents: tradeOutCreditCents, pending: tradeOutCreditPending } =
    resolveTradeOutPeriodCreditCents(
      input.plan,
      input.tradeOutElected,
      input.tradeOutCreditAmountRaw,
    );

  const recurringChargeCents = Math.max(
    0,
    input.subscriptionCents - tradeOutCreditCents,
  );
  const renewalSubscriptionCents =
    input.renewalSubscriptionCents != null && input.renewalSubscriptionCents > 0
      ? input.renewalSubscriptionCents
      : null;
  const renewalRecurringChargeCents =
    renewalSubscriptionCents != null
      ? Math.max(0, renewalSubscriptionCents - tradeOutCreditCents)
      : null;
  const travelFeeCents = input.travelRequired ? TRAVEL_MOBILIZATION_FEE_CENTS : 0;

  let annualFirstInstallmentCents: number | null = null;
  let annualSecondInstallmentCents: number | null = null;
  let firstPaymentCents: number;
  let secondPaymentCents: number | null;

  if (input.plan === "annual") {
    const installments = resolveAnnualInstallmentCents(recurringChargeCents);
    annualFirstInstallmentCents = installments.firstInstallmentCents;
    annualSecondInstallmentCents = installments.secondInstallmentCents;
    firstPaymentCents = annualFirstInstallmentCents + travelFeeCents;
    secondPaymentCents = annualSecondInstallmentCents;
  } else {
    firstPaymentCents = recurringChargeCents + travelFeeCents;
    secondPaymentCents = null;
  }

  const breakdownLines: PaymentSummaryBreakdownLine[] = [];

  if (input.courseLines?.length && !input.isCustomPrice) {
    for (const line of input.courseLines) {
      const customLabel = !isStandardHoleTier(line.resolvedHoleCount) ? ", custom" : "";
      breakdownLines.push({
        label: `${line.courseName} (${line.resolvedHoleCount} holes${customLabel})`,
        amountCents: line.unitPriceCents,
        informational: true,
      });
    }
  }

  const hasMultiCourseDiscount = (input.multiCourseDiscountCents ?? 0) > 0;

  if (hasMultiCourseDiscount && !input.isCustomPrice && input.quotedSubtotalCents) {
    breakdownLines.push({
      label: "Subscription subtotal",
      amountCents: input.quotedSubtotalCents,
    });
    breakdownLines.push({
      label: `Multi-course discount (${input.multiCourseDiscountPercent ?? 0}%)`,
      amountCents: input.multiCourseDiscountCents ?? 0,
      isDeduction: true,
    });
  }

  breakdownLines.push({
    label: input.isCustomPrice
      ? `Year 1 subscription (custom)${periodSuffix}`
      : `Year 1 subscription (list)${periodSuffix}`,
    amountCents: input.subscriptionCents,
  });

  if (renewalSubscriptionCents != null) {
    breakdownLines.push({
      label: input.isCustomRenewal
        ? `Year 2+ subscription (custom)${periodSuffix}`
        : `Year 2+ subscription (list)${periodSuffix}`,
      amountCents: renewalSubscriptionCents,
    });
  }

  if (input.tradeOutElected) {
    if (tradeOutCreditPending) {
      breakdownLines.push({
        label: "Trade-out credit (pending configuration)",
        amountCents: null,
        informational: true,
      });
    } else {
      breakdownLines.push({
        label:
          input.plan === "monthly"
            ? "Trade-out credit (1/12 of annual)"
            : "Trade-out credit (per year)",
        amountCents: tradeOutCreditCents,
        isDeduction: true,
      });
    }
  }

  if (
    input.plan === "annual" &&
    !tradeOutCreditPending &&
    annualFirstInstallmentCents != null
  ) {
    breakdownLines.push({
      label: "Year 1 subscription due (net)/yr",
      amountCents: recurringChargeCents,
    });
    breakdownLines.push({
      label: "First installment (50% of subscription)",
      amountCents: annualFirstInstallmentCents,
    });
  }

  if (travelFeeCents > 0) {
    breakdownLines.push({
      label: "Travel & mobilization fee",
      amountCents: travelFeeCents,
      oneTime: true,
    });
  }

  return {
    breakdownLines,
    subscriptionCents: input.subscriptionCents,
    renewalSubscriptionCents,
    tradeOutCreditCents,
    recurringChargeCents,
    renewalRecurringChargeCents,
    annualFirstInstallmentCents,
    annualSecondInstallmentCents,
    travelFeeCents,
    firstPaymentCents,
    secondPaymentCents,
    recurringChargeLabel: `${formatPrice(recurringChargeCents / 100)}${periodSuffix}`,
    renewalRecurringChargeLabel:
      renewalRecurringChargeCents != null
        ? `${formatPrice(renewalRecurringChargeCents / 100)}${periodSuffix}`
        : null,
    firstPaymentLabel: formatPrice(firstPaymentCents / 100),
    secondPaymentLabel:
      secondPaymentCents != null
        ? formatPrice(secondPaymentCents / 100)
        : null,
    tradeOutCreditPending,
    plan: input.plan,
  };
}
