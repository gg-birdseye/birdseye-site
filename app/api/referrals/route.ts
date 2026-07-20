import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { sendReferralReceivedEmails } from "@/lib/email/referrals";
import { isCompleteUsPhone, normalizeUsPhoneDigits } from "@/lib/format-phone";
import { isRecaptchaConfigured, verifyRecaptchaToken } from "@/lib/recaptcha";
import {
  MAX_ACTIVE_REFERRALS_PER_REFERRER,
  courseKeyFor,
  isGiftCardChoice,
  isObviouslyFakePhone,
  rewardForHoleCount,
} from "@/lib/referrals/domain";
import {
  countActiveReferralsForEmail,
  createReferral,
  findActiveClaimForCourse,
  isExistingCustomerCourse,
  releaseExpiredClaims,
} from "@/lib/referrals/store";

type ReferralPayload = {
  courseName?: string;
  courseCity?: string;
  courseState?: string;
  holeCount?: number;
  referrerName?: string;
  referrerEmail?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  howKnow?: string;
  giftCardChoice?: string;
  website?: string;
  captchaToken?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Referrals are not configured." },
      { status: 503 },
    );
  }

  let body: ReferralPayload;
  try {
    body = (await request.json()) as ReferralPayload;
  } catch {
    return badRequest("Invalid request body.");
  }

  // Honeypot — silently accept bot submissions.
  if (body.website?.trim()) {
    return NextResponse.json({ ok: true, status: "pending_verify" });
  }

  const courseName = body.courseName?.trim() ?? "";
  const courseCity = body.courseCity?.trim() ?? "";
  const courseState = body.courseState?.trim().toUpperCase() ?? "";
  const holeCount = body.holeCount;
  const referrerName = body.referrerName?.trim() ?? "";
  const referrerEmail = body.referrerEmail?.trim().toLowerCase() ?? "";
  const contactName = body.contactName?.trim() ?? "";
  const contactRole = body.contactRole?.trim() ?? "";
  const contactPhone = normalizeUsPhoneDigits(body.contactPhone);
  const howKnow = body.howKnow?.trim() ?? "";
  const giftCardChoice = body.giftCardChoice?.trim() ?? "";

  if (!courseName || !courseCity || !courseState) {
    return badRequest("Course name, city, and state are required.");
  }
  if (holeCount !== 9 && holeCount !== 18 && holeCount !== 27) {
    return badRequest("Select whether the course is 9, 18, or 27 holes.");
  }
  if (!referrerName || !referrerEmail) {
    return badRequest("Your name and email are required.");
  }
  if (!isValidEmail(referrerEmail)) {
    return badRequest("Please enter a valid email address.");
  }
  if (!contactName || !contactRole) {
    return badRequest("The club contact's name and role are required.");
  }
  if (!isCompleteUsPhone(body.contactPhone) || isObviouslyFakePhone(contactPhone)) {
    return badRequest(
      "Please provide a valid phone number for the club contact.",
    );
  }
  if (!isGiftCardChoice(giftCardChoice)) {
    return badRequest("Please choose a gift card option.");
  }
  if ([courseName, courseCity, referrerName, contactName].some((v) => v.length > 200)) {
    return badRequest("One of the fields is too long (max 200 characters).");
  }
  if (howKnow.length > 1000) {
    return badRequest("How you know the contact is too long (max 1000 characters).");
  }

  const rewardAmountDollars = rewardForHoleCount(holeCount);
  if (rewardAmountDollars == null) {
    return badRequest("Unsupported course size.");
  }

  if (isRecaptchaConfigured()) {
    const captchaToken = body.captchaToken?.trim() ?? "";
    if (!captchaToken) {
      return badRequest("Captcha verification is required.");
    }
    const captchaValid = await verifyRecaptchaToken(captchaToken);
    if (!captchaValid) {
      return badRequest("Captcha verification failed. Please try again.");
    }
  }

  try {
    // Stale, never-verified claims stop holding courses before dedupe checks.
    await releaseExpiredClaims();

    if (await isExistingCustomerCourse(courseName, courseCity, courseState)) {
      return NextResponse.json(
        {
          error:
            "Great minds think alike — this course is already on Birdseye or in our pipeline, so it isn't eligible for a referral bonus.",
          code: "already_customer",
        },
        { status: 409 },
      );
    }

    const courseKey = courseKeyFor(courseName, courseCity, courseState);
    const existingClaim = await findActiveClaimForCourse(courseKey);
    if (existingClaim) {
      const message =
        existingClaim.status === "won"
          ? "This course has already joined Birdseye through a referral."
          : "Someone already referred this course and it's currently under review. If that referral can't be verified, the course will reopen for referrals.";
      return NextResponse.json(
        { error: message, code: "already_claimed" },
        { status: 409 },
      );
    }

    const activeCount = await countActiveReferralsForEmail(referrerEmail);
    if (activeCount >= MAX_ACTIVE_REFERRALS_PER_REFERRER) {
      return NextResponse.json(
        {
          error: `You already have ${MAX_ACTIVE_REFERRALS_PER_REFERRER} active referrals. Once one is resolved, you can submit another.`,
          code: "referrer_cap",
        },
        { status: 429 },
      );
    }

    const referral = await createReferral({
      courseKey,
      courseName,
      courseCity,
      courseState,
      holeCount,
      referrerName,
      referrerEmail,
      contactName,
      contactRole,
      contactPhone,
      howKnow: howKnow || null,
      giftCardChoice,
      rewardAmountDollars,
    });

    await sendReferralReceivedEmails(referral);

    return NextResponse.json({ ok: true, status: referral.status });
  } catch (error) {
    // Unique index race: someone claimed the course between check and insert.
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    const message = `${error instanceof Error ? error.message : ""} ${cause}`;
    if (message.includes("referrals_active_course_key_idx")) {
      return NextResponse.json(
        {
          error:
            "Someone already referred this course and it's currently under review.",
          code: "already_claimed",
        },
        { status: 409 },
      );
    }

    console.error("Failed to create referral:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
