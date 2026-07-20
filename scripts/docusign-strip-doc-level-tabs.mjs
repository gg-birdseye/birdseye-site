/** Delete document-level text/sign/date tabs (keeps recipient tabs for pre-fill). */
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

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
  key: process.env.DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, "\n"),
  oauth: "https://account-d.docusign.com",
  api: "https://demo.docusign.net/restapi",
};

const n = Math.floor(Date.now() / 1000);
const u =
  b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
  "." +
  b64(
    JSON.stringify({
      iss: c.ik,
      sub: c.uid,
      aud: "account-d.docusign.com",
      iat: n,
      exp: n + 3600,
      scope: "signature impersonation",
    }),
  );
const s = createSign("RSA-SHA256");
s.update(u);
s.end();
const t = (
  await fetch(c.oauth + "/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: u + "." + b64(s.sign(c.key)),
    }),
  }).then((r) => r.json())
).access_token;

function editHeader(lockToken) {
  return { "X-DocuSign-Edit": JSON.stringify({ lockToken }) };
}

async function api(path, init, lockToken) {
  const r = await fetch(c.api + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + t,
      "Content-Type": "application/json",
      ...(lockToken ? editHeader(lockToken) : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(data.message || text);
  return data;
}

console.log("Template:", c.tid);

let lockToken;
const existing = await fetch(c.api + `/v2.1/accounts/${c.acct}/templates/${c.tid}/lock`, {
  headers: { Authorization: "Bearer " + t },
}).then(async (r) => (r.ok ? r.json() : null));

if (existing?.lockToken) {
  lockToken = existing.lockToken;
  console.log("Reusing existing lock.");
} else {
  const lock = await api(`/v2.1/accounts/${c.acct}/templates/${c.tid}/lock`, {
    method: "POST",
    body: JSON.stringify({ lockDurationInSeconds: "600", lockType: "edit" }),
  });
  lockToken = lock.lockToken;
  console.log("Acquired edit lock.");
}

try {
  const docTabs = await api(
    `/v2.1/accounts/${c.acct}/templates/${c.tid}/documents/1/tabs`,
    {},
    lockToken,
  );
  const body = {};
  if (docTabs.textTabs?.length) {
    body.textTabs = docTabs.textTabs.map((tab) => ({ tabId: tab.tabId }));
  }
  const autoSign = (docTabs.signHereTabs ?? []).filter((tab) =>
    tab.tabLabel?.includes("atb.docusignFields"),
  );
  const manualSign = (docTabs.signHereTabs ?? []).filter(
    (tab) => !tab.tabLabel?.includes("atb.docusignFields"),
  );
  if (autoSign.length) body.signHereTabs = autoSign.map((tab) => ({ tabId: tab.tabId }));
  const autoDates = (docTabs.dateSignedTabs ?? []).filter((tab) =>
    tab.tabLabel?.includes("atb.docusignFields"),
  );
  if (autoDates.length) body.dateSignedTabs = autoDates.map((tab) => ({ tabId: tab.tabId }));

  console.log(
    "Deleting doc-level:",
    Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v.length])),
  );
  if (Object.keys(body).length) {
    await api(
      `/v2.1/accounts/${c.acct}/templates/${c.tid}/documents/1/tabs`,
      { method: "DELETE", body: JSON.stringify(body) },
      lockToken,
    );
  }

  const recipients = await api(
    `/v2.1/accounts/${c.acct}/templates/${c.tid}/recipients?include_tabs=true`,
    {},
    lockToken,
  );
  const signer = recipients.signers?.[0];
  let roleName = signer?.roleName ?? "Signer 1";
  const hasManualSign = (signer?.tabs?.signHereTabs ?? []).some(
    (tab) => !tab.tabLabel?.includes("atb.docusignFields"),
  );

  if (!hasManualSign) {
    await api(
      `/v2.1/accounts/${c.acct}/templates/${c.tid}/recipients/${signer.recipientId}/tabs`,
      {
        method: "POST",
        body: JSON.stringify({
          signHereTabs: [
            {
              documentId: "1",
              pageNumber: "10",
              recipientId: signer.recipientId,
              xPosition: "72",
              yPosition: "270",
              optional: "false",
            },
          ],
          dateSignedTabs: [
            {
              documentId: "1",
              pageNumber: "10",
              recipientId: signer.recipientId,
              xPosition: "96",
              yPosition: "310",
              optional: "false",
            },
          ],
        }),
      },
      lockToken,
    );
    console.log("Added Sign Here + Date Signed on page 10.");
  }

  if (roleName !== "Client") {
    await api(`/v2.1/accounts/${c.acct}/templates/${c.tid}/recipients`, {
      method: "PUT",
      body: JSON.stringify({
        signers: [
          {
            recipientId: signer.recipientId,
            roleName: "Client",
            routingOrder: signer.routingOrder ?? "1",
          },
        ],
      }),
    }, lockToken);
    roleName = "Client";
    console.log('Renamed role to "Client".');
  }

  let envText = readFileSync(".env.local", "utf8");
  envText = envText.replace(/^DOCUSIGN_CLIENT_ROLE_NAME=.*$/m, "DOCUSIGN_CLIENT_ROLE_NAME=Client");
  writeFileSync(".env.local", envText);

  console.log("Done.");
} finally {
  await api(
    `/v2.1/accounts/${c.acct}/templates/${c.tid}/lock`,
    { method: "DELETE", body: JSON.stringify({ lockToken }) },
    lockToken,
  ).catch(() => {});
}
