import { Resend } from "resend";
import type { Referral } from "@/lib/db/schema";
import {
  GIFT_CARD_LABELS,
  REFERRAL_VERIFY_WINDOW_DAYS,
} from "@/lib/referrals/domain";
import { formatUsPhoneFromDigits } from "@/lib/format-phone";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) {
    console.warn("Email not configured; skipping send.", options.subject);
    return;
  }

  try {
    await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });
  } catch (error) {
    console.error("Failed to send referral email:", error);
  }
}

function courseLabel(referral: Referral) {
  return `${referral.courseName} (${referral.courseCity}, ${referral.courseState})`;
}

export async function sendReferralReceivedEmails(referral: Referral) {
  const adminEmail = process.env.CONTACT_TO_EMAIL;
  const course = escapeHtml(courseLabel(referral));
  const giftCard = escapeHtml(
    GIFT_CARD_LABELS[referral.giftCardChoice] ?? referral.giftCardChoice,
  );

  await sendEmail({
    to: referral.referrerEmail,
    subject: `Referral received — ${referral.courseName}`,
    html: `
      <p>Hi ${escapeHtml(referral.referrerName)},</p>
      <p>Thanks for referring <strong>${course}</strong> to Birdseye!</p>
      <p>Here's what happens next:</p>
      <ul>
        <li>We'll reach out to ${escapeHtml(referral.contactName)} to verify the referral (usually within ${REFERRAL_VERIFY_WINDOW_DAYS} days).</li>
        <li>If the course signs on with Birdseye, you'll receive a <strong>$${referral.rewardAmountDollars} ${giftCard} e-gift card</strong>.</li>
        <li>If we can't verify the contact you provided, the referral will be released and the course reopened for referrals.</li>
      </ul>
      <p>We'll keep you posted. Thanks for helping grow the game!</p>
      <p>— The Birdseye team</p>
    `,
  });

  if (adminEmail) {
    await sendEmail({
      to: adminEmail,
      replyTo: referral.referrerEmail,
      subject: `New course referral — ${referral.courseName}`,
      html: `
        <p><strong>${course}</strong> — ${referral.holeCount} holes</p>
        <p>Referrer: ${escapeHtml(referral.referrerName)} (${escapeHtml(referral.referrerEmail)})</p>
        <p>Contact: ${escapeHtml(referral.contactName)} — ${escapeHtml(referral.contactRole)}</p>
        <p>Phone: ${escapeHtml(formatUsPhoneFromDigits(referral.contactPhone))}</p>
        ${referral.howKnow ? `<p>How they know them: ${escapeHtml(referral.howKnow)}</p>` : ""}
        <p>Reward if won: $${referral.rewardAmountDollars} ${giftCard} e-gift card</p>
        <p>Verify the contact, then mark this referral qualified or released in the admin dashboard.</p>
      `,
    });
  }
}

export async function sendReferralReleasedEmail(referral: Referral) {
  const course = escapeHtml(courseLabel(referral));
  const releaseMessage =
    referral.releaseReason === "course_declined"
      ? `
        <p>We contacted <strong>${course}</strong>, but the course let us know
        they aren't interested in being featured on Birdseye at this time.</p>
        <p>Because rewards are issued only when a referred course signs on,
        this referral has been released and the course is open for referrals
        again in the future.</p>
      `
      : `
        <p>We weren't able to verify the club contact you provided for
        <strong>${course}</strong>, so this referral has been released and the
        course is open for referrals again.</p>
        <p>You're welcome to resubmit with a current, reachable club contact.</p>
      `;

  await sendEmail({
    to: referral.referrerEmail,
    subject: `Referral released — ${referral.courseName}`,
    html: `
      <p>Hi ${escapeHtml(referral.referrerName)},</p>
      ${releaseMessage}
      <p>— The Birdseye team</p>
    `,
  });
}

export async function sendReferralWonEmail(referral: Referral) {
  const giftCard = escapeHtml(
    GIFT_CARD_LABELS[referral.giftCardChoice] ?? referral.giftCardChoice,
  );

  await sendEmail({
    to: referral.referrerEmail,
    replyTo: process.env.CONTACT_TO_EMAIL,
    subject: `Your referral signed on — ${referral.courseName}`,
    html: `
      <p>Hi ${escapeHtml(referral.referrerName)},</p>
      <p>Great news — <strong>${escapeHtml(courseLabel(referral))}</strong> has
      officially joined Birdseye thanks to your referral!</p>
      <p>That means you've earned a
      <strong>$${referral.rewardAmountDollars} ${giftCard} e-gift card</strong>.</p>
      <p>To make sure it reaches you, simply reply to this email and confirm
      the email address where you'd like the gift card sent. Once we hear back
      from you, we'll get it on its way.</p>
      <p>Thanks for helping grow the game.</p>
      <p>— The Birdseye team</p>
    `,
  });
}
