/**
 * Full visual test: realistic merge data, signing URL, PDF download, position report.
 * Envelope is left open so you can review in DocuSign. Void manually when done.
 *
 * Usage: node scripts/docusign-visual-test.mjs
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

const testClientId = "visual-test-00000001";
const testEmail = `visual-test+${Date.now()}@birdseye.golf`;

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

const template = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}`,
);

console.log("Template:", template.name);
console.log("Template ID:", config.templateId);

const envelope = await api(`/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: config.templateId,
    status: "sent",
    emailSubject: `VISUAL TEST — ${mergeFields.OrganizationName}`,
    templateRoles: [
      {
        roleName: config.clientRoleName,
        email: testEmail,
        name: mergeFields.ContactName,
        clientUserId: testClientId,
      },
    ],
  }),
});

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients`,
);
const signerRow = recipients.signers?.find((s) => s.roleName === config.clientRoleName);
if (!signerRow?.recipientId) throw new Error("Client signer not found.");

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

const view = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/views/recipient`,
  {
    method: "POST",
    body: JSON.stringify({
      returnUrl: "https://birdseye.golf/onboarding/complete",
      authenticationMethod: "none",
      email: testEmail,
      userName: mergeFields.ContactName,
      clientUserId: testClientId,
      recipientId: signerRow.recipientId,
    }),
  },
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
const reportPath = join(outDir, `visual-test-${stamp}.md`);

let report = `# DocuSign Visual Test\n\n`;
report += `- **Template:** ${template.name}\n`;
report += `- **Template ID:** \`${config.templateId}\`\n`;
report += `- **Envelope ID:** \`${envelope.envelopeId}\`\n`;
report += `- **Signing URL:** ${view.url}\n\n`;
report += `> Open the signing URL to see exactly what a client sees. PDF download may not show tab values.\n\n`;

report += `## Tab positions (all ${textTabs.length} fields)\n\n`;
report += `| Label | Page | X | Y | Width | Height | Value preview |\n`;
report += `|---|---|---|---|---|---|---|\n`;
for (const tab of [...textTabs].sort((a, b) => {
  const p = Number(a.pageNumber) - Number(b.pageNumber);
  return p !== 0 ? p : Number(a.yPosition) - Number(b.yPosition);
})) {
  const val = (tab.value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 60);
  report += `| ${tab.tabLabel} | ${tab.pageNumber} | ${tab.xPosition} | ${tab.yPosition} | ${tab.width ?? "—"} | ${tab.height ?? "—"} | ${val || "(empty)"} |\n`;
}

const stacked = [];
const byPos = new Map();
for (const tab of textTabs) {
  const key = `${tab.tabLabel}@${tab.pageNumber}:${tab.xPosition}:${tab.yPosition}`;
  if (!byPos.has(key)) byPos.set(key, []);
  byPos.get(key).push(tab);
}
for (const [key, tabs] of byPos.entries()) {
  if (tabs.length > 1) stacked.push({ key, count: tabs.length });
}

report += `\n## Issues detected\n\n`;
if (stacked.length) {
  report += `### Stacked tabs (same label + same position)\n\n`;
  for (const s of stacked) report += `- ${s.key}: ${s.count} copies\n`;
} else {
  report += `- No stacked tabs at identical coordinates.\n`;
}

const multi = [...byLabel.entries()].filter(([, tabs]) => tabs.length > 1);
if (multi.length) {
  report += `\n### Multi-placement labels (intentional repeats)\n\n`;
  for (const [label, tabs] of multi) {
    report += `**${label}** (${tabs.length}×): `;
    report += tabs.map((t) => `p${t.pageNumber} (${t.xPosition},${t.yPosition})`).join("; ");
    report += `\n`;
  }
}

writeFileSync(reportPath, report);

console.log("\n========================================");
console.log("VISUAL TEST READY");
console.log("========================================");
console.log("Envelope ID:", envelope.envelopeId);
console.log("Report:", reportPath);
console.log("\n>>> OPEN THIS SIGNING URL TO REVIEW <<<\n");
console.log(view.url);
console.log("\n========================================");
console.log(`Text tabs: ${textTabs.length} | Filled: ${updates.length} | Sign Here: ${(tabsAfter.signHereTabs ?? []).length}`);
if (multi.length) {
  console.log("\nMulti-placement:");
  for (const [label, tabs] of multi) console.log(`  ${label}: ${tabs.length} locations`);
}
console.log("\nEnvelope left open — void in DocuSign Manage when done reviewing.");
