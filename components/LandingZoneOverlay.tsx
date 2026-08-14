"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  containedMediaRect,
  pointerToMediaPercent,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";
import {
  landingZoneIsReady,
  midpointPercent,
  pointToMediaPx,
  resolveLandingZoneTee,
  yardsForSegment,
  type LandingZoneData,
  type LandingZonePoint,
} from "@/lib/landing-zone";

type LandingZoneOverlayProps = {
  contentRef: RefObject<HTMLDivElement | null>;
  landingZone?: LandingZoneData | null;
  selectedTeeIndex?: number;
  visible?: boolean;
};

function readImageDimensions(
  img: HTMLImageElement,
): { width: number; height: number } | null {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  return null;
}

function findHoleGraphicImage(
  container: HTMLElement | null,
): HTMLImageElement | null {
  if (!container) return null;
  return container.querySelector<HTMLImageElement>(
    ".course-hole-graphic-panel-media",
  );
}

function formatYards(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value}`;
}

export function LandingZoneOverlay({
  contentRef,
  landingZone,
  selectedTeeIndex = 0,
  visible = true,
}: LandingZoneOverlayProps) {
  const ready = landingZoneIsReady(landingZone);
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const [mediaSize, setMediaSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [target, setTarget] = useState<LandingZonePoint | null>(null);
  const [dragging, setDragging] = useState(false);

  const tee = useMemo(() => {
    if (!ready || !landingZone) return null;
    return resolveLandingZoneTee(landingZone, selectedTeeIndex);
  }, [landingZone, ready, selectedTeeIndex]);

  const green = ready && landingZone ? landingZone.green : null;

  useEffect(() => {
    if (!ready || !tee || !green) {
      setTarget(null);
      return;
    }
    setTarget(midpointPercent(tee, green));
  }, [green, ready, selectedTeeIndex, tee]);

  const updateMediaRect = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    const img = findHoleGraphicImage(container);
    if (!img) return;
    const dimensions = readImageDimensions(img);
    if (!dimensions) return;

    const containerRect = container.getBoundingClientRect();
    setMediaSize(dimensions);
    setMediaRect(
      containedMediaRect(
        containerRect.width,
        containerRect.height,
        dimensions.width,
        dimensions.height,
      ),
    );
  }, [contentRef]);

  useEffect(() => {
    if (!ready || !visible) return;

    updateMediaRect();
    window.addEventListener("resize", updateMediaRect);

    const container = contentRef.current;
    const img = findHoleGraphicImage(container);
    if (img && !img.complete) {
      img.addEventListener("load", updateMediaRect);
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(() => updateMediaRect())
        : null;
    if (container) resizeObserver?.observe(container);

    return () => {
      window.removeEventListener("resize", updateMediaRect);
      img?.removeEventListener("load", updateMediaRect);
      resizeObserver?.disconnect();
    };
  }, [contentRef, ready, updateMediaRect, visible]);

  const setTargetFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const container = contentRef.current;
      if (!container || !mediaRect) return;
      const rect = container.getBoundingClientRect();
      const coords = pointerToMediaPercent(
        event.clientX,
        event.clientY,
        rect,
        mediaRect,
      );
      if (!coords) return;
      setTarget(coords);
    },
    [contentRef, mediaRect],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      setTargetFromPointer(event);
    },
    [setTargetFromPointer],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setTargetFromPointer(event);
    },
    [dragging, setTargetFromPointer],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  if (!ready || !visible || !landingZone || !tee || !green || !target) {
    return null;
  }
  if (!mediaRect || !mediaSize) return null;

  const teePx = pointToMediaPx(tee, mediaRect.width, mediaRect.height);
  const greenPx = pointToMediaPx(green, mediaRect.width, mediaRect.height);
  const targetPx = pointToMediaPx(target, mediaRect.width, mediaRect.height);

  const teeToTarget = yardsForSegment(
    tee,
    target,
    green,
    landingZone.markers,
    mediaSize.width,
    mediaSize.height,
  );
  const targetToGreen = yardsForSegment(
    target,
    green,
    green,
    landingZone.markers,
    mediaSize.width,
    mediaSize.height,
  );

  const teeLabel = {
    x: (teePx.x + targetPx.x) / 2,
    y: (teePx.y + targetPx.y) / 2,
  };
  const greenLabel = {
    x: (targetPx.x + greenPx.x) / 2,
    y: (targetPx.y + greenPx.y) / 2,
  };

  const layerStyle = {
    left: mediaRect.left,
    top: mediaRect.top,
    width: mediaRect.width,
    height: mediaRect.height,
  };

  return (
    <div
      className="course-hole-graphic-landing-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="presentation"
      aria-label="Landing zone distance ruler"
    >
      <div className="course-hole-graphic-landing-layer" style={layerStyle}>
        <svg
          className="course-hole-graphic-landing-svg"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${mediaRect.width} ${mediaRect.height}`}
          preserveAspectRatio="none"
        >
          <line
            x1={teePx.x}
            y1={teePx.y}
            x2={targetPx.x}
            y2={targetPx.y}
            className="course-hole-graphic-landing-line"
          />
          <line
            x1={targetPx.x}
            y1={targetPx.y}
            x2={greenPx.x}
            y2={greenPx.y}
            className="course-hole-graphic-landing-line course-hole-graphic-landing-line--to-green"
          />
          <circle
            cx={teePx.x}
            cy={teePx.y}
            r={5}
            className="course-hole-graphic-landing-tee"
          />
          <circle
            cx={greenPx.x}
            cy={greenPx.y}
            r={5}
            className="course-hole-graphic-landing-green"
          />
          <g className="course-hole-graphic-landing-label">
            <rect
              x={teeLabel.x - 22}
              y={teeLabel.y - 12}
              width={44}
              height={20}
              rx={4}
              className="course-hole-graphic-landing-label-bg"
            />
            <text
              x={teeLabel.x}
              y={teeLabel.y + 4}
              textAnchor="middle"
              className="course-hole-graphic-landing-label-text"
            >
              {formatYards(teeToTarget)}
            </text>
          </g>
          <g className="course-hole-graphic-landing-label">
            <rect
              x={greenLabel.x - 22}
              y={greenLabel.y - 12}
              width={44}
              height={20}
              rx={4}
              className="course-hole-graphic-landing-label-bg"
            />
            <text
              x={greenLabel.x}
              y={greenLabel.y + 4}
              textAnchor="middle"
              className="course-hole-graphic-landing-label-text"
            >
              {formatYards(targetToGreen)}
            </text>
          </g>
          <g
            className="course-hole-graphic-landing-reticle"
            style={{ pointerEvents: "none" }}
          >
            <circle cx={targetPx.x} cy={targetPx.y} r={14} fill="none" />
            <circle cx={targetPx.x} cy={targetPx.y} r={3} />
            <line
              x1={targetPx.x - 18}
              y1={targetPx.y}
              x2={targetPx.x - 8}
              y2={targetPx.y}
            />
            <line
              x1={targetPx.x + 8}
              y1={targetPx.y}
              x2={targetPx.x + 18}
              y2={targetPx.y}
            />
            <line
              x1={targetPx.x}
              y1={targetPx.y - 18}
              x2={targetPx.x}
              y2={targetPx.y - 8}
            />
            <line
              x1={targetPx.x}
              y1={targetPx.y + 8}
              x2={targetPx.x}
              y2={targetPx.y + 18}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
