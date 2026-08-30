import type { Client } from "@/lib/db/schema";
import {
  formatYmdLong,
  type Ymd,
} from "@/lib/billing/notification-dates";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isBillingEmailConfigured() {
  return isEmailConfigured();
}

function greeting(client: Client) {
  return escapeHtml(client.contactName ?? "there");
}

function courseLabel(client: Client) {
  return escapeHtml(client.courseName ?? "your course");
}

export function recipientEmails(client: Client): string[] {
  const emails = [client.contactEmail, client.billingApEmail]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  return [...new Set(emails)];
}

export async function sendAnnualRenewalReminderEmail(input: {
  client: Client;
  to: string[];
  renewalDate: Ymd;
  cancellationDeadline: Ymd;
  amountLabel: string;
}) {
  const renewal = formatYmdLong(input.renewalDate);
  const cancelBy = formatYmdLong(input.cancellationDeadline);
  const amount = escapeHtml(input.amountLabel);
  const replyTo = process.env.CONTACT_TO_EMAIL?.trim();

  await sendEmail({
    to: input.to,
    replyTo,
    required: true,
    subject: `Your Birdseye subscription renews on ${renewal}`,
    html: `
      <p>Hi ${greeting(input.client)},</p>
      <p>This is a reminder that the Birdseye subscription for <strong>${courseLabel(input.client)}</strong> will automatically renew on <strong>${renewal}</strong>.</p>
      <p>On that date, <strong>${amount}</strong> will be charged to the card on file.</p>
      <p>You may cancel automatic renewal by written notice at least 30 days before ${renewal} (by <strong>${cancelBy}</strong>). Replying to this email counts as written notice. Cancellation takes effect at the end of the current term and does not refund amounts already paid.</p>
      <p>If you have questions about your plan or invoice, just reply to this email.</p>
      <p>— The Birdseye team</p>
    `,
  });
}

export async function sendUpcomingChargeReminderEmail(input: {
  client: Client;
  to: string[];
  chargeDate: Ymd;
  amountLabel: string;
  isRenewal: boolean;
}) {
  const chargeOn = formatYmdLong(input.chargeDate);
  const amount = escapeHtml(input.amountLabel);
  const replyTo = process.env.CONTACT_TO_EMAIL?.trim();
  const what = input.isRenewal
    ? "your annual Birdseye subscription renewal"
    : "the remaining 50% of your first-year Birdseye subscription";

  await sendEmail({
    to: input.to,
    replyTo,
    required: true,
    subject: `Upcoming Birdseye payment on ${chargeOn}`,
    html: `
      <p>Hi ${greeting(input.client)},</p>
      <p>A payment for <strong>${courseLabel(input.client)}</strong> is coming up.</p>
      <p>On <strong>${chargeOn}</strong>, <strong>${amount}</strong> will be charged to the card on file for ${what}.</p>
      <p>No action is needed unless you need to update the card on file. Reply to this email if we can help.</p>
      <p>— The Birdseye team</p>
    `,
  });
}

export async function sendBillingNotificationsAdminDigest(input: {
  todayLabel: string;
  dryRun: boolean;
  html: string;
}) {
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  if (!to) {
    console.warn("CONTACT_TO_EMAIL is not set; skipping billing notification digest.");
    return;
  }

  const prefix = input.dryRun ? "[Dry run] " : "";
  await sendEmail({
    to,
    required: true,
    subject: `${prefix}Birdseye billing notifications — ${input.todayLabel}`,
    html: input.html,
  });
}
