import { eq } from "drizzle-orm";
import { clients, getDb, isDatabaseConfigured } from "@/lib/db";
import { getClientCoursesBySlug } from "@/lib/onboarding/client-courses";

export type CourseAccessResult =
  | { allowed: true }
  | { allowed: false; reason: "inactive" | "past_due" };

async function getBillingForSlug(slug: string) {
  const db = getDb();

  const linked = await getClientCoursesBySlug(slug);
  if (linked) {
    const [client] = await db
      .select({
        billingStatus: clients.billingStatus,
        contentAccessOverride: clients.contentAccessOverride,
      })
      .from(clients)
      .where(eq(clients.id, linked.clientId))
      .limit(1);
    return client ?? null;
  }

  const [client] = await db
    .select({
      billingStatus: clients.billingStatus,
      contentAccessOverride: clients.contentAccessOverride,
    })
    .from(clients)
    .where(eq(clients.courseSlug, slug))
    .limit(1);

  return client ?? null;
}

export async function getCourseAccessBySlug(
  slug: string,
): Promise<CourseAccessResult> {
  if (!isDatabaseConfigured()) {
    return { allowed: true };
  }

  try {
    const client = await getBillingForSlug(slug);

    if (!client) {
      return { allowed: true };
    }

    if (client.contentAccessOverride) {
      return { allowed: true };
    }

    if (client.billingStatus === "active") {
      return { allowed: true };
    }

    if (client.billingStatus === "past_due") {
      return { allowed: false, reason: "past_due" };
    }

    return { allowed: false, reason: "inactive" };
  } catch (error) {
    console.error("Course access lookup failed:", error);
    return { allowed: true };
  }
}

export async function getInactiveCourseSlugs(): Promise<Set<string>> {
  if (!isDatabaseConfigured()) {
    return new Set();
  }

  try {
    const db = getDb();
    const legacyRows = await db
      .select({
        courseSlug: clients.courseSlug,
        billingStatus: clients.billingStatus,
        contentAccessOverride: clients.contentAccessOverride,
      })
      .from(clients)
      .where(eq(clients.contentAccessOverride, false));

    const { clientCourses } = await import("@/lib/db");
    const multiRows = await db
      .select({
        courseSlug: clientCourses.courseSlug,
        billingStatus: clients.billingStatus,
        contentAccessOverride: clients.contentAccessOverride,
      })
      .from(clientCourses)
      .innerJoin(clients, eq(clientCourses.clientId, clients.id))
      .where(eq(clients.contentAccessOverride, false));

    const blocked = [...legacyRows, ...multiRows]
      .filter((row) => row.courseSlug && row.billingStatus !== "active")
      .map((row) => row.courseSlug as string);

    return new Set(blocked);
  } catch (error) {
    console.error("Inactive course slug lookup failed:", error);
    return new Set();
  }
}
