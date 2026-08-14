import "server-only";

import {
  courseHoleGraphics,
  type CourseDoc,
  type HoleGraphicEntry,
} from "@/lib/sanity/courses";

/**
 * Hole graphics for the course page. Arc path precompute was removed when
 * yardage arcs were replaced by the interactive landing-zone ruler.
 */
export async function courseHoleGraphicsForPage(
  course: CourseDoc | null,
): Promise<HoleGraphicEntry[]> {
  return courseHoleGraphics(course);
}
