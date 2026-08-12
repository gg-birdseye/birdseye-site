import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { completeCheckoutIfPaid } from "@/lib/onboarding/complete-checkout";
import {
  getClientByIdWithCourses,
  getClientByToken,
} from "@/lib/onboarding/clients";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Onboarding is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;
  const client = await getClientByToken(token);
  if (!client) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  try {
    const activated = await completeCheckoutIfPaid(client);
    return NextResponse.json({
      client: await getClientByIdWithCourses(activated.id),
    });
  } catch (error) {
    console.error("Checkout confirm failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to confirm Stripe payment.",
      },
      { status: 502 },
    );
  }
}
