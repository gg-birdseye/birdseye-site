/**
 * Fix the DocuSign template configured in .env.local:
 * - Rename signer role to Client
 * - Remove Agreement Prep auto-tagged date fields
 * - Add Sign Here tabs for Client signature blocks
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
  clientRoleName: "Client",
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
    const error = new Error(data.message || `${response.status}: ${text}`);
    error.data = data;
    throw error;
  }
  return data;
}

async function withTemplateEditLock(run) {
  let lockToken;

  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const lock = await api(
          `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`,
          {
            method: "POST",
            body: JSON.stringify({ lockDurationInSeconds: "600", lockType: "edit" }),
          },
        );
        lockToken = lock.lockToken;

        const lockedApi = (path, init) =>
          api(path, {
            ...init,
            headers: { ...(init?.headers ?? {}), "X-DocuSign-EditLock": lockToken },
          });

        return await run(lockedApi);
      } catch (error) {
        const lockErrors = new Set([
          "EDIT_LOCK_TEMPLATE_ALREADY_LOCKED",
          "EDIT_LOCK_NOT_LOCK_OWNER",
        ]);
        if (!lockErrors.has(error.data?.errorCode) || attempt === 5) throw error;
        console.warn(`Template locked (attempt ${attempt}/5). Retrying in 5s...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } finally {
    if (lockToken) {
      await api(
        `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`,
        {
          method: "DELETE",
          body: JSON.stringify({ lockToken }),
        },
      ).catch(() => {});
    }
  }
}

function isAutoTagged(tab) {
  return tab.tabLabel?.includes("atb.docusignFields");
}

console.log("Fixing template:", config.templateId);

const template = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}`,
);
console.log("Template name:", template.name);

const recipientsBefore = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
);
const signerRow = recipientsBefore.signers?.[0];
if (!signerRow?.recipientId) {
  throw new Error("Template has no signer role.");
}

console.log("Current role:", signerRow.roleName);
console.log(
  "Current tabs:",
  signerRow.tabs?.textTabs?.length ?? 0,
  "text,",
  signerRow.tabs?.signHereTabs?.length ?? 0,
  "sign-here",
);

const docTabsBefore = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
);
const autoDateSigned = (docTabsBefore.dateSignedTabs ?? []).filter(isAutoTagged);
console.log("Auto-tagged date fields to remove:", autoDateSigned.length);

await withTemplateEditLock(async (lockedApi) => {
  if (signerRow.roleName !== config.clientRoleName) {
    await lockedApi(
      `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients`,
      {
        method: "PUT",
        body: JSON.stringify({
          signers: [
            {
              recipientId: signerRow.recipientId,
              roleName: config.clientRoleName,
              routingOrder: signerRow.routingOrder ?? "1",
            },
          ],
        }),
      },
    );
    console.log(`Renamed role to "${config.clientRoleName}".`);
  }

  if (autoDateSigned.length) {
    await lockedApi(
      `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
      {
        method: "DELETE",
        body: JSON.stringify({
          dateSignedTabs: autoDateSigned.map((tab) => ({ tabId: tab.tabId })),
        }),
      },
    );
    console.log("Removed auto-tagged date fields.");
  }

  const existingSignHere = signerRow.tabs?.signHereTabs ?? [];
  if (existingSignHere.length === 0) {
    await lockedApi(
      `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients/${signerRow.recipientId}/tabs`,
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
    console.log("Added Sign Here + Date Signed on Schedule A signature block (page 10).");
  } else {
    console.log("Sign Here already present; skipped adding.");
  }
});

const envPath = ".env.local";
const envText = readFileSync(envPath, "utf8");
if (!envText.includes("DOCUSIGN_CLIENT_ROLE_NAME=Client")) {
  writeFileSync(
    envPath,
    envText.replace(/^DOCUSIGN_CLIENT_ROLE_NAME=.*$/m, "DOCUSIGN_CLIENT_ROLE_NAME=Client"),
  );
  console.log("Updated DOCUSIGN_CLIENT_ROLE_NAME=Client in .env.local");
}

console.log("\nFix complete. Running verify...\n");
