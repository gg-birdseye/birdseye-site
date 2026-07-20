import {
  getClientByIdWithCourses,
  updateClientById,
} from "@/lib/onboarding/clients";
import type { Client } from "@/lib/db/schema";

export async function markClientContractSigned(
  client: Client,
  options?: {
    signerName?: string;
    envelopeId?: string;
    docusignStatus?: string;
  },
) {
  const nextStatus =
    client.paymentMethod === "manual" ? "payment_pending" : "contract_signed";

  const updated = await updateClientById(client.id, {
    contractSignerName: options?.signerName?.trim() || client.contactName || null,
    contractSignedAt: new Date(),
    onboardingStatus: nextStatus,
    docusignEnvelopeId: options?.envelopeId ?? client.docusignEnvelopeId,
    docusignContractStatus: options?.docusignStatus ?? "completed",
  });

  return (await getClientByIdWithCourses(client.id)) ?? updated;
}
