import dns from "node:dns";
import postgres from "postgres";
import { readFileSync } from "node:fs";

dns.setDefaultResultOrder("ipv6first");

const env = readFileSync(".env.local", "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
const directUrl = match?.[1]?.trim();

const projectRef = "kjwsgmzdzfpxfsycgnib";
const passwords = ["Sxaviorm51%21", "Sxaviorm51%25", "Sxaviorm1%21"];
const regions = ["us-east-1", "us-west-1", "eu-west-1", "ap-southeast-1"];

async function tryConnect(label, url) {
  const sql = postgres(url, { prepare: false, ssl: "require", connect_timeout: 5 });
  try {
    const result = await sql`select 1 as ok`;
    console.log(`OK  ${label}`, result);
    await sql.end();
    return true;
  } catch (error) {
    console.log(`FAIL ${label}:`, error.message);
    await sql.end({ timeout: 1 }).catch(() => {});
    return false;
  }
}

console.log("Testing direct URL from .env.local...");
if (directUrl) {
  await tryConnect("direct", directUrl);
}

for (const region of regions) {
  for (const password of passwords) {
    const poolerUrl = `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    const ok = await tryConnect(`pooler-${region}-${password}`, poolerUrl);
    if (ok) process.exit(0);
  }
}

console.log("No working connection found.");
