import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isCompleteUsPhone } from "@/lib/format-phone";
import {
  getClientByTokenWithCourses,
  getClientByIdWithCourses,
  updateClientById,
} from "@/lib/onboarding/clients";
import { updateClientCourseById } from "@/lib/onboarding/client-courses";
import { evaluateTravelFeeFromCourses } from "@/lib/onboarding/evaluate-travel-fee";

type Params = { params: Promise<{ token: string }> };

type IntakeBody = {
  courseName?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  referralSource?: string;
  courseAddressLine1?: string;
  courseCity?: string;
  courseState?: string;
  courseZip?: string;
  courses?: Array<{
    courseAddressLine1?: string;
    courseCity?: string;
    courseState?: string;
    courseZip?: string;
  }>;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resolveSubmittedCourseLocation(
  body: IntakeBody,
  submittedCourses: IntakeBody["courses"],
  index: number,
) {
  const submitted = submittedCourses?.[index];
  return {
    courseAddressLine1:
      submitted?.courseAddressLine1?.trim() ||
      (index === 0 ? body.courseAddressLine1?.trim() : "") ||
      "",
    courseCity:
      submitted?.courseCity?.trim() ||
      (index === 0 ? body.courseCity?.trim() : "") ||
      "",
    courseState:
      submitted?.courseState?.trim() ||
      (index === 0 ? body.courseState?.trim() : "") ||
      "",
    courseZip:
      submitted?.courseZip?.trim() ||
      (index === 0 ? body.courseZip?.trim() : "") ||
      "",
  };
}

export async function POST(request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Onboarding is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;
  const client = await getClientByTokenWithCourses(token);
  if (!client) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const isMultiCourse = (client.courses?.length ?? 0) > 1;

  if (client.onboardingStatus === "active") {
    return NextResponse.json({ error: "Onboarding already complete." }, { status: 400 });
  }

  let body: IntakeBody;
  try {
    body = (await request.json()) as IntakeBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const courseName = isMultiCourse
    ? client.courseName?.trim() || client.organizationName?.trim() || ""
    : body.courseName?.trim() ?? "";
  const contactName = body.contactName?.trim() ?? "";
  const contactTitle = body.contactTitle?.trim() ?? "";
  const contactEmail = body.contactEmail?.trim().toLowerCase() ?? "";
  const contactPhone = body.contactPhone?.trim() ?? "";
  const billingAddressLine1 = body.billingAddressLine1?.trim() ?? "";
  const billingCity = body.billingCity?.trim() ?? "";
  const billingState = body.billingState?.trim() ?? "";
  const billingZip = body.billingZip?.trim() ?? "";

  if ((!isMultiCourse && !courseName) || !contactName || !contactTitle || !contactEmail) {
    return NextResponse.json(
      {
        error: isMultiCourse
          ? "Contact name, title, and email are required."
          : "Course name, contact name, title, and email are required.",
      },
      { status: 400 },
    );
  }

  if (!isCompleteUsPhone(contactPhone)) {
    return NextResponse.json({ error: "A valid phone number is required." }, { status: 400 });
  }

  if (!billingAddressLine1 || !billingCity || !billingState || !billingZip) {
    return NextResponse.json(
      { error: "Billing address, city, state, and ZIP are required." },
      { status: 400 },
    );
  }

  const submittedCourses = body.courses ?? [];
  const existingCourses = client.courses ?? [];

  for (const [index, course] of existingCourses.entries()) {
    const location = resolveSubmittedCourseLocation(body, submittedCourses, index);
    const courseLabel =
      existingCourses.length > 1
        ? ` for ${course.courseName?.trim() || `course ${index + 1}`}`
        : "";

    if (
      !location.courseAddressLine1 ||
      !location.courseCity ||
      !location.courseState ||
      !location.courseZip
    ) {
      return NextResponse.json(
        {
          error: `Course location address, city, state, and ZIP are required${courseLabel}.`,
        },
        { status: 400 },
      );
    }
  }

  if (!isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  try {
    for (const [index, course] of existingCourses.entries()) {
      const location = resolveSubmittedCourseLocation(body, submittedCourses, index);
      const courseAddressLine1 = location.courseAddressLine1 || null;
      const courseCity = location.courseCity || null;
      const courseState = location.courseState || null;
      const courseZip = location.courseZip || null;

      if (
        courseAddressLine1 !== course.courseAddressLine1 ||
        courseCity !== course.courseCity ||
        courseState !== course.courseState ||
        courseZip !== course.courseZip
      ) {
        await updateClientCourseById(course.id, {
          courseAddressLine1,
          courseCity,
          courseState,
          courseZip,
        });
      }
    }

    const refreshedClient = (await getClientByTokenWithCourses(token)) ?? client;
    const travelEvaluation = await evaluateTravelFeeFromCourses(
      (refreshedClient.courses ?? []).map((course) => ({
        courseName: course.courseName,
        addressLine1: course.courseAddressLine1,
        city: course.courseCity,
        state: course.courseState,
        zip: course.courseZip,
      })),
    );

    const updated = await updateClientById(client.id, {
      ...(isMultiCourse ? {} : { courseName }),
      contactName,
      contactTitle,
      contactEmail,
      contactPhone,
      billingAddressLine1,
      billingAddressLine2: body.billingAddressLine2?.trim() || null,
      billingCity,
      billingState,
      billingZip,
      referralSource: body.referralSource?.trim() || null,
      onboardingStatus: "intake_complete",
      intakeCompletedAt: new Date(),
      travelDistanceMiles: travelEvaluation.distanceMiles,
    });

    return NextResponse.json({
      client: (await getClientByIdWithCourses(updated.id)) ?? updated,
    });
  } catch (error) {
    console.error("Intake save failed:", error);
    return NextResponse.json(
      { error: "Unable to save your information. Please try again." },
      { status: 500 },
    );
  }
}
