import { formatPrice } from "@/lib/pricing";
import {
  TRAVEL_MOBILIZATION_FEE_LABEL,
  formatTravelMobilizationFeeLabel,
  resolveTravelMobilizationFeeCents,
} from "@/lib/pricing/travel";
import type { Client, ClientCourse } from "@/lib/db/schema";
import type { PlanInterval } from "@/lib/db/schema";

export type CourseScheduleEntry = {
  courseName: string;
  holeCount: number;
  customHoleCount?: number | null;
  courseAddressLine1?: string | null;
  courseCity?: string | null;
  courseState?: string | null;
  courseZip?: string | null;
};

export function resolveScheduleCourseEntries(
  client: Client,
  courses: ClientCourse[],
): CourseScheduleEntry[] {
  if (courses.length > 0) {
    return courses.map((course) => ({
      courseName: course.courseName,
      holeCount: course.holeCount,
      customHoleCount: course.customHoleCount,
      courseAddressLine1: course.courseAddressLine1,
      courseCity: course.courseCity,
      courseState: course.courseState,
      courseZip: course.courseZip,
    }));
  }

  return [
    {
      courseName: client.courseName ?? "Course",
      holeCount: client.holeCount ?? 18,
      customHoleCount: client.customHoleCount,
    },
  ];
}

function formatCourseLocation(entry: CourseScheduleEntry) {
  const cityState = [entry.courseCity?.trim(), entry.courseState?.trim()]
    .filter(Boolean)
    .join(", ");
  const zip = entry.courseZip?.trim();
  if (cityState && zip) return `${cityState} ${zip}`;
  return cityState || zip || entry.courseAddressLine1?.trim() || "";
}

export function formatScheduleCourseLine(
  entry: CourseScheduleEntry,
  index: number,
) {
  const holes = entry.customHoleCount ?? entry.holeCount;
  const location = formatCourseLocation(entry);
  const locationSuffix = location ? ` — ${location}` : "";
  return `${index + 1}. ${entry.courseName} — ${holes} holes${locationSuffix}`;
}

export function getScheduleACoursesIntro(courseCount: number) {
  if (courseCount > 1) {
    return [
      "Schedule A — Courses Included in Subscription",
      "",
      "The following golf courses are expressly included in Client's single Subscription under this Agreement. Birdseye shall provide the Platform, hosting, production, and related Services for each listed course only:",
      "",
    ];
  }

  return [
    "Schedule A — Course Included in Subscription",
    "",
    "The following golf course is included in Client's Subscription under this Agreement:",
    "",
  ];
}

export function getScheduleACoursesScopeNote(courseCount: number) {
  if (courseCount > 1) {
    return "Any course or facility not listed above is not included in this Subscription unless added by a written amendment signed by both parties.";
  }

  return "Services apply to the course listed above only unless expanded by a written amendment signed by both parties.";
}

/** Course list block only — maps to DocuSign merge field `ScheduleA_Courses`. */
export function formatScheduleACoursesBlock(
  client: Client,
  courses: ClientCourse[],
) {
  const scheduleCourses = resolveScheduleCourseEntries(client, courses);
  const courseLines = scheduleCourses.map((entry, index) =>
    formatScheduleCourseLine(entry, index),
  );

  return [
    ...getScheduleACoursesIntro(scheduleCourses.length),
    ...courseLines,
    "",
    getScheduleACoursesScopeNote(scheduleCourses.length),
  ].join("\n");
}

/** Plain-text Schedule A block for contracts / DocuSign merge fields. */
export function formatScheduleAText(
  client: Client,
  courses: ClientCourse[],
  plan: PlanInterval,
  options?: { includeTravelFee?: boolean },
) {
  const scheduleCourses = resolveScheduleCourseEntries(client, courses);
  const courseLines = scheduleCourses.map((entry, index) =>
    formatScheduleCourseLine(entry, index),
  );

  const org = client.organizationName?.trim() || client.courseName || "Client";
  const subtotal = client.quotedSubtotalCents
    ? formatPrice(client.quotedSubtotalCents / 100)
    : "See agreement";
  const discount =
    client.multiCourseDiscountCents && client.multiCourseDiscountCents > 0
      ? `${formatPrice(client.multiCourseDiscountCents / 100)} (${client.multiCourseDiscountPercent}% multi-course discount)`
      : null;
  const total = client.customPriceCents
    ? formatPrice(client.customPriceCents / 100)
    : client.quotedSubtotalCents && client.multiCourseDiscountCents
      ? formatPrice(
          (client.quotedSubtotalCents - client.multiCourseDiscountCents) / 100,
        )
      : subtotal;

  return [
    `Organization: ${org}`,
    "",
    ...getScheduleACoursesIntro(scheduleCourses.length),
    ...courseLines,
    "",
    getScheduleACoursesScopeNote(scheduleCourses.length),
    "",
    `Billing interval: ${plan === "monthly" ? "Monthly" : "Annual"}`,
    `Subtotal: ${subtotal}`,
    ...(discount ? [`Multi-course discount: ${discount}`] : []),
    `Total subscription fee: ${total}`,
    ...(options?.includeTravelFee !== false &&
    resolveTravelMobilizationFeeCents(client) > 0
      ? [
          `${TRAVEL_MOBILIZATION_FEE_LABEL} (one-time, due with initial payment): ${formatTravelMobilizationFeeLabel()}`,
        ]
      : []),
  ].join("\n");
}
