import { readFileSync } from "node:fs";
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

const rows = await sql`
  select id, course_name, sanity_course_id, course_slug, onboarding_status
  from clients
  where sanity_course_id is not null
  order by created_at desc
`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
