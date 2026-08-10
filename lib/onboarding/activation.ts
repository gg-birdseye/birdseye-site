import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clients, getDb, type Client, type ClientCourse } from "@/lib/db";
import { isReservedCourseSlug } from "@/lib/courses/reserved-slugs";
import { slugifyCourseName } from "@/lib/onboarding/tokens";
import { resolveHoleCount } from "@/lib/onboarding/client-utils";
import {
  getClientCourses,
  updateClientCourseById,
} from "@/lib/onboarding/client-courses";
import { sendOnboardingActivationEmails } from "@/lib/email/onboarding";
import {
  createSanityCourseStub,
  deleteSanityCourseById,
  findSanityCourseIdByClientIdAndSlug,
} from "@/lib/sanity/create-course-stub";

function uniqueCourseSlug(base: string, existingSlugs: Set<string>) {
  let candidate = isReservedCourseSlug(base) ? `${base}-course` : base;
  let slug = candidate;
  let suffix = 2;
  while (existingSlugs.has(slug) || isReservedCourseSlug(slug)) {
    slug = `${candidate}-${suffix}`;
    suffix += 1;
  }
  existingSlugs.add(slug);
  return slug;
}

async function ensureClientCourseSanityStub(
  client: Client,
  course: ClientCourse,
  usedSlugs: Set<string>,
) {
  if (course.sanityCourseId) {
    return course;
  }

  const courseName = course.courseName.trim() || "New Course";
  const slugBase = slugifyCourseName(courseName) || "course";
  const courseSlug =
    course.courseSlug ??
    uniqueCourseSlug(slugBase, usedSlugs);
  const holeCount = resolveHoleCount(client, course);

  const existingSanityId = await findSanityCourseIdByClientIdAndSlug(
    client.id,
    courseSlug,
  );

  let sanityCourseId = existingSanityId;
  if (!sanityCourseId) {
    sanityCourseId = await createSanityCourseStub({
      title: courseName,
      slug: courseSlug,
      holeCount,
      clientId: client.id,
    });
  }

  const updated = await updateClientCourseById(course.id, {
    courseSlug,
    sanityCourseId,
  });

  if (courseSlug) {
    revalidatePath(`/${courseSlug}`);
  }

  return updated ?? { ...course, courseSlug, sanityCourseId };
}

export async function ensureClientSanityCourse(client: Client) {
  const courses = await getClientCourses(client.id);
  if (courses.length === 0) {
    return ensureLegacyClientSanityCourse(client);
  }

  const usedSlugs = new Set(
    courses.map((course) => course.courseSlug).filter(Boolean) as string[],
  );
  let primaryCourse = courses[0];

  for (const course of courses) {
    const updated = await ensureClientCourseSanityStub(client, course, usedSlugs);
    if (course.id === primaryCourse.id) {
      primaryCourse = updated;
    }
  }

  const db = getDb();
  const [updatedClient] = await db
    .update(clients)
    .set({
      courseSlug: primaryCourse.courseSlug,
      sanityCourseId: primaryCourse.sanityCourseId,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, client.id))
    .returning();

  revalidatePath("/courses");

  return {
    client: updatedClient ?? client,
    sanityCourseId: primaryCourse.sanityCourseId ?? null,
  };
}

async function ensureLegacyClientSanityCourse(client: Client) {
  if (client.sanityCourseId) {
    return { client, sanityCourseId: client.sanityCourseId };
  }

  const courseName = client.courseName?.trim() || "New Course";
  const slugBase = slugifyCourseName(courseName) || "course";
  const courseSlug = client.courseSlug ?? slugBase;
  const holeCount = resolveHoleCount(client);

  const existingSanityId = await findSanityCourseIdByClientIdAndSlug(
    client.id,
    courseSlug,
  );

  let sanityCourseId = existingSanityId;
  if (!sanityCourseId) {
    sanityCourseId = await createSanityCourseStub({
      title: courseName,
      slug: courseSlug,
      holeCount,
      clientId: client.id,
    });
  }

  const updated = await updateClientSanityLink(client.id, courseSlug, sanityCourseId);
  if (updated) {
    if (courseSlug) {
      revalidatePath(`/${courseSlug}`);
      revalidatePath("/courses");
    }
    return { client: updated, sanityCourseId };
  }

  const db = getDb();
  const [current] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, client.id))
    .limit(1);

  if (current?.sanityCourseId && current.sanityCourseId !== sanityCourseId) {
    try {
      await deleteSanityCourseById(sanityCourseId);
    } catch (error) {
      console.error("Failed to delete duplicate Sanity course stub:", error);
    }
  }

  return {
    client: current ?? client,
    sanityCourseId: current?.sanityCourseId ?? sanityCourseId,
  };
}

async function updateClientSanityLink(
  clientId: string,
  courseSlug: string,
  sanityCourseId: string,
) {
  const db = getDb();
  const [updated] = await db
    .update(clients)
    .set({
      courseSlug,
      sanityCourseId,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, clientId), isNull(clients.sanityCourseId)))
    .returning();

  return updated ?? null;
}

async function allSanityCoursesReady(clientId: string) {
  const courses = await getClientCourses(clientId);
  if (courses.length === 0) return false;
  return courses.every((course) => Boolean(course.sanityCourseId));
}

export async function activateClient(clientId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!existing) {
    throw new Error("Client not found.");
  }

  const courses = await getClientCourses(clientId);
  const sanityReady =
    courses.length > 0
      ? await allSanityCoursesReady(clientId)
      : Boolean(existing.sanityCourseId);

  if (
    existing.onboardingStatus === "active" &&
    existing.billingStatus === "active" &&
    sanityReady
  ) {
    return existing;
  }

  const wasAlreadyActive =
    existing.onboardingStatus === "active" && existing.billingStatus === "active";

  let sanityCourseId = existing.sanityCourseId;
  let courseSlug = existing.courseSlug;

  try {
    const result = await ensureClientSanityCourse(existing);
    sanityCourseId = result.sanityCourseId ?? sanityCourseId;
    courseSlug = result.client.courseSlug ?? courseSlug;
  } catch (error) {
    console.error("Failed to create Sanity course stub(s):", error);
  }

  const now = new Date();
  const [updated] = await db
    .update(clients)
    .set({
      onboardingStatus: "active",
      billingStatus: "active",
      paymentStatus: "paid",
      courseSlug,
      sanityCourseId,
      paidAt: existing.paidAt ?? now,
      updatedAt: now,
    })
    .where(eq(clients.id, clientId))
    .returning();

  if (courseSlug) {
    revalidatePath(`/${courseSlug}`);
  }
  revalidatePath("/courses");

  if (!wasAlreadyActive) {
    await sendOnboardingActivationEmails(updated);
  }

  return updated;
}

export async function setClientBillingStatus(
  clientId: string,
  billingStatus: Client["billingStatus"],
  extra?: {
    paymentStatus?: Client["paymentStatus"];
    onboardingStatus?: Client["onboardingStatus"];
    gracePeriodEndsAt?: Date | null;
    suspendedAt?: Date | null;
  },
) {
  const db = getDb();
  const now = new Date();

  const [updated] = await db
    .update(clients)
    .set({
      billingStatus,
      updatedAt: now,
      suspendedAt: billingStatus === "inactive" ? now : null,
      ...extra,
    })
    .where(eq(clients.id, clientId))
    .returning();

  const courseRows = await getClientCourses(clientId);
  for (const course of courseRows) {
    if (course.courseSlug) {
      revalidatePath(`/${course.courseSlug}`);
    }
  }
  if (updated?.courseSlug) {
    revalidatePath(`/${updated.courseSlug}`);
  }
  revalidatePath("/courses");

  return updated;
}
