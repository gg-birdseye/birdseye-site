import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isDocuSignConfigured } from "@/lib/docusign/config";
import { createContractSigningUrl } from "@/lib/docusign/envelopes";
import {
  getClientByIdWithCourses,
  getClientByTokenWithCourses,
  updateClientById,
} from "@/lib/onboarding/clients";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Onboarding is not configured." },
      { status: 503 },
    );
  }

  if (!isDocuSignConfigured()) {
    return NextResponse.json(
      { error: "DocuSign is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;
  const client = await getClientByTokenWithCourses(token);
  if (!client) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (client.onboardingStatus === "active") {
    return NextResponse.json({ error: "Onboarding already complete." }, { status: 400 });
  }

  if (client.onboardingStatus === "invited") {
    return NextResponse.json(
      { error: "Complete intake before signing the agreement." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const returnUrl = `${origin}/onboarding/${token}?docusign=complete`;

  try {
    const { envelopeId, signingUrl } = await createContractSigningUrl(client, returnUrl);

    await updateClientById(client.id, {
      docusignEnvelopeId: envelopeId,
      docusignContractStatus: "sent",
    });

    return NextResponse.json({
      url: signingUrl,
      envelopeId,
      client: await getClientByIdWithCourses(client.id),
    });
  } catch (error) {
    console.error("DocuSign envelope creation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start DocuSign signing.",
      },
      { status: 502 },
    );
  }
}
