import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import dns from "node:dns";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type DbGlobal = {
  dbInstance?: PostgresJsDatabase<typeof schema>;
  sql?: Sql;
};

const globalForDb = globalThis as typeof globalThis & DbGlobal;

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function resetDbConnection() {
  const devSql = globalForDb.sql;
  globalForDb.dbInstance = undefined;
  globalForDb.sql = undefined;
  dbInstance = null;

  if (devSql) {
    try {
      await devSql.end({ timeout: 1 });
    } catch {
      // Ignore errors while closing a stale client.
    }
  }
}

function isRecoverableDbError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const cause =
    "cause" in error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${error.message} ${cause}`.toLowerCase();

  return (
    combined.includes("emaxconnsession") ||
    combined.includes("statement timeout") ||
    combined.includes("connection") ||
    combined.includes("econnreset") ||
    combined.includes("failed query")
  );
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 1) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isRecoverableDbError(error)) {
      await resetDbConnection();
      return withDbRetry(fn, retries - 1);
    }
    throw error;
  }
}

export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  // Reuse a single client across Next.js dev hot reloads to avoid exhausting Supabase pool limits.
  if (process.env.NODE_ENV === "development") {
    if (!globalForDb.dbInstance) {
      globalForDb.sql = createPostgresClient();
      globalForDb.dbInstance = drizzle(globalForDb.sql, { schema });
    }
    return globalForDb.dbInstance;
  }

  if (!dbInstance) {
    const sql = createPostgresClient();
    dbInstance = drizzle(sql, { schema });
  }

  return dbInstance;
}

function createPostgresClient() {
  dns.setDefaultResultOrder("ipv6first");

  // Supabase transaction pooler (port 6543) — required for serverless / Next.js dev.
  return postgres(process.env.DATABASE_URL!, {
    prepare: false,
    ssl: "require",
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 5,
  });
}

export * from "./schema";
