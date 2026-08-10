import type { MetadataRoute } from "next";
import { getInactiveCourseSlugs } from "@/lib/billing/access";
import {
  courseHasPlayableVideo,
  getCoursesList,
} from "@/lib/sanity/courses";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/courses"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/refer"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    const [courses, inactiveSlugs] = await Promise.all([
      getCoursesList(),
      getInactiveCourseSlugs(),
    ]);

    const courseEntries: MetadataRoute.Sitemap = courses
      .filter(
        (course) =>
          Boolean(course.slug) &&
          courseHasPlayableVideo(course) &&
          !inactiveSlugs.has(course.slug as string),
      )
      .map((course) => ({
        url: absoluteUrl(`/${course.slug}`),
        lastModified: course._updatedAt
          ? new Date(course._updatedAt)
          : now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));

    return [...staticEntries, ...courseEntries];
  } catch (error) {
    console.error("Sitemap course listing failed:", error);
    return staticEntries;
  }
}
