import { readFileSync } from "node:fs";
import { createClient } from "next-sanity";

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: node scripts/delete-sanity-courses.mjs <documentId> [documentId...]");
  process.exit(1);
}

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const token = process.env.SANITY_API_WRITE_TOKEN;
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

if (!token || !projectId || !dataset) {
  console.error("Missing Sanity env vars");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2024-01-01",
  token,
  useCdn: false,
});

for (const id of ids) {
  const doc = await client.fetch(
    `*[_id == $id][0]{ _id, title, "slug": slug.current, clientId }`,
    { id },
  );
  if (!doc) {
    console.warn(`Not found: ${id}`);
    continue;
  }
  await client.delete(id);
  console.log(`Deleted: ${doc.title ?? id} (${doc.slug ?? "no slug"}) clientId=${doc.clientId ?? "none"}`);
}
