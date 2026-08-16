import type { Metadata } from "next";
import { CourseThumbnailGrid } from "@/components/CourseThumbnailGrid";
import { SiteLogoHeader } from "@/components/SiteLogoHeader";
import { getInactiveCourseSlugs } from "@/lib/billing/access";
import {
  courseIsPubliclyIndexable,
  getCoursesList,
} from "@/lib/sanity/courses";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Golf Courses | BirdsEye",
  description:
    "Browse interactive aerial golf course previews on Birdseye — fly each hole before you play.",
  alternates: { canonical: "/courses" },
  openGraph: {
    title: "Golf Courses | BirdsEye",
    description:
      "Browse interactive aerial golf course previews on Birdseye — fly each hole before you play.",
    type: "website",
    url: "/courses",
    siteName: "Birdseye",
  },
};

export default async function CoursesIndexPage() {
  const courses = await getCoursesList();
  const inactiveSlugs = await getInactiveCourseSlugs();
  const withVideo = courses.filter(
    (c) =>
      courseIsPubliclyIndexable(c) &&
      Boolean(c.slug) &&
      !inactiveSlugs.has(c.slug as string),
  );

  return (
    <div className="min-h-screen bg-birdseye-950">
      <SiteLogoHeader />

      <div className="site-logo-page-content mx-auto max-w-5xl px-4 pb-24 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          GOLF COURSES
        </h1>
        <p className="mt-3 text-stone-400">
          Select a course to preview
        </p>

        <CourseThumbnailGrid courses={withVideo} />
      </div>
    </div>
  );
}
