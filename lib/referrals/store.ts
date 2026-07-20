import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { clientCourses, clients, getDb, referrals, withDbRetry } from "@/lib/db";
import type { NewReferral, Referral } from "@/lib/db/schema";
import {
  REFERRAL_VERIFY_WINDOW_DAYS,
  courseKeyFor,
} from "@/lib/referrals/domain";

const ACTIVE_STATUSES = ["pending_verify", "qualified", "won"] as const;

function verifyWindowCutoff(): Date {
  return new Date(Date.now() - REFERRAL_VERIFY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Auto-release pending_verify claims older than the verify window so a stale
 * (never-verified) claim can't hold a course forever. Runs lazily before
 * dedupe checks — no cron needed.
 */
export async function releaseExpiredClaims() {
  const db = getDb();
  await db
    .update(referrals)
    .set({
      status: "released",
      releaseReason: "verification_window_expired",
      releasedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(referrals.status, "pending_verify"),
        lt(referrals.createdAt, verifyWindowCutoff()),
      ),
    );
}

export async function findActiveClaimForCourse(courseKey: string) {
  const db = getDb();
  const [claim] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.courseKey, courseKey),
        inArray(referrals.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1);
  return claim ?? null;
}

export async function countActiveReferralsForEmail(email: string) {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerEmail, email),
        inArray(referrals.status, ["pending_verify", "qualified"]),
      ),
    );
  return row?.count ?? 0;
}

/** True when the referred course is already a Birdseye client or in the pipeline. */
export async function isExistingCustomerCourse(
  courseName: string,
  city: string,
  state: string,
) {
  const db = getDb();
  const key = courseKeyFor(courseName, city, state);
  const nameOnly = key.split("|")[0];

  const clientRows = await db
    .select({ name: clients.courseName })
    .from(clients);
  const courseRows = await db
    .select({ name: clientCourses.courseName })
    .from(clientCourses);

  const names = [...clientRows, ...courseRows]
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));

  return names.some(
    (name) => courseKeyFor(name, "", "").split("|")[0] === nameOnly,
  );
}

export async function createReferral(values: NewReferral): Promise<Referral> {
  const db = getDb();
  const [created] = await db.insert(referrals).values(values).returning();
  return created;
}

export async function listReferrals() {
  return withDbRetry(async () => {
    const db = getDb();
    return db.select().from(referrals).orderBy(desc(referrals.createdAt));
  });
}

export async function getReferralById(id: string) {
  const db = getDb();
  const [referral] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.id, id))
    .limit(1);
  return referral ?? null;
}

export async function updateReferral(
  id: string,
  values: Partial<NewReferral>,
): Promise<Referral | null> {
  const db = getDb();
  const [updated] = await db
    .update(referrals)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(referrals.id, id))
    .returning();
  return updated ?? null;
}
