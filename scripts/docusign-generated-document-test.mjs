/**
 * Test generate-then-sign: fill Word template, upload to DocuSign, signing URL only.
 *
 * Prereq:
 *   node scripts/generate-birdseye-msa-docx.mjs
 *   Set DOCUSIGN_CONTRACT_DOCX_PATH in .env.local
 */
import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const contractDocxPath =
  process.env.DOCUSIGN_CONTRACT_DOCX_PATH?.trim() ||
  join(process.cwd(), "docs", "legal", "Birdseye-Master-Service-Agreement-and-Schedule-A.docx");

if (!existsSync(contractDocxPath)) {
  console.error("Contract template not found:", contractDocxPath);
  console.error("Run: node scripts/generate-birdseye-msa-docx.mjs");
  process.exit(1);
}

const { fillContractDocx } = await import("../lib/onboarding/fill-contract-docx.ts");
const { buildClientDateSignedTabs, buildClientSignHereTabs } = await import(
  "../lib/docusign/contract-sign-tabs.ts"
);

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
  privateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  oauthBaseUrl: "https://account-d.docusign.com",
  apiBaseUrl: "https://demo.docusign.net/restapi",
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

const filled = fillContractDocx(contractDocxPath, mergeFields);
const documentBase64 = filled.toString("base64");

const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
  JSON.stringify({
    iss: config.integrationKey,
    sub: config.userId,
    aud: "account-d.docusign.com",
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

const testEmail = `generated-doc+${Date.now()}@birdseye.golf`;
const testClientId = "generated-doc-test-001";

const envelope = await api(`/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    status: "sent",
    emailSubject: `GENERATED DOC TEST — ${mergeFields.OrganizationName}`,
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
          roleName: "Client",
          email: testEmail,
          name: mergeFields.ContactName,
          clientUserId: testClientId,
          tabs: {
            signHereTabs: buildClientSignHereTabs(),
            dateSignedTabs: buildClientDateSignedTabs(),
          },
        },
      ],
    },
  }),
});

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
      recipientId: "1",
    }),
  },
);

const tabs = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/1/tabs`,
);

console.log("\n========================================");
console.log("GENERATED DOCUMENT TEST");
console.log("========================================");
console.log("Template:", contractDocxPath);
console.log("Envelope:", envelope.envelopeId);
console.log("Text tabs on envelope:", tabs.textTabs?.length ?? 0, "(should be 0)");
console.log("Sign Here tabs:", tabs.signHereTabs?.length ?? 0);
console.log("\n>>> OPEN THIS URL — text is baked into the document <<<\n");
console.log(view.url);
console.log("\n========================================");
