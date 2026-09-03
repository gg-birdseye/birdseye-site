import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isGa4Configured } from "@/lib/ga4/client";
import { lastCalendarMonth } from "@/lib/ga4/dates";
import { isEmailConfigured } from "@/lib/email/send";
import {
  buildAndSendCourseReport,
  listMonthlyReportJobs,
} from "@/lib/ga4/send-course-reports";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      {
        error: process.env.CRON_SECRET?.trim()
          ? "Unauthorized"
          : "CRON_SECRET is not configured.",
      },
      { status: process.env.CRON_SECRET?.trim() ? 401 : 503 },
    );
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
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const range = lastCalendarMonth();
  const jobs = await listMonthlyReportJobs();
  const sent: { slug: string; to: string[] }[] = [];
  const skipped: { slug?: string; reason: string }[] = [];
  const errors: { slug: string; reason: string }[] = [];

  if (jobs.length === 0) {
    skipped.push({ reason: "No active clients with a course slug and email." });
  }

  for (const job of jobs) {
    if (dryRun) {
      sent.push({ slug: job.slug, to: job.emails });
      continue;
    }
    try {
      const result = await buildAndSendCourseReport({
        slug: job.slug,
        range,
        to: job.emails,
      });
      sent.push({ slug: job.slug, to: result.to });
    } catch (error) {
      errors.push({
        slug: job.slug,
        reason: error instanceof Error ? error.message : "Send failed.",
      });
    }
  }

  return NextResponse.json({
    dryRun,
    range,
    sent,
    skipped,
    errors,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
