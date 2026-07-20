import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isDatabaseConfigured } from "@/lib/db";
import { getDb, leads } from "@/lib/db";
import { isRecaptchaConfigured, verifyRecaptchaToken } from "@/lib/recaptcha";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

type ContactPayload = {
  name?: string;
  organization?: string;
  email?: string;
  referralSource?: string;
  message?: string;
  website?: string;
  captchaToken?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let body: ContactPayload;

  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.website?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = body.name?.trim() ?? "";
  const organization = body.organization?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const referralSource = body.referralSource?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  if (organization.length > 200) {
    return NextResponse.json(
      { error: "Golf course or company is too long (max 200 characters)." },
      { status: 400 },
    );
  }

  if (referralSource.length > 200) {
    return NextResponse.json(
      { error: "Referral source is too long (max 200 characters)." },
      { status: 400 },
    );
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Message is too long (max 5000 characters)." },
      { status: 400 },
    );
  }

  if (isRecaptchaConfigured()) {
    const captchaToken = body.captchaToken?.trim() ?? "";
    if (!captchaToken) {
      return NextResponse.json(
        { error: "Captcha verification is required." },
        { status: 400 },
      );
    }

    const captchaValid = await verifyRecaptchaToken(captchaToken);
    if (!captchaValid) {
      return NextResponse.json(
        { error: "Captcha verification failed. Please try again." },
        { status: 400 },
      );
    }
  }

  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!resend || !from || !to) {
    return NextResponse.json(
      { error: "Contact form is not configured." },
      { status: 503 },
    );
  }

  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `Birdseye inquiry from ${name}`,
    text: [
      `Name: ${name}`,
      organization ? `Golf course or company: ${organization}` : null,
      `Email: ${email}`,
      referralSource ? `How did you hear about us?: ${referralSource}` : null,
      "",
      message,
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
    html: [
      "<p><strong>Name:</strong> " + escapeHtml(name) + "</p>",
      organization
        ? "<p><strong>Golf course or company:</strong> " +
          escapeHtml(organization) +
          "</p>"
        : null,
      "<p><strong>Email:</strong> " + escapeHtml(email) + "</p>",
      referralSource
        ? "<p><strong>How did you hear about us?:</strong> " +
          escapeHtml(referralSource) +
          "</p>"
        : null,
      "<p><strong>Message:</strong></p>",
      "<p>" + escapeHtml(message).replace(/\n/g, "<br />") + "</p>",
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 },
    );
  }

  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      await db.insert(leads).values({
        name,
        organization: organization || null,
        email,
        referralSource: referralSource || null,
        message,
      });
    } catch (leadError) {
      console.error("Failed to save lead:", leadError);
    }
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
