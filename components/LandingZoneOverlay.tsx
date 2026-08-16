"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { SWIPE_SCRUB_THRESHOLD_PX } from "@/hooks/useForwardScrollToVideo";
import {
  clampPercent,
  containedMediaRect,
  pointerToMediaPercent,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";
import {
  cameraPathHasTrack,
  sampleCameraPathAtProgress,
  type CameraPathPoint,
} from "@/lib/camera-path";
import {
  greenCalibrationMarkers,
  landingZoneIsReady,
  midpointPercent,
  pointToMediaPx,
  progressAtMatchingGreenDistance,
  resolveFurthestBackTee,
  resolveLandingZoneTee,
  yardsFromGreen,
  yardsFromSelectedTee,
  type LandingZoneData,
  type LandingZonePoint,
} from "@/lib/landing-zone";

type LandingZoneOverlayProps = {
  contentRef: RefObject<HTMLDivElement | null>;
  landingZone?: LandingZoneData | null;
  selectedTeeIndex?: number;
  cameraPath?: CameraPathPoint[] | null;
  progress?: number;
  onPathSeek?: (progress: number) => void;
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
  cameraPath,
  progress = 0,
  onPathSeek,
  visible = true,
}: LandingZoneOverlayProps) {
  const ready = landingZoneIsReady(landingZone);
  const hasPath = cameraPathHasTrack(cameraPath);
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const [mediaSize, setMediaSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<LandingZonePoint | null>(null);
  /** Finger position and reticle position captured when a touch drag starts. */
  const touchDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    target: LandingZonePoint;
  } | null>(null);
  const touchSwipedRef = useRef(false);
  const touchDraggingRef = useRef(false);
  const dragProgressRef = useRef<number | null>(null);

  const tee = useMemo(() => {
    if (!ready || !landingZone) return null;
    return resolveLandingZoneTee(landingZone, selectedTeeIndex);
  }, [landingZone, ready, selectedTeeIndex]);

  const green = ready && landingZone ? landingZone.green : null;

  const syncedTarget = useMemo(() => {
    if (!tee || !green) return null;
    if (hasPath) {
      const sample = sampleCameraPathAtProgress(cameraPath, progress);
      if (sample) return { x: sample.x, y: sample.y };
    }
    return midpointPercent(tee, green);
  }, [cameraPath, green, hasPath, progress, tee]);

  const target = hoverTarget ?? syncedTarget;

  useEffect(() => {
    setHoverTarget(null);
  }, [cameraPath, landingZone, selectedTeeIndex]);

  // A finger can't hover, so the reticle stays where a drag left it and the
  // yardages stay readable. It resumes tracking the drone as soon as the
  // flyover moves again on its own.
  useEffect(() => {
    if (!hoverTarget) return;
    if (touchDraggingRef.current) {
      dragProgressRef.current = progress;
      return;
    }
    if (dragProgressRef.current == null || dragProgressRef.current === progress) {
      return;
    }
    dragProgressRef.current = null;
    setHoverTarget(null);
  }, [hoverTarget, progress]);

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

  const coordsFromPointer = useCallback(
    (clientX: number, clientY: number): LandingZonePoint | null => {
      const container = contentRef.current;
      if (!container || !mediaRect) return null;
      const rect = container.getBoundingClientRect();
      return pointerToMediaPercent(clientX, clientY, rect, mediaRect);
    },
    [contentRef, mediaRect],
  );

  // Touch drags are driven by the touch handlers below, which have to keep the
  // reticle put once the finger lifts — pointer events for a touch end with a
  // leave that would wipe the reading.
  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      const coords = coordsFromPointer(event.clientX, event.clientY);
      if (!coords) {
        setHoverTarget(null);
        return;
      }
      setHoverTarget(coords);
    },
    [coordsFromPointer],
  );

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch") return;
      setHoverTarget(null);
    },
    [],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0];
      touchDragStartRef.current =
        touch && target
          ? { clientX: touch.clientX, clientY: touch.clientY, target }
          : null;
      touchSwipedRef.current = false;
      touchDraggingRef.current = true;
      dragProgressRef.current = null;
    },
    [target],
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const start = touchDragStartRef.current;
      const touch = event.touches[0];
      if (!start || !touch || !mediaRect) return;

      const dx = touch.clientX - start.clientX;
      const dy = touch.clientY - start.clientY;

      // Relative drag: the reticle keeps its offset from the finger, so it
      // stays visible while you slide. The vertical component of the same
      // gesture still scrubs (panel's scroll forwarding).
      setHoverTarget({
        x: clampPercent(start.target.x + (dx / mediaRect.width) * 100),
        y: clampPercent(start.target.y + (dy / mediaRect.height) * 100),
      });

      if (touchSwipedRef.current) return;
      if (
        Math.abs(dx) > SWIPE_SCRUB_THRESHOLD_PX ||
        Math.abs(dy) > SWIPE_SCRUB_THRESHOLD_PX
      ) {
        touchSwipedRef.current = true;
      }
    },
    [mediaRect],
  );

  const handleTouchEnd = useCallback(() => {
    touchDraggingRef.current = false;
    touchDragStartRef.current = null;
  }, []);

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      // Browsers still emit a click after a swipe that scrubbed the flyover.
      if (touchSwipedRef.current) {
        touchSwipedRef.current = false;
        return;
      }

      const coords = coordsFromPointer(event.clientX, event.clientY);
      if (!coords) return;

      if (hasPath && onPathSeek && landingZone && mediaRect && mediaSize) {
        const calibrationMarkers = greenCalibrationMarkers(landingZone);
        const greenPoint = landingZone.green;
        const nextProgress = progressAtMatchingGreenDistance(
          cameraPath,
          coords,
          greenPoint,
          calibrationMarkers,
          mediaSize.width,
          mediaSize.height,
        );
        if (nextProgress != null) onPathSeek(nextProgress);
        setHoverTarget(null);
        return;
      }

      setHoverTarget(coords);
    },
    [
      cameraPath,
      coordsFromPointer,
      hasPath,
      landingZone,
      mediaRect,
      mediaSize,
      onPathSeek,
    ],
  );

  if (!ready || !visible || !landingZone || !tee || !green || !target) {
    return null;
  }
  if (!mediaRect || !mediaSize) return null;

  const teePx = pointToMediaPx(tee, mediaRect.width, mediaRect.height);
  const greenPx = pointToMediaPx(green, mediaRect.width, mediaRect.height);
  const targetPx = pointToMediaPx(target, mediaRect.width, mediaRect.height);

  const calibrationMarkers = greenCalibrationMarkers(landingZone);

  const teeToTarget = yardsFromSelectedTee(
    tee,
    target,
    green,
    resolveFurthestBackTee(landingZone),
    calibrationMarkers,
    mediaSize.width,
    mediaSize.height,
  );
  const targetToGreen = yardsFromGreen(
    target,
    green,
    calibrationMarkers,
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
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleClick}
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
