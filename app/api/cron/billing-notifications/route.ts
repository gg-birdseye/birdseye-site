import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { runBillingNotifications } from "@/lib/billing/run-billing-notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
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

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  try {
    const result = await runBillingNotifications({ dryRun });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Billing notifications cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
