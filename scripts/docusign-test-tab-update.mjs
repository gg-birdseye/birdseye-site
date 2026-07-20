import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

function base64Url(input) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const config = {
  integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.trim(),
  userId: process.env.DOCUSIGN_USER_ID?.trim(),
  accountId: process.env.DOCUSIGN_ACCOUNT_ID?.trim(),
  templateId: process.env.DOCUSIGN_TEMPLATE_ID?.trim(),
  clientRoleName: process.env.DOCUSIGN_CLIENT_ROLE_NAME?.trim() || "Client",
  privateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  oauthBaseUrl: "https://account-d.docusign.com",
  apiBaseUrl: "https://demo.docusign.net/restapi",
};

const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
  iss: config.integrationKey,
  sub: config.userId,
  aud: "account-d.docusign.com",
  iat: now,
  exp: now + 3600,
  scope: "signature impersonation",
}))}`;
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.message || `${response.status}: ${text}`);
  return data;
}

const mergeFields = {
  ClientLegalName: "Test Golf Club",
  ContactName: "Jane Tester",
  ContactEmail: "test@example.com",
  AmountDueToday: "$2,500",
};

const envelope = await api(`/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: config.templateId,
    status: "sent",
    templateRoles: [{
      roleName: config.clientRoleName,
      email: "tabfix-test@example.com",
      name: "Jane Tester",
      clientUserId: "test-client-id",
    }],
  }),
});

const recipientId = "1";
const tabs = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${recipientId}/tabs`,
);

const updates = (tabs.textTabs ?? [])
  .filter((tab) => tab.tabLabel && mergeFields[tab.tabLabel] != null)
  .map((tab) => ({ tabId: tab.tabId, value: mergeFields[tab.tabLabel], locked: "true" }));

console.log("Tabs to update:", updates.length);
await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${recipientId}/tabs`,
  { method: "PUT", body: JSON.stringify({ textTabs: updates }) },
);

const after = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients?include_tabs=true`,
);
const signerRow = after.signers?.[0];
const filled = (signerRow?.tabs?.textTabs ?? []).filter((tab) => tab.value?.trim());
console.log("Filled after PUT:", filled.length);
for (const tab of filled.slice(0, 8)) {
  console.log(`  ${tab.tabLabel}: ${tab.value}`);
}
console.log("Envelope:", envelope.envelopeId);
