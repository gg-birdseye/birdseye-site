/** Top-level App Router segments that must not be used as course slugs. */
export const RESERVED_COURSE_SLUGS = new Set([
  "admin",
  "api",
  "courses",
  "onboarding",
  "pricing",
  "refer",
  "studio",
  "sitemap.xml",
  "robots.txt",
]);

export function isReservedCourseSlug(slug: string | null | undefined): boolean {
  const value = slug?.trim().toLowerCase();
  if (!value) return false;
  return RESERVED_COURSE_SLUGS.has(value);
}
