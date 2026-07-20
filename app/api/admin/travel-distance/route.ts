import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { evaluateTravelFeeFromCourses } from "@/lib/onboarding/evaluate-travel-fee";

type CourseLocationBody = {
  courseName?: string;
  courseAddressLine1?: string;
  courseCity?: string;
  courseState?: string;
  courseZip?: string;
};

type Body = {
  courses?: CourseLocationBody[];
};

export async function POST(request: Request) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const courses = (body.courses ?? []).map((course) => ({
    courseName: course.courseName,
    addressLine1: course.courseAddressLine1,
    city: course.courseCity,
    state: course.courseState,
    zip: course.courseZip,
  }));

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
