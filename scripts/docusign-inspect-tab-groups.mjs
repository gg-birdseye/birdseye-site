import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

function base64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const config = {
  integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.trim(),
  userId: process.env.DOCUSIGN_USER_ID?.trim(),
  accountId: process.env.DOCUSIGN_ACCOUNT_ID?.trim(),
  templateId: process.env.DOCUSIGN_TEMPLATE_ID?.trim(),
  privateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  oauthBaseUrl: process.env.DOCUSIGN_ENV === "production" ? "https://account.docusign.com" : "https://account-d.docusign.com",
  apiBaseUrl: process.env.DOCUSIGN_ENV === "production" ? "https://www.docusign.net/restapi" : "https://demo.docusign.net/restapi",
};

const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
  iss: config.integrationKey, sub: config.userId, aud: new URL(config.oauthBaseUrl).host, iat: now, exp: now + 3600, scope: "signature impersonation",
}))}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
signer.end();
const assertion = `${unsigned}.${base64Url(signer.sign(config.privateKey))}`;
const { access_token: token } = await fetch(`${config.oauthBaseUrl}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
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

const docTabs = await api(`/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`);
console.log("tabGroups:", JSON.stringify(docTabs.tabGroups, null, 2));
for (const kind of ["signHereTabs", "textTabs", "checkboxTabs", "dateSignedTabs"]) {
  const auto = (docTabs[kind] ?? []).filter((t) => t.tabLabel?.includes("atb.docusignFields"));
  if (auto.length) {
    console.log(`\nAuto ${kind}:`, auto.map((t) => ({ page: t.pageNumber, label: t.tabLabel, x: t.xPosition, y: t.yPosition })));
  }
}

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
);
const signerRow = recipients.signers?.[0];
console.log("\nRecipient signHere:", signerRow?.tabs?.signHereTabs?.length ?? 0);
console.log("Recipient text:", signerRow?.tabs?.textTabs?.length ?? 0);
