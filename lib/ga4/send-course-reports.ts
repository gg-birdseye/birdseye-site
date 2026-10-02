import { eq } from "drizzle-orm";
import { clientCourses, clients, getDb, isDatabaseConfigured } from "@/lib/db";
import { recipientEmails } from "@/lib/email/billing-notifications";
import { lastCalendarMonth, lastNDays, parseYmd, type DateRange } from "@/lib/ga4/dates";
import { fetchCourseAnalyticsReport } from "@/lib/ga4/course-report";
import { sendCourseAnalyticsReportEmail } from "@/lib/email/course-analytics-report";
import { getCourseBySlug, getCoursesList } from "@/lib/sanity/courses";

export type CourseReportRecipient = {
  slug: string;
  title: string;
  emails: string[];
  contactName: string | null;
};

type SanityCourseRef = {
  slug: string;
  title: string;
};

type CourseSlugSource = {
  courseSlug?: string | null;
  sanityCourseId?: string | null;
  courseName?: string | null;
};

export function parseReportRange(input: {
  startDate?: string | null;
  endDate?: string | null;
  preset?: string | null;
}): DateRange {
  if (input.preset === "last_month") return lastCalendarMonth();
  if (input.startDate && input.endDate) {
    const start = parseYmd(input.startDate);
    const end = parseYmd(input.endDate);
    if (start && end && start.getTime() <= end.getTime()) {
      return { startDate: input.startDate, endDate: input.endDate };
    }
  }
  return lastNDays(30);
}

export async function listReportableCourses(): Promise<
  { slug: string; title: string }[]
> {
  const courses = await getCoursesList();
  return courses
    .filter((course) => Boolean(course.slug))
    .map((course) => ({
      slug: course.slug as string,
      title: course.title?.trim() || (course.slug as string),
    }));
}

async function loadSanityCourseIndexes() {
  const courses = await getCoursesList();
  const byId = new Map<string, SanityCourseRef>();
  const bySlug = new Map<string, SanityCourseRef>();
  const byTitle = new Map<string, SanityCourseRef>();

  for (const course of courses) {
    const slug = course.slug?.trim();
    if (!slug) continue;
    const ref: SanityCourseRef = {
      slug,
      title: course.title?.trim() || slug,
    };
    if (course._id) byId.set(course._id, ref);
    bySlug.set(slug, ref);
    byTitle.set(ref.title.toLowerCase(), ref);
  }

  return { byId, bySlug, byTitle };
}

/**
 * Prefer the live Sanity page slug for GA4 pagePath filters. Client DB slugs can
 * drift from published URLs (e.g. the-ledges vs /ledges).
 */
export function resolveAnalyticsCourseSlug(
  source: CourseSlugSource,
  indexes: Awaited<ReturnType<typeof loadSanityCourseIndexes>>,
): SanityCourseRef | null {
  const sanityId = source.sanityCourseId?.trim();
  if (sanityId) {
    const fromId = indexes.byId.get(sanityId);
    if (fromId) return fromId;
  }

  const storedSlug = source.courseSlug?.trim();
  if (storedSlug) {
    const fromSlug = indexes.bySlug.get(storedSlug);
    if (fromSlug) return fromSlug;
  }

  const name = source.courseName?.trim().toLowerCase();
  if (name) {
    const fromTitle = indexes.byTitle.get(name);
    if (fromTitle) return fromTitle;
  }

  if (storedSlug) {
    return {
      slug: storedSlug,
      title: source.courseName?.trim() || storedSlug,
    };
  }

  return null;
}

export async function resolveCourseReportRecipient(
  slug: string,
): Promise<CourseReportRecipient> {
  const course = await getCourseBySlug(slug);
  const title = course?.title?.trim() || slug;
  if (!isDatabaseConfigured()) {
    return { slug, title, emails: [], contactName: null };
  }

  const db = getDb();
  const indexes = await loadSanityCourseIndexes();
  const canonical = indexes.bySlug.get(slug);
  const sanityId = course?._id ?? null;

  const [legacy] = await db
    .select()
    .from(clients)
    .where(eq(clients.courseSlug, slug))
    .limit(1);

  if (legacy) {
    return {
      slug,
      title: legacy.courseName?.trim() || title,
      emails: recipientEmails(legacy),
      contactName: legacy.contactName,
    };
  }

  const [linked] = await db
    .select({ client: clients })
    .from(clientCourses)
    .innerJoin(clients, eq(clientCourses.clientId, clients.id))
    .where(eq(clientCourses.courseSlug, slug))
    .limit(1);

  if (linked?.client) {
    return {
      slug,
      title: linked.client.courseName?.trim() || title,
      emails: recipientEmails(linked.client),
      contactName: linked.client.contactName,
    };
  }

  // Client rows may store a non-canonical slug; match via Sanity id / title.
  const rows = await db.select().from(clients);
  for (const client of rows) {
    const emails = recipientEmails(client);
    if (emails.length === 0) continue;

    if (sanityId && client.sanityCourseId === sanityId) {
      return {
        slug,
        title: client.courseName?.trim() || title,
        emails,
        contactName: client.contactName,
      };
    }

    const linkedCourses = await db
      .select()
      .from(clientCourses)
      .where(eq(clientCourses.clientId, client.id));

    if (sanityId && linkedCourses.some((row) => row.sanityCourseId === sanityId)) {
      return {
        slug,
        title: client.courseName?.trim() || title,
        emails,
        contactName: client.contactName,
      };
    }

    const sources: CourseSlugSource[] = [
      ...linkedCourses,
      {
        courseSlug: client.courseSlug,
        sanityCourseId: client.sanityCourseId,
        courseName: client.courseName,
      },
    ];
    for (const source of sources) {
      const resolved = resolveAnalyticsCourseSlug(source, indexes);
      if (resolved?.slug === slug || (canonical && resolved?.slug === canonical.slug)) {
        return {
          slug,
          title: resolved.title || client.courseName?.trim() || title,
          emails,
          contactName: client.contactName,
        };
      }
    }
  }

  return { slug, title, emails: [], contactName: null };
}

export async function listMonthlyReportJobs(): Promise<CourseReportRecipient[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getDb();
  const rows = await db.select().from(clients);
  const indexes = await loadSanityCourseIndexes();
  const jobs = new Map<string, CourseReportRecipient>();

  for (const client of rows) {
    if (client.billingStatus !== "active" && client.onboardingStatus !== "active") {
      continue;
    }
    const emails = recipientEmails(client);
    if (emails.length === 0) continue;

    const linked = await db
      .select()
      .from(clientCourses)
      .where(eq(clientCourses.clientId, client.id));

    const sources: CourseSlugSource[] = [
      ...linked.map((course) => ({
        courseSlug: course.courseSlug,
        sanityCourseId: course.sanityCourseId,
        courseName: course.courseName,
      })),
      {
        courseSlug: client.courseSlug,
        sanityCourseId: client.sanityCourseId,
        courseName: client.courseName,
      },
    ];

    for (const source of sources) {
      const resolved = resolveAnalyticsCourseSlug(source, indexes);
      if (!resolved || jobs.has(resolved.slug)) continue;
      jobs.set(resolved.slug, {
        slug: resolved.slug,
        title: resolved.title || client.courseName?.trim() || resolved.slug,
        emails,
        contactName: client.contactName,
      });
    }
  }

  return [...jobs.values()];
}

export async function buildAndSendCourseReport(options: {
  slug: string;
  range: DateRange;
  to?: string[];
}) {
  const recipient = await resolveCourseReportRecipient(options.slug);
  const to = options.to?.length ? options.to : recipient.emails;
  if (to.length === 0) {
    throw new Error(`No email recipients for /${options.slug}.`);
  }

  const report = await fetchCourseAnalyticsReport({
    slug: options.slug,
    title: recipient.title,
    range: options.range,
  });

  await sendCourseAnalyticsReportEmail({
    report,
    to,
    greetingName: recipient.contactName,
  });

  return { report, to, recipient };
}
