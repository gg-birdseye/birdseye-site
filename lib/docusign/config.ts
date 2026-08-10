export type DocuSignConfig = {
  integrationKey: string;
  userId: string;
  accountId: string;
  templateId: string;
  clientRoleName: string;
  oauthBaseUrl: string;
  apiBaseUrl: string;
  privateKey: string;
  webhookHmacKey?: string;
  /** When set, merge data is baked into this .docx before upload (legacy single template). */
  contractDocxPath?: string;
  /** Directory containing base / travel / trade_out / travel_trade_out contract .docx files. */
  contractDocxDir?: string;
  /** "generated" = fill Word doc + upload; "template" = legacy text-tab pre-fill. */
  envelopeMode: "generated" | "template";
};

/** Normalize PEM private keys stored in env vars (Vercel multiline / \\n / quoted). */
export function normalizeDocuSignPrivateKey(raw: string): string {
  let key = raw.trim();

  // Strip wrapping quotes from .env-style values pasted into Vercel.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Vercel single-line pastes often strip newlines entirely:
  // -----BEGIN …-----MIIE…=-----END …-----
  // Node's PEM decoder requires a newline after BEGIN and before END.
  key = key.replace(/(-----BEGIN [A-Z0-9 ]+-----)\s*/i, "$1\n");
  key = key.replace(/\s*(-----END [A-Z0-9 ]+-----)/i, "\n$1");

  return key.trim();
}

export function isDocuSignConfigured() {
  return Boolean(getDocuSignConfig());
}

export function getDocuSignConfig(): DocuSignConfig | null {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
  const userId = process.env.DOCUSIGN_USER_ID?.trim();
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID?.trim();
  const templateId = process.env.DOCUSIGN_TEMPLATE_ID?.trim();
  const privateKeyRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim();
  const contractDocxPath = process.env.DOCUSIGN_CONTRACT_DOCX_PATH?.trim();
  const contractDocxDir = process.env.DOCUSIGN_CONTRACT_DOCX_DIR?.trim();
  const envelopeMode =
    process.env.DOCUSIGN_ENVELOPE_MODE?.trim() === "template"
      ? "template"
      : contractDocxDir || contractDocxPath
        ? "generated"
        : "template";

  if (!integrationKey || !userId || !accountId || !privateKeyRaw) {
    return null;
  }

  if (envelopeMode === "template" && !templateId) {
    return null;
  }

  if (envelopeMode === "generated" && !contractDocxDir && !contractDocxPath) {
    return null;
  }

  const privateKey = normalizeDocuSignPrivateKey(privateKeyRaw);
  if (
    !privateKey.includes("BEGIN") ||
    !privateKey.includes("PRIVATE KEY")
  ) {
    return null;
  }

  const isProduction = process.env.DOCUSIGN_ENV === "production";
  const oauthBaseUrl = isProduction
    ? "https://account.docusign.com"
    : "https://account-d.docusign.com";
  // Fallback only — live requests resolve the account base_uri via /oauth/userinfo
  // (production accounts are often on na3/na4/etc., not www.docusign.net).
  const apiBaseUrl =
    process.env.DOCUSIGN_API_BASE_URL?.trim().replace(/\/$/, "") ||
    (isProduction
      ? "https://www.docusign.net/restapi"
      : "https://demo.docusign.net/restapi");

  return {
    integrationKey,
    userId,
    accountId,
    templateId: templateId ?? "",
    clientRoleName: process.env.DOCUSIGN_CLIENT_ROLE_NAME?.trim() || "Client",
    oauthBaseUrl,
    apiBaseUrl,
    privateKey,
    webhookHmacKey: process.env.DOCUSIGN_WEBHOOK_HMAC_KEY?.trim(),
    contractDocxPath,
    contractDocxDir,
    envelopeMode,
  };
}
