import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { findStackedDuplicateLabels, normalizeTabLabel } from "./docusign-shared.mjs";

const REQUIRED_MERGE_FIELDS = [
  "ScheduleA_Courses",
  "OrganizationName",
  "ClientLegalName",
  "ClientAddress",
  "CourseCount",
  "BillingPlan",
  "AmountDueToday",
];

const RECOMMENDED_MERGE_FIELDS = [
  "ContactName",
  "ContactTitle",
  "ContactEmail",
  "ContactPhone",
  "SubscriptionTotal",
  "MultiCourseDiscount",
  "TravelMobilizationFee",
  "ProductionWindow",
  "TeeTime1",
  "TeeTime2",
  "TeeTime3",
  "OnSiteCourseRepresentative",
  "SpecialAccessInstructions",
  "TradeOutElection",
  "TradeOutCreditAmount",
  "TradeOutCompRoundsPerYear",
  "TradeOutMaxPlayersPerRound",
  "TradeOutBookingRestrictions",
  "TradeOutBookingContact",
];

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

function base64Url(input) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getConfig() {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
  const userId = process.env.DOCUSIGN_USER_ID?.trim();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID?.trim();
  const templateId = process.env.DOCUSIGN_TEMPLATE_ID?.trim();
  const privateKeyRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim();
  const isProduction = process.env.DOCUSIGN_ENV === "production";
  const oauthBaseUrl = isProduction
    ? "https://account.docusign.com"
    : "https://account-d.docusign.com";
  const apiBaseUrl = isProduction
    ? "https://www.docusign.net/restapi"
    : "https://demo.docusign.net/restapi";

  return {
    integrationKey,
    userId,
    accountId,
    templateId,
    clientRoleName: process.env.DOCUSIGN_CLIENT_ROLE_NAME?.trim() || "Client",
    privateKey: privateKeyRaw?.replace(/\\n/g, "\n"),
    oauthBaseUrl,
    apiBaseUrl,
  };
}

function createJwtAssertion(config) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: config.integrationKey,
      sub: config.userId,
      aud: new URL(config.oauthBaseUrl).host,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(config.privateKey))}`;
}

async function getAccessToken(config) {
  const assertion = createJwtAssertion(config);
  const response = await fetch(`${config.oauthBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    const consentUrl =
      `${config.oauthBaseUrl}/oauth/auth?response_type=code&scope=signature%20impersonation` +
      `&client_id=${config.integrationKey}&redirect_uri=https://www.docusign.com`;
    throw new Error(
      `${result.error_description || result.error || "JWT auth failed"}\n` +
        `If this is your first time, grant consent by opening:\n${consentUrl}`,
    );
  }
  return result.access_token;
}

async function apiGet(config, token, path) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}): ${path}`);
  }
  return data;
}

const config = getConfig();
const missing = [
  ["DOCUSIGN_INTEGRATION_KEY", config.integrationKey],
  ["DOCUSIGN_USER_ID", config.userId],
  ["DOCUSIGN_ACCOUNT_ID", config.accountId],
  ["DOCUSIGN_RSA_PRIVATE_KEY", config.privateKey],
].filter(([, value]) => !value);

if (missing.length) {
  console.error("Missing required env vars:");
  for (const [key] of missing) console.error(`  - ${key}`);
  console.error("\nOptional until template is ready:");
  console.error("  - DOCUSIGN_TEMPLATE_ID");
  console.error("\nSet DOCUSIGN_ENV=demo for developer/sandbox (default).");
  process.exit(1);
}

console.log("DocuSign environment:", process.env.DOCUSIGN_ENV === "production" ? "production" : "demo");
console.log("API base:", config.apiBaseUrl);

const token = await getAccessToken(config);
console.log("JWT authentication OK");

const userInfo = await fetch(`${config.oauthBaseUrl}/oauth/userinfo`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((response) => response.json());

const defaultAccount = userInfo.accounts?.find((account) => account.is_default) ??
  userInfo.accounts?.[0];

console.log("\nAccount discovery (verify these match .env.local):");
console.log("  User ID:", userInfo.sub);
console.log("  Account ID:", defaultAccount?.account_id);
console.log("  Account name:", defaultAccount?.account_name);

if (config.accountId !== defaultAccount?.account_id) {
  console.warn("\nWarning: DOCUSIGN_ACCOUNT_ID does not match default account from userinfo.");
}

if (config.userId !== userInfo.sub) {
  console.warn("Warning: DOCUSIGN_USER_ID does not match userinfo sub.");
}

if (!config.templateId) {
  console.log("\nNext step: create your template in DocuSign, then set DOCUSIGN_TEMPLATE_ID.");
  process.exit(0);
}

const template = await apiGet(
  config,
  token,
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}`,
);
console.log("\nTemplate OK:", template.name || config.templateId);

const recipients = await apiGet(
  config,
  token,
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
);

const roles = [
  ...(recipients.signers ?? []).map((signer) => signer.roleName),
  ...(recipients.agents ?? []).map((agent) => agent.roleName),
  ...(recipients.editors ?? []).map((editor) => editor.roleName),
].filter(Boolean);

console.log("Template roles:", roles.join(", ") || "(none found)");
if (!roles.includes(config.clientRoleName)) {
  console.warn(
    `Warning: expected role "${config.clientRoleName}" not found. Set DOCUSIGN_CLIENT_ROLE_NAME or rename the role in DocuSign.`,
  );
}

const tabs = await apiGet(
  config,
  token,
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
);

const textLabels = new Set(
  (tabs.textTabs ?? [])
    .map((tab) => tab.tabLabel)
    .filter(Boolean),
);

const autoTaggedLabels = [
  ...(tabs.signHereTabs ?? []),
  ...(tabs.dateSignedTabs ?? []),
  ...(tabs.titleTabs ?? []),
  ...(tabs.textTabs ?? []),
  ...(tabs.checkboxTabs ?? []),
]
  .map((tab) => tab.tabLabel)
  .filter((label) => label?.includes("atb.docusignFields"));

const tabGroupCount = (tabs.tabGroups ?? []).length;

const signers = recipients.signers ?? [];
const clientSigner = signers.find((signer) => signer.roleName === config.clientRoleName);
const roleTextTabs = clientSigner?.tabs?.textTabs ?? [];
const roleLabels = new Set(
  roleTextTabs.map((tab) => normalizeTabLabel(tab.tabLabel)).filter(Boolean),
);
const labelCounts = new Map();
for (const tab of roleTextTabs) {
  const label = normalizeTabLabel(tab.tabLabel?.trim());
  if (!label) continue;
  labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
}
const multiPlacementLabels = [...labelCounts.entries()].filter(([, count]) => count > 1);
const stackedDuplicates = findStackedDuplicateLabels(roleTextTabs);

let exitCode = 0;

console.log("\nText tab data labels found:", [...roleLabels].sort().join(", ") || "(none)");
const missingFields = REQUIRED_MERGE_FIELDS.filter((field) => !roleLabels.has(field));
const missingRecommended = RECOMMENDED_MERGE_FIELDS.filter((field) => !roleLabels.has(field));

if (stackedDuplicates.size) {
  console.error("\nERROR: Stacked duplicate Text fields on the Client role (same label at the same position).");
  console.error("Agreement Prep often creates many copies stacked on one blank line, which breaks pre-fill.");
  for (const [label, count] of [...stackedDuplicates.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`  - ${label}: ${count + 1} tabs at one position (keep 1)`);
  }
  console.error("Fix: delete stacked copies. Multiple tabs with the same label at different locations are OK.");
  exitCode = 1;
} else if (multiPlacementLabels.length) {
  console.log("\nMulti-placement labels (same value pre-filled in each location):");
  for (const [label, count] of multiPlacementLabels.sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${label}: ${count} tabs`);
  }
}

if (roleLabels.size === 0) {
  console.error("\nERROR: No Text fields with Data Labels found on the template.");
  console.error("The API cannot pre-fill merge data until you add Text tabs on the Client role.");
  console.error("Auto-detected / drag-and-drop field groups do NOT work with our integration.");
} else if (missingFields.length) {
  console.warn("\nMissing required merge field data labels:");
  for (const field of missingFields) console.warn(`  - ${field}`);
} else {
  console.log("\nAll required merge fields are present.");
}

if (missingRecommended.length) {
  console.warn("\nMissing recommended merge field data labels:");
  for (const field of missingRecommended) console.warn(`  - ${field}`);
}

if (autoTaggedLabels.length || tabGroupCount > 0) {
  console.warn("\nWarning: template uses DocuSign auto-tagging (Agreement Prep / .docx upload).");
  if (autoTaggedLabels.length) {
    console.warn(`  Auto-tagged fields detected: ${autoTaggedLabels.length}`);
  }
  if (tabGroupCount > 0) {
    console.warn(`  Tab groups detected: ${tabGroupCount} (signers may be asked to drag fields from the sidebar)`);
  }
  console.warn("  Fix: delete auto-tagged groups and add Text fields manually with exact Data Labels.");
}

const clientSignHere =
  clientSigner?.tabs?.signHereTabs?.length ?? tabs.signHereTabs?.length ?? 0;
if (!clientSigner) {
  console.warn("\nWarning: no signer found for the Client role.");
} else if (!clientSignHere) {
  console.warn("\nWarning: no Sign Here tab detected on the Client role.");
}

if (roleLabels.size === 0 || missingFields.length) {
  exitCode = 1;
}

console.log("\nExpected Text field Data Labels (must match exactly, case-sensitive):");
console.log("  Required:", REQUIRED_MERGE_FIELDS.join(", "));
console.log("  Recommended:", RECOMMENDED_MERGE_FIELDS.join(", "));
console.log("  Per course: Course1_Name, Course1_Holes, Course1_Location, Course2_Name, ...");

if (exitCode === 0) {
  console.log("\nDocuSign setup looks good. Test by creating an onboarding invite and clicking Sign in DocuSign.");
} else {
  console.error("\nDocuSign template is not ready for API pre-fill. Update the template, then re-run this command.");
}

process.exit(exitCode);
