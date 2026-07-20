import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getClientByStripeCustomerId,
  getClientByStripeSubscriptionId,
  updateClientById,
} from "@/lib/onboarding/clients";
import { activateClient, setClientBillingStatus } from "@/lib/onboarding/activation";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { sendPaymentFailedEmail } from "@/lib/email/onboarding";

const GRACE_PERIOD_DAYS = 7;

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature failed:", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: "no_database" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientId = session.metadata?.clientId;
        if (!clientId) break;

        await updateClientById(clientId, {
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : null,
          stripeCheckoutSessionId: session.id,
        });

        await activateClient(clientId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;

        const client = await getClientByStripeCustomerId(customerId);

        if (!client) break;

        const graceEnds = new Date();
        graceEnds.setDate(graceEnds.getDate() + GRACE_PERIOD_DAYS);

        await updateClientById(client.id, {
          billingStatus: "past_due",
          paymentStatus: "failed",
          gracePeriodEndsAt: graceEnds,
        });

        await sendPaymentFailedEmail(client);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // Initial subscription checkout is handled by checkout.session.completed.
        if (invoice.billing_reason === "subscription_create") break;

        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;

        const client = await getClientByStripeCustomerId(customerId);
        if (!client) break;

        if (client.onboardingStatus !== "active") {
          await activateClient(client.id);
        } else {
          await setClientBillingStatus(client.id, "active", {
            paymentStatus: "paid",
            gracePeriodEndsAt: null,
            suspendedAt: null,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const client = await getClientByStripeSubscriptionId(subscription.id);
        if (!client) break;

        await setClientBillingStatus(client.id, "inactive", {
          paymentStatus: "failed",
          onboardingStatus: "cancelled",
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
