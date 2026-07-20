"use client";

import { useCallback, useRef, useState } from "react";

/** Public sample MP4 — swap for your course footage in `public/` or your CDN. */
export const PLACEHOLDER_VIDEO_SRC =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";

const PLACEHOLDER_POSTER_SRC =
  "https://images.unsplash.com/photo-1587174486079-aece005fc2c7?auto=format&fit=crop&w=1920&q=80";

const chapters = [
  { id: "clubhouse", label: "Clubhouse flyover", fraction: 0 },
  { id: "outward", label: "Outward nine", fraction: 1 / 3 },
  { id: "inward", label: "Inward nine", fraction: 2 / 3 },
  { id: "close", label: "Closing stretch", fraction: 0.88 },
] as const;

export function InteractiveCourseVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [timelineReady, setTimelineReady] = useState(false);

  const seekToChapter = useCallback((fraction: number, index: number) => {
    const el = videoRef.current;
    if (!el || !timelineReady) return;
    const duration = el.duration;
    if (duration && Number.isFinite(duration)) {
      el.currentTime = Math.min(duration * fraction, duration - 0.25);
    } else {
      el.currentTime = 0;
    }
    void el.play().catch(() => {
      /* autoplay policies — user may need to press play */
    });
    setActiveIndex(index);
  }, [timelineReady]);

  return (
    <div className="relative w-full overflow-hidden bg-black shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]">
      <div className="relative mx-auto w-full max-w-[1920px]">
        <video
          ref={videoRef}
          className="block aspect-video h-auto w-full object-cover outline-none ring-0"
          controls
          playsInline
          preload="metadata"
          poster={PLACEHOLDER_POSTER_SRC}
          aria-label="Course preview demonstration video"
          onLoadedMetadata={() => setTimelineReady(true)}
        >
          <source src={PLACEHOLDER_VIDEO_SRC} type="video/mp4" />
          Your browser does not support embedded video. Replace the source with your course footage.
        </video>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent md:h-40"
          aria-hidden
        />

        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-4 pt-8 md:px-8 md:pb-6">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-birdseye-200/90 md:text-left">
            Interactive preview — jump to a segment
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {chapters.map((ch, index) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => seekToChapter(ch.fraction, index)}
                disabled={!timelineReady}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-birdseye-300 md:px-4 md:py-2 md:text-base disabled:cursor-not-allowed disabled:opacity-40 ${
                  activeIndex === index
                    ? "border-birdseye-400 bg-birdseye-600/90 text-white shadow-lg shadow-birdseye-950/50"
                    : "border-white/25 bg-black/45 text-stone-100 backdrop-blur-md hover:border-birdseye-400/60 hover:bg-black/55"
                }`}
                aria-pressed={activeIndex === index}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
