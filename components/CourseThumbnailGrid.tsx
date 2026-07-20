import Link from "next/link";
import type { CourseDoc } from "@/lib/sanity/courses";
import { courseLogoSrc } from "@/lib/sanity/courses";

type CourseThumbnailGridProps = {
  courses: CourseDoc[];
};

export function CourseThumbnailGrid({ courses }: CourseThumbnailGridProps) {
  if (courses.length === 0) {
    return (
      <p className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-stone-400">
        No published courses with flyover video yet. Add one in{" "}
        <Link href="/studio" className="text-birdseye-400 underline">
          Sanity Studio
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="mt-10 grid grid-cols-4 gap-2 sm:gap-3 md:gap-4">
      {courses.map((course) => {
        const title = course.title?.trim() || "Untitled course";
        const logoSrc = courseLogoSrc(course);

        return (
          <li key={course._id}>
            <Link
              href={`/courses/${course.slug}`}
              aria-label={title}
              className="group relative block aspect-square overflow-hidden rounded-md border border-white/10 bg-white/[0.04] transition hover:border-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-birdseye-300"
            >
              <div className="flex h-full items-center justify-center p-3 sm:p-4">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoSrc}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="select-none text-lg font-bold uppercase tracking-wide text-white/25 sm:text-xl">
                    {title.slice(0, 2)}
                  </span>
                )}
              </div>

              <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-white sm:text-xs md:text-sm">
                  {title}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
