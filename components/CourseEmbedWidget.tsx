"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CameraPathOverlay } from "@/components/CameraPathOverlay";
import { LandingZoneOverlay } from "@/components/LandingZoneOverlay";
import { trackCourseEvent } from "@/lib/analytics";
import { cameraPathHasTrack } from "@/lib/camera-path";
import {
  courseEmbedSnippet,
  courseFlyoverUrl,
  type CourseEmbedHole,
} from "@/lib/embed";
import { landingZoneIsReady, resolveFurthestBackTee } from "@/lib/landing-zone";

type CourseEmbedWidgetProps = {
  courseSlug: string;
  courseTitle: string;
  logoSrc?: string;
  hole: CourseEmbedHole;
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
      <path d="M8 5.14v13.72L19.06 12 8 5.14z" />
    </svg>
  );
}

/** Mid-fairway preview so the aerial ruler matches the live hole view. */
const EMBED_FLYOVER_PROGRESS = 0.42;

export function CourseEmbedWidget({
  courseSlug,
  courseTitle,
  logoSrc,
  hole,
}: CourseEmbedWidgetProps) {
  const analyticsCourse = useMemo(
    () => ({ slug: courseSlug, title: courseTitle }),
    [courseSlug, courseTitle],
  );
  const aerialStageRef = useRef<HTMLDivElement>(null);
  const [inIframe, setInIframe] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const flyoverHref = courseFlyoverUrl(courseSlug, hole.holeNumber);
  const hasCameraTrack = cameraPathHasTrack(hole.cameraPath);
  const hasLandingZone = landingZoneIsReady(hole.landingZone);
  const selectedTeeIndex = hole.landingZone
    ? (resolveFurthestBackTee(hole.landingZone)?.teeIndex ?? 0)
    : 0;

  useEffect(() => {
    setInIframe(window.self !== window.top);
    document.documentElement.classList.add("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  useEffect(() => {
    trackCourseEvent("embed_view", analyticsCourse, {
      embed_surface: "iframe",
      hole_number: hole.holeNumber,
    });
  }, [analyticsCourse, hole.holeNumber]);

  const copySnippet = useCallback(async () => {
    const snippet = courseEmbedSnippet(courseSlug, courseTitle);
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [courseSlug, courseTitle]);

  const onCtaClick = useCallback(() => {
    trackCourseEvent("embed_cta_click", analyticsCourse, {
      hole_number: hole.holeNumber,
    });
  }, [analyticsCourse, hole.holeNumber]);

  return (
    <div className="course-embed-widget relative h-full min-h-[240px] w-full overflow-hidden bg-[#0a120e] text-stone-100">
      <div className="relative flex h-full min-h-0 w-full">
        {hole.holeGraphic ? (
          <div className="relative flex h-full w-[30%] min-w-[8.25rem] max-w-[15rem] shrink-0 flex-col bg-[#11100d]">
            <div ref={aerialStageRef} className="course-embed-aerial-stage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hole.holeGraphic.src}
                alt={
                  hole.holeGraphic.alt ??
                  `${courseTitle} hole ${hole.holeNumber} layout`
                }
                className="course-hole-graphic-panel-media"
                draggable={false}
                onLoad={() => {
                  window.dispatchEvent(new Event("resize"));
                }}
              />
              <div className="pointer-events-none absolute inset-0">
                <LandingZoneOverlay
                  contentRef={aerialStageRef}
                  landingZone={hole.landingZone}
                  selectedTeeIndex={selectedTeeIndex}
                  cameraPath={hole.cameraPath}
                  progress={EMBED_FLYOVER_PROGRESS}
                  visible={hasLandingZone}
                />
                {hasCameraTrack && !hasLandingZone ? (
                  <CameraPathOverlay
                    contentRef={aerialStageRef}
                    cameraPath={hole.cameraPath}
                    progress={EMBED_FLYOVER_PROGRESS}
                    visible
                  />
                ) : null}
              </div>
              <div className="course-hole-graphic-disclaimer pointer-events-auto">
                <button
                  type="button"
                  className="course-hole-graphic-disclaimer-btn"
                  aria-expanded={disclaimerOpen}
                  aria-label={
                    disclaimerOpen
                      ? "Hide distance accuracy disclaimer"
                      : "Show distance accuracy disclaimer"
                  }
                  onClick={() => setDisclaimerOpen((open) => !open)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="course-hole-graphic-disclaimer-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" d="M12 11v5" />
                    <circle
                      cx="12"
                      cy="8"
                      r="0.75"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                </button>
                {disclaimerOpen ? (
                  <div
                    className="course-hole-graphic-disclaimer-popup"
                    role="note"
                  >
                    The distance information depicted on this page may not be
                    entirely accurate. This web tool uses calculations to
                    estimate distances and should not be treated as actual GPS
                    data.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="relative min-h-0 min-w-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hole.posterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {!previewFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hole.previewSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : null}

          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/25"
            aria-hidden
          />

          <div className="absolute left-3 top-3 z-[5] sm:left-4 sm:top-4">
            <div
              className="flex h-14 w-14 flex-col items-center justify-center rounded-md border border-white/40 bg-white/20 shadow-sm backdrop-blur-sm sm:h-16 sm:w-16"
              aria-hidden
            >
              <span className="text-xl font-bold leading-none text-white sm:text-2xl">
                {hole.holeNumber}
              </span>
              <span className="mt-0.5 text-[9px] font-semibold tracking-[0.14em] text-white/85 sm:text-[10px]">
                PAR {hole.par}
              </span>
            </div>
          </div>

          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={courseTitle}
              className="absolute bottom-[4.25rem] left-3 z-[5] h-14 w-auto max-w-[38%] object-contain object-left-bottom drop-shadow sm:bottom-[4.75rem] sm:left-4 sm:h-16"
            />
          ) : null}
        </div>
      </div>

      {/* Play control — centered on the full iframe width */}
      <div className="course-embed-play-layer pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <a
          href={flyoverHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCtaClick}
          className="group pointer-events-auto flex flex-col items-center text-center"
          aria-label={`Preview ${courseTitle} interactive hole flyovers`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-white/25 sm:h-16 sm:w-16">
            <PlayIcon />
          </span>
          <span className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 sm:text-sm">
            Interactive hole flyovers
          </span>
        </a>
      </div>

      {/* Full-width CTA — spans iframe and overlays the aerial panel bottom */}
      <div className="course-embed-cta-layer absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4">
        <a
          href={flyoverHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCtaClick}
          className="flex w-full items-center justify-center rounded-full border border-white/25 bg-black/55 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-white/45 hover:bg-black/70"
        >
          Preview the course
        </a>
      </div>

      {!inIframe ? (
        <button
          type="button"
          onClick={() => void copySnippet()}
          className="absolute right-3 top-3 z-30 rounded-full border border-white/25 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm hover:bg-black/70"
        >
          {copied ? "Copied" : "Copy embed code"}
        </button>
      ) : null}
    </div>
  );
}
