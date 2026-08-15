"use client";

import { PanelCloseButton } from "@/components/PanelCloseButton";
import type { ScorecardChartTeeOption } from "@/components/ScorecardChartOverlay";
import { useForwardScrollToVideo } from "@/hooks/useForwardScrollToVideo";
import { teeSelectedLabelColor } from "@/lib/constants/teeColors";
import { useRef } from "react";

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
  const holeRegionRef = useRef<HTMLDivElement>(null);
  useForwardScrollToVideo(holeRegionRef, open);

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
              const selectedLabelColor = isSelected
                ? teeSelectedLabelColor(option.color)
                : undefined;
              return (
                <button
                  key={option.index}
                  type="button"
                  onClick={() => onTeeSelect?.(option.index)}
                  className={`course-scorecard-data-tee-btn tabular-nums ${
                    isSelected
                      ? "course-scorecard-data-tee-btn-active"
                      : "text-white/55 hover:text-white/85"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: option.color,
                          borderColor: option.color,
                          color: selectedLabelColor,
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
