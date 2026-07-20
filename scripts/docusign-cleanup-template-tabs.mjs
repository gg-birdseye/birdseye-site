/**
 * Remove stacked duplicate Text tabs and auto-tagged Sign Here tabs
 * from the DocuSign template on the Client role.
 */
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
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function releaseExistingTemplateLock() {
  try {
    const existing = await api(
      `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`,
    );
    if (!existing?.lockToken) return;

    await api(
      `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`,
      {
        method: "DELETE",
        body: JSON.stringify({ lockToken: existing.lockToken }),
      },
    );
    console.log("Released existing template edit lock.");
  } catch (error) {
    if (error.data?.errorCode !== "TEMPLATE_LOCK_NOT_FOUND") {
      console.warn("Could not release existing lock:", error.message);
    }
  }
}

async function withTemplateEditLock(run) {
  let lockToken;
  let lastError;

  try {
    await releaseExistingTemplateLock();

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const lock = await api(
          `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`,
          {
            method: "POST",
            body: JSON.stringify({
              lockDurationInSeconds: "600",
              lockType: "edit",
            }),
          },
        );
        lockToken = lock.lockToken;

        const lockedApi = (path, init) =>
          api(path, {
            ...init,
            headers: {
              ...(init?.headers ?? {}),
              "X-DocuSign-EditLock": lockToken,
            },
          });

        return await run(lockedApi);
      } catch (error) {
        lastError = error;
        const lockErrors = new Set([
          "EDIT_LOCK_TEMPLATE_ALREADY_LOCKED",
          "EDIT_LOCK_NOT_LOCK_OWNER",
        ]);
        if (!lockErrors.has(error.data?.errorCode) || attempt === 5) {
          throw error;
        }
        console.warn(
          `Template is locked (attempt ${attempt}/5). Close the DocuSign template editor and retrying in 5s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw lastError;
  } finally {
    if (lockToken) {
      try {
        await api(
          `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/lock`,
          {
            method: "DELETE",
            body: JSON.stringify({ lockToken }),
          },
        );
      } catch {
        // Best-effort unlock.
      }
    }
  }
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

function collectRecipientDuplicateDeletes(textTabs) {
  const byLabel = new Map();
  for (const tab of textTabs) {
    const label = tab.tabLabel?.trim();
    if (!label || !tab.tabId) continue;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(tab);
  }

  const toDelete = [];
  const kept = [];

  for (const [label, tabs] of byLabel.entries()) {
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
          toDelete.push({ kind: "text", tabId: tab.tabId, label, reason: "stacked duplicate" });
        }
      }
    }

    const keep = pickTabToKeep(positionWinners);
    kept.push({ label, tabId: keep.tabId, page: keep.pageNumber });
    for (const tab of positionWinners) {
      if (tab.tabId !== keep.tabId) {
        toDelete.push({
          kind: "text",
          tabId: tab.tabId,
          label,
          reason: "duplicate label at different position",
        });
      }
    }
  }

  return { toDelete, kept };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

console.log("Template ID:", config.templateId);

const recipients = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients?include_tabs=true`,
);

const client = (recipients.signers ?? []).find((s) => s.roleName === config.clientRoleName);
if (!client?.recipientId) {
  throw new Error(`Client role "${config.clientRoleName}" not found on template.`);
}

const clientText = client.tabs?.textTabs ?? [];
const clientSignHere = client.tabs?.signHereTabs ?? [];

const { toDelete: textDeletes, kept } = collectRecipientDuplicateDeletes(clientText);

const signHereDeletes = clientSignHere
  .filter((tab) => tab.tabId && tab.tabLabel?.includes("atb.docusignFields"))
  .map((tab) => ({
    kind: "signHere",
    tabId: tab.tabId,
    label: tab.tabLabel,
    reason: "auto-tagged Agreement Prep signature",
  }));

const recipientDeletes = [...textDeletes, ...signHereDeletes];

console.log(`\nClient role before cleanup: ${clientText.length} text tabs, ${clientSignHere.length} sign-here tabs`);
console.log(`Will delete ${textDeletes.length} duplicate text tabs`);
console.log(`Will delete ${signHereDeletes.length} auto-tagged sign-here tabs`);
console.log(`Will keep ${kept.length} text tabs (one per label)`);

const docTabs = await api(
  `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
);

const docSignDeletes = (docTabs.signHereTabs ?? [])
  .filter((tab) => tab.tabId && tab.tabLabel?.includes("atb.docusignFields"))
  .map((tab) => tab.tabId);

if (recipientDeletes.length === 0 && docSignDeletes.length === 0) {
  console.log("\nNothing to delete.");
} else {
  await withTemplateEditLock(async (lockedApi) => {
    if (recipientDeletes.length) {
      for (const batch of chunk(recipientDeletes, 50)) {
        const body = {
          textTabs: batch.filter((t) => t.kind === "text").map((t) => ({ tabId: t.tabId })),
          signHereTabs: batch.filter((t) => t.kind === "signHere").map((t) => ({ tabId: t.tabId })),
        };
        if (!body.textTabs.length) delete body.textTabs;
        if (!body.signHereTabs.length) delete body.signHereTabs;

        await lockedApi(
          `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/recipients/${client.recipientId}/tabs`,
          { method: "DELETE", body: JSON.stringify(body) },
        );
      }
      console.log("\nDeleted duplicate recipient tabs.");
    }

    if (docSignDeletes.length) {
      for (const batch of chunk(docSignDeletes, 50)) {
        await lockedApi(
          `/v2.1/accounts/${config.accountId}/templates/${config.templateId}/documents/1/tabs`,
          {
            method: "DELETE",
            body: JSON.stringify({
              signHereTabs: batch.map((tabId) => ({ tabId })),
            }),
          },
        );
      }
      console.log(`Deleted ${docSignDeletes.length} auto-tagged document-level sign-here tabs.`);
    }
  });
}

console.log("\nCleanup complete. Run: npm run verify-docusign");
