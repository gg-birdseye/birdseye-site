/**
 * Create a test envelope with realistic merge data, apply pre-fill like production,
 * download PDF preview, and write a field report.
 */
import { createSign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "docs", "legal", "docusign-previews");

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const config = {
  integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.trim(),
  userId: process.env.DOCUSIGN_USER_ID?.trim(),
  accountId: process.env.DOCUSIGN_ACCOUNT_ID?.trim(),
  templateId: process.env.DOCUSIGN_TEMPLATE_ID?.trim(),
  clientRoleName: process.env.DOCUSIGN_CLIENT_ROLE_NAME?.trim() || "Client",
  privateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  oauthBaseUrl:
    process.env.DOCUSIGN_ENV === "production"
      ? "https://account.docusign.com"
      : "https://account-d.docusign.com",
  apiBaseUrl:
    process.env.DOCUSIGN_ENV === "production"
      ? "https://www.docusign.net/restapi"
      : "https://demo.docusign.net/restapi",
};

const mergeFields = {
  ClientLegalName: "Pine Valley Golf Club LLC",
  OrganizationName: "Pine Valley Golf Club",
  ClientAddress: "100 Fairway Drive, St. George, UT 84790",
  ContactName: "John Smith",
  ContactTitle: "General Manager",
  ContactEmail: "john.smith@pinevalleygolf.com",
  ContactPhone: "(435) 555-0100",
  CourseCount: "2",
  BillingPlan: "Annual",
  ScheduleA_Courses:
    "1. Pine Valley North — 18 holes — St. George, UT 84790\n" +
    "2. Pine Valley South — 9 holes — St. George, UT 84790",
  SubscriptionTotal: "$9,500.00",
  RenewalTotal: "$3,600.00/yr",
  AmountDueToday: "$5,750.00",
  MultiCourseDiscount: "10%",
  TravelMobilizationFee: "$1,000.00",
  ProductionWindow: "September 15–16, 2026 (morning)",
  TeeTime1: "7:30 AM",
  TeeTime2: "7:40 AM",
  TeeTime3: "7:50 AM",
  OnSiteCourseRepresentative: "Mike Johnson, Head Pro",
  SpecialAccessInstructions: "Check in at pro shop; cart path only on holes 4–6",
  TradeOutElection: "Option A",
  TradeOutCreditAmount: "N/A",
  TradeOutCompRoundsPerYear: "N/A",
  TradeOutMaxPlayersPerRound: "N/A",
  TradeOutBookingRestrictions: "N/A",
  TradeOutBookingContact: "N/A",
};

const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
  JSON.stringify({
    iss: config.integrationKey,
    sub: config.userId,
    aud: new URL(config.oauthBaseUrl).host,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  }),
)}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
signer.end();
const assertion = `${unsigned}.${base64Url(signer.sign(config.privateKey))}`;
const { access_token: token } = await fetch(`${config.oauthBaseUrl}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
}).then((r) => r.json());

async function api(path, init) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.message || `${response.status}: ${text}`);
  return data;
}

async function downloadPdf(path) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PDF download failed: ${response.status} ${text}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

const template = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}`,
);
const templateRecipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients`,
);
const signerRoleName =
  templateRecipients.signers?.[0]?.roleName ?? config.clientRoleName;
const testEmail = `merge-preview+${Date.now()}@birdseye.golf`;

console.log("Template:", template.name, config.templateId);
console.log("Signer role:", signerRoleName);

const envelope = await api(`/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: config.templateId,
    status: "sent",
    emailSubject: `Merge preview — ${mergeFields.OrganizationName}`,
    templateRoles: [
      {
        roleName: signerRoleName,
        email: testEmail,
        name: mergeFields.ContactName,
        clientUserId: "merge-preview-client",
      },
    ],
  }),
});

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients`,
);
const signerRow = recipients.signers?.find((s) => s.roleName === signerRoleName);
if (!signerRow?.recipientId) {
  throw new Error(`Signer role "${signerRoleName}" not found on envelope.`);
}

const tabsBefore = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${signerRow.recipientId}/tabs`,
);

const updates = (tabsBefore.textTabs ?? [])
  .filter((tab) => tab.tabId && tab.tabLabel && mergeFields[tab.tabLabel] !== undefined)
  .map((tab) => ({
    tabId: tab.tabId,
    value: mergeFields[tab.tabLabel],
    locked: "true",
  }));

await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${signerRow.recipientId}/tabs`,
  { method: "PUT", body: JSON.stringify({ textTabs: updates }) },
);

const tabsAfter = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${signerRow.recipientId}/tabs`,
);

const textTabs = tabsAfter.textTabs ?? [];
const byLabel = new Map();
for (const tab of textTabs) {
  const label = tab.tabLabel ?? "(none)";
  if (!byLabel.has(label)) byLabel.set(label, []);
  byLabel.get(label).push(tab);
}

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const pdfPath = join(outDir, `merge-preview-${stamp}.pdf`);
const reportPath = join(outDir, `merge-preview-${stamp}.md`);

const pdf = await downloadPdf(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/documents/1`,
);
writeFileSync(pdfPath, pdf);

const duplicateLabels = [...byLabel.entries()].filter(([, tabs]) => tabs.length > 1);
const emptyLabels = [...byLabel.entries()].filter(([, tabs]) =>
  tabs.every((tab) => !tab.value?.trim()),
);
const filledLabels = [...byLabel.entries()].filter(([, tabs]) =>
  tabs.some((tab) => tab.value?.trim()),
);

let report = `# DocuSign Merge Preview\n\n`;
report += `- **Template:** ${template.name}\n`;
report += `- **Template ID:** \`${config.templateId}\`\n`;
report += `- **Envelope ID:** \`${envelope.envelopeId}\`\n`;
report += `- **PDF:** \`${pdfPath.replace(/\\/g, "/")}\`\n\n`;

report += `## Summary\n\n`;
report += `| Metric | Count |\n|---|---|\n`;
report += `| Total text tabs on signer | ${textTabs.length} |\n`;
report += `| Unique labels | ${byLabel.size} |\n`;
report += `| Labels with duplicate tabs | ${duplicateLabels.length} |\n`;
report += `| Labels filled | ${filledLabels.length} |\n`;
report += `| Labels empty | ${emptyLabels.length} |\n`;
report += `| Sign Here tabs | ${(tabsAfter.signHereTabs ?? []).length} |\n\n`;

if (duplicateLabels.length) {
  report += `## Duplicate tabs (formatting risk)\n\n`;
  report += `These labels appear more than once — values may render twice or overlap on the PDF.\n\n`;
  for (const [label, tabs] of duplicateLabels.sort((a, b) => b[1].length - a[1].length)) {
    report += `### ${label} (${tabs.length} copies)\n\n`;
    for (const tab of tabs) {
      report += `- page ${tab.pageNumber}, x=${tab.xPosition}, y=${tab.yPosition} → ${JSON.stringify((tab.value ?? "").slice(0, 120))}\n`;
    }
    report += `\n`;
  }
}

report += `## All merge field values (expected → actual)\n\n`;
report += `| Label | Expected | Actual on envelope | Page |\n|---|---|---|---|\n`;
for (const [label, expected] of Object.entries(mergeFields).sort(([a], [b]) => a.localeCompare(b))) {
  const tabs = byLabel.get(label) ?? [];
  const actual = tabs.map((t) => t.value ?? "").filter(Boolean).join(" | ") || "(empty)";
  const pages = [...new Set(tabs.map((t) => t.pageNumber))].join(", ") || "—";
  const dup = tabs.length > 1 ? ` **(${tabs.length}×)**` : "";
  report += `| ${label}${dup} | ${expected.replace(/\|/g, "\\|").replace(/\n/g, "<br>")} | ${actual.replace(/\|/g, "\\|").replace(/\n/g, "<br>")} | ${pages} |\n`;
}

report += `\n## Fields on envelope but not in sample data\n\n`;
for (const label of [...byLabel.keys()].sort()) {
  if (!(label in mergeFields)) {
    report += `- ${label}\n`;
  }
}

writeFileSync(reportPath, report);

console.log("\n=== MERGE PREVIEW RESULTS ===");
console.log("Envelope:", envelope.envelopeId);
console.log("PDF saved:", pdfPath);
console.log("Report saved:", reportPath);
console.log("\nText tabs:", textTabs.length, "| Unique labels:", byLabel.size);
console.log("Duplicate labels:", duplicateLabels.length);
if (duplicateLabels.length) {
  console.log("\nDuplicates:");
  for (const [label, tabs] of duplicateLabels) {
    console.log(`  ${label}: ${tabs.length} tabs`);
  }
}
console.log("\nOpen the PDF locally to review formatting on the contract pages.");

await api(`/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}`, {
  method: "PUT",
  body: JSON.stringify({ status: "voided", voidedReason: "Merge preview test" }),
});
console.log("\nTest envelope voided.");
