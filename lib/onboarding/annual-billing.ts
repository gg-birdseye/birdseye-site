import type { Client } from "@/lib/db/schema";
import type Stripe from "stripe";
import { updateClientById, getClientByIdWithCourses } from "@/lib/onboarding/clients";
import {
  buildPaymentSummaryFromClient,
  resolveAccountLabel,
  resolvePlan,
} from "@/lib/onboarding/client-utils";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

const BILLING_TIME_ZONE = "America/Denver";

function zonedYmd(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
  };
}

/** 1st of the calendar month after `deliveredAt`, noon UTC (always the 1st in US timezones). */
export function firstOfMonthAfterDelivery(
  deliveredAt: Date,
  timeZone = BILLING_TIME_ZONE,
) {
  const { year, month } = zonedYmd(deliveredAt, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(Date.UTC(nextYear, nextMonth - 1, 1, 12, 0, 0));
}

export async function ensureDefaultPaymentMethod(
  customerId: string,
  paymentMethodId?: string | null,
) {
  const stripe = getStripe();
  let methodId = paymentMethodId?.trim() || null;

  if (!methodId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error("Stripe customer was deleted.");
    }
    const existing = customer.invoice_settings?.default_payment_method;
    methodId =
      typeof existing === "string"
        ? existing
        : existing && "id" in existing
          ? existing.id
          : null;
  }

  if (!methodId) {
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    methodId = methods.data[0]?.id ?? null;
  }

  if (!methodId) {
    throw new Error(
      "No saved card on the Stripe customer. The client must complete the 50% deposit checkout so the card can be reused.",
    );
  }

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: methodId },
  });

  return methodId;
}

export async function saveCheckoutCardForFutureUse(sessionId: string) {
  if (!isStripeConfigured()) return null;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  if (!customerId) return null;

  const paymentIntent = session.payment_intent;
  const paymentMethodId =
    paymentIntent &&
    typeof paymentIntent !== "string" &&
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent &&
          typeof paymentIntent !== "string" &&
          paymentIntent.payment_method &&
          typeof paymentIntent.payment_method !== "string"
        ? paymentIntent.payment_method.id
        : null;

  const methodId = await ensureDefaultPaymentMethod(customerId, paymentMethodId);
  return { customerId, paymentMethodId: methodId };
}

export async function scheduleAnnualBillingAfterDelivery(client: Client) {
  if (resolvePlan(client) !== "annual") {
    throw new Error("Annual billing schedules apply to annual plans only.");
  }

  if (client.stripeSubscriptionScheduleId) {
    return {
      client,
      alreadyScheduled: true,
      billingStartsAt: client.annualBillingStartsAt,
      stripeScheduled: true,
    };
  }

  const deliveredAt = client.deliveredAt ?? new Date();
  const billingStartsAt = firstOfMonthAfterDelivery(deliveredAt);
  const billedClient = (await getClientByIdWithCourses(client.id)) ?? client;
  const summary = buildPaymentSummaryFromClient(billedClient);
  const secondInstallmentCents = summary?.annualSecondInstallmentCents;
  const year1AnnualCents = summary?.recurringChargeCents;
  const renewalCents = summary?.renewalRecurringChargeCents;

  if (!secondInstallmentCents || !year1AnnualCents) {
    throw new Error("No annual price is configured for this client.");
  }

  if (client.paymentMethod === "manual" || !isStripeConfigured()) {
    const updated = await updateClientById(client.id, {
      deliveredAt,
      annualBillingStartsAt: billingStartsAt,
    });
    return {
      client: updated ?? client,
      alreadyScheduled: false,
      billingStartsAt,
      stripeScheduled: false,
    };
  }

  if (!client.stripeCustomerId) {
    throw new Error(
      "No Stripe customer on file. Complete the 50% deposit checkout before marking delivered.",
    );
  }

  const paymentMethodId = await ensureDefaultPaymentMethod(
    client.stripeCustomerId,
    client.stripeDefaultPaymentMethodId,
  );

  const stripe = getStripe();
  const accountLabel = resolveAccountLabel(client);
  const startUnix = Math.floor(billingStartsAt.getTime() / 1000);

  const remainingPrice = await stripe.prices.create({
    currency: "usd",
    unit_amount: secondInstallmentCents,
    recurring: { interval: "year" },
    product_data: {
      name: `Birdseye remaining 50% — ${accountLabel}`,
    },
    metadata: {
      clientId: client.id,
      installment: "annual_second_50",
    },
  });

  const phases: Stripe.SubscriptionScheduleCreateParams.Phase[] = [
    {
      items: [{ price: remainingPrice.id, quantity: 1 }],
      duration: { interval: "year", interval_count: 1 },
      proration_behavior: "none",
      metadata: {
        clientId: client.id,
        purpose: "annual_second_50",
      },
    },
  ];

  if (renewalCents && renewalCents > 0) {
    const renewalPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: renewalCents,
      recurring: { interval: "year" },
      product_data: {
        name: `Birdseye annual subscription — ${accountLabel}`,
      },
      metadata: {
        clientId: client.id,
        installment: "annual_renewal_year2",
      },
    });
    phases.push({
      items: [{ price: renewalPrice.id, quantity: 1 }],
      proration_behavior: "none",
      metadata: {
        clientId: client.id,
        purpose: "annual_renewal_year2",
      },
    });
  }

  const schedule = await stripe.subscriptionSchedules.create({
    customer: client.stripeCustomerId,
    start_date: startUnix,
    end_behavior: renewalCents && renewalCents > 0 ? "release" : "cancel",
    default_settings: {
      default_payment_method: paymentMethodId,
      collection_method: "charge_automatically",
    },
    metadata: {
      clientId: client.id,
      purpose: "annual_after_delivery",
    },
    phases,
  });

  const subscriptionId =
    typeof schedule.subscription === "string" ? schedule.subscription : null;

  const updated = await updateClientById(client.id, {
    deliveredAt,
    annualBillingStartsAt: billingStartsAt,
    stripeDefaultPaymentMethodId: paymentMethodId,
    stripeSubscriptionScheduleId: schedule.id,
    stripeSubscriptionId: subscriptionId ?? client.stripeSubscriptionId,
  });

  return {
    client: updated ?? client,
    alreadyScheduled: false,
    billingStartsAt,
    stripeScheduled: true,
    scheduleId: schedule.id,
  };
}
