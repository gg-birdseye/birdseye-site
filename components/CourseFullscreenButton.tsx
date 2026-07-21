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
  useEffect(() => {
    if (!isFullscreen) return;

    const stage =
      document.querySelector<HTMLElement>(targetSelector) ??
      (getFullscreenElement() as HTMLElement | null);

    let lastTouchY = 0;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      scrubByDelta(event.deltaY);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      lastTouchY = event.touches[0].clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const delta = lastTouchY - y;
      lastTouchY = y;
      if (!delta) return;
      event.preventDefault();
      scrubByDelta(delta);
    };

    const opts: AddEventListenerOptions = { passive: false };
    const targets: EventTarget[] = [window, document];
    if (stage) targets.push(stage);

    for (const target of targets) {
      target.addEventListener("wheel", onWheel as EventListener, opts);
      target.addEventListener("touchstart", onTouchStart as EventListener, {
        passive: true,
      });
      target.addEventListener("touchmove", onTouchMove as EventListener, opts);
    }

    return () => {
      for (const target of targets) {
        target.removeEventListener("wheel", onWheel as EventListener);
        target.removeEventListener("touchstart", onTouchStart as EventListener);
        target.removeEventListener("touchmove", onTouchMove as EventListener);
      }
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
