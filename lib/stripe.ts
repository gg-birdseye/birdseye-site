import Stripe from "stripe";
import type { Client } from "@/lib/db/schema";
import type { HoleCount } from "@/lib/pricing";
import {
  resolveTradeOutPeriodCreditCents,
} from "@/lib/pricing/invite-payment-summary";
import {
  TRAVEL_DISTANCE_THRESHOLD_MILES,
  TRAVEL_MOBILIZATION_FEE_CENTS,
  TRAVEL_MOBILIZATION_FEE_LABEL,
  TRAVEL_ORIGIN_LABEL,
  resolveTravelMobilizationFeeCents,
} from "@/lib/pricing/travel";
import {
  resolveBillingSummary,
  resolvePlan,
  buildPaymentSummaryFromClient,
  resolveRecurringChargeCents,
} from "@/lib/onboarding/client-utils";

let stripeClient: Stripe | null = null;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe() {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  return stripeClient;
}

const PRICE_ENV_KEYS: Record<
  Exclude<HoleCount, "other">,
  Record<"monthly" | "annual", string>
> = {
  9: {
    monthly: "STRIPE_PRICE_9_MONTHLY",
    annual: "STRIPE_PRICE_9_ANNUAL",
  },
  18: {
    monthly: "STRIPE_PRICE_18_MONTHLY",
    annual: "STRIPE_PRICE_18_ANNUAL",
  },
  27: {
    monthly: "STRIPE_PRICE_27_MONTHLY",
    annual: "STRIPE_PRICE_27_ANNUAL",
  },
};

export function getStripePriceIdForClient(client: Client): string | null {
  if (resolvePlan(client) === "annual") {
    return null;
  }

  if (client.customPriceCents) {
    return null;
  }

  if ((client.multiCourseDiscountCents ?? 0) > 0) {
    return null;
  }

  const { creditCents } = resolveTradeOutPeriodCreditCents(
    resolvePlan(client),
    client.tradeOutElected,
    client.tradeOutCreditAmount,
  );
  if (creditCents > 0) {
    return null;
  }

  const courses = (client as Client & { courses?: unknown[] }).courses;
  if (courses && courses.length > 1) {
    return null;
  }

  const holes = client.holeCount;
  if (!holes || ![9, 18, 27].includes(holes)) return null;

  const key =
    PRICE_ENV_KEYS[holes as Exclude<HoleCount, "other">]?.[resolvePlan(client)];
  if (!key) return null;

  return process.env[key]?.trim() || null;
}

function buildTravelMobilizationLineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    price_data: {
      currency: "usd",
      unit_amount: TRAVEL_MOBILIZATION_FEE_CENTS,
      product_data: {
        name: TRAVEL_MOBILIZATION_FEE_LABEL,
        description: `One-time fee for on-site production travel beyond ${TRAVEL_DISTANCE_THRESHOLD_MILES} miles from ${TRAVEL_ORIGIN_LABEL}.`,
      },
    },
    quantity: 1,
  };
}

function appendTravelLineItems(
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  client: Client,
) {
  if (resolveTravelMobilizationFeeCents(client) > 0) {
    lineItems.push(buildTravelMobilizationLineItem());
  }
  return lineItems;
}

function buildAnnualFirstInstallmentLineItem(
  billing: NonNullable<ReturnType<typeof resolveBillingSummary>>,
  installmentCents: number,
): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    price_data: {
      currency: "usd",
      unit_amount: installmentCents,
      product_data: {
        name: "Annual subscription — first installment (50%)",
        description: `First of two payments toward ${billing.subscriptionAmountLabel}/yr subscription.`,
      },
    },
    quantity: 1,
  };
}

export async function createCheckoutSessionForClient(
  client: Client,
  token: string,
  origin: string,
) {
  const stripe = getStripe();
  const plan = resolvePlan(client);
  const paymentSummary = buildPaymentSummaryFromClient(client);
  const priceId = getStripePriceIdForClient(client);
  const successUrl = `${origin}/onboarding/${token}?checkout=success`;
  const cancelUrl = `${origin}/onboarding/${token}?checkout=cancel`;
  const billing = resolveBillingSummary(client);

  const metadata = {
    clientId: client.id,
    inviteToken: token,
    checkoutType: plan === "annual" ? "annual_first_installment" : "subscription",
  };

  const customText = billing
    ? {
        submit: {
          message: billing.checkoutNote,
        },
      }
    : undefined;

  if (plan === "annual") {
    const installmentCents = paymentSummary?.annualFirstInstallmentCents;
    if (installmentCents == null) {
      throw new Error("No price configured for this client.");
    }

    if (!billing) {
      throw new Error("No billing summary configured for this client.");
    }

    return stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: client.contactEmail ?? undefined,
      line_items: appendTravelLineItems(
        [buildAnnualFirstInstallmentLineItem(billing, installmentCents)],
        client,
      ),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      custom_text: customText,
    });
  }

  if (priceId) {
    return stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: client.contactEmail ?? undefined,
      line_items: appendTravelLineItems([{ price: priceId, quantity: 1 }], client),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: { metadata },
      custom_text: customText,
    });
  }

  const amount = resolveRecurringChargeCents(client);
  if (amount == null) {
    throw new Error("No price configured for this client.");
  }

  const interval = resolvePlan(client) === "monthly" ? "month" : "year";
  const intervalLabel = interval === "month" ? "month" : "year";

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: client.contactEmail ?? undefined,
    line_items: appendTravelLineItems(
      [
        {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            recurring: { interval },
            product_data: {
              name: `Birdseye — ${client.organizationName ?? client.courseName ?? "Golf Course"}`,
              description: billing
                ? `${billing.planLabel} subscription — ${billing.subscriptionAmountLabel} per ${intervalLabel}. ${billing.dueTodayLabel}.`
                : undefined,
            },
          },
          quantity: 1,
        },
      ],
      client,
    ),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: { metadata },
    custom_text: customText,
  });
}

export async function createCustomerPortalUrl(customerId: string, returnUrl: string) {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
