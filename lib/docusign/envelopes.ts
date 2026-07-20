import { buildContractMergeFields } from "@/lib/onboarding/contract-merge-fields";
import { resolveContractDocxPath } from "@/lib/onboarding/contract-docx-path";
import { filledContractDocxBase64 } from "@/lib/onboarding/fill-contract-docx";
import {
  buildClientDateSignedTabs,
  buildClientSignHereTabs,
} from "@/lib/docusign/contract-sign-tabs";
import { getDocuSignConfig } from "@/lib/docusign/config";
import { docusignRequest } from "@/lib/docusign/auth";
import type { ClientWithCourses } from "@/lib/db/schema";

type EnvelopeResponse = {
  envelopeId?: string;
  status?: string;
};

type RecipientViewResponse = {
  url?: string;
};

type RecipientTabsResponse = {
  textTabs?: Array<{
    tabId?: string;
    tabLabel?: string;
    value?: string;
  }>;
};

type RecipientsResponse = {
  signers?: Array<{
    recipientId?: string;
    roleName?: string;
    clientUserId?: string;
    email?: string;
  }>;
};

async function applyMergeFieldsToRecipient(
  accountId: string,
  envelopeId: string,
  recipientId: string,
  mergeFields: Record<string, string>,
) {
  const tabs = await docusignRequest<RecipientTabsResponse>(
    `/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients/${recipientId}/tabs`,
  );

  const updates = (tabs.textTabs ?? [])
    .filter(
      (tab) => tab.tabId && tab.tabLabel && mergeFields[tab.tabLabel] !== undefined,
    )
    .map((tab) => ({
      tabId: tab.tabId!,
      value: mergeFields[tab.tabLabel!] ?? "",
      locked: "true",
    }));

  if (updates.length === 0) {
    throw new Error(
      "DocuSign template has no matching text tabs to pre-fill. Check Data Labels on the Client role.",
    );
  }

  await docusignRequest(
    `/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients/${recipientId}/tabs`,
    {
      method: "PUT",
      body: JSON.stringify({ textTabs: updates }),
    },
  );
}

async function createRecipientSigningUrl(
  config: NonNullable<ReturnType<typeof getDocuSignConfig>>,
  envelopeId: string,
  client: ClientWithCourses,
  signerName: string,
  recipientId: string,
  returnUrl: string,
) {
  const view = await docusignRequest<RecipientViewResponse>(
    `/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      body: JSON.stringify({
        returnUrl,
        authenticationMethod: "none",
        email: client.contactEmail,
        userName: signerName,
        clientUserId: client.id,
        recipientId,
      }),
    },
  );

  if (!view.url) {
    throw new Error("DocuSign did not return a signing URL.");
  }

  return view.url;
}

async function createGeneratedDocumentEnvelope(
  config: NonNullable<ReturnType<typeof getDocuSignConfig>>,
  client: ClientWithCourses,
  mergeFields: Record<string, string>,
  signerName: string,
) {
  if (!config.contractDocxDir && !config.contractDocxPath) {
    throw new Error(
      "DOCUSIGN_CONTRACT_DOCX_DIR or DOCUSIGN_CONTRACT_DOCX_PATH is not configured.",
    );
  }

  const templatePath = resolveContractDocxPath(client, {
    contractDocxDir: config.contractDocxDir,
    legacyContractDocxPath: config.contractDocxPath,
  });

  const documentBase64 = filledContractDocxBase64(
    templatePath,
    mergeFields,
  );

  const envelope = await docusignRequest<EnvelopeResponse>(
    `/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: "POST",
      body: JSON.stringify({
        status: "sent",
        emailSubject: `Birdseye service agreement — ${mergeFields.OrganizationName}`,
        customFields: {
          textCustomFields: [
            { name: "clientId", value: client.id, show: "false" },
            { name: "inviteToken", value: client.token, show: "false" },
          ],
        },
        documents: [
          {
            documentId: "1",
            name: "Birdseye Master Service Agreement",
            fileExtension: "docx",
            documentBase64,
          },
        ],
        recipients: {
          signers: [
            {
              recipientId: "1",
              routingOrder: "1",
              roleName: config.clientRoleName,
              email: client.contactEmail,
              name: signerName,
              clientUserId: client.id,
              tabs: {
                signHereTabs: buildClientSignHereTabs(),
                dateSignedTabs: buildClientDateSignedTabs(),
              },
            },
          ],
        },
      }),
    },
  );

  if (!envelope.envelopeId) {
    throw new Error("DocuSign did not return an envelope ID.");
  }

  return envelope.envelopeId;
}

async function createTemplateEnvelope(
  config: NonNullable<ReturnType<typeof getDocuSignConfig>>,
  client: ClientWithCourses,
  mergeFields: Record<string, string>,
  signerName: string,
) {
  const envelope = await docusignRequest<EnvelopeResponse>(
    `/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: "POST",
      body: JSON.stringify({
        templateId: config.templateId,
        status: "sent",
        emailSubject: `Birdseye service agreement — ${mergeFields.OrganizationName}`,
        customFields: {
          textCustomFields: [
            { name: "clientId", value: client.id, show: "false" },
            { name: "inviteToken", value: client.token, show: "false" },
          ],
        },
        templateRoles: [
          {
            roleName: config.clientRoleName,
            email: client.contactEmail,
            name: signerName,
            clientUserId: client.id,
          },
        ],
      }),
    },
  );

  if (!envelope.envelopeId) {
    throw new Error("DocuSign did not return an envelope ID.");
  }

  const recipients = await docusignRequest<RecipientsResponse>(
    `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients`,
  );

  const signer = recipients.signers?.find(
    (row) => row.roleName === config.clientRoleName,
  );
  if (!signer?.recipientId) {
    throw new Error(
      `DocuSign template is missing the "${config.clientRoleName}" signer role.`,
    );
  }

  await applyMergeFieldsToRecipient(
    config.accountId,
    envelope.envelopeId,
    signer.recipientId,
    mergeFields,
  );

  return { envelopeId: envelope.envelopeId, recipientId: signer.recipientId };
}

export async function createContractSigningUrl(
  client: ClientWithCourses,
  returnUrl: string,
) {
  const config = getDocuSignConfig();
  if (!config) {
    throw new Error("DocuSign is not configured.");
  }

  if (!client.contactEmail) {
    throw new Error("Client email is required before sending DocuSign.");
  }

  const mergeFields = buildContractMergeFields(client);
  const signerName = client.contactName?.trim() || client.contactEmail;

  if (config.envelopeMode === "generated") {
    const envelopeId = await createGeneratedDocumentEnvelope(
      config,
      client,
      mergeFields,
      signerName,
    );
    const signingUrl = await createRecipientSigningUrl(
      config,
      envelopeId,
      client,
      signerName,
      "1",
      returnUrl,
    );

    return { envelopeId, signingUrl, mergeFields };
  }

  const { envelopeId, recipientId } = await createTemplateEnvelope(
    config,
    client,
    mergeFields,
    signerName,
  );
  const signingUrl = await createRecipientSigningUrl(
    config,
    envelopeId,
    client,
    signerName,
    recipientId,
    returnUrl,
  );

  return { envelopeId, signingUrl, mergeFields };
}

export async function getEnvelopeStatus(envelopeId: string) {
  const config = getDocuSignConfig();
  if (!config) {
    throw new Error("DocuSign is not configured.");
  }

  return docusignRequest<{ status?: string }>(
    `/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`,
  );
}

export function isEnvelopeCompleted(status: string | undefined) {
  return status === "completed";
}
