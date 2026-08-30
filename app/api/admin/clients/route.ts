import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import {
  createClientInvite,
  listClientsWithCourses,
} from "@/lib/onboarding/clients";
import { sendInviteEmail } from "@/lib/email/onboarding";
import { parseTradeOutFields } from "@/lib/onboarding/trade-out-merge";
import type { PaymentMethod, PlanInterval } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  try {
    const clients = await listClientsWithCourses();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Failed to list clients:", error);

    const cause =
      error instanceof Error &&
      "cause" in error &&
      error.cause instanceof Error
        ? error.cause.message
        : null;

    let message =
      error instanceof Error ? error.message : "Failed to connect to the database.";

    if (cause?.includes("ENOTFOUND")) {
      message =
        "Cannot reach Supabase. Use the Transaction pooler connection string (port 6543) from Supabase → Connect.";
    } else if (
      cause?.includes("EMAXCONNSESSION") ||
      message.includes("EMAXCONNSESSION")
    ) {
      message =
        "Database connection pool is full. Use the Transaction pooler (port 6543), restart the dev server, and try again.";
    } else if (
      cause?.includes("statement timeout") ||
      message.includes("statement timeout")
    ) {
      message =
        "Database query timed out. Try again — if it keeps failing, restart the dev server.";
    } else if (cause) {
      message = cause;
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CourseInput = {
  courseName?: string;
  holeCount?: number;
  customHoleCount?: number | null;
  customUnitPriceCents?: number | null;
  courseAddressLine1?: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  courseZip?: string | null;
};

type CreateInviteBody = {
  organizationName?: string;
  courseName?: string;
  contactEmail?: string;
  billingApEmail?: string;
  contactName?: string;
  courses?: CourseInput[];
  holeCount?: number | null;
  customHoleCount?: number | null;
  plan?: PlanInterval;
  paymentMethod?: PaymentMethod;
  customPriceCents?: number | null;
  customRenewalPriceCents?: number | null;
  adminNotes?: string;
  sendEmail?: boolean;
  travelMobilizationFeeRequired?: boolean;
  tradeOutElected?: boolean | string;
  tradeOutCreditAmount?: string;
  tradeOutCompRoundsPerYear?: string | number;
  tradeOutMaxPlayersPerRound?: string | number;
  tradeOutBookingRestrictions?: string;
  tradeOutBookingContact?: string;
  productionWindow?: string;
  teeTime1?: string;
  teeTime2?: string;
  teeTime3?: string;
  onSiteCourseRepresentative?: string;
  specialAccessInstructions?: string;
  projectSpecificNotes?: string;
};

export async function POST(request: Request) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  let body: CreateInviteBody;
  try {
    body = (await request.json()) as CreateInviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const contactEmail = body.contactEmail?.trim() ?? "";
  const courseLines = (body.courses ?? [])
    .map((course) => ({
      courseName: course.courseName?.trim() ?? "",
      holeCount: course.holeCount ?? 18,
      customHoleCount: course.customHoleCount ?? null,
      customUnitPriceCents: course.customUnitPriceCents ?? null,
      courseAddressLine1: course.courseAddressLine1?.trim() || null,
      courseCity: course.courseCity?.trim() || null,
      courseState: course.courseState?.trim() || null,
      courseZip: course.courseZip?.trim() || null,
    }))
    .filter((course) => course.courseName);

  const legacyCourseName = body.courseName?.trim() ?? "";
  if (courseLines.length === 0 && !legacyCourseName) {
    return NextResponse.json(
      { error: "Add at least one course or provide a course name." },
      { status: 400 },
    );
  }

  if (!contactEmail) {
    return NextResponse.json(
      { error: "Contact email is required." },
      { status: 400 },
    );
  }

  const billingApEmail = body.billingApEmail?.trim() ?? "";
  if (billingApEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingApEmail)) {
    return NextResponse.json(
      { error: "Billing / AP email must be a valid email address." },
      { status: 400 },
    );
  }

  let customPriceCents: number | null = null;
  if (body.customPriceCents != null) {
    if (!Number.isFinite(body.customPriceCents) || body.customPriceCents < 0) {
      return NextResponse.json(
        { error: "Custom Year 1 price must be zero or a positive number." },
        { status: 400 },
      );
    }
    customPriceCents = Math.round(body.customPriceCents);
  }

  let customRenewalPriceCents: number | null = null;
  if (body.customRenewalPriceCents != null) {
    if (
      !Number.isFinite(body.customRenewalPriceCents) ||
      body.customRenewalPriceCents < 0
    ) {
      return NextResponse.json(
        { error: "Custom Year 2+ price must be zero or a positive number." },
        { status: 400 },
      );
    }
    customRenewalPriceCents = Math.round(body.customRenewalPriceCents);
  }

  const tradeOut = parseTradeOutFields(body);
  if ("error" in tradeOut) {
    return NextResponse.json({ error: tradeOut.error }, { status: 400 });
  }

  try {
    const client = await createClientInvite({
      organizationName: body.organizationName,
      courseName:
        legacyCourseName ||
        body.organizationName?.trim() ||
        courseLines[0]?.courseName ||
        "New account",
      contactEmail,
      billingApEmail: billingApEmail || undefined,
      contactName: body.contactName,
      courses: courseLines,
      holeCount: body.holeCount ?? 18,
      customHoleCount: body.customHoleCount ?? null,
      plan: body.plan ?? "annual",
      paymentMethod: body.paymentMethod ?? "stripe",
      customPriceCents,
      customRenewalPriceCents,
      adminNotes: body.adminNotes,
      travelMobilizationFeeRequired: body.travelMobilizationFeeRequired ?? false,
      ...tradeOut,
      productionWindow: body.productionWindow?.trim() || null,
      teeTime1: body.teeTime1?.trim() || null,
      teeTime2: body.teeTime2?.trim() || null,
      teeTime3: body.teeTime3?.trim() || null,
      onSiteCourseRepresentative: body.onSiteCourseRepresentative?.trim() || null,
      specialAccessInstructions: body.specialAccessInstructions?.trim() || null,
      projectSpecificNotes: body.projectSpecificNotes?.trim() || null,
    });

    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}/onboarding/${client.token}`;

    if (body.sendEmail) {
      await sendInviteEmail(client, inviteUrl);
    }

    return NextResponse.json({ client, inviteUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create invite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
