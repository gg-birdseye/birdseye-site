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
  oauthBaseUrl: process.env.DOCUSIGN_ENV === "production" ? "https://account.docusign.com" : "https://account-d.docusign.com",
  apiBaseUrl: process.env.DOCUSIGN_ENV === "production" ? "https://www.docusign.net/restapi" : "https://demo.docusign.net/restapi",
};

const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
  iss: config.integrationKey,
  sub: config.userId,
  aud: new URL(config.oauthBaseUrl).host,
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
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
}).then((r) => r.json());

async function api(path) {
  return fetch(`${config.apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || r.status);
    return data;
  });
}

console.log("Template ID:", config.templateId);
const template = await api(`/v2.1/accounts/${config.accountId}/templates/${config.templateId}`);
console.log("Template name:", template.name);
console.log("Last modified:", template.lastModifiedDateTime);

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
);

console.log("\n=== RECIPIENT ROLES ===");
for (const signer of recipients.signers ?? []) {
  const textCount = signer.tabs?.textTabs?.length ?? 0;
  const signCount = signer.tabs?.signHereTabs?.length ?? 0;
  console.log(`Signer role="${signer.roleName}" recipientId=${signer.recipientId} routingOrder=${signer.routingOrder}`);
  console.log(`  textTabs=${textCount} signHereTabs=${signCount}`);
}

const client = (recipients.signers ?? []).find((s) => s.roleName === config.clientRoleName);
const clientText = client?.tabs?.textTabs ?? [];

const byLabel = new Map();
for (const tab of clientText) {
  const label = tab.tabLabel ?? "(none)";
  if (!byLabel.has(label)) byLabel.set(label, []);
  byLabel.get(label).push(tab);
}

console.log("\n=== CLIENT ROLE TEXT TABS BY LABEL ===");
for (const [label, tabs] of [...byLabel.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const auto = label.includes("atb.docusignFields");
  console.log(`\n${label} (${tabs.length} tab${tabs.length === 1 ? "" : "s"})${auto ? " [AUTO-TAGGED]" : ""}`);
  for (const tab of tabs.slice(0, 3)) {
    console.log(`  page=${tab.pageNumber} x=${tab.xPosition} y=${tab.yPosition} tabId=${tab.tabId?.slice(0, 8)}...`);
  }
  if (tabs.length > 3) console.log(`  ... and ${tabs.length - 3} more at other positions`);
}

const allSignHere = [];
for (const signer of recipients.signers ?? []) {
  for (const tab of signer.tabs?.signHereTabs ?? []) {
    allSignHere.push({ role: signer.roleName, ...tab });
  }
}
console.log("\n=== SIGN HERE TABS ===");
for (const tab of allSignHere) {
  const auto = tab.tabLabel?.includes("atb.docusignFields");
  console.log(`role=${tab.role} page=${tab.pageNumber} label=${tab.tabLabel}${auto ? " [AUTO-TAGGED]" : ""}`);
}

const docTabs = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
);
console.log("\n=== DOCUMENT-LEVEL TABS (not role-specific) ===");
console.log("textTabs:", (docTabs.textTabs ?? []).length);
console.log("signHereTabs:", (docTabs.signHereTabs ?? []).length);
for (const tab of docTabs.textTabs ?? []) {
  console.log(`  ${tab.tabLabel} page=${tab.pageNumber}`);
}

console.log("\n=== LIKELY ISSUE ===");
const dupes = [...byLabel.entries()].filter(([, tabs]) => tabs.length > 1 && !tabs[0].tabLabel?.includes("atb."));
if (dupes.length) {
  console.log("Duplicate manually-labeled fields still on Client role:");
  for (const [label, tabs] of dupes) console.log(`  ${label}: ${tabs.length} copies`);
}
const autoText = clientText.filter((t) => t.tabLabel?.includes("atb.docusignFields"));
const autoSign = allSignHere.filter((t) => t.tabLabel?.includes("atb.docusignFields"));
console.log(`Auto-tagged text on Client: ${autoText.length}`);
console.log(`Auto-tagged sign here total: ${autoSign.length}`);
