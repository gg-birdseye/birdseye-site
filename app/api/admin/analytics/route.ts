import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isGa4Configured } from "@/lib/ga4/client";
import { fetchCourseAnalyticsReport } from "@/lib/ga4/course-report";
import { parseReportRange, resolveCourseReportRecipient } from "@/lib/ga4/send-course-reports";
import { buildCourseAnalyticsReportHtml } from "@/lib/email/course-analytics-report";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGa4Configured()) {
    return NextResponse.json(
      {
        error:
          "GA4 is not configured. Add GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, and GA4_PRIVATE_KEY.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim().replace(/^\/+/, "") ?? "";
  if (!slug) {
    return NextResponse.json({ error: "slug is required." }, { status: 400 });
  }

  const range = parseReportRange({
    startDate: url.searchParams.get("startDate"),
    endDate: url.searchParams.get("endDate"),
    preset: url.searchParams.get("preset"),
  });

  try {
    const recipient = await resolveCourseReportRecipient(slug);
    const report = await fetchCourseAnalyticsReport({
      slug,
      title: recipient.title,
      range,
    });
    return NextResponse.json({
      report,
      html: buildCourseAnalyticsReportHtml(report, recipient.contactName),
      recipient,
    });
  } catch (error) {
    console.error("Course analytics preview failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Google Analytics data.",
      },
      { status: 500 },
    );
  }
}
