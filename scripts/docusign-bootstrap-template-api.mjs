/**
 * Create a clean DocuSign template entirely via API — no UI, no AceGen.
 *
 * 1. Downloads the PDF from your current template (visual document only).
 * 2. Extracts text tabs from Client role + document level (stacked dupes removed).
 * 3. Adds intentional repeat placements (same label, different locations).
 *
 * Usage: node scripts/docusign-bootstrap-template-api.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createApiClient,
  dedupeTextTabs,
  getAccessToken,
  getDocuSignConfig,
  loadEnvLocal,
  mergeRepeatPlacements,
  normalizeTabLabel,
  toApiSignHereTab,
  toApiTextTab,
} from "./docusign-shared.mjs";
import { REPEAT_FIELD_PLACEMENTS } from "./docusign-repeat-field-layout.mjs";

loadEnvLocal();
const config = getDocuSignConfig();
if (!config.templateId) throw new Error("DOCUSIGN_TEMPLATE_ID is required.");

const token = await getAccessToken(config);
const api = createApiClient(config, token);

console.log("Source template:", config.templateId);

const sourceTemplate = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}`,
);
const sourceDoc = sourceTemplate.documents?.[0];
if (!sourceDoc?.documentId) throw new Error("Source template has no document.");

const pdfBytes = await fetch(
  `${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/${sourceDoc.documentId}`,
  { headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" } },
).then((r) => {
  if (!r.ok) throw new Error(`PDF download failed (${r.status})`);
  return r.arrayBuffer();
});

const pdfBase64 = Buffer.from(pdfBytes).toString("base64");
console.log(`Downloaded PDF (${Math.round(pdfBytes.byteLength / 1024)} KB).`);

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
);
const client = (recipients.signers ?? []).find((s) => s.roleName === config.clientRoleName);
if (!client) {
  throw new Error(
    `Role "${config.clientRoleName}" not found. Roles: ${(recipients.signers ?? []).map((s) => s.roleName).join(", ")}`,
  );
}

const docTabs = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
);

const dedupedText = mergeRepeatPlacements(
  dedupeTextTabs([...(client.tabs?.textTabs ?? []), ...(docTabs.textTabs ?? [])]),
  REPEAT_FIELD_PLACEMENTS,
);
if (dedupedText.length === 0) {
  throw new Error("No text tabs found on source template — cannot bootstrap.");
}

console.log(`Text tabs for new template: ${dedupedText.length} (${REPEAT_FIELD_PLACEMENTS.length} repeat placements in layout).`);

const signHereSources = [
  ...(client.tabs?.signHereTabs ?? []),
  ...(docTabs.signHereTabs ?? []),
];

const signHereTabs = signHereSources
  .filter((tab) => tab.pageNumber && tab.xPosition && tab.yPosition)
  .sort((a, b) => Number(a.pageNumber) - Number(b.pageNumber))
  .slice(0, 2)
  .map(toApiSignHereTab);

if (signHereTabs.length < 2) {
  console.warn("Warning: fewer than 2 Sign Here positions found — add manually if needed.");
}

const templateName = `Birdseye MSA API ${new Date().toISOString().slice(0, 10)}`;
const body = {
  name: templateName,
  description: "API-created template — recipient tabs only, no Agreement Prep",
  shared: "false",
  emailSubject: "Birdseye service agreement",
  documents: [
    {
      documentId: "1",
      name: "Birdseye MSA",
      fileExtension: "pdf",
      documentBase64: pdfBase64,
      transformPdfFields: "false",
    },
  ],
  recipients: {
    signers: [
      {
        roleName: config.clientRoleName,
        recipientId: "1",
        routingOrder: "1",
        tabs: {
          textTabs: dedupedText.map((tab) => {
            const apiTab = toApiTextTab(tab);
            if (apiTab.tabLabel === "ScheduleA_Courses") {
              apiTab.width = "468";
              apiTab.height = "80";
            }
            return apiTab;
          }),
          ...(signHereTabs.length ? { signHereTabs } : {}),
        },
      },
    ],
  },
};

const created = await api(`/v2.1/accounts/${config.accountId}/templates`, {
  method: "POST",
  body: JSON.stringify(body),
});

if (!created.templateId) throw new Error("DocuSign did not return a template ID.");
console.log("\nCreated template:", created.templateId, templateName);

const verifyRecipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${created.templateId}/recipients?include_tabs=true`,
);
const verifyClient = verifyRecipients.signers?.find((s) => s.roleName === config.clientRoleName);
const verifyText = verifyClient?.tabs?.textTabs ?? [];
const verifySign = verifyClient?.tabs?.signHereTabs ?? [];
const createdDocTabs = await api(
  `/v2.1/accounts/${config.accountId}/templates/${created.templateId}/documents/1/tabs`,
);

const labelCounts = new Map();
for (const tab of verifyText) {
  const label = tab.tabLabel?.trim();
  if (!label) continue;
  labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
}
const dupes = [...labelCounts.entries()].filter(([, n]) => n > 1);

const createdTemplate = await api(
  `/v2.1/accounts/${config.accountId}/templates/${created.templateId}`,
);
const isAceGen = createdTemplate.documents?.[0]?.isAceGenDocument;

console.log("\nVerification:");
console.log(`  Recipient text tabs: ${verifyText.length}`);
console.log(`  Recipient sign-here: ${verifySign.length}`);
console.log(`  Document-level text tabs: ${createdDocTabs.textTabs?.length ?? 0}`);
console.log(`  Document-level sign-here: ${createdDocTabs.signHereTabs?.length ?? 0}`);
console.log(`  isAceGenDocument: ${isAceGen ?? "false"}`);
console.log(`  Duplicate labels: ${dupes.length ? dupes.map(([l, n]) => `${l}(${n} placements)`).join(", ") : "none (multi-placement labels are OK)"}`);

const labels = verifyText.map((t) => normalizeTabLabel(t.tabLabel)).sort();
console.log(`  Labels: ${labels.join(", ")}`);

const envPath = join(process.cwd(), ".env.local");
let envText = readFileSync(envPath, "utf8");
envText = envText.replace(/^DOCUSIGN_TEMPLATE_ID=.*$/m, `DOCUSIGN_TEMPLATE_ID=${created.templateId}`);
writeFileSync(envPath, envText);
console.log(`\nUpdated .env.local → DOCUSIGN_TEMPLATE_ID=${created.templateId}`);
console.log("Run: npm run verify-docusign && node scripts/docusign-test-envelope.mjs");
