import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientById } from "@/lib/onboarding/clients";
import { ensureClientSanityCourse } from "@/lib/onboarding/activation";

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

  if (client.sanityCourseId) {
    return NextResponse.json({ client, sanityCourseId: client.sanityCourseId });
  }

  try {
    const result = await ensureClientSanityCourse(client);
    return NextResponse.json({
      client: result.client,
      sanityCourseId: result.sanityCourseId,
    });
  } catch (error) {
    console.error("Failed to create Sanity course:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create Sanity course.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
