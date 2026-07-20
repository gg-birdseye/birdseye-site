import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

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
  const clientRoleName = process.env.DOCUSIGN_CLIENT_ROLE_NAME?.trim() || "Client";

  return {
    integrationKey,
    userId,
    accountId,
    templateId,
    clientRoleName,
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
    throw new Error(result.error_description || result.error || "JWT auth failed");
  }
  return result.access_token;
}

async function api(config, token, path, init) {
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
  if (!response.ok) {
    throw new Error(data.message || `${response.status} ${path}: ${text}`);
  }
  return data;
}

const config = getConfig();
const token = await getAccessToken(config);

const testClientId = "00000000-0000-4000-8000-000000000099";
const testEmail = `docusign-test+${Date.now()}@example.com`;
const mergeFields = {
  ClientLegalName: "Test Golf Club",
  OrganizationName: "Test Golf Club",
  ClientAddress: "123 Main St, Richmond, UT 84333",
  ContactName: "Jane Tester",
  ContactEmail: testEmail,
  ContactPhone: "(555) 555-5555",
  CourseCount: "1",
  BillingPlan: "Annual",
  ScheduleA_Courses: "1. Test Golf Club — 18 holes — Richmond, UT 84333",
  SubscriptionTotal: "$5,000",
  AmountDueToday: "$2,500",
  MultiCourseDiscount: "None",
  TravelMobilizationFee: "None",
  ProductionWindow: "TBD",
  TeeTime1: "TBD",
  TeeTime2: "TBD",
  TeeTime3: "TBD",
  OnSiteCourseRepresentative: "TBD",
  SpecialAccessInstructions: "TBD",
  TradeOutElection: "No",
  TradeOutCreditAmount: "None",
  TradeOutCompRoundsPerYear: "None",
  TradeOutMaxPlayersPerRound: "None",
  TradeOutBookingRestrictions: "None",
  TradeOutBookingContact: "None",
};

const textTabs = Object.entries(mergeFields).map(([tabLabel, value]) => ({
  tabLabel,
  value,
  locked: "true",
}));

console.log("Creating test envelope...");
const envelope = await api(config, token, `/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: config.templateId,
    status: "sent",
    emailSubject: "DocuSign diagnostic test envelope",
    templateRoles: [
      {
        roleName: config.clientRoleName,
        email: testEmail,
        name: "Jane Tester",
        clientUserId: testClientId,
        tabs: { textTabs },
      },
    ],
  }),
});

console.log("Envelope ID:", envelope.envelopeId);
console.log("Envelope status:", envelope.status);

const recipients = await api(
  config,
  token,
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients?include_tabs=true`,
);

const signer = (recipients.signers ?? []).find((row) => row.roleName === config.clientRoleName);
console.log("\nSigner:");
console.log("  recipientId:", signer?.recipientId);
console.log("  status:", signer?.status);
console.log("  clientUserId:", signer?.clientUserId);

const filledTextTabs = signer?.tabs?.textTabs ?? [];
const withValues = filledTextTabs.filter((tab) => tab.value?.trim());
const emptyValues = filledTextTabs.filter((tab) => !tab.value?.trim());
console.log("\nText tabs on envelope after create:");
console.log("  total:", filledTextTabs.length);
console.log("  with values:", withValues.length);
console.log("  empty:", emptyValues.length);
if (withValues.length > 0) {
  console.log("\nSample filled tabs:");
  for (const tab of withValues.slice(0, 8)) {
    console.log(`  ${tab.tabLabel}: ${JSON.stringify(tab.value?.slice(0, 80))}`);
  }
}
if (emptyValues.length > 0) {
  console.log("\nEmpty tabs (first 10):");
  for (const tab of emptyValues.slice(0, 10)) {
    console.log(`  ${tab.tabLabel}`);
  }
}

const signHereTabs = signer?.tabs?.signHereTabs ?? [];
console.log("\nSign Here tabs:", signHereTabs.length);
for (const tab of signHereTabs) {
  console.log(`  label=${tab.tabLabel} documentId=${tab.documentId} page=${tab.pageNumber}`);
}

const tabGroups = signer?.tabs?.tabGroups ?? [];
console.log("\nTab groups on signer:", tabGroups.length);

const view = await api(
  config,
  token,
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/views/recipient`,
  {
    method: "POST",
    body: JSON.stringify({
      returnUrl: "https://example.com/return",
      authenticationMethod: "none",
      email: testEmail,
      userName: "Jane Tester",
      clientUserId: testClientId,
      recipientId: signer?.recipientId,
    }),
  },
);

console.log("\nSigning URL:");
console.log(view.url);
console.log("\nURL hints:");
console.log("  contains /signing/", view.url?.includes("/signing/"));
console.log("  contains /prepare/", view.url?.includes("/prepare/"));
console.log("  contains /tagger/", view.url?.includes("/tagger/"));
console.log("  contains /add-fields/", view.url?.includes("/add-fields/"));

const envelopeDetail = await api(
  config,
  token,
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}`,
);
console.log("\nEnvelope detail status:", envelopeDetail.status);
console.log("Envelope allowMarkup:", envelopeDetail.allowMarkup);
console.log("Envelope enableWetSign:", envelopeDetail.enableWetSign);

console.log("\nVoid this test envelope in DocuSign Manage if desired.");
