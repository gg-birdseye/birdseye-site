import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseUnavailable } from "@/components/CourseUnavailable";
import { ExampleCourseView } from "@/components/ExampleCourseView";
import { JsonLd } from "@/components/JsonLd";
import { getCourseAccessBySlug } from "@/lib/billing/access";
import {
  courseAerialMap,
  courseContactInfo,
  courseHasPlayableVideo,
  courseHoleDescriptions,
  courseHolePlaybacks,
  courseLogoSrc,
  coursePagePanels,
  coursePrimaryPlayback,
  courseScorecardData,
  courseSeoOgImageSrc,
  getCourseBySlug,
} from "@/lib/sanity/courses";
import { courseHoleGraphicsWithMasks } from "@/lib/sanity/course-hole-graphics-server";
import { buildGolfCourseJsonLd } from "@/lib/seo/course-json-ld";
import { resolveCourseSeo } from "@/lib/seo/course-meta";
import { absoluteUrl } from "@/lib/seo/site";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

function courseOgImage(
  seoImage: string | undefined,
  posterUrl: string | undefined,
  logoUrl: string | undefined,
): string | undefined {
  return seoImage ?? posterUrl ?? logoUrl;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) {
    return {
      title: "Course | BirdsEye",
      robots: { index: false, follow: false },
    };
  }

  const courseName = course.title?.trim() || "Course";
  const access = await getCourseAccessBySlug(slug);
  if (!access.allowed || !courseHasPlayableVideo(course)) {
    return {
      title: `${courseName} | BirdsEye`,
      robots: { index: false, follow: false },
    };
  }

  const { metaTitle, metaDescription } = resolveCourseSeo({
    title: course.title,
    city: course.address?.city,
    state: course.address?.state,
    seo: course.seo,
  });
  const primary = coursePrimaryPlayback(course, 1);
  const image = courseOgImage(
    courseSeoOgImageSrc(course),
    primary?.posterUrl,
    courseLogoSrc(course),
  );
  const canonicalPath = `/courses/${slug}`;

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      type: "website",
      url: canonicalPath,
      siteName: "Birdseye",
      ...(image ? { images: [{ url: image, alt: courseName }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: metaTitle,
      description: metaDescription,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const access = await getCourseAccessBySlug(slug);
  if (!access.allowed) {
    return <CourseUnavailable reason={access.reason} />;
  }

  const course = await getCourseBySlug(slug);
  if (!course || !course.slug) notFound();
  if (!courseHasPlayableVideo(course)) notFound();

  const holePlaybacks = courseHolePlaybacks(course);
  const holeGraphics = await courseHoleGraphicsWithMasks(course);
  const primary = coursePrimaryPlayback(course, 1);
  if (!primary) notFound();

  const title = course.title?.trim() || "Course";
  const { metaDescription } = resolveCourseSeo({
    title: course.title,
    city: course.address?.city,
    state: course.address?.state,
    seo: course.seo,
  });
  const image = courseOgImage(
    courseSeoOgImageSrc(course),
    primary.posterUrl,
    courseLogoSrc(course) ?? undefined,
  );
  const pageUrl = absoluteUrl(`/courses/${slug}`);

  return (
    <>
      <JsonLd
        data={buildGolfCourseJsonLd({
          course,
          url: pageUrl,
          image,
          description: metaDescription,
        })}
      />
      <Suspense fallback={<div className="min-h-screen bg-[#1a1814]" />}>
        <ExampleCourseView
          courseTitle={title}
          holeCount={course.holeCount ?? 18}
          holeVideos={holePlaybacks}
          videoSrc={primary.videoSrc}
          fallbackVideoSrc={primary.fallbackVideoSrc}
          posterUrl={primary.posterUrl}
          hideLegacyChrome
          videoLogoSrc={courseLogoSrc(course) ?? undefined}
          pagePanels={coursePagePanels(course)}
          scorecardData={courseScorecardData(course, course.holeCount ?? 18)}
          aerialMap={courseAerialMap(course)}
          holeGraphics={holeGraphics}
          contact={courseContactInfo(course)}
          holeDescriptions={courseHoleDescriptions(course)}
        />
      </Suspense>
    </>
  );
}
