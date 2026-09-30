import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import { scheduleAnnualBillingAfterDelivery } from "@/lib/onboarding/annual-billing";
import { scheduleMonthlyBillingAfterDelivery } from "@/lib/onboarding/monthly-billing";
import { getClientById } from "@/lib/onboarding/clients";
import { resolvePlan } from "@/lib/onboarding/client-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
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

  const { id } = await params;
  const client = await getClientById(id);
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  if (client.onboardingStatus !== "active") {
    return NextResponse.json(
      { error: "Mark the client active (first payment received) before recording delivery." },
      { status: 400 },
    );
  }

  const plan = resolvePlan(client);

  if (plan === "monthly") {
    try {
      const deliveredAt = client.deliveredAt ?? new Date();
      const result = await scheduleMonthlyBillingAfterDelivery({
        ...client,
        deliveredAt,
      });

      return NextResponse.json({
        client: result.client,
        alreadyScheduled: result.alreadyScheduled,
        stripeScheduled: result.stripeScheduled,
        billingStartsAt: result.billingStartsAt,
      });
    } catch (error) {
      console.error("Failed to resume monthly billing after delivery:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to schedule monthly billing after delivery in Stripe.",
        },
        { status: 502 },
      );
    }
  }

  if (plan !== "annual") {
    return NextResponse.json(
      { error: "Unsupported plan for mark delivered." },
      { status: 400 },
    );
  }

  if (client.deliveredAt && client.stripeSubscriptionScheduleId) {
    return NextResponse.json({
      client,
      alreadyScheduled: true,
      message: "Delivery and annual Stripe schedule are already recorded for this client.",
    });
  }

  try {
    const deliveredAt = client.deliveredAt ?? new Date();
    const result = await scheduleAnnualBillingAfterDelivery({
      ...client,
      deliveredAt,
    });

    return NextResponse.json({
      client: result.client,
      alreadyScheduled: result.alreadyScheduled,
      stripeScheduled: "stripeScheduled" in result ? result.stripeScheduled : true,
      billingStartsAt: result.billingStartsAt,
    });
  } catch (error) {
    console.error("Failed to schedule annual billing after delivery:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to schedule remaining annual payments in Stripe.",
      },
      { status: 502 },
    );
  }
}
