export type CourseAnalyticsParams = {
  course_slug?: string;
  course_title?: string;
  [key: string]: string | number | boolean | undefined;
};

/**
 * Fire a GA4 custom event. No-ops when the measurement ID is unset or GA
 * has not initialized yet (e.g. local without env, or before the script loads).
 */
export function trackEvent(
  eventName: string,
  params: CourseAnalyticsParams = {},
): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()) return;

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    cleaned[key] = value;
  }

  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, cleaned);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(["event", eventName, cleaned]);
    }
  } catch {
    // Ignore analytics failures — never block UI interactions.
  }
}

export function trackCourseEvent(
  eventName: string,
  course: { slug?: string | null; title?: string | null },
  params: Omit<CourseAnalyticsParams, "course_slug" | "course_title"> = {},
): void {
  trackEvent(eventName, {
    ...params,
    course_slug: course.slug?.trim() || undefined,
    course_title: course.title?.trim() || undefined,
  });
}
