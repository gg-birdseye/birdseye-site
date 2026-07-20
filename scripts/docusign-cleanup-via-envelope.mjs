/**
 * Work around a locked template by cleaning tabs on a draft envelope,
 * then saving the result as a new template.
 */
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

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
  if (!response.ok) {
    throw new Error(data.message || `${response.status}: ${text}`);
  }
  return data;
}

function tabPositionKey(tab) {
  return `${tab.pageNumber}:${tab.xPosition}:${tab.yPosition}`;
}

function pickTabToKeep(tabs) {
  return [...tabs].sort((a, b) => {
    const pageA = Number(a.pageNumber ?? 0);
    const pageB = Number(b.pageNumber ?? 0);
    if (pageA !== pageB) return pageA - pageB;
    const yA = Number(a.yPosition ?? 0);
    const yB = Number(b.yPosition ?? 0);
    if (yA !== yB) return yA - yB;
    return Number(a.xPosition ?? 0) - Number(b.xPosition ?? 0);
  })[0];
}

function collectDuplicateDeletes(textTabs) {
  const byLabel = new Map();
  for (const tab of textTabs) {
    const label = tab.tabLabel?.trim();
    if (!label || !tab.tabId) continue;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(tab);
  }

  const toDelete = [];
  for (const [, tabs] of byLabel.entries()) {
    const byPosition = new Map();
    for (const tab of tabs) {
      const key = tabPositionKey(tab);
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(tab);
    }

    const positionWinners = [];
    for (const group of byPosition.values()) {
      const keep = pickTabToKeep(group);
      positionWinners.push(keep);
      for (const tab of group) {
        if (tab.tabId !== keep.tabId) {
          toDelete.push({ kind: "text", tabId: tab.tabId });
        }
      }
    }

    const keep = pickTabToKeep(positionWinners);
    for (const tab of positionWinners) {
      if (tab.tabId !== keep.tabId) {
        toDelete.push({ kind: "text", tabId: tab.tabId });
      }
    }
  }

  return toDelete;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

console.log("Creating draft envelope from template...");
const envelope = await api(`/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: config.templateId,
    status: "created",
    templateRoles: [
      {
        roleName: config.clientRoleName,
        email: "cleanup@birdseye.golf",
        name: "Template Cleanup",
      },
    ],
  }),
});

console.log("Draft envelope:", envelope.envelopeId);

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients?include_tabs=true`,
);
const client = (recipients.signers ?? []).find((s) => s.roleName === config.clientRoleName);
if (!client?.recipientId) throw new Error("Client signer not found on draft envelope.");

const textDeletes = collectDuplicateDeletes(client.tabs?.textTabs ?? []);
const signHereDeletes = (client.tabs?.signHereTabs ?? [])
  .filter((tab) => tab.tabId && tab.tabLabel?.includes("atb.docusignFields"))
  .map((tab) => ({ kind: "signHere", tabId: tab.tabId }));

console.log(`Deleting ${textDeletes.length} duplicate text tabs and ${signHereDeletes.length} auto sign-here tabs on draft envelope...`);

for (const batch of chunk([...textDeletes, ...signHereDeletes], 50)) {
  const body = {
    textTabs: batch.filter((t) => t.kind === "text").map((t) => ({ tabId: t.tabId })),
    signHereTabs: batch.filter((t) => t.kind === "signHere").map((t) => ({ tabId: t.tabId })),
  };
  if (!body.textTabs.length) delete body.textTabs;
  if (!body.signHereTabs.length) delete body.signHereTabs;

  await api(
    `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${client.recipientId}/tabs`,
    { method: "DELETE", body: JSON.stringify(body) },
  );
}

console.log("Saving cleaned draft as new template...");
const saved = await api(`/v2.1/accounts/${config.accountId}/templates`, {
  method: "POST",
  body: JSON.stringify({
    envelopeId: envelope.envelopeId,
    name: "Birdseye MSA & SOW (cleaned)",
    description: "Duplicate tab cleanup via API",
    shared: "false",
  }),
});

const newTemplateId = saved.templateId;
console.log("New template ID:", newTemplateId);

const envPath = ".env.local";
const envText = readFileSync(envPath, "utf8");
const updatedEnv = envText.replace(
  /^DOCUSIGN_TEMPLATE_ID=.*$/m,
  `DOCUSIGN_TEMPLATE_ID=${newTemplateId}`,
);
writeFileSync(envPath, updatedEnv);
console.log("Updated DOCUSIGN_TEMPLATE_ID in .env.local");

await api(`/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}`, {
  method: "PUT",
  body: JSON.stringify({ status: "voided", voidedReason: "Template cleanup draft" }),
});

console.log("Voided draft envelope.");
console.log("\nNext: add one Sign Here field on Client in the new template, then run npm run verify-docusign");
