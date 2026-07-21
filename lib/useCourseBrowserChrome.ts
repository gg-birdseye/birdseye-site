"use client";

import { useEffect } from "react";

const PORTRAIT_MQ = "(max-width: 767px) and (orientation: portrait)";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** Measure stable CSS viewport units in px. */
function measureViewportUnit(unit: "lvh" | "svh"): number {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;top:0;left:0;width:0;height:100${unit};visibility:hidden;pointer-events:none;`;
  document.documentElement.appendChild(el);
  const px = el.offsetHeight;
  el.remove();
  return px;
}

/**
 * Locks course portrait layout to the large viewport so URL-bar show/hide
 * reveals the top of the video instead of sliding/resizing video + info.
 *
 * - `--course-layout-h` is frozen in px (only updates on orientation / max growth)
 * - `--course-chrome-shift` tracks the URL bar for top controls only
 *
 * iOS Safari: visualViewport.offsetTop + height deficit
 * Android Chrome: height deficit (offsetTop is usually 0; layout viewport resizes)
 */
export function useCourseBrowserChrome() {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia(PORTRAIT_MQ);
    let raf = 0;
    let frozenLayoutH = 0;

    const clear = () => {
      frozenLayoutH = 0;
      root.style.removeProperty("--course-layout-h");
      root.style.removeProperty("--course-chrome-gap");
      root.style.removeProperty("--course-chrome-shift");
      root.classList.remove("course-browser-chrome-visible");
      root.classList.remove("course-browser-ios");
      root.classList.remove("course-browser-android");
    };

    /** Freeze the large-viewport height so chrome toggles can't resize the shell. */
    const freezeLayoutHeight = (force = false) => {
      const lvhPx = measureViewportUnit("lvh");
      // Use lvh only (already the chrome-hidden size). Do not grow from
      // visualViewport — that would jump the layout the first time chrome hides.
      if (force || frozenLayoutH === 0 || lvhPx > frozenLayoutH + 1) {
        frozenLayoutH = lvhPx;
        root.style.setProperty("--course-layout-h", `${frozenLayoutH}px`);
      }
      return frozenLayoutH;
    };

    const updateShift = () => {
      if (!mq.matches) {
        clear();
        return;
      }

      const ios = isIOS();
      const android = isAndroid();
      root.classList.toggle("course-browser-ios", ios);
      root.classList.toggle("course-browser-android", android);

      const layoutH = freezeLayoutHeight(false);
      const svhPx = measureViewportUnit("svh");
      const chromeGap = Math.max(0, layoutH - svhPx);
      root.style.setProperty("--course-chrome-gap", `${chromeGap}px`);

      if (root.classList.contains("course-video-is-fullscreen")) {
        root.style.setProperty("--course-chrome-shift", "0px");
        root.classList.remove("course-browser-chrome-visible");
        return;
      }

      const vv = window.visualViewport;
      let shift = 0;

      if (vv && chromeGap > 0) {
        if (ios) {
          const fromOffset = Math.max(0, vv.offsetTop);
          const fromHeight = Math.max(0, layoutH - vv.height - vv.offsetTop);
          shift = Math.min(chromeGap, Math.max(fromOffset, fromHeight));
        } else if (android) {
          const fromHeight = Math.max(0, layoutH - vv.height);
          shift = Math.min(chromeGap, fromHeight);
        } else {
          const fromOffset = Math.max(0, vv.offsetTop);
          const fromHeight = Math.max(0, layoutH - vv.height - vv.offsetTop);
          shift = Math.min(chromeGap, Math.max(fromOffset, fromHeight));
        }
      }

      if (shift < 2) shift = 0;
      if (chromeGap > 0 && shift > chromeGap - 2) shift = chromeGap;

      root.style.setProperty("--course-chrome-shift", `${shift}px`);
      root.classList.toggle("course-browser-chrome-visible", shift > 0);
    };

    const scheduleShift = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateShift);
    };

    const onOrientationOrMq = () => {
      frozenLayoutH = 0;
      freezeLayoutHeight(true);
      scheduleShift();
    };

    freezeLayoutHeight(true);
    updateShift();

    mq.addEventListener("change", onOrientationOrMq);
    window.addEventListener("orientationchange", onOrientationOrMq);
    // visualViewport: update control shift only — do not unfreeze layout height
    window.visualViewport?.addEventListener("resize", scheduleShift);
    window.visualViewport?.addEventListener("scroll", scheduleShift);
    // Window resize can be orientation or desktop; re-freeze if taller.
    window.addEventListener("resize", scheduleShift);

    const classObserver = new MutationObserver(scheduleShift);
    classObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mq.removeEventListener("change", onOrientationOrMq);
      window.removeEventListener("orientationchange", onOrientationOrMq);
      window.visualViewport?.removeEventListener("resize", scheduleShift);
      window.visualViewport?.removeEventListener("scroll", scheduleShift);
      window.removeEventListener("resize", scheduleShift);
      classObserver.disconnect();
      clear();
    };
  }, []);
}
