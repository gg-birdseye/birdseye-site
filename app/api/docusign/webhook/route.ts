import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getDocuSignConfig } from "@/lib/docusign/config";
import { getClientById, updateClientById } from "@/lib/onboarding/clients";
import { markClientContractSigned } from "@/lib/onboarding/mark-contract-signed";

type ConnectPayload = {
  event?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      customFields?: {
        textCustomFields?: Array<{ name?: string; value?: string }>;
      };
    };
  };
};

function verifyConnectSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const digest = createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const config = getDocuSignConfig();
  const rawBody = await request.text();

  if (config?.webhookHmacKey) {
    const signature = request.headers.get("x-docusign-signature-1");
    if (!verifyConnectSignature(rawBody, signature, config.webhookHmacKey)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  }

  let payload: ConnectPayload;
  try {
    payload = JSON.parse(rawBody) as ConnectPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const envelopeId = payload.data?.envelopeId;
  const status = payload.data?.envelopeSummary?.status;
  const customFields = payload.data?.envelopeSummary?.customFields?.textCustomFields ?? [];
  const clientId = customFields.find((field) => field.name === "clientId")?.value;

  if (!envelopeId || !clientId) {
    return NextResponse.json({ received: true });
  }

  const client = await getClientById(clientId);
  if (!client) {
    return NextResponse.json({ received: true });
  }

  if (status === "completed") {
    await markClientContractSigned(client, {
      envelopeId,
      docusignStatus: "completed",
    });
  } else if (status) {
    await updateClientById(client.id, {
      docusignEnvelopeId: envelopeId,
      docusignContractStatus: status,
    });
  }

  return NextResponse.json({ received: true });
}
