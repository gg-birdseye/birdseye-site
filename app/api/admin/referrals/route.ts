import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import { listReferrals, releaseExpiredClaims } from "@/lib/referrals/store";

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
    await releaseExpiredClaims();
    const referrals = await listReferrals();
    return NextResponse.json({ referrals });
  } catch (error) {
    console.error("Failed to list referrals:", error);
    return NextResponse.json(
      { error: "Failed to load referrals." },
      { status: 500 },
    );
  }
}
