"use client";

import { PanelCloseButton } from "@/components/PanelCloseButton";
import type { ScorecardChartTeeOption } from "@/components/ScorecardChartOverlay";
import { useEffect, useRef } from "react";

export type ScorecardMobileTee = {
  name: string;
  yardages: string[];
  handicaps: string[];
  pars: string[];
};

type ScorecardMobileDataOverlayProps = {
  open: boolean;
  activeHole: number;
  teeColor: string;
  tee: ScorecardMobileTee;
  teeOptions?: ScorecardChartTeeOption[];
  selectedTee?: number;
  onTeeSelect?: (index: number) => void;
  onClose?: () => void;
  totalPar?: string;
};

function formatTeeRating(courseRating?: string, slopeRating?: string): string | null {
  const course = courseRating?.trim();
  const slope = slopeRating?.trim();
  if (!course || !slope) return null;
  return `${course}/${slope}`;
}

function displayValue(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value || value === "—" || value === "-") return "—";
  return value;
}

/** Forward scroll/touch on the hole readout to the page so the flyover advances.
 * Touch moves are applied live; on release we continue with inertial scrolling
 * so a long swipe keeps scrubbing like a swipe on the video itself.
 */
function useForwardScrollToVideo(open: boolean) {
  const regionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = regionRef.current;
    if (!open || !el) return;

    let lastY: number | null = null;
    let lastT = 0;
    /** Vertical scroll velocity in px/ms (positive = scroll down / advance). */
    let velocityY = 0;
    let momentumRaf = 0;

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
      event.preventDefault();
      applyScrollDy(dy);
      const instant = dy / dt;
      velocityY = velocityY * 0.55 + instant * 0.45;
    };

    const onTouchEnd = () => {
      lastY = null;
      if (Math.abs(velocityY) > 0.05) {
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

    el.addEventListener("wheel", onWheel, { passive: false });
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
  }, [open]);

  return regionRef;
}

export function ScorecardMobileDataOverlay({
  open,
  activeHole,
  teeColor,
  tee,
  teeOptions = [],
  selectedTee = 0,
  onTeeSelect,
  onClose,
  totalPar,
}: ScorecardMobileDataOverlayProps) {
  const holeRegionRef = useForwardScrollToVideo(open);

  if (!open) return null;

  const selectedOption = teeOptions.find((option) => option.index === selectedTee);
  const ratingLabel = formatTeeRating(
    selectedOption?.courseRating,
    selectedOption?.slopeRating,
  );
  const yards = displayValue(tee.yardages[activeHole]);
  const par = displayValue(tee.pars[activeHole]);
  const hdcp = displayValue(tee.handicaps[activeHole]);

  return (
    <div
      className="course-scorecard-data"
      role="dialog"
      aria-label={`${tee.name} scorecard`}
    >
      <div className="course-scorecard-data-inner">
        <div className="course-scorecard-data-toolbar">
          <div className="course-scorecard-data-toolbar-title min-w-0">
            {totalPar?.trim() ? (
              <p className="truncate font-sans text-base uppercase tracking-wide text-white/80">
                PAR {totalPar.trim()}
              </p>
            ) : null}
            <p className="mt-0.5 truncate font-sans text-xl font-semibold uppercase tracking-wide text-white">
              {tee.name}
            </p>
            {selectedOption?.totalYards || ratingLabel ? (
              <p className="mt-1 truncate font-sans text-sm tabular-nums text-white/65">
                {[
                  selectedOption?.totalYards
                    ? `${selectedOption.totalYards} yds`
                    : null,
                  ratingLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          <PanelCloseButton onClose={onClose} label="Close scorecard" />
        </div>

        <div
          ref={holeRegionRef}
          className="course-scorecard-data-hole"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="course-scorecard-data-hole-main">
            <p className="course-scorecard-data-hole-label">Hole</p>
            <p
              className="course-scorecard-data-hole-number"
              style={{ color: teeColor }}
            >
              {activeHole}
            </p>

            <div className="course-scorecard-data-stats">
              <div className="course-scorecard-data-stat course-scorecard-data-stat-yards">
                <span className="course-scorecard-data-stat-label">Yards</span>
                <span className="course-scorecard-data-stat-value">{yards}</span>
              </div>
              <div className="course-scorecard-data-stat">
                <span className="course-scorecard-data-stat-label">Par</span>
                <span className="course-scorecard-data-stat-value">{par}</span>
              </div>
              <div className="course-scorecard-data-stat">
                <span className="course-scorecard-data-stat-label">Hdcp</span>
                <span className="course-scorecard-data-stat-value">{hdcp}</span>
              </div>
            </div>
          </div>

          <p className="course-scorecard-data-scroll-hint">Scroll to fly</p>
        </div>

        {teeOptions.length > 1 ? (
          <div
            className="course-scorecard-data-tee-bar"
            role="group"
            aria-label="Select tee"
          >
            {teeOptions.map((option) => {
              const isSelected = selectedTee === option.index;
              const optionRating = formatTeeRating(
                option.courseRating,
                option.slopeRating,
              );
              return (
                <button
                  key={option.index}
                  type="button"
                  onClick={() => onTeeSelect?.(option.index)}
                  className={`course-scorecard-data-tee-btn tabular-nums ${
                    isSelected
                      ? "course-scorecard-data-tee-btn-active text-white"
                      : "text-white/55 hover:text-white/85"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: option.color,
                          borderColor: option.color,
                        }
                      : undefined
                  }
                  aria-label={
                    optionRating
                      ? `${option.totalYards} yards, rating ${optionRating}`
                      : `${option.totalYards} yards`
                  }
                  aria-pressed={isSelected}
                >
                  <span
                    className={
                      isSelected
                        ? "course-scorecard-data-tee-yards-active"
                        : "course-scorecard-data-tee-yards"
                    }
                  >
                    {option.totalYards}
                  </span>
                  {isSelected && optionRating ? (
                    <span className="course-scorecard-data-tee-rating">
                      {optionRating}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
