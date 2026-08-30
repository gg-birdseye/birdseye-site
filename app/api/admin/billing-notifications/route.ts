import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import { runBillingNotifications } from "@/lib/billing/run-billing-notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  let dryRun = true;
  try {
    const body = (await request.json()) as { dryRun?: boolean };
    if (body.dryRun === false) dryRun = false;
  } catch {
    dryRun = true;
  }

  try {
    const result = await runBillingNotifications({
      dryRun,
      sendAdminDigest: !dryRun,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin billing notifications run failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Run failed." },
      { status: 500 },
    );
  }
}
