import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

function base64Url(input) {
  const value = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeKey(raw) {
  let key = (raw || "").trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  key = key.replace(/(-----BEGIN [A-Z0-9 ]+-----)\s*/i, "$1\n");
  key = key.replace(/\s*(-----END [A-Z0-9 ]+-----)/i, "\n$1");
  return key.trim();
}

function assertion(iss, sub, aud, privateKey) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss,
      sub,
      aud,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(privateKey))}`;
}

const iss = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
const sub = process.env.DOCUSIGN_USER_ID?.trim();
const key = normalizeKey(process.env.DOCUSIGN_RSA_PRIVATE_KEY || "");

console.log("DOCUSIGN_ENV=", process.env.DOCUSIGN_ENV || "(unset)");
console.log("integrationKey set:", Boolean(iss));
console.log("userId set:", Boolean(sub));
console.log("userId looks like guid:", /^[0-9a-f-]{36}$/i.test(sub || ""));
console.log("pem has BEGIN:", key.includes("BEGIN"));

for (const host of ["account-d.docusign.com", "account.docusign.com"]) {
  try {
    const jwt = assertion(iss, sub, host, key);
    const res = await fetch(`https://${host}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const json = await res.json();
    console.log(
      host + ":",
      res.status,
      json.error || "ok",
      json.error_description || (json.access_token ? "access_token received" : ""),
    );
  } catch (error) {
    console.log(
      host + ": exception",
      error instanceof Error ? error.message : String(error),
    );
  }
}
