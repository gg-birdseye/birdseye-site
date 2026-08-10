import { createHash, createPrivateKey } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { getDocuSignAccessToken } from "@/lib/docusign/auth";
import {
  getDocuSignConfig,
  normalizeDocuSignPrivateKey,
} from "@/lib/docusign/config";

function maskGuid(value: string | undefined) {
  const v = value?.trim() || "";
  if (!v) return null;
  if (v.length < 12) return { length: v.length, masked: "(too short)" };
  return {
    length: v.length,
    masked: `${v.slice(0, 8)}…${v.slice(-4)}`,
    looksLikeGuid:
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        v,
      ),
  };
}

/** Admin-only: show masked DocuSign config + live JWT auth test (no secrets). */
export async function GET() {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envRaw = process.env.DOCUSIGN_ENV?.trim() || "(unset)";
  const config = getDocuSignConfig();
  const privateKeyRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim() || "";
  const privateKey = privateKeyRaw
    ? normalizeDocuSignPrivateKey(privateKeyRaw)
    : "";

  let rsa: Record<string, unknown> = { present: false };
  if (privateKey) {
    rsa = {
      present: true,
      length: privateKey.length,
      hasBegin: privateKey.includes("BEGIN"),
      hasEnd: privateKey.includes("END"),
      hasPrivateKey: privateKey.includes("PRIVATE KEY"),
    };
    try {
      const keyObject = createPrivateKey(privateKey);
      const der = keyObject.export({ type: "pkcs8", format: "der" });
      rsa.parses = true;
      rsa.fingerprint16 = createHash("sha256")
        .update(der)
        .digest("hex")
        .slice(0, 16);
    } catch (error) {
      rsa.parses = false;
      rsa.parseError = error instanceof Error ? error.message : String(error);
    }
  }

  const summary = {
    DOCUSIGN_ENV: envRaw,
    treatsAsProduction: envRaw === "production",
    oauthHost: config
      ? new URL(config.oauthBaseUrl).host
      : envRaw === "production"
        ? "account.docusign.com"
        : "account-d.docusign.com",
    apiBaseUrl: config?.apiBaseUrl ?? null,
    configured: Boolean(config),
    envelopeMode: config?.envelopeMode ?? null,
    integrationKey: maskGuid(process.env.DOCUSIGN_INTEGRATION_KEY),
    userId: maskGuid(process.env.DOCUSIGN_USER_ID),
    accountId: maskGuid(process.env.DOCUSIGN_ACCOUNT_ID),
    rsa,
  };

  if (!config) {
    return NextResponse.json({
      ...summary,
      authTest: { ok: false, error: "DocuSign is not configured (missing required env)." },
    });
  }

  try {
    await getDocuSignAccessToken();
    return NextResponse.json({
      ...summary,
      authTest: { ok: true },
    });
  } catch (error) {
    return NextResponse.json({
      ...summary,
      authTest: {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
