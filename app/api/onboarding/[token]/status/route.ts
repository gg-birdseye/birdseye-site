import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientByTokenWithCourses } from "@/lib/onboarding/clients";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
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

  return NextResponse.json({
    client,
    isActive: client.onboardingStatus === "active" && client.billingStatus === "active",
  });
}
