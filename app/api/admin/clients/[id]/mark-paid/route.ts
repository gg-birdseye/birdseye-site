import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientById } from "@/lib/onboarding/clients";
import { activateClient } from "@/lib/onboarding/activation";

type Params = { params: Promise<{ id: string }> };

type MarkPaidBody = {
  amountCents?: number;
  method?: "cash" | "check";
  reference?: string;
  notes?: string;
};

export async function POST(request: Request, { params }: Params) {
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

  let body: MarkPaidBody = {};
  try {
    body = (await request.json()) as MarkPaidBody;
  } catch {
    body = {};
  }

  const now = new Date();
  const { updateClientById } = await import("@/lib/onboarding/clients");

  await updateClientById(id, {
    paymentMethod: "manual",
    paymentStatus: "pending",
    onboardingStatus: "payment_pending",
    manualPaymentReceivedAt: now,
    manualPaymentAmountCents: body.amountCents ?? null,
    manualPaymentMethod: body.method ?? "check",
    manualPaymentReference: body.reference?.trim() || null,
    manualPaymentNotes: body.notes?.trim() || null,
  });

  const activated = await activateClient(id);
  return NextResponse.json({ client: activated });
}
