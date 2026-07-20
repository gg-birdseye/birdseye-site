import { readFileSync } from "node:fs";
import { createClient } from "next-sanity";

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

const courses = await client.fetch(
  `*[_type == "course"] | order(_createdAt asc) {
    _id,
    title,
    slug,
    clientId,
    _createdAt
  }`,
);

console.log(JSON.stringify(courses, null, 2));
console.log(`\nTotal: ${courses.length}`);
