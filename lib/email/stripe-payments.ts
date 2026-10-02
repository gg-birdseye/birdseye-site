import type Stripe from "stripe";
import type { Client } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import {
  resolveAccountLabel,
  resolvePlan,
} from "@/lib/onboarding/client-utils";
import { getClientByIdWithCourses } from "@/lib/onboarding/clients";
import { formatPrice } from "@/lib/pricing";

/** Internal Stripe payment alerts — defaults to Greg only. */
export const STRIPE_PAYMENT_NOTIFY_EMAIL =
  process.env.STRIPE_PAYMENT_NOTIFY_EMAIL?.trim() || "greg@birdseye.golf";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function billingReasonLabel(reason: string | null | undefined) {
  switch (reason) {
    case "subscription_cycle":
      return "Recurring subscription charge";
    case "subscription_create":
      return "Subscription started (first invoice)";
    case "subscription_update":
      return "Subscription update";
    case "subscription_threshold":
      return "Billing threshold reached";
    case "manual":
      return "Manual invoice";
    case "upcoming":
      return "Upcoming invoice";
    default:
      return reason ? reason.replace(/_/g, " ") : "Stripe invoice payment";
  }
}

/**
 * Notify Greg when Stripe successfully collects an automatic invoice payment
 * (renewals, remaining annual installment, monthly cycles, etc.).
 */
export async function sendAdminAutomaticPaymentEmail(input: {
  invoice: Stripe.Invoice;
  client: Client | null;
}) {
  const { invoice, client } = input;
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return;

  const billed = client
    ? ((await getClientByIdWithCourses(client.id)) ?? client)
    : null;
  const accountLabel = billed
    ? resolveAccountLabel(billed)
    : invoice.customer_name ||
      invoice.customer_email ||
      "Unknown Stripe customer";
  const plan = billed ? resolvePlan(billed) : null;
  const amountLabel = formatPrice(invoice.amount_paid / 100);
  const currency = (invoice.currency ?? "usd").toUpperCase();
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toLocaleString(
        "en-US",
        { timeZone: "America/Denver" },
      )
    : "—";
  const hostedInvoiceUrl = invoice.hosted_invoice_url;
  const invoiceNumber = invoice.number ?? invoice.id;

  await sendEmail({
    to: STRIPE_PAYMENT_NOTIFY_EMAIL,
    omitAutomatedBcc: true,
    subject: `Stripe payment received — ${accountLabel} (${amountLabel})`,
    html: `
      <p>An automatic Stripe payment was processed successfully.</p>
      <ul>
        <li><strong>Account:</strong> ${escapeHtml(accountLabel)}</li>
        ${
          plan
            ? `<li><strong>Plan:</strong> ${plan === "monthly" ? "Monthly" : "Annual"}</li>`
            : ""
        }
        <li><strong>Amount:</strong> ${escapeHtml(amountLabel)} ${escapeHtml(currency)}</li>
        <li><strong>Type:</strong> ${escapeHtml(billingReasonLabel(invoice.billing_reason))}</li>
        <li><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</li>
        <li><strong>Paid at (MT):</strong> ${escapeHtml(paidAt)}</li>
        ${
          billed?.contactEmail
            ? `<li><strong>Contact:</strong> ${escapeHtml(billed.contactName ?? "—")} (${escapeHtml(billed.contactEmail)})</li>`
            : ""
        }
        ${
          invoice.customer && typeof invoice.customer === "string"
            ? `<li><strong>Stripe customer:</strong> ${escapeHtml(invoice.customer)}</li>`
            : ""
        }
      </ul>
      ${
        hostedInvoiceUrl
          ? `<p><a href="${escapeHtml(hostedInvoiceUrl)}">View invoice in Stripe</a></p>`
          : ""
      }
    `,
  });
}
