"use client";

import { useCallback, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type Props = {
  /** Selector for the element to put into fullscreen (video stage). */
  targetSelector?: string;
};

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" className="course-video-fullscreen-icon" aria-hidden>
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg viewBox="0 0 24 24" className="course-video-fullscreen-icon" aria-hidden>
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
  );
}

function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
  };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function readCssFullscreen(): boolean {
  return document.documentElement.classList.contains("course-video-is-fullscreen");
}

function isFullscreenActive(): boolean {
  return Boolean(getFullscreenElement()) || readCssFullscreen();
}

/**
 * Prefer CSS immersive mode over the native Fullscreen API.
 * Native fullscreen removes the stage from normal scrolling, which breaks
 * ScrollTrigger scrub — CSS mode keeps the document scrollable underneath.
 */
function enterFullscreen(): void {
  document.documentElement.classList.add("course-video-is-fullscreen");
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    ScrollTrigger.update();
  });
}

async function exitFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitCancelFullScreen?: () => Promise<void> | void;
  };

  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === "function") {
      await doc.webkitExitFullscreen();
    } else if (typeof doc.webkitCancelFullScreen === "function") {
      await doc.webkitCancelFullScreen();
    }
  } catch {
    // ignore — CSS class cleanup still runs
  }

  document.documentElement.classList.remove("course-video-is-fullscreen");
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
    ScrollTrigger.update();
  });
}

/** Drive the same document scroll ScrollTrigger uses for scrubbing. */
function scrubByDelta(deltaY: number) {
  if (!deltaY) return;
  window.scrollBy({ top: deltaY, left: 0, behavior: "instant" });
  ScrollTrigger.update();
}

export function CourseFullscreenButton({
  targetSelector = "[data-course-video-stage]",
}: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncState = useCallback(() => {
    setIsFullscreen(isFullscreenActive());
  }, []);

  useEffect(() => {
    syncState();

    const onChange = () => syncState();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreenActive()) {
        void exitFullscreen().then(syncState);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [syncState]);

  // Keep scroll-scrub working while the stage covers the viewport.
  // Touch uses preventDefault (so the fixed stage can drive page scroll), which
  // kills native mobile momentum — so we synthesize inertia on touchend.
  useEffect(() => {
    if (!isFullscreen) return;

    const stage =
      document.querySelector<HTMLElement>(targetSelector) ??
      (getFullscreenElement() as HTMLElement | null);
    if (!stage) return;

    let lastTouchY = 0;
    let lastTouchTime = 0;
    /** Scroll px per ms (positive = scrub forward / scroll down). */
    let velocityY = 0;
    let momentumRaf = 0;

    const stopMomentum = () => {
      if (momentumRaf) {
        cancelAnimationFrame(momentumRaf);
        momentumRaf = 0;
      }
    };

    const startMomentum = (initialVelocity: number) => {
      stopMomentum();
      // Ignore tiny flicks
      if (Math.abs(initialVelocity) < 0.05) return;

      let v = initialVelocity;
      let last = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(34, Math.max(0, now - last));
        last = now;
        // ~same feel as mobile browser deceleration
        v *= Math.pow(0.965, dt / 16);
        const dy = v * dt;
        if (Math.abs(v) < 0.025 || Math.abs(dy) < 0.4) {
          momentumRaf = 0;
          return;
        }
        scrubByDelta(dy);
        momentumRaf = requestAnimationFrame(tick);
      };

      momentumRaf = requestAnimationFrame(tick);
    };

    const onWheel = (event: WheelEvent) => {
      stopMomentum();
      event.preventDefault();
      scrubByDelta(event.deltaY);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      stopMomentum();
      lastTouchY = event.touches[0].clientY;
      lastTouchTime = performance.now();
      velocityY = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const now = performance.now();
      const delta = lastTouchY - y;
      const dt = Math.max(1, now - lastTouchTime);
      lastTouchY = y;
      lastTouchTime = now;
      if (!delta) return;

      // Smooth velocity for a stable flick on release
      const instant = delta / dt;
      velocityY = velocityY * 0.65 + instant * 0.35;

      event.preventDefault();
      scrubByDelta(delta);
    };

    const onTouchEnd = () => {
      startMomentum(velocityY);
      velocityY = 0;
    };

    const wheelOpts: AddEventListenerOptions = { passive: false };
    const touchMoveOpts: AddEventListenerOptions = { passive: false };

    // Attach once to the stage only — bubbling to window/document used to
    // multiply deltas on real mobile browsers.
    stage.addEventListener("wheel", onWheel, wheelOpts);
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, touchMoveOpts);
    stage.addEventListener("touchend", onTouchEnd, { passive: true });
    stage.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      stopMomentum();
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
      stage.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isFullscreen, targetSelector]);

  const label = isFullscreen ? "Exit full screen" : "Enter full screen";

  return (
    <button
      type="button"
      className="course-video-fullscreen pointer-events-auto"
      aria-label={label}
      title={label}
      aria-pressed={isFullscreen}
      onClick={() => {
        void (async () => {
          if (isFullscreenActive()) {
            await exitFullscreen();
          } else {
            enterFullscreen();
          }
          syncState();
        })();
      }}
    >
      {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
    </button>
  );
}
