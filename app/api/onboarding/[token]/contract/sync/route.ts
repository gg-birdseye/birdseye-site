import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isDocuSignConfigured } from "@/lib/docusign/config";
import {
  getEnvelopeStatus,
  isEnvelopeCompleted,
} from "@/lib/docusign/envelopes";
import {
  getClientByIdWithCourses,
  getClientByTokenWithCourses,
  updateClientById,
} from "@/lib/onboarding/clients";
import { markClientContractSigned } from "@/lib/onboarding/mark-contract-signed";

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params) {
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

  if (!client.docusignEnvelopeId) {
    return NextResponse.json({ client });
  }

  try {
    const envelope = await getEnvelopeStatus(client.docusignEnvelopeId);
    const status = envelope.status ?? client.docusignContractStatus ?? "unknown";

    if (isEnvelopeCompleted(status)) {
      const updated = await markClientContractSigned(client, {
        envelopeId: client.docusignEnvelopeId,
        docusignStatus: "completed",
      });
      return NextResponse.json({ client: updated, completed: true });
    }

    await updateClientById(client.id, {
      docusignContractStatus: status,
    });

    return NextResponse.json({
      client: await getClientByIdWithCourses(client.id),
      completed: false,
      status,
    });
  } catch (error) {
    console.error("DocuSign sync failed:", error);
    return NextResponse.json(
      { error: "Unable to sync DocuSign status." },
      { status: 502 },
    );
  }
}
