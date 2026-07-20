import { readFileSync } from "node:fs";
import { createClient } from "next-sanity";
import postgres from "postgres";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  ssl: "require",
  max: 1,
});

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
});

const clients = await sql`
  select id, course_name, sanity_course_id, course_slug
  from clients
  where sanity_course_id is not null
`;

const existingIds = new Set(
  await sanity.fetch(`*[_type == "course"]._id`),
);

const stale = clients.filter((c) => !existingIds.has(c.sanity_course_id));

if (stale.length === 0) {
  console.log("No stale Sanity links found.");
  await sql.end();
  process.exit(0);
}

console.log("Clearing stale links for:");
for (const client of stale) {
  console.log(
    `- ${client.course_name} (${client.id}) sanity=${client.sanity_course_id} slug=${client.course_slug}`,
  );
}

const staleIds = stale.map((c) => c.id);
await sql`
  update clients
  set
    sanity_course_id = null,
    course_slug = null,
    updated_at = now()
  where id = any(${staleIds})
`;

console.log(`\nUpdated ${stale.length} client(s).`);
await sql.end();
