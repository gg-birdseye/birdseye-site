import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientByToken, updateClientById } from "@/lib/onboarding/clients";
import { canAccessPaymentStep } from "@/lib/onboarding/client-utils";
import {
  createCheckoutSessionForClient,
  isStripeConfigured,
} from "@/lib/stripe";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
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

  if (client.onboardingStatus === "active") {
    return NextResponse.json({ error: "Already active." }, { status: 400 });
  }

  if (client.paymentMethod === "manual") {
    return NextResponse.json(
      { error: "Manual payment — awaiting confirmation." },
      { status: 400 },
    );
  }

  if (!canAccessPaymentStep(client)) {
    return NextResponse.json(
      { error: "Complete the agreement before payment." },
      { status: 400 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const session = await createCheckoutSessionForClient(client, token, origin);

  await updateClientById(client.id, {
    stripeCheckoutSessionId: session.id,
    onboardingStatus: "payment_pending",
  });

  return NextResponse.json({ url: session.url });
}
