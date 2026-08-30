import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** Blind-copied on every outbound automated email so inbox matches what clients see. */
export const AUTOMATED_EMAIL_BCC =
  process.env.AUTOMATED_EMAIL_BCC?.trim() || "hello@birdseye.golf";

export function isEmailConfigured() {
  return Boolean(resend && process.env.RESEND_FROM_EMAIL?.trim());
}

function normalizeAddresses(value?: string | string[]): string[] {
  const list = value == null ? [] : Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      list
        .map((address) => address.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string | string[];
  /** When true, missing Resend config throws instead of skipping. */
  required?: boolean;
}): Promise<boolean> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!resend || !from) {
    if (options.required) {
      throw new Error(
        "Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).",
      );
    }
    console.warn("Email not configured; skipping send.", options.subject);
    return false;
  }

  const to = normalizeAddresses(options.to);
  if (to.length === 0) {
    throw new Error(`No recipients for email (${options.subject}).`);
  }

  const extraBcc = Array.isArray(options.bcc)
    ? options.bcc
    : options.bcc
      ? [options.bcc]
      : [];
  const bcc = normalizeAddresses([AUTOMATED_EMAIL_BCC, ...extraBcc]).filter(
    (address) => !to.includes(address),
  );

  const { error } = await resend.emails.send({
    from,
    to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
    ...(bcc.length > 0 ? { bcc } : {}),
  });

  if (error) {
    throw new Error(
      `Resend failed (${options.subject}): ${error.message ?? JSON.stringify(error)}`,
    );
  }

  return true;
}
