import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseEmbedWidget } from "@/components/CourseEmbedWidget";
import { getCourseAccessBySlug } from "@/lib/billing/access";
import { isReservedCourseSlug } from "@/lib/courses/reserved-slugs";
import {
  pickEmbedHole,
  type CourseEmbedHole,
} from "@/lib/embed";
import { muxAnimatedPreviewUrl } from "@/lib/mux";
import {
  courseHasPlayableVideo,
  courseHolePlaybacks,
  courseLogoSrc,
  courseScorecardData,
  getCourseBySlug,
} from "@/lib/sanity/courses";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = isReservedCourseSlug(slug)
    ? null
    : await getCourseBySlug(slug);
  const title = course?.title?.trim() || "Course";

  return {
    title: `${title} flyovers embed | Birdseye`,
    robots: { index: false, follow: false },
  };
}

function holePar(
  pars: string[] | undefined,
  holeNumber: number,
): number {
  const raw = pars?.[holeNumber]?.trim();
  if (!raw || raw === "—" || raw === "-") return 4;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 4;
}

export default async function CourseEmbedPage({ params }: Props) {
  const { slug } = await params;
  if (isReservedCourseSlug(slug)) notFound();

  const access = await getCourseAccessBySlug(slug);
  if (!access.allowed) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-[#0a120e] px-6 text-center text-sm text-stone-400">
        This course preview is temporarily unavailable.
      </div>
    );
  }

  const course = await getCourseBySlug(slug);
  if (!course || !course.slug || !courseHasPlayableVideo(course)) notFound();

  const holeCount = course.holeCount ?? 18;
  const scorecard = courseScorecardData(course, holeCount);
  const primaryPars = scorecard.tees[0]?.pars;
  const playbacks = courseHolePlaybacks(course);
  const selected = pickEmbedHole(playbacks, (hole) => Boolean(hole.holeGraphic));
  if (!selected) notFound();

  const hole: CourseEmbedHole = {
    holeNumber: selected.holeNumber,
    posterUrl: selected.posterUrl,
    playbackId: selected.playbackId,
    previewSrc: muxAnimatedPreviewUrl(selected.playbackId),
    par: holePar(primaryPars, selected.holeNumber),
    holeGraphic: selected.holeGraphic,
    cameraPath: selected.cameraPath,
    landingZone: selected.landingZone,
  };

  return (
    <CourseEmbedWidget
      courseSlug={course.slug}
      courseTitle={course.title?.trim() || "Course"}
      logoSrc={courseLogoSrc(course)}
      hole={hole}
    />
  );
}
