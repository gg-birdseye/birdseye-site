import type { Client } from "@/lib/db/schema";
import { activateClient } from "@/lib/onboarding/activation";
import { saveCheckoutCardForFutureUse } from "@/lib/onboarding/annual-billing";
import { updateClientById } from "@/lib/onboarding/clients";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export function isStripeCheckoutPaid(
  paymentStatus: string | null | undefined,
  status: string | null | undefined,
) {
  return paymentStatus === "paid" || status === "complete";
}

/** Verify the stored Checkout Session is paid, then activate (Sanity + welcome email). */
export async function completeCheckoutIfPaid(client: Client) {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured.");
  }

  if (!client.stripeCheckoutSessionId) {
    throw new Error("No Stripe checkout session on file for this client.");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(
    client.stripeCheckoutSessionId,
  );

  if (!isStripeCheckoutPaid(session.payment_status, session.status)) {
    throw new Error("Stripe checkout is not paid yet.");
  }

  let savedCard: { customerId: string; paymentMethodId: string } | null = null;
  if (session.mode === "payment") {
    try {
      savedCard = await saveCheckoutCardForFutureUse(session.id);
    } catch (error) {
      console.error(
        "Failed to save Checkout card for later annual billing:",
        error,
      );
    }
  }

  await updateClientById(client.id, {
    stripeCustomerId:
      savedCard?.customerId ??
      (typeof session.customer === "string"
        ? session.customer
        : client.stripeCustomerId),
    ...(savedCard?.paymentMethodId
      ? { stripeDefaultPaymentMethodId: savedCard.paymentMethodId }
      : {}),
    stripeSubscriptionId:
      typeof session.subscription === "string"
        ? session.subscription
        : client.stripeSubscriptionId,
    stripeCheckoutSessionId: session.id,
  });

  return activateClient(client.id);
}
