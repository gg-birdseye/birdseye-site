import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const migrationsDir = join(process.cwd(), "lib/db/migrations");
const pendingOnly = process.argv.includes("--pending-only");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .filter((name) => !pendingOnly || Number(name.slice(0, 4)) >= 5);

try {
  for (const file of files) {
    const contents = readFileSync(join(migrationsDir, file), "utf8");
    const statements = contents
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.unsafe(`${statement};`);
    }
    console.log(`Applied ${file}`);
  }
  console.log("All migrations applied.");
} finally {
  await sql.end();
}
