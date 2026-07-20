import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Scroll progress (0–1) where the end overlay begins fading over the video. */
export const SCROLLY_VIDEO_FADE_START = 0.88;

/** Inverse of progressToHole for scroll-to-hole navigation (hole segment midpoint). */
export function holeToProgress(hole: number, totalHoles: number): number {
  if (hole <= 0) return 0;
  const clamped = Math.min(totalHoles, Math.max(1, hole));
  return 0.045 + ((clamped - 0.5) / totalHoles) * (1 - 0.045);
}

/** Scroll progress at the start of a hole segment — use when jumping to a hole via nav. */
export function holeStartProgress(hole: number, totalHoles: number): number {
  if (hole <= 0) return 0;
  const clamped = Math.min(totalHoles, Math.max(1, hole));
  return 0.045 + ((clamped - 1) / totalHoles) * (1 - 0.045);
}

/** Map global scroll progress to 0–1 within the active hole segment (single-video mode). */
export function holeLocalScrollProgress(
  scrollP: number,
  hole: number,
  totalHoles: number,
): number {
  if (hole <= 0) {
    return Math.min(1, Math.max(0, scrollP / 0.045));
  }
  const start = holeToProgress(hole, totalHoles);
  const end = hole >= totalHoles ? 1 : holeToProgress(hole + 1, totalHoles);
  const span = end - start;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (scrollP - start) / span));
}

/** Jump the page scroll position to a flyover progress value (0–1) on the active scrolly track. */
export function scrollTrackToProgress(
  progress: number,
  behavior: ScrollBehavior = "instant",
) {
  if (typeof window === "undefined") return;
  const track = document.querySelector<HTMLElement>("[data-scrolly-track]");
  if (!track) return;

  const trigger = ScrollTrigger.getAll().find((entry) => entry.trigger === track);
  if (!trigger) return;

  const clamped = Math.min(1, Math.max(0, progress));
  const y = trigger.start + clamped * (trigger.end - trigger.start);
  window.scrollTo({ top: y, behavior });
  requestAnimationFrame(() => {
    trigger.update();
    ScrollTrigger.refresh();
  });
}

/** Seek as fast as the browser allows — important for scroll-scrub responsiveness. */
export function seekVideoForScrub(video: HTMLVideoElement, time: number) {
  const duration = video.duration;
  const clamped =
    duration && Number.isFinite(duration)
      ? Math.min(Math.max(time, 0), Math.max(duration - 0.001, 0))
      : Math.max(time, 0);

  if (Math.abs(video.currentTime - clamped) < 0.008) return;

  const fastSeekVideo = video as HTMLVideoElement & {
    fastSeek?: (t: number) => void;
  };
  if (typeof fastSeekVideo.fastSeek === "function") {
    try {
      fastSeekVideo.fastSeek(clamped);
      return;
    } catch {
      // Fall back to precise seek below.
    }
  }

  video.currentTime = clamped;
}
