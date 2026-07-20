import { RECURRING_PAYMENT_AFTER_DELIVERY_LABEL } from "@/lib/onboarding/billing-copy";
import {
  formatPaymentSummaryAmount,
  type InvitePaymentSummary,
} from "@/lib/pricing/invite-payment-summary";

function BreakdownRow({
  label,
  amountCents,
  isDeduction,
  oneTime,
  informational,
}: {
  label: string;
  amountCents: number | null;
  isDeduction?: boolean;
  oneTime?: boolean;
  informational?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${
        informational ? "text-stone-500" : "text-stone-300"
      }`}
    >
      <span>{label}</span>
      {amountCents != null ? (
        <span className={isDeduction ? "text-emerald-300/90" : "text-stone-200"}>
          {formatPaymentSummaryAmount(amountCents, { isDeduction, oneTime })}
        </span>
      ) : null}
    </div>
  );
}

type PaymentSummaryPanelProps = {
  summary: InvitePaymentSummary;
  audience?: "admin" | "client";
};

export function PaymentSummaryPanel({
  summary,
  audience = "client",
}: PaymentSummaryPanelProps) {
  const isMonthly = summary.plan === "monthly";
  const isAdmin = audience === "admin";

  return (
    <div className="rounded-xl border border-birdseye-400/20 bg-birdseye-950/30 p-4 text-sm text-stone-300">
      <p className="font-medium text-white">
        {isAdmin ? "Payment summary" : "Your charges"}
      </p>
      <p className="mt-1 text-xs text-stone-500">
        {isAdmin
          ? "Auto-calculated from courses, plan, travel fee, and trade-out credit. Annual plans collect 50% of the subscription upfront; travel is added in full to the first payment only."
          : isMonthly
            ? `First month is due at checkout. Subsequent monthly payments are due ${RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}.`
            : `Annual plans require a 50% deposit at checkout. The remaining balance is due ${RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}. Travel fees, if applicable, are due in full with your first payment.`}
      </p>

      <div className="mt-4 space-y-2 border-b border-white/10 pb-4">
        {summary.breakdownLines.map((line, index) => (
          <BreakdownRow key={`${line.label}-${index}`} {...line} />
        ))}
      </div>

      <dl className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-medium text-white">
            {isAdmin ? "First payment total" : "Due at checkout"}
          </dt>
          <dd className="text-lg font-semibold text-white">
            {summary.firstPaymentLabel}
          </dd>
        </div>

        {isMonthly ? (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium text-white">
                {isAdmin ? "Recurring monthly charge" : "Then each month"}
              </dt>
              <dd className="text-base font-semibold text-birdseye-200">
                {summary.recurringChargeLabel}
              </dd>
            </div>
            <p className="text-xs text-stone-500">
              Recurring payments begin {RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium text-white">
                {isAdmin ? "Second payment total" : "Second payment"}
              </dt>
              <dd className="text-base font-semibold text-birdseye-200">
                {summary.secondPaymentLabel}
              </dd>
            </div>
            <p className="text-xs text-stone-500">
              Remaining 50% of the annual subscription — due{" "}
              {RECURRING_PAYMENT_AFTER_DELIVERY_LABEL}.
            </p>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-medium text-white">
                {isAdmin ? "Recurring annual charge" : "Year 2 and later (each year)"}
              </dt>
              <dd className="text-base font-semibold text-birdseye-200">
                {summary.recurringChargeLabel}
              </dd>
            </div>
            <p className="text-xs text-stone-500">
              Renewals do not include the travel fee.
            </p>
          </>
        )}
      </dl>
    </div>
  );
}
