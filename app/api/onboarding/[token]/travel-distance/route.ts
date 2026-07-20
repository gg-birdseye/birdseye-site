import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientByTokenWithCourses } from "@/lib/onboarding/clients";
import { evaluateTravelFeeFromCourses } from "@/lib/onboarding/evaluate-travel-fee";

type Params = { params: Promise<{ token: string }> };

type CourseLocationBody = {
  courseAddressLine1?: string;
  courseCity?: string;
  courseState?: string;
  courseZip?: string;
};

type Body = {
  courses?: CourseLocationBody[];
};

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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const submittedCourses = body.courses ?? [];
  const courses = (client.courses ?? []).map((course, index) => {
    const submitted = submittedCourses[index];
    return {
      courseName: course.courseName,
      addressLine1: submitted?.courseAddressLine1 ?? course.courseAddressLine1,
      city: submitted?.courseCity ?? course.courseCity,
      state: submitted?.courseState ?? course.courseState,
      zip: submitted?.courseZip ?? course.courseZip,
    };
  });

  try {
    const evaluation = await evaluateTravelFeeFromCourses(courses);
    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error("Travel distance evaluation failed:", error);
    return NextResponse.json(
      { error: "Unable to estimate travel distance right now." },
      { status: 502 },
    );
  }
}
