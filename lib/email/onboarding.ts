import type { Client } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import {
  resolveBillingSummary,
  resolvePlan,
  resolvePriceLabel,
} from "@/lib/onboarding/client-utils";
import { getClientByIdWithCourses } from "@/lib/onboarding/clients";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function planSummaryHtml(client: Client) {
  const billing = resolveBillingSummary(client);
  const period = resolvePlan(client) === "monthly" ? "per month" : "per year";
  const year1 = escapeHtml(billing?.subscriptionAmountLabel ?? resolvePriceLabel(client));
  const year2 = billing?.renewalAmountLabel
    ? escapeHtml(billing.renewalAmountLabel)
    : null;

  if (!year2) {
    return `<p>Plan: <strong>${year1} ${period}</strong></p>`;
  }

  return `
    <p>Your plan:</p>
    <ul>
      <li>Year 1: <strong>${year1} ${period}</strong></li>
      <li>Year 2 and later: <strong>${year2} ${period}</strong></li>
    </ul>
  `;
}

export async function sendOnboardingActivationEmails(client: Client) {
  const billed = (await getClientByIdWithCourses(client.id)) ?? client;
  const adminEmail = process.env.CONTACT_TO_EMAIL;
  const courseName = escapeHtml(billed.courseName ?? "Course");
  const contactName = escapeHtml(billed.contactName ?? "there");
  const planHtml = planSummaryHtml(billed);

  if (billed.contactEmail) {
    await sendEmail({
      to: billed.contactEmail,
      subject: "Welcome to Birdseye — you're all set",
      html: `
        <p>Hi ${contactName},</p>
        <p>Your Birdseye account for <strong>${courseName}</strong> is now active.</p>
        ${planHtml}
        <p>Next steps:</p>
        <ul>
          <li>Share your course logo (SVG or PNG on transparent background)</li>
          <li>Confirm scorecard / tee information</li>
          <li>Schedule your drone flyover capture if not already booked</li>
        </ul>
        <p>We'll be in touch shortly to complete your course setup.</p>
        <p>— The Birdseye team</p>
      `,
    });
  }

  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `New Birdseye client activated — ${billed.courseName ?? "Course"}`,
      html: `
        <p><strong>${courseName}</strong> is now active.</p>
        ${planHtml}
        <p>Contact: ${escapeHtml(billed.contactName ?? "—")} (${escapeHtml(billed.contactEmail ?? "—")})</p>
        <p>Course slug: ${escapeHtml(billed.courseSlug ?? "pending")}</p>
        <p>Sanity course ID: ${escapeHtml(billed.sanityCourseId ?? "pending")}</p>
        <p>Finish setup in Sanity Studio when ready.</p>
      `,
    });
  }
}

export async function sendPaymentFailedEmail(client: Client) {
  if (!client.contactEmail) return;

  await sendEmail({
    to: client.contactEmail,
    subject: "Action needed — Birdseye payment issue",
    html: `
      <p>Hi ${escapeHtml(client.contactName ?? "there")},</p>
      <p>We couldn't process your latest Birdseye payment for <strong>${escapeHtml(client.courseName ?? "your course")}</strong>.</p>
      <p>Please update your payment method to keep your course preview online.</p>
      <p>— The Birdseye team</p>
    `,
  });

  const adminEmail = process.env.CONTACT_TO_EMAIL;
  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      subject: `Payment failed — ${client.courseName ?? "Client"}`,
      html: `<p>Client ${escapeHtml(client.courseName ?? "unknown")} has a failed payment.</p>`,
    });
  }
}

export async function sendInviteEmail(client: Client, inviteUrl: string) {
  if (!client.contactEmail) return;

  await sendEmail({
    to: client.contactEmail,
    subject: "Complete your Birdseye onboarding",
    html: `
      <p>Hi ${escapeHtml(client.contactName ?? "there")},</p>
      <p>You're ready to get started with Birdseye for <strong>${escapeHtml(client.courseName ?? "your course")}</strong>.</p>
      <p><a href="${inviteUrl}">Complete onboarding</a></p>
      <p>This link is unique to your course. If you have questions, just reply to this email.</p>
    `,
  });
}
