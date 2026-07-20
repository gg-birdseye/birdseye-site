"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefObject,
} from "react";
import {
  containedMediaRect,
  type ContainedMediaRect,
} from "@/lib/aerial-map-geometry";
import {
  buildClippedCirclePath,
  pinToMediaPx,
  resolveArcAllowTest,
  sortMarkersByYards,
  yardageArcsAreReady,
  yardageMarkerRadiusPx,
  type YardageArcsData,
} from "@/lib/yardage-arcs";
import type { YardageArcRender } from "@/lib/sanity/courses";

type YardageArcOverlayProps = {
  contentRef: RefObject<HTMLElement | null>;
  graphicSrc?: string | null;
  graphicCdnSrc?: string | null;
  yardageArcs?: YardageArcsData | null;
  /** Server-precomputed clipped paths (preferred). */
  yardageArcRender?: YardageArcRender | null;
  visible?: boolean;
};

function readImageDimensions(
  img: HTMLImageElement,
): { width: number; height: number } {
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  return { width: 480, height: 1080 };
}

function findHoleGraphicImage(
  container: HTMLElement | null,
): HTMLImageElement | null {
  return (
    container?.querySelector<HTMLImageElement>(
      ".course-hole-graphic-panel-media",
    ) ?? null
  );
}

export function YardageArcOverlay({
  contentRef,
  yardageArcs,
  yardageArcRender,
  visible = true,
}: YardageArcOverlayProps) {
  const [mediaRect, setMediaRect] = useState<ContainedMediaRect | null>(null);
  const ready = yardageArcsAreReady(yardageArcs);
  const hasServerPaths = Boolean(yardageArcRender?.paths?.length);

  const markers = useMemo(
    () => (ready ? sortMarkersByYards(yardageArcs.markers) : []),
    [ready, yardageArcs],
  );

  const updateMediaRect = useCallback(() => {
    const container = contentRef.current;
    const img = findHoleGraphicImage(container);
    if (!container || !img) return;

    const dimensions = readImageDimensions(img);
    const fitted = containedMediaRect(
      img.clientWidth,
      img.clientHeight,
      dimensions.width,
      dimensions.height,
    );
    if (!fitted) return;

    setMediaRect({
      left: img.offsetLeft + fitted.left,
      top: img.offsetTop + fitted.top,
      width: fitted.width,
      height: fitted.height,
    });
  }, [contentRef]);

  useEffect(() => {
    if (!ready && !hasServerPaths) {
      setMediaRect(null);
      return;
    }

    updateMediaRect();
    window.addEventListener("resize", updateMediaRect);

    const container = contentRef.current;
    const img = findHoleGraphicImage(container);
    const onImageLoad = () => updateMediaRect();

    if (img) {
      img.addEventListener("load", onImageLoad);
      if (img.complete) onImageLoad();
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(() => updateMediaRect())
        : null;
    if (container) resizeObserver?.observe(container);
    if (img) resizeObserver?.observe(img);

    return () => {
      window.removeEventListener("resize", updateMediaRect);
      img?.removeEventListener("load", onImageLoad);
      resizeObserver?.disconnect();
    };
  }, [contentRef, ready, hasServerPaths, updateMediaRect, yardageArcs]);

  const arcPaths = useMemo(() => {
    if (!mediaRect) return [];

    // Preferred: server already clipped paths to the playable area.
    if (yardageArcRender?.paths?.length) {
      return yardageArcRender.paths.map((arc, index) => ({
        key: `${arc.yards}-${index}`,
        pathD: arc.pathD,
        labelX: arc.labelX,
        labelY: arc.labelY,
        yards: arc.yards,
      }));
    }

    if (!ready) return [];

    // Fallback (dev / missing server render): unclipped or custom-clip only.
    const pin = yardageArcs.pin;
    const center = pinToMediaPx(pin, mediaRect.width, mediaRect.height);
    const isAllowed = resolveArcAllowTest(
      yardageArcs.arcClip,
      null,
      mediaRect.width,
      mediaRect.height,
    );

    return markers.map((marker, index) => {
      const radius = yardageMarkerRadiusPx(
        pin,
        marker,
        mediaRect.width,
        mediaRect.height,
      );
      return {
        key: `${marker.yards}-${index}`,
        pathD: buildClippedCirclePath(center.x, center.y, radius, isAllowed),
        labelX: (marker.x / 100) * mediaRect.width,
        labelY: (marker.y / 100) * mediaRect.height,
        yards: marker.yards,
      };
    });
  }, [markers, mediaRect, ready, yardageArcRender, yardageArcs]);

  if (!visible || !mediaRect) return null;
  if (!hasServerPaths && !ready) return null;

  const viewW = yardageArcRender?.width || mediaRect.width;
  const viewH = yardageArcRender?.height || mediaRect.height;
  const pinX =
    yardageArcRender?.pinX ??
    (ready ? pinToMediaPx(yardageArcs.pin, mediaRect.width, mediaRect.height).x : 0);
  const pinY =
    yardageArcRender?.pinY ??
    (ready ? pinToMediaPx(yardageArcs.pin, mediaRect.width, mediaRect.height).y : 0);

  return (
    <div className="course-hole-graphic-yardage-overlay" aria-hidden>
      <div
        className="course-hole-graphic-yardage-layer"
        style={{
          left: `${mediaRect.left}px`,
          top: `${mediaRect.top}px`,
          width: `${mediaRect.width}px`,
          height: `${mediaRect.height}px`,
        }}
      >
        <svg
          className="course-hole-graphic-yardage-svg"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="none"
        >
          {arcPaths.map((arc) =>
            arc.pathD ? (
              <path
                key={arc.key}
                d={arc.pathD}
                className="course-hole-graphic-yardage-arc"
                fill="none"
              />
            ) : null,
          )}
        </svg>

        <svg
          className="course-hole-graphic-yardage-labels"
          width={mediaRect.width}
          height={mediaRect.height}
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="none"
        >
          {arcPaths.map((arc) => (
            <g key={`label-${arc.key}`}>
              <rect
                x={arc.labelX - 20}
                y={arc.labelY - 24}
                width={40}
                height={18}
                rx={4}
                className="course-hole-graphic-yardage-label-bg"
              />
              <text
                x={arc.labelX}
                y={arc.labelY - 11}
                textAnchor="middle"
                className="course-hole-graphic-yardage-label"
              >
                {arc.yards}
              </text>
            </g>
          ))}
          <circle
            cx={pinX}
            cy={pinY}
            r={5}
            className="course-hole-graphic-yardage-pin"
          />
        </svg>
      </div>
    </div>
  );
}
