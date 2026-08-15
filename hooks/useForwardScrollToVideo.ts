"use client";

import { useEffect, type RefObject } from "react";

/**
 * Distance a touch must travel before it counts as a swipe. Regions that also
 * respond to taps need some slack so a tap isn't read as a tiny scrub.
 */
export const SWIPE_SCRUB_THRESHOLD_PX = 8;

type ForwardScrollOptions = {
  thresholdPx?: number;
  /**
   * Wheel deltas are only forwarded when the region blocks native scrolling.
   * Leave it off where the page already scrolls under the cursor, since line-
   * based deltas (Firefox) don't translate to pixel scroll distances.
   */
  forwardWheel?: boolean;
};

/** Forward scroll/touch on an overlay to the page so the flyover advances.
 * Touch moves are applied live; on release we continue with inertial scrolling
 * so a long swipe keeps scrubbing like a swipe on the video itself.
 */
export function useForwardScrollToVideo(
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  options?: ForwardScrollOptions,
) {
  const thresholdPx = options?.thresholdPx ?? 0;
  const forwardWheel = options?.forwardWheel ?? true;

  useEffect(() => {
    const el = targetRef.current;
    if (!enabled || !el) return;

    let lastY: number | null = null;
    let lastT = 0;
    /** Vertical scroll velocity in px/ms (positive = scroll down / advance). */
    let velocityY = 0;
    let momentumRaf = 0;
    let travelled = 0;
    let scrubbing = thresholdPx <= 0;

    const stopMomentum = () => {
      if (momentumRaf) {
        cancelAnimationFrame(momentumRaf);
        momentumRaf = 0;
      }
    };

    const maxScrollTop = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const applyScrollDy = (dy: number) => {
      if (dy === 0) return 0;
      const top = window.scrollY;
      const next = Math.min(maxScrollTop(), Math.max(0, top + dy));
      const applied = next - top;
      if (applied !== 0) {
        window.scrollTo({ top: next, left: 0, behavior: "instant" });
      }
      return applied;
    };

    const startMomentum = () => {
      stopMomentum();
      let prev = performance.now();

      const tick = (now: number) => {
        const dt = Math.min(34, Math.max(0, now - prev));
        prev = now;
        if (dt === 0) {
          momentumRaf = requestAnimationFrame(tick);
          return;
        }

        const dy = velocityY * dt;
        const applied = applyScrollDy(dy);
        // Stop if we hit the scroll bound.
        if (Math.abs(dy) > 0.5 && Math.abs(applied) < Math.abs(dy) * 0.25) {
          velocityY = 0;
          momentumRaf = 0;
          return;
        }

        // Exponential decay (~native fling feel).
        velocityY *= Math.exp(-0.0045 * dt);
        if (Math.abs(velocityY) < 0.025) {
          velocityY = 0;
          momentumRaf = 0;
          return;
        }

        momentumRaf = requestAnimationFrame(tick);
      };

      momentumRaf = requestAnimationFrame(tick);
    };

    const onWheel = (event: WheelEvent) => {
      stopMomentum();
      event.preventDefault();
      applyScrollDy(event.deltaY);
    };

    const onTouchStart = (event: TouchEvent) => {
      stopMomentum();
      lastY = event.touches[0]?.clientY ?? null;
      lastT = performance.now();
      velocityY = 0;
      travelled = 0;
      scrubbing = thresholdPx <= 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (lastY == null || event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const t = performance.now();
      const dy = lastY - y;
      const dt = Math.max(1, t - lastT);
      lastY = y;
      lastT = t;
      if (dy === 0) return;

      if (!scrubbing) {
        travelled += Math.abs(dy);
        if (travelled < thresholdPx) return;
        scrubbing = true;
      }

      event.preventDefault();
      applyScrollDy(dy);
      const instant = dy / dt;
      velocityY = velocityY * 0.55 + instant * 0.45;
    };

    const onTouchEnd = () => {
      lastY = null;
      if (scrubbing && Math.abs(velocityY) > 0.05) {
        startMomentum();
      } else {
        velocityY = 0;
      }
    };

    const onTouchCancel = () => {
      lastY = null;
      velocityY = 0;
      stopMomentum();
    };

    if (forwardWheel) el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);

    return () => {
      stopMomentum();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [enabled, forwardWheel, targetRef, thresholdPx]);
}
