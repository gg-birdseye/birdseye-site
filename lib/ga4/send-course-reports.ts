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

export async function resolveCourseReportRecipient(
  slug: string,
): Promise<CourseReportRecipient> {
  const course = await getCourseBySlug(slug);
  const title = course?.title?.trim() || slug;
  if (!isDatabaseConfigured()) {
    return { slug, title, emails: [], contactName: null };
  }

  const db = getDb();
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

  return { slug, title, emails: [], contactName: null };
}

export async function listMonthlyReportJobs(): Promise<CourseReportRecipient[]> {
  if (!isDatabaseConfigured()) return [];

  const db = getDb();
  const rows = await db.select().from(clients);
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

    const slugs = [
      ...linked
        .map((course) => course.courseSlug?.trim())
        .filter((value): value is string => Boolean(value)),
      ...(client.courseSlug?.trim() ? [client.courseSlug.trim()] : []),
    ];

    for (const slug of [...new Set(slugs)]) {
      if (jobs.has(slug)) continue;
      jobs.set(slug, {
        slug,
        title: client.courseName?.trim() || slug,
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
