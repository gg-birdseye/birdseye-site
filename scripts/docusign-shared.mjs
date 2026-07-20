import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

export function loadEnvLocal(path = ".env.local") {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

export function getDocuSignConfig() {
  const isProduction = process.env.DOCUSIGN_ENV === "production";
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.trim(),
    userId: process.env.DOCUSIGN_USER_ID?.trim(),
    accountId: process.env.DOCUSIGN_ACCOUNT_ID?.trim(),
    templateId: process.env.DOCUSIGN_TEMPLATE_ID?.trim(),
    clientRoleName: process.env.DOCUSIGN_CLIENT_ROLE_NAME?.trim() || "Client",
    privateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    oauthBaseUrl: isProduction
      ? "https://account.docusign.com"
      : "https://account-d.docusign.com",
    apiBaseUrl: isProduction
      ? "https://www.docusign.net/restapi"
      : "https://demo.docusign.net/restapi",
  };
}

function base64Url(input) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function getAccessToken(config) {
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
  const response = await fetch(`${config.oauthBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || result.error || "JWT auth failed");
  }
  return result.access_token;
}

export function createApiClient(config, token) {
  return async function api(path, init) {
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
  };
}

export function tabPositionKey(tab) {
  return `${tab.pageNumber}:${tab.xPosition}:${tab.yPosition}`;
}

const LABEL_ALIASES = {
  OnCourseSiteRepresentative: "OnSiteCourseRepresentative",
};

export function normalizeTabLabel(label) {
  if (!label) return label;
  return LABEL_ALIASES[label] ?? label;
}

export function pickTabToKeep(tabs) {
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

/** Remove stacked copies (same label + same position). Keep one tab per unique placement. */
export function dedupeTextTabs(textTabs) {
  const byLabel = new Map();
  for (const tab of textTabs) {
    const label = normalizeTabLabel(tab.tabLabel?.trim());
    if (!label || label.includes("atb.docusignFields")) continue;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(tab);
  }

  const kept = [];
  for (const [label, tabs] of byLabel.entries()) {
    const byPosition = new Map();
    for (const tab of tabs) {
      const key = tabPositionKey(tab);
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(tab);
    }

    for (const group of byPosition.values()) {
      kept.push({ ...pickTabToKeep(group), tabLabel: label });
    }
  }

  return kept.sort((a, b) => {
    const pageA = Number(a.pageNumber ?? 0);
    const pageB = Number(b.pageNumber ?? 0);
    if (pageA !== pageB) return pageA - pageB;
    return Number(a.yPosition ?? 0) - Number(b.yPosition ?? 0);
  });
}

export function findStackedDuplicateLabels(textTabs) {
  const byLabelPosition = new Map();
  for (const tab of textTabs) {
    const label = tab.tabLabel?.trim();
    if (!label || label.includes("atb.docusignFields")) continue;
    const key = `${label}@${tabPositionKey(tab)}`;
    if (!byLabelPosition.has(key)) byLabelPosition.set(key, 0);
    byLabelPosition.set(key, byLabelPosition.get(key) + 1);
  }

  const stacked = new Map();
  for (const [key, count] of byLabelPosition.entries()) {
    if (count <= 1) continue;
    const label = key.split("@")[0];
    stacked.set(label, (stacked.get(label) ?? 0) + (count - 1));
  }
  return stacked;
}

export function positionNear(a, b, tolerance = 8) {
  return (
    String(a.pageNumber) === String(b.pageNumber) &&
    Math.abs(Number(a.xPosition) - Number(b.xPosition)) <= tolerance &&
    Math.abs(Number(a.yPosition) - Number(b.yPosition)) <= tolerance
  );
}

export function mergeRepeatPlacements(existingTabs, repeatPlacements) {
  const merged = [...existingTabs];
  for (const placement of repeatPlacements) {
    const label = normalizeTabLabel(placement.tabLabel);
    const exists = merged.some(
      (tab) => normalizeTabLabel(tab.tabLabel) === label && positionNear(tab, placement),
    );
    if (!exists) {
      merged.push({ ...placement, tabLabel: label });
    }
  }
  return merged;
}

export function toApiTextTab(tab) {
  const tabLabel = normalizeTabLabel(tab.tabLabel);
  return {
    documentId: "1",
    pageNumber: String(tab.pageNumber ?? "1"),
    xPosition: String(tab.xPosition ?? "72"),
    yPosition: String(tab.yPosition ?? "72"),
    width: String(tab.width ?? "200"),
    height: String(tab.height ?? "18"),
    tabLabel,
    required: "false",
    locked: "false",
    font: tab.font ?? "Arial",
    fontSize: tab.fontSize ?? "size9",
  };
}

export function toApiSignHereTab(tab) {
  return {
    documentId: "1",
    pageNumber: String(tab.pageNumber ?? "1"),
    xPosition: String(tab.xPosition ?? "72"),
    yPosition: String(tab.yPosition ?? "72"),
    optional: "false",
  };
}
