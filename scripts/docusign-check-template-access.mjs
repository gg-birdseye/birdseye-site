import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

function b64(i) {
  return Buffer.from(i).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const config = {
  ik: process.env.DOCUSIGN_INTEGRATION_KEY,
  uid: process.env.DOCUSIGN_USER_ID,
  acct: process.env.DOCUSIGN_ACCOUNT_ID,
  key: process.env.DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, "\n"),
  oauth: process.env.DOCUSIGN_ENV === "production" ? "https://account.docusign.com" : "https://account-d.docusign.com",
  api: process.env.DOCUSIGN_ENV === "production" ? "https://www.docusign.net/restapi" : "https://demo.docusign.net/restapi",
};

const templateIds = [
  { label: "current (.env)", id: process.env.DOCUSIGN_TEMPLATE_ID },
  { label: "previous cleaned", id: "f3a336cf-2f75-4b30-8631-c6f6145059da" },
  { label: "original MSA & SOW", id: "4001ea66-cc80-4695-a24d-be900d1ce70e" },
  { label: "older MSA & SOW", id: "480389d5-98df-4e78-93b5-8b8cc8157002" },
].filter((t) => t.id);

const n = Math.floor(Date.now() / 1000);
const u = b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64(JSON.stringify({
  iss: config.ik, sub: config.uid, aud: new URL(config.oauth).host, iat: n, exp: n + 3600, scope: "signature impersonation",
}));
const s = createSign("RSA-SHA256");
s.update(u);
s.end();
const token = (await fetch(config.oauth + "/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: u + "." + b64(s.sign(config.key)) }),
}).then((r) => r.json())).access_token;

async function api(path, init, lockToken) {
  const r = await fetch(config.api + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(lockToken ? { "X-DocuSign-EditLock": lockToken } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

console.log("DocuSign template access check\n");

for (const tpl of templateIds) {
  console.log("---", tpl.label, "---");
  console.log("ID:", tpl.id);

  const get = await api(`/v2.1/accounts/${config.acct}/templates/${tpl.id}`);
  if (!get.ok) {
    console.log("READ: FAILED -", get.data.message || get.status);
    console.log("");
    continue;
  }
  console.log("READ: OK -", get.data.name);
  console.log("Modified:", get.data.lastModified);

  const lockGet = await api(`/v2.1/accounts/${config.acct}/templates/${tpl.id}/lock`);
  if (lockGet.ok) {
    console.log("LOCK: held until", lockGet.data.lockedUntilDateTime, "by", lockGet.data.lockedByUser?.userName);
  } else {
    console.log("LOCK: not locked (", lockGet.data.errorCode || lockGet.status, ")");
  }

  const lockPost = await api(`/v2.1/accounts/${config.acct}/templates/${tpl.id}/lock`, {
    method: "POST",
    body: JSON.stringify({ lockDurationInSeconds: "60", lockType: "edit" }),
  });

  if (!lockPost.ok) {
    console.log("EDIT LOCK: FAILED -", lockPost.data.message);
    console.log("");
    continue;
  }

  console.log("EDIT LOCK: acquired");

  const recipients = await api(
    `/v2.1/accounts/${config.acct}/templates/${tpl.id}/recipients?include_tabs=true`,
    {},
    lockPost.data.lockToken,
  );
  const signer = recipients.data.signers?.[0];
  const textCount = signer?.tabs?.textTabs?.length ?? 0;
  const signCount = signer?.tabs?.signHereTabs?.length ?? 0;
  console.log("Role:", signer?.roleName, "| text tabs:", textCount, "| sign-here:", signCount);

  const unlock = await api(`/v2.1/accounts/${config.acct}/templates/${tpl.id}/lock`, {
    method: "DELETE",
    body: JSON.stringify({ lockToken: lockPost.data.lockToken }),
  });
  console.log("UNLOCK:", unlock.ok ? "OK" : unlock.data.message);
  console.log("");
}
