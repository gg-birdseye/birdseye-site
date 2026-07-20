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

const tokenRes = await fetch(`${config.oauthBaseUrl}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
const { access_token: token } = await tokenRes.json();

const recipients = await fetch(
  `${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
  { headers: { Authorization: `Bearer ${token}` } },
).then((r) => r.json());

const clientSigner = (recipients.signers ?? []).find(
  (row) => row.roleName === config.clientRoleName,
);
const textTabs = clientSigner?.tabs?.textTabs ?? [];

console.log("Template Client role text tabs:", textTabs.length);
const labelCounts = new Map();
for (const tab of textTabs) {
  const label = tab.tabLabel ?? "(no label)";
  labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
}

const duplicates = [...labelCounts.entries()].filter(([, count]) => count > 1);
console.log("\nDuplicate tab labels:", duplicates.length ? duplicates : "none");

console.log("\nFirst 5 tabs detail:");
for (const tab of textTabs.slice(0, 5)) {
  console.log(JSON.stringify({
    tabLabel: tab.tabLabel,
    tabId: tab.tabId,
    documentId: tab.documentId,
    pageNumber: tab.pageNumber,
    name: tab.name,
    tabType: tab.tabType,
    mergeField: tab.mergeField,
    value: tab.value,
  }, null, 2));
}

const autoTagged = textTabs.filter((tab) => tab.tabLabel?.includes("atb.docusignFields"));
console.log("\nAuto-tagged text tabs:", autoTagged.length);

const docTabs = await fetch(
  `${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
  { headers: { Authorization: `Bearer ${token}` } },
).then((r) => r.json());

console.log("\nDocument-level text tabs:", (docTabs.textTabs ?? []).length);
console.log("Document-level vs role-level mismatch:",
  (docTabs.textTabs ?? []).length !== textTabs.length);

const docLabelCounts = new Map();
for (const tab of docTabs.textTabs ?? []) {
  const label = tab.tabLabel ?? "(no label)";
  docLabelCounts.set(label, (docLabelCounts.get(label) ?? 0) + 1);
}
const docDuplicates = [...docLabelCounts.entries()].filter(([, count]) => count > 1);
console.log("Document-level duplicate labels:", docDuplicates);
