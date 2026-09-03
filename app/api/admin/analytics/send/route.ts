import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isGa4Configured } from "@/lib/ga4/client";
import { isEmailConfigured } from "@/lib/email/send";
import {
  buildAndSendCourseReport,
  parseReportRange,
} from "@/lib/ga4/send-course-reports";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGa4Configured()) {
    return NextResponse.json(
      { error: "GA4 is not configured." },
      { status: 503 },
    );
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured." },
      { status: 503 },
    );
  }

  let body: {
    slug?: string;
    startDate?: string;
    endDate?: string;
    preset?: string;
    to?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const slug = body.slug?.trim().replace(/^\/+/, "") ?? "";
  if (!slug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }

  const range = parseReportRange({
    startDate: body.startDate,
    endDate: body.endDate,
    preset: body.preset,
  });
  const to = body.to
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  try {
    const result = await buildAndSendCourseReport({ slug, range, to });
    return NextResponse.json({
      ok: true,
      to: result.to,
      range: {
        startDate: result.report.startDate,
        endDate: result.report.endDate,
        label: result.report.rangeLabel,
      },
    });
  } catch (error) {
    console.error("Course analytics send failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send report.",
      },
      { status: 500 },
    );
  }
}
