"use client";

import { PanelCloseButton } from "@/components/PanelCloseButton";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformEffect,
  useTransformInit,
} from "react-zoom-pan-pinch";

export type ScorecardChartMode = "yardage" | "handicap";

export type ScorecardChartTee = {
  name: string;
  yardages: string[];
  handicaps: string[];
};

export type ScorecardChartTeeOption = {
  index: number;
  totalYards: string;
  totalPar?: string;
  courseRating?: string;
  slopeRating?: string;
  color: string;
};

export type ScorecardChartGender = "men" | "women";

type ScorecardChartOverlayProps = {
  open: boolean;
  holeCount: number;
  activeHole: number;
  teeColor: string;
  tee: ScorecardChartTee;
  teeOptions?: ScorecardChartTeeOption[];
  selectedTee?: number;
  onTeeSelect?: (index: number) => void;
  onHoleSelect?: (hole: number) => void;
  onClose?: () => void;
  /** When true, show Men's / Women's toggle (ratings & stroke index). */
  showGenderToggle?: boolean;
  scorecardGender?: ScorecardChartGender;
  onGenderChange?: (gender: ScorecardChartGender) => void;
  /** Total par for the selected tee (shown under tee name). */
  totalPar?: string;
  /**
   * Yardages from every tee (1-indexed hole arrays). When provided, the yardage
   * y-axis stays fixed across tee changes so bar heights reflect relative length.
   */
  allTeeYardages?: ReadonlyArray<ReadonlyArray<string | number>>;
};

function formatTeeRating(courseRating?: string, slopeRating?: string): string | null {
  const course = courseRating?.trim();
  const slope = slopeRating?.trim();
  if (!course || !slope) return null;
  return `${course}/${slope}`;
}

/** Layout of a viewBox SVG using preserveAspectRatio="xMidYMax meet". */
function svgMeetYMaxLayout(
  contentWidth: number,
  contentHeight: number,
  chartWidth: number,
  chartHeight: number,
) {
  const vbAspect = chartWidth / chartHeight;
  const elAspect = contentWidth / Math.max(contentHeight, 1);
  if (elAspect > vbAspect) {
    return { offsetY: 0, renderedH: contentHeight };
  }
  const renderedH = contentWidth / vbAspect;
  return { offsetY: contentHeight - renderedH, renderedH };
}

const SCORECARD_CHART_WIDTH = 1000;
const SCORECARD_CHART_HEIGHT = 520;
const SCORECARD_CHART_MARGIN = { top: 24, right: 20, bottom: 28, left: 56 };

/**
 * Max zoom so the chart can fill empty viewport space above, while keeping the
 * top-of-axis label visible (largest yardage, or HDCP 1 at the top of the scale).
 */
function maxZoomForViewport(
  viewportWidth: number,
  viewportHeight: number,
  topAxisSvgY: number,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 1;
  const { offsetY, renderedH } = svgMeetYMaxLayout(
    viewportWidth,
    viewportHeight,
    SCORECARD_CHART_WIDTH,
    SCORECARD_CHART_HEIGHT,
  );
  const topTickFromContentTop =
    offsetY + (topAxisSvgY / SCORECARD_CHART_HEIGHT) * renderedH;
  const spanToBottom = viewportHeight - topTickFromContentTop;
  if (spanToBottom <= 0) return 1;
  // Keep a little padding so the top tick label isn't flush with the edge.
  const labelPad = 16;
  return Math.max(1, Math.min(16, (viewportHeight - labelPad) / spanToBottom));
}

/** Keeps yardage/HDCP tick labels fixed in screen space while the plot zooms. */
function ScorecardLockedYAxis({
  ticks,
  chartWidth,
  chartHeight,
  yFor,
}: {
  ticks: number[];
  chartWidth: number;
  chartHeight: number;
  yFor: (value: number) => number;
}) {
  const [transform, setTransform] = useState({
    scale: 1,
    positionY: 0,
    contentWidth: 0,
    contentHeight: 0,
  });

  const syncFromInstance = (instance: {
    contentComponent: HTMLDivElement | null;
    state: { scale: number; positionY: number };
  }) => {
    const content = instance.contentComponent;
    const contentWidth = content?.offsetWidth ?? 0;
    const contentHeight = content?.offsetHeight ?? 0;
    if (contentWidth <= 0 || contentHeight <= 0) return false;
    setTransform({
      scale: instance.state.scale,
      positionY: instance.state.positionY,
      contentWidth,
      contentHeight,
    });
    return true;
  };

  // useTransformEffect only fires after the first pan/zoom — seed on init too.
  useTransformInit(({ instance }) => {
    const read = () => syncFromInstance(instance);
    if (read()) return;

    const content = instance.contentComponent;
    if (!content || typeof ResizeObserver === "undefined") {
      const raf = requestAnimationFrame(read);
      return () => cancelAnimationFrame(raf);
    }

    const observer = new ResizeObserver(() => {
      if (read()) observer.disconnect();
    });
    observer.observe(content);
    return () => observer.disconnect();
  });

  useTransformEffect(({ instance }) => {
    syncFromInstance(instance);
  });

  if (transform.contentHeight <= 0 || transform.contentWidth <= 0) return null;

  const { offsetY, renderedH } = svgMeetYMaxLayout(
    transform.contentWidth,
    transform.contentHeight,
    chartWidth,
    chartHeight,
  );

  return (
    <div className="course-scorecard-chart-y-axis" aria-hidden>
      {ticks.map((tick) => {
        if (tick === 0) return null;
        const top =
          transform.positionY +
          (offsetY + (yFor(tick) / chartHeight) * renderedH) * transform.scale;
        return (
          <span
            key={tick}
            className="course-scorecard-chart-y-axis-tick"
            style={{ top: `${top}px` }}
          >
            {tick}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Keeps the chart anchored to the bottom of the zoom viewport so the X-axis
 * stays visible and bars grow upward instead of getting clipped underneath.
 */
function ScorecardPinBaselineToBottom() {
  const correctingRef = useRef(false);

  useTransformEffect(({ state, instance }) => {
    if (correctingRef.current) return;

    const wrapper = instance.wrapperComponent;
    const content = instance.contentComponent;
    if (!wrapper || !content) return;

    const wrapperH = wrapper.clientHeight;
    const contentH = content.offsetHeight;
    if (wrapperH <= 0 || contentH <= 0) return;

    const pinnedY = wrapperH - contentH * state.scale;
    if (Math.abs(state.positionY - pinnedY) < 0.35) return;

    correctingRef.current = true;
    instance.setState(state.scale, state.positionX, pinnedY);
    correctingRef.current = false;
  });

  return null;
}

function ScorecardZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="course-scorecard-chart-zoom-controls" role="group" aria-label="Chart zoom">
      <button
        type="button"
        className="course-scorecard-chart-zoom-btn"
        aria-label="Zoom in"
        onClick={() => zoomIn(0.35, 160)}
      >
        +
      </button>
      <button
        type="button"
        className="course-scorecard-chart-zoom-btn"
        aria-label="Zoom out"
        onClick={() => zoomOut(0.35, 160)}
      >
        −
      </button>
      <button
        type="button"
        className="course-scorecard-chart-zoom-btn course-scorecard-chart-zoom-btn-reset"
        aria-label="Reset zoom"
        onClick={() => resetTransform(160)}
      >
        Reset
      </button>
    </div>
  );
}

function parseChartValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return null;
  const value = Number.parseFloat(trimmed.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function niceStep(range: number, targetTicks: number): number {
  if (range <= 0) return 1;
  const rough = range / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildYTicks(min: number, max: number, count = 5): number[] {
  if (max <= min) return [min];
  const step = niceStep(max - min, count);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.001; value += step) {
    if (value >= min - step * 0.001) ticks.push(Math.round(value * 10) / 10);
  }
  return ticks.length ? ticks : [min, max];
}

const INACTIVE_BAR_FILL = "rgba(255,255,255,0.28)";
const BAR_ACCENT_HEIGHT = 4;
const BAR_CORNER_RADIUS = 3;
/** Extra handicap units below 18 so easiest holes still show a visible bar. */
const HDCP_AXIS_BOTTOM_PAD = 2;

/** Red (1 hdcp) → green (18 hdcp) through warm spectrum stops. */
const HDCP_ACCENT_STOPS: readonly [number, number, number][] = [
  [229, 57, 53],
  [255, 87, 34],
  [255, 152, 0],
  [255, 193, 7],
  [255, 235, 59],
  [205, 220, 57],
  [76, 175, 80],
];

function interpolateRgb(
  stops: readonly [number, number, number][],
  t: number,
): string {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  const fraction = scaled - index;
  const from = stops[index];
  const to = stops[index + 1];
  const r = Math.round(from[0] + (to[0] - from[0]) * fraction);
  const g = Math.round(from[1] + (to[1] - from[1]) * fraction);
  const b = Math.round(from[2] + (to[2] - from[2]) * fraction);
  return `rgb(${r}, ${g}, ${b})`;
}

function handicapAccentColor(handicap: number): string {
  const t = (Math.min(18, Math.max(1, handicap)) - 1) / 17;
  return interpolateRgb(HDCP_ACCENT_STOPS, t);
}

function inactiveBarAccentColor(
  mode: ScorecardChartMode,
  value: number,
  teeColor: string,
): string {
  return mode === "yardage" ? teeColor : handicapAccentColor(value);
}

/** Top-rounded accent cap; bottom edge is square and flush with the bar width. */
function barAccentPath(
  x: number,
  y: number,
  width: number,
  height: number,
  topRadius: number,
  bottomRadius = 0,
): string {
  if (height <= 0 || width <= 0) return "";
  const topR = Math.min(topRadius, width / 2, height);
  const bottomR =
    bottomRadius > 0
      ? Math.min(bottomRadius, width / 2, height)
      : 0;

  if (topR <= 0 && bottomR <= 0) {
    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  }

  if (bottomR <= 0) {
    return [
      `M ${x + topR} ${y}`,
      `H ${x + width - topR}`,
      `A ${topR} ${topR} 0 0 1 ${x + width} ${y + topR}`,
      `V ${y + height}`,
      `H ${x}`,
      `V ${y + topR}`,
      `A ${topR} ${topR} 0 0 1 ${x + topR} ${y}`,
      "Z",
    ].join(" ");
  }

  return [
    `M ${x + topR} ${y}`,
    `H ${x + width - topR}`,
    `A ${topR} ${topR} 0 0 1 ${x + width} ${y + topR}`,
    `V ${y + height - bottomR}`,
    `A ${bottomR} ${bottomR} 0 0 1 ${x + width - bottomR} ${y + height}`,
    `H ${x + bottomR}`,
    `A ${bottomR} ${bottomR} 0 0 1 ${x} ${y + height - bottomR}`,
    `V ${y + topR}`,
    `A ${topR} ${topR} 0 0 1 ${x + topR} ${y}`,
    "Z",
  ].join(" ");
}

/** Inactive bar body: square top (meets accent), rounded bottom corners only. */
function inactiveBarBodyPath(
  x: number,
  y: number,
  width: number,
  height: number,
  bottomRadius: number,
): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.min(bottomRadius, width / 2, height);
  if (r <= 0) {
    return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  }
  return [
    `M ${x} ${y}`,
    `H ${x + width}`,
    `V ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `H ${x + r}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    "Z",
  ].join(" ");
}

export function ScorecardChartOverlay({
  open,
  holeCount,
  activeHole,
  teeColor,
  tee,
  teeOptions = [],
  selectedTee = 0,
  onTeeSelect,
  onHoleSelect,
  onClose,
  showGenderToggle = false,
  scorecardGender = "men",
  onGenderChange,
  totalPar,
  allTeeYardages,
}: ScorecardChartOverlayProps) {
  const [mode, setMode] = useState<ScorecardChartMode>("yardage");
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [maxZoomScale, setMaxZoomScale] = useState(1);
  const zoomFrameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
    const update = () => setIsMobilePortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Stop Safari page-pinch from eating chart gestures. Chrome trackpad pinch is
  // ctrl+wheel — that must reach react-zoom-pan-pinch, so we don't block wheel here.
  useEffect(() => {
    if (!open || !isMobilePortrait) return;

    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinchTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };

    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);
    document.addEventListener("touchmove", preventPinchTouch, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventPinchTouch);
    };
  }, [open, isMobilePortrait]);

  const holes = useMemo(
    () => Array.from({ length: holeCount }, (_, index) => index + 1),
    [holeCount],
  );

  const points = useMemo(() => {
    const source = mode === "yardage" ? tee.yardages : tee.handicaps;
    return holes.map((hole) => ({
      hole,
      value: parseChartValue(source[hole]),
    }));
  }, [holes, mode, tee.handicaps, tee.yardages]);

  const yardageAxisValues = useMemo(() => {
    if (allTeeYardages?.length) {
      const values: number[] = [];
      for (const teeYardages of allTeeYardages) {
        for (const hole of holes) {
          const value = parseChartValue(String(teeYardages[hole] ?? ""));
          if (value != null) values.push(value);
        }
      }
      return values;
    }
    return points
      .map((point) => point.value)
      .filter((v): v is number => v != null);
  }, [allTeeYardages, holes, points]);

  const scale = useMemo(() => {
    if (mode === "handicap") {
      const values = points
        .map((point) => point.value)
        .filter((v): v is number => v != null);
      if (!values.length) {
        return { min: 1, max: 18, ticks: [1, 3, 6, 9, 12, 15, 18] };
      }
      const rawMax = Math.max(...values);
      const min = 1;
      const max = Math.max(18, Math.ceil(rawMax));
      return { min, max, ticks: buildYTicks(min, max, 6) };
    }

    if (!yardageAxisValues.length) {
      return { min: 0, max: 600, ticks: [0, 150, 300, 450, 600] };
    }

    const rawMax = Math.max(...yardageAxisValues);
    const min = 0;
    const padding = Math.max(20, rawMax * 0.08);
    const max = Math.ceil((rawMax + padding) / 10) * 10;
    return { min, max, ticks: buildYTicks(min, max, 5) };
  }, [mode, points, yardageAxisValues]);

  const topAxisSvgY = useMemo(() => {
    const margin = SCORECARD_CHART_MARGIN;
    const innerH =
      SCORECARD_CHART_HEIGHT - margin.top - margin.bottom;
    const range = Math.max(scale.max - scale.min, 1);

    const yForValue = (value: number) => {
      const ratio = (value - scale.min) / range;
      if (mode === "handicap") {
        const plotHeight = innerH * (range / (range + HDCP_AXIS_BOTTOM_PAD));
        return margin.top + ratio * plotHeight;
      }
      return margin.top + innerH - ratio * innerH;
    };

    // Same rule for both charts: keep the label at the top of the y-axis in view.
    // Yardage: largest yardage. HDCP: hardest hole (1) sits at the top of the scale.
    const topAxisValue = mode === "handicap" ? scale.min : scale.max;
    return yForValue(topAxisValue);
  }, [mode, scale.max, scale.min]);

  useEffect(() => {
    if (!open || !isMobilePortrait) {
      setMaxZoomScale(1);
      return;
    }

    let observer: ResizeObserver | null = null;
    let raf = 0;

    const attach = () => {
      const frame = zoomFrameRef.current;
      if (!frame) {
        raf = requestAnimationFrame(attach);
        return;
      }

      const update = () => {
        const rect = frame.getBoundingClientRect();
        setMaxZoomScale(
          maxZoomForViewport(rect.width, rect.height, topAxisSvgY),
        );
      };

      update();
      observer = new ResizeObserver(update);
      observer.observe(frame);
    };

    attach();
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [open, isMobilePortrait, topAxisSvgY, mode]);

  if (!open) return null;

  const chartWidth = SCORECARD_CHART_WIDTH;
  const chartHeight = SCORECARD_CHART_HEIGHT;
  const margin = SCORECARD_CHART_MARGIN;
  const innerW = chartWidth - margin.left - margin.right;
  const innerH = chartHeight - margin.top - margin.bottom;
  const barGap = innerW / holeCount;
  const barWidth = Math.max(8, barGap * 0.76);
  const chartBaseline = margin.top + innerH;
  const holeLabelInset = 10;

  const yFor = (value: number) => {
    const range = Math.max(scale.max - scale.min, 1);
    const ratio = (value - scale.min) / range;
    if (mode === "handicap") {
      const plotHeight = innerH * (range / (range + HDCP_AXIS_BOTTOM_PAD));
      return margin.top + ratio * plotHeight;
    }
    return margin.top + innerH - ratio * innerH;
  };

  const plotInsetStyle = {
    "--chart-plot-inset-left": `${(margin.left / chartWidth) * 100}%`,
    "--chart-plot-inset-right": `${(margin.right / chartWidth) * 100}%`,
  } as CSSProperties;

  return (
    <div
      className="course-scorecard-chart pointer-events-auto"
      role="dialog"
      aria-label={`${tee.name} scorecard chart`}
    >
      <div className="course-scorecard-chart-inner">
        <div className="course-scorecard-chart-toolbar">
          <div className="course-scorecard-chart-toolbar-title min-w-0">
            {totalPar?.trim() ? (
              <p className="truncate font-sans text-lg uppercase text-white md:text-xl">
                PAR {totalPar.trim()}
              </p>
            ) : null}
            <p className="mt-0.5 truncate font-sans text-lg uppercase text-white md:text-xl">
              {tee.name}
            </p>
          </div>

          <div className="course-scorecard-chart-toolbar-controls">
            <div
              className="course-scorecard-chart-mode-toggle shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/35 font-semibold uppercase backdrop-blur-md"
              role="group"
              aria-label="Scorecard chart mode"
            >
              <button
                type="button"
                onClick={() => setMode("yardage")}
                className={`course-scorecard-chart-toggle-btn transition ${
                  mode === "yardage"
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                YDG
              </button>
              <button
                type="button"
                onClick={() => setMode("handicap")}
                className={`course-scorecard-chart-toggle-btn transition ${
                  mode === "handicap"
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                HDCP
              </button>
            </div>

            {showGenderToggle ? (
              <div
                className="course-scorecard-chart-gender-toggle flex shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/35 font-semibold uppercase backdrop-blur-md"
                role="group"
                aria-label="Scorecard gender"
              >
                <button
                  type="button"
                  onClick={() => onGenderChange?.("men")}
                  aria-label="Men's"
                  className={`course-scorecard-chart-toggle-btn transition ${
                    scorecardGender === "men"
                      ? "bg-white/20 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={() => onGenderChange?.("women")}
                  aria-label="Women's"
                  className={`course-scorecard-chart-toggle-btn transition ${
                    scorecardGender === "women"
                      ? "bg-white/20 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  W
                </button>
              </div>
            ) : null}
          </div>

          <PanelCloseButton onClose={onClose} label="Close scorecard" />
        </div>

        <div className="course-scorecard-chart-plot" style={plotInsetStyle}>
          <div className="course-scorecard-chart-stack">
            {(() => {
              const renderChartBody = (showYAxisLabels: boolean): ReactNode => (
                <div className="course-scorecard-chart-body">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    preserveAspectRatio="xMidYMax meet"
                    className="h-full w-full"
                    aria-hidden
                  >
                    <rect
                      x={margin.left}
                      y={margin.top}
                      width={innerW}
                      height={innerH}
                      fill="rgba(255,255,255,0.02)"
                      rx={8}
                    />

                    {scale.ticks.map((tick) => {
                      const y = yFor(tick);
                      return (
                        <g key={tick}>
                          <line
                            x1={margin.left}
                            x2={margin.left + innerW}
                            y1={y}
                            y2={y}
                            stroke="rgba(255,255,255,0.08)"
                          />
                          {showYAxisLabels && tick !== 0 ? (
                            <text
                              x={margin.left - 10}
                              y={y + 4}
                              textAnchor="end"
                              fill="rgba(255,255,255,0.45)"
                              fontSize={12}
                            >
                              {tick}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}

                    {points.map((point, index) => {
                      const centerX = margin.left + barGap * index + barGap / 2;
                      const x = Math.round(centerX - barWidth / 2);
                      const width = Math.round(barWidth);
                      const isActive = point.hole === activeHole;
                      const hasValue = point.value != null;
                      const holeLabelY = chartBaseline - holeLabelInset;

                      if (!hasValue) {
                        return (
                          <g key={point.hole}>
                            <text
                              x={centerX}
                              y={holeLabelY}
                              textAnchor="middle"
                              fill={isActive ? "#fff" : "rgba(255,255,255,0.45)"}
                              fontSize={12}
                              fontWeight={isActive ? 600 : 400}
                            >
                              {point.hole}
                            </text>
                          </g>
                        );
                      }

                      const value = point.value!;
                      const barTop = yFor(value);
                      const barHeight = Math.max(2, chartBaseline - barTop);
                      const accentHeight = Math.min(BAR_ACCENT_HEIGHT, barHeight);
                      const bodyHeight = barHeight - accentHeight;
                      const accentColor = inactiveBarAccentColor(mode, value, teeColor);
                      const holeSelectProps = onHoleSelect
                        ? {
                            className: "cursor-pointer" as const,
                            onClick: () => onHoleSelect(point.hole),
                          }
                        : {};

                      return (
                        <g key={point.hole}>
                          <g {...holeSelectProps} shapeRendering="geometricPrecision">
                            {bodyHeight > 0 ? (
                              <path
                                d={inactiveBarBodyPath(
                                  x,
                                  barTop + accentHeight,
                                  width,
                                  bodyHeight,
                                  BAR_CORNER_RADIUS,
                                )}
                                fill={isActive ? teeColor : INACTIVE_BAR_FILL}
                              />
                            ) : null}
                            <path
                              d={barAccentPath(
                                x,
                                barTop,
                                width,
                                accentHeight,
                                BAR_CORNER_RADIUS,
                                bodyHeight > 0 ? 0 : BAR_CORNER_RADIUS,
                              )}
                              fill={accentColor}
                            />
                          </g>
                          {isActive ? (
                            <text
                              x={centerX}
                              y={Math.max(margin.top + 14, barTop - 8)}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize={11}
                              fontWeight={600}
                            >
                              {value}
                            </text>
                          ) : null}
                          <text
                            x={centerX}
                            y={holeLabelY}
                            textAnchor="middle"
                            fill={isActive ? "#fff" : "rgba(255,255,255,0.85)"}
                            fontSize={12}
                            fontWeight={isActive ? 600 : 500}
                          >
                            {point.hole}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );

              return isMobilePortrait ? (
                <div className="course-scorecard-chart-zoom">
                  <div
                    ref={zoomFrameRef}
                    className="course-scorecard-chart-zoom-frame"
                  >
                    <TransformWrapper
                      key={`${mode}-${selectedTee}-${scorecardGender}`}
                      initialScale={1}
                      minScale={1}
                      maxScale={maxZoomScale}
                      limitToBounds={false}
                      // Chrome/macOS trackpad "pinch" arrives as ctrl+wheel.
                      // wheelDisabled keeps normal scrolling from zooming.
                      wheel={{ step: 0.12, wheelDisabled: true }}
                      pinch={{ step: 4, disabled: false }}
                      doubleClick={{
                        mode: "toggle",
                        step: Math.max(0.25, maxZoomScale - 1),
                      }}
                      panning={{
                        velocityDisabled: true,
                        lockAxisY: true,
                      }}
                      // Prevent the library from vertically re-centering after pinch.
                      autoAlignment={{ disabled: true }}
                      zoomAnimation={{ disabled: true }}
                    >
                      <ScorecardPinBaselineToBottom />
                      <ScorecardLockedYAxis
                        ticks={scale.ticks}
                        chartWidth={chartWidth}
                        chartHeight={chartHeight}
                        yFor={yFor}
                      />
                      <TransformComponent
                        wrapperClass="course-scorecard-chart-zoom-wrapper"
                        contentClass="course-scorecard-chart-zoom-content"
                      >
                        {renderChartBody(false)}
                      </TransformComponent>
                      <ScorecardZoomControls />
                    </TransformWrapper>
                  </div>
                  <p className="course-scorecard-chart-zoom-hint">
                    Pinch or use + / − · Drag sideways · Double-tap to enlarge
                  </p>
                </div>
              ) : (
                renderChartBody(true)
              );
            })()}

            {teeOptions.length > 1 ? (
              <div className="course-scorecard-chart-tee-bar">
                {teeOptions.map((option) => {
                  const isSelected = selectedTee === option.index;
                  const ratingLabel = formatTeeRating(
                    option.courseRating,
                    option.slopeRating,
                  );
                  return (
                    <button
                      key={option.index}
                      type="button"
                      onClick={() => onTeeSelect?.(option.index)}
                      className={`course-scorecard-chart-tee-btn tabular-nums ${
                        isSelected
                          ? "course-scorecard-chart-tee-btn-active text-white"
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
                        ratingLabel
                          ? `${option.totalYards} yards, rating ${ratingLabel}`
                          : `${option.totalYards} yards`
                      }
                      aria-pressed={isSelected}
                    >
                      <span
                        className={
                          isSelected
                            ? "course-scorecard-chart-tee-yards-active"
                            : "course-scorecard-chart-tee-yards"
                        }
                      >
                        {option.totalYards}
                      </span>
                      {isSelected && ratingLabel ? (
                        <span className="course-scorecard-chart-tee-rating">
                          {ratingLabel}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
