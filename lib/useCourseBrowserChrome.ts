"use client";

import { useEffect } from "react";

const PORTRAIT_MQ = "(max-width: 767px) and (orientation: portrait)";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac with touch
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Measure stable CSS viewport units in px (lvh/svh stay fixed across chrome toggles). */
function measureViewportUnit(unit: "lvh" | "svh"): number {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;top:0;left:0;width:0;height:100${unit};visibility:hidden;pointer-events:none;`;
  document.documentElement.appendChild(el);
  const px = el.offsetHeight;
  el.remove();
  return px;
}

/**
 * Keeps course portrait layout stable while the mobile URL bar shows/hides.
 * Sets CSS vars used by the video stage, info panel, and top controls.
 *
 * iOS Safari: visualViewport.offsetTop + height deficit vs lvh.
 * Android Chrome: height deficit vs lvh (offsetTop is usually 0; layout often resizes).
 */
export function useCourseBrowserChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia(PORTRAIT_MQ);
    let raf = 0;

    const clear = () => {
      root.style.removeProperty("--course-chrome-gap");
      root.style.removeProperty("--course-chrome-shift");
      root.classList.remove("course-browser-chrome-visible");
      root.classList.remove("course-browser-ios");
      root.classList.remove("course-browser-android");
    };

    const update = () => {
      if (!mq.matches) {
        clear();
        return;
      }

      // Immersive mode owns its own insets — keep stage geometry, drop control shift.
      if (root.classList.contains("course-video-is-fullscreen")) {
        root.style.setProperty("--course-chrome-shift", "0px");
        root.classList.remove("course-browser-chrome-visible");
        return;
      }

      const ios = isIOS();
      const android = isAndroid();
      root.classList.toggle("course-browser-ios", ios);
      root.classList.toggle("course-browser-android", android);

      const lvhPx = measureViewportUnit("lvh");
      const svhPx = measureViewportUnit("svh");
      const chromeGap = Math.max(0, lvhPx - svhPx);
      root.style.setProperty("--course-chrome-gap", `${chromeGap}px`);

      const vv = window.visualViewport;
      let shift = 0;

      if (vv && chromeGap > 0) {
        if (ios) {
          // Safari often exposes the URL bar via offsetTop and/or a shorter visual viewport.
          const fromOffset = Math.max(0, vv.offsetTop);
          const fromHeight = Math.max(0, lvhPx - vv.height - vv.offsetTop);
          shift = Math.min(chromeGap, Math.max(fromOffset, fromHeight));
        } else if (android) {
          // Chrome for Android usually keeps offsetTop at 0 and shrinks the visible height.
          const fromHeight = Math.max(0, lvhPx - vv.height);
          shift = Math.min(chromeGap, fromHeight);
        } else {
          const fromOffset = Math.max(0, vv.offsetTop);
          const fromHeight = Math.max(0, lvhPx - vv.height - vv.offsetTop);
          shift = Math.min(chromeGap, Math.max(fromOffset, fromHeight));
        }
      }

      // Ignore sub-pixel noise so controls don't jitter.
      if (shift < 2) shift = 0;
      if (chromeGap > 0 && shift > chromeGap - 2) shift = chromeGap;

      root.style.setProperty("--course-chrome-shift", `${shift}px`);
      root.classList.toggle("course-browser-chrome-visible", shift > 0);
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    mq.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    // Orientation / URL-bar animations can settle after a beat.
    window.addEventListener("orientationchange", schedule);

    const classObserver = new MutationObserver(schedule);
    classObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mq.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      classObserver.disconnect();
      clear();
    };
  }, []);
}
