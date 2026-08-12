import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import { completeCheckoutIfPaid } from "@/lib/onboarding/complete-checkout";
import {
  getClientById,
  getClientByIdWithCourses,
} from "@/lib/onboarding/clients";

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

  try {
    const activated = await completeCheckoutIfPaid(client);
    return NextResponse.json({
      client: await getClientByIdWithCourses(activated.id),
    });
  } catch (error) {
    console.error("Admin complete-checkout failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete Stripe activation.",
      },
      { status: 502 },
    );
  }
}
