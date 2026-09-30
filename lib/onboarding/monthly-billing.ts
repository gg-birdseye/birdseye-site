import type { Client } from "@/lib/db/schema";
import { firstOfMonthAfterDelivery } from "@/lib/onboarding/annual-billing";
import {
  buildPaymentSummaryFromClient,
  resolvePlan,
} from "@/lib/onboarding/client-utils";
import {
  getClientById,
  getClientByIdWithCourses,
  updateClientById,
} from "@/lib/onboarding/clients";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/** Far-future hold so Stripe does not bill again until delivery is marked (~23 months; under Stripe’s ~2y trial limit). */
const PENDING_DELIVERY_TRIAL_SECONDS = 86400 * 700;

/** First month is paid at checkout; 11 monthly cycles remain at Year 1 pricing. */
const YEAR1_CYCLES_AFTER_FIRST_PAYMENT = 11;

type Year2ScheduleOptions = {
  /** Billing cycles that stay on Year 1 pricing starting when the schedule begins. */
  year1BillingCycles?: number;
};

/**
 * After monthly checkout / delivery resume, keep Year 1 pricing for N billing
 * cycles, then drop to the Year 2+ rate for the rest of the subscription.
 *
 * When the subscription is still in trial, Stripe starts the schedule when the
 * trial ends — so call this after setting `trial_end` to the resume date.
 */
export async function scheduleMonthlyYear2PriceDrop(
  client: Client,
  options: Year2ScheduleOptions = {},
) {
  if (resolvePlan(client) !== "monthly") return { skipped: "not_monthly" as const };
  if (!isStripeConfigured()) return { skipped: "stripe_unconfigured" as const };
  if (client.paymentMethod === "manual") return { skipped: "manual" as const };
  if (client.stripeSubscriptionScheduleId) {
    return { skipped: "already_scheduled" as const };
  }
  if (!client.stripeSubscriptionId) {
    return { skipped: "no_subscription" as const };
  }

  const year1BillingCycles =
    options.year1BillingCycles ?? YEAR1_CYCLES_AFTER_FIRST_PAYMENT;

  const billedClient = (await getClientByIdWithCourses(client.id)) ?? client;
  const summary = buildPaymentSummaryFromClient(billedClient);
  const year1Cents = summary?.recurringChargeCents;
  const year2Cents = summary?.renewalRecurringChargeCents;

  if (!year1Cents || year2Cents == null || year2Cents >= year1Cents) {
    return { skipped: "no_price_drop" as const };
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    client.stripeSubscriptionId,
    { expand: ["items.data.price.product"] },
  );
  const item = subscription.items.data[0];
  if (!item) {
    throw new Error("Monthly subscription has no items to reschedule.");
  }

  const productId =
    typeof item.price.product === "string"
      ? item.price.product
      : item.price.product && "id" in item.price.product
        ? item.price.product.id
        : null;
  if (!productId) {
    throw new Error("Monthly subscription item is missing a Stripe product.");
  }

  const year2Price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: year2Cents,
    recurring: { interval: "month" },
    metadata: {
      clientId: client.id,
      purpose: "monthly_year2",
    },
  });

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: subscription.id,
  });

  const currentPhase = schedule.phases[0];
  if (!currentPhase) {
    throw new Error("Stripe did not return a current subscription phase.");
  }

  const year1Items = currentPhase.items.map((phaseItem) => ({
    price:
      typeof phaseItem.price === "string" ? phaseItem.price : phaseItem.price.id,
    quantity: phaseItem.quantity ?? 1,
  }));

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: year1Items,
        start_date: currentPhase.start_date,
        duration: { interval: "month", interval_count: year1BillingCycles },
        proration_behavior: "none",
      },
      {
        items: [{ price: year2Price.id, quantity: 1 }],
        proration_behavior: "none",
      },
    ],
  });

  await updateClientById(client.id, {
    stripeSubscriptionScheduleId: schedule.id,
    stripeSubscriptionId: subscription.id,
  });

  return { scheduled: true as const, scheduleId: schedule.id };
}

/**
 * After the first month is paid, put the subscription on a long trial so Stripe
 * does not charge again until an admin marks the course delivered.
 * Year 2+ price drop is scheduled later, when billing resumes after delivery.
 */
export async function holdMonthlyBillingUntilDelivery(client: Client) {
  if (resolvePlan(client) !== "monthly") return { skipped: "not_monthly" as const };
  if (!isStripeConfigured()) return { skipped: "stripe_unconfigured" as const };
  if (client.paymentMethod === "manual") return { skipped: "manual" as const };
  if (!client.stripeSubscriptionId) {
    return { skipped: "no_subscription" as const };
  }
  if (client.deliveredAt) {
    return { skipped: "already_delivered" as const };
  }

  const stripe = getStripe();
  const trialEnd =
    Math.floor(Date.now() / 1000) + PENDING_DELIVERY_TRIAL_SECONDS;

  // Subscription schedules block some subscription updates — release first.
  if (client.stripeSubscriptionScheduleId) {
    try {
      await stripe.subscriptionSchedules.release(
        client.stripeSubscriptionScheduleId,
      );
    } catch (error) {
      console.error(
        "Failed to release monthly schedule before delivery hold:",
        error,
      );
    }
    await updateClientById(client.id, { stripeSubscriptionScheduleId: null });
  }

  await stripe.subscriptions.update(client.stripeSubscriptionId, {
    trial_end: trialEnd,
    proration_behavior: "none",
  });

  return { held: true as const, trialEnd };
}

/**
 * Mark monthly delivery complete and resume billing on the 1st of next month.
 */
export async function scheduleMonthlyBillingAfterDelivery(client: Client) {
  if (resolvePlan(client) !== "monthly") {
    throw new Error("Monthly billing schedules apply to monthly plans only.");
  }

  if (client.deliveredAt && client.annualBillingStartsAt) {
    return {
      client,
      alreadyScheduled: true,
      billingStartsAt: client.annualBillingStartsAt,
      stripeScheduled: Boolean(client.stripeSubscriptionId),
    };
  }

  const deliveredAt = client.deliveredAt ?? new Date();
  const billingStartsAt = firstOfMonthAfterDelivery(deliveredAt);

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

  if (!client.stripeSubscriptionId) {
    throw new Error(
      "No Stripe subscription on file. Complete the monthly checkout before marking delivered.",
    );
  }

  const stripe = getStripe();
  const billingStartsUnix = Math.floor(billingStartsAt.getTime() / 1000);

  if (client.stripeSubscriptionScheduleId) {
    try {
      await stripe.subscriptionSchedules.release(
        client.stripeSubscriptionScheduleId,
      );
    } catch (error) {
      console.error(
        "Failed to release monthly schedule before resuming billing:",
        error,
      );
    }
    await updateClientById(client.id, { stripeSubscriptionScheduleId: null });
  }

  await stripe.subscriptions.update(client.stripeSubscriptionId, {
    trial_end: billingStartsUnix,
    proration_behavior: "none",
  });

  const updated = await updateClientById(client.id, {
    deliveredAt,
    annualBillingStartsAt: billingStartsAt,
    stripeSubscriptionScheduleId: null,
  });

  const forSchedule = updated ?? {
    ...client,
    deliveredAt,
    annualBillingStartsAt: billingStartsAt,
    stripeSubscriptionScheduleId: null,
  };

  try {
    await scheduleMonthlyYear2PriceDrop(forSchedule, {
      year1BillingCycles: YEAR1_CYCLES_AFTER_FIRST_PAYMENT,
    });
  } catch (error) {
    console.error(
      "Failed to schedule monthly Year 2+ price drop after delivery:",
      error,
    );
  }

  const finalClient = (await getClientById(client.id)) ?? forSchedule;

  return {
    client: finalClient,
    alreadyScheduled: false,
    billingStartsAt,
    stripeScheduled: true,
  };
}
