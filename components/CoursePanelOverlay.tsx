"use client";

import Link from "next/link";
import { PanelCloseButton } from "@/components/PanelCloseButton";
import type { RelatedCourseLink } from "@/lib/sanity/courses";

type CoursePanelOverlayProps = {
  open: boolean;
  courses: RelatedCourseLink[];
  onClose?: () => void;
};

export function CoursePanelOverlay({
  open,
  courses,
  onClose,
}: CoursePanelOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="course-courses-panel pointer-events-auto"
      role="dialog"
      aria-label="Course selection"
    >
      <div className="course-courses-panel-inner">
        <div className="course-panel-toolbar">
          <PanelCloseButton onClose={onClose} label="Close course panel" />
        </div>

        <div className="course-courses-panel-list">
          {courses.length > 0 ? (
            courses.map((course, index) => {
              const label = course.title?.trim() || `Course ${index + 1}`;

              if (course.slug) {
                return (
                  <Link
                    key={course._key ?? `${course.slug}-${index}`}
                    href={`/courses/${course.slug}`}
                    className="course-courses-panel-btn"
                  >
                    {label}
                  </Link>
                );
              }

              return (
                <span
                  key={`${label}-${index}`}
                  className="course-courses-panel-btn course-courses-panel-btn-static"
                >
                  {label}
                </span>
              );
            })
          ) : (
            <p className="course-courses-panel-empty">
              Choose courses in Sanity under Course Page Buttons.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
