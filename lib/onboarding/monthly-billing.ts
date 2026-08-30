import type { Client } from "@/lib/db/schema";
import {
  buildPaymentSummaryFromClient,
  resolvePlan,
} from "@/lib/onboarding/client-utils";
import {
  getClientByIdWithCourses,
  updateClientById,
} from "@/lib/onboarding/clients";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * After monthly checkout, keep Year 1 pricing for 12 billing cycles,
 * then drop to the Year 2+ rate for the rest of the subscription.
 */
export async function scheduleMonthlyYear2PriceDrop(client: Client) {
  if (resolvePlan(client) !== "monthly") return { skipped: "not_monthly" as const };
  if (!isStripeConfigured()) return { skipped: "stripe_unconfigured" as const };
  if (client.paymentMethod === "manual") return { skipped: "manual" as const };
  if (client.stripeSubscriptionScheduleId) {
    return { skipped: "already_scheduled" as const };
  }
  if (!client.stripeSubscriptionId) {
    return { skipped: "no_subscription" as const };
  }

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
        duration: { interval: "month", interval_count: 12 },
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
