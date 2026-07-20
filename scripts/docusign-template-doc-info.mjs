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

const tpl = await fetch(`${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/templates/${config.templateId}`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log("Template:", tpl.name);
console.log("Documents:");
for (const doc of tpl.documents ?? []) {
  console.log(JSON.stringify({
    name: doc.name,
    fileExtension: doc.fileExtension,
    isAceGenDocument: doc.isAceGenDocument,
    templateLocked: doc.templateLocked,
    templateRequired: doc.templateRequired,
    signerMustAcknowledge: doc.signerMustAcknowledge,
  }, null, 2));
}

const lock = await fetch(`${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`, {
  headers: { Authorization: `Bearer ${token}` },
}).then(async (r) => ({ status: r.status, body: r.status === 200 ? await r.json() : await r.text() }));
console.log("\nLock status:", lock.status, typeof lock.body === "string" ? lock.body : JSON.stringify(lock.body, null, 2));
