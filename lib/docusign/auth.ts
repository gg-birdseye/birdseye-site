import { createSign } from "node:crypto";
import { getDocuSignConfig } from "@/lib/docusign/config";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function base64Url(input: Buffer | string) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createJwtAssertion(config: NonNullable<ReturnType<typeof getDocuSignConfig>>) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: config.integrationKey,
      sub: config.userId,
      aud: new URL(config.oauthBaseUrl).host,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  let signature: Buffer;
  try {
    signature = signer.sign(config.privateKey);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `DocuSign RSA private key could not be read (${detail}). ` +
        `In Vercel, set DOCUSIGN_RSA_PRIVATE_KEY to the full PEM including ` +
        `BEGIN/END lines. Prefer one line with \\n between lines, and do not ` +
        `wrap the value in extra quotes.`,
    );
  }
  return `${unsigned}.${base64Url(signature)}`;
}

export async function getDocuSignAccessToken() {
  const config = getDocuSignConfig();
  if (!config) {
    throw new Error("DocuSign is not configured.");
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const assertion = createJwtAssertion(config);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(`${config.oauthBaseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !result.access_token) {
    const oauthHost = new URL(config.oauthBaseUrl).host;
    const envLabel =
      process.env.DOCUSIGN_ENV === "production" ? "production" : "demo";
    const base =
      result.error_description || result.error || "Unable to authenticate with DocuSign.";
    // DocuSign's "Username and Password are invalid" for JWT almost always means
    // wrong User ID, RSA key not matching the IK public key, or demo/prod mismatch.
    throw new Error(
      `${base} (DocuSign OAuth host: ${oauthHost}, DOCUSIGN_ENV=${envLabel}). ` +
        `Confirm production User ID + RSA private key from account.docusign.com Apps and Keys, ` +
        `and that DOCUSIGN_ENV=production when using live credentials.`,
    );
  }

  tokenCache = {
    accessToken: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };

  return result.access_token;
}

export async function docusignRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getDocuSignConfig();
  if (!config) {
    throw new Error("DocuSign is not configured.");
  }

  const accessToken = await getDocuSignAccessToken();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: string }).message)
        : `DocuSign request failed (${response.status}).`,
    );
  }

  return data;
}
