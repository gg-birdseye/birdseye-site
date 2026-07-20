/** Diagnose why merge pre-fill may appear empty in previews. */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

function b64(i) {
  return Buffer.from(i).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const c = {
  ik: process.env.DOCUSIGN_INTEGRATION_KEY,
  uid: process.env.DOCUSIGN_USER_ID,
  acct: process.env.DOCUSIGN_ACCOUNT_ID,
  tid: process.env.DOCUSIGN_TEMPLATE_ID,
  role: process.env.DOCUSIGN_CLIENT_ROLE_NAME || "Client",
  key: process.env.DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, "\n"),
  oauth: "https://account-d.docusign.com",
  api: "https://demo.docusign.net/restapi",
};

const n = Math.floor(Date.now() / 1000);
const u = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64(JSON.stringify({
  iss: c.ik, sub: c.uid, aud: "account-d.docusign.com", iat: n, exp: n + 3600, scope: "signature impersonation",
}));
const s = createSign("RSA-SHA256"); s.update(u); s.end();
const t = (await fetch(c.oauth + "/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: u + "." + b64(s.sign(c.key)) }),
}).then(r => r.json())).access_token;

async function api(path, init) {
  const r = await fetch(c.api + path, {
    ...init,
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(data.message || text);
  return data;
}

const mergeFields = {
  ClientLegalName: "Pine Valley Golf Club LLC",
  ContactName: "John Smith",
  AmountDueToday: "$5,750.00",
  ScheduleA_Courses: "1. Test Course — 18 holes — St. George, UT",
};

console.log("Template:", c.tid, "| Role:", c.role);

const tplDocTabs = await api(`/v2.1/accounts/${c.acct}/templates/${c.tid}/documents/1/tabs`);
const tplRecipients = await api(`/v2.1/accounts/${c.acct}/templates/${c.tid}/recipients?include_tabs=true`);
const tplSigner = tplRecipients.signers?.find(s => s.roleName === c.role) ?? tplRecipients.signers?.[0];

console.log("\n=== TEMPLATE ===");
console.log("Document-level text tabs:", tplDocTabs.textTabs?.length ?? 0);
console.log("Recipient-level text tabs:", tplSigner?.tabs?.textTabs?.length ?? 0);

const envelope = await api(`/v2.1/accounts/${c.acct}/envelopes`, {
  method: "POST",
  body: JSON.stringify({
    templateId: c.tid,
    status: "sent",
    templateRoles: [{ roleName: tplSigner.roleName, email: "diag@birdseye.golf", name: "Diag Test" }],
  }),
});

const recipientId = "1";
const recipientTabsBefore = await api(
  `/v2.1/accounts/${c.acct}/envelopes/${envelope.envelopeId}/recipients/${recipientId}/tabs`,
);
const docTabsBefore = await api(
  `/v2.1/accounts/${c.acct}/envelopes/${envelope.envelopeId}/documents/1/tabs`,
);

console.log("\n=== ENVELOPE (before PUT) ===");
console.log("Recipient text tabs:", recipientTabsBefore.textTabs?.length ?? 0);
console.log("Document-level text tabs:", docTabsBefore.textTabs?.length ?? 0);

const updates = (recipientTabsBefore.textTabs ?? [])
  .filter(tab => tab.tabId && tab.tabLabel && mergeFields[tab.tabLabel] !== undefined)
  .map(tab => ({ tabId: tab.tabId, value: mergeFields[tab.tabLabel], locked: "true" }));

console.log("PUT updates (production-style):", updates.length);

if (updates.length) {
  await api(
    `/v2.1/accounts/${c.acct}/envelopes/${envelope.envelopeId}/recipients/${recipientId}/tabs`,
    { method: "PUT", body: JSON.stringify({ textTabs: updates }) },
  );
}

const recipientTabsAfter = await api(
  `/v2.1/accounts/${c.acct}/envelopes/${envelope.envelopeId}/recipients/${recipientId}/tabs`,
);
const docTabsAfter = await api(
  `/v2.1/accounts/${c.acct}/envelopes/${envelope.envelopeId}/documents/1/tabs`,
);

function summarize(tabs, label) {
  const filled = (tabs ?? []).filter(t => t.value?.trim());
  const empty = (tabs ?? []).filter(t => !t.value?.trim());
  console.log(`\n${label}: ${tabs?.length ?? 0} total, ${filled.length} filled, ${empty.length} empty`);
  for (const tab of filled.slice(0, 5)) {
    console.log(`  ✓ ${tab.tabLabel} page=${tab.pageNumber}: ${JSON.stringify(tab.value?.slice(0, 50))}`);
  }
  for (const tab of empty.slice(0, 8)) {
    console.log(`  ✗ EMPTY ${tab.tabLabel} page=${tab.pageNumber} x=${tab.xPosition} y=${tab.yPosition}`);
  }
}

summarize(recipientTabsAfter.textTabs, "Recipient tabs AFTER PUT");
summarize(docTabsAfter.textTabs, "Document-level tabs AFTER PUT");

// Check if empty visible tabs are only on document level
const emptyDoc = (docTabsAfter.textTabs ?? []).filter(t => !t.value?.trim() && mergeFields[t.tabLabel]);
const emptyRecipient = (recipientTabsAfter.textTabs ?? []).filter(t => !t.value?.trim() && mergeFields[t.tabLabel]);
console.log("\n=== ROOT CAUSE HINT ===");
console.log("Empty doc-level tabs for known merge labels:", emptyDoc.length);
console.log("Empty recipient-level tabs for known merge labels:", emptyRecipient.length);
if (emptyDoc.length > 0 && emptyRecipient.length === 0) {
  console.log("→ Document-level ghost tabs are likely what you SEE empty in preview.");
  console.log("→ API pre-fill only updates recipient tabs; doc-level duplicates stay blank.");
}

await api(`/v2.1/accounts/${c.acct}/envelopes/${envelope.envelopeId}`, {
  method: "PUT",
  body: JSON.stringify({ status: "voided", voidedReason: "Diagnostic" }),
});
