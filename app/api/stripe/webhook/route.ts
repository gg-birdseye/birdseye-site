import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isDatabaseConfigured } from "@/lib/db";
import {
  getClientByStripeCustomerId,
  getClientByStripeSubscriptionId,
  updateClientById,
} from "@/lib/onboarding/clients";
import { activateClient, setClientBillingStatus } from "@/lib/onboarding/activation";
import { saveCheckoutCardForFutureUse } from "@/lib/onboarding/annual-billing";
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

  console.info("STRIPE_WEBHOOK_RECEIVED", event.type, event.id);

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: "no_database" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientId = session.metadata?.clientId;
        if (!clientId) break;

        let savedCard: {
          customerId: string;
          paymentMethodId: string;
        } | null = null;
        if (session.mode === "payment") {
          try {
            savedCard = await saveCheckoutCardForFutureUse(session.id);
          } catch (error) {
            console.error("Failed to save Checkout card for later annual billing:", error);
          }
        }

        await updateClientById(clientId, {
          stripeCustomerId:
            savedCard?.customerId ??
            (typeof session.customer === "string" ? session.customer : null),
          ...(savedCard?.paymentMethodId
            ? { stripeDefaultPaymentMethodId: savedCard.paymentMethodId }
            : {}),
          stripeSubscriptionId:
            typeof session.subscription === "string"
              ? session.subscription
              : null,
          stripeCheckoutSessionId: session.id,
        });

        await activateClient(clientId);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        let clientId = subscription.metadata?.clientId || null;

        if (!clientId && subscription.schedule) {
          const scheduleId =
            typeof subscription.schedule === "string"
              ? subscription.schedule
              : subscription.schedule.id;
          const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
          clientId = schedule.metadata?.clientId || null;
        }

        const fromSub = clientId
          ? null
          : await getClientByStripeSubscriptionId(subscription.id);
        const fromCustomer =
          clientId || fromSub
            ? null
            : typeof subscription.customer === "string"
              ? await getClientByStripeCustomerId(subscription.customer)
              : null;
        const targetId = clientId || fromSub?.id || fromCustomer?.id;
        if (!targetId) break;

        await updateClientById(targetId, {
          stripeSubscriptionId: subscription.id,
          ...(typeof subscription.schedule === "string"
            ? { stripeSubscriptionScheduleId: subscription.schedule }
            : {}),
        });
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
