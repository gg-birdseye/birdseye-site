/**
 * Full template fix via draft envelope:
 * dedupe tabs, strip doc-level duplicates, add Sign Here, save clean template.
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
  /** Use current env template, or override with a known-good source */
  sourceTemplateId:
    process.env.DOCUSIGN_FIX_SOURCE_TEMPLATE_ID?.trim() ||
    process.env.DOCUSIGN_TEMPLATE_ID?.trim(),
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
  if (!response.ok) throw new Error(data.message || `${response.status}: ${text}`);
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
        if (tab.tabId !== keep.tabId) toDelete.push(tab.tabId);
      }
    }

    const keep = pickTabToKeep(positionWinners);
    for (const tab of positionWinners) {
      if (tab.tabId !== keep.tabId) toDelete.push(tab.tabId);
    }
  }

  return [...new Set(toDelete)];
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isAutoTagged(tab) {
  return tab.tabLabel?.includes("atb.docusignFields");
}

console.log("Source template:", config.sourceTemplateId);

const sourceRecipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.sourceTemplateId}/recipients`,
);
const sourceRole = sourceRecipients.signers?.[0]?.roleName ?? "Signer 1";
console.log("Signer role:", sourceRole);

const envelope = await api(`/v2.1/accounts/${config.accountId}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: config.sourceTemplateId,
    status: "created",
    templateRoles: [
      {
        roleName: sourceRole,
        email: "template-fix@birdseye.golf",
        name: "Template Fix",
      },
    ],
  }),
});
console.log("Draft envelope:", envelope.envelopeId);

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients?include_tabs=true`,
);
const signerRow = recipients.signers?.[0];
if (!signerRow?.recipientId) throw new Error("No signer on draft envelope.");

const recipientText = signerRow.tabs?.textTabs ?? [];
const textDeletes = collectDuplicateDeletes(recipientText);
console.log(`Recipient text tabs: ${recipientText.length}, duplicates to delete: ${textDeletes.length}`);

if (textDeletes.length) {
  for (const batch of chunk(textDeletes, 50)) {
    await api(
      `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${signerRow.recipientId}/tabs`,
      {
        method: "DELETE",
        body: JSON.stringify({ textTabs: batch.map((tabId) => ({ tabId })) }),
      },
    );
  }
}

const docTabs = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/documents/1/tabs`,
);

const docDeletes = {
  textTabs: (docTabs.textTabs ?? []).filter((t) => t.tabId).map((t) => ({ tabId: t.tabId })),
  dateSignedTabs: (docTabs.dateSignedTabs ?? []).filter(isAutoTagged).map((t) => ({ tabId: t.tabId })),
  signHereTabs: (docTabs.signHereTabs ?? []).filter(isAutoTagged).map((t) => ({ tabId: t.tabId })),
};

const docDeleteCount =
  docDeletes.textTabs.length +
  docDeletes.dateSignedTabs.length +
  docDeletes.signHereTabs.length;

if (docDeleteCount) {
  for (const key of ["textTabs", "dateSignedTabs", "signHereTabs"]) {
    if (!docDeletes[key].length) delete docDeletes[key];
  }
  await api(
    `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/documents/1/tabs`,
    { method: "DELETE", body: JSON.stringify(docDeletes) },
  );
  console.log(`Removed ${docDeleteCount} document-level tabs (prevents save-as-template duplication).`);
}

const refreshed = await api(
  `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients?include_tabs=true`,
);
const hasSignHere = (refreshed.signers?.[0]?.tabs?.signHereTabs?.length ?? 0) > 0;

if (!hasSignHere) {
  await api(
    `/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}/recipients/${signerRow.recipientId}/tabs`,
    {
      method: "POST",
      body: JSON.stringify({
        signHereTabs: [
          {
            documentId: "1",
            pageNumber: "10",
            recipientId: signerRow.recipientId,
            xPosition: "72",
            yPosition: "270",
            optional: "false",
          },
        ],
        dateSignedTabs: [
          {
            documentId: "1",
            pageNumber: "10",
            recipientId: signerRow.recipientId,
            xPosition: "96",
            yPosition: "310",
            optional: "false",
          },
        ],
      }),
    },
  );
  console.log("Added Sign Here + Date Signed on page 10.");
}

const saved = await api(`/v2.1/accounts/${config.accountId}/templates`, {
  method: "POST",
  body: JSON.stringify({
    envelopeId: envelope.envelopeId,
    name: `Birdseye MSA SOW Final ${new Date().toISOString().slice(0, 10)}`,
    description: "Clean template — deduped merge fields + client signature",
    shared: "false",
  }),
});

console.log("New template:", saved.templateId, saved.name ?? "");

const envPath = ".env.local";
let envText = readFileSync(envPath, "utf8");
envText = envText.replace(/^DOCUSIGN_TEMPLATE_ID=.*$/m, `DOCUSIGN_TEMPLATE_ID=${saved.templateId}`);
envText = envText.replace(
  /^DOCUSIGN_CLIENT_ROLE_NAME=.*$/m,
  `DOCUSIGN_CLIENT_ROLE_NAME=${sourceRole}`,
);
writeFileSync(envPath, envText);
console.log(`Updated .env.local (role: ${sourceRole})`);

await api(`/v2.1/accounts/${config.accountId}/envelopes/${envelope.envelopeId}`, {
  method: "PUT",
  body: JSON.stringify({ status: "voided", voidedReason: "Template fix draft" }),
});

console.log("Done.");
